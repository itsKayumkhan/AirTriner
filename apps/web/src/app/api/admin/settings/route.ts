import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Lazy getter — only called at request time, NOT during `next build`
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase environment variables");
    }
    return createClient(url, key);
}

export async function POST(req: NextRequest) {
    try {
        const adminSupabase = getAdminSupabase();
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
