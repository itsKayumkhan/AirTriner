"use client";

import { Bell, CheckCircle, XCircle, PartyPopper, MapPin, Star, Wallet, MessageSquare } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, NotificationRow } from "@/lib/supabase";

export default function NotificationsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);

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

    const unreadCount = notifications.filter((n) => !n.read).length;

    const typeIcons: Record<string, React.ReactNode> = {
        BOOKING_CONFIRMED: <CheckCircle className="text-primary w-5 h-5 shrink-0" />,
        BOOKING_CANCELLED: <XCircle className="text-red-500 w-5 h-5 shrink-0" />,
        BOOKING_COMPLETED: <PartyPopper className="text-primary w-5 h-5 shrink-0" />,
        NEW_REQUEST_NEARBY: <MapPin className="text-primary w-5 h-5 shrink-0" />,
        REVIEW_RECEIVED: <Star className="text-orange-500 w-5 h-5 shrink-0" />,
        PAYMENT_RECEIVED: <Wallet className="text-green-500 w-5 h-5 shrink-0" />,
        NEW_MESSAGE: <MessageSquare className="text-blue-500 w-5 h-5 shrink-0" />,
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
                <div className="flex gap-3">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="px-4 py-2.5 rounded-xl border border-white/5 bg-surface text-primary text-xs font-bold hover:bg-white/5 transition-colors"
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAllNotifications}
                            className="px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {notifications.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center shadow-[0_0_30px_rgba(163,255,18,0.02)]">
                    <Bell className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1} />
                    <p className="text-text-main/50 font-bold uppercase tracking-widest text-sm">No notifications yet.</p>
                </div>
            ) : (
                <div className="flex flex-col bg-surface rounded-2xl border border-white/5 overflow-hidden shadow-[0_0_30px_rgba(163,255,18,0.02)]">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => !n.read && markAsRead(n.id)}
                            className={`px-6 py-5 flex items-start gap-5 border-b border-white/5 last:border-0 transition-all ${n.read
                                    ? "bg-transparent hover:bg-white/5 cursor-default"
                                    : "bg-primary/5 hover:bg-primary/10 cursor-pointer"
                                }`}
                        >
                            <div className="mt-1 shrink-0 p-2.5 rounded-xl bg-[#272A35] border border-white/5 shadow-sm">
                                {typeIcons[n.type] || <Bell className="text-text-main/60 w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm ${n.read ? "font-bold text-text-main/80" : "font-black text-text-main"}`}>
                                        {n.title}
                                    </span>
                                    {!n.read && (
                                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(163,255,18,0.8)]" />
                                    )}
                                </div>
                                <p className="text-sm text-text-main/60 font-medium leading-relaxed max-w-xl">
                                    {n.body}
                                </p>
                            </div>
                            <span className="text-[10px] text-text-main/40 uppercase tracking-widest font-bold whitespace-nowrap mt-1">
                                {timeAgo(n.created_at)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
