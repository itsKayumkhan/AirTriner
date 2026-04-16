// ============================================
// AirTrainr Web - Email Service
// Sends transactional emails (receipts, etc.)
// Uses nodemailer with SMTP in production, Ethereal in dev
// ============================================

import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
    if (transporter) return transporter;

    if (process.env.NODE_ENV === 'production') {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
            },
        });
    } else {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log(`[email] Ethereal test account: ${testAccount.user}`);
    }

    return transporter;
}

// ── Shared HTML wrapper ──

function wrapHtml(title: string, bodyContent: string): string {
    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #a3ff12 0%, #7acc0e 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; color: #0a0a0a; font-size: 24px;">AirTrainr</h1>
            <p style="margin: 8px 0 0; color: #0a0a0a; font-size: 14px;">${title}</p>
        </div>
        <div style="padding: 32px;">
            ${bodyContent}
        </div>
        <div style="padding: 16px 32px; border-top: 1px solid #222; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0;">AirTrainr Inc. &middot; This is an automated receipt.</p>
        </div>
    </div>`;
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
    return sport.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Receipt data shape ──

export interface BookingReceiptData {
    athleteEmail: string;
    athleteName: string;
    trainerEmail: string;
    trainerName: string;
    sport: string;
    scheduledAt: string;
    durationMinutes: number;
    sessionFee: number;    // trainer's rate (price)
    platformFee: number;   // 3% platform fee
    totalPaid: number;     // sessionFee + platformFee
    trainerPayout: number; // what trainer receives
    bookingId: string;
}

// ── Send athlete receipt ──

export async function sendAthleteReceipt(data: BookingReceiptData): Promise<void> {
    try {
        const t = await getTransporter();
        const sportName = formatSport(data.sport);
        const dateStr = formatDate(data.scheduledAt);

        const body = `
            <p style="font-size: 18px; margin: 0 0 16px;">Thanks for booking, ${data.athleteName}!</p>
            <p style="color: #aaa; margin: 0 0 24px;">Here is your payment receipt.</p>

            <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
                <p style="margin: 0 0 8px;"><strong>Sport:</strong> ${sportName}</p>
                <p style="margin: 0 0 8px;"><strong>Trainer:</strong> ${data.trainerName}</p>
                <p style="margin: 0 0 8px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
                <p style="margin: 0;"><strong>Duration:</strong> ${data.durationMinutes} minutes</p>
            </div>

            <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
                <h3 style="margin: 0 0 12px; color: #a3ff12; font-size: 16px;">Payment Breakdown</h3>
                <table style="width: 100%; border-collapse: collapse; color: #fff;">
                    <tr>
                        <td style="padding: 6px 0;">Session Fee</td>
                        <td style="padding: 6px 0; text-align: right;">${formatCurrency(data.sessionFee)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #aaa;">Platform Fee (3%)</td>
                        <td style="padding: 6px 0; text-align: right; color: #aaa;">${formatCurrency(data.platformFee)}</td>
                    </tr>
                    <tr style="border-top: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Total Paid</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 16px; color: #a3ff12;">${formatCurrency(data.totalPaid)}</td>
                    </tr>
                </table>
            </div>

            <p style="color: #888; font-size: 13px;">
                Funds are held in escrow until your session completes. If you need to cancel, visit your AirTrainr dashboard.
            </p>
        `;

        const info = await t.sendMail({
            from: '"AirTrainr" <noreply@airtrainr.com>',
            to: data.athleteEmail,
            subject: `Receipt: ${sportName} Session with ${data.trainerName}`,
            html: wrapHtml('Payment Receipt', body),
        });

        if (process.env.NODE_ENV !== 'production') {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`[email] Athlete receipt preview: ${previewUrl}`);
        }
        console.log(`[email] Athlete receipt sent to ${data.athleteEmail}`);
    } catch (error) {
        console.error('[email] Failed to send athlete receipt:', error);
    }
}

// ── Send trainer receipt ──

export async function sendTrainerReceipt(data: BookingReceiptData): Promise<void> {
    try {
        const t = await getTransporter();
        const sportName = formatSport(data.sport);
        const dateStr = formatDate(data.scheduledAt);

        const body = `
            <p style="font-size: 18px; margin: 0 0 16px;">New booking paid, ${data.trainerName}!</p>
            <p style="color: #aaa; margin: 0 0 24px;">An athlete has completed payment for an upcoming session.</p>

            <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
                <p style="margin: 0 0 8px;"><strong>Sport:</strong> ${sportName}</p>
                <p style="margin: 0 0 8px;"><strong>Athlete:</strong> ${data.athleteName}</p>
                <p style="margin: 0 0 8px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
                <p style="margin: 0;"><strong>Duration:</strong> ${data.durationMinutes} minutes</p>
            </div>

            <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
                <h3 style="margin: 0 0 12px; color: #a3ff12; font-size: 16px;">Your Earnings</h3>
                <table style="width: 100%; border-collapse: collapse; color: #fff;">
                    <tr>
                        <td style="padding: 6px 0;">Session Fee</td>
                        <td style="padding: 6px 0; text-align: right;">${formatCurrency(data.sessionFee)}</td>
                    </tr>
                    <tr style="border-top: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; font-size: 16px;">You'll Receive</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 16px; color: #a3ff12;">${formatCurrency(data.trainerPayout)}</td>
                    </tr>
                </table>
            </div>

            <p style="color: #888; font-size: 13px;">
                Funds are held in escrow and will be released after the session completes. View details in your AirTrainr dashboard.
            </p>
        `;

        const info = await t.sendMail({
            from: '"AirTrainr" <noreply@airtrainr.com>',
            to: data.trainerEmail,
            subject: `Booking Paid: ${sportName} Session with ${data.athleteName}`,
            html: wrapHtml('Booking Payment Confirmation', body),
        });

        if (process.env.NODE_ENV !== 'production') {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`[email] Trainer receipt preview: ${previewUrl}`);
        }
        console.log(`[email] Trainer receipt sent to ${data.trainerEmail}`);
    } catch (error) {
        console.error('[email] Failed to send trainer receipt:', error);
    }
}
