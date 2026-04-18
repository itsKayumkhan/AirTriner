import { NextRequest, NextResponse } from "next/server";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || "";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Server-side geocode helper used for back-filling lat/lng on trainer/athlete
 * profiles that were saved before location coordinates were captured.
 *
 * GET /api/places/geocode?city=Port+Perry&state=ON&country=CA
 *     → { lat, lng, city, state, country }
 *
 * Returns 404 if the address cannot be resolved, 500 on API errors.
 */
export async function GET(req: NextRequest) {
    const city = req.nextUrl.searchParams.get("city") || "";
    const state = req.nextUrl.searchParams.get("state") || "";
    const country = req.nextUrl.searchParams.get("country") || "";

    if (!city || !GOOGLE_KEY) {
        return NextResponse.json({ error: "Missing city or API key" }, { status: 400 });
    }

    const address = [city, state, country].filter(Boolean).join(", ");

    try {
        const params = new URLSearchParams({ address, key: GOOGLE_KEY });
        const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
        const data = await res.json();

        if (data.status !== "OK" || !data.results?.length) {
            return NextResponse.json({ error: "Not found", status: data.status }, { status: 404 });
        }

        const r = data.results[0];
        const comps: Array<{ long_name: string; short_name: string; types: string[] }> =
            r.address_components || [];

        let resolvedCity = "";
        let resolvedState = "";
        let resolvedCountry = "";
        for (const c of comps) {
            if (c.types.includes("locality")) resolvedCity = c.long_name;
            else if (!resolvedCity && c.types.includes("sublocality_level_1")) resolvedCity = c.long_name;
            else if (!resolvedCity && c.types.includes("administrative_area_level_2")) resolvedCity = c.long_name;
            else if (c.types.includes("administrative_area_level_1")) resolvedState = c.short_name;
            else if (c.types.includes("country")) resolvedCountry = c.short_name;
        }

        return NextResponse.json({
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            city: resolvedCity || city,
            state: resolvedState || state,
            country: resolvedCountry || country,
            formatted: r.formatted_address,
        });
    } catch (err: any) {
        console.error("[api/places/geocode]", err);
        return NextResponse.json({ error: err.message || "Geocode failed" }, { status: 500 });
    }
}
