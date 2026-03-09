"use client";

import { useState, useEffect } from "react";
import {
    Search, Download, RefreshCw, Loader2, Crown, Clock, XCircle, CheckCircle,
    TrendingUp, Users, AlertTriangle, MoreHorizontal
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
};

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("ALL");

    // Alert/Confirmation Popup State
    const [popup, setPopup] = useState<{
        type: "success" | "error" | "confirm" | "warning" | "info";
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    const showAlert = (type: "success" | "error" | "info", title: string, message: string) => {
        setPopup({ type, title, message });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setPopup({ type: "confirm", title, message, onConfirm });
    };

    // Aggregate stats
    const [totalActive, setTotalActive] = useState(0);
    const [totalTrial, setTotalTrial] = useState(0);
    const [totalExpired, setTotalExpired] = useState(0);
    const [totalCancelled, setTotalCancelled] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch trainer profiles with subscription data, joined with users for names/emails
            const { data, error } = await supabase
                .from("trainer_profiles")
                .select(`
                    id, user_id, subscription_status, subscription_expires_at, trial_started_at, sports,
                    users (id, first_name, last_name, email)
                `)
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
                    const name = `${firstName} ${lastName}`.trim() || "Unknown";

                    return {
                        id: tp.id,
                        userId: tp.user_id,
                        trainerName: name,
                        initials: `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase(),
                        email: tp.users?.email || "",
                        status: status,
                        expiresAt: tp.subscription_expires_at,
                        trialStartedAt: tp.trial_started_at,
                        sport: Array.isArray(tp.sports) && tp.sports.length > 0 ? tp.sports[0] : "General",
                    };
                });

                setSubscriptions(formatted);
                setTotalActive(active);
                setTotalTrial(trial);
                setTotalExpired(expired);
                setTotalCancelled(cancelled);
            }
        } catch (err) {
            console.error("Failed to load subscriptions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (profileId: string, newStatus: string) => {
        const title = newStatus === "active" ? "Activate Subscription" : "Cancel Subscription";
        const message = newStatus === "active" 
            ? "Are you sure you want to activate this trainer's subscription for 30 days?" 
            : "Are you sure you want to cancel this trainer's subscription?";

        showConfirm(title, message, async () => {
            setProcessing(profileId);
            try {
                const updateData: any = { subscription_status: newStatus };

                if (newStatus === "active") {
                    // Set expiry to 30 days from now
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    updateData.subscription_expires_at = expiresAt.toISOString();
                } else if (newStatus === "cancelled" || newStatus === "expired") {
                    updateData.subscription_expires_at = new Date().toISOString();
                }

                const { error } = await supabase
                    .from("trainer_profiles")
                    .update(updateData)
                    .eq("id", profileId);

                if (error) throw error;

                loadData();
                showAlert("success", "Success", `Subscription status updated to ${newStatus}.`);
            } catch (err) {
                console.error(err);
                showAlert("error", "Error", "Failed to update subscription status. Please try again.");
            } finally {
                setProcessing(null);
            }
        });
    };

    const handleExportCSV = () => {
        const csvHeaders = ["Trainer", "Email", "Status", "Sport", "Expires At", "Trial Started"];
        const csvRows = filteredSubs.map(s =>
            [s.trainerName, s.email, s.status, s.sport, s.expiresAt || "N/A", s.trialStartedAt || "N/A"].join(",")
        );
        const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `subscriptions_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    const filteredSubs = subscriptions.filter(s => {
        if (activeTab !== "ALL" && s.status !== activeTab.toLowerCase()) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!s.trainerName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const statusConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
        active: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: <CheckCircle size={12} /> },
        trial: { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", icon: <Clock size={12} /> },
        expired: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: <XCircle size={12} /> },
        cancelled: { color: "text-text-main/60", bg: "bg-[#272A35]", border: "border-gray-700", icon: <XCircle size={12} /> },
    };

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Subscription Management</h1>
                    <p className="text-sm font-medium text-text-main/60">View and manage trainer subscription statuses across the platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-5 py-3 rounded-full bg-surface border border-white/5 text-text-main/80 font-bold text-sm hover:border-gray-600 transition-all"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                    >
                        <Download size={18} strokeWidth={3} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-white/5 rounded-[20px] p-5 group hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Active</span>
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Crown size={18} /></div>
                    </div>
                    <div className="text-3xl font-black text-primary">{loading ? "..." : totalActive}</div>
                </div>
                <div className="bg-surface border border-white/5 rounded-[20px] p-5 group hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">On Trial</span>
                        <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center text-blue-400"><Clock size={18} /></div>
                    </div>
                    <div className="text-3xl font-black text-blue-400">{loading ? "..." : totalTrial}</div>
                </div>
                <div className="bg-surface border border-white/5 rounded-[20px] p-5 group hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Expired</span>
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={18} /></div>
                    </div>
                    <div className="text-3xl font-black text-red-500">{loading ? "..." : totalExpired}</div>
                </div>
                <div className="bg-surface border border-white/5 rounded-[20px] p-5 group hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Cancelled</span>
                        <div className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center text-text-main/60"><XCircle size={18} /></div>
                    </div>
                    <div className="text-3xl font-black text-text-main/60">{loading ? "..." : totalCancelled}</div>
                </div>
            </div>

            {/* Search & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full max-w-sm">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Search trainers by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm text-text-main focus:outline-none focus:border-gray-600 transition-colors"
                    />
                </div>

                <div className="flex bg-surface border border-white/5 rounded-full p-1.5 self-start md:self-auto">
                    {["ALL", "ACTIVE", "TRIAL", "EXPIRED", "CANCELLED"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${
                                activeTab === tab
                                    ? "bg-[#272A35] text-text-main shadow-sm"
                                    : "text-text-main/40 hover:text-text-main/80"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subscriptions Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="px-6 py-5">Trainer</th>
                                <th className="px-6 py-5">Email</th>
                                <th className="px-6 py-5">Sport</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Expires</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm border-t border-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <Loader2 size={24} className="mx-auto animate-spin text-primary opacity-50 mb-2" />
                                        <p className="text-text-main/40 text-sm font-bold tracking-widest uppercase">Loading Subscriptions</p>
                                    </td>
                                </tr>
                            ) : filteredSubs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                            <Users size={20} className="text-text-main/40" />
                                        </div>
                                        <p className="text-text-main font-bold">No subscriptions found</p>
                                        <p className="text-sm text-text-main/40">Try adjusting your filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSubs.map((s) => {
                                    const cfg = statusConfig[s.status] || statusConfig.cancelled;
                                    return (
                                        <tr key={s.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[#1e3a8a]/30 flex-shrink-0 border border-[#2563eb]/20 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                        {s.initials}
                                                    </div>
                                                    <span className="font-bold text-text-main tracking-wide">{s.trainerName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-text-main/60 font-medium">{s.email}</td>
                                            <td className="px-6 py-5 text-text-main/80 font-medium capitalize">{s.sport}</td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                    {cfg.icon} {s.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-text-main/60 font-medium">
                                                {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {s.status === "trial" || s.status === "expired" ? (
                                                        <button
                                                            onClick={() => handleStatusChange(s.id, "active")}
                                                            disabled={processing === s.id}
                                                            className="px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-bg transition-all disabled:opacity-50"
                                                        >
                                                            {processing === s.id ? <Loader2 size={14} className="inline animate-spin" /> : "Activate"}
                                                        </button>
                                                    ) : s.status === "active" ? (
                                                        <button
                                                            onClick={() => handleStatusChange(s.id, "cancelled")}
                                                            disabled={processing === s.id}
                                                            className="px-4 py-2 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            {processing === s.id ? <Loader2 size={14} className="inline animate-spin" /> : "Cancel"}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStatusChange(s.id, "active")}
                                                            disabled={processing === s.id}
                                                            className="px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-bg transition-all disabled:opacity-50"
                                                        >
                                                            {processing === s.id ? <Loader2 size={14} className="inline animate-spin" /> : "Reactivate"}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
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
