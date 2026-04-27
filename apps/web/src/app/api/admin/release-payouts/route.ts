import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const now = new Date().toISOString();

        // Get all held transactions where hold has expired
        const { data: heldTx, error } = await supabase
            .from("payment_transactions")
            .select("id, booking_id, trainer_payout, hold_until, bookings(trainer_id, status)")
            .eq("status", "held")
            .lte("hold_until", now);

        if (error) throw error;
        if (!heldTx || heldTx.length === 0) return NextResponse.json({ released: 0, skipped: 0, message: "No payouts ready." });

        // Get active disputes (these bookings are blocked)
        const bookingIds = heldTx.map((t: any) => t.booking_id);
        const { data: disputes } = await supabase
            .from("disputes")
            .select("booking_id")
            .in("booking_id", bookingIds)
            .in("status", ["under_review", "escalated"]);

        const disputedSet = new Set((disputes || []).map((d: any) => d.booking_id));

        // Get trainer stripe accounts
        const trainerIds = [...new Set(heldTx.map((t: any) => t.bookings?.trainer_id).filter(Boolean))];
        const { data: trainerProfiles } = await supabase
            .from("trainer_profiles")
            .select("user_id, stripe_account_id")
            .in("user_id", trainerIds);

        const stripeMap = new Map((trainerProfiles || []).map((tp: any) => [tp.user_id, tp.stripe_account_id]));

        const toRelease: string[] = [];
        const skippedReasons: { id: string; reason: string }[] = [];

        for (const tx of heldTx as any[]) {
            const booking = tx.bookings;

            // Edge: booking not completed
            if (booking?.status !== "completed") {
                skippedReasons.push({ id: tx.id, reason: "booking_not_completed" });
                continue;
            }
            // Edge: active dispute
            if (disputedSet.has(tx.booking_id)) {
                skippedReasons.push({ id: tx.id, reason: "active_dispute" });
                continue;
            }
            // Edge: trainer has no Stripe account
            const stripeId = stripeMap.get(booking?.trainer_id);
            if (!stripeId) {
                skippedReasons.push({ id: tx.id, reason: "no_stripe_account" });
                continue;
            }

            toRelease.push(tx.id);
        }

        if (toRelease.length > 0) {
            const { error: updateErr } = await supabase
                .from("payment_transactions")
                .update({ status: "released", released_at: now })
                .in("id", toRelease);

            if (updateErr) throw updateErr;
        }

        if (toRelease.length > 0) {
            await logAdminAction({
                actorId: auth.ctx.userId,
                action: "release_payouts_bulk",
                targetType: "payment_transactions",
                payload: { releasedIds: toRelease, skippedReasons },
            });
        }

        return NextResponse.json({
            released: toRelease.length,
            skipped: skippedReasons.length,
            skippedReasons,
        });
    } catch (err: any) {
        console.error("Bulk release error:", err);
        return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
    }
}
