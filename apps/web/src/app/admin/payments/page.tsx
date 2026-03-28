"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Wallet, Percent, TrendingUp, TrendingDown, Info, MoreHorizontal, ArrowUpRight, CheckCircle, Clock, AlertTriangle, Loader2, Zap, ShieldAlert, UserX, RefreshCw, Timer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PopupModal from "@/components/common/PopupModal";

export default function AdminPaymentsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [totalVolume, setTotalVolume] = useState(0);
    const [totalCommissions, setTotalCommissions] = useState(0);
    const [pendingPayouts, setPendingPayouts] = useState(0);
    const [heldCount, setHeldCount] = useState(0);
    const [releasedCount, setReleasedCount] = useState(0);
    const [refundedCount, setRefundedCount] = useState(0);
    const [readyCount, setReadyCount] = useState(0);
    const [readyAmount, setReadyAmount] = useState(0);
    const [blockedCount, setBlockedCount] = useState(0);
    const [noStripeCount, setNoStripeCount] = useState(0);
    const [bulkReleasing, setBulkReleasing] = useState(false);
    const [volPct, setVolPct] = useState<number | null>(null);
    const [commPct, setCommPct] = useState<number | null>(null);
    const [monthlyChart, setMonthlyChart] = useState<{ month: string; amount: number }[]>([]);

    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        loadData();
    }, []);

    // Handle outside click for action menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActionMenuOpen(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Use admin API route (service role key) to bypass RLS on payment_transactions
            const res = await fetch("/api/admin/payment-transactions");
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to fetch transactions");

            const { ptData, userMap, stripeMap: stripeObj, disputedBookingIds, volPct: vp, commPct: cp, monthlyChart: mc } = json;
            if (vp !== undefined) setVolPct(vp);
            if (cp !== undefined) setCommPct(cp);
            if (mc) setMonthlyChart(mc);

            if (ptData && ptData.length > 0) {
                const usersMap = new Map(Object.entries(userMap as Record<string, { name: string; initials: string }>));
                const stripeMap = new Map(Object.entries(stripeObj as Record<string, string | null>));
                const disputedSet = new Set(disputedBookingIds as string[]);

                let vol = 0, comm = 0, pending = 0;
                let held = 0, released = 0, refunded = 0;
                let ready = 0, readyAmt = 0, blocked = 0, noStripe = 0;
                const now = new Date();

                ptData.forEach((pt: any) => {
                    const amt = Number(pt.amount || 0);
                    const fee = Number(pt.platform_fee || 0);
                    const payout = Number(pt.trainer_payout || 0);
                    vol += amt;
                    comm += fee;
                    if (pt.status === "held") {
                        pending += payout;
                        held++;
                        const holdExpired = !pt.hold_until || new Date(pt.hold_until) <= now;
                        const hasDispute = disputedSet.has(pt.booking_id);
                        const trainerStripe = stripeMap.get(pt.bookings?.trainer_id);
                        const bookingCompleted = pt.bookings?.status === "completed";
                        if (hasDispute) blocked++;
                        else if (!trainerStripe) noStripe++;
                        else if (holdExpired && bookingCompleted) { ready++; readyAmt += payout; }
                    }
                    if (pt.status === "released") released++;
                    if (pt.status === "refunded") refunded++;
                });

                setTotalVolume(vol);
                setTotalCommissions(comm);
                setPendingPayouts(pending);
                setHeldCount(held);
                setReleasedCount(released);
                setRefundedCount(refunded);
                setReadyCount(ready);
                setReadyAmount(readyAmt);
                setBlockedCount(blocked);
                setNoStripeCount(noStripe);

                const formatted = ptData.map((pt: any) => {
                    const athleteInfo = usersMap.get(pt.bookings?.athlete_id) || { name: "Unknown", initials: "?" };
                    const trainerInfo = usersMap.get(pt.bookings?.trainer_id) || { name: "Unknown", initials: "?" };
                    const holdDate = pt.hold_until ? new Date(pt.hold_until) : null;
                    const holdExpired = !holdDate || holdDate <= now;
                    const hasDispute = disputedSet.has(pt.booking_id);
                    const hasStripe = !!stripeMap.get(pt.bookings?.trainer_id);
                    const bookingCompleted = pt.bookings?.status === "completed";
                    const canRelease = pt.status === "held" && holdExpired && !hasDispute && hasStripe && bookingCompleted;

                    // Hold countdown
                    let holdLabel: string | null = null;
                    if (pt.status === "held" && holdDate && holdDate > now) {
                        const diffMs = holdDate.getTime() - now.getTime();
                        const hrs = Math.floor(diffMs / 3600000);
                        const mins = Math.floor((diffMs % 3600000) / 60000);
                        holdLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    }

                    return {
                        id: pt.id,
                        displayId: `#TRX-${pt.id.substring(0, 6).toUpperCase()}`,
                        customer: athleteInfo.name,
                        initials: athleteInfo.initials,
                        trainer: trainerInfo.name,
                        trainerInitials: trainerInfo.initials,
                        date: new Date(pt.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                        amount: `$${Number(pt.amount || 0).toFixed(2)}`,
                        trainerPayout: `$${Number(pt.trainer_payout || 0).toFixed(2)}`,
                        platformFee: `$${Number(pt.platform_fee || 0).toFixed(2)}`,
                        status: pt.status,
                        bookingId: pt.booking_id,
                        holdUntil: holdDate ? holdDate.toLocaleDateString() : null,
                        holdLabel,
                        hasDispute,
                        hasStripe,
                        bookingCompleted,
                        canRelease,
                    };
                });

                setTransactions(formatted);
            } else {
                setTransactions([]);
                setTotalVolume(0);
                setTotalCommissions(0);
                setPendingPayouts(0);
            }
        } catch (err) {
            console.error("Failed to load payments:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleReleasePayout = async (txId: string, bookingId: string) => {
        showConfirm(
            "Release Payout",
            "Are you sure you want to release this payout to the trainer? This action will transfer the funds to their account.",
            async () => {
                setProcessing(txId);
                try {
                    const res = await fetch("/api/admin/release-single-payout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ txId, bookingId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");

                    loadData();
                    showAlert("success", "Payout Released", "The funds have been successfully released to the trainer.");
                } catch (err) {
                    console.error(err);
                    showAlert("error", "Error", "Failed to release payout. Please try again later.");
                } finally {
                    setProcessing(null);
                }
            }
        );
    };

    const handleBulkRelease = async () => {
        if (readyCount === 0) return;
        showConfirm(
            "Release All Ready Payouts",
            `Release ${readyCount} payout${readyCount > 1 ? "s" : ""} totalling $${readyAmount.toFixed(2)} to trainers? Only payouts with expired holds, completed bookings, and connected Stripe accounts will be released.`,
            async () => {
                setBulkReleasing(true);
                try {
                    const res = await fetch("/api/admin/release-payouts", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    await loadData();
                    showAlert("success", "Payouts Released", `Successfully released ${data.released} payout${data.released !== 1 ? "s" : ""}${data.skipped > 0 ? `. ${data.skipped} skipped (dispute/no Stripe).` : "."}`);
                } catch (err: any) {
                    showAlert("error", "Release Failed", err.message || "Could not release payouts. Try again.");
                } finally {
                    setBulkReleasing(false);
                }
            }
        );
    };

    const handleExportCSV = () => {
        const csvHeaders = ["Transaction ID", "Customer", "Trainer", "Date", "Amount", "Platform Fee", "Trainer Payout", "Status"];
        const csvRows = transactions.map(t =>
            [t.displayId, t.customer, t.trainer, t.date, t.amount, t.platformFee, t.trainerPayout, t.status].join(",")
        );
        const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `payments_report_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    // Calculate distribution percentages
    const totalTx = heldCount + releasedCount + refundedCount || 1;
    const heldPct = Math.round((heldCount / totalTx) * 100);
    const releasedPct = Math.round((releasedCount / totalTx) * 100);
    const refundedPct = Math.round((refundedCount / totalTx) * 100);

    const stats = [
        { title: "Total Platform Volume", value: `$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: volPct === null ? null : `${volPct >= 0 ? "+" : ""}${volPct}%`, desc: "vs last month", icon: <Wallet size={20} />, isNegative: volPct !== null && volPct < 0 },
        { title: "Commissions Earned", value: `$${totalCommissions.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: commPct === null ? null : `${commPct >= 0 ? "+" : ""}${commPct}%`, desc: "vs last month", icon: <Percent size={20} />, isNegative: commPct !== null && commPct < 0 },
        { title: "Pending Payouts", value: `$${pendingPayouts.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: `${heldCount} held`, desc: "awaiting release", icon: <TrendingDown size={20} />, isNegative: true },
    ];

    return (
        <div className="space-y-8 max-w-[1600px] w-full">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                        <span className="text-text-main">Payments &</span>
                        <span className="text-primary border-b-4 border-primary pb-1">Revenue</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                        Real-time overview of platform volume, transaction history, and payout distribution.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-surface/80 border border-white/[0.04] text-text-main hover:bg-white/5 font-black text-sm uppercase tracking-widest hover:border-primary/50 transition-all w-full md:w-auto"
                    >
                        <Download size={18} strokeWidth={3} /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-white/[0.06] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                        <div className={`absolute top-0 bottom-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5 ${stat.isNegative ? "bg-red-500 border-red-500" : "bg-primary border-primary"}`}></div>

                        <div className="flex justify-between items-start mb-6">
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight">{stat.title}</span>
                            <div className={`p-2.5 rounded-xl transition-colors ${stat.isNegative ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black text-text-main tracking-tighter mb-4">
                            {loading ? "..." : stat.value}
                        </div>

                        <div className="flex items-center gap-2">
                            {stat.req !== null && (
                                <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest flex items-center gap-1 ${stat.isNegative ? "text-red-500 bg-red-500/10 border border-red-500/20" : "text-green-500 bg-green-500/10 border border-green-500/20"}`}>
                                    {stat.isNegative ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                    {stat.req}
                                </span>
                            )}
                            <span className="text-text-main/40 text-xs font-medium">{stat.desc}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Payout Command Center ── */}
            <div className="bg-gradient-to-r from-surface to-surface/60 border border-white/5 rounded-[24px] p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap size={14} className="text-primary" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-text-main/60">Daily Payout Queue</h2>
                        </div>
                        <p className="text-text-main/40 text-xs font-medium mb-4">Athletes pay upfront → funds held in escrow → admin releases to trainers after hold period.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-bg/60 border border-primary/20 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary/50 mb-1">Ready Now</p>
                                <p className="text-2xl font-black text-primary">{loading ? "…" : readyCount}</p>
                                <p className="text-[9px] text-text-main/30 font-medium mt-0.5">${readyAmount.toFixed(2)} to release</p>
                            </div>
                            <div className="bg-bg/60 border border-yellow-500/20 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500/50 mb-1">Held (Escrow)</p>
                                <p className="text-2xl font-black text-yellow-500">{loading ? "…" : heldCount}</p>
                                <p className="text-[9px] text-text-main/30 font-medium mt-0.5">awaiting hold expiry</p>
                            </div>
                            <div className="bg-bg/60 border border-red-500/20 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-red-400/50 mb-1">Dispute Blocked</p>
                                <p className="text-2xl font-black text-red-400">{loading ? "…" : blockedCount}</p>
                                <p className="text-[9px] text-text-main/30 font-medium mt-0.5">resolve dispute first</p>
                            </div>
                            <div className="bg-bg/60 border border-white/[0.05] rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-text-main/30 mb-1">No Stripe</p>
                                <p className="text-2xl font-black text-text-main/50">{loading ? "…" : noStripeCount}</p>
                                <p className="text-[9px] text-text-main/30 font-medium mt-0.5">trainer not connected</p>
                            </div>
                        </div>
                    </div>
                    {/* Right: action */}
                    <div className="flex flex-col items-stretch lg:items-end gap-3 lg:min-w-[200px]">
                        <button
                            onClick={handleBulkRelease}
                            disabled={bulkReleasing || readyCount === 0 || loading}
                            className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                                readyCount > 0
                                    ? "bg-primary text-bg hover:opacity-90 hover:shadow-[0_0_24px_rgba(69,208,255,.35)]"
                                    : "bg-white/5 text-text-main/30 cursor-not-allowed"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {bulkReleasing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} strokeWidth={2.5} />}
                            {bulkReleasing ? "Releasing…" : `Release All (${readyCount})`}
                        </button>
                        <button
                            onClick={loadData}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.06] text-text-main/40 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.04] hover:text-text-main/70 transition-all"
                        >
                            <RefreshCw size={12} /> Refresh Queue
                        </button>
                    </div>
                </div>
            </div>

            {/* Charts & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Trends */}
                <div className="lg:col-span-2 bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 flex flex-col shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-text-main uppercase tracking-widest">Revenue Trends</h2>
                            <p className="text-xs font-medium text-text-main/40 mt-1 uppercase tracking-wider">Monthly performance analytics</p>
                        </div>
                        <select className="bg-[#12141A] border border-white/[0.04] rounded-xl px-4 py-2 text-xs font-black text-text-main/80 focus:outline-none focus:border-primary/50 appearance-none cursor-pointer transition-colors shadow-inner">
                            <option>Last 6 Months</option>
                            <option>Last 12 Months</option>
                            <option>This Year</option>
                        </select>
                    </div>
                    {/* Bar Chart — Real Data */}
                    <div className="flex-1 min-h-[240px] flex items-end justify-between gap-3 mt-4 border-b border-white/5 pb-4">
                        {loading ? (
                            // Skeleton bars
                            [40, 60, 75, 50, 65, 80].map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 h-full">
                                    <div className="w-full flex-1 flex items-end justify-center">
                                        <div
                                            style={{ height: `${h}%` }}
                                            className="w-full max-w-[64px] rounded-t-xl bg-white/[0.05] animate-pulse"
                                        />
                                    </div>
                                    <div className="h-2 w-8 rounded bg-white/[0.05] animate-pulse" />
                                </div>
                            ))
                        ) : (() => {
                            const now2 = new Date();
                            const fallbackChart = monthlyChart.length > 0 ? monthlyChart : Array.from({ length: 6 }, (_, i) => {
                                const d = new Date(now2.getFullYear(), now2.getMonth() - (5 - i), 1);
                                return { month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(), amount: 0 };
                            });
                            const maxAmt = Math.max(...fallbackChart.map(m => m.amount), 1);
                            const currentMonth = now2.toLocaleString("en-US", { month: "short" }).toUpperCase();
                            const hasAnyData = fallbackChart.some(m => m.amount > 0);
                            return fallbackChart.map((m) => {
                                const heightPct = hasAnyData
                                    ? Math.max((m.amount / maxAmt) * 100, m.amount > 0 ? 8 : 20)
                                    : 20;
                                const isCurrent = m.month === currentMonth;
                                return (
                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-4 group h-full relative cursor-pointer">
                                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                                        <div className="w-full flex-1 flex items-end justify-center z-10">
                                            <div
                                                title={`$${m.amount.toFixed(2)}`}
                                                style={{ height: `${heightPct}%` }}
                                                className={`w-full max-w-[64px] rounded-t-xl transition-all duration-500 ease-out ${
                                                    isCurrent && hasAnyData
                                                        ? "bg-gradient-to-t from-primary/50 to-primary shadow-[0_0_20px_rgba(69,208,255,0.3)]"
                                                        : isCurrent
                                                        ? "bg-primary/20"
                                                        : "bg-gradient-to-t from-white/5 to-white/10 group-hover:from-white/10 group-hover:to-white/20"
                                                }`}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-black tracking-widest transition-colors ${isCurrent ? "text-primary" : "text-text-main/40 group-hover:text-text-main"}`}>
                                            {m.month}
                                        </span>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Payout Distribution — Live Data */}
                <div className="lg:col-span-1 bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 flex flex-col shadow-2xl relative overflow-hidden">
                    <h2 className="text-xl font-black text-text-main uppercase tracking-widest mb-8">Payout Distro</h2>

                    <div className="space-y-8 flex-1">
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/80 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><CheckCircle size={14} className="text-primary" /> Released</span>
                                <span className="text-text-main font-black text-xl leading-none">{loading ? "..." : `${releasedPct}%`}</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(69,208,255,0.5)] transition-all duration-700" style={{ width: `${releasedPct}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/80 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Clock size={14} className="text-yellow-500" /> Held (Escrow)</span>
                                <span className="text-text-main font-black text-xl leading-none">{loading ? "..." : `${heldPct}%`}</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-yellow-500 rounded-full transition-all duration-700" style={{ width: `${heldPct}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/80 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Refunded</span>
                                <span className="text-text-main font-black text-xl leading-none">{loading ? "..." : `${refundedPct}%`}</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner flex">
                                <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${refundedPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4 text-sm relative overflow-hidden">
                        <div className="w-1 bg-primary absolute top-0 bottom-0 left-0"></div>
                        <Info size={20} className="text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-text-main/80 font-medium leading-relaxed text-xs">
                            Release held payouts manually below, or configure automatic payout timing in <span className="text-primary font-bold">Settings</span>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-8 pb-4">
                    <h2 className="text-xl font-black text-text-main uppercase tracking-widest">Recent Ledgers</h2>
                    <button type="button" onClick={() => showAlert("info", "Coming Soon", "Full database view coming soon!")} className="flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                        View Database <ArrowUpRight size={14} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40 bg-white/5">
                                <th className="px-6 py-5 pl-8">Txn Ref</th>
                                <th className="px-6 py-5">Customer</th>
                                <th className="px-6 py-5">Trainer</th>
                                <th className="px-6 py-5">Processed Date</th>
                                <th className="px-6 py-5">Amount (USD)</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 pr-8 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <Loader2 size={24} className="mx-auto animate-spin text-primary opacity-50 mb-2" />
                                        <p className="text-text-main/40 text-sm font-bold tracking-widest uppercase">Loading Transactions</p>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                            <Wallet size={20} className="text-text-main/40" />
                                        </div>
                                        <p className="text-text-main font-bold">No transactions yet</p>
                                        <p className="text-sm text-text-main/40">Transactions will appear here once bookings are paid.</p>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-5 pl-8">
                                            <div className="flex items-center gap-2 text-text-main/60 font-black text-xs tracking-wider uppercase">
                                                {t.displayId}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/5 text-text-main flex items-center justify-center font-black text-xs border border-white/[0.04] flex-shrink-0">
                                                    {t.initials}
                                                </div>
                                                <span className="font-bold text-text-main tracking-wide group-hover:text-primary transition-colors cursor-pointer">{t.customer}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#1e3a8a]/30 text-text-main/80 flex items-center justify-center font-bold text-xs border border-[#2563eb]/20 flex-shrink-0">
                                                    {t.trainerInitials}
                                                </div>
                                                <span className="font-medium text-text-main/80">{t.trainer}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-text-main/60 font-medium">{t.date}</td>
                                        <td className="px-6 py-5 font-black text-text-main text-base tracking-tighter">{t.amount}</td>
                                        <td className="px-6 py-5">
                                            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest inline-flex ${
                                                t.status === "released"
                                                    ? "bg-primary/10 text-primary border-primary/20"
                                                    : t.status === "held"
                                                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                                    : t.status === "refunded"
                                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                    : "bg-[#272A35] text-text-main/80 border-gray-700"
                                            }`}>
                                                {t.status === "released" ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 pr-8 text-right relative">
                                            {t.status === "held" ? (
                                                <div className="flex flex-col items-end gap-1.5">
                                                    {/* Edge case badges */}
                                                    {t.hasDispute && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest">
                                                            <ShieldAlert size={9} /> Dispute Active
                                                        </span>
                                                    )}
                                                    {!t.hasStripe && !t.hasDispute && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.06] text-text-main/40 text-[8px] font-black uppercase tracking-widest">
                                                            <UserX size={9} /> No Stripe
                                                        </span>
                                                    )}
                                                    {t.holdLabel && !t.hasDispute && t.hasStripe && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] font-black uppercase tracking-widest">
                                                            <Timer size={9} /> {t.holdLabel}
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => handleReleasePayout(t.id, t.bookingId)}
                                                        disabled={processing === t.id || !t.canRelease}
                                                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                                            t.canRelease
                                                                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-bg"
                                                                : "bg-white/[0.03] text-text-main/20 border border-white/[0.04]"
                                                        }`}
                                                    >
                                                        {processing === t.id ? <Loader2 size={14} className="inline animate-spin" /> : "Release"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuOpen(actionMenuOpen === t.id ? null : t.id);
                                                    }}
                                                    className={`w-8 h-8 rounded-full flex justify-center items-center ml-auto transition-all outline-none ${actionMenuOpen === t.id ? 'bg-primary/20 text-primary' : 'text-text-main/40 hover:text-text-main hover:bg-white/5'}`}
                                                >
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            )}

                                            {actionMenuOpen === t.id && (
                                                <div ref={actionMenuRef} className="absolute right-8 top-12 z-[100] w-48 bg-[#1A1D24] border border-white/[0.04] rounded-2xl shadow-2xl py-2 flex flex-col overflow-hidden text-left origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => { showAlert("info", "Coming Soon", `Downloading receipt for ${t.displayId}`); setActionMenuOpen(null); }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-text-main hover:bg-white/5 transition-colors"
                                                    >
                                                        <Download size={14} /> Download Receipt
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
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
