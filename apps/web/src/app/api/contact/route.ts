// ============================================
// Contact Messages — Insert via service role (bypasses RLS)
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { userId, email, subject, message } = await req.json();

        if (!email || !message) {
            return NextResponse.json({ error: 'Missing email or message' }, { status: 400 });
        }

        const { error } = await supabaseAdmin.from('contact_messages').insert({
            user_id: userId ?? null,
            email: email.trim(),
            subject: subject || 'General',
            message: message.trim(),
        });

        if (error) {
            console.error('Contact insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Contact API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
