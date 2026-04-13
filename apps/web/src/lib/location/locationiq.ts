/**
 * LocationIQ implementation of the LocationProvider interface.
 *
 * Uses the free tier (5 000 requests / day):
 *   - Autocomplete: https://api.locationiq.com/v1/autocomplete
 *   - Forward geocode: https://api.locationiq.com/v1/search
 *
 * All responses are mapped into the shared `LocationResult` shape.
 */

import type { LocationProvider, LocationResult } from "./index";

const AUTOCOMPLETE_URL = "https://api.locationiq.com/v1/autocomplete";
const SEARCH_URL = "https://api.locationiq.com/v1/search";

/** Shape of a single item returned by LocationIQ's autocomplete / search endpoints. */
interface LIQResult {
  place_id?: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
  type?: string;
  class?: string;
}

function mapResult(r: LIQResult): LocationResult {
  const addr = r.address ?? {};
  return {
    city: addr.city || addr.town || addr.village || "",
    state: addr.state || "",
    country: addr.country || "",
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name,
  };
}

let _warnedOnce = false;

export class LocationIQProvider implements LocationProvider {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  isConfigured(): boolean {
    return true;
  }

  async autocomplete(
    query: string,
    signal?: AbortSignal,
  ): Promise<LocationResult[]> {
    if (!query || query.length < 2) return [];

    try {
      const params = new URLSearchParams({
        key: this.key,
        q: query,
        limit: "5",
        tag: "place:city,place:town,place:village",
        dedupe: "1",
        format: "json",
      });

      const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, {
        signal,
      });

      if (!res.ok) {
        if (!_warnedOnce) {
          console.warn(
            `[location] LocationIQ autocomplete error: ${res.status} ${res.statusText}`,
          );
          _warnedOnce = true;
        }
        return [];
      }

      const data: LIQResult[] = await res.json();
      return data.slice(0, 5).map(mapResult);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return [];
      if (!_warnedOnce) {
        console.warn("[location] LocationIQ autocomplete network error:", err);
        _warnedOnce = true;
      }
      return [];
    }
  }

  async geocode(address: string): Promise<LocationResult | null> {
    if (!address) return null;

    try {
      const params = new URLSearchParams({
        key: this.key,
        q: address,
        limit: "1",
        format: "json",
      });

      const res = await fetch(`${SEARCH_URL}?${params.toString()}`);

      if (!res.ok) {
        if (!_warnedOnce) {
          console.warn(
            `[location] LocationIQ geocode error: ${res.status} ${res.statusText}`,
          );
          _warnedOnce = true;
        }
        return null;
      }

      const data: LIQResult[] = await res.json();
      if (!data.length) return null;
      return mapResult(data[0]);
    } catch (err: unknown) {
      if (!_warnedOnce) {
        console.warn("[location] LocationIQ geocode network error:", err);
        _warnedOnce = true;
      }
      return null;
    }
  }
}
