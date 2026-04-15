/**
 * Country detection and unit conversion utilities.
 *
 * Used across profile, search, and setup screens to display
 * radius values in the correct unit for the user's country.
 * Internal storage is always in miles — display layer converts.
 */

const US_ZIP_RE = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const MI_TO_KM_FACTOR = 1.60934;

/**
 * Detect country from a ZIP or postal code string.
 *
 * - 5-digit numeric (with optional `-####` suffix) → `"US"`
 * - Canadian postal pattern (e.g. `K0L 1B0`, `K0L1B0`, case-insensitive) → `"CA"`
 * - Anything else → `"OTHER"`
 */
export function detectCountry(zipOrPostal: string): "US" | "CA" | "OTHER" {
  const trimmed = zipOrPostal.trim();
  if (US_ZIP_RE.test(trimmed)) return "US";
  if (CA_POSTAL_RE.test(trimmed)) return "CA";
  return "OTHER";
}

/**
 * Return the appropriate radius unit label for a given country.
 *
 * - US → `"mi"`
 * - CA → `"km"`
 * - OTHER → `"mi"` (default)
 */
export function radiusUnit(country: "US" | "CA" | "OTHER"): "mi" | "km" {
  return country === "CA" ? "km" : "mi";
}

/**
 * Format a radius value with the correct unit for display.
 *
 * @example formatRadius(25, "US")  // "25 mi"
 * @example formatRadius(40, "CA")  // "40 km"
 */
export function formatRadius(
  value: number,
  country: "US" | "CA" | "OTHER",
): string {
  return `${value} ${radiusUnit(country)}`;
}

/**
 * Convert kilometres to miles.
 *
 * Uses the standard factor 1.60934.
 */
export function kmToMi(km: number): number {
  return km / MI_TO_KM_FACTOR;
}

/**
 * Convert miles to kilometres.
 *
 * Uses the standard factor 1.60934.
 */
export function miToKm(mi: number): number {
  return mi * MI_TO_KM_FACTOR;
}
