import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export type AdminContext = { userId: string };

export async function requireAdmin(req: NextRequest): Promise<{ ctx: AdminContext } | { error: NextResponse }> {
    const userId = req.headers.get('x-admin-user-id') || req.cookies.get('airtrainr_uid')?.value;
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
    if (data.role !== 'admin' || data.is_suspended || data.deleted_at) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { ctx: { userId: data.id } };
}

export async function logAdminAction(params: {
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
}) {
    try {
        await supabaseAdmin.from('admin_audit_log').insert({
            actor_id: params.actorId,
            action: params.action,
            target_type: params.targetType ?? null,
            target_id: params.targetId ?? null,
            payload: params.payload ?? null,
        });
    } catch {
        // never block admin action on log failure
    }
}
