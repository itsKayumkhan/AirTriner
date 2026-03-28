import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const { txId, bookingId } = await req.json();
        if (!txId) return NextResponse.json({ error: "Missing txId" }, { status: 400 });

        const now = new Date().toISOString();

        const { error } = await adminSupabase
            .from("payment_transactions")
            .update({ status: "released", released_at: now })
            .eq("id", txId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
