// ============================================
// Training Offer — PATCH (trainer edits a pending offer)
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy getter so `next build` doesn't fail if envs are missing
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase environment variables");
    }
    return createClient(url, key);
}

interface PatchBody {
    userId?: string;                 // trainer id (authorization check)
    rate?: number;                   // maps to `price` column
    session_type?: string;           // stored inside proposed_dates.session_type
    proposed_at?: string;            // YYYY-MM-DD; stored as proposed_dates.sessions[0].date
    proposed_time?: string;          // HH:MM; stored as proposed_dates.sessions[0].time
    notes?: string;                  // maps to `message` column
    sport?: string;
}

interface ProposedDates {
    sessions?: { date: string; time: string }[];
    session_type?: string;
    timezone?: string;
    scheduledAt?: string;
    [key: string]: unknown;
}

/**
 * PATCH /api/offers/[id]
 * Edit a pending training offer.
 * - Only the trainer who created the offer can edit it.
 * - Only allowed while status === 'pending'.
 * - Editable fields: rate (price), session_type, proposed_at + proposed_time, notes (message), sport.
 * - Attempts to change status/trainer_id/athlete_id are ignored.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const { id } = await Promise.resolve(params);
        if (!id) {
            return NextResponse.json({ error: "Missing offer id" }, { status: 400 });
        }

        const body = (await req.json()) as PatchBody;
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 401 });
        }

        const admin = getAdminSupabase();

        // Fetch existing offer
        const { data: existing, error: fetchError } = await admin
            .from("training_offers")
            .select("id, trainer_id, status, proposed_dates, price, message, sport")
            .eq("id", id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        }

        // Authorization: trainer who created it only
        if (existing.trainer_id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Only pending offers can be edited
        if (existing.status !== "pending") {
            return NextResponse.json(
                { error: "Only pending offers can be edited" },
                { status: 409 }
            );
        }

        // Build update payload — only include allowed fields
        const updates: Record<string, unknown> = {};

        if (body.rate !== undefined) {
            const numericRate = Number(body.rate);
            if (isNaN(numericRate) || numericRate < 0) {
                return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
            }
            updates.price = numericRate;
        }

        if (body.notes !== undefined) {
            updates.message = body.notes || null;
        }

        if (body.sport !== undefined) {
            updates.sport = body.sport || null;
        }

        // proposed_dates is a JSONB column — merge session_type and first session date/time
        const needsProposedUpdate =
            body.session_type !== undefined ||
            body.proposed_at !== undefined ||
            body.proposed_time !== undefined;

        if (needsProposedUpdate) {
            const current = (existing.proposed_dates as ProposedDates | null) || {};
            const currentSessions = Array.isArray(current.sessions) ? [...current.sessions] : [];
            const firstSession = currentSessions[0] || { date: "", time: "" };

            if (body.proposed_at !== undefined) firstSession.date = body.proposed_at || "";
            if (body.proposed_time !== undefined) firstSession.time = body.proposed_time || "";

            if (currentSessions.length === 0) currentSessions.push(firstSession);
            else currentSessions[0] = firstSession;

            const nextProposed: ProposedDates = {
                ...current,
                sessions: currentSessions,
            };

            if (body.session_type !== undefined) {
                nextProposed.session_type = body.session_type;
            }

            if (body.proposed_at !== undefined) {
                nextProposed.scheduledAt = body.proposed_at || undefined;
            }

            updates.proposed_dates = nextProposed;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
        }

        updates.updated_at = new Date().toISOString();

        const { data: updated, error: updateError } = await admin
            .from("training_offers")
            .update(updates)
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) {
            console.error("[api/offers/[id]] update error:", updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, offer: updated });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[api/offers/[id]] PATCH error:", err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
