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
