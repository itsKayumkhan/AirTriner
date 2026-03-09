"use client";

import { useState, useEffect } from "react";
import { Download, Wallet, Percent, TrendingUp, TrendingDown, Info, MoreHorizontal, Loader2, CheckCircle, Clock, AlertTriangle, Shield } from "lucide-react";
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

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch payment transactions with booking details
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
                // Collect user IDs
                const userIds = new Set<string>();
                ptData.forEach((pt: any) => {
                    if (pt.bookings) {
                        userIds.add(pt.bookings.athlete_id);
                        userIds.add(pt.bookings.trainer_id);
                    }
                });

                // Fetch user names
                const { data: usersData } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", Array.from(userIds));

                const usersMap = new Map(
                    (usersData || []).map((u: any) => [u.id, { name: `${u.first_name} ${u.last_name}`.trim(), initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase() }])
                );

                // Calculate aggregates
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

                // Format transactions for table
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
        { title: "Total Platform Volume", value: `$${totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: "+12.5%", desc: "vs last month", icon: <Wallet size={24} />, isNegative: false },
        { title: "Commissions Earned", value: `$${totalCommissions.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: "+8.2%", desc: "vs last month", icon: <Percent size={24} />, isNegative: false },
        { title: "Pending Payouts", value: `$${pendingPayouts.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, req: `${heldCount} held`, desc: "awaiting release", icon: <TrendingDown size={24} />, isNegative: true },
    ];

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Payments & Revenue</h1>
                    <p className="text-sm font-medium text-text-main/60">Real-time overview of platform volume and payout distribution.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                    >
                        <Download size={18} strokeWidth={3} /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-surface border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-gray-700 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-text-main/60 text-sm font-bold tracking-wide mb-1">{stat.title}</div>
                                <div className="text-3xl font-black text-text-main">{loading ? "..." : stat.value}</div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center text-gray-600 transition-colors group-hover:text-primary group-hover:bg-primary/10">
                                {stat.icon}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <span className={`px-2 py-1 rounded bg-[#272A35] text-xs font-black tracking-widest flex items-center gap-1 ${stat.isNegative ? "text-red-500" : "text-primary"}`}>
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

                {/* Revenue Trends - keep the same visual bar chart */}
                <div className="lg:col-span-2 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-black text-text-main">Revenue Trends</h2>
                            <p className="text-sm text-text-main/60 font-medium">Monthly performance analytics</p>
                        </div>
                        <select className="bg-surface border border-white/5 rounded-full px-4 py-2 text-xs font-bold text-text-main/80 focus:outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors">
                            <option>Last 6 Months</option>
                            <option>Last 12 Months</option>
                            <option>This Year</option>
                        </select>
                    </div>
                    {/* Bar Chart Simulation */}
                    <div className="flex-1 min-h-[200px] flex items-end justify-between gap-3 mt-4 border-b border-white/5/50 pb-4">
                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN"].map((month, i) => {
                            const heights = [30, 50, 100, 45, 60, 75];
                            const isHigh = i === 2; // MAR
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-4 group h-full">
                                    <div className="w-full flex-1 flex items-end justify-center">
                                        <div
                                            style={{ height: `${heights[i]}%` }}
                                            className={`w-full max-w-[48px] rounded-t-xl transition-all duration-500 ease-out group-hover:bg-primary/80 ${isHigh ? "bg-primary shadow-[0_0_15px_rgba(163,255,18,0.25)]" : "bg-[#272A35]"}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-text-main/40 tracking-widest">{month}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Payout Distribution - Now Live */}
                <div className="lg:col-span-1 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <h2 className="text-lg font-black text-text-main mb-6">Payout Distribution</h2>

                    <div className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold flex items-center gap-2"><CheckCircle size={14} className="text-primary" /> Released</span>
                                <span className="text-text-main font-black">{loading ? "..." : `${releasedPct}%`}</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(163,255,18,0.3)] transition-all duration-700" style={{ width: `${releasedPct}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold flex items-center gap-2"><Clock size={14} className="text-yellow-500" /> Held (Escrow)</span>
                                <span className="text-text-main font-black">{loading ? "..." : `${heldPct}%`}</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 rounded-full transition-all duration-700" style={{ width: `${heldPct}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Refunded</span>
                                <span className="text-text-main font-black">{loading ? "..." : `${refundedPct}%`}</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${refundedPct}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 bg-surface border border-white/5 rounded-xl p-4 flex gap-3 text-sm">
                        <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-text-main/60 font-medium leading-relaxed">
                            Release held payouts manually below, or configure automatic payout timing.
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-surface border border-white/5 rounded-[24px] p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-text-main">Recent Transactions</h2>
                    <button className="text-primary text-xs font-black uppercase tracking-widest hover:text-text-main transition-colors">
                        View All
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="pb-4 font-black">Transaction ID</th>
                                <th className="pb-4 font-black">Customer</th>
                                <th className="pb-4 font-black">Trainer</th>
                                <th className="pb-4 font-black">Date</th>
                                <th className="pb-4 font-black">Amount</th>
                                <th className="pb-4 font-black">Status</th>
                                <th className="pb-4 font-black text-right">Action</th>
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
                                    <tr key={t.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                        <td className="py-4 font-medium text-text-main/60">{t.displayId}</td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#272A35] text-text-main/80 flex items-center justify-center font-bold text-xs border border-gray-700">
                                                    {t.initials}
                                                </div>
                                                <span className="font-bold text-text-main tracking-wide">{t.customer}</span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#1e3a8a]/30 text-text-main/80 flex items-center justify-center font-bold text-xs border border-[#2563eb]/20">
                                                    {t.trainerInitials}
                                                </div>
                                                <span className="font-medium text-text-main/80">{t.trainer}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-text-main/60 font-medium">{t.date}</td>
                                        <td className="py-4 font-black text-text-main text-base">{t.amount}</td>
                                        <td className="py-4">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                t.status === "released"
                                                    ? "bg-primary/10 text-primary border-primary/20"
                                                    : t.status === "held"
                                                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                                    : t.status === "refunded"
                                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                    : "bg-[#272A35] text-text-main/80 border-gray-700"
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            {t.status === "held" ? (
                                                <button
                                                    onClick={() => handleReleasePayout(t.id, t.bookingId)}
                                                    disabled={processing === t.id}
                                                    className="px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-bg transition-all disabled:opacity-50"
                                                >
                                                    {processing === t.id ? <Loader2 size={14} className="inline animate-spin" /> : "Release"}
                                                </button>
                                            ) : (
                                                <button className="text-text-main/40 hover:text-text-main transition-colors">
                                                    <MoreHorizontal size={20} />
                                                </button>
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
