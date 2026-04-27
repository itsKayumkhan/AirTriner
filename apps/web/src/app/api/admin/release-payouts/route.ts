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
        const now = new Date().toISOString();

        const { data: heldTx, error } = await supabase
            .from("payment_transactions")
            .select("id, booking_id, trainer_payout, hold_until, stripe_payment_intent_id, bookings(trainer_id, status)")
            .eq("status", "held")
            .lte("hold_until", now);

        if (error) throw error;
        if (!heldTx || heldTx.length === 0) return NextResponse.json({ released: 0, skipped: 0, message: "No payouts ready." });

        const bookingIds = heldTx.map((t: any) => t.booking_id);
        const { data: disputes } = await supabase
            .from("disputes")
            .select("booking_id")
            .in("booking_id", bookingIds)
            .in("status", ["under_review", "escalated"]);
        const disputedSet = new Set((disputes || []).map((d: any) => d.booking_id));

        const trainerIds = [...new Set(heldTx.map((t: any) => t.bookings?.trainer_id).filter(Boolean))];
        const { data: trainerProfiles } = await supabase
            .from("trainer_profiles")
            .select("user_id, stripe_account_id")
            .in("user_id", trainerIds);
        const stripeMap = new Map((trainerProfiles || []).map((tp: any) => [tp.user_id, tp.stripe_account_id]));

        const released: { id: string; transferId: string }[] = [];
        const skippedReasons: { id: string; reason: string; code?: string }[] = [];

        // Process per-row: each Transfer is its own try/catch so a single failure
        // doesn't poison the rest of the batch. Stripe call FIRST, DB only on success.
        for (const tx of heldTx as any[]) {
            const booking = tx.bookings;

            if (booking?.status !== "completed") {
                skippedReasons.push({ id: tx.id, reason: "booking_not_completed" });
                continue;
            }
            if (disputedSet.has(tx.booking_id)) {
                skippedReasons.push({ id: tx.id, reason: "active_dispute" });
                continue;
            }
            const stripeId = stripeMap.get(booking?.trainer_id);
            if (!stripeId) {
                skippedReasons.push({ id: tx.id, reason: "no_stripe_account" });
                continue;
            }

            const result = await transferToTrainer(stripe, {
                txId: tx.id,
                bookingId: tx.booking_id,
                amountUsd: Number(tx.trainer_payout),
                destinationAccountId: stripeId,
                stripePaymentIntentId: tx.stripe_payment_intent_id,
            });

            if (!result.ok) {
                skippedReasons.push({ id: tx.id, reason: result.reason, code: result.code });
                continue;
            }

            const { error: updateErr } = await supabase
                .from("payment_transactions")
                .update({ status: "released", released_at: now, stripe_transfer_id: result.transferId })
                .eq("id", tx.id)
                .eq("status", "held");

            if (updateErr) {
                // Stripe transfer succeeded but DB write failed — surface so admin can reconcile manually.
                skippedReasons.push({ id: tx.id, reason: `db_update_failed_after_transfer:${result.transferId}` });
                continue;
            }

            released.push({ id: tx.id, transferId: result.transferId });
        }

        if (released.length > 0 || skippedReasons.length > 0) {
            await logAdminAction({
                actorId: auth.ctx.userId,
                action: "release_payouts_bulk",
                targetType: "payment_transactions",
                payload: { released, skippedReasons },
            });
        }

        return NextResponse.json({
            released: released.length,
            skipped: skippedReasons.length,
            releasedDetails: released,
            skippedReasons,
        });
    } catch (err: any) {
        console.error("Bulk release error:", err);
        return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
    }
}
