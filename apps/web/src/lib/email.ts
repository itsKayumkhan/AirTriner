// ============================================


// AirTrainr Web — Transactional email service
// Uses nodemailer with Microsoft 365 SMTP (contact@airtrainr.com, GoDaddy M365)
// All templates share a single table-based, email-client-safe layout.
// ============================================

import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        // M365 uses STARTTLS on 587 -> secure must be false. Only true for implicit-TLS port 465.
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || 'contact@airtrainr.com',
            pass: process.env.SMTP_PASS || '',
        },
    });

    return transporter;
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared design tokens
// ──────────────────────────────────────────────────────────────────────────────

const BRAND = {
    name: 'AirTrainr',
    tagline: 'Train. Connect. Dominate.',
    primary: '#45D0FF',       // cyan brand accent
    primaryDark: '#0a85b3',
    text: '#0f172a',          // near-black for body copy
    textMuted: '#64748b',     // slate-500
    textDim: '#94a3b8',       // slate-400
    bg: '#f5f7fa',            // light page background
    cardBg: '#ffffff',
    border: '#e2e8f0',        // slate-200
    headerBg: '#0a0a14',      // dark navy for branded header strip
    success: '#16a34a',
    warn: '#f59e0b',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://airtrainr.com';
const SUPPORT_EMAIL = 'contact@airtrainr.com';

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

function formatSport(sport: string): string {
    return sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────────────
// Reusable email building blocks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a primary CTA button. Uses table-based layout for Outlook compatibility.
 */
function emailButton(label: string, href: string, variant: 'primary' | 'secondary' = 'primary'): string {
    const bg = variant === 'primary' ? BRAND.headerBg : '#ffffff';
    const color = variant === 'primary' ? '#ffffff' : BRAND.text;
    const border = variant === 'primary' ? BRAND.headerBg : BRAND.border;
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
            <td style="border-radius:10px;background:${bg};">
                <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.3px;text-decoration:none;color:${color};border:1.5px solid ${border};border-radius:10px;">
                    ${escapeHtml(label)}
                </a>
            </td>
        </tr>
    </table>`;
}

/**
 * Render a key/value info card with rounded background.
 */
function infoCard(rows: { label: string; value: string }[]): string {
    const tr = rows.map(r => `
        <tr>
            <td style="padding:6px 0;color:${BRAND.textMuted};font-size:13px;width:40%;">${escapeHtml(r.label)}</td>
            <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:600;">${r.value}</td>
        </tr>
    `).join('');
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;margin:0 0 20px;">
        <tr><td style="padding:18px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${tr}</table>
        </td></tr>
    </table>`;
}

/**
 * Master layout. Pass title (sub-header), preheader (preview text), and body HTML.
 */
function emailLayout(opts: { title: string; preheader?: string; body: string }): string {
    const { title, preheader = '', body } = opts;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(title)}</title>
    <style>
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .px-mobile { padding-left: 20px !important; padding-right: 20px !important; }
            .hero-title { font-size: 24px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.text};">

    <!-- Preheader (preview text in inbox list) -->
    ${preheader ? `<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;max-height:0;mso-hide:all;">${escapeHtml(preheader)}</div>` : ''}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.bg};">
        <tr><td align="center" style="padding:32px 16px;">

            <!-- Email card -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="container" width="600" style="width:600px;max-width:600px;background:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">

                <!-- Header -->
                <tr>
                    <td style="background:${BRAND.headerBg};padding:32px 40px;text-align:center;" class="px-mobile">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                            <tr>
                                <!-- Left side: logo -->
                                <td style="padding-right:20px;vertical-align:middle;">
                                    <img
                                        src="${APP_URL}/logo.jpeg"
                                        width="96"
                                        alt="AirTrainr Logo"
                                        style="display:block;"
                                    />
                                </td>

                                <!-- Right side: brand -->
                                <td style="text-align:center;vertical-align:middle;">
                                    
                                    <!-- Name row -->
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                                        <tr>
                                            <td style="padding-left:12px;">
                                                <span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
                                                    ${BRAND.name}
                                                </span>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Slogan row -->
                                    <p style="margin:12px 0 0;color:${BRAND.primary};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">
                                        ${BRAND.tagline}
                                    </p>

                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Hero / Sub-header -->
                <tr>
                    <td style="padding:36px 40px 8px;" class="px-mobile">
                        <h1 class="hero-title" style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.4px;color:${BRAND.text};line-height:1.25;">
                            ${escapeHtml(title)}
                        </h1>
                    </td>
                </tr>

                <!-- Body -->
                <tr>
                    <td style="padding:16px 40px 36px;font-size:15px;line-height:1.6;color:${BRAND.text};" class="px-mobile">
                        ${body}
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="background:#fafbfc;border-top:1px solid ${BRAND.border};padding:24px 40px;" class="px-mobile">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td style="text-align:center;">
                                    <p style="margin:0 0 8px;color:${BRAND.textMuted};font-size:13px;line-height:1.5;">
                                        Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.primaryDark};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
                                    </p>
                                    <p style="margin:0 0 16px;">
                                        <a href="${APP_URL}/dashboard" style="color:${BRAND.textMuted};font-size:12px;text-decoration:none;margin:0 8px;">Dashboard</a>
                                        <span style="color:${BRAND.border};">·</span>
                                        <a href="${APP_URL}/contact" style="color:${BRAND.textMuted};font-size:12px;text-decoration:none;margin:0 8px;">Support</a>
                                        <span style="color:${BRAND.border};">·</span>
                                        <a href="${APP_URL}/legal/privacy" style="color:${BRAND.textMuted};font-size:12px;text-decoration:none;margin:0 8px;">Privacy</a>
                                        <span style="color:${BRAND.border};">·</span>
                                        <a href="${APP_URL}/legal/terms" style="color:${BRAND.textMuted};font-size:12px;text-decoration:none;margin:0 8px;">Terms</a>
                                    </p>
                                    <p style="margin:0;color:${BRAND.textDim};font-size:11px;line-height:1.5;">
                                        © ${new Date().getFullYear()} AirTrainr. All rights reserved.<br>
                                        You're receiving this email because you have an account with us.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

            </table>

        </td></tr>
    </table>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Receipt data shape
