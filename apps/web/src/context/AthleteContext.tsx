"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, BookingRow } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Stats {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    totalSpent: number;
}

interface AthleteContextType {
    stats: Stats;
    recentBookings: (BookingRow & { other_user?: { first_name: string; last_name: string } })[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const AthleteContext = createContext<AthleteContextType | undefined>(undefined);

export function AthleteProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [stats, setStats] = useState<Stats>({
        totalBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
    });
    const [recentBookings, setRecentBookings] = useState<(BookingRow & { other_user?: { first_name: string; last_name: string } })[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!user || user.role !== "athlete") {
            setLoading(false);
            return;
        }
        
        try {
            const { data: bookings } = await supabase
                .from("bookings")
                .select("*")
                .eq("athlete_id", user.id)
                .order("scheduled_at", { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter((b) => b.status === "confirmed" && b.scheduled_at > now).length,
                completedBookings: allBookings.filter((b) => b.status === "completed").length,
                totalSpent: allBookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.total_paid), 0),
            });

            const recentIds = allBookings.slice(0, 5);
            const otherUserIds = recentIds.map((b) => b.trainer_id);

            if (otherUserIds.length > 0) {
                const { data: otherUsers } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", otherUserIds);

                const usersMap = new Map((otherUsers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u]));
                setRecentBookings(
                    recentIds.map((b) => ({
                        ...b,
                        other_user: usersMap.get(b.trainer_id) as { first_name: string; last_name: string } | undefined,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load athlete context data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return (
        <AthleteContext.Provider value={{ stats, recentBookings, loading, refreshData: loadData }}>
            {children}
        </AthleteContext.Provider>
    );
}

export function useAthlete() {
    const context = useContext(AthleteContext);
    if (context === undefined) {
        throw new Error("useAthlete must be used within an AthleteProvider");
    }
    return context;
}
