"use client";

import React, { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, NotificationRow } from "@/lib/supabase";
import { OfferModal } from "@/components/notifications/OfferModal";
import { Bell, CheckCircle, XCircle, PartyPopper, MapPin, Star, Wallet, MessageSquare } from "lucide-react";

interface OfferNotificationData {
    offer_id?: string;
    offer_status?: string;
    [key: string]: unknown;
}

export default function NotificationsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [isResponding, setIsResponding] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadNotifications(session);
        }
    }, []);

    const loadNotifications = async (u: AuthUser) => {
        try {
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", u.id)
                .order("created_at", { ascending: false })
                .limit(50);
            setNotifications((data || []) as NotificationRow[]);
        } catch (err) {
            console.error("Failed to load notifications:", err);
        } finally {
            setLoading(false);
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
    };

    const clearAllNotifications = async () => {
        if (!user) return;
        try {
            await supabase.from("notifications").delete().eq("user_id", user.id);
            setNotifications([]);
        } catch (err) {
            console.error("Failed to clear notifications:", err);
        }
    };

    const handleOfferResponse = async (notificationId: string, offerId: string, response: "accepted" | "declined") => {
        setIsResponding(true);
        try {
            // 1. Get the full offer details to get the proposed date and price
            const { data: offer, error: fetchError } = await supabase
                .from("training_offers")
                .select("*")
                .eq("id", offerId)
                .single();

            if (fetchError || !offer) throw new Error("Could not find offer details");

            if (response === "accepted") {
                // 2. Create the booking with the CORRECT scheduled date
                const proposed = offer.proposed_dates as any || {};
                const scheduledAt = proposed.scheduledAt || new Date().toISOString();

                // Fetch real platform fee from DB
                const price = Number(offer.price);
                const { data: settings } = await supabase
                    .from("platform_settings")
                    .select("platform_fee_percentage")
                    .single();
                const feePercent = (settings?.platform_fee_percentage ?? 3) / 100;
                const platformFee = Math.round(price * feePercent * 100) / 100;
                const totalPaid = price + platformFee;

                const { error: bookingError } = await supabase
                    .from("bookings")
                    .insert({
                        athlete_id: offer.athlete_id,
                        trainer_id: offer.trainer_id,
                        sport: offer.sport || "General Training",
                        scheduled_at: scheduledAt,
                        duration_minutes: offer.session_length_min || 60,
                        price: price,
                        platform_fee: platformFee,
                        total_paid: totalPaid,
                        status: "pending",
                        athlete_notes: `Accepted offer: ${offer.message || ""}`,
                        status_history: [{
                            to: "pending",
                            by: user?.id,
                            at: new Date().toISOString(),
                            reason: "Accepted Trainer Offer"
                        }]
                    });

                if (bookingError) throw bookingError;
            }

            // 3. Update the training offer status
            const { error: offerError } = await supabase
                .from("training_offers")
                .update({ status: response })
                .eq("id", offerId);

            if (offerError) throw offerError;

            // Update the notification data so we don't show the buttons again
            const currentNotif = notifications.find(n => n.id === notificationId);
            if (currentNotif) {
                const newData = { ...(currentNotif.data as OfferNotificationData), offer_status: response };
                await supabase
                    .from("notifications")
                    .update({ data: newData })
                    .eq("id", notificationId);

                setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, data: newData } : n));

                // Close modal if open
                setShowOfferModal(false);
                setSelectedNotification(null);
            }
        } catch (err) {
            console.error("Failed to respond to offer:", err);
            alert("Failed to update offer status. Please try again.");
        } finally {
            setIsResponding(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const typeIcons: Record<string, React.ReactNode> = {
        BOOKING_CONFIRMED:   <CheckCircle   className="text-sky-400 w-5 h-5 shrink-0" />,
        BOOKING_REJECTED:    <XCircle        className="text-red-400 w-5 h-5 shrink-0" />,
        BOOKING_CANCELLED:   <XCircle        className="text-red-400 w-5 h-5 shrink-0" />,
        BOOKING_COMPLETED:   <PartyPopper    className="text-emerald-400 w-5 h-5 shrink-0" />,
        NEW_REQUEST_NEARBY:  <MapPin         className="text-primary w-5 h-5 shrink-0" />,
        REVIEW_RECEIVED:     <Star           className="text-amber-400 w-5 h-5 shrink-0" />,
        PAYMENT_RECEIVED:    <Wallet         className="text-green-400 w-5 h-5 shrink-0" />,
        NEW_MESSAGE:         <MessageSquare  className="text-violet-400 w-5 h-5 shrink-0" />,
        RESCHEDULE_ACCEPTED: <CheckCircle    className="text-sky-400 w-5 h-5 shrink-0" />,
        RESCHEDULE_DECLINED: <XCircle        className="text-red-400 w-5 h-5 shrink-0" />,
        REVIEW_REQUEST:      <Star           className="text-amber-400 w-5 h-5 shrink-0" />,
    };
    const typeBg: Record<string, string> = {
        BOOKING_CONFIRMED:   "bg-sky-500/15 border-sky-500/30",
        BOOKING_REJECTED:    "bg-red-500/15 border-red-500/30",
        BOOKING_CANCELLED:   "bg-red-500/15 border-red-500/30",
        BOOKING_COMPLETED:   "bg-emerald-500/15 border-emerald-500/30",
        NEW_REQUEST_NEARBY:  "bg-primary/15 border-primary/30",
        REVIEW_RECEIVED:     "bg-amber-500/15 border-amber-500/30",
        PAYMENT_RECEIVED:    "bg-green-500/15 border-green-500/30",
        NEW_MESSAGE:         "bg-violet-500/15 border-violet-500/30",
        RESCHEDULE_ACCEPTED: "bg-sky-500/15 border-sky-500/30",
        RESCHEDULE_DECLINED: "bg-red-500/15 border-red-500/30",
        REVIEW_REQUEST:      "bg-amber-500/15 border-amber-500/30",
    };
    const typeDot: Record<string, string> = {
        BOOKING_CONFIRMED:   "bg-sky-400",
        BOOKING_REJECTED:    "bg-red-400",
        BOOKING_CANCELLED:   "bg-red-400",
        BOOKING_COMPLETED:   "bg-emerald-400",
        NEW_REQUEST_NEARBY:  "bg-primary",
        REVIEW_RECEIVED:     "bg-amber-400",
        PAYMENT_RECEIVED:    "bg-green-400",
        NEW_MESSAGE:         "bg-violet-400",
        RESCHEDULE_ACCEPTED: "bg-sky-400",
        RESCHEDULE_DECLINED: "bg-red-400",
        REVIEW_REQUEST:      "bg-amber-400",
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
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">Notifications</h1>
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
                            onClick={() => !n.read && markAsRead(n.id)}
                            className={`px-6 py-5 flex items-start gap-4 border-b border-white/[0.04] last:border-0 transition-all ${n.read
                                ? "hover:bg-white/[0.02] cursor-default"
                                : "bg-white/[0.025] hover:bg-white/[0.04] cursor-pointer"
                                }`}
                        >
                            <div className={`mt-0.5 shrink-0 p-2 rounded-xl border ${typeBg[n.type] || "bg-white/[0.04] border-white/[0.06]"}`}>
                                {typeIcons[n.type] || <Bell className="text-text-main/40 w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm ${n.read ? "font-medium text-text-main/60" : "font-bold text-text-main"}`}>
                                        {n.title}
                                    </span>
                                    {!n.read && (
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeDot[n.type] || "bg-primary"}`} />
                                    )}
                                </div>
                                <p className="text-sm text-text-main/60 font-medium leading-relaxed max-w-xl">
                                    {n.body}
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
                                {(n.data as OfferNotificationData)?.offer_status && (
                                    <div className="mt-3">
                                        <span className={`inline-block px-3 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg border ${(n.data as OfferNotificationData).offer_status === 'accepted' ? 'text-green-500 bg-green-500/10 border-green-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}>
                                            Offer {(n.data as OfferNotificationData).offer_status}
                                        </span>
                                    </div>
                                )}
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
            />
        </div>
    );
}
