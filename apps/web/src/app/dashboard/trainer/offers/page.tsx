"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Send, Users, Plus, X, Clock, MapPin, DollarSign, Star, ChevronRight, Filter, Search, Calendar, MessageSquare, Zap, Award, PartyPopper, Lock, Crown, Trash2, Repeat } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { formatSportName } from "@/lib/format";

interface Athlete {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    athlete_profile: {
        sports: string[];
        skill_level: string;
        address_line1: string | null;
        city: string | null;
        state: string | null;
    } | null;
}

interface Offer {
    id: string;
    athlete_id: string;
    athlete_name: string;
    sport: string;
    message: string;
    session_type: string;
    rate: number;
    status: "pending" | "accepted" | "declined";
    created_at: string;
}

export default function TrainingOffersPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [showNewOffer, setShowNewOffer] = useState(false);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sending, setSending] = useState(false);
    const [offerError, setOfferError] = useState("");
    const [tab, setTab] = useState<"athletes" | "sent">("athletes");

    // Cancel Modal State
    const [offerToCancel, setOfferToCancel] = useState<string | null>(null);
    const [isCanceling, setIsCanceling] = useState(false);

    // Camps
    const [camps, setCamps] = useState<Array<{ name: string; hoursPerDay: number; days: number; totalPrice: number; location: string; startTime: string; endTime: string; dates: string[]; maxSpots: number; spotsRemaining: number }>>([]);
    const [selectedCamp, setSelectedCamp] = useState<number | null>(null);

    const [offerData, setOfferData] = useState({
        message: "",
        sessionType: "private",
        rate: "",
        introDiscount: false,
        discountPercent: "20",
        sessionDates: [{ date: "", time: "" }] as { date: string; time: string }[],
        sport: "",
    });

    useEffect(() => {
        const session = getSession();
        if (!session || session.role !== "trainer") {
            router.push("/dashboard");
            return;
        }
        setUser(session);
        loadData(session);
        loadSubscriptionStatus(session.id);
    }, [router]);

    const loadSubscriptionStatus = async (userId: string) => {
        const { data } = await supabase
            .from("trainer_profiles")
            .select("subscription_status")
            .eq("user_id", userId)
            .single();
        setSubscriptionStatus(data?.subscription_status ?? null);
    };

    const isSubscriptionActive = subscriptionStatus === "active" || subscriptionStatus === "trial";

    const loadData = async (session: AuthUser) => {
        try {
            // Load trainer's camp offerings
            const { data: trainerProfile } = await supabase
                .from("trainer_profiles")
                .select("camp_offerings")
                .eq("user_id", session.id)
                .maybeSingle();
            if (trainerProfile?.camp_offerings && Array.isArray(trainerProfile.camp_offerings)) {
                setCamps(trainerProfile.camp_offerings);
            }

            // Load athletes
            const { data: athleteData } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url, athlete_profiles(sports, skill_level, address_line1, city, state)")
                .eq("role", "athlete")
                .limit(50);

            if (athleteData) {
                setAthletes(athleteData.map((a: Record<string, unknown>) => ({
                    id: a.id as string,
                    first_name: a.first_name as string,
                    last_name: a.last_name as string,
                    avatar_url: a.avatar_url as string | null,
                    athlete_profile: a.athlete_profiles 
                        ? (Array.isArray(a.athlete_profiles) ? a.athlete_profiles[0] : a.athlete_profiles) as Athlete['athlete_profile']
                        : null,
                })));
            }

            // Load sent offers (from training_offers)
            const { data: offersData } = await supabase
                .from("training_offers")
                .select("*")
                .eq("trainer_id", session.id)
                .neq("status", "expired")
                .order("created_at", { ascending: false });

            if (offersData) {
                setOffers(offersData.map((o: any) => {
                    const foundAthlete = athleteData?.find((a: any) => a.id === o.athlete_id) as Record<string, unknown> | undefined;
                    const athleteName = foundAthlete ? `${foundAthlete.first_name} ${foundAthlete.last_name}` : "Unknown";
                    const proposed = o.proposed_dates || {};
                    return {
                        id: o.id,
                        athlete_id: o.athlete_id,
                        athlete_name: athleteName,
                        sport: o.sport || "",
                        message: o.message || "",
                        session_type: proposed.session_type || "private",
                        rate: o.price ? Number(o.price) : 0,
                        status: o.status || "pending",
                        created_at: o.created_at,
                    };
                }));
            }
        } catch (err) {
            console.error("Failed to load data:", err);
        } finally {
            setLoading(false);
        }
    };

    const sendOffer = async () => {
        setOfferError("");
        if (!user || !selectedAthlete) return;

        const numericRate = parseFloat(offerData.rate);
        const hasCustomRate = offerData.rate.trim() !== "";
        const finalTrainerRate = user.trainerProfile?.hourly_rate ? Number(user.trainerProfile.hourly_rate) : 50;

        if (hasCustomRate && (isNaN(numericRate) || numericRate < 1)) {
            toast.error("Please enter a valid rate.");
            return;
        }

        const finalRateToUse = hasCustomRate ? numericRate : finalTrainerRate;

        const validDates = offerData.sessionDates.filter(d => d.date && d.time);
        if (validDates.length === 0) {
            toast.error("Please add at least one date and time for the session.");
            return;
        }

        setSending(true);

        try {
            const finalRate = offerData.introDiscount ? finalRateToUse * (1 - parseInt(offerData.discountPercent) / 100) : finalRateToUse;

            const trainerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // Save to training_offers table
            const { data: insertedOffer, error: offerError } = await supabase.from("training_offers").insert({
                trainer_id: user.id,
                athlete_id: selectedAthlete.id,
                status: "pending",
                message: offerData.message || null,
                price: finalRate,
                session_length_min: offerData.sessionType === "private" ? 60 : 60,
                sport: offerData.sport || selectedAthlete.athlete_profile?.sports?.[0] || null,
                proposed_dates: {
                    sessions: validDates.map(d => ({ date: d.date, time: d.time })),
                    session_type: offerData.sessionType,
                    timezone: trainerTimezone,
                    scheduledAt: validDates[0].date,
                    ...(selectedCamp !== null && camps[selectedCamp] ? { camp: camps[selectedCamp] } : {}),
                },
            }).select("id").single();
            if (offerError) throw offerError;

            // Notify athlete about the offer using MESSAGE_RECEIVED to avoid enum errors
            await supabase.from("notifications").insert({
                user_id: selectedAthlete.id,
                type: "MESSAGE_RECEIVED",
                title: `Training Offer from ${user.firstName} ${user.lastName}`,
                body: offerData.message || `${user.firstName} wants to train with you! Rate: $${finalRate.toFixed(0)}/hr`,
                data: {
                    offer_id: insertedOffer.id,
                    trainer_id: user.id,
                    trainer_name: `${user.firstName} ${user.lastName}`,
                    sport: offerData.sport || selectedAthlete.athlete_profile?.sports?.[0] || "",
                    session_type: offerData.sessionType,
                    rate: finalRate,
                    original_rate: finalRateToUse,
                    has_discount: offerData.introDiscount,
                    sessions: validDates.map(d => ({ date: d.date, time: d.time })),
                    timezone: trainerTimezone,
                    scheduledAt: validDates[0].date,
                    ...(selectedCamp !== null && camps[selectedCamp] ? { camp: camps[selectedCamp] } : {}),
                },
            });

            // Note: spots are NOT decremented on send — only when athlete ACCEPTS the offer
            // This prevents double-counting when offer is sent but not yet accepted
            if (selectedCamp !== null) {
                setSelectedCamp(null);
            }

            // Reset
            setShowNewOffer(false);
            setOfferError("");
            setSelectedAthlete(null);
            setSelectedCamp(null);
            setOfferData({ message: "", sessionType: "private", rate: "", introDiscount: false, discountPercent: "20", sessionDates: [{ date: "", time: "" }], sport: "" });

            toast.success("Offer sent successfully!");

            // Reload
            if (user) loadData(user);
        } catch (err) {
            console.error("Failed to send offer:", err);
            toast.error("Failed to send offer. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const cancelOffer = (offerId: string) => {
        setOfferToCancel(offerId);
    };

    const confirmCancelOffer = async () => {
        if (!offerToCancel) return;
        setIsCanceling(true);
        try {
            await supabase.from("training_offers").update({ status: 'expired' }).eq("id", offerToCancel);
            setOffers(prev => prev.filter(o => o.id !== offerToCancel));
            setOfferToCancel(null);
        } catch (err) {
            console.error("Failed to cancel offer:", err);
            alert("Failed to cancel offer");
        } finally {
            setIsCanceling(false);
        }
    };

    const filteredAthletes = athletes.filter(a => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        const sports = a.athlete_profile?.sports?.join(" ").toLowerCase() || "";
        const location = `${a.athlete_profile?.city || ""} ${a.athlete_profile?.state || ""}`.toLowerCase();
        const query = searchTerm.toLowerCase();
        return name.includes(query) || sports.includes(query) || location.includes(query);
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isSubscriptionActive) {
        return (
            <div className="max-w-[1000px] w-full pb-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">Training Offers</h1>
                    <p className="text-text-main/60 text-sm font-medium">Send personalized offers to athletes and grow your business.</p>
                </div>

                {/* Locked state */}
                <div className="flex flex-col items-center justify-center py-20 bg-[#1A1C23] border border-white/5 rounded-[20px] shadow-md text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                        <Lock size={28} className="text-amber-400" />
                    </div>
                    <h2 className="text-xl font-black text-white mb-2">Subscription Required</h2>
                    <p className="text-text-main/60 text-sm max-w-sm mb-1">
                        Your subscription has expired or been cancelled.
                    </p>
                    <p className="text-text-main/40 text-sm max-w-sm mb-8">
                        Renew your subscription to send training offers and grow your client base.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard/subscription")}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 transition-colors"
                    >
                        <Crown size={16} strokeWidth={2.5} />
                        Upgrade Subscription
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">Training Offers</h1>
                    <p className="text-text-main/60 text-sm font-medium">Send personalized offers to athletes and grow your business.</p>
                </div>
                <button
                    onClick={() => { setShowNewOffer(true); setTab("athletes"); }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-bg font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 shrink-0"
                >
                    <Plus size={18} strokeWidth={3} /> New Offer
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-[#1A1C23] border border-white/5 rounded-[16px] mb-8 w-full sm:w-fit">
                {[
                    { key: "athletes", label: "Browse Athletes", icon: <Users size={16} /> },
                    { key: "sent", label: `Sent Offers (${offers.length})`, icon: <Send size={16} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as "athletes" | "sent")}
                        className={`
                            flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-[12px] font-bold text-sm transition-all duration-200
                            ${tab === t.key
                                ? "bg-[#272A35] text-white shadow-sm"
                                : "bg-transparent text-text-main/50 hover:text-white hover:bg-white/5"}
                        `}
                    ><span className="flex items-center justify-center gap-2">{t.icon} {t.label}</span></button>
                ))}
            </div>

            {/* Athletes Tab */}
            {tab === "athletes" && (
                <div>
                    {/* Search */}
                    <div className="relative mb-8">
                        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search athletes by name, sport, or location..."
                            className="w-full bg-[#1A1C23] border border-white/5 rounded-[20px] pl-12 pr-5 py-4 text-white text-sm outline-none focus:border-primary/50 transition-colors shadow-md"
                        />
                    </div>

                    {/* Athletes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAthletes.length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-[#1A1C23] border border-white/5 rounded-[20px] shadow-md">
                                <Users size={48} className="mx-auto mb-4 text-text-main/20" />
                                <p className="text-white font-bold text-lg mb-1">No athletes found</p>
                                <p className="text-text-main/50 text-sm">Try adjusting your search or check back soon.</p>
                            </div>
                        ) : (
                            filteredAthletes.map((athlete) => (
                                <div key={athlete.id}
                                    className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:border-white/10 group flex flex-col"
                                >
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg border border-primary/20 shrink-0">
                                            {athlete.first_name?.charAt(0)}{athlete.last_name?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-white text-[17px] truncate">{athlete.first_name} {athlete.last_name}</h3>
                                            <p className="text-[13px] text-text-main/50 flex items-center gap-1.5 mt-0.5 truncate">
                                                <MapPin size={12} className="shrink-0 text-primary/70" />
                                                <span className="truncate">
                                                    {athlete.athlete_profile?.city && athlete.athlete_profile?.state ? (
                                                        `${athlete.athlete_profile.city}, ${athlete.athlete_profile.state}`
                                                    ) : athlete.athlete_profile?.address_line1 ? (
                                                        athlete.athlete_profile.address_line1
                                                    ) : (
                                                        "Location not set"
                                                    )}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Sports Tags */}
                                    <div className="flex flex-wrap gap-2 mb-6 flex-1 content-start">
                                        {(athlete.athlete_profile?.sports || []).slice(0, 3).map((s: string) => (
                                            <span key={s} className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-text-main/70 border border-white/5 whitespace-nowrap">
                                                {formatSportName(s)}
                                            </span>
                                        ))}
                                        {athlete.athlete_profile?.skill_level && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/10 whitespace-nowrap">
                                                {athlete.athlete_profile.skill_level}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAthlete(athlete);
                                            setOfferData(prev => ({ ...prev, sport: athlete.athlete_profile?.sports?.[0] || "" }));
                                            setShowNewOffer(true);
                                        }}
                                        className="mt-auto w-full py-3.5 rounded-xl border border-white/5 bg-[#272A35] text-white font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-bg group-hover:border-primary transition-colors"
                                    >
                                        <Send size={15} /> Send Offer
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Sent Offers Tab */}
            {tab === "sent" && (
                <div className="flex flex-col gap-4">
                    {offers.length === 0 ? (
                        <div className="text-center py-16 bg-[#1A1C23] border border-white/5 rounded-[20px] shadow-md">
                            <Send size={48} className="mx-auto mb-4 text-text-main/20" />
                            <p className="text-white font-bold text-lg mb-1">No offers sent yet</p>
                            <p className="text-text-main/50 text-sm">Browse athletes and send your first training offer!</p>
                        </div>
                    ) : (
                        offers.map((offer) => (
                            <div key={offer.id} className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-5">
                                    <div className={`
                                        w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0
                                        ${offer.status === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                            offer.status === "declined" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                "bg-[#272A35] text-text-main/50 border-white/5"}
                                    `}>
                                        {offer.status === "accepted" ? <Award size={22} /> : offer.status === "declined" ? <X size={22} /> : <Clock size={22} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[17px] text-white mb-1">Offer sent to {offer.athlete_name}</h3>
                                        <p className="text-[13px] text-text-main/50 flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-primary">${offer.rate?.toFixed(0)}/hr</span>
                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                            <span className="capitalize text-white/80">{offer.session_type.replace('_', ' ')} Session</span>
                                            {offer.sport && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                                    <span className="text-white/80">{formatSportName(offer.sport)}</span>
                                                </>
                                            )}
                                        </p>
                                        <p className="text-[12px] text-text-main/40 mt-1 flex items-center gap-1.5">
                                            <Calendar size={12} /> {new Date(offer.created_at).toLocaleDateString()} at {new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                    <span className={`
                                        px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border
                                        ${offer.status === "accepted" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                            offer.status === "declined" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                "bg-[#272A35] text-text-main/70 border-white/5"}
                                    `}>
                                        {offer.status}
                                    </span>
                                    {offer.status === "pending" && (
                                        <button
                                            onClick={() => cancelOffer(offer.id)}
                                            className="px-4 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-500 font-bold text-[11px] uppercase tracking-wider hover:bg-red-500 hover:text-bg transition-colors whitespace-nowrap"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* New Offer Modal */}
            {showNewOffer && selectedAthlete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] w-full max-w-[600px] shadow-2xl relative my-auto">
                        <div className="p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-[22px] font-black font-display text-white tracking-wide uppercase">Send Offer</h2>
                                <button onClick={() => { setShowNewOffer(false); setSelectedAthlete(null); }}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-main/50 hover:bg-white/10 hover:text-white transition-colors">
                                    <X size={16} strokeWidth={3} />
                                </button>
                            </div>

                            {/* Athlete Info */}
                            <div className="flex items-center gap-4 p-3 bg-[#12141A] border border-white/5 rounded-[12px] mb-5">
                                <div className="w-11 h-11 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center font-black text-base border border-primary/20 shrink-0">
                                    {selectedAthlete.first_name?.charAt(0)}{selectedAthlete.last_name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-[16px] text-white">{selectedAthlete.first_name} {selectedAthlete.last_name}</h3>
                                    <p className="text-[12px] text-text-main/50 uppercase tracking-widest font-bold mt-1">
                                        {(selectedAthlete.athlete_profile?.sports || []).slice(0, 2).map((s: string) => formatSportName(s)).join(", ") || "Athletic Training"}
                                    </p>
                                    <p className="text-[11px] text-text-main/40 font-medium flex items-center gap-1 mt-1">
                                        <MapPin size={10} className="text-primary/50" />
                                        {selectedAthlete.athlete_profile?.city && selectedAthlete.athlete_profile?.state 
                                            ? `${selectedAthlete.athlete_profile.city}, ${selectedAthlete.athlete_profile.state}`
                                            : selectedAthlete.athlete_profile?.address_line1 || "Location not set"}
                                    </p>
                                </div>
                            </div>


                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-3">
                                        Personal Message
                                    </label>
                                    <textarea
                                        value={offerData.message}
                                        onChange={(e) => setOfferData(prev => ({ ...prev, message: e.target.value }))}
                                        placeholder="Hi! I'd love to work with you..."
                                        rows={2}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors placeholder:text-text-main/30"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-3">
                                        Select Sport
                                    </label>
                                    <select
                                        value={offerData.sport}
                                        onChange={(e) => setOfferData(prev => ({ ...prev, sport: e.target.value }))}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50 transition-colors appearance-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                                    >
                                        {(selectedAthlete.athlete_profile?.sports || []).map((s: string) => (
                                            <option key={s} value={s}>{formatSportName(s)}</option>
                                        ))}
                                        {(!selectedAthlete.athlete_profile?.sports || selectedAthlete.athlete_profile.sports.length === 0) && (
                                            <option value="">Athletic Training</option>
                                        )}
                                    </select>
                                </div>

                                {/* Camp Selection */}
                                {camps.length > 0 && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-3">
                                            <Repeat size={12} className="inline mr-1.5 -mt-0.5" />
                                            Send a Camp Offer
                                        </label>
                                        <div className="space-y-2">
                                            {camps.map((camp, idx) => {
                                                const isSelected = selectedCamp === idx;
                                                const isFull = camp.maxSpots > 0 && (camp.spotsRemaining ?? camp.maxSpots) <= 0;
                                                return (
                                                    <button
                                                        key={idx}
                                                        disabled={isFull}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (isFull) return;
                                                            if (isSelected) {
                                                                setSelectedCamp(null);
                                                                setOfferData(prev => ({ ...prev, sessionType: "private", rate: "", message: prev.message }));
                                                            } else {
                                                                setSelectedCamp(idx);
                                                                const locationMsg = camp.location ? ` at ${camp.location}` : "";
                                                                const timeMsg = camp.startTime && camp.endTime ? ` (${camp.startTime} - ${camp.endTime})` : "";
                                                                const datesMsg = camp.dates && camp.dates.length > 0 ? ` Dates: ${camp.dates.slice(0, 3).join(", ")}${camp.dates.length > 3 ? "..." : ""}` : "";
                                                                setOfferData(prev => ({
                                                                    ...prev,
                                                                    sessionType: "camp",
                                                                    rate: camp.totalPrice.toString(),
                                                                    message: prev.message || `Join my ${camp.name} camp${locationMsg}! ${camp.hoursPerDay} hrs/day for ${camp.days} days${timeMsg}.${datesMsg}`,
                                                                }));
                                                            }
                                                        }}
                                                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                                                            isFull
                                                                ? "border-red-500/20 bg-red-500/5 opacity-60 cursor-not-allowed"
                                                                : isSelected
                                                                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(69,208,255,0.1)]"
                                                                    : "border-white/5 bg-[#12141A] hover:border-white/10"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className={`text-sm font-bold ${isFull ? "text-red-400" : isSelected ? "text-white" : "text-white/80"}`}>
                                                                    {camp.name} {isFull && <span className="text-red-500 text-[10px] uppercase font-black tracking-wider ml-1">Camp Full</span>}
                                                                </p>
                                                                <p className="text-[11px] text-text-main/40 mt-0.5">
                                                                    {camp.hoursPerDay} hrs/day &times; {camp.days} days
                                                                </p>
                                                                {camp.location && <p className="text-[10px] text-text-main/30 mt-0.5 flex items-center gap-1"><MapPin size={9} /> {camp.location}</p>}
                                                                {camp.startTime && camp.endTime && <p className="text-[10px] text-text-main/30 mt-0.5 flex items-center gap-1"><Clock size={9} /> {camp.startTime} - {camp.endTime}</p>}
                                                                {camp.dates && camp.dates.length > 0 && <p className="text-[10px] text-text-main/30 mt-0.5">{camp.dates.slice(0, 2).join(", ")}{camp.dates.length > 2 ? ` +${camp.dates.length - 2} more` : ""}</p>}
                                                            </div>
                                                            <div className="text-right shrink-0 ml-3">
                                                                <span className={`text-sm font-black block ${isSelected ? "text-primary" : "text-text-main/50"}`}>
                                                                    ${camp.totalPrice.toLocaleString()}
                                                                </span>
                                                                {camp.maxSpots > 0 && (
                                                                    <span className={`text-[10px] font-bold block mt-0.5 ${isFull ? "text-red-400" : "text-text-main/30"}`}>
                                                                        {camp.spotsRemaining ?? camp.maxSpots}/{camp.maxSpots} spots
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {selectedCamp !== null && (
                                            <p className="text-[10px] text-primary/60 mt-2 font-bold">
                                                Camp selected — rate and message auto-filled. You can still edit below.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Session Type</label>
                                        <select
                                            value={offerData.sessionType}
                                            onChange={(e) => setOfferData(prev => ({ ...prev, sessionType: e.target.value }))}
                                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors appearance-none"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                                        >
                                            <option value="private">Private (1-on-1)</option>
                                            <option value="semi_private">Semi-Private</option>
                                            <option value="group">Group</option>
                                            <option value="camp">Camp</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Rate ($/hr)</label>
                                        <input
                                            type="number"
                                            value={offerData.rate}
                                            onChange={(e) => setOfferData(prev => ({ ...prev, rate: e.target.value }))}
                                            placeholder={user?.trainerProfile?.hourly_rate?.toString() || "50"}
                                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">
                                        Session Date & Time
                                    </label>
                                    <div className="space-y-3">
                                        {offerData.sessionDates.map((session, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="flex-1 relative">
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50" size={14} />
                                                    <input
                                                        type="date"
                                                        value={session.date}
                                                        min={new Date().toISOString().split('T')[0]}
                                                        onChange={(e) => {
                                                            const updated = [...offerData.sessionDates];
                                                            updated[idx] = { ...updated[idx], date: e.target.value };
                                                            setOfferData(prev => ({ ...prev, sessionDates: updated }));
                                                        }}
                                                        className="w-full bg-[#12141A] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                                    />
                                                </div>
                                                <div className="flex-1 relative">
                                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50" size={14} />
                                                    <input
                                                        type="time"
                                                        value={session.time}
                                                        onChange={(e) => {
                                                            const updated = [...offerData.sessionDates];
                                                            updated[idx] = { ...updated[idx], time: e.target.value };
                                                            setOfferData(prev => ({ ...prev, sessionDates: updated }));
                                                        }}
                                                        className="w-full bg-[#12141A] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                                    />
                                                </div>
                                                {offerData.sessionDates.length > 1 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setOfferData(prev => ({
                                                                ...prev,
                                                                sessionDates: prev.sessionDates.filter((_, i) => i !== idx),
                                                            }));
                                                        }}
                                                        className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setOfferData(prev => ({
                                                ...prev,
                                                sessionDates: [...prev.sessionDates, { date: "", time: "" }],
                                            }));
                                        }}
                                        className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-white/10 text-text-main/50 text-xs font-bold flex items-center justify-center gap-2 hover:border-primary/30 hover:text-primary/80 transition-colors"
                                    >
                                        <Plus size={14} /> Add Another Date & Time
                                    </button>
                                    <p className="text-[10px] text-text-main/30 mt-2">
                                        Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                                    </p>
                                </div>

                                {/* Intro Discount Toggle */}
                                <label className={`
                                    flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer
                                    ${offerData.introDiscount ? "border-primary bg-primary/5" : "border-white/5 bg-[#1A1C23] hover:bg-white/[0.03]"}
                                `}>
                                    <input type="checkbox" className="hidden"
                                        checked={offerData.introDiscount}
                                        onChange={(e) => setOfferData(prev => ({ ...prev, introDiscount: e.target.checked }))}
                                    />
                                    <div className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${offerData.introDiscount ? "bg-primary border-primary text-bg" : "border-white/20 bg-white"}`}>
                                        {offerData.introDiscount && <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-white text-[14px] flex items-center gap-2">
                                            <PartyPopper size={16} className="text-white/60" />
                                            Add Intro Session Discount
                                        </p>
                                        <p className="text-[12px] text-text-main/50 mt-0.5">Offer a special rate for the first session</p>
                                    </div>
                                    {offerData.introDiscount && (
                                        <select
                                            value={offerData.discountPercent}
                                            onChange={(e) => setOfferData(prev => ({ ...prev, discountPercent: e.target.value }))}
                                            className="bg-[#272A35] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-primary appearance-none cursor-pointer"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <option value="10">10%</option>
                                            <option value="15">15%</option>
                                            <option value="20">20%</option>
                                            <option value="25">25%</option>
                                            <option value="50">50%</option>
                                        </select>
                                    )}
                                </label>
                            </div>

                            {/* Send Button */}
                            <button
                                onClick={sendOffer}
                                disabled={sending}
                                className={`
                                    w-full py-3.5 rounded-xl font-black text-[15px] mt-6 flex items-center justify-center gap-2 transition-all
                                    ${sending
                                        ? "bg-primary/50 text-bg/50 cursor-not-allowed"
                                        : "bg-primary text-bg hover:shadow-[0_0_20px_rgba(69,208,255,0.3)] hover:-translate-y-0.5"}
                                `}
                            >
                                {sending ? (
                                    <><div className="w-5 h-5 border-2 border-bg/30 border-t-bg rounded-full animate-spin" /> Sending...</>
                                ) : (
                                    <><Send size={18} strokeWidth={2.5} /> Send Offer</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {offerToCancel && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] w-full max-w-[400px] shadow-2xl p-6 relative text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                            <X size={32} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-[20px] font-black font-display tracking-wide text-white uppercase mb-2">Cancel Offer?</h3>
                        <p className="text-text-main/60 text-sm font-medium mb-8">
                            Are you sure you want to cancel this training offer? This action cannot be undone and the athlete will not be able to accept it.
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setOfferToCancel(null)}
                                disabled={isCanceling}
                                className="flex-1 py-3 rounded-xl border border-white/10 bg-transparent text-white font-bold text-sm hover:bg-white/5 transition-colors"
                            >
                                Nevermind
                            </button>
                            <button
                                onClick={confirmCancelOffer}
                                disabled={isCanceling}
                                className={`
                                    flex-[1.5] py-3 rounded-xl border border-transparent font-bold text-sm transition-colors flex items-center justify-center gap-2
                                    ${isCanceling ? "bg-red-500/50 text-white cursor-not-allowed" : "bg-red-500 text-bg hover:bg-red-600"}
                                `}
                            >
                                {isCanceling ? (
                                    <><div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" /> Canceling...</>
                                ) : (
                                    "Yes, Cancel Offer"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
