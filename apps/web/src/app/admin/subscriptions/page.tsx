"use client";

import { useState, useEffect } from "react";
import {
    Search, Download, RefreshCw, Loader2, Crown, Clock, XCircle, CheckCircle,
    TrendingUp, Users, AlertTriangle, Trophy, ChevronRight, CreditCard,
    CalendarCheck, Wallet, Activity, X, BadgeCheck, UserCircle, BarChart3,
    Zap, Star
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PopupModal from "@/components/common/PopupModal";

type Subscription = {
    id: string;
    userId: string;
    trainerName: string;
    initials: string;
    email: string;
    status: string;
    expiresAt: string | null;
    trialStartedAt: string | null;
    sport: string;
    isFounding50: boolean;
    createdAt: string | null;
};

type TrainerDetail = {
    profile: any;
    user: any;
    stats: {
        totalBookings: number;
        completedBookings: number;
        pendingBookings: number;
        cancelledBookings: number;
        upcomingBookings: number;
        totalRevenue: number;
        totalPlatformFee: number;
        totalVolume: number;
        releasedCount: number;
        heldCount: number;
        lastPaymentDate: string | null;
        paymentCount: number;
    };
    recentPayments: {
        id: string;
        amount: number;
        trainerPayout: number;
        platformFee: number;
        status: string;
        date: string;
    }[];
};

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("ALL");
    const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
    const [detail, setDetail] = useState<TrainerDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [popup, setPopup] = useState<{
        type: "success" | "error" | "confirm" | "warning" | "info";
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    const showAlert = (type: "success" | "error" | "info", title: string, message: string) => setPopup({ type, title, message });
    const showConfirm = (title: string, message: string, onConfirm: () => void) => setPopup({ type: "confirm", title, message, onConfirm });

    const [totalActive, setTotalActive] = useState(0);
    const [totalTrial, setTotalTrial] = useState(0);
    const [totalExpired, setTotalExpired] = useState(0);
    const [totalCancelled, setTotalCancelled] = useState(0);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("trainer_profiles")
                .select(`id, user_id, subscription_status, subscription_expires_at, trial_started_at, sports, is_founding_50, created_at, users (id, first_name, last_name, email)`)
                .order("is_founding_50", { ascending: false })
                .order("subscription_status", { ascending: true });

            if (error) throw error;

            if (data) {
                let active = 0, trial = 0, expired = 0, cancelled = 0;
                const formatted: Subscription[] = data.map((tp: any) => {
                    const status = tp.subscription_status || "trial";
                    if (status === "active") active++;
                    else if (status === "trial") trial++;
                    else if (status === "expired") expired++;
                    else if (status === "cancelled") cancelled++;
                    const firstName = tp.users?.first_name || "";
                    const lastName = tp.users?.last_name || "";
                    return {
                        id: tp.id,
                        userId: tp.user_id,
                        trainerName: `${firstName} ${lastName}`.trim() || "Unknown",
                        initials: `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase(),
                        email: tp.users?.email || "",
                        status,
                        expiresAt: tp.subscription_expires_at,
                        trialStartedAt: tp.trial_started_at,
                        sport: Array.isArray(tp.sports) && tp.sports.length > 0 ? tp.sports[0] : "General",
                        isFounding50: tp.is_founding_50 || false,
                        createdAt: tp.created_at,
                    };
                });
                setSubscriptions(formatted);
                setTotalActive(active);
                setTotalTrial(trial);
                setTotalExpired(expired);
                setTotalCancelled(cancelled);

                // Re-sync selected if open
                if (selectedSub) {
                    const updated = formatted.find(s => s.id === selectedSub.id);
                    if (updated) setSelectedSub(updated);
                }
            }
        } catch (err) {
            console.error("Failed to load subscriptions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRow = async (sub: Subscription) => {
        setSelectedSub(sub);
        setDetailLoading(true);
        setDetail(null);
        try {
            const res = await fetch(`/api/admin/trainer-detail?userId=${sub.userId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setDetail(json);
        } catch (err) {
            console.error(err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleApproveFounding50 = async (profileId: string, trainerName: string) => {
        showConfirm("Approve Founding 50", `Grant ${trainerName} 6 months of free Pro access as a Founding 50 member?`, async () => {
            setProcessing(profileId);
            try {
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 6);
                const { error } = await supabase.from("trainer_profiles").update({ subscription_status: "active", subscription_expires_at: expiresAt.toISOString(), is_founding_50: true }).eq("id", profileId);
                if (error) throw error;
                await loadData();
                if (selectedSub?.id === profileId) await handleSelectRow({ ...selectedSub, status: "active" });
                showAlert("success", "Founding 50 Approved", `${trainerName} now has 6 months of free Pro access.`);
            } catch (err) {
                showAlert("error", "Error", "Failed to approve Founding 50.");
            } finally {
                setProcessing(null);
            }
        });
    };

    const handleStatusChange = async (profileId: string, newStatus: string, userId: string) => {
        const title = newStatus === "active" ? "Activate Subscription" : "Cancel Subscription";
        const message = newStatus === "active" ? "Activate this trainer's subscription for 30 days?" : "Cancel this trainer's subscription?";
        showConfirm(title, message, async () => {
            setProcessing(profileId);
            try {
                const updateData: any = { subscription_status: newStatus };
                if (newStatus === "active") {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    updateData.subscription_expires_at = expiresAt.toISOString();
                } else {
                    updateData.subscription_expires_at = new Date().toISOString();
                }
                const { error } = await supabase.from("trainer_profiles").update(updateData).eq("id", profileId);
                if (error) throw error;
                await loadData();
                // Refresh detail if this trainer is selected
                const sub = subscriptions.find(s => s.id === profileId);
                if (sub && selectedSub?.id === profileId) await handleSelectRow({ ...sub, status: newStatus });
                showAlert("success", "Updated", `Subscription status updated to ${newStatus}.`);
            } catch (err) {
                showAlert("error", "Error", "Failed to update subscription status.");
            } finally {
                setProcessing(null);
            }
        });
    };

    const handleExportCSV = () => {
        const csvHeaders = ["Trainer", "Email", "Status", "Sport", "Expires At", "Trial Started"];
        const csvRows = filteredSubs.map(s => [s.trainerName, s.email, s.status, s.sport, s.expiresAt || "N/A", s.trialStartedAt || "N/A"].join(","));
        const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `subscriptions_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    const filteredSubs = subscriptions.filter(s => {
        if (activeTab === "FOUNDING50") { if (!s.isFounding50) return false; }
        else if (activeTab !== "ALL" && s.status !== activeTab.toLowerCase()) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!s.trainerName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const founding50PendingCount = subscriptions.filter(s => s.isFounding50 && s.status !== "active").length;

    const statusConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
        active: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: <CheckCircle size={12} /> },
        trial: { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", icon: <Clock size={12} /> },
        expired: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: <XCircle size={12} /> },
        cancelled: { color: "text-text-main/60", bg: "bg-[#272A35]", border: "border-gray-700", icon: <XCircle size={12} /> },
    };

    // Days remaining / overdue
    const getDaysInfo = (sub: Subscription) => {
        if (!sub.expiresAt) return null;
        const diff = Math.round((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000);
        if (diff > 0) return { label: `${diff}d left`, isOverdue: false };
        return { label: `${Math.abs(diff)}d overdue`, isOverdue: true };
    };

    return (
        <div className="space-y-6 max-w-[1600px] w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black text-text-main tracking-tight mb-1">Subscription Management</h1>
                    <p className="text-sm font-medium text-text-main/50">Manage trainer subscriptions, payments, and access.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={loadData} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-white/[0.04] text-text-main/70 font-bold text-xs hover:border-white/10 transition-all">
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg font-black text-xs hover:opacity-90 transition-all">
                        <Download size={15} strokeWidth={3} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Active", value: totalActive, color: "text-primary", bg: "bg-primary/10", icon: <Crown size={16} /> },
                    { label: "On Trial", value: totalTrial, color: "text-blue-400", bg: "bg-blue-400/10", icon: <Clock size={16} /> },
                    { label: "Expired", value: totalExpired, color: "text-red-500", bg: "bg-red-500/10", icon: <AlertTriangle size={16} /> },
                    { label: "Cancelled", value: totalCancelled, color: "text-text-main/50", bg: "bg-white/[0.04]", icon: <XCircle size={16} /> },
                ].map(st => (
                    <div key={st.label} className="bg-surface border border-white/[0.04] rounded-2xl p-5">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">{st.label}</span>
                            <div className={`w-8 h-8 rounded-xl ${st.bg} flex items-center justify-center ${st.color}`}>{st.icon}</div>
                        </div>
                        <div className={`text-3xl font-black ${st.color}`}>{loading ? "…" : st.value}</div>
                    </div>
                ))}
            </div>

            {/* Search & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full max-w-xs">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Search trainers by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/[0.04] rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/40 transition-colors"
                    />
                </div>
                <div className="flex flex-wrap gap-1 bg-surface border border-white/[0.04] rounded-xl p-1">
                    {["ALL", "ACTIVE", "TRIAL", "EXPIRED", "CANCELLED", "FOUNDING50"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 ${
                                activeTab === tab
                                    ? tab === "FOUNDING50" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/[0.08] text-text-main"
                                    : "text-text-main/40 hover:text-text-main/70"
                            }`}
                        >
                            {tab === "FOUNDING50" && <Trophy size={9} />}
                            {tab === "FOUNDING50" ? "F50" : tab}
                            {tab === "FOUNDING50" && founding50PendingCount > 0 && (
                                <span className="bg-yellow-500 text-bg text-[8px] font-black px-1 py-0.5 rounded-full">{founding50PendingCount}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main: List + Detail */}
            <div className={`flex gap-6 items-start transition-all`}>

                {/* Table */}
                <div className={`bg-surface border border-white/[0.04] rounded-2xl overflow-hidden transition-all ${selectedSub ? "flex-1 min-w-0" : "w-full"}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/[0.04] text-[10px] uppercase font-black tracking-widest text-text-main/40 bg-white/[0.02]">
                                    <th className="px-5 py-4">Trainer</th>
                                    {!selectedSub && <th className="px-5 py-4">Email</th>}
                                    <th className="px-5 py-4">Sport</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Expires</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-12">
                                        <Loader2 size={22} className="mx-auto animate-spin text-primary opacity-50 mb-2" />
                                        <p className="text-text-main/40 text-xs font-bold tracking-widest uppercase">Loading</p>
                                    </td></tr>
                                ) : filteredSubs.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12">
                                        <Users size={20} className="mx-auto mb-2 text-text-main/30" />
                                        <p className="text-text-main/50 font-bold text-sm">No subscriptions found</p>
                                    </td></tr>
                                ) : filteredSubs.map((s) => {
                                    const cfg = statusConfig[s.status] || statusConfig.cancelled;
                                    const isFoundingPending = s.isFounding50 && s.status !== "active";
                                    const daysInfo = getDaysInfo(s);
                                    const isSelected = selectedSub?.id === s.id;
                                    return (
                                        <tr
                                            key={s.id}
                                            onClick={() => isSelected ? (setSelectedSub(null), setDetail(null)) : handleSelectRow(s)}
                                            className={`border-b border-white/[0.04] cursor-pointer transition-colors ${isSelected ? "bg-primary/[0.06] border-l-2 border-l-primary" : "hover:bg-white/[0.03]"} ${isFoundingPending ? "bg-yellow-500/[0.02]" : ""}`}
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#1e3a8a]/30 flex-shrink-0 border border-[#2563eb]/20 flex items-center justify-center text-xs font-bold text-white">{s.initials}</div>
                                                    <div>
                                                        <span className={`font-bold tracking-wide block text-sm ${isSelected ? "text-primary" : "text-text-main"}`}>{s.trainerName}</span>
                                                        {s.isFounding50 && <span className="flex items-center gap-1 text-[9px] font-black text-yellow-500 uppercase"><Trophy size={9} /> F50</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            {!selectedSub && <td className="px-5 py-4 text-text-main/50 text-xs font-medium">{s.email}</td>}
                                            <td className="px-5 py-4 text-text-main/70 text-xs font-medium capitalize">{s.sport}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                    {cfg.icon} {s.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div>
                                                    <div className="text-text-main/60 text-xs font-medium">
                                                        {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                                    </div>
                                                    {daysInfo && (
                                                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${daysInfo.isOverdue ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-primary/10 text-primary border border-primary/20"}`}>{daysInfo.label}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {isFoundingPending && (
                                                        <button onClick={() => handleApproveFounding50(s.id, s.trainerName)} disabled={processing === s.id}
                                                            className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-bg transition-all disabled:opacity-50 flex items-center gap-1">
                                                            {processing === s.id ? <Loader2 size={12} className="animate-spin" /> : <><Trophy size={10} /> F50</>}
                                                        </button>
                                                    )}
                                                    {!isFoundingPending && (s.status === "trial" || s.status === "expired" || s.status === "cancelled") && (
                                                        <button onClick={() => handleStatusChange(s.id, "active", s.userId)} disabled={processing === s.id}
                                                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-bg transition-all disabled:opacity-50">
                                                            {processing === s.id ? <Loader2 size={12} className="animate-spin" /> : "Activate"}
                                                        </button>
                                                    )}
                                                    {s.status === "active" && (
                                                        <button onClick={() => handleStatusChange(s.id, "cancelled", s.userId)} disabled={processing === s.id}
                                                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                                                            {processing === s.id ? <Loader2 size={12} className="animate-spin" /> : "Cancel"}
                                                        </button>
                                                    )}
                                                    <ChevronRight size={14} className={`transition-colors ${isSelected ? "text-primary" : "text-text-main/20"}`} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedSub && (
                    <div className="w-[380px] flex-shrink-0 bg-surface border border-white/[0.04] rounded-2xl overflow-hidden flex flex-col sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
                        {/* Detail Header */}
                        <div className="p-5 border-b border-white/[0.04] flex items-start justify-between gap-3 bg-white/[0.01]">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#1e3a8a]/40 border border-[#2563eb]/20 flex items-center justify-center text-base font-black text-white flex-shrink-0">
                                    {selectedSub.initials}
                                </div>
                                <div>
                                    <div className="font-black text-text-main text-sm">{selectedSub.trainerName}</div>
                                    <div className="text-text-main/40 text-xs font-medium">{selectedSub.email}</div>
                                    {selectedSub.isFounding50 && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-yellow-500 uppercase tracking-wider mt-0.5">
                                            <Trophy size={9} /> Founding 50
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => { setSelectedSub(null); setDetail(null); }} className="text-text-main/30 hover:text-text-main transition-colors p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
                                <X size={16} />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="flex-1 flex items-center justify-center py-16">
                                <Loader2 size={22} className="animate-spin text-primary opacity-50" />
                            </div>
                        ) : detail ? (
                            <div className="flex flex-col gap-0">

                                {/* Subscription Info */}
                                <div className="p-5 border-b border-white/[0.04]">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Crown size={13} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/50">Subscription</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Status</p>
                                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${(statusConfig[selectedSub.status] || statusConfig.cancelled).bg} ${(statusConfig[selectedSub.status] || statusConfig.cancelled).color} ${(statusConfig[selectedSub.status] || statusConfig.cancelled).border}`}>
                                                {(statusConfig[selectedSub.status] || statusConfig.cancelled).icon} {selectedSub.status}
                                            </div>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Sport</p>
                                            <p className="text-sm font-black text-text-main capitalize">{selectedSub.sport}</p>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Expires</p>
                                            <p className="text-xs font-bold text-text-main">
                                                {selectedSub.expiresAt ? new Date(selectedSub.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                            </p>
                                            {getDaysInfo(selectedSub) && (
                                                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${getDaysInfo(selectedSub)?.isOverdue ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-primary/10 text-primary border border-primary/20"}`}>
                                                    {getDaysInfo(selectedSub)?.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Joined</p>
                                            <p className="text-xs font-bold text-text-main">
                                                {selectedSub.createdAt ? new Date(selectedSub.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue & Payments */}
                                <div className="p-5 border-b border-white/[0.04]">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Wallet size={13} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/50">Revenue</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="bg-primary/[0.06] border border-primary/20 rounded-xl p-3 col-span-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-primary/50 mb-1">Total Earned (Trainer)</p>
                                            <p className="text-2xl font-black text-primary">${detail.stats.totalRevenue.toFixed(2)}</p>
                                            <p className="text-[9px] text-text-main/30 font-medium mt-0.5">from {detail.stats.paymentCount} transactions · ${detail.stats.totalVolume.toFixed(2)} gross</p>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Platform Fee</p>
                                            <p className="text-sm font-black text-text-main">${detail.stats.totalPlatformFee.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Released</p>
                                            <p className="text-sm font-black text-primary">{detail.stats.releasedCount}</p>
                                        </div>
                                        <div className="bg-bg/60 border border-white/[0.04] rounded-xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">Held</p>
                                            <p className="text-sm font-black text-yellow-500">{detail.stats.heldCount}</p>
                                        </div>
                                    </div>

                                    {detail.recentPayments.length > 0 ? (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-2">Recent Payments</p>
                                            <div className="space-y-1.5">
                                                {detail.recentPayments.map(p => (
                                                    <div key={p.id} className="flex items-center justify-between bg-bg/40 border border-white/[0.03] rounded-lg px-3 py-2">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-text-main">${p.amount.toFixed(2)}</p>
                                                            <p className="text-[9px] text-text-main/30 font-medium">{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-primary font-black">+${p.trainerPayout.toFixed(2)}</p>
                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${p.status === "released" ? "bg-primary/10 text-primary" : p.status === "held" ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"}`}>
                                                                {p.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-text-main/30 font-medium text-center py-2">No payments yet</p>
                                    )}
                                </div>

                                {/* Booking Stats */}
                                <div className="p-5 border-b border-white/[0.04]">
                                    <div className="flex items-center gap-2 mb-4">
                                        <CalendarCheck size={13} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/50">Booking Stats</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: "Total Sessions", value: detail.stats.totalBookings, color: "text-text-main" },
                                            { label: "Completed", value: detail.stats.completedBookings, color: "text-primary" },
                                            { label: "Upcoming", value: detail.stats.upcomingBookings, color: "text-blue-400" },
                                            { label: "Cancelled", value: detail.stats.cancelledBookings, color: "text-red-500" },
                                        ].map(stat => (
                                            <div key={stat.label} className="bg-bg/60 border border-white/[0.04] rounded-xl p-3 flex items-center justify-between">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30">{stat.label}</p>
                                                <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap size={13} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/50">Actions</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {selectedSub.isFounding50 && selectedSub.status !== "active" && (
                                            <button onClick={() => handleApproveFounding50(selectedSub.id, selectedSub.trainerName)} disabled={processing === selectedSub.id}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-bg transition-all disabled:opacity-50">
                                                {processing === selectedSub.id ? <Loader2 size={14} className="animate-spin" /> : <><Trophy size={13} /> Approve Founding 50</>}
                                            </button>
                                        )}
                                        {(selectedSub.status === "trial" || selectedSub.status === "expired" || selectedSub.status === "cancelled") && !(selectedSub.isFounding50 && (selectedSub.status as string) !== "active") && (
                                            <button onClick={() => handleStatusChange(selectedSub.id, "active", selectedSub.userId)} disabled={processing === selectedSub.id}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-bg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50">
                                                {processing === selectedSub.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={13} /> Activate (30 days)</>}
                                            </button>
                                        )}
                                        {selectedSub.status === "active" && (
                                            <button onClick={() => handleStatusChange(selectedSub.id, "cancelled", selectedSub.userId)} disabled={processing === selectedSub.id}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                                                {processing === selectedSub.id ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={13} /> Cancel Subscription</>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center py-12 text-text-main/30 text-sm font-medium">Failed to load details</div>
                        )}
                    </div>
                )}
            </div>

            <PopupModal
                isOpen={!!popup}
                onClose={() => setPopup(null)}
                type={popup?.type || "info"}
                title={popup?.title || ""}
                message={popup?.message || ""}
                onConfirm={popup?.onConfirm}
            />
        </div>
    );
}
