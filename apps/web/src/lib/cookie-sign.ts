import { createHmac, timingSafeEqual } from 'crypto';

// HMAC-sign the airtrainr_uid cookie so it can't be forged client-side.
// Format: `<uid>.<base64url-hmac>`
//
// Dual-mode design:
//   - If AIRTRAINR_COOKIE_SECRET is missing, we fall back to treating the value
//     as an unsigned raw uid (logs a warning once). This avoids breaking dev
//     environments without the env var.
//   - If a value contains no `.`, callers should treat it as a legacy unsigned
//     uid (back-compat for existing logged-in sessions whose cookies were
//     written before signing was introduced).
//   - If a value contains `.` but the HMAC doesn't verify, treat it as a
//     forgery attempt and reject (return null).

let warned = false;

function getSecret(): string | null {
    const secret = process.env.AIRTRAINR_COOKIE_SECRET;
    if (!secret) {
        if (!warned) {
            // eslint-disable-next-line no-console
            console.warn(
                '[cookie-sign] AIRTRAINR_COOKIE_SECRET is not set; airtrainr_uid cookies will be unsigned (dev fallback).',
            );
            warned = true;
        }
        return null;
    }
    return secret;
}

function b64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Returns a signed cookie value `<uid>.<hmac>`. If no secret is configured,
 * returns the raw uid unchanged so dev environments keep working.
 */
export function signUid(uid: string): string {
    const secret = getSecret();
    if (!secret) return uid;
    const mac = createHmac('sha256', secret).update(uid).digest();
    return `${uid}.${b64url(mac)}`;
}

/**
 * Verifies a signed cookie value.
 *   - If `value` is unsigned (no `.`), returns it as-is (legacy back-compat).
 *   - If `value` is signed and verifies, returns the uid portion.
 *   - If `value` is signed but the HMAC doesn't match, returns null (forgery).
 *   - If no secret is configured, accepts any value as raw uid (dev fallback).
 */
export function verifySignedUid(value: string): string | null {
    if (!value) return null;
    const dotIdx = value.lastIndexOf('.');
    if (dotIdx === -1) {
        // Unsigned legacy cookie — accept as raw uid.
        return value;
    }
    const secret = getSecret();
    if (!secret) {
        // No secret configured: accept as raw uid (strip any signature suffix).
        return value.slice(0, dotIdx);
    }
    const uid = value.slice(0, dotIdx);
    const sig = value.slice(dotIdx + 1);
    if (!uid || !sig) return null;
    const expected = createHmac('sha256', secret).update(uid).digest();
    let provided: Buffer;
    try {
        provided = fromB64url(sig);
    } catch {
        return null;
    }
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;
    return uid;
}
