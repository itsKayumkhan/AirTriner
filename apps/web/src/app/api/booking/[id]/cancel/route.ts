// ============================================
// POST /api/booking/[id]/cancel
// Cancels a pending or confirmed booking. If a held payment exists,
// triggers refund first via /api/stripe/refund-booking. If refund
// fails the booking stays as-is (we never mark cancelled while money
// is still in escrow).
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

function sanitizeReason(raw: unknown): string | null {
    if (raw == null) return null;
    let s = String(raw).slice(0, 500);
    // Strip HTML to avoid downstream rendering surprises.
    s = s.replace(/<[^>]*>/g, '');
    s = s.trim();
    return s || null;
}

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

    let body: any = {};
    try {
        body = await req.json();
    } catch {
        // Empty body is fine.
    }
    const reason = sanitizeReason(body?.reason);

    const { data: booking, error: loadErr } = await supabase
        .from('bookings')
        .select('id, athlete_id, trainer_id, status, status_history, sport')
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

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return NextResponse.json(
            { error: `Cannot cancel a booking in status "${booking.status}"` },
            { status: 409 }
        );
    }

    // Check for held payment first.
    let refunded = false;
    const { data: tx } = await supabase
        .from('payment_transactions')
        .select('id, status')
        .eq('booking_id', bookingId)
        .maybeSingle();

    if (tx && tx.status === 'held') {
        // Forward auth headers (cookie + uid) so the internal route's
        // requireSessionUser still recognises the same caller.
        const origin = req.nextUrl.origin;
        const fwdHeaders: Record<string, string> = { 'content-type': 'application/json' };
        const cookie = req.headers.get('cookie');
        if (cookie) fwdHeaders['cookie'] = cookie;
        const uidHeader = req.headers.get('x-airtrainr-uid');
        if (uidHeader) fwdHeaders['x-airtrainr-uid'] = uidHeader;

        const refundRes = await fetch(`${origin}/api/stripe/refund-booking`, {
            method: 'POST',
            headers: fwdHeaders,
            body: JSON.stringify({
                bookingId,
                cancelledBy: isTrainer ? 'trainer' : isAthlete ? 'athlete' : 'admin',
                reason: reason || undefined,
            }),
        });

        const refundJson = await refundRes.json().catch(() => ({}));
        if (!refundRes.ok) {
            return NextResponse.json(
                { error: refundJson?.error || 'Refund failed', refundStatus: refundRes.status },
                { status: refundRes.status }
            );
        }
        refunded = !!refundJson?.refunded;
    }

    const nowIso = new Date().toISOString();
    const prevHistory = Array.isArray(booking.status_history) ? booking.status_history : [];
    const nextHistory = [
        ...prevHistory,
        {
            status: 'cancelled',
            timestamp: nowIso,
            note: reason || `Cancelled by ${isTrainer ? 'trainer' : isAthlete ? 'athlete' : 'admin'}`,
            by: auth.user.id,
        },
    ];

    const { error: updErr } = await supabase
        .from('bookings')
        .update({
            status: 'cancelled',
            cancelled_at: nowIso,
            cancellation_reason: reason,
            status_history: nextHistory,
            updated_at: nowIso,
        })
        .eq('id', bookingId);

    if (updErr) {
        console.error('[booking/cancel] update failed:', updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, refunded });
}
