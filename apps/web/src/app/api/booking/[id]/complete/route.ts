// ============================================
// POST /api/booking/[id]/complete
// Marks a confirmed booking as completed once its scheduled end time
// has passed. Either party (or admin) can trigger.
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    const { id: bookingId } = await Promise.resolve(params);
    if (!bookingId) {
        return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: booking, error: loadErr } = await supabase
        .from('bookings')
        .select('id, athlete_id, trainer_id, status, scheduled_at, duration_minutes, status_history')
        .eq('id', bookingId)
        .maybeSingle();

    if (loadErr || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isAdmin = auth.user.role === 'admin';
    const isAthlete = booking.athlete_id === auth.user.id;
    const isTrainer = booking.trainer_id === auth.user.id;
    if (!isAdmin && !isAthlete && !isTrainer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status !== 'confirmed') {
        return NextResponse.json(
            { error: `Only confirmed bookings can be completed (current: ${booking.status})` },
            { status: 409 }
        );
    }

    const startMs = new Date(booking.scheduled_at).getTime();
    const endMs = startMs + Number(booking.duration_minutes || 60) * 60_000;
    if (Number.isNaN(startMs)) {
        return NextResponse.json({ error: 'Booking has invalid scheduled_at' }, { status: 500 });
    }
    if (endMs > Date.now()) {
        return NextResponse.json(
            {
                error: 'Session has not ended yet',
                endsAt: new Date(endMs).toISOString(),
            },
            { status: 409 }
        );
    }

    const nowIso = new Date().toISOString();
    const prevHistory = Array.isArray(booking.status_history) ? booking.status_history : [];
    const nextHistory = [
        ...prevHistory,
        {
            status: 'completed',
            timestamp: nowIso,
            note: `Marked complete by ${isTrainer ? 'trainer' : isAthlete ? 'athlete' : 'admin'}`,
            by: auth.user.id,
        },
    ];

    const { error: updErr } = await supabase
        .from('bookings')
        .update({
            status: 'completed',
            status_history: nextHistory,
            updated_at: nowIso,
        })
        .eq('id', bookingId);

    if (updErr) {
        console.error('[booking/complete] update failed:', updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
