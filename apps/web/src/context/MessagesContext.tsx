"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface MessagesContextType {
    unreadCount: number;
    markConversationRead: (bookingId: string) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = useCallback(async () => {
        if (!user) { setUnreadCount(0); return; }
        try {
            const { data: bookings } = await supabase
                .from("bookings")
                .select("id")
                .or(`athlete_id.eq.${user.id},trainer_id.eq.${user.id}`)
                .in("status", ["confirmed", "completed", "pending"]);

            if (!bookings?.length) { setUnreadCount(0); return; }

            const { count } = await supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .in("booking_id", bookings.map(b => b.id))
                .neq("sender_id", user.id)
                .is("read_at", null);

            setUnreadCount(count ?? 0);
        } catch (err) {
            console.error("Failed to fetch unread message count:", err);
        }
    }, [user]);

    const markConversationRead = useCallback(async (bookingId: string) => {
        if (!user) return;
        try {
            await supabase
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("booking_id", bookingId)
                .neq("sender_id", user.id)
                .is("read_at", null);
            // Re-fetch count after marking as read
            await fetchUnreadCount();
        } catch (err) {
            console.error("Failed to mark conversation as read:", err);
        }
    }, [user, fetchUnreadCount]);

    useEffect(() => {
        if (!user) { setUnreadCount(0); return; }

        fetchUnreadCount();

        // When a new message INSERT arrives or UPDATE happens, re-fetch count
        const channel = supabase
            .channel(`messages_ctx_${user.id}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchUnreadCount)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, fetchUnreadCount)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, fetchUnreadCount]);

    return (
        <MessagesContext.Provider value={{ unreadCount, markConversationRead }}>
            {children}
        </MessagesContext.Provider>
    );
}

export function useMessages() {
    const context = useContext(MessagesContext);
    if (!context) throw new Error("useMessages must be used within a MessagesProvider");
    return context;
}
