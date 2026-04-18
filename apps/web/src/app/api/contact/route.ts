// ============================================
// Contact Messages — Insert via service role (bypasses RLS)
// Primary delivery: in-app admin inbox at /admin/contacts
// Optional email: enable with CONTACT_EMAIL_ENABLED=true
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

        // 1. Save to contact_messages (primary source of truth — admin inbox)
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

        // 2. Create in-app notifications for every admin so they see a bell alert.
        //    Uses MESSAGE_RECEIVED enum value (see pattern in offers/page.tsx:200)
        //    to avoid a Postgres enum ALTER. Title/body carry the semantic meaning.
        try {
            const { data: admins } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                const snippet = trimmedMessage.length > 80
                    ? trimmedMessage.substring(0, 77) + '...'
                    : trimmedMessage;

                const rows = admins.map((a: { id: string }) => ({
                    user_id: a.id,
                    type: 'MESSAGE_RECEIVED',
                    title: `Contact: ${trimmedSubject}`,
                    body: `${trimmedEmail} — ${snippet}`,
                    data: {
                        kind: 'contact_message',
                        email: trimmedEmail,
                        subject: trimmedSubject,
                        link: '/admin/contacts',
                    },
                    read: false,
                }));

                await supabaseAdmin.from('notifications').insert(rows);
            }
        } catch (notifErr) {
            console.error('[contact] Admin notification insert failed:', notifErr);
            // Non-fatal — message is already saved.
        }

        // 3. Optional email fallback (disabled by default). Enable with
        //    CONTACT_EMAIL_ENABLED=true to also mirror to contact@airtrainr.com.
        if (process.env.CONTACT_EMAIL_ENABLED === 'true') {
            sendContactNotification({
                email: trimmedEmail,
                subject: trimmedSubject,
                message: trimmedMessage,
                userId: userId ?? null,
            }).catch((err) => console.error('[contact] Email notification failed:', err));
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Contact API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
