// ============================================
// AirTrainr API - Email Service
// ============================================

import nodemailer from 'nodemailer';
import { logger } from '../common/logger';
import config from '../config';

interface ReminderEmailData {
    to: string;
    athleteName: string;
    trainerName: string;
    sport: string;
    scheduledAt: Date;
    durationMinutes: number;
    address?: string | null;
    reminderType: '24h' | '1h';
}

class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    /**
     * Lazily initialise the transporter.
     * In development, uses Ethereal (a fake SMTP service) so emails
     * are captured but never actually delivered.
     */
    private async getTransporter(): Promise<nodemailer.Transporter> {
        if (this.transporter) return this.transporter;

        // GoDaddy SMTP — used in all environments
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
            port: parseInt(process.env.SMTP_PORT || '465', 10),
            secure: process.env.SMTP_SECURE !== 'false',
            auth: {
                user: process.env.SMTP_USER || 'contact@airtrainr.com',
                pass: process.env.SMTP_PASS || '',
            },
        });

        return this.transporter;
    }

    /**
     * Send a booking reminder email
     */
    async sendReminderEmail(data: ReminderEmailData): Promise<void> {
        try {
            const transporter = await this.getTransporter();

            const timeLabel = data.reminderType === '24h' ? '24 hours' : '1 hour';
            const scheduledStr = data.scheduledAt.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
            });

            const sportName = data.sport.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

            const html = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; border-radius: 16px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #a3ff12 0%, #7acc0e 100%); padding: 32px; text-align: center;">
                        <h1 style="margin: 0; color: #0a0a0a; font-size: 24px;">🏋️ AirTrainr</h1>
                        <p style="margin: 8px 0 0; color: #0a0a0a; font-size: 14px;">Session Reminder</p>
                    </div>
                    <div style="padding: 32px;">
                        <p style="font-size: 18px; margin: 0 0 16px;">Your training session starts in <strong>${timeLabel}</strong>!</p>
                        <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 16px 0;">
                            <p style="margin: 0 0 8px;"><strong>Sport:</strong> ${sportName}</p>
                            <p style="margin: 0 0 8px;"><strong>Athlete:</strong> ${data.athleteName}</p>
                            <p style="margin: 0 0 8px;"><strong>Trainer:</strong> ${data.trainerName}</p>
                            <p style="margin: 0 0 8px;"><strong>When:</strong> ${scheduledStr}</p>
                            <p style="margin: 0 0 8px;"><strong>Duration:</strong> ${data.durationMinutes} minutes</p>
                            ${data.address ? `<p style="margin: 0;"><strong>Location:</strong> ${data.address}</p>` : ''}
                        </div>
                        <p style="color: #888; font-size: 13px; margin-top: 24px;">
                            Need to reschedule? Log into your AirTrainr dashboard.
                        </p>
                    </div>
                </div>
            `;

            const info = await transporter.sendMail({
                from: '"AirTrainr" <contact@airtrainr.com>',
                to: data.to,
                subject: `⏰ Your ${sportName} session starts in ${timeLabel}`,
                html,
            });

            // In dev, log the Ethereal preview URL
            if (config.nodeEnv !== 'production') {
                const previewUrl = nodemailer.getTestMessageUrl(info);
                logger.info(`📧 Preview email: ${previewUrl}`);
            }

            logger.info(`Reminder email sent to ${data.to} (${data.reminderType} reminder)`);
        } catch (error) {
            logger.error('Failed to send reminder email', { error, to: data.to });
        }
    }
}

export const emailService = new EmailService();
