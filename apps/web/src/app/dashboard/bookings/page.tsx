"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";
import {
    Inbox, Activity, Clock, DollarSign, MapPin, Star, Check, X,
    RefreshCw, FileText, CalendarClock, CreditCard, ShieldCheck,
    Loader2, AlertCircle, RotateCcw, ChevronRight, Zap,
} from "lucide-react";
import { RescheduleDialog } from "@/components/bookings/RescheduleDialog";
import { AddToCalendarDropdown } from "@/components/bookings/AddToCalendarDropdown";
import { CancelBookingDialog } from "@/components/bookings/CancelBookingDialog";
import { ReviewModal } from "@/components/bookings/ReviewModal";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";

type RescheduleInfo = {
    id: string;
    proposed_time: string;
    reason: string | null;
    initiated_by: string;
};

type BookingWithUser = BookingRow & {
    other_user?: { first_name: string; last_name: string; email: string };
    reschedule_request?: RescheduleInfo | null;
    review?: { id: string; rating: number; review_text: string | null } | null;
};

const STATUS_CFG: Record<string, {
    label: string; pill: string; bar: string;
    dot: string; glow: string; dimCard: boolean;
}> = {
    pending:              { label: "Pending",      pill: "bg-amber-500/12 text-amber-400 border-amber-500/25",   bar: "bg-amber-500",   dot: "bg-amber-400",   glow: "shadow-amber-500/10",  dimCard: false },
    confirmed:            { label: "Confirmed",    pill: "bg-sky-500/12 text-sky-400 border-sky-500/25",         bar: "bg-sky-500",     dot: "bg-sky-400",     glow: "shadow-sky-500/10",    dimCard: false },
    completed:            { label: "Completed",    pill: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", bar: "bg-emerald-500", dot: "bg-emerald-400", glow: "shadow-emerald-500/10", dimCard: false },
    cancelled:            { label: "Cancelled",    pill: "bg-red-500/10 text-red-400 border-red-500/20",         bar: "bg-red-500",     dot: "bg-red-400",     glow: "",                     dimCard: true  },
    rejected:             { label: "Rejected",     pill: "bg-red-500/10 text-red-400 border-red-500/20",         bar: "bg-red-500",     dot: "bg-red-400",     glow: "",                     dimCard: true  },
    no_show:              { label: "No Show",      pill: "bg-purple-500/10 text-purple-400 border-purple-500/20",bar: "bg-purple-500",  dot: "bg-purple-400",  glow: "",                     dimCard: true  },
    disputed:             { label: "Disputed",     pill: "bg-red-500/10 text-red-400 border-red-500/20",         bar: "bg-red-500",     dot: "bg-red-400",     glow: "",                     dimCard: true  },
    reschedule_requested: { label: "Rescheduling", pill: "bg-cyan-500/12 text-cyan-400 border-cyan-500/25",      bar: "bg-cyan-500",    dot: "bg-cyan-400",    glow: "shadow-cyan-500/10",   dimCard: false },
};

export default function BookingsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [bookings, setBookings] = useState<BookingWithUser[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const toastSuccess = toast.success;
    const toastError = toast.error;

    const [paidBookingIds, setPaidBookingIds] = useState<Set<string>>(new Set());
    const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewBooking, setReviewBooking] = useState<BookingWithUser | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);
    const [isReviewReadOnly, setIsReviewReadOnly] = useState(false);

    const [rescheduleBooking, setRescheduleBooking] = useState<BookingWithUser | null>(null);
    const [cancelBooking, setCancelBooking] = useState<BookingWithUser | null>(null);

    useEffect(() => {
        const session = getSession();
        if (session) { setUser(session); loadBookings(session); }
    }, []);

    useEffect(() => {
        if (!user) return;
        const column = user.role === "trainer" ? "trainer_id" : "athlete_id";
        const sub = supabase.channel(`bookings:${user.id}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `${column}=eq.${user.id}` },
                () => loadBookings(user))
            .subscribe();
        return () => { sub.unsubscribe(); };
    }, [user]);

    const loadBookings = async (u: AuthUser, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const column = u.role === "trainer" ? "trainer_id" : "athlete_id";
            const { data: bookingData } = await supabase.from("bookings").select("*").eq(column, u.id).order("scheduled_at", { ascending: false });

            if (bookingData?.length) {
                const ids = bookingData.map((b: BookingRow) => b.id);
                const { data: txData } = await supabase.from("payment_transactions").select("booking_id").in("booking_id", ids);
                setPaidBookingIds(new Set((txData || []).map((t: any) => t.booking_id)));
            }

            const all = (bookingData || []) as BookingRow[];
            const otherIds = all.map((b) => (u.role === "trainer" ? b.athlete_id : b.trainer_id));
            const { data: users } = await supabase.from("users").select("id, first_name, last_name, email").in("id", [...new Set(otherIds)]);
            const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

            const reschedIds = all.filter((b) => b.status === "reschedule_requested").map((b) => b.id);
            let reschedMap = new Map<string, RescheduleInfo>();
            if (reschedIds.length) {
                const { data: rd } = await supabase.from("reschedule_requests").select("id, booking_id, proposed_time, reason, initiated_by").in("booking_id", reschedIds).eq("status", "pending");
                (rd || []).forEach((r: any) => reschedMap.set(r.booking_id, { id: r.id, proposed_time: r.proposed_time, reason: r.reason, initiated_by: r.initiated_by }));
            }

            // Fetch reviews by reviewer — map per trainer+sport (one review per trainer per sport)
            const { data: revData } = await supabase.from("reviews").select("id, booking_id, reviewee_id, rating, review_text").eq("reviewer_id", u.id);
            const bookingIdToSport = new Map(all.map((b) => [b.id, b.sport]));
            const reviewByTrainerSport = new Map<string, { id: string; rating: number; review_text: string | null }>();
            (revData || []).forEach((r: any) => {
                const sport = bookingIdToSport.get(r.booking_id) || "";
                reviewByTrainerSport.set(`${r.reviewee_id}:${sport}`, { id: r.id, rating: r.rating, review_text: r.review_text });
            });

            setBookings(all.map((b) => ({
                ...b,
                other_user: usersMap.get(u.role === "trainer" ? b.athlete_id : b.trainer_id) as BookingWithUser["other_user"],
                reschedule_request: reschedMap.get(b.id) || null,
                review: reviewByTrainerSport.get(`${b.trainer_id}:${b.sport}`) || null,
            })));
        } catch (err) { console.error(err); setLoadError("Failed to load bookings. Please refresh."); }
        finally { setLoading(false); setRefreshing(false); }
    };

    const cancelWithReason = async (bookingId: string, reason: string) => {
        setActionLoading(bookingId);
        try {
            if (paidBookingIds.has(bookingId)) {
                const res = await fetch("/api/stripe/refund-booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, cancelledBy: user?.role, reason }) });
                const data = await res.json();
                if (!res.ok) { toastError("Refund Failed", data.error); return; }
                setPaidBookingIds((p) => { const n = new Set(p); n.delete(bookingId); return n; });
            }
            await supabase.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason, updated_at: new Date().toISOString() }).eq("id", bookingId);
            if (user) loadBookings(user);
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const updateStatus = async (bookingId: string, newStatus: string) => {
        setActionLoading(bookingId);
        try {
            const { data, error } = await supabase.from("bookings").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", bookingId).select("*");
            if (error || !data?.length) { toastError("Failed", error?.message || "Permission denied"); return; }
            setBookings((p) => p.map((b) => b.id === bookingId ? { ...b, status: newStatus as BookingRow["status"] } : b));
            const labels: Record<string, string> = { confirmed: "Booking Confirmed", completed: "Session Complete", cancelled: "Cancelled", rejected: "Rejected" };
            toastSuccess(labels[newStatus] || "Updated");
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
                if (newStatus === "confirmed") {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_CONFIRMED",
                        title: "Booking confirmed",
                        body: "Your booking has been confirmed.",
                        data: { booking_id: bookingId },
                        read: false,
                    });
                } else if (newStatus === "completed") {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_COMPLETED",
                        title: "Session Completed",
                        body: `Your ${booking.sport} session has been marked as complete.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                } else if (newStatus === "rejected") {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_REJECTED",
                        title: "Booking Declined",
                        body: `Your ${booking.sport} session request was declined.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }
            }
        } catch (err: any) { toastError("Error", err.message); }
        finally { setActionLoading(null); }
    };

    const respondToReschedule = async (bookingId: string, rescheduleId: string, accept: boolean, proposedTime?: string) => {
        setActionLoading(bookingId);
        try {
            await supabase.from("reschedule_requests").update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() }).eq("id", rescheduleId);
            await supabase.from("bookings").update({ ...(accept && proposedTime ? { scheduled_at: proposedTime } : {}), status: "confirmed", updated_at: new Date().toISOString() }).eq("id", bookingId);
            const booking = bookings.find((b) => b.id === bookingId);
            if (booking?.reschedule_request) {
                await supabase.from("notifications").insert({ user_id: booking.reschedule_request.initiated_by, type: accept ? "RESCHEDULE_ACCEPTED" : "RESCHEDULE_DECLINED", title: accept ? "Reschedule Accepted" : "Reschedule Declined", body: accept ? `Reschedule for ${booking.sport} accepted!` : `Reschedule for ${booking.sport} declined.`, data: { booking_id: bookingId }, read: false });
            }
            if (user) loadBookings(user);
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const submitReview = async () => {
        if (!user || !reviewBooking) return;
        setSubmittingReview(true);
        try {
            const existingId = reviewBooking.review?.id;
            let error;

            if (existingId) {
                // UPDATE existing review
                ({ error } = await supabase.from("reviews")
                    .update({ rating: reviewRating, review_text: reviewText || null })
                    .eq("id", existingId));
            } else {
                // Check for duplicate review before inserting
                const { data: existingReview } = await supabase
                    .from('reviews')
                    .select('id')
                    .eq('booking_id', reviewBooking.id)
                    .eq('reviewer_id', user.id)
                    .single();

                if (existingReview) {
                    toastError('Already Reviewed', 'You have already submitted a review for this booking');
                    setSubmittingReview(false);
                    return;
                }

                // INSERT new review
                ({ error } = await supabase.from("reviews").insert({
                    booking_id: reviewBooking.id,
                    reviewer_id: user.id,
                    reviewee_id: reviewBooking.trainer_id,
                    rating: reviewRating,
                    review_text: reviewText || null,
                    is_public: true,
                }));
                if (!error) {
                    await supabase.from("notifications").insert({
                        user_id: reviewBooking.trainer_id,
                        type: "REVIEW_RECEIVED",
                        title: "New Review",
                        body: `You got a ${reviewRating}-star review for ${reviewBooking.sport}.`,
                        data: { booking_id: reviewBooking.id },
                        read: false,
                    });
                }
            }

            if (error) throw error;

            // Recalculate trainer's average_rating and total_reviews
            const { data: allReviews } = await supabase.from("reviews").select("rating").eq("reviewee_id", reviewBooking.trainer_id);
            if (allReviews && allReviews.length > 0) {
                const avg = Math.round((allReviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / allReviews.length) * 10) / 10;
                await supabase.from("trainer_profiles").update({ average_rating: avg, total_reviews: allReviews.length }).eq("user_id", reviewBooking.trainer_id);
            }

            // Update local state — all bookings with same trainer+sport get the updated review
            const newReview = { id: existingId || "", rating: reviewRating, review_text: reviewText || null };
            setBookings(prev => prev.map(b =>
                b.trainer_id === reviewBooking.trainer_id && b.sport === reviewBooking.sport
                    ? { ...b, review: newReview }
                    : b
            ));
            setReviewModalOpen(false); setReviewBooking(null); setReviewRating(5); setReviewText("");
            toastSuccess(existingId ? "Review Updated!" : "Review Submitted!");
        } catch (err: any) { console.error(err); toastError("Failed", err.message || "Could not submit review."); }
        finally { setSubmittingReview(false); }
    };

    const openReview = (booking: BookingWithUser) => {
        setReviewBooking(booking); setIsReviewReadOnly(false);
        setReviewRating(booking.review ? booking.review.rating : 5);
        setReviewText(booking.review ? (booking.review.review_text || "") : "");
        setReviewModalOpen(true);
    };

    const handlePayNow = async (booking: BookingWithUser) => {
        if (!user) return;
        setPaymentLoading(booking.id);
        try {
            const res = await fetch("/api/stripe/create-booking-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, athleteId: user.id, athleteEmail: user.email }) });
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || "Failed");
            window.location.href = data.url;
        } catch (err: any) { toastError("Payment Error", err.message); setPaymentLoading(null); }
    };

    const isTrainerView = user?.role === "trainer";

    // Show all bookings for both roles — past ones get a visual "expired" treatment
    const visibleBookings = bookings;

    const sortedBookings = [...visibleBookings].sort((a, b) => {
        const now = new Date();
        const da = new Date(a.scheduled_at), db = new Date(b.scheduled_at);
        const futureA = da >= now, futureB = db >= now;
        const terminal = new Set(["cancelled", "rejected", "no_show", "disputed"]);

        const createdDesc = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        if (isTrainerView) {
            const order: Record<string, number> = { pending: 0, reschedule_requested: 1, confirmed: 2, completed: 3, cancelled: 4, rejected: 5, no_show: 5, disputed: 5 };
            const oa = order[a.status] ?? 9, ob = order[b.status] ?? 9;
            return oa !== ob ? oa - ob : createdDesc;
        }
        // Groups: 0=upcoming active, 1=past active(expired), 2=completed, 3=terminal(cancelled/rejected)
        const activeStatuses = !terminal.has(a.status) && a.status !== "completed";
        const activeStatusesB = !terminal.has(b.status) && b.status !== "completed";
        const gA = terminal.has(a.status) ? 3 : a.status === "completed" ? 2 : !futureA && activeStatuses ? 1 : futureA ? 0 : 1;
        const gB = terminal.has(b.status) ? 3 : b.status === "completed" ? 2 : !futureB && activeStatusesB ? 1 : futureB ? 0 : 1;
        if (gA !== gB) return gA - gB;
        if (gA === 0) {
            const pA = paidBookingIds.has(a.id), pB = paidBookingIds.has(b.id);
            const uA = a.status === "confirmed" && !pA ? 0 : a.status === "confirmed" ? 1 : 2;
            const uB = b.status === "confirmed" && !pB ? 0 : b.status === "confirmed" ? 1 : 2;
            return uA !== uB ? uA - uB : createdDesc;
        }
        return createdDesc;
    });

    const filteredBookings = filter === "all" ? sortedBookings : sortedBookings.filter((b) => b.status === filter);
    const filters = ["all", "pending", "confirmed", "completed", "cancelled", "rejected"];

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs text-text-main/30 font-medium tracking-widest uppercase">Loading sessions...</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
                <p className="text-text-main/50 font-semibold text-sm">{loadError}</p>
                <button onClick={() => { setLoadError(null); setLoading(true); if (user) loadBookings(user); }} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-text-main/70 text-sm font-bold hover:bg-white/[0.10] transition-all">Retry</button>
            </div>
        );
    }

    return (
        <div className="max-w-[960px] w-full pb-16">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
                <div>
                    <p className="text-[11px] font-bold tracking-[0.2em] text-primary/60 uppercase mb-2">
                        {isTrainerView ? "Coach Portal" : "Athlete Portal"}
                    </p>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        {isTrainerView ? "Sessions" : "My Bookings"}
                    </h1>
                    <p className="text-text-main/40 text-sm mt-1.5 font-medium">
                        {bookings.length} session{bookings.length !== 1 ? "s" : ""} total
                    </p>
                </div>
                <div className="flex items-center gap-2.5 pb-1">
                    <button
                        onClick={() => user && loadBookings(user, true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/4 border border-white/8 text-text-main/50 text-[11px] font-bold uppercase tracking-wider hover:bg-white/8 hover:text-white/70 transition-all disabled:opacity-40"
                    >
                        <RotateCcw size={12} className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Syncing..." : "Refresh"}
                    </button>
                    {!isTrainerView && (
                        <a
                            href="/dashboard/search"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg font-black text-[11px] uppercase tracking-widest hover:shadow-[0_0_20px_rgba(69,208,255,0.4)] transition-all"
                        >
                            <Zap size={12} />
                            Book Trainer
                        </a>
                    )}
                </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="overflow-x-auto mb-8">
            <div className="flex gap-1.5 bg-[#0D0F17] border border-white/6 rounded-2xl p-1.5 w-fit flex-nowrap min-w-max">
                {filters.map((f) => {
                    const count = f === "all" ? bookings.length : bookings.filter((b) => b.status === f).length;
                    const active = filter === f;
                    const cfg = f !== "all" ? STATUS_CFG[f] : null;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`relative px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.08em] transition-all flex items-center gap-2 ${
                                active
                                    ? "bg-[#1E2130] text-white shadow-lg border border-white/10"
                                    : "text-text-main/40 hover:text-text-main/70 hover:bg-white/4 border border-transparent"
                            }`}
                        >
                            {f === "all" ? "All" : f.replace("_", " ")}
                            <span className={`min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black ${
                                active
                                    ? "bg-primary/20 text-primary"
                                    : "bg-white/6 text-text-main/30"
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
            </div>

            {/* ── Empty State ── */}
            {filteredBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center">
                        <Inbox size={28} className="text-text-main/20" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="text-white font-bold text-base">No sessions found</p>
                        <p className="text-text-main/35 text-sm mt-1">
                            {filter !== "all" ? `No ${filter} bookings yet.` : "Your sessions will appear here."}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredBookings.map((booking) => {
                        const sc = STATUS_CFG[booking.status] || STATUS_CFG.pending;
                        const date = new Date(booking.scheduled_at);
                        const isPast = date < new Date();
                        const isActiveStatus = !["completed", "cancelled", "rejected", "no_show", "disputed"].includes(booking.status);
                        const isExpired = isPast && isActiveStatus; // past but not properly closed out
                        const isTrainer = user?.role === "trainer";
                        const isPaid = paidBookingIds.has(booking.id);
                        const needsPayment = !isTrainer && booking.status === "confirmed" && !isPaid && !isPast;

                        // Acceptance deadline: 2 hours before session OR 48h after booking created (whichever is sooner)
                        const acceptanceDeadline = Math.min(
                            date.getTime() - 2 * 60 * 60 * 1000,
                            new Date(booking.created_at).getTime() + 48 * 60 * 60 * 1000
                        );
                        const acceptanceExpired = Date.now() > acceptanceDeadline;
                        const minutesLeft = Math.max(0, Math.round((acceptanceDeadline - Date.now()) / 60000));
                        const hoursLeft = Math.floor(minutesLeft / 60);
                        const otherName = booking.other_user ? `${booking.other_user.first_name} ${booking.other_user.last_name}` : "Unknown";
                        const initials = booking.other_user ? `${booking.other_user.first_name[0]}${booking.other_user.last_name[0]}`.toUpperCase() : "?";

                        const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
                        const dayNum = date.getDate();
                        const monthStr = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                        const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                        // Cards that are past but not explicitly completed/cancelled look "expired"
                        const cardDim = sc.dimCard || isExpired;

                        return (
                            <div
                                key={booking.id}
                                className={`group relative rounded-2xl border transition-all duration-300 ${
                                    cardDim
                                        ? "bg-[#0F111A] border-white/5 opacity-60 hover:opacity-85"
                                        : `bg-[#13151E] border-white/7 hover:border-white/14 hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] ${sc.glow}`
                                }`}
                            >
                                {/* Status bar — top */}
                                <div className={`h-[3px] w-full rounded-t-2xl ${isExpired ? "bg-white/20" : sc.bar} ${cardDim ? "opacity-30" : "opacity-70"}`} />

                                <div className="p-5">
                                    {/* ── Card Body ── */}
                                    <div className="flex gap-4 items-start">

                                        {/* Avatar */}
                                        {!isTrainer && booking.trainer_id ? (
                                            <Link href={`/dashboard/trainers/${booking.trainer_id}`} title="View trainer profile"
                                                className="relative shrink-0 group/av">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm text-white ${sc.dimCard ? "bg-white/8" : "bg-white/10"} ring-2 ring-offset-2 ring-offset-[#13151E] ${sc.dimCard ? "ring-white/10" : "ring-white/15"} group-hover/av:ring-primary/50 transition-all`}>
                                                    {initials}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[#13151E] ${sc.dot}`} />
                                            </Link>
                                        ) : (
                                            <div className="relative shrink-0">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm text-white ${sc.dimCard ? "bg-white/8" : "bg-white/10"} ring-2 ring-offset-2 ring-offset-[#13151E] ring-white/15`}>
                                                    {initials}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[#13151E] ${sc.dot}`} />
                                            </div>
                                        )}

                                        {/* Center info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    {!isTrainer && booking.trainer_id ? (
                                                        <Link href={`/dashboard/trainers/${booking.trainer_id}`}
                                                            className="block text-[15px] font-bold text-white hover:text-primary transition-colors leading-tight truncate">
                                                            {otherName}
                                                        </Link>
                                                    ) : (
                                                        <p className="text-[15px] font-bold text-white leading-tight truncate">{otherName}</p>
                                                    )}
                                                    {booking.other_user?.email && (
                                                        <p className="text-[11px] text-text-main/35 mt-0.5 truncate">{booking.other_user.email}</p>
                                                    )}
                                                </div>

                                                {/* Date block */}
                                                <div className="shrink-0 text-right">
                                                    <p className="text-[10px] font-black tracking-[0.15em] text-text-main/35 uppercase">{weekday}</p>
                                                    <p className="text-[36px] font-black text-white leading-none">{dayNum}</p>
                                                    <p className="text-[11px] text-text-main/40 font-semibold">{monthStr} · {timeStr}</p>
                                                </div>
                                            </div>

                                            {/* Meta pills row */}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                                {/* Sport */}
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-main/55 bg-white/5 px-2.5 py-1 rounded-lg border border-white/6 capitalize">
                                                    <Activity size={10} className="text-primary/70" />
                                                    {booking.sport}
                                                </span>
                                                {/* Duration */}
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-main/55 bg-white/5 px-2.5 py-1 rounded-lg border border-white/6">
                                                    <Clock size={10} className="text-text-main/30" />
                                                    {booking.duration_minutes}m
                                                </span>
                                                {/* Price */}
                                                <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-emerald-400 bg-emerald-500/8 px-2.5 py-1 rounded-lg border border-emerald-500/15">
                                                    <DollarSign size={10} />
                                                    {Number(booking.total_paid).toFixed(2)}
                                                </span>

                                                {/* Status badge */}
                                                <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-[0.08em] px-2.5 py-1 rounded-lg border ${sc.pill}`}>
                                                    {sc.label}
                                                </span>

                                                {/* Past session indicator */}
                                                {isExpired && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-text-main/35 bg-white/4 border border-white/8 px-2.5 py-1 rounded-lg">
                                                        <Clock size={9} /> Expired
                                                    </span>
                                                )}
                                                {isPast && booking.status === "completed" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-main/30 px-1">
                                                        Past Session
                                                    </span>
                                                )}

                                                {/* Payment status */}
                                                {isTrainer && booking.status === "confirmed" && (
                                                    isPaid
                                                        ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider"><ShieldCheck size={9} />Paid · Escrow</span>
                                                        : <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/8 border border-amber-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider"><Clock size={9} />Awaiting Pay</span>
                                                )}
                                                {!isTrainer && booking.status === "confirmed" && isPaid && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider"><ShieldCheck size={9} />Paid · Escrow</span>
                                                )}
                                            </div>

                                            {/* Pending payment guidance */}

                                            {/* Address */}
                                            {booking.address && (
                                                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-text-main/35 font-medium">
                                                    <MapPin size={10} className="text-primary/40 shrink-0" />
                                                    {booking.address}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Action Row ── */}
                                    <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-4 border-t border-white/5">

                                        {/* Waiting badge */}
                                        {booking.status === "reschedule_requested" && booking.reschedule_request?.initiated_by === user?.id && (
                                            <span className="text-[11px] text-cyan-500/50 font-semibold flex items-center gap-1.5 mr-auto">
                                                <Clock size={11} /> Awaiting response...
                                            </span>
                                        )}

                                        {/* Pay Now */}
                                        {needsPayment && (
                                            <button onClick={() => handlePayNow(booking)} disabled={paymentLoading === booking.id}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-bg text-[11px] font-black uppercase tracking-wider hover:shadow-[0_0_16px_rgba(69,208,255,0.4)] transition-all disabled:opacity-50">
                                                {paymentLoading === booking.id ? <><Loader2 size={11} className="animate-spin" />Processing...</> : <><CreditCard size={11} />Pay ${Number(booking.total_paid).toFixed(2)}</>}
                                            </button>
                                        )}

                                        {/* Trainer: Confirm / Reject — only if acceptance window still open */}
                                        {booking.status === "pending" && isTrainer && !acceptanceExpired && (
                                            <>
                                                {minutesLeft > 0 && minutesLeft < 120 && (
                                                    <span className="text-[10px] text-amber-400/70 font-semibold mr-auto flex items-center gap-1">
                                                        <Clock size={10} /> {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minutesLeft % 60}m to accept
                                                    </span>
                                                )}
                                                <button onClick={() => updateStatus(booking.id, "confirmed")} disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all disabled:opacity-50">
                                                    {actionLoading === booking.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                                                    Confirm
                                                </button>
                                                <button onClick={() => updateStatus(booking.id, "rejected")} disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/8 border border-red-500/18 text-red-400 text-[11px] font-bold hover:bg-red-500/15 transition-all disabled:opacity-50">
                                                    <X size={13} strokeWidth={2.5} /> Reject
                                                </button>
                                            </>
                                        )}
                                        {/* Acceptance expired — show info */}
                                        {booking.status === "pending" && isTrainer && acceptanceExpired && (
                                            <span className="text-[10px] text-red-400/60 font-semibold flex items-center gap-1 mr-auto">
                                                <AlertCircle size={10} /> Acceptance window closed
                                            </span>
                                        )}

                                        {/* Reschedule + Cancel for confirmed future */}
                                        {booking.status === "confirmed" && !isPast && (
                                            <>
                                                <button onClick={() => setRescheduleBooking(booking)}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/8 border border-cyan-500/18 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/16 transition-all">
                                                    <RefreshCw size={11} strokeWidth={2.5} /> Reschedule
                                                </button>
                                                <button onClick={() => setCancelBooking(booking)}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-transparent border border-red-500/18 text-red-400/70 text-[11px] font-bold hover:bg-red-500/8 hover:text-red-400 transition-all">
                                                    <X size={11} /> Cancel
                                                </button>
                                            </>
                                        )}

                                        {/* Athlete: Cancel pending */}
                                        {booking.status === "pending" && !isTrainer && !isPast && (
                                            <button onClick={() => setCancelBooking(booking)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-transparent border border-red-500/18 text-red-400/70 text-[11px] font-bold hover:bg-red-500/8 hover:text-red-400 transition-all w-full sm:w-auto justify-center sm:justify-start">
                                                <X size={11} /> Cancel Request
                                            </button>
                                        )}

                                        {/* Mark Complete — only if paid */}
                                        {booking.status === "confirmed" && booking.status !== "completed" && isTrainer && isPast && isPaid && (
                                            <button onClick={() => updateStatus(booking.id, "completed")} disabled={actionLoading === booking.id}
                                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-bg text-[11px] font-black uppercase tracking-wider hover:shadow-[0_0_14px_rgba(69,208,255,0.35)] transition-all disabled:opacity-50">
                                                {actionLoading === booking.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} strokeWidth={2.5} />}
                                                Mark Complete
                                            </button>
                                        )}
                                        {/* Mark Complete blocked — not paid */}
                                        {booking.status === "confirmed" && booking.status !== "completed" && isTrainer && isPast && !isPaid && (
                                            <span className="text-[10px] text-amber-400/60 font-semibold flex items-center gap-1">
                                                <AlertCircle size={10} /> Cannot complete — payment not received
                                            </span>
                                        )}

                                        {/* Review */}
                                        {booking.status === "completed" && !isTrainer && (
                                            <button onClick={() => openReview(booking)}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
                                                    booking.review
                                                        ? "bg-white/[0.04] border border-white/[0.08] text-text-main/50 hover:text-white hover:bg-white/[0.08]"
                                                        : "bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
                                                }`}>
                                                {booking.review
                                                    ? <><FileText size={11} /> Edit Review</>
                                                    : <><Star size={11} className="fill-current" /> Leave Review</>
                                                }
                                            </button>
                                        )}

                                        {/* Reschedule respond */}
                                        {booking.status === "reschedule_requested" && booking.reschedule_request && booking.reschedule_request.initiated_by !== user?.id && (
                                            <>
                                                <button onClick={() => respondToReschedule(booking.id, booking.reschedule_request!.id, true, booking.reschedule_request!.proposed_time)} disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all disabled:opacity-50">
                                                    {actionLoading === booking.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                                                    Accept
                                                </button>
                                                <button onClick={() => respondToReschedule(booking.id, booking.reschedule_request!.id, false)} disabled={actionLoading === booking.id}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/8 border border-red-500/18 text-red-400 text-[11px] font-bold hover:bg-red-500/15 transition-all disabled:opacity-50">
                                                    <X size={13} strokeWidth={2.5} /> Decline
                                                </button>
                                            </>
                                        )}

                                        {/* Calendar — only for confirmed future sessions or completed */}
                                        {booking.status === "confirmed" && !isExpired && (
                                            <AddToCalendarDropdown bookingId={booking.id} />
                                        )}
                                        {booking.status === "completed" && (
                                            <AddToCalendarDropdown bookingId={booking.id} />
                                        )}
                                    </div>
                                </div>

                                {/* ── Reschedule Info Banner ── */}
                                {booking.status === "reschedule_requested" && booking.reschedule_request && (
                                    <div className="mx-5 mb-5 p-3.5 bg-cyan-500/5 rounded-xl border border-cyan-500/12 flex gap-3">
                                        <CalendarClock size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest mb-1">New Proposed Time</p>
                                            <p className="text-sm font-bold text-white">
                                                {new Date(booking.reschedule_request.proposed_time).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                            </p>
                                            {booking.reschedule_request.reason && (
                                                <p className="text-[11px] text-text-main/45 mt-1">{booking.reschedule_request.reason}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Cancellation Banner ── */}
                                {booking.status === "cancelled" && booking.cancellation_reason && (
                                    <div className="mx-5 mb-5 p-3.5 bg-red-500/5 rounded-xl border border-red-500/12 flex gap-3">
                                        <AlertCircle size={13} className="text-red-400/70 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-red-400/50 uppercase tracking-widest mb-1">Cancellation Reason</p>
                                            <p className="text-sm text-text-main/60 leading-relaxed">{booking.cancellation_reason}</p>
                                            {booking.cancelled_at && (
                                                <p className="text-[10px] text-text-main/25 mt-1.5">
                                                    {new Date(booking.cancelled_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Notes ── */}
                                {booking.athlete_notes && (
                                    <div className="mx-5 mb-5 p-3.5 bg-white/3 rounded-xl border border-white/6 flex gap-3">
                                        <FileText size={12} className="text-text-main/25 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-text-main/25 uppercase tracking-widest mb-1">Session Notes</p>
                                            <p className="text-[12px] text-text-main/55 leading-relaxed">{booking.athlete_notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Modals ── */}
            <ReviewModal isOpen={reviewModalOpen} onClose={() => setReviewModalOpen(false)} booking={reviewBooking} rating={reviewRating} setRating={setReviewRating} text={reviewText} setText={setReviewText} onSubmit={submitReview} isSubmitting={submittingReview} readOnly={isReviewReadOnly} />

            {rescheduleBooking && (
                <RescheduleDialog bookingId={rescheduleBooking.id} currentTime={rescheduleBooking.scheduled_at} sport={rescheduleBooking.sport} trainerId={rescheduleBooking.trainer_id} durationMinutes={rescheduleBooking.duration_minutes || 60} isOpen={true} onClose={() => setRescheduleBooking(null)} onSuccess={() => { setRescheduleBooking(null); if (user) loadBookings(user); }} />
            )}

            {cancelBooking && (
                <CancelBookingDialog bookingId={cancelBooking.id} sport={cancelBooking.sport} otherUserName={cancelBooking.other_user ? `${cancelBooking.other_user.first_name} ${cancelBooking.other_user.last_name}` : "Unknown"} isOpen={true} isPaid={paidBookingIds.has(cancelBooking.id)} totalPaid={Number(cancelBooking.total_paid)} onClose={() => setCancelBooking(null)} onConfirm={cancelWithReason} />
            )}
        </div>
    );
}
