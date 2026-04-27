// ============================================
// Stripe Connect Status — Detailed account info for trainer dashboard
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
        const userId = req.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Auth: verify the user is a trainer
        const { data: authUser } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .eq('role', 'trainer')
            .single();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Get trainer's stripe_account_id
        const { data: profile } = await supabaseAdmin
            .from('trainer_profiles')
            .select('stripe_account_id')
            .eq('user_id', userId)
            .single();

        if (!profile?.stripe_account_id) {
            return NextResponse.json({
                hasAccount: false,
                onboardingComplete: false,
                payoutsEnabled: false,
                chargesEnabled: false,
                bankLast4: null,
                bankName: null,
                dashboardUrl: null,
            });
        }

        // Stripe will throw "platform_account_required" if Connect isn't
        // enabled on the platform account, OR "resource_missing" if the saved
        // acct_xxx was deleted in Stripe. Either way the saved id is unusable —
        // surface that to the UI so the Connect button reappears.
        let account: Stripe.Account;
        try {
            account = await stripe.accounts.retrieve(profile.stripe_account_id);
        } catch (err: any) {
            const code = err?.code;
            const isUnusable = code === 'platform_account_required' || code === 'resource_missing' || code === 'account_invalid';
            console.warn('[stripe/connect-status] retrieve failed', { code, message: err?.message });
            if (isUnusable) {
                return NextResponse.json({
                    hasAccount: false,
                    onboardingComplete: false,
                    payoutsEnabled: false,
                    chargesEnabled: false,
                    bankLast4: null,
                    bankName: null,
                    dashboardUrl: null,
                    needsPlatformSetup: code === 'platform_account_required',
                    notice: code === 'platform_account_required'
                        ? 'Stripe Connect is not enabled on the AirTrainr platform account. Admin must enable Connect in the Stripe dashboard.'
                        : 'The previously linked Stripe account is no longer valid. Please reconnect.',
                });
            }
            throw err;
        }

        // Try to get bank account details
        let bankLast4: string | null = null;
        let bankName: string | null = null;
        try {
            const externalAccounts = await stripe.accounts.listExternalAccounts(
                profile.stripe_account_id,
                { limit: 1, object: 'bank_account' }
            );
            if (externalAccounts.data.length > 0) {
                const bank = externalAccounts.data[0] as Stripe.BankAccount;
                bankLast4 = bank.last4 ?? null;
                bankName = bank.bank_name ?? null;
            }
        } catch {
            // External accounts may not be available yet
        }

        // Create Express dashboard login link (only if onboarding is complete)
        let dashboardUrl: string | null = null;
        if (account.details_submitted) {
            try {
                const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
                dashboardUrl = loginLink.url;
            } catch {
                // Login link may fail if account isn't fully set up
            }
        }

        return NextResponse.json({
            hasAccount: true,
            onboardingComplete: account.details_submitted ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            chargesEnabled: account.charges_enabled ?? false,
            bankLast4,
            bankName,
            dashboardUrl,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch connect status';
        console.error('[stripe/connect-status] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
