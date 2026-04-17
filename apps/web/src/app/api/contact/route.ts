// ============================================
// Contact Messages — Insert via service role (bypasses RLS)
// + Send email notification to contact@airtrainr.com
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendContactNotification } from '@/lib/email';

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

        const trimmedEmail = email.trim();
        const trimmedSubject = subject || 'General';
        const trimmedMessage = message.trim();

        const { error } = await supabaseAdmin.from('contact_messages').insert({
            user_id: userId ?? null,
            email: trimmedEmail,
            subject: trimmedSubject,
            message: trimmedMessage,
        });

        if (error) {
            console.error('Contact insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Send email notification (fire-and-forget, don't block response)
        sendContactNotification({
            email: trimmedEmail,
            subject: trimmedSubject,
            message: trimmedMessage,
            userId: userId ?? null,
        }).catch((err) => console.error('[contact] Email notification failed:', err));

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Contact API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
