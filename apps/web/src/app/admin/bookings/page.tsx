"use client";

import { useState, useEffect } from "react";
import { Download, Plus, Search, Calendar, ChevronDown, FilterX, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";

const SPORTS_LIST = [
    "Personal Training", "Yoga", "Pilates", "Tennis", "Golf", "Swimming",
    "Cycling", "Running", "Football", "Basketball", "Baseball", "Hockey",
    "Soccer", "Volleyball", "Martial Arts", "Boxing", "Dance", "Gymnastics",
    "Weightlifting", "CrossFit", "Rowing", "Surfing", "Snowboarding", "Skiing", "Meditation"
].sort();


export default function AdminBookingsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [rawBookings, setRawBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [dateFilter, setDateFilter] = useState("All Time");
    const [sportFilter, setSportFilter] = useState("All");
    const itemsPerPage = 8;


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

    const isDateInRange = (dateStr: string, range: string) => {
        if (range === "All Time") return true;
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        if (range === "Today") return targetDate.getTime() === today.getTime();
        if (range === "Last 7 Days") return today.getTime() - targetDate.getTime() <= (7 * 24 * 60 * 60 * 1000) && targetDate.getTime() <= today.getTime();
        if (range === "Last 30 Days") return today.getTime() - targetDate.getTime() <= (30 * 24 * 60 * 60 * 1000) && targetDate.getTime() <= today.getTime();
        if (range === "This Month") return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
        
        return true;
    };

    const bookings = rawBookings.filter(b => {
        if (activeTab === "Upcoming" && b.rawStatus !== "pending" && b.rawStatus !== "confirmed") return false;
        if (activeTab === "Completed" && b.rawStatus !== "completed") return false;
        if (activeTab === "Cancelled" && b.rawStatus !== "cancelled") return false;
        if (sportFilter !== "All" && b.category.toUpperCase() !== sportFilter.toUpperCase()) return false;
        if (!isDateInRange(b.date, dateFilter)) return false;
        if (searchQuery && !b.athlete.toLowerCase().includes(searchQuery.toLowerCase()) && !b.trainer.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery, dateFilter, sportFilter]);

    const totalPages = Math.ceil(bookings.length / itemsPerPage);
    const paginatedBookings = bookings.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleExportCSV = () => {
        const headers = ["Booking ID", "Athlete", "Trainer", "Date", "Time", "Category", "Status"];
        
        const exportData = bookings.map(b => [
            b.id,
            b.athlete,
            b.trainer,
            b.date,
            b.time,
            b.category,
            b.rawStatus
        ]);

        const csvContent = [
            headers.join(","),
            ...exportData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Bookings</h1>
                    <p className="text-sm font-medium text-text-main/60">Manage platform-wide training appointments and athlete sessions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 bg-surface text-sm font-bold text-text-main/80 hover:text-text-main hover:border-gray-500 transition-colors"
                    >
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
                    <div className="relative group">
                        <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/80 pointer-events-none" />
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="appearance-none bg-surface border border-white/5 rounded-full pl-11 pr-10 py-2.5 text-sm font-bold text-text-main/80 w-48 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="All Time">All Time</option>
                            <option value="Today">Today</option>
                            <option value="Last 7 Days">Last 7 Days</option>
                            <option value="Last 30 Days">Last 30 Days</option>
                            <option value="This Month">This Month</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-main/40 pointer-events-none" />
                    </div>

                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center pointer-events-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                        </div>
                        <select
                            value={sportFilter}
                            onChange={(e) => setSportFilter(e.target.value)}
                            className="appearance-none bg-surface border border-white/5 rounded-full pl-11 pr-10 py-2.5 text-sm font-bold text-text-main/80 w-56 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="All">Sport: All Categories</option>
                            {SPORTS_LIST.map(sport => (
                                <option key={sport} value={sport}>{sport}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-main/40 pointer-events-none" />
                    </div>
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
                    <button 
                        onClick={() => {
                            setActiveTab("All");
                            setSearchQuery("");
                            setDateFilter("All Time");
                            setSportFilter("All");
                            setCurrentPage(1);
                        }}
                        className="text-text-main/60 hover:text-text-main text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
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
                            {paginatedBookings.map((b, i) => (
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
                {bookings.length > 0 && (
                    <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                        <div className="text-xs font-bold text-text-main/40 tracking-wide">
                            Showing <span className="text-text-main">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-text-main">{Math.min(currentPage * itemsPerPage, bookings.length)}</span> of <span className="text-text-main">{bookings.length}</span> results
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            >‹</button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-full font-black transition-all ${
                                        currentPage === page 
                                        ? "bg-primary text-bg shadow-[0_0_10px_rgba(163,255,18,0.3)]" 
                                        : "text-text-main/60 hover:text-text-main"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            >›</button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
