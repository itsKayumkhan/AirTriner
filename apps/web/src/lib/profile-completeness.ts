// ============================================
// Trainer profile completeness gate
// ============================================
//
// A trainer's public profile should appear in athlete search ONLY when:
//   1. Admin has verified them (verification_status === "verified"), AND
//   2. All mandatory profile fields below are filled.
//
// This module is the single source of truth for #2. It is consumed by:
//   - apps/web/src/app/dashboard/search/page.tsx (filter out incomplete trainers)
//   - apps/web/src/app/dashboard/profile/page.tsx (show banner to trainer)
//   - apps/web/src/app/admin/trainers/page.tsx (show "ready to verify" badge)
//
// Mirror file at airtrainerapp/src/lib/profile-completeness.ts (RN-safe).

export type ProfileCompleteness = {
    complete: boolean;
    missing: string[];
    /** Total mandatory fields. Used for "X / Y" progress display. */
    total: number;
    /** Number of mandatory fields filled. */
    filled: number;
};

const TOTAL_FIELDS = 10;

/**
 * Check whether session_pricing JSONB has at least one duration enabled
 * with a price > 0. Tolerant of legacy shapes / null / partial data.
 */
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
 *
 * Mandatory list (matches setup wizard validation):
 *   - users.first_name (non-empty)
 *   - users.last_name (non-empty)
 *   - users.phone (non-empty)
 *   - users.date_of_birth (non-null)
 *   - users.avatar_url (non-null)
 *   - trainer_profiles.bio (length >= 50)
 *   - trainer_profiles.sports (array length >= 1)
 *   - trainer_profiles.city (non-empty)
 *   - trainer_profiles.years_experience (column set, not null/undefined; >= 0)
 *   - trainer_profiles.session_pricing has at least 1 enabled duration with price > 0
 *   - trainer_profiles.training_locations (array length >= 1)
 *
 * Note: that list is 11 items but first_name + last_name are paired into a
 * single "Full name" check for the user-facing missing[] label, hence
 * TOTAL_FIELDS = 10. The friendly labels are stable strings — admins/trainers
 * read them, do NOT rename without updating UI copy.
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
