/**
 * Shared formatting utilities for the AirTrainr web app.
 */

/**
 * Format a sport slug into a properly capitalized display name.
 * e.g. "track_and_field" → "Track And Field", "martial_arts" → "Martial Arts"
 */
export function formatSportName(sport: string): string {
    return sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize a sports array to canonical lowercase slug form, de-duplicated.
 * - "Track & Field" → "track_and_field"
 * - "Martial Arts" → "martial_arts"
 * - Drops empties and duplicates.
 *
 * Use everywhere we write `sports` to trainer_profiles / athlete_profiles so
 * search filters and sort comparisons are case-consistent.
 */
export function normalizeSports(arr: string[] | undefined | null): string[] {
    if (!arr) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of arr) {
        const slug = String(s)
            .trim()
            .toLowerCase()
            .replace(/\s+&\s+/g, "_and_")
            .replace(/\s+/g, "_");
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        out.push(slug);
    }
    return out;
}
