"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatSportName } from "@/lib/format";
import { Send, Calendar, Clock, DollarSign, CheckCircle, XCircle, Hourglass, ChevronRight } from "lucide-react";

type OfferStatus = "pending" | "accepted" | "declined" | "expired" | string;

interface TrainerLite {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
}

interface OfferRow {
    id: string;
    trainer_id: string;
    athlete_id: string;
    sport: string | null;
    price: number | null;
    session_length_min: number | null;
    message: string | null;
    proposed_dates: any;
    status: OfferStatus;
    expires_at: string | null;
    created_at: string;
    trainer: TrainerLite | null;
}

const STATUS_GROUPS: { key: string; title: string; statuses: string[] }[] = [
    { key: "active", title: "Active", statuses: ["pending"] },
    { key: "accepted", title: "Accepted", statuses: ["accepted"] },
    { key: "history", title: "History", statuses: ["declined", "expired"] },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    accepted: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    declined: { label: "Declined", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
    expired: { label: "Expired", cls: "bg-white/5 text-text-main/50 border-white/10" },
};

function getProposedAt(offer: OfferRow): string | null {
    const pd = offer.proposed_dates;
    if (!pd) return null;
    if (Array.isArray(pd?.sessions) && pd.sessions[0]?.date) return pd.sessions[0].date;
    if (pd?.scheduledAt) return pd.scheduledAt;
    if (pd?.camp?.dates?.[0]) return pd.camp.dates[0];
    return null;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
    });
}

