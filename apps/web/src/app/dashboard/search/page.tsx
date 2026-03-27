"use client";

import { useEffect, useState, useMemo } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow } from "@/lib/supabase";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ArrowRight, Search as SearchIcon, MapPin, ChevronLeft, ChevronRight, Star, Download } from "lucide-react";
import { FoundingBadgeTooltip } from "@/components/ui/FoundingBadge";

type TrainerWithUser = TrainerProfileRow & {
    user: { first_name: string; last_name: string; avatar_url: string | null };
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

const getSportImage = (sports: string[]) => {
    if (!sports || sports.length === 0) return SPORT_IMAGES.default[0];
    const sportStr = sports[0].toLowerCase().replace(/\s+&\s+/g, "_and_").replace(/\s+/g, "_");
    const arr = SPORT_IMAGES[sportStr] || SPORT_IMAGES.default;
    return arr[Math.floor(Math.random() * arr.length)];
};

const SPORT_LABELS: Record<string, string> = {
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

export default function SearchTrainersPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [sportFilter, setSportFilter] = useState<string>("All Sports");
    const [maxRate, setMaxRate] = useState<number>(300);
    const [minRating, setMinRating] = useState<number>(0);
    const [locationFilter, setLocationFilter] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("match");
    const [skillFilter, setSkillFilter] = useState<string>("any");
    const [timeFilter, setTimeFilter] = useState<string>("any");
    const [nameFilter, setNameFilter] = useState<string>("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const sportParam = params.get("sport");
            if (sportParam) {
                const matchingKey = Object.keys(SPORT_LABELS).find(
                    k => SPORT_LABELS[k].toLowerCase() === sportParam.toLowerCase() || k === sportParam.toLowerCase()
                );
                if (matchingKey) {
                    setSportFilter(matchingKey);
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
                .single();
            
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
                .select("id, first_name, last_name, avatar_url, role")
                .in("id", userIds);

            const usersMap = new Map((users || []).map((u: { id: string, first_name: string, last_name: string, avatar_url: string | null, role: string }) => [u.id, u]));

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
                    if (athleteProfile.preferredTrainingTimes && p.preferredTrainingTimes) {
                        const timeOverlap = athleteProfile.preferredTrainingTimes.some(t => p.preferredTrainingTimes?.includes(t));
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
                    cover_image: getSportImage(p.sports),
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

    const filteredTrainers = useMemo(() => {
        const result = trainers.filter((t) => {
            if (nameFilter) {
                const fullName = `${t.user?.first_name || ""} ${t.user?.last_name || ""}`.toLowerCase();
                if (!fullName.includes(nameFilter.toLowerCase())) return false;
            }
            if (sportFilter !== "All Sports" && !(t.sports || []).some((s: string) => s.toLowerCase() === sportFilter.toLowerCase())) return false;
            if (Number(t.hourly_rate) > maxRate) return false;
            if (minRating > 0 && t.avg_rating < minRating) return false;
            
            // Exact Filters
            if (skillFilter !== "any" && !t.target_skill_levels?.includes(skillFilter as any)) return false;
            if (timeFilter !== "any" && !t.preferredTrainingTimes?.includes(timeFilter as any)) return false;

            if (locationFilter) {
                const loc = `${t.city || ""} ${t.state || ""}`.toLowerCase();
                if (!loc.includes(locationFilter.toLowerCase())) return false;
            }
            return true;
        });

        switch (sortBy) {
            case "match": result.sort((a, b) => b.matchScore - a.matchScore); break;
            case "price_low": result.sort((a, b) => Number(a.hourly_rate) - Number(b.hourly_rate)); break;
            case "price_high": result.sort((a, b) => Number(b.hourly_rate) - Number(a.hourly_rate)); break;
            case "rating": result.sort((a, b) => b.avg_rating - a.avg_rating); break;
        }

        return result;
    }, [trainers, sportFilter, maxRate, minRating, locationFilter, sortBy, skillFilter, timeFilter, nameFilter]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [sportFilter, maxRate, minRating, locationFilter, sortBy, skillFilter, timeFilter, nameFilter]);

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

    return (
        <div className="max-w-[1400px] mx-auto pb-12">

            {/* Filters Header */}
            <div className="bg-surface border border-white/5 rounded-2xl p-5 mb-8 mt-2 shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-4">

                {/* Name Search */}
                <div>
                    <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Search by Name</label>
                    <div className="relative">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            placeholder="Coach name..."
                            className="w-full bg-[#272A35] text-text-main text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-primary placeholder-gray-600 border-none"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5" />

                {/* Row 1: Sport | Location | Skill | Time */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Sport Discipline</label>
                        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}
                            className="w-full bg-[#272A35] text-text-main text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center" }}>
                            <option value="All Sports">All Sports</option>
                            {Object.entries(SPORT_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Location</label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/40" />
                            <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                                placeholder="City or zip"
                                className="w-full bg-[#272A35] text-text-main text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-primary placeholder-gray-600 border-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Skill Level</label>
                        <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}
                            className="w-full bg-[#272A35] text-text-main text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border-none">
                            <option value="any">Any Level</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                            <option value="pro">Pro</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Time</label>
                        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}
                            className="w-full bg-[#272A35] text-text-main text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border-none">
                            <option value="any">Any Time</option>
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="evening">Evening</option>
                        </select>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5" />

                {/* Row 2: Price Range | Min Rating */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-bold text-text-main/40 uppercase tracking-widest">Price Range</label>
                            <span className="text-primary font-bold text-xs">$0 – ${maxRate}</span>
                        </div>
                        <input type="range" min={20} max={300} step={10} value={maxRate}
                            onChange={(e) => setMaxRate(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-2">Min. Rating</label>
                        <div className="flex gap-2">
                            {[0, 3.5, 4.0, 4.5].map(r => (
                                <button key={r} onClick={() => setMinRating(r)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${minRating === r ? "bg-primary text-bg shadow-[0_0_10px_rgba(69,208,255,0.25)]" : "bg-[#272A35] text-text-main/50 hover:text-text-main"}`}>
                                    {r === 0 ? "Any" : `${r}+`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Results Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-black font-display tracking-wide mb-1 text-text-main">Top Rated Trainers</h1>
                    <p className="text-sm text-text-main/60 font-medium">Showing {filteredTrainers.length} elite trainers {locationFilter ? `in ${locationFilter}` : "available"}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => alert('Exporting CSV data...')}
                        className="flex items-center gap-2 px-4 py-2 bg-[#272A35] hover:bg-white/10 border border-white/5 rounded-xl text-sm font-bold text-white transition-colors"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#272A35] text-text-main text-sm font-semibold rounded-xl px-4 py-2 border border-white/5 outline-none cursor-pointer hover:border-gray-600 transition-colors"
                    >
                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Trainer Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedTrainers.map((trainer) => (
                    <div
                        key={trainer.id}
                        onClick={() => window.location.href = `/dashboard/trainers/${trainer.id}`}
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
                                <div className="bg-primary/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-primary/50 shadow-[0_0_12px_rgba(69,208,255,0.3)]">
                                    <span className="text-primary font-black text-xl leading-none">${Number(trainer.hourly_rate).toFixed(0)}</span>
                                    <span className="text-primary/60 text-[11px] font-bold">/hr</span>
                                </div>
                            </div>

                            {/* Rating — bottom left */}
                            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                <Star className="text-yellow-400 w-4 h-4 fill-current drop-shadow" />
                                <span className="text-white font-black text-sm drop-shadow">{trainer.avg_rating.toFixed(1)}</span>
                                <span className="text-white/50 text-xs">({trainer.review_count})</span>
                            </div>

                            {trainer.is_founding_50 && (
                                <div className="absolute bottom-2.5 right-3">
                                    <FoundingBadgeTooltip size={26} />
                                </div>
                            )}
                        </div>

                        {/* Info area */}
                        <div className="p-4 flex flex-col gap-3">
                            {/* Name */}
                            <h3 className="text-base font-bold text-white leading-tight truncate flex items-center gap-1.5">
                                {trainer.user?.first_name} {trainer.user?.last_name}
                                {trainer.is_founding_50 && <FoundingBadgeTooltip size={16} />}
                            </h3>

                            {/* Sport tags — min-height keeps button aligned */}
                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                {trainer.sports.slice(0, 3).map(sport => (
                                    <span key={sport} className="bg-white/8 border border-white/10 text-white/60 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                                        {SPORT_LABELS[sport] || sport.replace(/_/g, " ")}
                                    </span>
                                ))}
                            </div>

                            {/* Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/trainers/${trainer.id}`; }}
                                className="w-full bg-gradient-to-r from-primary to-[#0090d4] text-bg font-black text-sm px-4 py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_4px_15px_rgba(69,208,255,0.25)]"
                            >
                                View Profile <ArrowRight size={14} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button 
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-10 h-10 rounded-full font-bold text-sm transition-colors flex items-center justify-center ${
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
                        className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
