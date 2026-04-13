/**
 * Location provider abstraction.
 *
 * Exposes a single `getLocationProvider()` factory that returns either
 * the LocationIQ implementation (when the API key is configured) or a
 * no-op fallback that lets the rest of the app work without errors.
 */

/** A single geocoded / autocompleted location result. */
export type LocationResult = {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  displayName: string;
};

/** Minimal interface every location provider must satisfy. */
export interface LocationProvider {
  /** Return up to 5 city-level suggestions for the given query. */
  autocomplete(query: string, signal?: AbortSignal): Promise<LocationResult[]>;

  /** Forward-geocode a single address string. Returns `null` on failure. */
  geocode(address: string): Promise<LocationResult | null>;

  /** Whether the provider has the credentials it needs to make API calls. */
  isConfigured(): boolean;
}

let _cached: LocationProvider | null = null;

/**
 * Return the active location provider singleton.
 *
 * - If `NEXT_PUBLIC_LOCATIONIQ_KEY` is set → LocationIQ provider.
 * - Otherwise → silent fallback (autocomplete returns `[]`, geocode `null`).
 */
export function getLocationProvider(): LocationProvider {
  if (_cached) return _cached;

  const key =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_LOCATIONIQ_KEY
      : undefined;

  if (key) {
    // Lazy-import so the fallback path never loads the LocationIQ module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocationIQProvider } = require("./locationiq") as typeof import("./locationiq");
    _cached = new LocationIQProvider(key);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FallbackProvider } = require("./fallback") as typeof import("./fallback");
    _cached = new FallbackProvider();
  }

  return _cached;
}
