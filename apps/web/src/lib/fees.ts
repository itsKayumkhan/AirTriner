// ============================================
// AirTrainr — Fee Calculation Utility
// Shared helper used by stripe payment routes, booking creation,
// webhooks, emails, and trainer payment settings page.
//
// Fee model (athlete pays everything, trainer gets 100% of price):
//   1. Session fee       = trainer's rate (price)
//   2. Platform fee      = price * platformPct  (default 3%)
//   3. Stripe processing = (price + platformFee) * 2.9% + $0.30
//   4. Tax (Canada/HST)  = (price + platformFee + stripeFee) * 13%  [only when trainer country = CA]
//   Total = price + platformFee + stripeFee + tax
//   Trainer payout = price (full, no deductions)
// ============================================

export const STRIPE_PERCENT = 0.029;           // 2.9%
export const STRIPE_FIXED = 0.30;              // $0.30
export const DEFAULT_PLATFORM_PCT = 3;         // 3%
export const CANADA_HST_PCT = 13;              // Ontario HST

export interface FeeBreakdown {
    sessionFee: number;    // trainer rate (base price)
    platformFee: number;   // AirTrainr commission
    stripeFee: number;     // Stripe 2.9% + $0.30 (paid by athlete)
    taxAmount: number;     // 13% HST for Canada, 0 elsewhere
    taxLabel: string;      // "HST (13%)" or "" if no tax
    totalPaid: number;     // What athlete is charged
    trainerPayout: number; // What trainer receives (= sessionFee, 100%)
    platformFeePct: number;
    taxPct: number;
    trainerCountry: string | null;
    taxApplicable: boolean;
}

// Round to 2 decimals (cents) — avoids floating-point noise
function round2(v: number): number {
    return Math.round(v * 100) / 100;
}

export interface CalcFeesInput {
    price: number;                       // trainer rate / session fee
    platformFeePercentage?: number | null; // from platform_settings (default 3)
    trainerCountry?: string | null;       // trainer's country code from trainer_profiles
}

export function calculateFees(input: CalcFeesInput): FeeBreakdown {
    const price = Number(input.price) || 0;
    const platformPct = Number(input.platformFeePercentage ?? DEFAULT_PLATFORM_PCT);
    const countryRaw = (input.trainerCountry || '').trim();

    // Normalize country — accept "CA", "ca", "Canada" all as Canadian trainers
    const isCanadian = /^(ca|can|canada)$/i.test(countryRaw);
    const taxPct = isCanadian ? CANADA_HST_PCT : 0;
    const taxLabel = isCanadian ? `HST (${CANADA_HST_PCT}%)` : '';

    const sessionFee = round2(price);
    const platformFee = round2(price * (platformPct / 100));

    // Stripe fee is charged on the full amount Stripe processes.
    // Solve for fee so that (price + platformFee) nets after Stripe's cut.
    // Stripe takes 2.9% + $0.30 of the gross. To cover it, the athlete must pay
    // a gross such that gross - (gross * 0.029 + 0.30) = price + platformFee + tax.
    // Simpler approx (industry standard for "pass-through"): add fee on top:
    //   stripeFee = (subtotal) * 0.029 + 0.30
    // This is the spec the client asked for in the task prompt.
    const subtotalBeforeStripe = sessionFee + platformFee;
    const stripeFee = round2(subtotalBeforeStripe * STRIPE_PERCENT + STRIPE_FIXED);

    // Tax applies to the service + fees (CRA standard for taxable services)
    const taxableBase = sessionFee + platformFee + stripeFee;
    const taxAmount = round2(taxableBase * (taxPct / 100));

    const totalPaid = round2(sessionFee + platformFee + stripeFee + taxAmount);
    const trainerPayout = sessionFee; // 100%, no deductions

    return {
        sessionFee,
        platformFee,
        stripeFee,
        taxAmount,
        taxLabel,
        totalPaid,
        trainerPayout,
        platformFeePct: platformPct,
        taxPct,
        trainerCountry: countryRaw || null,
        taxApplicable: isCanadian,
    };
}

// Format currency for display
export function formatFeeCurrency(amount: number): string {
    return `$${(Number(amount) || 0).toFixed(2)}`;
}
