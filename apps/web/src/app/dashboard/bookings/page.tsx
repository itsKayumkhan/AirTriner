"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";
import { Inbox, Activity, Clock, DollarSign, MapPin, Star, Check, X, RefreshCw, FileText, CalendarClock } from "lucide-react";
import { RescheduleDialog } from "@/components/bookings/RescheduleDialog";
import { AddToCalendarDropdown } from "@/components/bookings/AddToCalendarDropdown";
import { CancelBookingDialog } from "@/components/bookings/CancelBookingDialog";

type RescheduleInfo = {
    id: string;
    proposed_time: string;
    reason: string | null;
    initiated_by: string;
};

type BookingWithUser = BookingRow & {
    other_user?: { first_name: string; last_name: string; email: string };
    reschedule_request?: RescheduleInfo | null;
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

    // Reschedule dialog state
    const [rescheduleBooking, setRescheduleBooking] = useState<BookingWithUser | null>(null);

    // Cancel dialog state
    const [cancelBooking, setCancelBooking] = useState<BookingWithUser | null>(null);

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

            // Fetch pending reschedule requests for these bookings
            const rescheduleBookingIds = allBookings
                .filter((b) => b.status === "reschedule_requested")
                .map((b) => b.id);

            let rescheduleMap = new Map<string, RescheduleInfo>();
            if (rescheduleBookingIds.length > 0) {
                const { data: rescheduleData } = await supabase
                    .from("reschedule_requests")
                    .select("id, booking_id, proposed_time, reason, initiated_by")
                    .in("booking_id", rescheduleBookingIds)
                    .eq("status", "pending");

                (rescheduleData || []).forEach((r: any) => {
                    rescheduleMap.set(r.booking_id, {
                        id: r.id,
                        proposed_time: r.proposed_time,
                        reason: r.reason,
                        initiated_by: r.initiated_by,
                    });
                });
            }

            setBookings(
                allBookings.map((b) => ({
                    ...b,
                    other_user: usersMap.get(u.role === "trainer" ? b.athlete_id : b.trainer_id) as BookingWithUser["other_user"],
                    reschedule_request: rescheduleMap.get(b.id) || null,
                }))
            );
        } catch (err) {
            console.error("Failed to load bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    const cancelWithReason = async (bookingId: string, reason: string) => {
        setActionLoading(bookingId);
        try {
            await supabase.from("bookings").update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason,
                updated_at: new Date().toISOString(),
            }).eq("id", bookingId);

            // Send notification to the other party
            const booking = bookings.find((b) => b.id === bookingId);
            if (booking && user) {
                const notifyUserId = user.role === "trainer" ? booking.athlete_id : booking.trainer_id;
                await supabase.from("notifications").insert({
                    user_id: notifyUserId,
                    type: "BOOKING_CANCELLED",
                    title: "Booking Cancelled",
                    body: `Your ${booking.sport} booking has been cancelled. Reason: ${reason}`,
                    data: { booking_id: bookingId },
                    read: false,
                });
            }

            // Refresh bookings list
            if (user) loadBookings(user);
        } catch (err) {
            console.error("Failed to cancel booking:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const updateBookingStatus = async (bookingId: string, newStatus: string) => {
        setActionLoading(bookingId);
        try {
            const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };

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

    const respondToReschedule = async (bookingId: string, rescheduleId: string, accept: boolean, proposedTime?: string) => {
        setActionLoading(bookingId);
        try {
            // Update reschedule request status
            await supabase
                .from("reschedule_requests")
                .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
                .eq("id", rescheduleId);

            if (accept && proposedTime) {
                // Update booking with new time and set back to confirmed
                await supabase
                    .from("bookings")
                    .update({ scheduled_at: proposedTime, status: "confirmed", updated_at: new Date().toISOString() })
                    .eq("id", bookingId);
            } else {
                // Declined — revert booking to confirmed with original time
                await supabase
                    .from("bookings")
                    .update({ status: "confirmed", updated_at: new Date().toISOString() })
                    .eq("id", bookingId);
            }

            // Send notification
            const booking = bookings.find((b) => b.id === bookingId);
            if (booking?.reschedule_request) {
                const notifyUserId = booking.reschedule_request.initiated_by;
                await supabase.from("notifications").insert({
                    user_id: notifyUserId,
                    type: accept ? "RESCHEDULE_ACCEPTED" : "RESCHEDULE_DECLINED",
                    title: accept ? "Reschedule Accepted" : "Reschedule Declined",
                    body: accept
                        ? `Your reschedule request for ${booking.sport} has been accepted!`
                        : `Your reschedule request for ${booking.sport} was declined. The original time remains.`,
                    data: { booking_id: bookingId },
                    read: false,
                });
            }

            // Refresh bookings
            if (user) loadBookings(user);
        } catch (err) {
            console.error("Failed to respond to reschedule:", err);
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
        reschedule_requested: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/20" },
    };

    const filters = ["all", "pending", "confirmed", "completed", "cancelled", "rejected"];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        {user?.role === "trainer" ? "My Sessions" : "My Bookings"}
                    </h1>
                    <p className="text-text-main/60 font-medium text-[15px]">{bookings.length} total bookings</p>
                </div>
                {user?.role === "athlete" && (
                    <a
                        href="/dashboard/search"
                        className="px-6 py-3 rounded-xl bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all whitespace-nowrap"
                    >
                        + Book Trainer
                    </a>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-8 bg-[#1A1C23] p-2 rounded-2xl border border-white/5 shadow-sm w-fit">
                {filters.map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${filter === f
                            ? "bg-[#272A35] text-white shadow-md border border-white/10"
                            : "bg-transparent text-text-main/50 hover:text-white hover:bg-white/5 border border-transparent"
                            }`}
                    >
                        {f === "all" ? `All (${bookings.length})` : `${f} (${bookings.filter((b) => b.status === f).length})`}
                    </button>
                ))}
            </div>

            {/* Bookings List */}
            {filteredBookings.length === 0 ? (
                <div className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-16 text-center shadow-md">
                    <div className="flex justify-center mb-4 text-text-main/20">
                        <Inbox size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">No bookings found</h3>
                    <p className="text-text-main/50 text-sm">You have no {filter !== "all" ? filter : ""} bookings at the moment.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {filteredBookings.map((booking) => {
                        const sc = statusColors[booking.status] || statusColors.pending;
                        const date = new Date(booking.scheduled_at);
                        const isPast = date < new Date();
                        const isTrainer = user?.role === "trainer";

                        return (
                            <div
                                key={booking.id}
                                className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-6 lg:p-8 transition-all hover:border-white/10 shadow-md group"
                            >
                                <div className="flex items-start justify-between gap-6 flex-wrap">
                                    {/* Left: User + details */}
                                    <div className="flex gap-5 flex-1 min-w-[280px]">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl border border-primary/20 shrink-0 shadow-sm">
                                            {booking.other_user ? `${booking.other_user.first_name[0]}${booking.other_user.last_name[0]}` : "?"}
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="text-[18px] font-bold text-white mb-2 leading-none">
                                                {booking.other_user ? `${booking.other_user.first_name} ${booking.other_user.last_name}` : "Unknown User"}
                                            </div>
                                            <div className="text-sm text-text-main/60 flex flex-wrap gap-x-6 gap-y-2 font-medium">
                                                <span className="flex items-center gap-2"><Activity size={16} className="text-primary" /> {booking.sport}</span>
                                                <span className="flex items-center gap-2"><Clock size={16} className="text-text-main/40" /> {booking.duration_minutes} min</span>
                                                <span className="flex items-center gap-1.5 font-bold text-white bg-[#12141A] px-2 py-0.5 rounded-md border border-white/5"><DollarSign size={14} className="text-green-500" /> {Number(booking.total_paid).toFixed(2)}</span>
                                            </div>
                                            {booking.address && (
                                                <div className="text-[13px] text-text-main/50 mt-3 flex items-start gap-2 bg-[#12141A] p-2 rounded-lg border border-white/5 w-fit">
                                                    <MapPin size={14} className="text-primary/70 shrink-0 mt-0.5" />
                                                    <span>{booking.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Date + status + actions */}
                                    <div className="text-right min-w-[200px] lg:flex lg:flex-col lg:items-end">
                                        <div className="text-[15px] font-bold text-white mb-1">
                                            {date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                                        </div>
                                        <div className="text-[13px] font-bold text-text-main/40 uppercase tracking-widest mb-3">
                                            {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        </div>
                                        <span
                                            className={`inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border ${sc.bg} ${sc.text} ${sc.border}`}
                                        >
                                            {booking.status.replace("_", " ")}
                                        </span>

                                        {/* Action buttons */}
                                        <div className="mt-5 flex gap-3 justify-end flex-wrap">
                                            {booking.status === "pending" && isTrainer && (
                                                <>
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {actionLoading === booking.id ? "..." : <><Check size={16} strokeWidth={2.5} /> Confirm</>}
                                                    </button>
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, "rejected")}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2.5 rounded-xl bg-[#12141A] border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <X size={16} strokeWidth={2.5} /> Reject
                                                    </button>
                                                </>
                                            )}
                                            {booking.status === "confirmed" && !isPast && (
                                                <>
                                                    <button
                                                        onClick={() => setRescheduleBooking(booking)}
                                                        className="px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-xs font-bold hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <RefreshCw size={14} strokeWidth={2.5} /> Reschedule
                                                    </button>
                                                    <button
                                                        onClick={() => setCancelBooking(booking)}
                                                        className="px-4 py-2.5 rounded-xl bg-[#12141A] border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                            {booking.status === "pending" && !isTrainer && !isPast && (
                                                <button
                                                    onClick={() => setCancelBooking(booking)}
                                                    className="px-4 py-2.5 rounded-xl bg-[#12141A] border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                                                >
                                                    Cancel Request
                                                </button>
                                            )}
                                            {booking.status === "confirmed" && isTrainer && isPast && (
                                                <button
                                                    onClick={() => updateBookingStatus(booking.id, "completed")}
                                                    disabled={actionLoading === booking.id}
                                                    className="px-5 py-2.5 rounded-xl bg-primary text-bg text-xs font-black uppercase tracking-widest hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Mark Complete
                                                </button>
                                            )}
                                            {booking.status === "completed" && !isTrainer && (
                                                <button
                                                    onClick={() => openReviewModal(booking)}
                                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-bg text-xs font-black uppercase tracking-widest hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Star size={16} className="fill-current" /> Leave Review
                                                </button>
                                            )}

                                            {/* Reschedule Response — Accept/Decline for the other party */}
                                            {booking.status === "reschedule_requested" && booking.reschedule_request && booking.reschedule_request.initiated_by !== user?.id && (
                                                <>
                                                    <button
                                                        onClick={() => respondToReschedule(booking.id, booking.reschedule_request!.id, true, booking.reschedule_request!.proposed_time)}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {actionLoading === booking.id ? "..." : <><Check size={16} strokeWidth={2.5} /> Accept</>}
                                                    </button>
                                                    <button
                                                        onClick={() => respondToReschedule(booking.id, booking.reschedule_request!.id, false)}
                                                        disabled={actionLoading === booking.id}
                                                        className="px-4 py-2.5 rounded-xl bg-[#12141A] border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <X size={16} strokeWidth={2.5} /> Decline
                                                    </button>
                                                </>
                                            )}

                                            {/* Waiting badge for the requester */}
                                            {booking.status === "reschedule_requested" && booking.reschedule_request && booking.reschedule_request.initiated_by === user?.id && (
                                                <span className="px-4 py-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-cyan-500/60 text-xs font-bold flex items-center gap-1.5">
                                                    <Clock size={14} /> Waiting for response...
                                                </span>
                                            )}

                                            {/* Calendar Sync — show for confirmed or completed bookings */}
                                            {(booking.status === "confirmed" || booking.status === "completed") && (
                                                <AddToCalendarDropdown bookingId={booking.id} />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reschedule Request Info Banner */}
                                {booking.status === "reschedule_requested" && booking.reschedule_request && (
                                    <div className="mt-6 p-5 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                                        <div className="text-[11px] font-bold text-cyan-500/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <CalendarClock size={12} /> Reschedule Request
                                        </div>
                                        <div className="text-[14px] text-text-main/80 font-medium">
                                            <span className="text-text-main/40 text-xs">Proposed time: </span>
                                            <span className="text-white font-bold">
                                                {new Date(booking.reschedule_request.proposed_time).toLocaleString("en-US", {
                                                    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                                                })}
                                            </span>
                                        </div>
                                        {booking.reschedule_request.reason && (
                                            <div className="text-[13px] text-text-main/50 mt-2">
                                                <span className="text-text-main/40 text-xs">Reason: </span>{booking.reschedule_request.reason}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Cancellation Reason Banner */}
                                {booking.status === "cancelled" && booking.cancellation_reason && (
                                    <div className="mt-6 p-5 bg-red-500/5 rounded-xl border border-red-500/10">
                                        <div className="text-[11px] font-bold text-red-500/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <X size={12} /> Cancellation Reason
                                        </div>
                                        <div className="text-[14px] text-text-main/80 font-medium leading-relaxed">
                                            {booking.cancellation_reason}
                                        </div>
                                        {booking.cancelled_at && (
                                            <div className="text-[11px] text-text-main/30 mt-2 italic">
                                                Cancelled on {new Date(booking.cancelled_at).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {booking.athlete_notes && (
                                    <div className="mt-6 p-5 bg-[#12141A] rounded-xl border border-white/5">
                                        <div className="text-[11px] font-bold text-text-main/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <FileText size={12} /> Notes
                                        </div>
                                        <div className="text-[14px] text-text-main/80 font-medium leading-relaxed">{booking.athlete_notes}</div>
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6"
                    onClick={(e) => { if (e.target === e.currentTarget) setReviewModalOpen(false); }}
                >
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[28px] p-8 md:p-10 w-full max-w-[500px] animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black font-display uppercase tracking-wider text-white">
                                Leave a Review
                            </h3>
                            <button onClick={() => setReviewModalOpen(false)} className="text-text-main/30 hover:text-white transition-colors bg-[#12141A] w-10 h-10 rounded-full flex items-center justify-center border border-white/5 hover:border-white/20">✕</button>
                        </div>

                        <div className="mb-6">
                            <p className="text-[15px] font-medium text-text-main/70 mb-6 bg-[#12141A] p-4 rounded-xl border border-white/5 leading-relaxed">
                                How was your session with <span className="font-bold text-white">{reviewBooking.other_user?.first_name}</span>?
                            </p>

                            {/* Star Rating */}
                            <div className="flex gap-3 justify-center mb-8">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setReviewRating(star)}
                                        className={`text-5xl transition-all duration-200 hover:scale-110 active:scale-95 ${star <= reviewRating ? "text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" : "text-white/5 hover:text-white/20"}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>

                            {/* Review Text */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-text-main/50 uppercase tracking-widest mb-3">
                                    Your Review <span className="text-text-main/30 lowercase font-medium tracking-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder="Share your experience (what went well, what could be improved?)..."
                                    className="w-full bg-[#12141A] border border-white/10 rounded-xl text-[15px] text-white p-5 min-h-[140px] outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all resize-y custom-scrollbar placeholder:text-text-main/20"
                                />
                            </div>

                            <button
                                onClick={submitReview}
                                disabled={submittingReview}
                                className={`w-full py-4 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all shadow-lg ${submittingReview
                                    ? "bg-white/5 text-text-main/40 cursor-not-allowed border border-white/5"
                                    : "bg-primary text-bg hover:shadow-[0_0_20px_rgba(163,255,18,0.4)] hover:-translate-y-0.5"
                                    }`}
                            >
                                {submittingReview ? "Submitting..." : "Submit Review"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reschedule Dialog */}
            {rescheduleBooking && (
                <RescheduleDialog
                    bookingId={rescheduleBooking.id}
                    currentTime={rescheduleBooking.scheduled_at}
                    sport={rescheduleBooking.sport}
                    isOpen={true}
                    onClose={() => setRescheduleBooking(null)}
                    onSuccess={() => {
                        setRescheduleBooking(null);
                        if (user) loadBookings(user);
                    }}
                />
            )}

            {/* Cancel Dialog */}
            {cancelBooking && (
                <CancelBookingDialog
                    bookingId={cancelBooking.id}
                    sport={cancelBooking.sport}
                    otherUserName={cancelBooking.other_user ? `${cancelBooking.other_user.first_name} ${cancelBooking.other_user.last_name}` : "Unknown User"}
                    isOpen={true}
                    onClose={() => setCancelBooking(null)}
                    onConfirm={cancelWithReason}
                />
            )}
        </div>
    );
}
