import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySignedUid } from './cookie-sign';

// Server-side session helper for non-admin (athlete + trainer) API routes.
//
// Reads `airtrainr_uid` cookie (set on login by lib/auth.ts), verifies the
// user actually exists, is not suspended, and is not soft-deleted. Returns a
// callable identity for ownership checks ("is this user allowed to refund
// this booking?").
//
// The cookie is currently UNSIGNED — anyone with DevTools can rewrite it. This
// is the same risk admin-auth has and the same mitigation will apply when we
// HMAC-sign cookies. Until then, this helper is still a real improvement
// over routes that read userId from the request body, because:
//   1. The forged cookie still has to belong to a real user account.
//   2. Combined with ownership checks (caller_id === booking.athlete_id) the
//      attacker has to forge the cookie of the SPECIFIC victim, not just any user.
//   3. The cookie is HttpOnly → no XSS theft.
//
// Future hardening: HMAC-sign the cookie or migrate to Supabase auth's own
// cookie via @supabase/ssr.

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export type SessionUser = {
    id: string;
    role: 'athlete' | 'trainer' | 'admin';
};

export async function requireSessionUser(
    req: NextRequest,
): Promise<{ user: SessionUser } | { error: NextResponse }> {
    const headerUid = req.headers.get('x-airtrainr-uid');
    const cookieRaw = req.cookies.get('airtrainr_uid')?.value;
    let userId: string | null = headerUid || null;
    if (!userId && cookieRaw) {
        userId = verifySignedUid(cookieRaw);
        // signed-but-invalid → reject as forgery
        if (cookieRaw.includes('.') && userId === null) {
            return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
        }
    }
    if (!userId) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, role, is_suspended, deleted_at')
        .eq('id', userId)
        .maybeSingle();
    if (error || !data) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (data.is_suspended || data.deleted_at) {
        return { error: NextResponse.json({ error: 'Account inactive' }, { status: 403 }) };
    }
    return { user: { id: data.id, role: data.role } };
}

/**
 * Convenience: require a logged-in user OR admin.
 *
 *   const auth = await requireSessionOrAdmin(req);
 *   if ('error' in auth) return auth.error;
 *   const isAdmin = auth.user.role === 'admin';
 */
export async function requireSessionOrAdmin(req: NextRequest) {
    return requireSessionUser(req);
}
