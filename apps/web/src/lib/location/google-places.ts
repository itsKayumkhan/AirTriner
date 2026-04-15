/**
 * Google Places implementation of the LocationProvider interface.
 *
 * Uses the Places API (New):
 *   - Autocomplete: https://places.googleapis.com/v1/places:autocomplete
 *   - Place Details for geocoding
 *
 * Filters results to cities/towns only (US & CA).
 */

import type { LocationProvider, LocationResult } from "./index";

const AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

interface PlacePrediction {
  place: string;
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
}

interface AutocompleteResponse {
  suggestions?: PlacePrediction[];
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface PlaceDetailsResponse {
  location?: { latitude: number; longitude: number };
  addressComponents?: AddressComponent[];
  formattedAddress?: string;
}

interface GeoResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

function extractFromComponents(
  components: AddressComponent[],
): { city: string; state: string; country: string } {
  let city = "";
  let state = "";
  let country = "";

  for (const c of components) {
    if (c.types.includes("locality")) city = c.longText;
    else if (!city && c.types.includes("sublocality_level_1"))
      city = c.longText;
    else if (
      c.types.includes("administrative_area_level_1")
    )
      state = c.shortText;
    else if (c.types.includes("country")) country = c.shortText;
  }

  return { city, state, country };
}

let _warnedOnce = false;
let _placesApiFailed = false;

export class GooglePlacesProvider implements LocationProvider {
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

    // Skip Places API if it previously failed (e.g. not enabled)
    if (_placesApiFailed) {
      return this.autocompleteFallback(query, signal);
    }

    try {
      const body = {
        input: query,
        includedPrimaryTypes: ["(cities)"],
        includedRegionCodes: ["us", "ca"],
        languageCode: "en",
      };

      const res = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.key,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        _placesApiFailed = true;
        // Fallback to legacy Geocoding API for autocomplete
        return this.autocompleteFallback(query, signal);
      }

      const data: AutocompleteResponse = await res.json();

      if (!data.suggestions?.length) return [];

      // Fetch details for each suggestion to get lat/lng
      const results = await Promise.all(
        data.suggestions.slice(0, 5).map(async (s) => {
          const placeId = s.placePrediction.placeId;
          const displayName = s.placePrediction.text.text;
          return this.getPlaceDetails(placeId, displayName);
        }),
      );

      return results.filter((r): r is LocationResult => r !== null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return [];
      // Fallback to geocoding API
      return this.autocompleteFallback(query, signal);
    }
  }

  private async autocompleteFallback(
    query: string,
    signal?: AbortSignal,
  ): Promise<LocationResult[]> {
    try {
      const params = new URLSearchParams({
        address: query,
        key: this.key,
        result_type: "locality|sublocality|administrative_area_level_3",
      });

      const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
        signal,
      });

      if (!res.ok) {
        if (!_warnedOnce) {
          console.warn(
            `[location] Google geocode error: ${res.status} ${res.statusText}`,
          );
          _warnedOnce = true;
        }
        return [];
      }

      const data = await res.json();
      if (data.status !== "OK" || !data.results?.length) return [];

      return data.results.slice(0, 5).map((r: GeoResult) => {
        const comps = r.address_components || [];
        let city = "";
        let state = "";
        let country = "";

        for (const c of comps) {
          if (c.types.includes("locality")) city = c.long_name;
          else if (!city && c.types.includes("sublocality_level_1"))
            city = c.long_name;
          else if (!city && c.types.includes("administrative_area_level_2"))
            city = c.long_name;
          else if (!city && c.types.includes("administrative_area_level_3"))
            city = c.long_name;
          else if (c.types.includes("administrative_area_level_1"))
            state = c.short_name;
          else if (c.types.includes("country")) country = c.short_name;
        }

        // If city still empty, use first part of formatted address
        if (!city && r.formatted_address) {
          city = r.formatted_address.split(",")[0]?.trim() || "";
        }

        return {
          city,
          state,
          country,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          displayName: r.formatted_address,
        };
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return [];
      if (!_warnedOnce) {
        console.warn("[location] Google autocomplete fallback error:", err);
        _warnedOnce = true;
      }
      return [];
    }
  }

  private async getPlaceDetails(
    placeId: string,
    fallbackName: string,
  ): Promise<LocationResult | null> {
    try {
      const res = await fetch(
        `${DETAILS_URL}/${placeId}?fields=location,addressComponents,formattedAddress`,
        {
          headers: {
            "X-Goog-Api-Key": this.key,
          },
        },
      );

      if (!res.ok) return null;

      const data: PlaceDetailsResponse = await res.json();

      if (!data.location) return null;

      const { city, state, country } = data.addressComponents
        ? extractFromComponents(data.addressComponents)
        : { city: "", state: "", country: "" };

      return {
        city: city || fallbackName.split(",")[0]?.trim() || "",
        state,
        country,
        lat: data.location.latitude,
        lng: data.location.longitude,
        displayName: data.formattedAddress || fallbackName,
      };
    } catch {
      return null;
    }
  }

  async geocode(address: string): Promise<LocationResult | null> {
    if (!address) return null;

    try {
      const params = new URLSearchParams({
        address,
        key: this.key,
      });

      const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);

      if (!res.ok) {
        if (!_warnedOnce) {
          console.warn(
            `[location] Google geocode error: ${res.status} ${res.statusText}`,
          );
          _warnedOnce = true;
        }
        return null;
      }

      const data = await res.json();
      if (data.status !== "OK" || !data.results?.length) return null;

      const r: GeoResult = data.results[0];
      const comps = r.address_components || [];
      let city = "";
      let state = "";
      let country = "";

      for (const c of comps) {
        if (c.types.includes("locality")) city = c.long_name;
        else if (!city && c.types.includes("sublocality_level_1"))
          city = c.long_name;
        else if (!city && c.types.includes("administrative_area_level_2"))
          city = c.long_name;
        else if (!city && c.types.includes("administrative_area_level_3"))
          city = c.long_name;
        else if (c.types.includes("administrative_area_level_1"))
          state = c.short_name;
        else if (c.types.includes("country")) country = c.short_name;
      }

      if (!city && r.formatted_address) {
        city = r.formatted_address.split(",")[0]?.trim() || "";
      }

      return {
        city,
        state,
        country,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        displayName: r.formatted_address,
      };
    } catch (err: unknown) {
      if (!_warnedOnce) {
        console.warn("[location] Google geocode network error:", err);
        _warnedOnce = true;
      }
      return null;
    }
  }
}
