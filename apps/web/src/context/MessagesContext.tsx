"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface MessagesContextType {
    unreadCount: number;
    markConversationRead: (bookingId: string) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [dbUnreadCount, setDbUnreadCount] = useState(0);
    // Track how many unread messages we've locally marked as read per conversation
    const localReadCounts = useRef<Map<string, number>>(new Map());
    const [localReadVersion, setLocalReadVersion] = useState(0); // trigger re-render

    const fetchDbCount = useCallback(async () => {
        if (!user) { setDbUnreadCount(0); return; }
        try {
            const { data: bookings } = await supabase
                .from("bookings")
                .select("id")
                .or(`athlete_id.eq.${user.id},trainer_id.eq.${user.id}`)
                .in("status", ["confirmed", "completed", "pending"]);

            if (!bookings?.length) { setDbUnreadCount(0); return; }

            const { count } = await supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .in("booking_id", bookings.map(b => b.id))
                .neq("sender_id", user.id)
                .is("read_at", null);

            setDbUnreadCount(count ?? 0);
        } catch (err) {
            console.error("Failed to fetch unread message count:", err);
        }
    }, [user]);

    const markConversationRead = useCallback(async (bookingId: string) => {
        if (!user) return;
        // Immediately count unread messages for this conversation and mark locally
        if (!localReadCounts.current.has(bookingId)) {
            try {
                const { data: bookings } = await supabase
                    .from("bookings")
                    .select("id")
                    .or(`athlete_id.eq.${user.id},trainer_id.eq.${user.id}`)
                    .eq("id", bookingId);
                if (bookings?.length) {
                    const { count } = await supabase
                        .from("messages")
                        .select("id", { count: "exact", head: true })
                        .eq("booking_id", bookingId)
                        .neq("sender_id", user.id)
                        .is("read_at", null);
                    localReadCounts.current.set(bookingId, count ?? 0);
                } else {
                    localReadCounts.current.set(bookingId, 0);
                }
            } catch {
                localReadCounts.current.set(bookingId, 0);
            }
            setLocalReadVersion(v => v + 1);
        }
        // Best-effort DB update (may succeed if RLS allows it)
        try {
            await supabase
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("booking_id", bookingId)
                .neq("sender_id", user.id)
                .is("read_at", null);
            // Re-fetch so DB count syncs after a successful update
            await fetchDbCount();
        } catch {
            // Ignore — local tracking already handles the badge
        }
    }, [user, fetchDbCount]);

    // Compute displayed count: DB count minus total messages we've locally marked as read
    // (bounded at 0 to handle race conditions)
    const locallyReadTotal = Array.from(localReadCounts.current.values()).reduce((sum, n) => sum + n, 0);
    const unreadCount = Math.max(0, dbUnreadCount - locallyReadTotal);

    useEffect(() => {
        if (!user) { setDbUnreadCount(0); localReadCounts.current.clear(); return; }

        fetchDbCount();

        // When a new message INSERT arrives, re-fetch DB count
        const channel = supabase
            .channel(`messages_ctx_${user.id}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchDbCount)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, fetchDbCount]);

    // Suppress linting warning — localReadVersion intentionally triggers re-render
    void localReadVersion;

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
