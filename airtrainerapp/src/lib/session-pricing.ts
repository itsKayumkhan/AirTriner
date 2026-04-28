// ============================================
// Session Pricing — per-duration pricing for trainers (sessions only, NOT camps).
// Mirrors apps/web/src/lib/session-pricing.ts. Mobile must use the same helpers
// so prices stay consistent between platforms.
//
// Stored in trainer_profiles.session_pricing as JSONB:
//   { "30": { price: 25, enabled: true }, "45": {...}, "60": {...} }
//
// Camps live in trainer_profiles.camp_offerings — they do NOT use session_pricing.
// ============================================

export const ALLOWED_SESSION_DURATIONS = [30, 45, 60] as const;
export type AllowedDuration = (typeof ALLOWED_SESSION_DURATIONS)[number];

export type DurationEntry = { price: number; enabled: boolean };
export type SessionPricing = Partial<Record<`${AllowedDuration}`, DurationEntry>>;

const DEFAULT_HOURLY_RATE = 50;

export function defaultSessionPricing(hourlyRate: number = DEFAULT_HOURLY_RATE): SessionPricing {
    const r = Number(hourlyRate) || DEFAULT_HOURLY_RATE;
    return {
        '30': { price: round2(r * 0.5), enabled: false },
        '45': { price: round2(r * 0.75), enabled: false },
        '60': { price: round2(r), enabled: true },
    };
}

export function normalizeSessionPricing(raw: unknown, hourlyRate?: number | null): SessionPricing {
    const fallback = defaultSessionPricing(Number(hourlyRate) || DEFAULT_HOURLY_RATE);
    if (!raw || typeof raw !== 'object') return fallback;
    const out: SessionPricing = { ...fallback };
    for (const d of ALLOWED_SESSION_DURATIONS) {
        const key = String(d) as `${AllowedDuration}`;
        const v = (raw as Record<string, unknown>)[key];
        if (v && typeof v === 'object') {
            const entry = v as { price?: unknown; enabled?: unknown };
            const price = Number(entry.price);
            out[key] = {
                price: Number.isFinite(price) && price >= 0 ? round2(price) : fallback[key]!.price,
                enabled: entry.enabled === true,
            };
        }
    }
    const anyEnabled = ALLOWED_SESSION_DURATIONS.some((d) => out[String(d) as `${AllowedDuration}`]?.enabled);
    if (!anyEnabled) out['60'] = { ...(out['60'] || fallback['60']!), enabled: true };
    return out;
}

export function priceFor(pricing: SessionPricing, durationMinutes: number): number | null {
    if (!ALLOWED_SESSION_DURATIONS.includes(durationMinutes as AllowedDuration)) return null;
    const entry = pricing[String(durationMinutes) as `${AllowedDuration}`];
    if (!entry?.enabled) return null;
    return entry.price;
}

export function minEnabledPrice(pricing: SessionPricing): number | null {
    const prices = ALLOWED_SESSION_DURATIONS
        .map((d) => pricing[String(d) as `${AllowedDuration}`])
        .filter((e): e is DurationEntry => !!e?.enabled)
        .map((e) => e.price);
    return prices.length ? Math.min(...prices) : null;
}

export function enabledDurations(pricing: SessionPricing): AllowedDuration[] {
    return ALLOWED_SESSION_DURATIONS.filter(
        (d) => pricing[String(d) as `${AllowedDuration}`]?.enabled
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
