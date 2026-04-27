// ============================================
// Bulk reconciliation scanner — fetch recent bookings + recent Stripe Checkout
// Sessions, cross-reference them, and return only the ones that need admin
// attention (i.e. not in_sync, not unpaid, not no_stripe_session_found).
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const MAX_RESULTS = 100;

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Recent bookings in pending/confirmed
        const { data: bookings, error: bookingsErr } = await supabase
            .from('bookings')
            .select('id, status, scheduled_at, price, total_paid, created_at')
            .in('status', ['confirmed', 'pending'])
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(500);
        if (bookingsErr) {
            return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
        }
        if (!bookings || bookings.length === 0) {
            return NextResponse.json({ items: [], scannedBookings: 0, scannedSessions: 0 });
        }

        // 2. Recent Stripe Checkout Sessions
        const sessions = await stripe.checkout.sessions.list({ limit: 100 });

        // Index sessions by metadata.bookingId for fast lookup
        const sessionByBooking = new Map<string, Stripe.Checkout.Session>();
        for (const s of sessions.data) {
            const bid = s.metadata?.bookingId;
            if (bid && !sessionByBooking.has(bid)) {
                sessionByBooking.set(bid, s);
            }
        }

        // 3. Existing payment_transactions for these bookings (single batched query)
        const bookingIds = bookings.map((b) => b.id);
        const { data: txRows } = await supabase
            .from('payment_transactions')
            .select('booking_id, id, status, amount, stripe_payment_intent_id')
            .in('booking_id', bookingIds);
        const txByBooking = new Map<string, any>();
        for (const t of txRows || []) {
            txByBooking.set(t.booking_id, t);
        }

        // 4. Diagnose each booking
        const items: Array<{
            bookingId: string;
            diagnosis: string;
            bookingStatus: string;
            sessionId?: string;
            paymentIntentId?: string | null;
            amount?: number | null;
            currency?: string | null;
            customerEmail?: string | null;
            scheduledAt?: string | null;
            createdAt?: string | null;
            dbTxStatus?: string | null;
        }> = [];

        for (const booking of bookings) {
            const matched = sessionByBooking.get(booking.id);
            const existingTx = txByBooking.get(booking.id);
            const stripePaid = matched?.payment_status === 'paid';
            const dbHasTx = !!existingTx;

            let diagnosis: string;
            if (!matched) {
                diagnosis = 'no_stripe_session_found';
            } else if (stripePaid && !dbHasTx) {
                diagnosis = 'paid_in_stripe_missing_in_db';
            } else if (
                stripePaid &&
                dbHasTx &&
                existingTx.status !== 'held' &&
                existingTx.status !== 'released'
            ) {
                diagnosis = 'paid_in_stripe_db_status_mismatch';
            } else if (!stripePaid && dbHasTx) {
                diagnosis = 'unpaid_in_stripe_but_db_has_tx';
            } else if (stripePaid && dbHasTx) {
                diagnosis = 'in_sync';
            } else {
                diagnosis = 'unpaid';
            }

            // Skip the boring/normal cases
            if (
                diagnosis === 'in_sync' ||
                diagnosis === 'unpaid' ||
                diagnosis === 'no_stripe_session_found'
            ) {
                continue;
            }

            const piId = matched
                ? typeof matched.payment_intent === 'string'
                    ? matched.payment_intent
                    : matched.payment_intent?.id ?? null
                : null;

            items.push({
                bookingId: booking.id,
                diagnosis,
                bookingStatus: booking.status,
                sessionId: matched?.id,
                paymentIntentId: piId,
                amount: matched?.amount_total != null ? matched.amount_total / 100 : null,
                currency: matched?.currency ?? null,
                customerEmail: matched?.customer_email ?? null,
                scheduledAt: booking.scheduled_at ?? null,
                createdAt: booking.created_at ?? null,
                dbTxStatus: existingTx?.status ?? null,
            });

            if (items.length >= MAX_RESULTS) break;
        }

        return NextResponse.json({
            items,
            scannedBookings: bookings.length,
            scannedSessions: sessions.data.length,
        });
    } catch (err: any) {
        console.error('[reconcile-scan] error', err);
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
    }
}
