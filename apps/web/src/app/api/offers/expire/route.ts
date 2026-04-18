import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Lazy getter — only called at request time, NOT during `next build`
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase environment variables");
    }
    return createClient(url, key);
}

interface ProposedDates {
    scheduledAt?: string;
    sessions?: { date: string; time: string }[];
    session_type?: string;
    timezone?: string;
    [key: string]: unknown;
}

/**
 * Auto-expire pending training offers whose proposed session date/time has passed.
 *
 * For each pending offer, we look at:
 *   1. proposed_dates.scheduledAt (ISO date or datetime string)
 *   2. proposed_dates.sessions[0] (first { date, time } pair) as fallback
 *
 * If the latest proposed session datetime is in the past, we mark it as expired.
 */
export async function POST() {
    try {
        const adminSupabase = getAdminSupabase();

        // Fetch all pending offers
        const { data: pendingOffers, error: fetchError } = await adminSupabase
            .from("training_offers")
            .select("id, proposed_dates")
            .eq("status", "pending");

        if (fetchError) throw fetchError;

        const now = Date.now();
        const toExpire: string[] = [];

        for (const offer of pendingOffers || []) {
            const proposed = (offer.proposed_dates as ProposedDates | null) || {};

            // Collect candidate datetimes from the offer
            const candidateTimes: number[] = [];

            // 1. scheduledAt (could be a plain date string like "2026-01-15" or an ISO datetime)
            if (proposed.scheduledAt) {
                const scheduledStr = String(proposed.scheduledAt);
                // If it's just a YYYY-MM-DD, treat as end-of-day to be lenient
                const datePart = scheduledStr.includes("T")
                    ? scheduledStr
                    : `${scheduledStr}T23:59:59`;
                const t = new Date(datePart).getTime();
                if (!isNaN(t)) candidateTimes.push(t);
            }

            // 2. sessions array — use the LATEST session datetime (so offer only expires after every session has passed)
            if (Array.isArray(proposed.sessions) && proposed.sessions.length > 0) {
                for (const s of proposed.sessions) {
                    if (s?.date) {
                        const dateTimeStr = s.time
                            ? `${s.date}T${s.time}`
                            : `${s.date}T23:59:59`;
                        const t = new Date(dateTimeStr).getTime();
                        if (!isNaN(t)) candidateTimes.push(t);
                    }
                }
            }

            // If we have no candidate times, don't expire — safer to leave it pending
            if (candidateTimes.length === 0) continue;

            const latestTime = Math.max(...candidateTimes);
            if (latestTime < now) {
                toExpire.push(offer.id as string);
            }
        }

        if (toExpire.length === 0) {
            return NextResponse.json({ success: true, expired: 0 });
        }

        const { error: updateError } = await adminSupabase
            .from("training_offers")
            .update({ status: "expired" })
            .in("id", toExpire);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, expired: toExpire.length });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Also allow GET for convenience (e.g., cron, manual trigger)
export async function GET() {
    return POST();
}
