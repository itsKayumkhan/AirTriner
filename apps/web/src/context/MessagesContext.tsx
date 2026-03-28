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
    // Track which bookingIds the user has already opened this session
    const localReadIds = useRef<Set<string>>(new Set());
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
        // Immediately mark locally so badge clears without waiting for DB
        if (!localReadIds.current.has(bookingId)) {
            localReadIds.current.add(bookingId);
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

    // Compute displayed count: DB count minus conversations we've already opened
    // (bounded at 0 to handle race conditions)
    const unreadCount = Math.max(0, dbUnreadCount - localReadIds.current.size);

    useEffect(() => {
        if (!user) { setDbUnreadCount(0); localReadIds.current.clear(); return; }

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
