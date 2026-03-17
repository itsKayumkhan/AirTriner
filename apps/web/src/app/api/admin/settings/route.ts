import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const { error } = await adminSupabase
            .from("platform_settings")
            .upsert({
                id: "00000000-0000-0000-0000-000000000001",
                ...body,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