// ──────────────────────────────────────────────────────────────────────────────

export interface BookingReceiptData {
    athleteEmail: string;
    athleteName: string;
    trainerEmail: string;
    trainerName: string;
    sport: string;
    scheduledAt: string;
    durationMinutes: number;
    sessionFee: number;
    platformFee: number;
    stripeFee: number;
    taxAmount: number;
    taxLabel: string;
    totalPaid: number;
    trainerPayout: number;
    bookingId: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Athlete booking receipt
// ──────────────────────────────────────────────────────────────────────────────

export async function sendAthleteReceipt(data: BookingReceiptData): Promise<void> {
    try {
        const t = await getTransporter();
        const sportName = formatSport(data.sport);
        const dateStr = formatDate(data.scheduledAt);
        const firstName = (data.athleteName || '').split(' ')[0] || 'there';

        const breakdownRows = `
            <tr>
                <td style="padding:6px 0;color:${BRAND.text};font-size:14px;">Session fee</td>
                <td style="padding:6px 0;text-align:right;color:${BRAND.text};font-size:14px;font-weight:600;">${formatCurrency(data.sessionFee)}</td>
            </tr>
            <tr>
                <td style="padding:6px 0;color:${BRAND.textMuted};font-size:13px;">Platform fee (3%)</td>
                <td style="padding:6px 0;text-align:right;color:${BRAND.textMuted};font-size:13px;">${formatCurrency(data.platformFee)}</td>
            </tr>
            <tr>
                <td style="padding:6px 0;color:${BRAND.textMuted};font-size:13px;">Stripe processing</td>
                <td style="padding:6px 0;text-align:right;color:${BRAND.textMuted};font-size:13px;">${formatCurrency(data.stripeFee || 0)}</td>
            </tr>
            ${data.taxAmount > 0 ? `
            <tr>
                <td style="padding:6px 0;color:${BRAND.textMuted};font-size:13px;">${escapeHtml(data.taxLabel || 'Tax')}</td>
                <td style="padding:6px 0;text-align:right;color:${BRAND.textMuted};font-size:13px;">${formatCurrency(data.taxAmount)}</td>
            </tr>` : ''}
            <tr><td colspan="2" style="padding:8px 0;"><div style="border-top:1px solid ${BRAND.border};"></div></td></tr>
            <tr>
                <td style="padding:8px 0 0;color:${BRAND.text};font-size:16px;font-weight:700;">Total paid</td>
                <td style="padding:8px 0 0;text-align:right;color:${BRAND.headerBg};font-size:18px;font-weight:800;">${formatCurrency(data.totalPaid)}</td>
            </tr>
        `;

        const body = `
            <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 24px;color:${BRAND.text};">Your booking is confirmed and payment received. Here's your receipt — keep it for your records.</p>

            ${infoCard([
                { label: 'Sport', value: escapeHtml(sportName) },
                { label: 'Trainer', value: escapeHtml(data.trainerName) },
                { label: 'Date &amp; time', value: escapeHtml(dateStr) },
                { label: 'Duration', value: `${data.durationMinutes} minutes` },
                { label: 'Booking ID', value: `<span style="font-family:monospace;font-size:12px;color:${BRAND.textMuted};">${escapeHtml(data.bookingId)}</span>` },
            ])}

            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 20px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${BRAND.textMuted};">Payment breakdown</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${breakdownRows}
                </table>
            </div>

            ${emailButton('View Booking', `${APP_URL}/dashboard/bookings`)}

            <div style="background:#f1f5f9;border-left:3px solid ${BRAND.primary};padding:12px 16px;border-radius:6px;margin:24px 0 0;">
                <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.6;">
                    <strong style="color:${BRAND.text};">Heads up:</strong> Funds are held in escrow until your session completes.
                    If you need to cancel, please do so from your dashboard at least 24 hours before the session.
                </p>
            </div>
        `;

        const info = await t.sendMail({
            from: `"AirTrainr" <${SUPPORT_EMAIL}>`,
            to: data.athleteEmail,
            subject: `Receipt: ${sportName} session with ${data.trainerName}`,
            html: emailLayout({
                title: 'Payment received',
                preheader: `Your ${sportName} session with ${data.trainerName} is confirmed. Total paid: ${formatCurrency(data.totalPaid)}.`,
                body,
            }),
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email] Athlete receipt preview:`, nodemailer.getTestMessageUrl(info));
        }
        console.log(`[email] Athlete receipt sent to ${data.athleteEmail}`);
    } catch (error) {
        console.error('[email] Failed to send athlete receipt:', error);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Trainer booking notification
// ──────────────────────────────────────────────────────────────────────────────

export async function sendTrainerReceipt(data: BookingReceiptData): Promise<void> {
    try {
        const t = await getTransporter();
        const sportName = formatSport(data.sport);
        const dateStr = formatDate(data.scheduledAt);
        const firstName = (data.trainerName || '').split(' ')[0] || 'there';

        const body = `
            <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 24px;color:${BRAND.text};">You've got a new booking. Payment has cleared and funds are now held in escrow.</p>

            ${infoCard([
                { label: 'Sport', value: escapeHtml(sportName) },
                { label: 'Athlete', value: escapeHtml(data.athleteName) },
                { label: 'Date &amp; time', value: escapeHtml(dateStr) },
                { label: 'Duration', value: `${data.durationMinutes} minutes` },
            ])}

            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 20px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${BRAND.textMuted};">Your earnings</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td style="padding:6px 0;color:${BRAND.text};font-size:14px;">Session fee</td>
                        <td style="padding:6px 0;text-align:right;color:${BRAND.text};font-size:14px;font-weight:600;">${formatCurrency(data.sessionFee)}</td>
                    </tr>
                    <tr><td colspan="2" style="padding:8px 0;"><div style="border-top:1px solid ${BRAND.border};"></div></td></tr>
                    <tr>
                        <td style="padding:8px 0 0;color:${BRAND.text};font-size:16px;font-weight:700;">You'll receive (100%)</td>
                        <td style="padding:8px 0 0;text-align:right;color:${BRAND.success};font-size:18px;font-weight:800;">${formatCurrency(data.trainerPayout)}</td>
                    </tr>
                </table>
                <p style="margin:14px 0 0;color:${BRAND.textDim};font-size:12px;line-height:1.5;">
                    The athlete covered all fees on top (platform ${formatCurrency(data.platformFee)}, Stripe ${formatCurrency(data.stripeFee || 0)}${data.taxAmount > 0 ? `, ${escapeHtml(data.taxLabel || 'Tax')} ${formatCurrency(data.taxAmount)}` : ''}). Total charged: ${formatCurrency(data.totalPaid)}.
                </p>
            </div>

            ${emailButton('Open Dashboard', `${APP_URL}/dashboard`)}

            <div style="background:#f1f5f9;border-left:3px solid ${BRAND.primary};padding:12px 16px;border-radius:6px;margin:24px 0 0;">
                <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.6;">
                    <strong style="color:${BRAND.text};">Payout timing:</strong> Funds release to your Stripe account once you complete the session.
                </p>
            </div>
        `;

        const info = await t.sendMail({
            from: `"AirTrainr" <${SUPPORT_EMAIL}>`,
            to: data.trainerEmail,
            subject: `New booking: ${sportName} with ${data.athleteName}`,
            html: emailLayout({
                title: 'You have a new booking',
                preheader: `${data.athleteName} booked a ${sportName} session — ${formatCurrency(data.trainerPayout)} payout.`,
                body,
            }),
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email] Trainer receipt preview:`, nodemailer.getTestMessageUrl(info));
        }
        console.log(`[email] Trainer receipt sent to ${data.trainerEmail}`);
    } catch (error) {
        console.error('[email] Failed to send trainer receipt:', error);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Contact form notification (sent to admin)
// ──────────────────────────────────────────────────────────────────────────────

export interface ContactNotificationData {
    email: string;
    subject: string;
    message: string;
    userId: string | null;
}

export async function sendContactNotification(data: ContactNotificationData): Promise<void> {
    try {
        const t = await getTransporter();
        const timestamp = new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        });

        const body = `
            <p style="margin:0 0 16px;font-size:16px;">New contact form submission</p>
            <p style="margin:0 0 24px;color:${BRAND.textMuted};">Someone reached out via the AirTrainr contact form. Details below.</p>

            ${infoCard([
                { label: 'From', value: `<a href="mailto:${escapeHtml(data.email)}" style="color:${BRAND.primaryDark};text-decoration:none;">${escapeHtml(data.email)}</a>` },
                { label: 'Subject', value: escapeHtml(data.subject) },
                { label: 'User', value: data.userId ? `<span style="font-family:monospace;font-size:12px;color:${BRAND.textMuted};">${escapeHtml(data.userId)}</span>` : '<em style="color:#94a3b8;">Guest (not logged in)</em>' },
                { label: 'Received', value: escapeHtml(timestamp) },
            ])}

            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:0 0 20px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${BRAND.textMuted};">Message</p>
                <p style="margin:0;white-space:pre-wrap;color:${BRAND.text};font-size:14px;line-height:1.6;">${escapeHtml(data.message)}</p>
            </div>

            ${emailButton('Reply', `mailto:${data.email}?subject=Re:%20${encodeURIComponent(data.subject)}`)}
            ${emailButton('Open Admin Panel', `${APP_URL}/admin/contacts`, 'secondary')}
        `;

        const info = await t.sendMail({
            from: `"AirTrainr Contact" <${SUPPORT_EMAIL}>`,
            to: SUPPORT_EMAIL,
            replyTo: data.email,
            subject: `[Contact] ${data.subject}`,
            html: emailLayout({
                title: 'New contact message',
                preheader: `${data.email}: ${data.subject}`,
                body,
            }),
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email] Contact notification preview:`, nodemailer.getTestMessageUrl(info));
        }
        console.log(`[email] Contact notification sent for ${data.email}`);
    } catch (error) {
        console.error('[email] Failed to send contact notification:', error);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Signup notification (sent to admin)
// ──────────────────────────────────────────────────────────────────────────────

export interface SignupNotificationData {
    email: string;
    firstName: string;
    lastName: string;
    role: 'athlete' | 'trainer';
    platform: 'web' | 'mobile';
    userId: string;
}

export async function sendSignupNotification(data: SignupNotificationData): Promise<void> {
    try {
        const t = await getTransporter();
        const timestamp = new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        });
        const fullName = `${data.firstName} ${data.lastName}`.trim();
        const roleLabel = data.role.charAt(0).toUpperCase() + data.role.slice(1);
        const platformLabel = data.platform === 'web' ? 'Website' : 'Mobile app';

        const body = `
            <p style="margin:0 0 16px;font-size:16px;">New ${escapeHtml(roleLabel.toLowerCase())} just joined</p>
            <p style="margin:0 0 24px;color:${BRAND.textMuted};">Someone created an AirTrainr account. Snapshot below.</p>

            ${infoCard([
                { label: 'Name', value: escapeHtml(fullName || '(not provided)') },
                { label: 'Email', value: `<a href="mailto:${escapeHtml(data.email)}" style="color:${BRAND.primaryDark};text-decoration:none;">${escapeHtml(data.email)}</a>` },
                { label: 'Role', value: `<span style="display:inline-block;padding:2px 10px;background:${data.role === 'trainer' ? '#fef3c7' : '#dbeafe'};color:${data.role === 'trainer' ? '#92400e' : '#1e40af'};border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(roleLabel)}</span>` },
                { label: 'Platform', value: escapeHtml(platformLabel) },
                { label: 'User ID', value: `<span style="font-family:monospace;font-size:12px;color:${BRAND.textMuted};">${escapeHtml(data.userId)}</span>` },
                { label: 'Signed up', value: escapeHtml(timestamp) },
            ])}

            ${data.role === 'trainer'
                ? emailButton('Review Trainer', `${APP_URL}/admin/trainers`)
                : emailButton('View Athlete', `${APP_URL}/admin/athletes`)}
        `;

        const info = await t.sendMail({
            from: `"AirTrainr" <${SUPPORT_EMAIL}>`,
            to: data.email,
            cc: SUPPORT_EMAIL,
            subject: `New ${roleLabel.toLowerCase()} signup — ${fullName || data.email}`,
            html: emailLayout({
                title: `New ${roleLabel.toLowerCase()} signup`,
                preheader: `${fullName || data.email} joined via ${platformLabel.toLowerCase()}`,
                body,
            }),
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email] Signup notification preview:`, nodemailer.getTestMessageUrl(info));
        }
        console.log(`[email] Signup notification sent for ${data.email}`);
    } catch (error) {
        console.error('[email] Failed to send signup notification:', error);
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// Profile notification (sent to trainers)
// ──────────────────────────────────────────────────────────────────────────────

export interface ProfileNotificationData {
    email: string;
    firstName: string;
    lastName: string;
    role: 'athlete' | 'trainer';
    platform: 'web' | 'mobile';
    userId: string;
    avatar_url: string;
    phone: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    bio: string;
}

export async function sendProfileNotification(data: ProfileNotificationData): Promise<void> {

    const missingFields = [
        { label: "Profile photo", value: data.avatar_url },
        { label: "Phone", value: data.phone },
        { label: "City", value: data.city },
        { label: "State", value: data.state },
        { label: "ZIP code", value: data.zip_code },
        { label: "Country", value: data.country },
        { label: "Bio", value: data.bio },
    ]
        .filter(field => !field.value)
        .map(field => ({
            label: field.label,
            value: "Missing",
        }));

    try {
        const t = await getTransporter();
        const fullName = `${data.firstName} ${data.lastName}`.trim();

        const body = `
            <p style="margin:0 0 24px;color:${BRAND.textMuted};">A few details are missing from your profile.</p>
            <p style="margin:0 0 16px;font-size:16px;">Please complete your profile. Profiles get listed and approved once an image, location, bio, pricing, email and phone number are added.</p>

            ${infoCard(missingFields)}

            ${emailButton('Complete Profile', `${APP_URL}/dashboard/profile`)}
        `;

        const info = await t.sendMail({
            from: `"AirTrainr" <${SUPPORT_EMAIL}>`,
            to: data.email,
            cc: SUPPORT_EMAIL,
            subject: `Missing profile information for ${fullName || data.email}`,
            html: emailLayout({
                title: `Missing profile information`,
                preheader: `${fullName || data.email} needs to complete their profile`,
                body,
            }),
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email] Profile notification preview:`, nodemailer.getTestMessageUrl(info));
        }
        console.log(`[email] Profile notification sent for ${data.email}`);
    } catch (error) {
        console.error('[email] Failed to send profile notification:', error);
    }
}