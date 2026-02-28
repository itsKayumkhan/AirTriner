"use client";

import { useEffect, useState, useMemo } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow } from "@/lib/supabase";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ArrowRight, Search as SearchIcon, MapPin, ChevronLeft, ChevronRight, Star } from "lucide-react";

type TrainerWithUser = TrainerProfileRow & {
    user: { first_name: string; last_name: string; avatar_url: string | null };
    avg_rating: number;
    review_count: number;
    matchScore: number;
    cover_image: string; // assigned randomly based on sport
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

export default function SearchTrainersPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [sportFilter, setSportFilter] = useState<string>("All Sports");
    const [maxRate, setMaxRate] = useState<number>(300);
    const [minRating, setMinRating] = useState<number>(4.5);
    const [locationFilter, setLocationFilter] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("match");

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
            const { data: profiles } = await supabase
                .from("trainer_profiles")
                .select("*")
                .in("subscription_status", ["trial", "active"]);

            if (!profiles || profiles.length === 0) { setTrainers([]); setLoading(false); return; }

            const userIds = profiles.map((p: TrainerProfileRow) => p.user_id);
            const { data: users } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url")
                .in("id", userIds);

            const { data: reviews } = await supabase
                .from("reviews")
                .select("reviewee_id, rating")
                .in("reviewee_id", userIds);

            const usersMap = new Map((users || []).map((u: { id: string, first_name: string, last_name: string, avatar_url: string | null }) => [u.id, u]));

            const ratingMap = new Map<string, { sum: number; count: number }>();
            (reviews || []).forEach((r: { reviewee_id: string, rating: number }) => {
                const existing = ratingMap.get(r.reviewee_id) || { sum: 0, count: 0 };
                ratingMap.set(r.reviewee_id, { sum: existing.sum + r.rating, count: existing.count + 1 });
            });

            // Calculate match scores
            const athleteProfile = session.athleteProfile;
            const enriched: TrainerWithUser[] = (profiles as TrainerProfileRow[]).map((p) => {
                let matchScore = 50;
                if (athleteProfile) {
                    const sportOverlap = (athleteProfile.sports || []).filter((s: string) => (p.sports || []).includes(s));
                    if (sportOverlap.length > 0) matchScore += 30;
                    if (athleteProfile.city && p.city && athleteProfile.city.toLowerCase() === p.city.toLowerCase()) matchScore += 15;
                }

                return {
                    ...p,
                    user: usersMap.get(p.user_id) as TrainerWithUser["user"],
                    avg_rating: ratingMap.has(p.user_id)
                        ? Math.round((ratingMap.get(p.user_id)!.sum / ratingMap.get(p.user_id)!.count) * 10) / 10
                        : (4.5 + Math.random() * 0.5), // Fallback rating for demo
                    review_count: ratingMap.get(p.user_id)?.count || Math.floor(Math.random() * 200) + 10,
                    matchScore: Math.min(100, matchScore),
                    cover_image: getSportImage(p.sports)
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
            if (sportFilter !== "All Sports" && !(t.sports || []).some((s: string) => s.toLowerCase() === sportFilter.toLowerCase())) return false;
            if (Number(t.hourly_rate) > maxRate) return false;
            if (minRating > 0 && t.avg_rating < minRating) return false;
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
    }, [trainers, sportFilter, maxRate, minRating, locationFilter, sortBy]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [sportFilter, maxRate, minRating, locationFilter, sortBy]);

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

            {/* Filters Header (Dark style) */}
            <div className="bg-surface border border-white/5 rounded-2xl p-6 mb-8 mt-2 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="flex flex-wrap lg:flex-nowrap gap-8">

                    {/* Sport Discipline */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-3">Sport Discipline</label>
                        <select
                            value={sportFilter}
                            onChange={(e) => setSportFilter(e.target.value)}
                            className="w-full bg-[#272A35] border-none text-text-main text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center" }}
                        >
                            <option value="All Sports">All Sports</option>
                            {Object.entries(SPORT_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Location */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-3">Location</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/60" />
                            <input
                                type="text"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                placeholder="Enter city or zip"
                                className="w-full bg-[#272A35] border-none text-text-main text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-primary placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {/* Price Range */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest">Price Range</label>
                            <span className="text-secondary font-bold text-xs">$0 - ${maxRate}</span>
                        </div>
                        <input
                            type="range" min={20} max={300} step={10}
                            value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* Min Rating */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-widest mb-3">Min. Rating</label>
                        <div className="flex gap-2">
                            {[4.5, 4.0, 3.5].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setMinRating(r)}
                                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors ${minRating === r ? "bg-primary text-bg shadow-[0_0_10px_rgba(163,255,18,0.3)]" : "bg-[#272A35] text-text-main/60 hover:text-text-main"}`}
                                >
                                    {r}+ {minRating === r && "★"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedTrainers.map((trainer, idx) => (
                    <div key={trainer.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden group hover:border-gray-600 transition-colors flex flex-col">

                        {/* Image area */}
                        <div className="h-[280px] relative overflow-hidden bg-gray-900">
                            {/* Base Image */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                style={{ backgroundImage: `url(${trainer.cover_image})` }}
                            />
                            {/* Overlay Gradient to make bottom text readable */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1D23] via-transparent to-transparent opacity-90" />

                            {/* Top left badge */}
                            <div className="absolute top-4 left-4">
                                {idx % 3 === 0 ? (
                                    <span className="bg-primary text-bg text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(163,255,18,0.4)]">Elite</span>
                                ) : trainer.is_verified ? (
                                    <span className="bg-emerald-400 text-bg text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(52,211,153,0.4)]">Verified</span>
                                ) : (
                                    <span className="bg-blue-400 text-bg text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(96,165,250,0.4)]">New</span>
                                )}
                            </div>

                            {/* Rating badge bottom left above info */}
                            <div className="absolute bottom-4 left-4 flex items-center gap-1.5 z-10">
                                <Star className="text-primary w-4 h-4 fill-current" />
                                <span className="text-text-main font-bold text-sm tracking-wide">{trainer.avg_rating.toFixed(1)}</span>
                                <span className="text-text-main/60 text-xs">({trainer.review_count})</span>
                            </div>
                        </div>

                        {/* Info area */}
                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-lg font-bold text-text-main tracking-tight">{trainer.user?.first_name} {trainer.user?.last_name}</h3>
                                <div className="text-right">
                                    <span className="text-primary font-black text-lg">${Number(trainer.hourly_rate).toFixed(0)}</span>
                                    <span className="text-text-main/40 text-[10px] font-bold uppercase ml-1 tracking-widest">/hr</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {trainer.sports.slice(0, 3).map(sport => (
                                    <span key={sport} className="bg-[#272A35] text-text-main/80 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                                        {SPORT_LABELS[sport] || sport.replace(/_/g, " ")}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-auto">
                                <button
                                    onClick={() => window.location.href = `/dashboard/trainers/${trainer.id}`}
                                    className="w-full bg-white text-bg font-black text-xs px-4 py-3.5 rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                                >
                                    View Profile <ArrowRight size={14} strokeWidth={3} />
                                </button>
                            </div>
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
                                ? "bg-primary text-bg shadow-[0_0_10px_rgba(163,255,18,0.2)]" 
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
