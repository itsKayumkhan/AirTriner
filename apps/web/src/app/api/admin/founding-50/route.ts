import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    let body: { trainerUserId?: string; action?: "grant" | "revoke" };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { trainerUserId, action } = body;
    if (!trainerUserId || (action !== "grant" && action !== "revoke")) {
        return NextResponse.json(
            { error: "Missing trainerUserId or invalid action" },
            { status: 400 }
        );
    }

    if (action === "grant") {
        const { data, error } = await adminSupabase.rpc("grant_founding_50", {
            p_user_id: trainerUserId,
        });
        if (error) {
            console.error("grant_founding_50 rpc error", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        // rpc returns a row (or array of rows) with { status, current_count, profile_id }
        const row = Array.isArray(data) ? data[0] : data;
        const status: string = row?.status;
        const currentCount: number = row?.current_count ?? 0;
        const profileId: string | null = row?.profile_id ?? null;

        if (status === "not_found") {
            return NextResponse.json(
                { error: "Trainer profile not found" },
                { status: 404 }
            );
        }
        if (status === "cap_reached") {
            return NextResponse.json(
                { error: "Founding 50 cap reached" },
                { status: 409 }
            );
        }
        if (status === "already") {
            return NextResponse.json(
                { error: "Trainer is already in Founding 50" },
                { status: 409 }
            );
        }

        await logAdminAction({
            actorId: auth.ctx.userId,
            action: "founding_50_grant",
            targetType: "trainer_profiles",
            targetId: profileId ?? trainerUserId,
            payload: { trainerUserId, foundingCount: currentCount },
        });

        return NextResponse.json({ ok: true, foundingCount: currentCount });
    }

    // action === 'revoke'
    const { data: profile, error: fetchErr } = await adminSupabase
        .from("trainer_profiles")
        .select("id, is_founding_50, subscription_expires_at")
        .eq("user_id", trainerUserId)
        .maybeSingle();

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!profile) {
        return NextResponse.json({ error: "Trainer profile not found" }, { status: 404 });
    }
    if (!profile.is_founding_50) {
        return NextResponse.json(
            { error: "Trainer is not in Founding 50" },
            { status: 409 }
        );
    }

    const expiresAt = profile.subscription_expires_at
        ? new Date(profile.subscription_expires_at).getTime()
        : 0;
    const newSubStatus = expiresAt > Date.now() ? "trial" : "expired";

    const { error: updErr } = await adminSupabase
        .from("trainer_profiles")
        .update({
            is_founding_50: false,
            founding_50_granted_at: null,
            subscription_status: newSubStatus,
            subscription_expires_at: null,
        })
        .eq("id", profile.id);

    if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { count } = await adminSupabase
        .from("trainer_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_founding_50", true);

    await logAdminAction({
        actorId: auth.ctx.userId,
        action: "founding_50_revoke",
        targetType: "trainer_profiles",
        targetId: profile.id,
        payload: { trainerUserId, foundingCount: count ?? 0, newSubStatus },
    });

    return NextResponse.json({ ok: true, foundingCount: count ?? 0 });
}
