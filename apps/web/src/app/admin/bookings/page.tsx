"use client";

import { useState, useEffect } from "react";
import { Download, Plus, Search, Calendar, ChevronDown, FilterX, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminBookingsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [rawBookings, setRawBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBookings = async () => {
            try {
                const { data: bData } = await supabase.from("bookings").select("*").order("scheduled_at", { ascending: false });
                if (!bData) return;

                const userIds = new Set<string>();
                bData.forEach(b => { userIds.add(b.athlete_id); userIds.add(b.trainer_id); });
                const { data: usersData } = await supabase.from("users").select("id, first_name, last_name").in("id", Array.from(userIds));
                const usersMap = new Map((usersData || []).map(u => [u.id, `${u.first_name} ${u.last_name}`]));

                const getStatusStyles = (status: string) => {
                    if (status === "completed") return { sColor: "text-primary", sBg: "bg-primary/10", sBorder: "border-primary/20", display: "Completed" };
                    if (status === "cancelled") return { sColor: "text-red-500", sBg: "bg-red-500/10", sBorder: "border-red-500/20", display: "Cancelled" };
                    if (status === "pending") return { sColor: "text-orange-500", sBg: "bg-orange-500/10", sBorder: "border-orange-500/20", display: "Pending" };
                    return { sColor: "text-blue-500", sBg: "bg-blue-500/10", sBorder: "border-blue-500/20", display: "Confirmed" };
                };

                setRawBookings(bData.map(b => {
                    const dt = new Date(b.scheduled_at);
                    const styles = getStatusStyles(b.status);
                    return {
                        id: b.id.substring(0, 8),
                        athlete: usersMap.get(b.athlete_id) || "Unknown",
                        trainer: usersMap.get(b.trainer_id) || "Unknown",
                        date: dt.toLocaleDateString(),
                        time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        category: b.sport || "GENERAL",
                        rawStatus: b.status,
                        status: styles.display,
                        sColor: styles.sColor,
                        sBg: styles.sBg,
                        sBorder: styles.sBorder
                    };
                }));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadBookings();
    }, []);

    const bookings = rawBookings.filter(b => {
        if (activeTab !== "All" && b.status !== activeTab) return false;
        if (searchQuery && !b.athlete.toLowerCase().includes(searchQuery.toLowerCase()) && !b.trainer.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Bookings</h1>
                    <p className="text-sm font-medium text-text-main/60">Manage platform-wide training appointments and athlete sessions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 bg-surface text-sm font-bold text-text-main/80 hover:text-text-main hover:border-gray-500 transition-colors">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all">
                        <Plus size={18} strokeWidth={3} /> Manual Booking
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-white/5">

                <div className="flex flex-wrap items-center gap-4">
                    <button className="flex items-center gap-3 bg-surface border border-white/5 rounded-full px-5 py-2.5 text-sm font-bold text-text-main/80">
                        <Calendar size={16} /> Oct 12 - Oct 19, 2023 <ChevronDown size={14} className="ml-2" />
                    </button>
                    <button className="flex items-center gap-3 bg-surface border border-white/5 rounded-full px-5 py-2.5 text-sm font-bold text-text-main/80">
                        <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                        </div>
                        Sport: All Categories <ChevronDown size={14} className="ml-2" />
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex bg-surface border border-white/5 rounded-full p-1">
                        {["All", "Upcoming", "Completed", "Cancelled"].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === tab ? "bg-primary text-bg shadow-[0_0_10px_rgba(163,255,18,0.2)]" : "text-text-main/60 hover:text-text-main"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <button className="text-text-main/60 hover:text-text-main text-xs font-bold flex items-center gap-1.5 transition-colors">
                        <FilterX size={14} /> Clear Filters
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-surface text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="px-6 py-5">Booking ID</th>
                                <th className="px-6 py-5">Athlete</th>
                                <th className="px-6 py-5">Trainer</th>
                                <th className="px-6 py-5">Date / Time</th>
                                <th className="px-6 py-5">Category</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {bookings.map((b, i) => (
                                <tr key={b.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5 text-text-main/60 font-medium">{b.id}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#fce6cd] flex-shrink-0"></div>
                                            <span className="font-bold text-text-main tracking-wide">{b.athlete}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main/80 font-medium">{b.trainer}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main font-bold text-sm tracking-wide">{b.date}</div>
                                        <div className="text-text-main/40 text-xs mt-0.5 font-medium">{b.time}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="px-3 py-1 bg-[#272A35] border border-gray-700 text-text-main/80 rounded-md text-[10px] font-black uppercase tracking-widest inline-flex">
                                            {b.category}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest inline-flex ${b.sBg} ${b.sColor} ${b.sBorder}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full bg-current`}></span>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-text-main/40 hover:text-text-main cursor-pointer transition-colors">
                                        <MoreVertical size={18} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                    <div className="text-xs font-bold text-text-main/40 tracking-wide">
                        Showing <span className="text-text-main">1</span> to <span className="text-text-main">10</span> of <span className="text-text-main">1,248</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-50">‹</button>
                        <button className="w-8 h-8 rounded-full bg-primary text-bg font-black shadow-[0_0_10px_rgba(163,255,18,0.3)]">1</button>
                        <button className="w-8 h-8 rounded-full text-text-main/60 font-bold hover:text-text-main">2</button>
                        <button className="w-8 h-8 rounded-full text-text-main/60 font-bold hover:text-text-main">3</button>
                        <span className="text-gray-600 px-1">...</span>
                        <button className="w-8 h-8 rounded-full text-text-main/60 font-bold hover:text-text-main">125</button>
                        <button className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main">›</button>
                    </div>
                </div>
            </div>

        </div>
    );
}
