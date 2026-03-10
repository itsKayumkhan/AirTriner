"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, BookingRow } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Stats {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    totalEarnings: number;
    averageRating: number;
    totalReviews: number;
}

interface TrainerContextType {
    stats: Stats;
    recentBookings: (BookingRow & { other_user?: { first_name: string; last_name: string } })[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const TrainerContext = createContext<TrainerContextType | undefined>(undefined);

export function TrainerProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [stats, setStats] = useState<Stats>({
        totalBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
        totalEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
    });
    const [recentBookings, setRecentBookings] = useState<(BookingRow & { other_user?: { first_name: string; last_name: string } })[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!user || user.role !== "trainer") {
            setLoading(false);
            return;
        }
        
        try {
            const { data: bookings } = await supabase
                .from("bookings")
                .select("*")
                .eq("trainer_id", user.id)
                .order("scheduled_at", { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            const { data: reviews } = await supabase
                .from("reviews")
                .select("*")
                .eq("reviewee_id", user.id);

            const avgRating = reviews && reviews.length > 0
                ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
                : 0;

            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter((b) => b.status === "confirmed" && b.scheduled_at > now).length,
                completedBookings: allBookings.filter((b) => b.status === "completed").length,
                totalEarnings: allBookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.price), 0),
                averageRating: Math.round(avgRating * 10) / 10,
                totalReviews: reviews?.length || 0,
            });

            const recentIds = allBookings.slice(0, 5);
            const otherUserIds = recentIds.map((b) => b.athlete_id);

            if (otherUserIds.length > 0) {
                const { data: otherUsers } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", otherUserIds);

                const usersMap = new Map((otherUsers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u]));
                setRecentBookings(
                    recentIds.map((b) => ({
                        ...b,
                        other_user: usersMap.get(b.athlete_id) as { first_name: string; last_name: string } | undefined,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load trainer context data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return (
        <TrainerContext.Provider value={{ stats, recentBookings, loading, refreshData: loadData }}>
            {children}
        </TrainerContext.Provider>
    );
}

export function useTrainer() {
    const context = useContext(TrainerContext);
    if (context === undefined) {
        throw new Error("useTrainer must be used within a TrainerProvider");
    }
    return context;
}
