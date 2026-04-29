// ============================================
// POST /api/booking/create
// Server-authoritative booking creation. Replaces athlete-side
// direct supabase.from('bookings').insert(...) so price, gating,
// double-booking and self-booking can't be bypassed by a tampered
// client.
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';
import { trainerPublicGate } from '@/lib/trainer-gate';
import { normalizeSessionPricing, priceFor, ALLOWED_SESSION_DURATIONS } from '@/lib/session-pricing';

export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    if (auth.user.role !== 'athlete') {
        return NextResponse.json({ error: 'Only athletes can create bookings' }, { status: 403 });
    }

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

    const trainerId = String(body?.trainerId || '').trim();
    const sport = String(body?.sport || '').trim();
    const scheduledAt = String(body?.scheduledAt || '').trim();
    const durationMinutes = Number(body?.durationMinutes);
    const trainingLocation = body?.trainingLocation
        ? String(body.trainingLocation).slice(0, 200)
        : null;
    const subAccountId = body?.subAccountId
        ? String(body.subAccountId).trim()
        : null;

    if (!trainerId || !sport || !scheduledAt) {
        return NextResponse.json(
            { error: 'Missing required fields: trainerId, sport, scheduledAt' },
            { status: 400 }
        );
    }

    if (!ALLOWED_SESSION_DURATIONS.includes(durationMinutes as 30 | 45 | 60)) {
        return NextResponse.json(
            { error: 'Invalid durationMinutes (must be 30, 45, or 60)' },
            { status: 400 }
        );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 });
    }

    if (auth.user.id === trainerId) {
        return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 });
    }

    // Validate sub-account ownership if provided. Service-role read so RLS
    // can't mask a hostile id. Must belong to the calling athlete and be active.
    if (subAccountId) {
        const { data: subAcc } = await supabase
            .from('sub_accounts')
            .select('id, parent_user_id, is_active')
            .eq('id', subAccountId)
            .maybeSingle();
        if (
            !subAcc ||
            subAcc.parent_user_id !== auth.user.id ||
            subAcc.is_active !== true
        ) {
            return NextResponse.json(
                { error: 'Sub-account not authorized' },
                { status: 403 }
            );
        }
    }

    // Load trainer user + trainer profile
    const [{ data: trainerUser }, { data: trainerProfile }] = await Promise.all([
        supabase
            .from('users')
            .select('id, role, is_suspended, deleted_at, first_name, last_name, phone, date_of_birth, avatar_url')
            .eq('id', trainerId)
            .maybeSingle(),
        supabase
            .from('trainer_profiles')
            .select('user_id, verification_status, subscription_status, bio, sports, city, years_experience, session_pricing, hourly_rate, training_locations')
            .eq('user_id', trainerId)
            .maybeSingle(),
    ]);

    if (!trainerUser || trainerUser.role !== 'trainer') {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    const gate = trainerPublicGate({ user: trainerUser, trainerProfile });
    if (!gate.ok) {
        return NextResponse.json(
            { error: 'Trainer not accepting bookings', reason: gate.reason },
            { status: 409 }
        );
    }

    // Server-computed price
    const pricing = normalizeSessionPricing(
        trainerProfile?.session_pricing,
        trainerProfile?.hourly_rate ?? null
    );
    const price = priceFor(pricing, durationMinutes);
    if (price === null) {
        return NextResponse.json(
            { error: 'Trainer does not offer this duration' },
            { status: 400 }
        );
    }

    // Double-booking check: any pending/confirmed booking on the trainer
    // whose [scheduled_at, scheduled_at + duration) overlaps the requested
    // window is a conflict.
    const requestedStart = scheduledDate.getTime();
    const requestedEnd = requestedStart + durationMinutes * 60_000;
    // Pull a generous window (any booking within +-3h of the requested start
    // could overlap a 60-min session). Filter precisely in JS.
    const windowStart = new Date(requestedStart - 3 * 60 * 60_000).toISOString();
    const windowEnd = new Date(requestedEnd + 3 * 60 * 60_000).toISOString();

    const { data: nearby, error: nearbyErr } = await supabase
        .from('bookings')
        .select('id, scheduled_at, duration_minutes, status')
        .eq('trainer_id', trainerId)
        .in('status', ['pending', 'confirmed'])
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', windowEnd);

    if (nearbyErr) {
        console.error('[booking/create] conflict-check failed:', nearbyErr);
        return NextResponse.json({ error: 'Failed to verify availability' }, { status: 500 });
    }

    const conflict = (nearby || []).some((b) => {
        const s = new Date(b.scheduled_at).getTime();
        const e = s + Number(b.duration_minutes || 60) * 60_000;
        return s < requestedEnd && e > requestedStart;
    });
    if (conflict) {
        return NextResponse.json({ error: 'Slot already taken' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const insertPayload: Record<string, unknown> = {
        athlete_id: auth.user.id,
        trainer_id: trainerId,
        sub_account_id: subAccountId,
        sport,
        scheduled_at: scheduledDate.toISOString(),
        duration_minutes: durationMinutes,
        status: 'pending',
        price,
        // total_paid / fees are computed at payment time in create-booking-payment.
        platform_fee: 0,
        stripe_fee: 0,
        tax_amount: 0,
        total_paid: 0,
        status_history: [
            { status: 'pending', timestamp: nowIso, note: 'Booking created' },
        ],
        created_at: nowIso,
        updated_at: nowIso,
    };
    if (trainingLocation) insertPayload.address = trainingLocation;

    const { data: inserted, error: insertErr } = await supabase
        .from('bookings')
        .insert(insertPayload)
        .select('*')
        .single();

    if (insertErr || !inserted) {
        console.error('[booking/create] insert failed:', insertErr);
        return NextResponse.json(
            { error: insertErr?.message || 'Failed to create booking' },
            { status: 500 }
        );
    }

    return NextResponse.json({ booking: inserted }, { status: 201 });
}
