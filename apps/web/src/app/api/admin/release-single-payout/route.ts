import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { transferToTrainer } from "@/lib/stripe-transfer";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const { txId, bookingId } = await req.json();
        if (!txId) return NextResponse.json({ error: "Missing txId" }, { status: 400 });

        const now = new Date().toISOString();

        // Guard: only release if currently held — never re-stamp released/refunded rows
        const { data: tx, error: fetchErr } = await adminSupabase
            .from("payment_transactions")
            .select("id, status, booking_id, trainer_payout, stripe_payment_intent_id, bookings(trainer_id, status)")
            .eq("id", txId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        if (tx.status !== "held") {
            return NextResponse.json({ error: `Cannot release: status is '${tx.status}'` }, { status: 409 });
        }

        const booking = tx.bookings as any;
        if (booking?.status !== "completed") {
            return NextResponse.json({ error: `Cannot release: booking status is '${booking?.status ?? "unknown"}'` }, { status: 409 });
        }

        // Block release if there is an active dispute on the booking
        const { data: activeDispute } = await adminSupabase
            .from("disputes")
            .select("id")
            .eq("booking_id", tx.booking_id)
            .in("status", ["under_review", "escalated"])
            .maybeSingle();
        if (activeDispute) {
            return NextResponse.json({ error: "Cannot release: active dispute on booking" }, { status: 409 });
        }

        // Look up trainer's Connect account
        const trainerId = booking?.trainer_id as string | undefined;
        if (!trainerId) {
            return NextResponse.json({ error: "Booking has no trainer" }, { status: 400 });
        }
        const { data: trainerProfile } = await adminSupabase
            .from("trainer_profiles")
            .select("stripe_account_id")
            .eq("user_id", trainerId)
            .maybeSingle();
        const destinationAccountId = trainerProfile?.stripe_account_id || null;

        // Fire Stripe Transfer FIRST (irreversible side-effect)
        const result = await transferToTrainer(stripe, {
            txId: tx.id,
            bookingId: tx.booking_id,
            amountUsd: Number(tx.trainer_payout),
            destinationAccountId: destinationAccountId || "",
            stripePaymentIntentId: tx.stripe_payment_intent_id,
        });
        if (!result.ok) {
            await logAdminAction({
                actorId: auth.ctx.userId,
                action: "release_payout_single_failed",
                targetType: "payment_transactions",
                targetId: txId,
                payload: { bookingId: tx.booking_id, amount: tx.trainer_payout, reason: result.reason, code: result.code },
            });
            // Map machine reasons to admin-friendly explanations.
            const userMessage = (() => {
                switch (result.reason) {
                    case 'no_stripe_account':
                        return "Trainer hasn't connected their Stripe (Connect) account yet.";
                    case 'invalid_amount':
                        return "Payout amount is invalid (must be > 0).";
                    case 'payouts_not_enabled':
                        return "Trainer's Stripe account is not yet approved for payouts (verification pending).";
                    case 'account_lookup_failed':
                        return `Could not look up trainer's Stripe account (${result.code || 'error'}).`;
                    case 'stripe_payment_intent_not_found':
                        return "The original payment is missing from Stripe (orphan transaction). Reconcile this booking before releasing.";
                    default:
                        return `Stripe transfer failed: ${result.reason}`;
                }
            })();
            console.error('[release-single-payout] transfer rejected', {
                txId, bookingId: tx.booking_id, reason: result.reason, code: result.code,
            });
            return NextResponse.json({ error: userMessage, reason: result.reason, code: result.code }, { status: 502 });
        }

        // Only after Transfer succeeds, mark released + persist transfer id
        const { error } = await adminSupabase
            .from("payment_transactions")
            .update({ status: "released", released_at: now, stripe_transfer_id: result.transferId })
            .eq("id", txId)
            .eq("status", "held");

        if (error) throw error;

        await logAdminAction({
            actorId: auth.ctx.userId,
            action: "release_payout_single",
            targetType: "payment_transactions",
            targetId: txId,
            payload: {
                bookingId: bookingId ?? tx.booking_id,
                amount: tx.trainer_payout,
                stripeTransferId: result.transferId,
                destinationAccountId,
            },
        });

        return NextResponse.json({ success: true, transferId: result.transferId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
