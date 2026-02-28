"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";
import { Calendar, Clock, CheckCircle, Wallet, Star, MessageSquare, TrendingUp, Search, Activity, ArrowUpRight, Hand, Inbox } from "lucide-react";
import Link from "next/link";

interface Stats {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    totalEarnings: number;
    averageRating: number;
    totalReviews: number;
}

export default function DashboardOverview() {
    const [user, setUser] = useState<AuthUser | null>(null);
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

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadDashboardData(session);
        }
    }, []);

    const loadDashboardData = async (u: AuthUser) => {
        try {
            const isTrainer = u.role === "trainer";
            const column = isTrainer ? "trainer_id" : "athlete_id";

            const { data: bookings } = await supabase
                .from("bookings")
                .select("*")
                .eq(column, u.id)
                .order("scheduled_at", { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            const reviewColumn = isTrainer ? "reviewee_id" : "reviewer_id";
            const { data: reviews } = await supabase
                .from("reviews")
                .select("*")
                .eq(reviewColumn, u.id);

            const avgRating = reviews && reviews.length > 0
                ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
                : 0;

            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter((b) => b.status === "confirmed" && b.scheduled_at > now).length,
                completedBookings: allBookings.filter((b) => b.status === "completed").length,
                totalEarnings: isTrainer
                    ? allBookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.price), 0)
                    : allBookings.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.total_paid), 0),
                averageRating: Math.round(avgRating * 10) / 10,
                totalReviews: reviews?.length || 0,
            });

            const recentIds = allBookings.slice(0, 5);
            const otherUserIds = recentIds.map((b) => (isTrainer ? b.athlete_id : b.trainer_id));

            if (otherUserIds.length > 0) {
                const { data: otherUsers } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", otherUserIds);

                const usersMap = new Map((otherUsers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u]));
                setRecentBookings(
                    recentIds.map((b) => ({
                        ...b,
                        other_user: usersMap.get(isTrainer ? b.athlete_id : b.trainer_id) as { first_name: string; last_name: string } | undefined,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const isTrainer = user?.role === "trainer";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const statCards = isTrainer
        ? [
            { label: "Total Sessions", value: stats.totalBookings, icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Upcoming", value: stats.upcomingBookings, icon: Clock, color: "text-primary", bg: "bg-primary/10" },
            { label: "Completed", value: stats.completedBookings, icon: CheckCircle, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Total Earnings", value: `$${stats.totalEarnings.toFixed(2)}`, icon: Wallet, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Avg Rating", value: stats.averageRating || "N/A", icon: Star, color: "text-primary", bg: "bg-primary/10" },
            { label: "Reviews", value: stats.totalReviews, icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
        ]
        : [
            { label: "Total Bookings", value: stats.totalBookings, icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Upcoming", value: stats.upcomingBookings, icon: Clock, color: "text-primary", bg: "bg-primary/10" },
            { label: "Completed", value: stats.completedBookings, icon: CheckCircle, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Total Spent", value: `$${stats.totalEarnings.toFixed(2)}`, icon: Wallet, color: "text-orange-500", bg: "bg-orange-500/10" },
        ];

    const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
        pending: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-500", dot: "bg-orange-500" },
        confirmed: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500", dot: "bg-blue-500" },
        completed: { bg: "bg-primary/10", border: "border-primary/20", text: "text-primary", dot: "bg-primary" },
        cancelled: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-500", dot: "bg-red-500" },
        no_show: { bg: "bg-[#272A35]", border: "border-gray-700", text: "text-text-main/60", dot: "bg-gray-400" },
        disputed: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-500", dot: "bg-red-500" },
    };

    return (
        <div className="space-y-8 pb-8 max-w-[1200px]">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-[24px] bg-surface border border-white/5">
                <div className="relative p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-text-main tracking-tight flex items-center gap-3">
                            {greeting}, {user?.firstName}!
                            <Hand className="text-primary w-10 h-10 animate-[pulse_3s_ease-in-out_infinite]" />
                        </h1>
                        <p className="text-text-main/60 mt-2 text-base font-medium">
                            Here&apos;s what&apos;s happening with your {isTrainer ? "training business" : "training journey"} today.
                        </p>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        className="bg-surface border border-white/5 rounded-[24px] p-6 group hover:border-gray-700 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${card.bg}`}>
                                <card.icon size={24} className={card.color} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div>
                            <div className="text-text-main/60 text-sm font-bold mb-1">
                                {card.label}
                            </div>
                            <div className="text-3xl font-black text-text-main tracking-tight group-hover:text-primary transition-colors">
                                {card.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid: Recent Bookings & Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Recent Bookings */}
                <div className="xl:col-span-2 bg-surface rounded-[24px] border border-white/5 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-text-main px-2 tracking-tight">Recent Sessions</h2>
                        </div>
                        <Link
                            href="/dashboard/bookings"
                            className="text-xs font-black uppercase tracking-widest text-primary hover:text-text-main transition-colors"
                        >
                            View All
                        </Link>
                    </div>

                    <div className="flex-1 p-2">
                        {recentBookings.length === 0 ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-[#272A35]/30 rounded-[16px] m-4 border border-dashed border-gray-700">
                                <div className="w-16 h-16 bg-[#272A35] rounded-full flex items-center justify-center mb-4 text-3xl">
                                    <Inbox className="opacity-50 w-8 h-8" />
                                </div>
                                <h4 className="text-lg font-bold text-text-main mb-2">No upcoming sessions</h4>
                                <p className="text-text-main/60 text-sm max-w-sm font-medium">
                                    It looks like you don&apos;t have any bookings yet.
                                    {isTrainer ? " Ensure your calendar availability is up to date." : " Find a trainer to get started on your journey!"}
                                </p>
                                {!isTrainer && (
                                    <Link
                                        href="/dashboard/search"
                                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-bg rounded-full font-black hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                                    >
                                        <Search size={18} />
                                        Find a Trainer
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {recentBookings.map((booking) => {
                                    const status = statusStyles[booking.status] || statusStyles.pending;
                                    const date = new Date(booking.scheduled_at);

                                    return (
                                        <Link
                                            href={`/dashboard/bookings`}
                                            key={booking.id}
                                            className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors m-2 rounded-2xl group border border-transparent hover:border-white/5/50"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-[#272A35] border border-gray-700 flex items-center justify-center text-primary font-black text-lg shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
                                                    {booking.other_user
                                                        ? `${booking.other_user.first_name[0]}${booking.other_user.last_name[0]}`
                                                        : "?"}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-text-main tracking-wide">
                                                        {booking.other_user
                                                            ? `${booking.other_user.first_name} ${booking.other_user.last_name}`
                                                            : "Unknown User"}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-text-main/40 mt-1 font-medium tracking-wide">
                                                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#272A35]">
                                                            <Activity size={12} className="text-text-main/60" />
                                                            {booking.sport}
                                                        </span>
                                                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#272A35]">
                                                            <Clock size={12} className="text-text-main/60" />
                                                            {booking.duration_minutes} min
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 gap-3 sm:gap-2">
                                                <div className="text-xs font-bold text-text-main/60">
                                                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} •{" "}
                                                    {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${status.bg} border ${status.border} text-[10px] font-black uppercase tracking-widest`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                    <span className={status.text}>{booking.status.replace("_", " ")}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance banner */}
                <div className="bg-surface border border-white/5 rounded-[24px] p-8 text-text-main relative overflow-hidden flex flex-col justify-between h-[400px] xl:h-auto group">
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-colors duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] group-hover:bg-blue-500/10 transition-colors duration-700"></div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#272A35] text-[10px] font-black tracking-widest uppercase mb-6 shadow-sm border border-gray-700">
                                <TrendingUp size={14} className="text-primary" />
                                Insights
                            </div>
                            <h2 className="text-3xl font-black tracking-tight mb-4 text-text-main leading-tight">
                                Keep the momentum going!
                            </h2>
                            <p className="text-text-main/60 leading-relaxed text-sm font-medium">
                                {isTrainer
                                    ? "Trainers with completed profiles and up-to-date calendars get 3x more bookings."
                                    : "Consistent training is the key to mastering your sport. Book your next session now."}
                            </p>
                        </div>

                        <div className="mt-8">
                            <Link
                                href={isTrainer ? "/dashboard/trainer/setup" : "/dashboard/search"}
                                className="inline-flex items-center justify-center gap-2 w-full py-4 bg-white text-bg font-black rounded-full hover:bg-gray-200 transition-colors shadow-lg"
                            >
                                {isTrainer ? "Update Profile" : "Find a Trainer"}
                                <ArrowUpRight size={20} className="text-bg" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
