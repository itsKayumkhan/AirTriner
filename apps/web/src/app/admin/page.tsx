"use client";

import { useState, useEffect } from "react";
import { Users, Dumbbell, DollarSign, CalendarCheck, Search, Filter, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboardPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState({ athletes: 0, trainers: 0, revenue: 0, activeBookings: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const { count: athletesCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "athlete");
                const { count: trainersCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "trainer");
                const { data: revData } = await supabase.from("bookings").select("price").eq("status", "completed");
                const revenue = (revData || []).reduce((sum, b) => sum + Number(b.price || 0), 0);
                const { count: activeCount } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed");

                setStats({ athletes: athletesCount || 0, trainers: trainersCount || 0, revenue, activeBookings: activeCount || 0 });

                const { data: recentBookings } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(5);

                if (recentBookings && recentBookings.length > 0) {
                    const userIds = new Set<string>();
                    recentBookings.forEach((b: any) => { userIds.add(b.athlete_id); userIds.add(b.trainer_id); });
                    const { data: usersData } = await supabase.from("users").select("id, first_name, last_name").in("id", Array.from(userIds));
                    const usersMap = new Map((usersData || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]));

                    setTransactions(recentBookings.map((b: any) => ({
                        id: `#TR-${b.id.substring(0, 5).toUpperCase()}`,
                        athlete: usersMap.get(b.athlete_id) || "Unknown",
                        trainer: usersMap.get(b.trainer_id) || "Unknown",
                        date: new Date(b.created_at).toLocaleDateString(),
                        amount: `$${Number(b.price || 0).toFixed(2)}`,
                        status: b.status === "completed" ? "Completed" : "Pending"
                    })));

                    setActivities(recentBookings.map((b: any) => ({
                        title: `Booking ${b.status}`,
                        desc: `Session booked by ${usersMap.get(b.athlete_id) || "User"}`,
                        time: new Date(b.created_at).toLocaleDateString(),
                        dot: b.status === "completed" ? "bg-primary" : "bg-blue-500"
                    })));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const statCards = [
        { title: "Total Athletes", value: stats.athletes.toLocaleString(), req: "+12.5%", icon: <Users size={20} className="text-blue-500" />, iconBg: "bg-blue-500/10" },
        { title: "Total Trainers", value: stats.trainers.toLocaleString(), req: "+5.2%", icon: <Dumbbell size={20} className="text-purple-500" />, iconBg: "bg-purple-500/10" },
        { title: "Total Revenue", value: `$${stats.revenue.toLocaleString()}`, req: "+18.1%", icon: <DollarSign size={20} className="text-primary" />, iconBg: "bg-primary/10" },
        { title: "Active Bookings", value: stats.activeBookings.toLocaleString(), req: "-2.4%", icon: <CalendarCheck size={20} className="text-orange-500" />, iconBg: "bg-orange-500/10", isNegative: true },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="space-y-6">

            {/* Top Bar inside Content */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-text-main tracking-tight">Overview</h1>
                <div className="relative w-96">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Search athletes, trainers..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm text-text-main focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="bg-surface border border-white/5 rounded-[24px] p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                                {stat.icon}
                            </div>
                            <span className={`text-[11px] font-black tracking-wider ${stat.isNegative ? "text-red-500" : "text-primary"}`}>
                                {stat.req}
                            </span>
                        </div>
                        <div className="text-text-main/60 text-sm font-bold mb-1">{stat.title}</div>
                        <div className="text-3xl font-black text-text-main">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart Mock */}
                <div className="lg:col-span-2 bg-surface border border-white/5 rounded-[24px] p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-black text-text-main">Platform Growth</h2>
                            <p className="text-sm text-text-main/60">Growth metrics for the last 12 months</p>
                        </div>
                        <button className="px-4 py-2 rounded-full border border-gray-700 text-xs font-bold text-text-main/80 hover:text-text-main transition-colors">
                            Last 12 Months
                        </button>
                    </div>
                    {/* CSS Bar Chart Simulation */}
                    <div className="h-64 flex items-end justify-between gap-2 mt-8 pt-4 border-b border-white/5/50 pb-2">
                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((month, i) => {
                            const heights = [30, 45, 35, 60, 100, 50, 45, 65, 40, 60, 45, 75];
                            const isHigh = i === 4; // MAY
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-4 group">
                                    <div className="w-full flex-1 flex items-end justify-center">
                                        <div
                                            style={{ height: `${heights[i]}%` }}
                                            className={`w-8 md:w-12 rounded-t-xl transition-all duration-500 ease-out group-hover:bg-primary/80 ${isHigh ? "bg-primary shadow-[0_0_15px_rgba(163,255,18,0.25)]" : "bg-[#272A35]"}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-text-main/40 tracking-widest">{month}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Activity Log */}
                <div className="lg:col-span-1 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-lg font-black text-text-main">Activity Log</h2>
                        <button className="text-primary text-xs font-bold uppercase tracking-widest">View All</button>
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
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 text-xs font-bold text-text-main/80 hover:text-text-main transition-colors">
                            <Filter size={14} /> Filter
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 text-xs font-bold text-text-main/80 hover:text-text-main transition-colors">
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="pb-4 pl-2 font-black">Transaction ID</th>
                                <th className="pb-4 font-black">Athlete</th>
                                <th className="pb-4 font-black">Trainer</th>
                                <th className="pb-4 font-black">Date</th>
                                <th className="pb-4 font-black">Amount</th>
                                <th className="pb-4 font-black">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {transactions.map((t, i) => (
                                <tr key={i} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="py-4 pl-2 font-medium text-text-main/60">{t.id}</td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#fce6cd] flex-shrink-0"></div>
                                            <span className="font-bold text-text-main">{t.athlete}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 text-text-main/80 font-medium">{t.trainer}</td>
                                    <td className="py-4 text-text-main/60 text-xs tracking-wide">{t.date}</td>
                                    <td className="py-4 font-black text-text-main">{t.amount}</td>
                                    <td className="py-4">
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
