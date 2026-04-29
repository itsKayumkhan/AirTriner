// ============================================
// Cancel Subscription (period-end)
// TOS compliance: trainers can cancel anytime.
// We don't immediate-cancel — let them use what they paid for through end of period.
// Webhook will catch the actual end-of-period flip later.
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireSessionUser(req);
        if ('error' in auth) return auth.error;

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Supabase service key not set' }, { status: 500 });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } }
        );

        const userId = auth.user.id;

        // Load trainer profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('trainer_profiles')
            .select('subscription_status, subscription_expires_at')
            .eq('user_id', userId)
            .maybeSingle();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
        }

        const cancellableStatuses = ['active', 'past_due', 'incomplete'];
        if (!cancellableStatuses.includes(profile.subscription_status as string)) {
            return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 409 });
        }

        // Find the subscription via metadata.userId search.
        // Stripe Search API lets us match metadata.userId without storing customer_id.
        let foundSub: Stripe.Subscription | null = null;
        try {
            const searchResult = await stripe.subscriptions.search({
                query: `metadata['userId']:'${userId}' AND status:'active'`,
                limit: 1,
            });
            if (searchResult.data.length > 0) {
                foundSub = searchResult.data[0];
            } else {
                // Fallback: search any non-cancelled status
                const altSearch = await stripe.subscriptions.search({
                    query: `metadata['userId']:'${userId}'`,
                    limit: 5,
                });
                foundSub = altSearch.data.find(
                    (s) => s.status !== 'canceled' && s.status !== 'incomplete_expired'
                ) || null;
            }
        } catch (searchErr) {
            console.error('[cancel-subscription] Stripe search failed:', searchErr);
            // Continue — we'll fall back to DB-only update
        }

        if (foundSub) {
            // Cancel at period end — keep using through paid period
            const updated = await stripe.subscriptions.update(foundSub.id, {
                cancel_at_period_end: true,
            });

            // Don't change DB status — webhook flips it on customer.subscription.deleted.
            // Keep showing "active until X" in the UI.
            const periodEnd = (updated as any).current_period_end as number | undefined;
            const willEndAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : profile.subscription_expires_at;

            return NextResponse.json({
                ok: true,
                willEndAt,
                mode: 'period_end' as const,
            });
        }

        // No Stripe subscription found — likely a Founding 50 grant or test data.
        // Update DB directly.
        const { error: updateError } = await supabaseAdmin
            .from('trainer_profiles')
            .update({ subscription_status: 'cancelled' })
            .eq('user_id', userId);

        if (updateError) {
            console.error('[cancel-subscription] DB update failed:', updateError);
            return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            willEndAt: null,
            mode: 'immediate' as const,
        });
    } catch (err: any) {
        console.error('[cancel-subscription] Error:', err);
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}
