"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow } from "@/lib/supabase";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ArrowRight, Search as SearchIcon, MapPin, ChevronLeft, ChevronRight, ChevronDown, Star, Download, List, Map as MapIcon } from "lucide-react";
import { FoundingBadge, FoundingBadgeTooltip } from "@/components/ui/FoundingBadge";
import { detectCountry, radiusUnit, formatRadius, miToKm } from "@/lib/units";
import dynamic from "next/dynamic";
import type { TrainerPin } from "@/components/search/FindTrainerMap";
import { formatSportName } from "@/lib/format";
import LocationAutocomplete, { type LocationValue } from "@/components/forms/LocationAutocomplete";
import { normalizeSessionPricing, minEnabledPrice, enabledDurations } from "@/lib/session-pricing";
import { trainerPublicGate } from "@/lib/trainer-gate";

const FindTrainerMap = dynamic(() => import("@/components/search/FindTrainerMap"), { ssr: false });

type TrainerWithUser = TrainerProfileRow & {
    user: { first_name: string; last_name: string; avatar_url: string | null; phone: string | null; date_of_birth: string | null };
    avg_rating: number;
    review_count: number;
    matchScore: number;
    cover_image: string; // assigned randomly based on sport
    dispute_count: number;
    is_performance_verified: boolean;
};

const SPORT_IMAGES: Record<string, string[]> = {
    tennis: [
        "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&auto=format&fit=crop&q=80"
    ],
    soccer: [
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518605368461-1e1296cb32f4?w=600&auto=format&fit=crop&q=80"
    ],
    basketball: [
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1519861531473-920026218d27?w=600&auto=format&fit=crop&q=80"
    ],
    swimming: [
        "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&auto=format&fit=crop&q=80"
    ],
    track_and_field: [
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&auto=format&fit=crop&q=80"
    ],
    hockey: [
        "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80"
    ],
    golf: [
        "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=600&auto=format&fit=crop&q=80"
    ],
    martial_arts: [
        "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&auto=format&fit=crop&q=80"
    ],
    yoga: [ // Using yoga instead of gym specific for mobility/fitness
        "https://images.unsplash.com/photo-1599901860904-17f6b4d05461?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80"
    ],
    default: [
        "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80"
    ]
};

const getSportImage = (sports: string[], slugToImage: Record<string, string> = {}) => {
    if (!sports || sports.length === 0) {
        const fb = SPORT_IMAGES.default;
        return fb[Math.floor(Math.random() * fb.length)];
    }
    // 1. Prefer an admin-uploaded image for any of the trainer's sports.
    for (const s of sports) {
        const slug = s.toLowerCase().replace(/\s+&\s+/g, "_and_").replace(/\s+/g, "_");
        if (slugToImage[slug]) return slugToImage[slug];
        if (slugToImage[s]) return slugToImage[s];
    }
    // 2. Fallback to hardcoded Unsplash safety net.
    const sportStr = sports[0].toLowerCase().replace(/\s+&\s+/g, "_and_").replace(/\s+/g, "_");
    const arr = SPORT_IMAGES[sportStr] || SPORT_IMAGES.default;
    return arr[Math.floor(Math.random() * arr.length)];
};

const FALLBACK_SPORT_LABELS: Record<string, string> = {
    hockey: "Hockey", baseball: "Baseball", basketball: "Basketball",
    football: "Football", soccer: "Soccer", tennis: "Tennis",
    golf: "Golf", swimming: "Swimming", track_and_field: "Track & Field",
    volleyball: "Volleyball", lacrosse: "Lacrosse", wrestling: "Wrestling",
    boxing: "Boxing", martial_arts: "Martial Arts", gymnastics: "Gymnastics"
};

