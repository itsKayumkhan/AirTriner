// ============================================
// Session Pricing — per-duration pricing for trainers (sessions only, NOT camps)
//
// Stored in trainer_profiles.session_pricing as JSONB:
//   { "30": { price: 25, enabled: true }, "45": {...}, "60": {...} }
//
// Camps live in trainer_profiles.camp_offerings and have their own
// per-camp totalPrice — they do NOT use session_pricing.
// ============================================

export const ALLOWED_SESSION_DURATIONS = [30, 45, 60] as const;
export type AllowedDuration = (typeof ALLOWED_SESSION_DURATIONS)[number];

export type DurationEntry = { price: number; enabled: boolean };
export type SessionPricing = Partial<Record<`${AllowedDuration}`, DurationEntry>>;

const DEFAULT_HOURLY_RATE = 50;

/**
 * Build a fresh session_pricing object from a single hourly rate.
 * Used for new trainer signup defaults.
 *
 * Defaults: 60 enabled, 30/45 disabled.
 */
export function defaultSessionPricing(hourlyRate: number = DEFAULT_HOURLY_RATE): SessionPricing {
    const r = Number(hourlyRate) || DEFAULT_HOURLY_RATE;
    return {
        '30': { price: round2(r * 0.5), enabled: false },
        '45': { price: round2(r * 0.75), enabled: false },
        '60': { price: round2(r), enabled: true },
    };
}

/**
 * Tolerant reader — accepts whatever the DB returns and gives back a clean
 * object with all 3 durations populated. Missing entries get proportional
 * fallbacks from hourly_rate. Bad/null input is treated as "use defaults".
 */
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
    // Safety: at least one duration must be enabled or trainer is unbookable.
    const anyEnabled = ALLOWED_SESSION_DURATIONS.some((d) => out[String(d) as `${AllowedDuration}`]?.enabled);
    if (!anyEnabled) out['60'] = { ...(out['60'] || fallback['60']!), enabled: true };
    return out;
}

/**
 * Get the price for a specific duration. Returns null if duration is not
 * enabled or not in the allowed set.
 */
export function priceFor(pricing: SessionPricing, durationMinutes: number): number | null {
    if (!ALLOWED_SESSION_DURATIONS.includes(durationMinutes as AllowedDuration)) return null;
    const entry = pricing[String(durationMinutes) as `${AllowedDuration}`];
    if (!entry?.enabled) return null;
    return entry.price;
}

/**
 * Lowest enabled price (for "from $X" display on search cards).
 * Returns null if no durations are enabled (shouldn't happen post-normalize).
 */
export function minEnabledPrice(pricing: SessionPricing): number | null {
    const prices = ALLOWED_SESSION_DURATIONS
        .map((d) => pricing[String(d) as `${AllowedDuration}`])
        .filter((e): e is DurationEntry => !!e?.enabled)
        .map((e) => e.price);
    return prices.length ? Math.min(...prices) : null;
}

/**
 * List of enabled durations (for booking UI). Sorted ascending.
 */
export function enabledDurations(pricing: SessionPricing): AllowedDuration[] {
    return ALLOWED_SESSION_DURATIONS.filter(
        (d) => pricing[String(d) as `${AllowedDuration}`]?.enabled
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
