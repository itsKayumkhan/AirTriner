import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

const ALLOWED_KEYS = [
    "platform_fee_percentage",
    "max_booking_distance",
    "auto_approve_trainers",
    "require_trainer_verification",
    "cancellation_policy_hours",
    "dispute_resolution_days",
    "support_email",
    "maintenance_mode",
    "allowed_countries",
] as const;

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
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    try {
        const adminSupabase = getAdminSupabase();
        const body = await req.json();

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid body" }, { status: 400 });
        }

        const sanitized: Record<string, unknown> = {};
        for (const key of ALLOWED_KEYS) {
            if (key in body) sanitized[key] = (body as Record<string, unknown>)[key];
        }

        if ("platform_fee_percentage" in sanitized) {
            const v = Number(sanitized.platform_fee_percentage);
            if (!Number.isFinite(v) || v < 0 || v > 100) {
                return NextResponse.json({ error: "platform_fee_percentage must be 0–100" }, { status: 400 });
            }
            sanitized.platform_fee_percentage = v;
        }
        if ("maintenance_mode" in sanitized) {
            sanitized.maintenance_mode = Boolean(sanitized.maintenance_mode);
        }
        if ("allowed_countries" in sanitized && !Array.isArray(sanitized.allowed_countries)) {
            return NextResponse.json({ error: "allowed_countries must be an array" }, { status: 400 });
        }

        const { error } = await adminSupabase
            .from("platform_settings")
            .upsert({
                id: "00000000-0000-0000-0000-000000000001",
                ...sanitized,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;

        await logAdminAction({
            actorId: auth.ctx.userId,
            action: "update_platform_settings",
            targetType: "platform_settings",
            payload: sanitized,
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