const SORT_OPTIONS = [
    { value: "match", label: "Recommended" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
    { value: "rating", label: "Highest Rated" },
];

// Haversine formula for calculating distance in miles
const calculateDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

function FilterDropdown({ value, onChange, options, active }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    active?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find(o => o.value === value)?.label || options[0].label;

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                    active ? "border-primary/50 text-primary bg-primary/5" : "border-white/[0.08] text-text-main/60 hover:border-white/[0.14] hover:text-text-main"
                }`}
            >
                {current}
                <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1.5 z-[9999] bg-[#13151b] border border-white/[0.10] rounded-2xl shadow-xl overflow-hidden min-w-[160px]">
                    <div className="overflow-y-auto max-h-[220px] py-1">
                        {options.map(o => (
                            <button
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                    value === o.value
                                        ? "text-white font-semibold bg-white/[0.06]"
                                        : "text-text-main/60 hover:text-text-main hover:bg-white/[0.04] font-medium"
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SearchTrainersPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [sportLabels, setSportLabels] = useState<Record<string, string>>(FALLBACK_SPORT_LABELS);
    const [sportsOptions, setSportsOptions] = useState<{ value: string; label: string }[]>(
        Object.entries(FALLBACK_SPORT_LABELS).map(([v, l]) => ({ value: v, label: l }))
    );

    // Filters
    const [sportFilter, setSportFilter] = useState<string>("All Sports");
    const [maxRate, setMaxRate] = useState<number>(300);
    const [minRating, setMinRating] = useState<number>(0);
    const [locationFilter, setLocationFilter] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("match");
    const [skillFilter, setSkillFilter] = useState<string>("any");
    const [timeFilter, setTimeFilter] = useState<string>("any");
    const [nameFilter, setNameFilter] = useState<string>("");
    const [durationFilter, setDurationFilter] = useState<number | null>(null);

    // Radius search (Issue C)
    // radiusKm === null means "Any distance" (no radius filter)
    const [radiusKm, setRadiusKm] = useState<number | null>(null);
    const [radiusLocation, setRadiusLocation] = useState<LocationValue>(null);

    // Admin-uploaded sport images (Issue A)
    const [slugToImage, setSlugToImage] = useState<Record<string, string>>({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // View toggle: list | map
    const [viewMode, setViewMode] = useState<"list" | "map">("list");

    // Mobile filter visibility
    const [showFilters, setShowFilters] = useState(false);

    // Country detection for radius unit display
    const athleteZip = user?.athleteProfile?.zip_code || "";
    const athleteCountry = athleteZip ? detectCountry(athleteZip) : ("US" as const);
    const unit = radiusUnit(athleteCountry);
    const athleteLat = user?.athleteProfile?.latitude ?? undefined;
    const athleteLng = user?.athleteProfile?.longitude ?? undefined;

    useEffect(() => {
        const fetchSports = async () => {
            const { data, error } = await supabase
                .from("sports")
                .select("id, name, slug, image_url")
                .eq("is_active", true)
                .order("name");
            if (!error && data && data.length > 0) {
                const labels: Record<string, string> = {};
                const options: { value: string; label: string }[] = [];
                const imageMap: Record<string, string> = {};
                (data as { id: string; name: string; slug: string; image_url: string | null }[]).forEach((s) => {
                    labels[s.slug] = s.name;
                    options.push({ value: s.slug, label: s.name });
                    if (s.image_url) imageMap[s.slug] = s.image_url;
                });
                setSportLabels(labels);
                setSportsOptions(options);
                setSlugToImage(imageMap);
            }
        };

        fetchSports();

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const sportParam = params.get("sport");
            if (sportParam) {
                // Will be re-evaluated once sportLabels state settles; attempt immediate match too
                const matchingKey = Object.keys(FALLBACK_SPORT_LABELS).find(
                    k => FALLBACK_SPORT_LABELS[k].toLowerCase() === sportParam.toLowerCase() || k === sportParam.toLowerCase()
                );
                if (matchingKey) {
                    setSportFilter(matchingKey);
                } else {
                    // Try matching by slug directly
                    setSportFilter(sportParam.toLowerCase());
                }
            }
        }

        const session = getSession();
        if (session) {
            setUser(session);
            loadTrainers(session);
        }
    }, []);

    const loadTrainers = async (session: AuthUser) => {
        try {
            // 1. Fetch Platform Settings
            const { data: settings } = await supabase
                .from("platform_settings")
                .select("require_trainer_verification")
                .maybeSingle();
            
            const requireVerification = settings?.require_trainer_verification ?? true;

            // 2. Fetch Trainer Profiles
            let query = supabase
                .from("trainer_profiles")
                .select("*, is_founding_50")
                .in("subscription_status", ["trial", "active"]);
            
            // Apply verification filter if required
            if (requireVerification) {
                query = query.eq("verification_status", "verified");
            }

            const { data: profiles } = await query;

            if (!profiles || profiles.length === 0) { setTrainers([]); setLoading(false); return; }

            const userIds = profiles.map((p: TrainerProfileRow) => p.user_id);
            const { data: users } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url, role, phone, date_of_birth, is_suspended, deleted_at")
                .in("id", userIds);

            const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

            // 4. Fetch Disputes for verification logic (Feature 7.2)
            const { data: disputesData } = await supabase
                .from("disputes")
                .select("booking:bookings!inner(trainer_id)")
                .in("booking.trainer_id", userIds);
            
            const disputeCounts = new Map<string, number>();
            (disputesData || []).forEach((d: any) => {
                const tid = d.booking.trainer_id;
                disputeCounts.set(tid, (disputeCounts.get(tid) || 0) + 1);
            });

            // Calculate match scores
            const athleteProfile = session.athleteProfile;
            const enriched: TrainerWithUser[] = (profiles as TrainerProfileRow[])
                .filter(p => {
                    const u = usersMap.get(p.user_id);
                    return u?.role === "trainer"; // Only show actual trainers, matching admin panel
                })
                .map((p) => {
                const disputeCount = disputeCounts.get(p.user_id) || 0;
                
                // Feature 7.2 Verification Logic:
                // 3+ sessions, no disputes, 95%+ completion/reliability
                const isPerformanceVerified = 
                    p.total_sessions >= 3 && 
                    disputeCount === 0 && 
                    Number(p.completion_rate) >= 95 && 
                    Number(p.reliability_score) >= 95;

                let matchScore = 50;
                
                if (athleteProfile) {
                    // Sport overlap
                    const sportOverlap = (athleteProfile.sports || []).filter((s: string) => (p.sports || []).includes(s));
                    if (sportOverlap.length > 0) matchScore += 20;

                    // Location / Distance Match
                    const distance = calculateDistance(
                        athleteProfile.latitude, athleteProfile.longitude,
                        p.latitude, p.longitude
                    );
                    
                    if (athleteProfile.city && p.city && athleteProfile.city.toLowerCase() === p.city.toLowerCase()) {
                        matchScore += 15; // Exact city match
                    } else if (distance <= (p.travel_radius_miles || 20)) {
                        matchScore += 10; // Within travel radius
                    } else if (distance <= 50) {
                        matchScore += 5; // Nearby
                    }

                    // Skill Level Match
                    if (athleteProfile.skill_level && p.target_skill_levels?.includes(athleteProfile.skill_level)) {
                        matchScore += 10;
                    }

                    // Availability Match (Optional check if athlete has preferred times)
                    if (athleteProfile.preferred_training_times && p.preferred_training_times) {
                        const timeOverlap = athleteProfile.preferred_training_times.some((t: string) => p.preferred_training_times?.includes(t as any));
                        if (timeOverlap) matchScore += 10;
                    }
                }

                const rating = p.average_rating || 0;
                if (rating >= 4.8) matchScore += 10;
                else if (rating >= 4.5) matchScore += 5;

                return {
                    ...p,
                    user: usersMap.get(p.user_id) as TrainerWithUser["user"],
                    avg_rating: rating,
                    review_count: p.total_reviews || 0,
                    matchScore: Math.min(100, matchScore),
                    cover_image: getSportImage(p.sports, slugToImage),
                    dispute_count: disputeCount,
                    is_performance_verified: isPerformanceVerified
                };
            });

            setTrainers(enriched);
        } catch (err) {
            console.error("Failed to load trainers:", err);
        } finally {
            setLoading(false);
        }
    };

    // Re-assign cover images when admin-uploaded sport image map becomes available
    // (sports fetch and trainer fetch happen in parallel — trainers may load first)
    useEffect(() => {
        if (Object.keys(slugToImage).length === 0) return;
        setTrainers((prev) => prev.map((t) => ({
            ...t,
            cover_image: getSportImage(t.sports, slugToImage),
        })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slugToImage]);

    const normalizeSport = (s: string) => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');

    // Resolve radius search center point: explicit typed location > athlete profile
    const radiusCenterLat = radiusLocation?.lat ?? user?.athleteProfile?.latitude ?? null;
    const radiusCenterLng = radiusLocation?.lng ?? user?.athleteProfile?.longitude ?? null;
    const radiusEnabled = radiusKm !== null && radiusCenterLat !== null && radiusCenterLng !== null;

    const filteredTrainers = useMemo(() => {
        const result = trainers.filter((t) => {
            // Single source of truth: enforces verification + active subscription
            // + profile completeness + user-active (not suspended / not soft-deleted).
            const gate = trainerPublicGate({ user: t.user as any, trainerProfile: t as any });
            if (!gate.ok) return false;

            if (nameFilter) {
                const fullName = `${t.user?.first_name || ""} ${t.user?.last_name || ""}`.toLowerCase();
                if (!fullName.includes(nameFilter.toLowerCase())) return false;
            }
            if (sportFilter !== "All Sports" && !(t.sports || []).some((s: string) => normalizeSport(s) === normalizeSport(sportFilter))) return false;
            const tMinPrice = minEnabledPrice(normalizeSessionPricing(t.session_pricing, t.hourly_rate)) ?? Number(t.hourly_rate);
            if (tMinPrice > maxRate) return false;
            if (minRating > 0 && t.avg_rating < minRating) return false;

            // Exact Filters
            if (skillFilter !== "any" && !t.target_skill_levels?.includes(skillFilter as any)) return false;
            if (timeFilter !== "any" && !t.preferred_training_times?.includes(timeFilter as any)) return false;
            if (durationFilter !== null && !t.session_lengths?.includes(durationFilter)) return false;

            if (locationFilter) {
                const loc = `${t.city || ""} ${t.state || ""}`.toLowerCase();
                if (!loc.includes(locationFilter.toLowerCase())) return false;
            }

            // Radius filter (Issue C) — Haversine distance in km
            if (radiusEnabled && radiusKm !== null) {
                if (!t.latitude || !t.longitude) return false;
                const miles = calculateDistance(radiusCenterLat, radiusCenterLng, t.latitude, t.longitude);
                const km = miles * 1.60934;
                if (km > radiusKm) return false;
            }
            return true;
        });

        switch (sortBy) {
            case "match": result.sort((a, b) => b.matchScore - a.matchScore); break;
            case "price_low": result.sort((a, b) => {
                const ap = minEnabledPrice(normalizeSessionPricing(a.session_pricing, a.hourly_rate)) ?? Number(a.hourly_rate);
                const bp = minEnabledPrice(normalizeSessionPricing(b.session_pricing, b.hourly_rate)) ?? Number(b.hourly_rate);
                return ap - bp;
            }); break;
            case "price_high": result.sort((a, b) => {
                const ap = minEnabledPrice(normalizeSessionPricing(a.session_pricing, a.hourly_rate)) ?? Number(a.hourly_rate);
                const bp = minEnabledPrice(normalizeSessionPricing(b.session_pricing, b.hourly_rate)) ?? Number(b.hourly_rate);
                return bp - ap;
            }); break;
            case "rating": result.sort((a, b) => b.avg_rating - a.avg_rating); break;
        }

        // Founding 50 trainers always appear at the top, preserving sort order within each group
        result.sort((a, b) => {
            const aFounder = a.is_founding_50 ? 1 : 0;
            const bFounder = b.is_founding_50 ? 1 : 0;
            return bFounder - aFounder;
        });

        return result;
    }, [trainers, sportFilter, maxRate, minRating, locationFilter, sortBy, skillFilter, timeFilter, nameFilter, durationFilter, radiusEnabled, radiusKm, radiusCenterLat, radiusCenterLng]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [sportFilter, maxRate, minRating, locationFilter, sortBy, skillFilter, timeFilter, nameFilter, durationFilter, radiusKm, radiusCenterLat, radiusCenterLng]);

    const totalPages = Math.ceil(filteredTrainers.length / itemsPerPage);
    const paginatedTrainers = filteredTrainers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const activeFiltersCount = [sportFilter !== "All Sports", locationFilter, skillFilter !== "any", timeFilter !== "any", minRating > 0, maxRate < 300, durationFilter !== null, radiusKm !== null].filter(Boolean).length

    const clearAll = () => { setSportFilter("All Sports"); setLocationFilter(""); setSkillFilter("any"); setTimeFilter("any"); setMinRating(0); setMaxRate(300); setNameFilter(""); setDurationFilter(null); setRadiusKm(null); setRadiusLocation(null); }

    return (
        <div className="max-w-[1400px] mx-auto pb-12">

            {/* ── Search header ── */}
            <div className="mb-6 mt-1 space-y-4 relative z-[1000]">

                {/* Title row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">Find a Coach</h1>
                        <p className="text-text-main/35 text-sm mt-0.5">
                            {filteredTrainers.length} coach{filteredTrainers.length !== 1 ? "es" : ""} available
                            {locationFilter ? ` · ${locationFilter}` : ""}
                        </p>
                    </div>
                    {activeFiltersCount > 0 && (
                        <button onClick={clearAll}
                            className="flex items-center gap-2 text-xs font-bold text-text-main/40 hover:text-red-400 transition-colors">
                            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center font-black">{activeFiltersCount}</span>
                            Reset
                        </button>
                    )}
                </div>

                {/* Big search bar + mobile filter toggle */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <SearchIcon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/25 pointer-events-none" />
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            placeholder="Search coaches by name…"
                            className="w-full bg-surface border border-white/[0.08] text-text-main text-base rounded-2xl
                                       pl-14 pr-12 py-4 placeholder-text-main/20 outline-none
                                       focus:border-white/20 transition-colors"
                        />
                        {nameFilter && (
                            <button onClick={() => setNameFilter("")}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/[0.06]
                                           text-text-main/40 hover:bg-white/[0.12] hover:text-text-main transition-all
                                           flex items-center justify-center text-sm">
                                ×
                            </button>
                        )}
                    </div>
                    {/* Mobile-only filters toggle */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`sm:hidden inline-flex items-center gap-1.5 px-4 py-4 rounded-2xl border text-sm font-bold transition-all ${
                            showFilters || activeFiltersCount > 0
                                ? "border-primary/50 text-primary bg-primary/5"
                                : "border-white/[0.08] text-text-main/60 bg-surface"
                        }`}
                    >
                        Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
                    </button>
                </div>

                {/* Filter pill row — always visible on sm+, collapsible on mobile */}
                <div className={`flex items-center gap-2 flex-wrap ${showFilters ? "flex" : "hidden sm:flex"}`}>

                    {/* Sport */}
                    <FilterDropdown
                        value={sportFilter}
                        onChange={setSportFilter}
                        active={sportFilter !== "All Sports"}
                        options={[{ value: "All Sports", label: "All Sports" }, ...sportsOptions]}
                    />

                    {/* Location (text filter — matches trainer city/state) */}
                    <div className="relative">
                        <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-main/30 pointer-events-none" />
                        <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                            placeholder="Location"
                            className={`bg-surface border text-sm font-medium rounded-full pl-9 pr-4 py-2 outline-none transition-all w-36
                                       placeholder-text-main/30
                                       ${locationFilter ? "border-primary/50 text-primary bg-primary/5" : "border-white/[0.08] text-text-main/60 hover:border-white/[0.14] focus:border-white/20"}`} />
                    </div>

                    {/* Radius search (Issue C) */}
                    {(() => {
                        const hasProfileLatLng = athleteLat !== undefined && athleteLng !== undefined;
                        const hasCenter = radiusLocation !== null || hasProfileLatLng;
                        return (
                            <div className="flex items-center gap-2" title={!hasCenter ? "Set your location in profile to search by radius" : undefined}>
                                <FilterDropdown
                                    value={radiusKm === null ? "any" : String(radiusKm)}
                                    onChange={(v) => setRadiusKm(v === "any" ? null : Number(v))}
                                    active={radiusKm !== null}
                                    options={[
                                        { value: "any", label: hasCenter ? "Any distance" : "Radius (set location)" },
                                        { value: "5", label: "Within 5 km" },
                                        { value: "10", label: "Within 10 km" },
                                        { value: "25", label: "Within 25 km" },
                                        { value: "50", label: "Within 50 km" },
                                        { value: "100", label: "Within 100 km" },
                                    ]}
                                />
                                {radiusKm !== null && (
                                    <div className="w-48">
                                        <LocationAutocomplete
                                            value={radiusLocation}
                                            onChange={setRadiusLocation}
                                            placeholder={hasProfileLatLng ? "Using profile location" : "Search near..."}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Skill */}
                    <FilterDropdown
                        value={skillFilter}
                        onChange={setSkillFilter}
                        active={skillFilter !== "any"}
                        options={[
                            { value: "any", label: "Skill Level" },
                            { value: "beginner", label: "Beginner" },
                            { value: "intermediate", label: "Intermediate" },
                            { value: "advanced", label: "Advanced" },
                            { value: "pro", label: "Pro" },
                        ]}
                    />

                    {/* Time */}
                    <FilterDropdown
                        value={timeFilter}
                        onChange={setTimeFilter}
                        active={timeFilter !== "any"}
                        options={[
                            { value: "any", label: "Any Time" },
                            { value: "morning", label: "Morning" },
                            { value: "afternoon", label: "Afternoon" },
                            { value: "evening", label: "Evening" },
                        ]}
                    />

                    {/* Price */}
                    <FilterDropdown
                        value={String(maxRate)}
                        onChange={(v) => setMaxRate(Number(v))}
                        active={maxRate < 300}
                        options={[
                            { value: "300", label: "Any Price" },
                            { value: "50", label: "Under $50/hr" },
                            { value: "100", label: "Under $100/hr" },
                            { value: "150", label: "Under $150/hr" },
                            { value: "200", label: "Under $200/hr" },
                        ]}
                    />

                    {/* Rating pills */}
                    <div className="flex items-center gap-1 bg-surface border border-white/[0.08] rounded-full p-1">
                        {[{ val: 0, label: "Any" }, { val: 3.5, label: "3.5 ★" }, { val: 4.0, label: "4.0 ★" }, { val: 4.5, label: "4.5 ★" }].map(r => (
                            <button key={r.val} onClick={() => setMinRating(r.val)}
                                className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-150
                                    ${minRating === r.val
                                        ? "bg-white/[0.10] text-text-main"
                                        : "text-text-main/35 hover:text-text-main/60"
                                    }`}>
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Duration */}
                    <div className="flex flex-wrap gap-1 items-center bg-surface border border-white/8 rounded-full p-1">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-2">Dur:</span>
                        {([null, 30, 45, 60, 90] as (number | null)[]).map(d => (
                            <button
                                key={d ?? 'all'}
                                onClick={() => setDurationFilter(d)}
                                className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-150 ${
                                    durationFilter === d
                                        ? 'bg-white/[0.10] text-text-main'
                                        : 'text-text-main/35 hover:text-text-main/60'
                                }`}
                            >
                                {d === null ? 'Any' : d < 60 ? `${d}m` : d === 60 ? '1h' : '1.5h'}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="h-5 w-px bg-white/[0.08] mx-1 hidden sm:block" />

                    {/* Sort */}
                    <div className="ml-auto">
                        <FilterDropdown
                            value={sortBy}
                            onChange={setSortBy}
                            options={SORT_OPTIONS}
                        />
                    </div>
                </div>
            </div>

            {/* View toggle: List | Map */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-[3px]">
                    <button
                        onClick={() => setViewMode("list")}
                        className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] rounded-[13px] transition-all duration-300 ${
                            viewMode === "list"
                                ? "bg-primary text-[#0A0D14] shadow-[0_0_20px_rgba(69,208,255,0.25)]"
                                : "text-white/35 hover:text-white/60"
                        }`}
                    >
                        <List size={14} /> List
                    </button>
                    <button
                        onClick={() => setViewMode("map")}
                        className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] rounded-[13px] transition-all duration-300 ${
                            viewMode === "map"
                                ? "bg-primary text-[#0A0D14] shadow-[0_0_20px_rgba(69,208,255,0.25)]"
                                : "text-white/35 hover:text-white/60"
                        }`}
                    >
                        <MapIcon size={14} /> Map
                    </button>
                </div>
                {viewMode === "map" && (() => {
                    const withCoords = filteredTrainers.filter(t => t.latitude && t.longitude).length;
                    const withoutCoords = filteredTrainers.length - withCoords;
                    return (
                        <p className="text-xs text-white/40 font-medium">
                            {withCoords} trainer{withCoords !== 1 ? "s" : ""} shown on map
                            {withoutCoords > 0 && (
                                <span className="text-white/25">
                                    {" "}· {withoutCoords} trainer{withoutCoords !== 1 ? "s" : ""} don&apos;t have a precise location yet
                                </span>
                            )}
                        </p>
                    );
                })()}
            </div>

            {/* Map View */}
            {viewMode === "map" && (
                <FindTrainerMap
                    trainers={filteredTrainers
                        .filter((t) => t.latitude && t.longitude)
                        .map((t) => ({
                            id: t.id,
                            name: `${t.user?.first_name || ""} ${t.user?.last_name || ""}`.trim(),
                            sport: (t.sports || []).map((s: string) => sportLabels[s] || formatSportName(s)).join(", "),
                            rating: t.avg_rating,
                            reviewCount: t.review_count,
                            hourlyRate: minEnabledPrice(normalizeSessionPricing(t.session_pricing, t.hourly_rate)) ?? Number(t.hourly_rate),
                            lat: t.latitude!,
                            lng: t.longitude!,
                            avatarUrl: t.user?.avatar_url || undefined,
                        } as TrainerPin))}
                    centerLat={athleteLat}
                    centerLng={athleteLng}
                    onTrainerClick={(id) => router.push(`/dashboard/trainers/${id}`)}
                />
            )}

            {/* Trainer Grid */}
            {viewMode === "list" && (<><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedTrainers.map((trainer) => (
                    <div
                        key={trainer.id}
                        onClick={() => router.push(`/dashboard/trainers/${trainer.id}`)}
                        className="bg-[#13151b] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(69,208,255,0.06)] transition-all duration-300 cursor-pointer"
                    >
                        {/* Image area */}
                        <div className="h-[200px] relative overflow-hidden bg-[#0d0f14]">
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                style={{ backgroundImage: `url(${trainer.cover_image})` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

                            {/* Status badge — top left */}
                            <div className="absolute top-3 left-3">
                                {trainer.is_performance_verified ? (
                                    <span className="bg-primary text-bg text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg">Verified</span>
                                ) : trainer.total_sessions > 0 ? (
                                    <span className="bg-blue-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg">Pro</span>
                                ) : (
                                    <span className="bg-white/20 backdrop-blur text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg">New</span>
                                )}
                            </div>

                            {/* Price — top right, highlighted */}
                            <div className="absolute top-3 right-3">
                                {(() => {
                                    const pricing = normalizeSessionPricing(trainer.session_pricing, trainer.hourly_rate);
                                    const enabled = enabledDurations(pricing);
                                    const minPrice = minEnabledPrice(pricing) ?? Number(trainer.hourly_rate);
                                    const multiple = enabled.length > 1;
                                    return (
                                        <div className="bg-primary/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-primary/50 shadow-[0_0_12px_rgba(69,208,255,0.3)]">
                                            {multiple && <span className="text-primary/70 text-[10px] font-bold mr-1">from</span>}
                                            <span className="text-primary font-black text-xl leading-none">${Number(minPrice).toFixed(0)}</span>
                                            {!multiple && <span className="text-primary/60 text-[11px] font-bold">/1hr</span>}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Rating — bottom left */}
                            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                <Star className="text-yellow-400 w-4 h-4 fill-current drop-shadow" />
                                <span className="text-white font-black text-sm drop-shadow">{trainer.avg_rating.toFixed(1)}</span>
                                <span className="text-white/50 text-xs">({trainer.review_count})</span>
                            </div>

                            {trainer.is_founding_50 && (
                                <div className="absolute bottom-2.5 right-3">
                                    <FoundingBadge size={26} />
                                </div>
                            )}
                        </div>

                        {/* Info area */}
                        <div className="p-4 flex flex-col gap-3">
                            {/* Name */}
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="text-base font-bold text-white leading-tight truncate">
                                    {trainer.user?.first_name} {trainer.user?.last_name}
                                </h3>
                                {trainer.is_founding_50 && <FoundingBadgeTooltip size={18} />}
                                {radiusCenterLat !== null && radiusCenterLng !== null && trainer.latitude && trainer.longitude && (() => {
                                    const miles = calculateDistance(radiusCenterLat, radiusCenterLng, trainer.latitude, trainer.longitude);
                                    if (miles >= 9999) return null;
                                    const km = miles * 1.60934;
                                    const display = unit === "km" ? `${km.toFixed(km < 10 ? 1 : 0)} km` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
                                    return (
                                        <span className="ml-auto text-[10px] font-bold text-primary/80 whitespace-nowrap">
                                            {display} away
                                        </span>
                                    );
                                })()}
                            </div>

                            {/* Sport tags — min-height keeps button aligned */}
                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                {trainer.sports.slice(0, 3).map(sport => (
                                    <span key={sport} className="bg-white/8 border border-white/10 text-white/60 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                                        {sportLabels[sport] || formatSportName(sport)}
                                    </span>
                                ))}
                            </div>

                            {/* Session lengths */}
                            {trainer.session_lengths?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {[...trainer.session_lengths].sort((a, b) => a - b).map(d => (
                                        <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-white/50 border border-white/8">
                                            {d < 60 ? `${d}m` : d === 60 ? '1h' : d === 90 ? '1.5h' : `${d/60}h`}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/trainers/${trainer.id}`); }}
                                className="w-full bg-gradient-to-r from-primary to-[#0090d4] text-bg font-black text-sm px-4 py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_4px_15px_rgba(69,208,255,0.25)]"
                            >
                                View Profile <ArrowRight size={14} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full font-bold text-sm transition-colors flex items-center justify-center ${
                                currentPage === i + 1
                                ? "bg-primary text-bg shadow-[0_0_10px_rgba(69,208,255,0.2)]"
                                : "text-text-main/60 hover:text-text-main border border-transparent hover:border-white/5"
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
            </>)}
        </div>
    );
}
