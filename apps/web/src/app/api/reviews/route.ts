// ============================================
// POST /api/reviews
// Athlete submits a review for a completed session. Server-side
// recompute of trainer_profiles.average_rating + total_reviews so a
// tampered client can't inflate ratings.
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

function sanitizeText(raw: unknown, max = 4000): string | null {
    if (raw == null) return null;
    let s = String(raw).slice(0, max);
    s = s.replace(/<[^>]*>/g, '').trim();
    return s || null;
}

export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
    );

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const bookingId = String(body?.bookingId || '').trim();
    const ratingRaw = Number(body?.rating);
    const reviewText = sanitizeText(body?.reviewText);

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    // Validate rating: integer 1..5
    if (!Number.isFinite(ratingRaw) || !Number.isInteger(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
        return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }
    const rating = ratingRaw;

    // Sanitize categories: only allow numeric values 1..5 keyed by short strings
    let categories: Record<string, number> | null = null;
    if (body?.categories && typeof body.categories === 'object') {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(body.categories as Record<string, unknown>)) {
            if (typeof k !== 'string' || k.length > 40) continue;
            const n = Number(v);
            if (Number.isFinite(n) && n >= 1 && n <= 5) {
                out[k] = Math.round(n);
            }
        }
        if (Object.keys(out).length) categories = out;
    }

    // Load booking
    const { data: booking, error: loadErr } = await supabase
        .from('bookings')
        .select('id, athlete_id, trainer_id, status')
        .eq('id', bookingId)
        .maybeSingle();

    if (loadErr || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.athlete_id !== auth.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status !== 'completed') {
        return NextResponse.json(
            { error: 'Can only review completed sessions' },
            { status: 409 }
        );
    }

    // Duplicate guard
    const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('reviewer_id', auth.user.id)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'You already reviewed this session' }, { status: 409 });
    }

    const trainerId = booking.trainer_id;

    const { data: review, error: insertErr } = await supabase
        .from('reviews')
        .insert({
            booking_id: bookingId,
            reviewer_id: auth.user.id,
            reviewee_id: trainerId,
            rating,
            review_text: reviewText,
            categories,
            is_public: true,
        })
        .select('*')
        .single();

    if (insertErr || !review) {
        console.error('[reviews] insert failed:', insertErr);
        return NextResponse.json(
            { error: insertErr?.message || 'Failed to insert review' },
            { status: 500 }
        );
    }

    // Recompute aggregate for trainer from all of their reviews.
    const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', trainerId);

    let avg: number | null = null;
    let total = 0;
    if (Array.isArray(allReviews) && allReviews.length) {
        total = allReviews.length;
        const sum = allReviews.reduce((a, r: any) => a + Number(r.rating || 0), 0);
        avg = Math.round((sum / total) * 100) / 100;
    }

    const { error: profileErr } = await supabase
        .from('trainer_profiles')
        .update({
            average_rating: avg,
            total_reviews: total,
        })
        .eq('user_id', trainerId);

    if (profileErr) {
        // Don't fail the request — review is already saved. Log + return ok.
        console.error('[reviews] failed to recompute trainer aggregate:', profileErr);
    }

    return NextResponse.json({ ok: true, review });
}
