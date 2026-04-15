/**
 * Google Places provider for React Native.
 * Uses the Places API (New) via fetch -- no browser SDK dependencies.
 * API key comes from EXPO_PUBLIC_GOOGLE_PLACES_KEY env var by default.
 */

export interface PlacePrediction {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}

export interface PlaceDetails {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
    formattedAddress: string;
}

const PLACES_AUTOCOMPLETE_URL =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACES_DETAILS_URL =
    'https://maps.googleapis.com/maps/api/place/details/json';

export class GooglePlacesProvider {
    private apiKey: string;
    private failed = false;

    constructor(apiKey?: string) {
        this.apiKey =
            apiKey ||
            (typeof process !== 'undefined'
                ? process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''
                : '');
    }

    get isAvailable(): boolean {
        return !!this.apiKey && !this.failed;
    }

    /**
     * Autocomplete city search.
     * Returns up to `limit` predictions (default 5).
     */
    async autocomplete(
        input: string,
        options?: { limit?: number; signal?: AbortSignal }
    ): Promise<PlacePrediction[]> {
        if (!this.isAvailable || input.length < 2) return [];

        const limit = options?.limit ?? 5;

        try {
            const url =
                `${PLACES_AUTOCOMPLETE_URL}` +
                `?input=${encodeURIComponent(input)}` +
                `&types=(cities)` +
                `&key=${this.apiKey}`;

            const res = await fetch(url, { signal: options?.signal });
            const data = await res.json();

            if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
                // Short-circuit future calls on persistent failures
                this.failed = true;
                return [];
            }

            if (data.status !== 'OK' || !data.predictions) return [];

            return data.predictions.slice(0, limit).map((p: any) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text ?? p.description,
                secondaryText: p.structured_formatting?.secondary_text ?? '',
            }));
        } catch (err: any) {
            if (err?.name === 'AbortError') throw err;
            return [];
        }
    }

    /**
     * Fetch full place details (city, state, country, lat/lng) for a place ID.
     */
    async getPlaceDetails(
        placeId: string,
        signal?: AbortSignal
    ): Promise<PlaceDetails | null> {
        if (!this.apiKey) return null;

        try {
            const url =
                `${PLACES_DETAILS_URL}` +
                `?place_id=${placeId}` +
                `&fields=geometry,address_components,formatted_address` +
                `&key=${this.apiKey}`;

            const res = await fetch(url, { signal });
            const data = await res.json();

            if (data.status !== 'OK' || !data.result) return null;

            const components: any[] = data.result.address_components || [];
            const findComponent = (type: string, useShort = false) => {
                const comp = components.find((c: any) => c.types.includes(type));
                return comp ? (useShort ? comp.short_name : comp.long_name) : '';
            };

            return {
                city: findComponent('locality') || findComponent('sublocality') || findComponent('administrative_area_level_2'),
                state: findComponent('administrative_area_level_1', true),
                country: findComponent('country'),
                lat: data.result.geometry.location.lat,
                lng: data.result.geometry.location.lng,
                formattedAddress: data.result.formatted_address || '',
            };
        } catch (err: any) {
            if (err?.name === 'AbortError') throw err;
            return null;
        }
    }
}

/** Singleton instance using the default env-var key */
let _defaultProvider: GooglePlacesProvider | null = null;

export function getGooglePlacesProvider(): GooglePlacesProvider {
    if (!_defaultProvider) {
        _defaultProvider = new GooglePlacesProvider();
    }
    return _defaultProvider;
}
