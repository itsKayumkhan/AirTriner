import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

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
            .select("id, status, booking_id, trainer_payout")
            .eq("id", txId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        if (tx.status !== "held") {
            return NextResponse.json({ error: `Cannot release: status is '${tx.status}'` }, { status: 409 });
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

        const { error } = await adminSupabase
            .from("payment_transactions")
            .update({ status: "released", released_at: now })
            .eq("id", txId)
            .eq("status", "held");

        if (error) throw error;

        await logAdminAction({
            actorId: auth.ctx.userId,
            action: "release_payout_single",
            targetType: "payment_transactions",
            targetId: txId,
            payload: { bookingId: bookingId ?? tx.booking_id, amount: tx.trainer_payout },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
