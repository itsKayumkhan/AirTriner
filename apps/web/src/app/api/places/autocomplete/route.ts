import { NextRequest, NextResponse } from "next/server";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || "";

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q") || "";
    if (!q || q.length < 2 || !GOOGLE_KEY) {
        return NextResponse.json([]);
    }

    try {
        const params = new URLSearchParams({
            input: q,
            types: "(cities)",
            key: GOOGLE_KEY,
            language: "en",
        });

        const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
        );
        const data = await res.json();

        if (data.status !== "OK" || !data.predictions?.length) {
            return NextResponse.json([]);
        }

        return NextResponse.json(
            data.predictions.slice(0, 5).map((p: any) => ({
                placeId: p.place_id,
                description: p.description,
            })),
        );
    } catch {
        return NextResponse.json([]);
    }
}
