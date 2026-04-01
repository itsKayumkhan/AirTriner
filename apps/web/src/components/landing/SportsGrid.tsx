"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Sport {
    id: string;
    name: string;
    slug: string;
    image_url?: string;
    icon?: string;
}

const FALLBACK_SPORTS: Sport[] = [
    { id: '1', name: 'Hockey', slug: 'hockey' },
    { id: '2', name: 'Baseball', slug: 'baseball' },
    { id: '3', name: 'Soccer', slug: 'soccer' },
    { id: '4', name: 'Basketball', slug: 'basketball' },
    { id: '5', name: 'Golf', slug: 'golf' },
    { id: '6', name: 'General Fitness', slug: 'fitness' },
    { id: '7', name: 'Tennis', slug: 'tennis' },
    { id: '8', name: 'Swimming', slug: 'swimming' },
]

const SPORT_IMAGES: Record<string, string> = {
    tennis: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&auto=format&fit=crop&q=80",
    soccer: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80",
    basketball: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80",
    football: "https://images.unsplash.com/photo-1566807810030-3eaa60f3e670?w=600&auto=format&fit=crop&q=80",
    baseball: "https://images.unsplash.com/photo-1508344928928-7137b29de216?w=600&auto=format&fit=crop&q=80",
    track: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&auto=format&fit=crop&q=80",
    golf: "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=600&auto=format&fit=crop&q=80",
    swimming: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&auto=format&fit=crop&q=80",
    martial_arts: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&auto=format&fit=crop&q=80",
    boxing: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&auto=format&fit=crop&q=80",
    hockey: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80",
    lacrosse: "https://images.unsplash.com/photo-1589801265819-251f2fbc5304?w=600&auto=format&fit=crop&q=80",
    fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80"
};

export default function SportsGrid() {
    const [sports, setSports] = useState<Sport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSports = async () => {
            try {
                const { data, error } = await supabase
                    .from("sports")
                    .select("*")
                    .eq("is_active", true)
                    .order("name", { ascending: true });

                if (error) throw error;
                if (data && data.length > 0) {
                    setSports(data);
                } else {
                    setSports(FALLBACK_SPORTS);
                }
            } catch (err) {
                console.error("Failed to fetch sports:", err);
                setSports(FALLBACK_SPORTS);
            } finally {
                setLoading(false);
            }
        };

        fetchSports();
    }, []);

    const getSportImg = (sport: Sport) => {
        const s = sport.slug.toLowerCase();
        for (const [k, v] of Object.entries(SPORT_IMAGES)) {
            if (s.includes(k) || k.includes(s)) return v;
        }
        return SPORT_IMAGES["fitness"];
    };

    const getPrimaryImg = (sport: Sport) => {
        if (sport.image_url && sport.image_url.startsWith("http")) return sport.image_url;
        return getSportImg(sport);
    };

    if (loading) {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px", minHeight: "400px" }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{ height: "240px", background: "var(--surface)", borderRadius: "var(--radius-lg)" }}></div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
            {sports.map((sport) => (
                <a key={sport.id} href={`/dashboard/search?sport=${sport.slug}`} style={{
                    position: "relative",
                    height: "240px",
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    textDecoration: "none",
                    display: "block"
                }} className="sport-card">
                    <img
                        src={getPrimaryImg(sport)}
                        alt={sport.name}
                        onError={(e) => { e.currentTarget.src = getSportImg(sport); }}
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            width: "100%", height: "100%", objectFit: "cover",
                            transition: "transform 0.5s ease", zIndex: 0
                        }}
                        className="sport-bg"
                    />
                    <div style={{
                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                        background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.1) 100%)",
                        transition: "background 0.3s ease"
                    }} className="sport-overlay"></div>
                    <div style={{
                        position: "absolute", bottom: "24px", left: "24px", right: "24px", zIndex: 2,
                        display: "flex", justifyContent: "space-between", alignItems: "flex-end"
                    }}>
                        <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>{sport.name}</h3>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-bg)", opacity: 0, transform: "translateX(-10px)", transition: "all 0.3s ease" }} className="sport-arrow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}
