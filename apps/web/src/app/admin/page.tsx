"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Users, Dumbbell, DollarSign, CalendarCheck, Search, Filter, Download, Check, ChevronDown } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

export default function AdminDashboardPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState({ athletes: 0, trainers: 0, revenue: 0, activeBookings: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartHeights, setChartHeights] = useState<number[]>(Array(12).fill(20));
    const [athleteSignups, setAthleteSignups] = useState<number[]>(Array(12).fill(0));
    const [trainerSignups, setTrainerSignups] = useState<number[]>(Array(12).fill(0));
    const [thisMonthNewUsers, setThisMonthNewUsers] = useState<number>(0);
    const [txFilter, setTxFilter] = useState<"All" | "Completed" | "Pending">("All");
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilterMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await adminFetch("/api/admin/dashboard-stats");
                if (!res.ok) throw new Error(`Failed to load dashboard stats: ${res.status}`);
                const { stats, transactions, activities, chartHeights, athleteSignups, trainerSignups, thisMonthNewUsers } = await res.json();
                setStats(stats);
                setTransactions(transactions || []);
                setActivities(activities || []);
                setChartHeights(chartHeights || Array(12).fill(20));
                setAthleteSignups(athleteSignups || Array(12).fill(0));
                setTrainerSignups(trainerSignups || Array(12).fill(0));
                setThisMonthNewUsers(thisMonthNewUsers || 0);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleExportCSV = () => {
        const headers = ["Transaction ID", "Athlete", "Trainer", "Date", "Amount", "Status"];

        const exportData = filteredTransactions.map(t => [
            t.id,
            t.athlete,
            t.trainer,
            t.date,
            t.amount,
            t.status
        ]);

        const csvContent = [
            headers.join(","),
            ...exportData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTransactions = transactions.filter(t => {
        if (txFilter === "All") return true;
        return t.status === txFilter;
    });

    const statCards = [
        { title: "Total Athletes", value: stats.athletes.toLocaleString(), icon: <Users size={20} className="text-blue-500" />, iconBg: "bg-blue-500/10" },
        { title: "Total Trainers", value: stats.trainers.toLocaleString(), icon: <Dumbbell size={20} className="text-purple-500" />, iconBg: "bg-purple-500/10" },
        { title: "Total Revenue", value: `$${stats.revenue.toLocaleString()}`, icon: <DollarSign size={20} className="text-primary" />, iconBg: "bg-primary/10" },
        { title: "Active Bookings", value: stats.activeBookings.toLocaleString(), icon: <CalendarCheck size={20} className="text-orange-500" />, iconBg: "bg-orange-500/10" },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="space-y-6">

            {/* Top Bar inside Content */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-8">
                <h1 className="text-2xl font-black text-text-main tracking-tight">Overview</h1>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="bg-surface border border-white/5 rounded-[24px] p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="text-text-main/60 text-sm font-bold mb-1">{stat.title}</div>
                        <div className="text-3xl font-black text-text-main">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart Mock */}
                <div className="lg:col-span-2 bg-surface border border-white/5 rounded-[24px] p-6 self-start">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-black text-text-main">Platform Growth</h2>
                            <p className="text-sm text-text-main/60">New user signups per month</p>
                            {thisMonthNewUsers > 0 && (
                                <p className="text-xs font-bold text-primary mt-1">{thisMonthNewUsers} new users this month</p>
                            )}
                        </div>
                        <button className="px-4 py-2 rounded-full border border-gray-700 text-xs font-bold text-text-main/80 hover:text-text-main transition-colors">
                            Last 12 Months
                        </button>
                    </div>
                    {/* CSS Bar Chart - Stacked: athletes (bottom, primary) + trainers (top, blue) */}
                    <div className="flex flex-col gap-2 mt-4">
                        <div className="h-48 sm:h-56 flex items-end justify-between gap-1 sm:gap-1.5 px-1">
                            {["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].map((month, i) => {
                                const isActive = i === new Date().getMonth();
                                const aCount = athleteSignups[i] || 0;
                                const tCount = trainerSignups[i] || 0;
                                const total = aCount + tCount;
                                const colHeight = Math.max(chartHeights[i], 15);
                                const athletePct = total > 0 ? (aCount / total) * 100 : 0;
                                const trainerPct = total > 0 ? (tCount / total) * 100 : 0;
                                const monthFull = ["January","February","March","April","May","June","July","August","September","October","November","December"][i];
                                const tooltip = `${monthFull}: ${aCount} athletes + ${tCount} trainers`;
                                return (
                                    <div key={month} className="flex-1 flex justify-center group" title={tooltip}>
                                        <div
                                            style={{ height: `${colHeight}%` }}
                                            className="w-full max-w-10 rounded-t-md overflow-hidden transition-all duration-500 flex flex-col"
                                        >
                                            {total === 0 ? (
                                                <div className="w-full h-full bg-white/10" />
                                            ) : (
                                                <>
                                                    <div
                                                        style={{ height: `${trainerPct}%` }}
                                                        className="w-full bg-blue-500/70 group-hover:bg-blue-500 transition-colors"
                                                    />
                                                    <div
                                                        style={{ height: `${athletePct}%` }}
                                                        className={`w-full transition-colors ${isActive ? "bg-primary shadow-[0_0_12px_rgba(69,208,255,0.3)]" : "bg-primary/80 group-hover:bg-primary"}`}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between px-1 border-t border-white/5 pt-2">
                            {["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].map((month, i) => (
                                <div key={month} className="flex-1 flex justify-center">
                                    <span className={`text-[8px] sm:text-[9px] font-bold tracking-widest ${i % 2 !== 0 ? "hidden sm:block" : ""} ${i === new Date().getMonth() ? "text-primary" : "text-text-main/40"}`}>{month}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 pt-2 text-[10px] font-bold uppercase tracking-widest text-text-main/60">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Athletes</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/70 inline-block" /> Trainers</span>
                        </div>
                    </div>
                </div>

                {/* Activity Log */}
                <div className="lg:col-span-1 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-lg font-black text-text-main">Activity Log</h2>
                        <Link href="/admin/bookings" className="text-primary text-xs font-bold uppercase tracking-widest hover:underline">View All</Link>
                    </div>
                    <div className="space-y-6 flex-1">
                        {activities.map((act, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="mt-1.5 relative">
                                    <div className={`w-2.5 h-2.5 rounded-full ${act.dot} z-10 relative`}></div>
                                    {i !== activities.length - 1 && (
                                        <div className="absolute top-2.5 left-1/2 -ml-[1px] w-[2px] h-12 bg-gray-800"></div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-text-main leading-tight mb-1">{act.title}</div>
                                    <div className="text-xs text-text-main/60 mb-1">{act.desc}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">{act.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-text-main">Recent Transactions</h2>
                    <div className="flex gap-3 items-center">
                        <div className="relative" ref={filterRef}>
                            <button
                                onClick={() => setShowFilterMenu(v => !v)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-colors ${txFilter !== "All" ? "border-white/[0.14] text-text-main bg-white/[0.06]" : "border-white/[0.07] text-text-main/50 hover:text-text-main hover:border-white/[0.12]"}`}
                            >
                                <Filter size={14} /> {txFilter === "All" ? "Filter" : txFilter} <ChevronDown size={12} className={`transition-transform ${showFilterMenu ? "rotate-180" : ""}`} />
                            </button>
                            {showFilterMenu && (
                                <div className="absolute right-0 top-full mt-2 w-40 bg-surface border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                                    {(["All", "Completed", "Pending"] as const).map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => { setTxFilter(opt); setShowFilterMenu(false); }}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors hover:bg-white/5 ${txFilter === opt ? "text-primary" : "text-text-main/70"}`}
                                        >
                                            {opt}
                                            {txFilter === opt && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 text-xs font-bold text-text-main/80 hover:text-text-main transition-colors"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.05] text-xs font-bold tracking-wide text-text-main/40 bg-white/[0.03]">
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Transaction ID</th>
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Athlete</th>
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Trainer</th>
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Date</th>
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Amount</th>
                                <th className="pb-4 pt-3 px-4 font-black whitespace-nowrap text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-text-main/40 font-bold text-sm">
                                        No transactions match the current filter.
                                    </td>
                                </tr>
                            ) : filteredTransactions.map((t, i) => (
                                <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors">
                                    <td className="py-4 px-4 font-medium text-text-main/60 whitespace-nowrap text-center">{t.id}</td>
                                    <td className="py-4 px-4 text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#fce6cd] flex-shrink-0"></div>
                                            <span className="font-bold text-text-main whitespace-nowrap">{t.athlete}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-text-main/80 font-medium whitespace-nowrap text-center">{t.trainer}</td>
                                    <td className="py-4 px-4 text-text-main/60 text-xs tracking-wide whitespace-nowrap text-center">{t.date}</td>
                                    <td className="py-4 px-4 font-black text-text-main whitespace-nowrap text-center">{t.amount}</td>
                                    <td className="py-4 px-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${t.status === "Completed"
                                            ? "bg-primary/10 text-primary border-primary/20"
                                            : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                            }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
