"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, NotificationRow } from "@/lib/supabase";
import { OfferModal } from "@/components/notifications/OfferModal";
import { Bell, CheckCircle, XCircle, PartyPopper, MapPin, Star, Wallet, MessageSquare, Calendar, RefreshCw, ShieldCheck, ShieldAlert, AlertCircle } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

interface OfferNotificationData {
    offer_id?: string;
    offer_status?: string;
    booking_id?: string;
    sender_id?: string;
    thread_id?: string;
    other_user_id?: string;
    url?: string;
    [key: string]: unknown;
}

const OFFER_TYPES = new Set(["OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "OFFER_REJECTED"]);
const BOOKING_TYPES = new Set([
    "BOOKING_REQUEST",
    "BOOKING_REQUESTED",
    "BOOKING_ACCEPTED",
    "BOOKING_REJECTED",
    "BOOKING_REFUNDED",
    "BOOKING_CANCELLED",
    "BOOKING_COMPLETED",
    "BOOKING_CONFIRMED",
]);
const RESCHEDULE_TYPES = new Set([
    "RESCHEDULE_REQUEST",
    "RESCHEDULE_REQUESTED",
    "RESCHEDULE_ACCEPTED",
    "RESCHEDULE_DECLINED",
]);
const MESSAGE_TYPES = new Set(["MESSAGE_RECEIVED", "NEW_MESSAGE"]);
const PROFILE_TYPES = new Set(["PROFILE_VERIFIED", "PROFILE_REJECTED"]);

export default function NotificationsPage() {
    const { markAllRead: ctxMarkAllRead, clearAllNotifications: ctxClearAll } = useNotifications();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [isResponding, setIsResponding] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    useEffect(() => {
        // Show success banner if returning from Stripe payment
        if (searchParams.get("offer_paid") === "true") {
            setPaymentSuccess(true);
            // Clean up URL params
            window.history.replaceState({}, "", "/dashboard/notifications");
            // Auto-hide after 8 seconds
            setTimeout(() => setPaymentSuccess(false), 8000);
        }
    }, [searchParams]);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadNotifications(session);
        }
    }, []);

    const loadNotifications = async (u: AuthUser) => {
        try {
            // 1. Auto-expire any pending offers whose session date has passed
            try {
                await fetch("/api/offers/expire", { method: "POST" });
            } catch (err) {
                console.warn("Failed to run expire offers job:", err);
            }

            // 2. Load notifications
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", u.id)
                .order("created_at", { ascending: false })
                .limit(50);

            const notifs = (data || []) as NotificationRow[];

            // 3. Hydrate each offer notification with the latest training_offers.status
            //    so expired offers show the EXPIRED badge even if offer_status in notif data is stale.
            const offerIds = Array.from(
                new Set(
                    notifs
                        .map((n) => (n.data as OfferNotificationData)?.offer_id)
                        .filter((id): id is string => Boolean(id))
                )
            );

            if (offerIds.length > 0) {
                const { data: offersData } = await supabase
                    .from("training_offers")
                    .select("id, status")
                    .in("id", offerIds);

                const statusMap = new Map<string, string>();
                (offersData || []).forEach((o: { id: string; status: string }) => {
                    statusMap.set(o.id, o.status);
                });

                for (const n of notifs) {
                    const d = n.data as OfferNotificationData;
                    if (d?.offer_id && statusMap.has(d.offer_id)) {
                        const latest = statusMap.get(d.offer_id)!;
                        // Only overwrite if the latest status is terminal/different
                        if (d.offer_status !== latest && (latest === "expired" || latest === "accepted" || latest === "declined")) {
                            n.data = { ...d, offer_status: latest };
                        }
                    }
                }
            }

            setNotifications(notifs);
        } catch (err) {
            console.error("Failed to load notifications:", err);
        } finally {
            setLoading(false);
        }
    };

    const dismissNotification = async (notificationId: string) => {
        try {
            await supabase.from("notifications").delete().eq("id", notificationId);
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            // Close modal if we just dismissed the one being viewed
            if (selectedNotification?.id === notificationId) {
                setShowOfferModal(false);
                setSelectedNotification(null);
            }
        } catch (err) {
            console.error("Failed to dismiss notification:", err);
        }
    };

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ read: true }).eq("id", id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const markAllRead = async () => {
        if (!user) return;
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        ctxMarkAllRead();
    };

    const clearAllNotifications = async () => {
        if (!user) return;
        try {
            await supabase.from("notifications").delete().eq("user_id", user.id);
            setNotifications([]);
            ctxClearAll();
        } catch (err) {
            console.error("Failed to clear notifications:", err);
        }
    };

    const handleOfferResponse = async (notificationId: string, offerId: string, response: "accepted" | "declined") => {
        setIsResponding(true);
        try {
            if (response === "accepted") {
                // Redirect to Stripe Checkout -- booking will be created by webhook after payment
                if (!user) throw new Error("Not logged in");

                // Get athlete email
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
                        offerId,
                        athleteId: user.id,
                        athleteEmail: athleteUser.email,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to create payment session");
                }

                // Redirect to Stripe Checkout
                window.location.href = data.url;
                return; // Don't setIsResponding(false) -- page is navigating away
            }

            // Declined flow stays the same -- no payment needed
            const { error: offerError } = await supabase
                .from("training_offers")
                .update({ status: "declined" })
                .eq("id", offerId);

            if (offerError) throw offerError;

            // Update the notification data so we don't show the buttons again
            const currentNotif = notifications.find(n => n.id === notificationId);
            if (currentNotif) {
                const newData = { ...(currentNotif.data as OfferNotificationData), offer_status: "declined" };
                await supabase
                    .from("notifications")
                    .update({ data: newData })
                    .eq("id", notificationId);

                setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, data: newData } : n));

                // Close modal if open
                setShowOfferModal(false);
                setSelectedNotification(null);
            }
        } catch (err: any) {
            console.error("Failed to respond to offer:", err);
            alert(err.message || "Failed to update offer status. Please try again.");
        } finally {
            setIsResponding(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const typeIcons: Record<string, React.ReactNode> = {
        BOOKING_CONFIRMED:    <CheckCircle   className="text-sky-400 w-5 h-5 shrink-0" />,
        BOOKING_REQUESTED:    <Calendar      className="text-primary w-5 h-5 shrink-0" />,
        BOOKING_ACCEPTED:     <CheckCircle   className="text-sky-400 w-5 h-5 shrink-0" />,
        BOOKING_REJECTED:     <XCircle       className="text-red-400 w-5 h-5 shrink-0" />,
        BOOKING_CANCELLED:    <XCircle       className="text-red-400 w-5 h-5 shrink-0" />,
        BOOKING_REFUNDED:     <Wallet        className="text-amber-400 w-5 h-5 shrink-0" />,
        BOOKING_COMPLETED:    <PartyPopper   className="text-emerald-400 w-5 h-5 shrink-0" />,
        NEW_REQUEST_NEARBY:   <MapPin        className="text-primary w-5 h-5 shrink-0" />,
        REVIEW_RECEIVED:      <Star          className="text-amber-400 w-5 h-5 shrink-0" />,
        REVIEW_REQUEST:       <Star          className="text-amber-400 w-5 h-5 shrink-0" />,
        PAYMENT_RECEIVED:     <Wallet        className="text-green-400 w-5 h-5 shrink-0" />,
        NEW_MESSAGE:          <MessageSquare className="text-violet-400 w-5 h-5 shrink-0" />,
        MESSAGE_RECEIVED:     <MessageSquare className="text-violet-400 w-5 h-5 shrink-0" />,
        RESCHEDULE_REQUESTED: <RefreshCw     className="text-primary w-5 h-5 shrink-0" />,
        RESCHEDULE_ACCEPTED:  <CheckCircle   className="text-sky-400 w-5 h-5 shrink-0" />,
        RESCHEDULE_DECLINED:  <XCircle       className="text-red-400 w-5 h-5 shrink-0" />,
        OFFER_RECEIVED:       <PartyPopper   className="text-primary w-5 h-5 shrink-0" />,
        OFFER_ACCEPTED:       <CheckCircle   className="text-emerald-400 w-5 h-5 shrink-0" />,
        OFFER_DECLINED:       <XCircle       className="text-red-400 w-5 h-5 shrink-0" />,
        PROFILE_VERIFIED:     <ShieldCheck   className="text-emerald-400 w-5 h-5 shrink-0" />,
        PROFILE_REJECTED:     <ShieldAlert   className="text-red-400 w-5 h-5 shrink-0" />,
        SUBSCRIPTION_PAST_DUE: <AlertCircle  className="text-red-400 w-5 h-5 shrink-0" />,
        SUBSCRIPTION_CANCELLED: <AlertCircle className="text-red-400 w-5 h-5 shrink-0" />,
    };
    const typeBg: Record<string, string> = {
        BOOKING_CONFIRMED:    "bg-sky-500/15 border-sky-500/30",
        BOOKING_REQUESTED:    "bg-primary/15 border-primary/30",
        BOOKING_ACCEPTED:     "bg-sky-500/15 border-sky-500/30",
        BOOKING_REJECTED:     "bg-red-500/15 border-red-500/30",
        BOOKING_CANCELLED:    "bg-red-500/15 border-red-500/30",
        BOOKING_REFUNDED:     "bg-amber-500/15 border-amber-500/30",
        BOOKING_COMPLETED:    "bg-emerald-500/15 border-emerald-500/30",
        NEW_REQUEST_NEARBY:   "bg-primary/15 border-primary/30",
        REVIEW_RECEIVED:      "bg-amber-500/15 border-amber-500/30",
        REVIEW_REQUEST:       "bg-amber-500/15 border-amber-500/30",
        PAYMENT_RECEIVED:     "bg-green-500/15 border-green-500/30",
        NEW_MESSAGE:          "bg-violet-500/15 border-violet-500/30",
        MESSAGE_RECEIVED:     "bg-violet-500/15 border-violet-500/30",
        RESCHEDULE_REQUESTED: "bg-primary/15 border-primary/30",
        RESCHEDULE_ACCEPTED:  "bg-sky-500/15 border-sky-500/30",
        RESCHEDULE_DECLINED:  "bg-red-500/15 border-red-500/30",
        OFFER_RECEIVED:       "bg-primary/15 border-primary/30",
        OFFER_ACCEPTED:       "bg-emerald-500/15 border-emerald-500/30",
        OFFER_DECLINED:       "bg-red-500/15 border-red-500/30",
        PROFILE_VERIFIED:     "bg-emerald-500/15 border-emerald-500/30",
        PROFILE_REJECTED:     "bg-red-500/15 border-red-500/30",
        SUBSCRIPTION_PAST_DUE: "bg-red-500/15 border-red-500/30",
        SUBSCRIPTION_CANCELLED: "bg-red-500/15 border-red-500/30",
    };
    const typeDot: Record<string, string> = {
        BOOKING_CONFIRMED:    "bg-sky-400",
        BOOKING_REQUESTED:    "bg-primary",
        BOOKING_ACCEPTED:     "bg-sky-400",
        BOOKING_REJECTED:     "bg-red-400",
        BOOKING_CANCELLED:    "bg-red-400",
        BOOKING_REFUNDED:     "bg-amber-400",
        BOOKING_COMPLETED:    "bg-emerald-400",
        NEW_REQUEST_NEARBY:   "bg-primary",
        REVIEW_RECEIVED:      "bg-amber-400",
        REVIEW_REQUEST:       "bg-amber-400",
        PAYMENT_RECEIVED:     "bg-green-400",
        NEW_MESSAGE:          "bg-violet-400",
        MESSAGE_RECEIVED:     "bg-violet-400",
        RESCHEDULE_REQUESTED: "bg-primary",
        RESCHEDULE_ACCEPTED:  "bg-sky-400",
        RESCHEDULE_DECLINED:  "bg-red-400",
        OFFER_RECEIVED:       "bg-primary",
        OFFER_ACCEPTED:       "bg-emerald-400",
        OFFER_DECLINED:       "bg-red-400",
        PROFILE_VERIFIED:     "bg-emerald-400",
        PROFILE_REJECTED:     "bg-red-400",
        SUBSCRIPTION_PAST_DUE: "bg-red-400",
        SUBSCRIPTION_CANCELLED: "bg-red-400",
    };

    const handleNotificationClick = (n: NotificationRow) => {
        if (!n.read) markAsRead(n.id);

        const data = (n.data || {}) as OfferNotificationData;
        const type = n.type;

        // Offer types -> open existing modal
        if (OFFER_TYPES.has(type)) {
            setSelectedNotification(n);
            setShowOfferModal(true);
            return;
        }

        // Review request -> reviews page
        if (type === "REVIEW_REQUEST") {
            router.push(`/dashboard/reviews`);
            return;
        }

        // Booking events -> bookings list with id query param
        if (BOOKING_TYPES.has(type)) {
            router.push(`/dashboard/bookings?id=${data.booking_id || ""}`);
            return;
        }

        // Reschedule events -> bookings list (jump to booking if known)
        if (RESCHEDULE_TYPES.has(type)) {
            if (data.booking_id) {
                router.push(`/dashboard/bookings?id=${data.booking_id}`);
            } else {
                router.push(`/dashboard/bookings`);
            }
            return;
        }

        // Messages -> messages thread (or list if no thread id)
        if (MESSAGE_TYPES.has(type)) {
            const otherId = data.other_user_id || data.sender_id || data.thread_id;
            if (otherId) {
                router.push(`/dashboard/messages/${otherId}`);
            } else {
                router.push(`/dashboard/messages`);
            }
            return;
        }

        // Profile verification -> profile page
        if (PROFILE_TYPES.has(type)) {
            router.push(`/dashboard/profile`);
            return;
        }

        // Generic data.url fallback — internal /dashboard paths only (open-redirect safe)
        if (typeof data.url === "string" && data.url.startsWith("/dashboard/")) {
            router.push(data.url);
        }
    };

    const timeAgo = (date: string) => {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">Notifications</h1>
                    <p className="text-text-main/60 text-sm font-medium">
                        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="px-4 py-2 rounded-xl border border-white/[0.07] text-text-main/50 text-xs font-bold hover:text-text-main hover:border-white/[0.12] transition-all"
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAllNotifications}
                            className="px-4 py-2 rounded-xl border border-white/[0.07] text-text-main/40 text-xs font-bold hover:text-red-400 hover:border-red-500/20 transition-all"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {paymentSuccess && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                    <CheckCircle className="text-emerald-400 w-5 h-5 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-400">Payment Successful!</p>
                        <p className="text-xs text-text-main/60 mt-0.5">Your training offer has been accepted and the booking is being created. You will receive a confirmation shortly.</p>
                    </div>
                    <button onClick={() => setPaymentSuccess(false)} className="ml-auto text-text-main/40 hover:text-white">
                        <XCircle size={16} />
                    </button>
                </div>
            )}

            {notifications.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center ">
                    <Bell className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1} />
                    <p className="text-text-main/50 font-bold uppercase tracking-widest text-sm">No notifications yet.</p>
                </div>
            ) : (
                <div className="flex flex-col bg-surface rounded-2xl border border-white/5 overflow-hidden ">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className="px-6 py-5 flex items-start gap-4 border-b border-white/[0.04] last:border-0 transition-all cursor-pointer hover:bg-white/[0.04]"
                        >
                            <div className={`mt-0.5 shrink-0 p-2 rounded-xl border ${typeBg[n.type] || "bg-white/[0.04] border-white/[0.06]"}`}>
                                {typeIcons[n.type] || <Bell className="text-text-main/40 w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm ${n.read ? "font-medium text-text-main/60" : "font-bold text-text-main"}`}>
                                        {n.title?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                    {!n.read && (
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeDot[n.type] || "bg-primary"}`} />
                                    )}
                                </div>
                                <p className="text-sm text-text-main/60 font-medium leading-relaxed max-w-xl">
                                    {n.body?.replace(/_/g, ' ')}
                                </p>

                                {n.type === "MESSAGE_RECEIVED" && (n.data as OfferNotificationData)?.offer_id && !(n.data as OfferNotificationData)?.offer_status && (
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedNotification(n);
                                                setShowOfferModal(true);
                                                if (!n.read) markAsRead(n.id);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-primary text-bg font-bold text-xs hover:opacity-90 transition-all"
                                        >
                                            View Offer
                                        </button>
                                    </div>
                                )}
                                {(n.data as OfferNotificationData)?.offer_status && (() => {
                                    const status = (n.data as OfferNotificationData).offer_status;
                                    const isExpired = status === "expired";
                                    const isAccepted = status === "accepted";
                                    const badgeClass = isAccepted
                                        ? "text-green-500 bg-green-500/10 border-green-500/20"
                                        : isExpired
                                            ? "text-red-500 bg-red-500/10 border-red-500/20"
                                            : "text-red-500 bg-red-500/10 border-red-500/20";
                                    return (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className={`inline-block px-3 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg border ${badgeClass}`}>
                                                {isExpired ? "Expired" : `Offer ${status}`}
                                            </span>
                                            {isExpired && (
                                                <span className="text-xs text-text-main/50 italic">This offer has expired</span>
                                            )}
                                            {isExpired && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dismissNotification(n.id);
                                                    }}
                                                    className="ml-auto px-3 py-1 rounded-lg border border-white/10 text-text-main/60 text-[10px] font-bold uppercase tracking-wider hover:text-red-400 hover:border-red-500/30 transition-colors"
                                                >
                                                    Dismiss
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <span className="text-[10px] text-text-main/40 uppercase tracking-widest font-bold whitespace-nowrap mt-1">
                                {timeAgo(n.created_at)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* View Offer Modal */}
            <OfferModal
                isOpen={showOfferModal}
                onClose={() => { setShowOfferModal(false); setSelectedNotification(null); }}
                notification={selectedNotification}
                onResponse={handleOfferResponse}
                isResponding={isResponding}
                onDismiss={dismissNotification}
            />
        </div>
    );
}
