"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";
import { Inbox, Activity, Clock, DollarSign, MapPin, Star, Check, X } from "lucide-react";

type BookingWithUser = BookingRow & {
    other_user?: { first_name: string; last_name: string; email: string };
};

export default function BookingsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [bookings, setBookings] = useState<BookingWithUser[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Review modal state
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewBooking, setReviewBooking] = useState<BookingWithUser | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadBookings(session);
        }
    }, []);

    const loadBookings = async (u: AuthUser) => {
        try {
            const column = u.role === "trainer" ? "trainer_id" : "athlete_id";
            const { data: bookingData } = await supabase
                .from("bookings")
                .select("*")
                .eq(column, u.id)
                .order("scheduled_at", { ascending: false });

            const allBookings = (bookingData || []) as BookingRow[];
            const otherIds = allBookings.map((b) => (u.role === "trainer" ? b.athlete_id : b.trainer_id));

            const { data: users } = await supabase
                .from("users")
                .select("id, first_name, last_name, email")
                .in("id", [...new Set(otherIds)]);

            const usersMap = new Map(
                (users || []).map((u: { id: string; first_name: string; last_name: string; email: string }) => [u.id, u])
            );

            setBookings(
                allBookings.map((b) => ({
                    ...b,
                    other_user: usersMap.get(u.role === "trainer" ? b.athlete_id : b.trainer_id) as BookingWithUser["other_user"],
                }))
            );
        } catch (err) {
            console.error("Failed to load bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    const updateBookingStatus = async (bookingId: string, newStatus: string) => {
        setActionLoading(bookingId);
        try {
            const updates: Record<string, unknown> = { status: newStatus };
            if (newStatus === "cancelled") {
                updates.cancelled_at = new Date().toISOString();
            }

            await supabase.from("bookings").update(updates).eq("id", bookingId);

            // Get booking details for notification
            const booking = bookings.find((b) => b.id === bookingId);
            if (booking) {
                const isTrainer = user?.role === "trainer";
                const isAthlete = user?.role === "athlete";

                // Send notification when coach confirms booking
                if (newStatus === "confirmed" && isTrainer) {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_CONFIRMED",
                        title: "Booking Confirmed",
                        body: `Your trainer has confirmed your booking for ${booking.sport}.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }

                // Send notification when coach marks complete
                if (newStatus === "completed" && isTrainer) {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_COMPLETED",
                        title: "Session Completed",
                        body: `Your ${booking.sport} session has been marked as completed. Please leave a review!`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }

                // Send notification when athlete cancels (to trainer)
                if (newStatus === "cancelled" && isAthlete) {
                    await supabase.from("notifications").insert({
                        user_id: booking.trainer_id,
                        type: "BOOKING_CANCELLED",
                        title: "Booking Cancelled",
                        body: `A booking for ${booking.sport} has been cancelled by the athlete.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }

                // Send notification when trainer rejects booking
                if (newStatus === "rejected" && isTrainer) {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_REJECTED",
                        title: "Booking Rejected",
                        body: `Your booking request for ${booking.sport} was declined by the trainer.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }

                // Send notification when trainer cancels (to athlete)
                if (newStatus === "cancelled" && isTrainer) {
                    await supabase.from("notifications").insert({
                        user_id: booking.athlete_id,
                        type: "BOOKING_CANCELLED",
                        title: "Booking Cancelled",
                        body: `Your booking for ${booking.sport} has been cancelled by the trainer.`,
                        data: { booking_id: bookingId },
                        read: false,
                    });
                }
            }

            setBookings((prev) =>
                prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus as BookingRow["status"] } : b))
            );
        } catch (err) {
            console.error("Failed to update booking:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const submitReview = async () => {
        if (!user || !reviewBooking) return;
        setSubmittingReview(true);
        try {
            await supabase.from("reviews").insert({
                booking_id: reviewBooking.id,
                reviewer_id: user.id,
                reviewee_id: reviewBooking.trainer_id,
                rating: reviewRating,
                review_text: reviewText || null,
                is_public: true,
            });

            // Send notification to trainer
            await supabase.from("notifications").insert({
                user_id: reviewBooking.trainer_id,
                type: "REVIEW_RECEIVED",
                title: "New Review Received",
                body: `You received a ${reviewRating}-star review for your ${reviewBooking.sport} session.`,
                data: { booking_id: reviewBooking.id },
                read: false,
            });

            setReviewModalOpen(false);
            setReviewBooking(null);
            setReviewRating(5);
            setReviewText("");
        } catch (err) {
            console.error("Failed to submit review:", err);
        } finally {
            setSubmittingReview(false);
        }
    };

    const openReviewModal = (booking: BookingWithUser) => {
        setReviewBooking(booking);
        setReviewModalOpen(true);
    };

    const filteredBookings = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

    const statusColors: Record<string, { bg: string; text: string; border: string }> = {
        pending: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/20" },
        confirmed: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
        completed: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
        cancelled: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
        rejected: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
        no_show: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20" },
        disputed: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
    };

    const filters = ["all", "pending", "confirmed", "completed", "cancelled", "rejected"];

    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">
                        {user?.role === "trainer" ? "My Sessions" : "My Bookings"}
                    </h1>
                    <p className="text-text-main/60 text-sm">{bookings.length} total bookings</p>
                </div>
                {user?.role === "athlete" && (
                    <a
                        href="/dashboard/search"
                        className="px-5 py-2.5 rounded-xl bg-primary text-bg font-bold text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all"
                    >
                        + Book Trainer
                    </a>
                )}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {filters.map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-2 rounded-full text-xs font-bold capitalize transition-all border ${filter === f
                            ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_10px_rgba(163,255,18,0.1)]"
                            : "bg-surface border-white/5 text-text-main/60 hover:text-text-main hover:border-white/10"
                            }`}
                    >
                        {f === "all" ? `All (${bookings.length})` : `${f} (${bookings.filter((b) => b.status === f).length})`}
                    </button>
                ))}
            </div>

            {/* Bookings List */}
            {filteredBookings.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center">
                    <div className="flex justify-center mb-4 text-text-main/40">
                        <Inbox size={48} strokeWidth={1} />
                    </div>
                    <p className="text-text-main/60">No {filter !== "all" ? filter : ""} bookings found.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {filteredBookings.map((booking) => {
                        const sc = statusColors[booking.status] || statusColors.pending;
                        const date = new Date(booking.scheduled_at);
                        const isPast = date < new Date();
                        const isTrainer = user?.role === "trainer";

                        return (
                            <div
                                key={booking.id}
                                className="bg-surface rounded-2xl border border-white/5 p-6 transition-all hover:border-white/10"
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    {/* Left: User + details */}
                                    <div className="flex gap-4 flex-1 min-w-[240px]">
                                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-bg font-black text-lg shadow-[0_0_10px_rgba(163,255,18,0.2)] shrink-0">
                                            {booking.other_user ? `${booking.other_user.first_name[0]}${booking.other_user.last_name[0]}` : "?"}
                                        </div>
                                        <div>
                                            <div className="text-base font-bold text-text-main mb-1">
                                                {booking.other_user ? `${booking.other_user.first_name} ${booking.other_user.last_name}` : "Unknown User"}
                                            </div>
                                            <div className="text-sm text-text-main/60 flex flex-wrap gap-4 font-medium">
                                                <span className="flex items-center gap-1.5"><Activity size={14} className="text-primary" /> {booking.sport}</span>
                                                <span className="flex items-center gap-1.5"><Clock size={14} /> {booking.duration_minutes} min</span>
                                                <span className="flex items-center gap-1.5 font-bold text-text-main"><DollarSign size={14} className="text-green-500" /> {Number(booking.total_paid).toFixed(2)}</span>
                                            </div>
                                            {booking.address && (
                                                <div className="text-xs text-text-main/40 mt-2 flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" /> {booking.address}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Date + status + actions */}
                                    <div className="text-right min-w-[180px] lg:flex lg:flex-col lg:items-end">
                                        <div className="text-sm font-bold text-text-main mb-1">
                                            {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                        </div>
                                        <div className="text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2.5">
                                            {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        </div>
                                        <span
                                            className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${sc.bg} ${sc.text} ${sc.border}`}
                                        >
                                            {booking.status.replace("_", " ")}
                                        </span>

                                        {/* Action buttons */}
                                        <div className="mt-4 flex gap-2 justify-end">
                                            {booking.status === "pending" && isTrainer && (
                                                <>
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-500 text-xs font-bold hover:bg-green-500 hover:text-bg transition-all flex items-center justify-center gap-1"
                                                    >
                                                        {actionLoading === booking.id ? "..." : <><Check size={14} strokeWidth={3} /> Confirm</>}
                                                    </button>
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, "rejected")}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2 rounded-lg bg-transparent border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <X size={14} strokeWidth={3} /> Reject
                                                    </button>
                                                </>
                                            )}
                                            {booking.status === "confirmed" && !isPast && (
                                                <button
                                                    onClick={() => updateBookingStatus(booking.id, "cancelled")}
                                                    disabled={actionLoading === booking.id}
                                                    className="px-4 py-2 rounded-lg bg-transparent border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            {booking.status === "pending" && !isTrainer && !isPast && (
                                                <button
                                                    onClick={() => updateBookingStatus(booking.id, "cancelled")}
                                                    disabled={actionLoading === booking.id}
                                                    className="px-4 py-2 rounded-lg bg-transparent border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            {booking.status === "confirmed" && isTrainer && isPast && (
                                                <button
                                                    onClick={() => updateBookingStatus(booking.id, "completed")}
                                                    disabled={actionLoading === booking.id}
                                                    className="px-4 py-2 rounded-lg bg-primary text-bg text-xs font-bold hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                                                >
                                                    Mark Complete
                                                </button>
                                            )}
                                            {booking.status === "completed" && !isTrainer && (
                                                <button
                                                    onClick={() => openReviewModal(booking)}
                                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-500 text-bg text-xs font-bold hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Star size={14} className="fill-current" /> Leave Review
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {booking.athlete_notes && (
                                    <div className="mt-5 p-4 bg-[#272A35] rounded-xl border border-white/5">
                                        <div className="text-xs font-bold text-text-main/40 uppercase tracking-widest mb-1.5">Notes</div>
                                        <div className="text-sm text-text-main/80 font-medium leading-relaxed">{booking.athlete_notes}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Review Modal */}
            {reviewModalOpen && reviewBooking && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6"
                    onClick={(e) => { if (e.target === e.currentTarget) setReviewModalOpen(false); }}
                >
                    <div className="bg-surface border border-white/5 rounded-[24px] p-8 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black font-display uppercase tracking-wider">
                                Leave a Review
                            </h3>
                            <button onClick={() => setReviewModalOpen(false)} className="text-text-main/40 hover:text-text-main transition-colors text-xl">✕</button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm font-medium text-text-main/60 mb-4">
                                How was your session with {reviewBooking.other_user?.first_name}?
                            </p>

                            {/* Star Rating */}
                            <div className="flex gap-2 justify-center mb-6">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setReviewRating(star)}
                                        className={`text-4xl transition-colors ${star <= reviewRating ? "text-amber-500" : "text-text-main/20 hover:text-text-main/40"}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>

                            {/* Review Text */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">
                                    Your Review (optional)
                                </label>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder="Share your experience..."
                                    className="w-full bg-[#272A35] border border-white/5 rounded-xl text-sm text-text-main p-4 min-h-[120px] outline-none focus:border-primary/50 transition-colors resize-y custom-scrollbar"
                                />
                            </div>

                            <button
                                onClick={submitReview}
                                disabled={submittingReview}
                                className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${submittingReview
                                    ? "bg-white/5 text-text-main/40 cursor-not-allowed"
                                    : "bg-primary text-bg hover:shadow-[0_0_15px_rgba(163,255,18,0.3)]"
                                    }`}
                            >
                                {submittingReview ? "Submitting..." : "Submit Review"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
