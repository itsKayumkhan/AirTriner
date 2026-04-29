// ============================================
// Admin: Resolve a Dispute
// Two actions:
//   - 'refund'  → refund the athlete (reverse transfer first if released, then refund PI), cancel booking
//   - 'resolve' → release held funds to trainer via Stripe transfer
// Either way: dispute marked resolved with the matching resolution.
// All Stripe calls are idempotent on `dispute_<action>_<disputeId>`.
// ============================================
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
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { disputeId, action } = await req.json();
        if (!disputeId || (action !== "refund" && action !== "resolve")) {
            return NextResponse.json({ error: "Invalid disputeId or action" }, { status: 400 });
        }

        // 1. Fetch dispute, validate state
        const { data: dispute, error: dErr } = await supabase
            .from("disputes")
            .select("id, booking_id, status, reason")
            .eq("id", disputeId)
            .maybeSingle();
        if (dErr) throw dErr;
        if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
        if (dispute.status !== "under_review" && dispute.status !== "escalated") {
            return NextResponse.json(
                { error: `Cannot act on dispute in status '${dispute.status}'` },
                { status: 409 }
            );
        }

        // 2. Fetch payment_transactions row for this booking
        const { data: tx, error: txErr } = await supabase
            .from("payment_transactions")
            .select("*")
            .eq("booking_id", dispute.booking_id)
            .maybeSingle();
        if (txErr) throw txErr;

        const idemKey = `dispute_${action}_${disputeId}`;
        const now = new Date().toISOString();

        if (action === "refund") {
            // ─── REFUND PATH ─────────────────────────────────
            if (tx) {
                if (!tx.stripe_payment_intent_id) {
                    return NextResponse.json({ error: "No payment intent on transaction" }, { status: 400 });
                }
                if (tx.status === "refunded") {
                    // already refunded — fall through to dispute close
                } else if (tx.status === "held" || tx.status === "released") {
                    // If released, reverse the transfer first
                    if (tx.status === "released") {
                        if (!tx.stripe_transfer_id) {
                            return NextResponse.json(
                                { error: "Released tx missing stripe_transfer_id" },
                                { status: 500 }
                            );
                        }
                        try {
                            await stripe.transfers.createReversal(
                                tx.stripe_transfer_id,
                                { refund_application_fee: true },
                                { idempotencyKey: `${idemKey}_reversal` }
                            );
                        } catch (revErr: any) {
                            return NextResponse.json(
                                { error: `Transfer reversal failed: ${revErr.message}` },
                                { status: 502 }
                            );
                        }
                    }

                    const refund = await stripe.refunds.create(
                        { payment_intent: tx.stripe_payment_intent_id },
                        { idempotencyKey: idemKey }
                    );
                    if (refund.status !== "succeeded" && refund.status !== "pending") {
                        return NextResponse.json(
                            { error: `Refund failed with status: ${refund.status}` },
                            { status: 500 }
                        );
                    }
                    await supabase
                        .from("payment_transactions")
                        .update({ status: "refunded" })
                        .eq("id", tx.id);
                } else {
                    return NextResponse.json(
                        { error: `Cannot refund tx in status '${tx.status}'` },
                        { status: 409 }
                    );
                }
            }

            // Cancel booking
            await supabase
                .from("bookings")
                .update({ status: "cancelled" })
                .eq("id", dispute.booking_id);

            await logAdminAction({
                actorId: auth.ctx.userId,
                action: "dispute_refund",
                targetType: "disputes",
                targetId: dispute.id,
                payload: { bookingId: dispute.booking_id, txId: tx?.id ?? null },
            });
        } else {
            // ─── RESOLVE / PAYOUT PATH ──────────────────────
            if (!tx) {
                return NextResponse.json({ error: "No payment_transaction for booking" }, { status: 400 });
            }

            if (tx.status === "released") {
                // Idempotent no-op — admin double-clicked
            } else if (tx.status === "held") {
                // Look up trainer's Connect account
                const { data: booking } = await supabase
                    .from("bookings")
                    .select("trainer_id")
                    .eq("id", dispute.booking_id)
                    .maybeSingle();
                const trainerId = booking?.trainer_id;
                if (!trainerId) {
                    return NextResponse.json({ error: "Booking has no trainer" }, { status: 400 });
                }
                const { data: trainerProfile } = await supabase
                    .from("trainer_profiles")
                    .select("stripe_account_id")
                    .eq("user_id", trainerId)
                    .maybeSingle();
                const destinationAccountId = trainerProfile?.stripe_account_id || "";

                const result = await transferToTrainer(stripe, {
                    txId: tx.id,
                    bookingId: tx.booking_id,
                    amountUsd: Number(tx.trainer_payout),
                    destinationAccountId,
                    stripePaymentIntentId: tx.stripe_payment_intent_id,
                });
                if (!result.ok) {
                    await logAdminAction({
                        actorId: auth.ctx.userId,
                        action: "dispute_resolve_payout_failed",
                        targetType: "disputes",
                        targetId: dispute.id,
                        payload: { bookingId: dispute.booking_id, reason: result.reason, code: result.code },
                    });
                    const userMessage = (() => {
                        switch (result.reason) {
                            case "no_stripe_account":
                                return "Trainer hasn't connected their Stripe (Connect) account yet.";
                            case "payouts_not_enabled":
                                return "Trainer's Stripe account is not yet approved for payouts.";
                            case "stripe_payment_intent_not_found":
                                return "Original payment is missing from Stripe (orphan transaction).";
                            default:
                                return `Stripe transfer failed: ${result.reason}`;
                        }
                    })();
                    return NextResponse.json(
                        { error: userMessage, reason: result.reason, code: result.code },
                        { status: 502 }
                    );
                }

                const { error: updErr } = await supabase
                    .from("payment_transactions")
                    .update({ status: "released", released_at: now, stripe_transfer_id: result.transferId })
                    .eq("id", tx.id)
                    .eq("status", "held");
                if (updErr) throw updErr;
            } else {
                return NextResponse.json(
                    { error: `Cannot resolve dispute — tx status is '${tx.status}'` },
                    { status: 409 }
                );
            }

            await logAdminAction({
                actorId: auth.ctx.userId,
                action: "dispute_resolve_payout",
                targetType: "disputes",
                targetId: dispute.id,
                payload: { bookingId: dispute.booking_id, txId: tx.id },
            });
        }

        // 3. Mark dispute resolved
        const resolution = action === "refund" ? "refund_athlete" : "payout_trainer";
        const { error: closeErr } = await supabase
            .from("disputes")
            .update({ status: "resolved", resolved_at: now, resolution })
            .eq("id", dispute.id);
        if (closeErr) throw closeErr;

        return NextResponse.json({ success: true, resolution });
    } catch (err: any) {
        console.error("[resolve-dispute] error:", err);
        return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
}