function timeUntil(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = d - now;
    if (diff <= 0) return "expired";
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m left`;
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
}

function trainerName(t: TrainerLite | null): string {
    if (!t) return "Trainer";
    return [t.first_name, t.last_name].filter(Boolean).join(" ") || "Trainer";
}

function trainerInitials(t: TrainerLite | null): string {
    if (!t) return "T";
    const f = (t.first_name || "")[0] || "";
    const l = (t.last_name || "")[0] || "";
    return (f + l).toUpperCase() || "T";
}

export default function AthleteOffersPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState<string | null>(null);

    const fetchOffers = useCallback(async (u: AuthUser) => {
        try {
            const { data, error } = await supabase
                .from("training_offers")
                .select("*, trainer:users!training_offers_trainer_id_fkey(id, first_name, last_name, avatar_url)")
                .eq("athlete_id", u.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            setOffers((data || []) as OfferRow[]);
        } catch (err) {
            console.error("Error fetching offers:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const session = getSession();
        if (!session) {
            router.replace("/login");
            return;
        }
        setUser(session);

        fetch("/api/offers/expire", { method: "POST" }).catch(() => {});

        fetchOffers(session);

        const channel = supabase
            .channel(`athlete-offers-${session.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "training_offers",
                filter: `athlete_id=eq.${session.id}`,
            }, () => { fetchOffers(session); })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchOffers, router]);

    const grouped = useMemo(() => {
        return STATUS_GROUPS
            .map((g) => ({ ...g, data: offers.filter((o) => g.statuses.includes(o.status)) }))
            .filter((g) => g.data.length > 0);
    }, [offers]);

    const pendingCount = offers.filter((o) => o.status === "pending").length;

    const handleAccept = async (offer: OfferRow) => {
        if (!user) return;
        setActingId(offer.id);
        try {
            const { data: athleteUser } = await supabase
                .from("users")
                .select("email")
                .eq("id", user.id)
                .single();
            if (!athleteUser?.email) throw new Error("Could not find your email");

            const res = await fetch("/api/stripe/create-offer-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: offer.id,
                    athleteId: user.id,
                    athleteEmail: athleteUser.email,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create payment session");
            window.location.href = data.url;
        } catch (err: any) {
            console.error("Error accepting offer:", err);
            alert(err?.message || "Could not accept the offer. Please try again.");
            setActingId(null);
        }
    };

    const handleDecline = async (offer: OfferRow) => {
        if (!confirm("Decline this training offer? This cannot be undone.")) return;
        setActingId(offer.id);
        try {
            const { error } = await supabase
                .from("training_offers")
                .update({ status: "declined" })
                .eq("id", offer.id);
            if (error) throw error;

            await supabase.from("notifications").insert({
                user_id: offer.trainer_id,
                type: "OFFER_DECLINED",
                title: "Offer Declined",
                body: "Your training offer was declined",
                data: { offerId: offer.id, offer_id: offer.id },
                read: false,
            });

            setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: "declined" } : o)));
        } catch (err: any) {
            console.error("Error declining offer:", err);
            alert(err?.message || "Could not decline the offer. Please try again.");
        } finally {
            setActingId(null);
        }
    };

    const handleViewBooking = () => {
        router.push("/dashboard/bookings");
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <Send className="w-7 h-7 text-primary" />
                        My Offers
                        {pendingCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-primary text-bg text-xs font-black">
                                {pendingCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-text-main/60 mt-2 text-sm">Training requests from coaches</p>
                </div>
            </header>

            {offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[#1A1C23] border border-white/5 rounded-[20px] shadow-md text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                        <Send className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-white font-bold text-lg mb-1">No offers yet</h2>
                    <p className="text-text-main/60 text-sm mb-6 max-w-sm">
                        Browse trainers to request a session.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard/search")}
                        className="px-5 py-2.5 rounded-xl bg-primary text-bg font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                        Find Trainers
                    </button>
                </div>
            ) : (
                <div className="space-y-10">
                    {grouped.map((group) => (
                        <section key={group.key}>
                            <h2 className="text-xs font-black uppercase tracking-wider text-text-main/50 mb-3 px-1">
                                {group.title} <span className="text-text-main/30">({group.data.length})</span>
                            </h2>
                            <div className="space-y-3">
                                {group.data.map((offer) => {
                                    const badge = STATUS_BADGE[offer.status] || STATUS_BADGE.expired;
                                    const proposedAt = getProposedAt(offer);
                                    const expiresIn = offer.status === "pending" ? timeUntil(offer.expires_at) : null;
                                    const isActing = actingId === offer.id;
                                    return (
                                        <article
                                            key={offer.id}
                                            className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-5 sm:p-6 shadow-md hover:border-white/10 transition-colors"
                                        >
                                            <div className="flex items-start gap-4">
                                                {offer.trainer?.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={offer.trainer.avatar_url}
                                                        alt={trainerName(offer.trainer)}
                                                        className="w-12 h-12 rounded-[12px] object-cover border border-white/10 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20 shrink-0">
                                                        {trainerInitials(offer.trainer)}
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="text-white font-bold text-base truncate">
                                                                {trainerName(offer.trainer)}
                                                            </h3>
                                                            <p className="text-text-main/60 text-sm">
                                                                {offer.sport ? formatSportName(offer.sport) : "General training"}
                                                            </p>
                                                        </div>
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}>
                                                            {badge.label}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-main/70">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Calendar className="w-4 h-4 text-primary/70" />
                                                            {formatDateTime(proposedAt)}
                                                        </span>
                                                        {offer.session_length_min ? (
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <Clock className="w-4 h-4 text-primary/70" />
                                                                {offer.session_length_min} min
                                                            </span>
                                                        ) : null}
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <DollarSign className="w-4 h-4 text-primary/70" />
                                                            {offer.price != null ? `$${Number(offer.price).toFixed(2)} USD` : "—"}
                                                        </span>
                                                        {expiresIn && (
                                                            <span className="inline-flex items-center gap-1.5 text-amber-300">
                                                                <Hourglass className="w-4 h-4" />
                                                                {expiresIn}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {offer.message && (
                                                        <p className="mt-3 text-sm text-text-main/70 bg-[#12141A] border border-white/5 rounded-xl px-3 py-2 whitespace-pre-wrap">
                                                            {offer.message}
                                                        </p>
                                                    )}

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {offer.status === "pending" && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAccept(offer)}
                                                                    disabled={isActing}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-bg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                    {isActing ? "Processing…" : "Accept & Pay"}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDecline(offer)}
                                                                    disabled={isActing}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-[#272A35] text-white font-bold text-sm hover:bg-white/5 disabled:opacity-50 transition-colors"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                    Decline
                                                                </button>
                                                            </>
                                                        )}
                                                        {offer.status === "accepted" && (
                                                            <button
                                                                onClick={handleViewBooking}
                                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-bg font-bold text-sm hover:opacity-90 transition-opacity"
                                                            >
                                                                View Booking
                                                                <ChevronRight className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
