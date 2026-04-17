// ============================================
// Availability Recurring — Upsert via service role (bypasses RLS)
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { trainerId, rows } = await req.json();

        if (!trainerId || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'Missing trainerId or rows' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('availability_recurring')
            .upsert(rows, { onConflict: 'trainer_id,day_of_week' });

        if (error) {
            console.error('Availability recurring upsert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Availability API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
