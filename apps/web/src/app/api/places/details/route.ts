import { NextRequest, NextResponse } from "next/server";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || "";

export async function GET(req: NextRequest) {
    const placeId = req.nextUrl.searchParams.get("place_id") || "";
    if (!placeId || !GOOGLE_KEY) {
        return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
    }

    try {
        const params = new URLSearchParams({
            place_id: placeId,
            fields: "address_components,geometry,formatted_address",
            key: GOOGLE_KEY,
        });

        const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
        );
        const data = await res.json();

        if (data.status !== "OK" || !data.result) {
            return NextResponse.json({ error: "Place not found" }, { status: 404 });
        }

        const r = data.result;
        const comps = r.address_components || [];
        let city = "", state = "", country = "", zipCode = "";

        for (const c of comps) {
            if (c.types.includes("locality")) city = c.long_name;
            else if (!city && c.types.includes("sublocality_level_1")) city = c.long_name;
            else if (!city && c.types.includes("administrative_area_level_2")) city = c.long_name;
            else if (c.types.includes("administrative_area_level_1")) state = c.short_name;
            else if (c.types.includes("country")) country = c.short_name;
            else if (c.types.includes("postal_code")) zipCode = c.long_name;
        }

        return NextResponse.json({
            city: city || r.formatted_address?.split(",")[0]?.trim() || "",
            state,
            country,
            zipCode,
            lat: r.geometry?.location?.lat || 0,
            lng: r.geometry?.location?.lng || 0,
            displayName: r.formatted_address || "",
        });
    } catch {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
