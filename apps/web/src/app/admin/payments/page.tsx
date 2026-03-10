"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Wallet, Percent, TrendingUp, TrendingDown, Info, MoreHorizontal, ArrowUpRight, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
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
            const { data: ptData, error: ptError } = await supabase
                .from("payment_transactions")
                .select(`
                    id, booking_id, stripe_payment_intent_id, stripe_transfer_id,
                    amount, platform_fee, trainer_payout, status, hold_until, released_at, created_at,
                    bookings (id, athlete_id, trainer_id, sport, scheduled_at)
                `)
                .order("created_at", { ascending: false });

            if (ptError) throw ptError;

            if (ptData && ptData.length > 0) {
                const userIds = new Set<string>();
                ptData.forEach((pt: any) => {
                    if (pt.bookings) {
                        userIds.add(pt.bookings.athlete_id);
                        userIds.add(pt.bookings.trainer_id);
                    }
                });

                const { data: usersData } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", Array.from(userIds));

                const usersMap = new Map(
                    (usersData || []).map((u: any) => [u.id, { name: `${u.first_name} ${u.last_name}`.trim(), initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase() }])
                );

                let vol = 0, comm = 0, pending = 0;
                let held = 0, released = 0, refunded = 0;

                ptData.forEach((pt: any) => {
                    const amt = Number(pt.amount || 0);
                    const fee = Number(pt.platform_fee || 0);
                    vol += amt;
                    comm += fee;
                    if (pt.status === "held") { pending += Number(pt.trainer_payout || 0); held++; }
                    if (pt.status === "released") released++;
                    if (pt.status === "refunded") refunded++;
                });

                setTotalVolume(vol);
                setTotalCommissions(comm);
                setPendingPayouts(pending);
                setHeldCount(held);
                setReleasedCount(released);
                setRefundedCount(refunded);

                const formatted = ptData.map((pt: any) => {
                    const athleteInfo = usersMap.get(pt.bookings?.athlete_id) || { name: "Unknown", initials: "?" };
                    const trainerInfo = usersMap.get(pt.bookings?.trainer_id) || { name: "Unknown", initials: "?" };
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
                        holdUntil: pt.hold_until ? new Date(pt.hold_until).toLocaleDateString() : null,
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
                    const { error } = await supabase
                        .from("payment_transactions")
                        .update({ status: "released", released_at: new Date().toISOString() })
                        .eq("id", txId);

                    if (error) throw error;

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
        { title: "Total Platform Volume", value: `$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: "+12.5%", desc: "vs last month", icon: <Wallet size={20} />, isNegative: false },
        { title: "Commissions Earned", value: `$${totalCommissions.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: "+8.2%", desc: "vs last month", icon: <Percent size={20} />, isNegative: false },
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
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-surface/80 border border-white/10 text-text-main hover:bg-white/5 font-black text-sm uppercase tracking-widest hover:border-primary/50 transition-all w-full md:w-auto"
                    >
                        <Download size={18} strokeWidth={3} /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.02)]">
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
                            <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest flex items-center gap-1 ${stat.isNegative ? "text-red-500 bg-red-500/10 border border-red-500/20" : "text-green-500 bg-green-500/10 border border-green-500/20"}`}>
                                {stat.isNegative ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                {stat.req}
                            </span>
                            <span className="text-text-main/40 text-xs font-medium">{stat.desc}</span>
                        </div>
                    </div>
                ))}
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
                        <select className="bg-[#12141A] border border-white/10 rounded-xl px-4 py-2 text-xs font-black text-text-main/80 focus:outline-none focus:border-primary/50 appearance-none cursor-pointer transition-colors shadow-inner">
                            <option>Last 6 Months</option>
                            <option>Last 12 Months</option>
                            <option>This Year</option>
                        </select>
                    </div>
                    {/* Bar Chart Simulation */}
                    <div className="flex-1 min-h-[240px] flex items-end justify-between gap-3 mt-4 border-b border-white/5 pb-4">
                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN"].map((month, i) => {
                            const heights = [30, 50, 100, 45, 60, 75];
                            const isHigh = i === 2; // MAR
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-4 group h-full relative cursor-pointer">
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                                    <div className="w-full flex-1 flex items-end justify-center z-10">
                                        <div
                                            style={{ height: `${heights[i]}%` }}
                                            className={`w-full max-w-[64px] rounded-t-xl transition-all duration-500 ease-out
                                                ${isHigh ? "bg-gradient-to-t from-primary/50 to-primary shadow-[0_0_20px_rgba(163,255,18,0.3)]" : "bg-gradient-to-t from-white/5 to-white/10 group-hover:from-white/10 group-hover:to-white/20"}
                                            `}
                                        ></div>
                                    </div>
                                    <span className={`text-[10px] font-black tracking-widest transition-colors ${isHigh ? 'text-primary' : 'text-text-main/40 group-hover:text-text-main'}`}>{month}</span>
                                </div>
                            );
                        })}
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
                                <div className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(163,255,18,0.5)] transition-all duration-700" style={{ width: `${releasedPct}%` }}></div>
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
                                    <tr key={t.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-5 pl-8">
                                            <div className="flex items-center gap-2 text-text-main/60 font-black text-xs tracking-wider uppercase">
                                                {t.displayId}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/5 text-text-main flex items-center justify-center font-black text-xs border border-white/10 flex-shrink-0">
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
                                                <button
                                                    onClick={() => handleReleasePayout(t.id, t.bookingId)}
                                                    disabled={processing === t.id}
                                                    className="px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-bg transition-all disabled:opacity-50"
                                                >
                                                    {processing === t.id ? <Loader2 size={14} className="inline animate-spin" /> : "Release"}
                                                </button>
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
                                                <div ref={actionMenuRef} className="absolute right-8 top-12 z-[100] w-48 bg-[#1A1D24] border border-white/10 rounded-2xl shadow-2xl py-2 flex flex-col overflow-hidden text-left origin-top-right animate-in fade-in zoom-in-95 duration-200">
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
