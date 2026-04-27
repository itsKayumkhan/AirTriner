// ============================================
// Currency — single source of truth for the platform's currency.
//
// Default: USD. Override via NEXT_PUBLIC_PLATFORM_CURRENCY env var.
// Stripe Transfer flows can dynamically pick the source charge's currency
// (see stripe-transfer.ts) — those override the platform default per call.
// ============================================

const RAW = (
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PLATFORM_CURRENCY
) || 'USD';

export const PLATFORM_CURRENCY = RAW.toUpperCase();
export const PLATFORM_CURRENCY_LOWER = RAW.toLowerCase();

const SYMBOLS: Record<string, string> = {
    USD: '$',
    CAD: 'CA$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    INR: '₹',
};

export const PLATFORM_CURRENCY_SYMBOL = SYMBOLS[PLATFORM_CURRENCY] ?? '$';

/**
 * Format an amount for display in the platform's currency.
 *  formatMoney(50)         -> "$50.00"
 *  formatMoney(50, {dec:0}) -> "$50"
 */
export function formatMoney(
    amount: number | string | null | undefined,
    opts: { dec?: number; symbol?: boolean } = {}
): string {
    const n = Number(amount);
    if (!Number.isFinite(n)) return opts.symbol === false ? '0' : `${PLATFORM_CURRENCY_SYMBOL}0`;
    const dec = opts.dec ?? 2;
    const body = n.toFixed(dec);
    return opts.symbol === false ? body : `${PLATFORM_CURRENCY_SYMBOL}${body}`;
}

/**
 * Currency to use for a Stripe API call. Lower-case ISO 4217.
 * If the caller has access to a Stripe charge, prefer that charge's currency
 * over this default to avoid mismatched-currency errors.
 */
export function stripeCurrency(override?: string | null): string {
    const v = (override || PLATFORM_CURRENCY_LOWER).toLowerCase();
    return v;
}
