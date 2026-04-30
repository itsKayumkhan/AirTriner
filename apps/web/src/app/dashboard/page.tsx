"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    Calendar, Clock, CheckCircle, Wallet, Star, MessageSquare,
    Search, Activity, ArrowUpRight, Inbox, AlertTriangle,
    ChevronRight, Zap, TrendingUp, Users
} from "lucide-react";
import Link from "next/link";
import { useTrainer } from "@/context/TrainerContext";
import { useAthlete } from "@/context/AthleteContext";
import { useAuth } from "@/context/AuthContext";
import ApprovalStatusPanel from "@/components/trainer/ApprovalStatusPanel";

export default function DashboardOverview() {
    const { user } = useAuth();
    const isTrainer = user?.role === "trainer";
    const trainerContext = useTrainer();
    const athleteContext = useAthlete();

    const loading = isTrainer ? trainerContext.loading : athleteContext.loading;
    const stats: any = isTrainer ? trainerContext.stats : athleteContext.stats;
    const recentBookings = isTrainer ? trainerContext.recentBookings : athleteContext.recentBookings;

    const [requireVerification, setRequireVerification] = useState(true);
    const [gateUser, setGateUser] = useState<any>(null);

    useEffect(() => {
        if (user) {
            supabase
                .from("platform_settings")
                .select("require_trainer_verification")
                .maybeSingle()
                .then(({ data }) => {
                    if (data) setRequireVerification(data.require_trainer_verification);
                });
        }
    }, [user]);

    useEffect(() => {
        if (user?.id && isTrainer) {
            supabase
                .from("users")
                .select("first_name, last_name, phone, date_of_birth, avatar_url, is_suspended, deleted_at")
                .eq("id", user.id)
                .maybeSingle()
                .then(({ data }) => { if (data) setGateUser(data); });
        }
    }, [user?.id, isTrainer]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const trainerStats = [
        { label: "Total Sessions", value: stats.totalBookings, icon: Activity },
        { label: "Upcoming",       value: stats.upcomingBookings, icon: Clock },
        { label: "Completed",      value: stats.completedBookings, icon: CheckCircle },
        { label: "Earnings",       value: `$${stats.totalEarnings?.toFixed(0) || "0"}`, icon: Wallet },
        { label: "Avg Rating",     value: stats.averageRating || "—", icon: Star },
        { label: "Reviews",        value: stats.totalReviews, icon: MessageSquare },
    ];

    const athleteStats = [
        { label: "Total Bookings", value: stats.totalBookings, icon: Calendar },
        { label: "Upcoming",       value: stats.upcomingBookings, icon: Clock },
        { label: "Completed",      value: stats.completedBookings, icon: CheckCircle },
        { label: "Total Spent",    value: `$${stats.totalSpent?.toFixed(0) || "0"}`, icon: Wallet },
    ];

    const statCards = isTrainer ? trainerStats : athleteStats;

    const upcomingSession = recentBookings.find(
        (b: any) => b.status === "confirmed" && new Date(b.scheduled_at) > new Date()
    );

    const statusConfig: Record<string, { label: string; dot: string; text: string; pill: string }> = {
        pending:   { label: "Pending",   dot: "bg-amber-400",   text: "text-amber-400",   pill: "bg-amber-400/10 border-amber-400/20" },
        confirmed: { label: "Confirmed", dot: "bg-blue-400",    text: "text-blue-400",    pill: "bg-blue-400/10 border-blue-400/20" },
        completed: { label: "Completed", dot: "bg-emerald-400", text: "text-emerald-400", pill: "bg-emerald-400/10 border-emerald-400/20" },
        cancelled: { label: "Cancelled", dot: "bg-red-400",     text: "text-red-400",     pill: "bg-red-400/10 border-red-400/20" },
        no_show:   { label: "No Show",   dot: "bg-zinc-500",    text: "text-zinc-400",    pill: "bg-zinc-500/10 border-zinc-500/20" },
        disputed:  { label: "Disputed",  dot: "bg-red-500",     text: "text-red-400",     pill: "bg-red-500/10 border-red-500/20" },
    };

    const quickActions = isTrainer ? [
        { label: "Update Availability", href: "/dashboard/availability",   icon: Clock },
        { label: "View Bookings",        href: "/dashboard/bookings",       icon: Calendar },
        { label: "Earnings & Payouts",   href: "/dashboard/earnings",       icon: Wallet },
        { label: "Edit Profile",         href: "/dashboard/trainer/setup",  icon: Users },
    ] : [
        { label: "Find a Trainer",   href: "/dashboard/search",       icon: Search },
        { label: "My Bookings",      href: "/dashboard/bookings",     icon: Calendar },
        { label: "Payments",         href: "/dashboard/earnings",     icon: Wallet },
        { label: "Family Accounts",  href: "/dashboard/sub-accounts", icon: Users },
    ];

    return (
        <div className="space-y-6 pb-10">

            {/* Trainer Approval / Public Visibility Panel */}
            {isTrainer && gateUser && (
                <ApprovalStatusPanel
                    user={gateUser}
                    trainerProfile={(user as any)?.trainerProfile ?? null}
                />
            )}

            {/* Verification Banner */}
            {isTrainer && requireVerification && user?.trainerProfile && !user.trainerProfile.is_verified && (
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={15} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-text-main">Profile verification pending</p>
                        <p className="text-text-main/50 text-xs mt-0.5 leading-relaxed">
                            Your profile is hidden from athletes until an admin verifies your account.{" "}
                            <Link href="/dashboard/trainer/setup" className="text-primary hover:underline">Complete your setup</Link> to speed up the process.
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-text-main/30 text-xs font-medium uppercase tracking-widest mb-1.5">{today}</p>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        Good {greeting},&nbsp;<span className="text-primary">{user?.firstName}</span>
                    </h1>
                    <p className="text-text-main/40 text-sm mt-2">
                        {isTrainer ? "Your training business at a glance." : "Your training journey at a glance."}
                    </p>
                </div>
                <Link
                    href={isTrainer ? "/dashboard/availability" : "/dashboard/search"}
                    className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg text-sm font-bold
                               hover:brightness-110 active:scale-95 transition-all duration-150 shrink-0"
                >
                    {isTrainer ? <><Zap size={14} /> Set Availability</> : <><Search size={14} /> Find Trainer</>}
                </Link>
            </div>

            {/* Stats Grid */}
            <div className={`grid gap-3 ${isTrainer ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        className="group relative bg-surface border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-3
                                   hover:border-white/[0.14] hover:-translate-y-0.5 hover:bg-[#1a1d24]
                                   transition-all duration-200 cursor-default overflow-hidden"
                    >
                        {/* top accent line on hover */}
                        <div className="absolute inset-x-0 top-0 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-text-main/30 leading-none">{card.label}</span>
                            <card.icon size={13} className="text-text-main/20 group-hover:text-primary transition-colors duration-200" />
                        </div>
                        <div className="text-2xl font-black text-text-main tracking-tight tabular-nums group-hover:text-primary transition-colors duration-200">
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Recent Sessions — 2/3 width */}
                <div className="lg:col-span-2 bg-surface border border-white/[0.06] rounded-2xl overflow-hidden
                                hover:border-white/[0.10] transition-colors duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                        <h2 className="text-sm font-bold text-text-main">Recent Sessions</h2>
                        <Link
                            href="/dashboard/bookings"
                            className="group/link flex items-center gap-1 text-xs font-bold text-text-main/30 hover:text-primary transition-colors duration-200"
                        >
                            View all
                            <ChevronRight size={13} className="group-hover/link:translate-x-0.5 transition-transform duration-150" />
                        </Link>
                    </div>

                    {recentBookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
                            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
                                <Inbox size={18} className="text-text-main/20" />
                            </div>
                            <p className="text-sm font-bold text-text-main/40">No sessions yet</p>
                            <p className="text-xs text-text-main/25 mt-1 max-w-xs leading-relaxed">
                                {isTrainer
                                    ? "Bookings will appear here once athletes schedule sessions."
                                    : "Book a session with a trainer to get started."}
                            </p>
                            {!isTrainer && (
                                <Link
                                    href="/dashboard/search"
                                    className="mt-5 flex items-center gap-2 px-4 py-2.5 bg-primary text-bg rounded-xl text-sm font-bold
                                               hover:brightness-110 active:scale-95 transition-all duration-150"
                                >
                                    <Search size={14} /> Find a Trainer
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {recentBookings.map((booking: any) => {
                                const s = statusConfig[booking.status] || statusConfig.pending;
                                const date = new Date(booking.scheduled_at);
                                const initials = booking.other_user
                                    ? `${booking.other_user.first_name[0]}${booking.other_user.last_name[0]}`
                                    : "?";
                                const name = booking.other_user
                                    ? `${booking.other_user.first_name} ${booking.other_user.last_name}`
                                    : "Unknown";

                                return (
                                    <Link
                                        key={booking.id}
                                        href="/dashboard/bookings"
                                        className="group flex items-center gap-4 px-5 py-3.5
                                                   hover:bg-white/[0.025] transition-colors duration-150"
                                    >
                                        {/* Avatar */}
                                        <div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.07]
                                                        group-hover:border-primary/30 group-hover:bg-primary/5
                                                        flex items-center justify-center text-xs font-bold text-text-main/50
                                                        group-hover:text-primary transition-all duration-200 flex-shrink-0">
                                            {initials}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-text-main/80 group-hover:text-text-main transition-colors duration-150 truncate">
                                                {name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-text-main/30 capitalize">{booking.sport}</span>
                                                <span className="text-white/10">·</span>
                                                <span className="text-xs text-text-main/30">{booking.duration_minutes}min</span>
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div className="text-right flex-shrink-0 hidden sm:block">
                                            <p className="text-xs font-medium text-text-main/40">
                                                {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </p>
                                            <p className="text-[10px] text-text-main/25 mt-0.5">
                                                {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                            </p>
                                        </div>

                                        {/* Status pill */}
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${s.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                            <span className={s.text}>{s.label}</span>
                                        </div>

                                        {/* Arrow */}
                                        <ChevronRight
                                            size={14}
                                            className="text-white/10 group-hover:text-white/30 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0"
                                        />
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">

                    {/* Next session card */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.10] transition-colors duration-200">
                        {/* accent top bar */}
                        <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="relative flex h-2 w-2">
                                    {upcomingSession && (
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${upcomingSession ? "bg-blue-400" : "bg-white/15"}`} />
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-main/40">Next Session</span>
                            </div>

                            {upcomingSession ? (
                                <>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-sm font-bold text-text-main/60 flex-shrink-0">
                                            {upcomingSession.other_user
                                                ? `${upcomingSession.other_user.first_name[0]}${upcomingSession.other_user.last_name[0]}`
                                                : "?"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-text-main">
                                                {upcomingSession.other_user
                                                    ? `${upcomingSession.other_user.first_name} ${upcomingSession.other_user.last_name}`
                                                    : "Unknown"}
                                            </p>
                                            <p className="text-xs text-text-main/40 capitalize mt-0.5">{upcomingSession.sport} · {upcomingSession.duration_minutes}min</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-bg/60 border border-white/[0.05] rounded-xl p-3 hover:border-white/[0.09] transition-colors">
                                            <p className="text-[10px] text-text-main/25 uppercase tracking-wider mb-1.5">Date</p>
                                            <p className="text-sm font-bold text-text-main">
                                                {new Date(upcomingSession.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </p>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.05] rounded-xl p-3 hover:border-white/[0.09] transition-colors">
                                            <p className="text-[10px] text-text-main/25 uppercase tracking-wider mb-1.5">Time</p>
                                            <p className="text-sm font-bold text-text-main">
                                                {new Date(upcomingSession.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-text-main/25 leading-relaxed">No upcoming sessions scheduled.</p>
                            )}
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.10] transition-colors duration-200">
                        <div className="px-5 py-3.5 border-b border-white/[0.06]">
                            <h3 className="text-sm font-bold text-text-main">Quick Actions</h3>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className="group flex items-center gap-3 px-5 py-3
                                               hover:bg-white/[0.025] active:bg-white/[0.04]
                                               transition-colors duration-150"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center
                                                    group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-200">
                                        <action.icon size={13} className="text-text-main/30 group-hover:text-primary transition-colors duration-200" />
                                    </div>
                                    <span className="text-sm font-medium text-text-main/55 group-hover:text-text-main transition-colors duration-150 flex-1">
                                        {action.label}
                                    </span>
                                    <ChevronRight
                                        size={13}
                                        className="text-white/10 group-hover:text-white/30 group-hover:translate-x-0.5 transition-all duration-150"
                                    />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Insight card */}
                    <div className="group bg-surface border border-white/[0.06] rounded-2xl p-5
                                    hover:border-white/[0.10] hover:-translate-y-0.5 transition-all duration-200">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={13} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-text-main/40">Insight</span>
                        </div>
                        <p className="text-sm text-text-main/55 leading-relaxed">
                            {isTrainer
                                ? stats.completedBookings > 0
                                    ? `You've completed ${stats.completedBookings} session${stats.completedBookings > 1 ? "s" : ""}. Keep your availability updated to attract more athletes.`
                                    : "Complete your profile and set your availability to start receiving bookings."
                                : stats.completedBookings > 0
                                    ? `You've completed ${stats.completedBookings} session${stats.completedBookings > 1 ? "s" : ""}. Consistency is the key to progress.`
                                    : "Book your first session to start your training journey."}
                        </p>
                        <Link
                            href={isTrainer ? "/dashboard/trainer/setup" : "/dashboard/search"}
                            className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-primary
                                       hover:gap-2 transition-all duration-150"
                        >
                            {isTrainer ? "Update profile" : "Browse trainers"}
                            <ArrowUpRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
