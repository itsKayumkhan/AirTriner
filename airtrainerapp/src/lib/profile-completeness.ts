// ============================================
// Trainer profile completeness gate (RN mirror)
// ============================================
//
// Mirror of apps/web/src/lib/profile-completeness.ts — keep these in sync.
// RN-safe: no DOM types, no browser APIs.

export type ProfileCompleteness = {
    complete: boolean;
    missing: string[];
    /** Total mandatory fields. Used for "X / Y" progress display. */
    total: number;
    /** Number of mandatory fields filled. */
    filled: number;
};

const TOTAL_FIELDS = 10;

function hasEnabledPricing(sessionPricing: unknown): boolean {
    if (!sessionPricing || typeof sessionPricing !== "object") return false;
    const sp = sessionPricing as Record<string, unknown>;
    for (const key of Object.keys(sp)) {
        const entry = sp[key];
        if (!entry || typeof entry !== "object") continue;
        const e = entry as { price?: unknown; enabled?: unknown };
        const price = Number(e.price);
        if (e.enabled === true && Number.isFinite(price) && price > 0) return true;
    }
    return false;
}

/**
 * Compute trainer profile completeness against the mandatory-fields list.
 * See apps/web/src/lib/profile-completeness.ts for the canonical doc-comment.
 */
export function computeTrainerCompleteness(
    user: any,
    trainerProfile: any
): ProfileCompleteness {
    const missing: string[] = [];

    const firstName = (user?.first_name ?? "").toString().trim();
    const lastName = (user?.last_name ?? "").toString().trim();
    if (!firstName || !lastName) missing.push("Full name");

    const phone = (user?.phone ?? "").toString().trim();
    if (!phone) missing.push("Phone");

    if (!user?.date_of_birth) missing.push("Date of birth");

    if (!user?.avatar_url) missing.push("Profile photo");

    const bio = (trainerProfile?.bio ?? "").toString().trim();
    if (bio.length < 50) missing.push("Bio (50+ chars)");

    const sports = Array.isArray(trainerProfile?.sports) ? trainerProfile.sports : [];
    if (sports.length < 1) missing.push("Sports");

    const city = (trainerProfile?.city ?? "").toString().trim();
    if (!city) missing.push("City");

    const ye = trainerProfile?.years_experience;
    if (ye === null || ye === undefined || Number.isNaN(Number(ye)) || Number(ye) < 0) {
        missing.push("Years of experience");
    }

    if (!hasEnabledPricing(trainerProfile?.session_pricing)) {
        missing.push("Session pricing");
    }

    const locs = Array.isArray(trainerProfile?.training_locations)
        ? trainerProfile.training_locations
        : [];
    if (locs.length < 1) missing.push("Training locations");

    return {
        complete: missing.length === 0,
        missing,
        total: TOTAL_FIELDS,
        filled: TOTAL_FIELDS - missing.length,
    };
}
