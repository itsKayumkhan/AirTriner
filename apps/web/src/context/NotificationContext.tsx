"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, NotificationRow } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface NotificationContextType {
    notifications: NotificationRow[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    updateNotificationData: (id: string, newData: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        const fetchNotifications = async () => {
            try {
                const { data } = await supabase
                    .from("notifications")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(50);
                
                if (data) {
                    setNotifications(data as NotificationRow[]);
                    setUnreadCount(data.filter(n => !n.read).length);
                }
            } catch (err) {
                console.error("Failed to load notifications:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();

        // Real-time listener
        const channel = supabase
            .channel(`notifications_context_${user.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const markAsRead = async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
        await supabase.from("notifications").update({ read: true }).eq("id", id);
    };

    const markAllRead = async () => {
        if (!user) return;
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    };

    const clearAllNotifications = async () => {
        if (!user) return;
        setNotifications([]);
        setUnreadCount(0);
        await supabase.from("notifications").delete().eq("user_id", user.id);
    };

    const updateNotificationData = async (id: string, newData: any) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, data: newData } : n)));
        await supabase.from("notifications").update({ data: newData }).eq("id", id);
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,
                markAsRead,
                markAllRead,
                clearAllNotifications,
                updateNotificationData
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
