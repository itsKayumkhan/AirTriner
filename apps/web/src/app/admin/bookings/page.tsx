"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Plus, Search, Calendar, ChevronDown, FilterX, MoreVertical, XCircle, LayoutGrid, CheckCircle, Clock, X, AlertOctagon, ChevronLeft, ChevronRight, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function AdminBookingsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [rawBookings, setRawBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Dropdown states
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isSportOpen, setIsSportOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState("Any Date");
    const [selectedSport, setSelectedSport] = useState("All Sports");
    const [sportsList, setSportsList] = useState<string[]>(["All Sports"]);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Modal and Action states
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | null, action: "cancel" | "complete" | null, refId: string}>({isOpen: false, id: null, action: null, refId: ""});
    const [detailBooking, setDetailBooking] = useState<any | null>(null);

    const actionMenuRef = useRef<HTMLDivElement>(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        const loadBookings = async () => {
            try {
                const { data: bData } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
                if (!bData) return;

                const userIds = new Set<string>();
                bData.forEach(b => { userIds.add(b.athlete_id); userIds.add(b.trainer_id); });
                const { data: usersData } = await supabase.from("users").select("id, first_name, last_name, email").in("id", Array.from(userIds));
                const usersMap = new Map((usersData || []).map(u => [u.id, {
                    name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email.split('@')[0],
                    initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase() || u.email[0].toUpperCase()
                }]));

                const getStatusStyles = (status: string) => {
                    if (status === "completed") return { sColor: "text-green-500", sBg: "bg-green-500/10", sBorder: "border-green-500/20", display: "Completed", icon: <CheckCircle size={12} /> };
                    if (status === "cancelled") return { sColor: "text-red-500", sBg: "bg-red-500/10", sBorder: "border-red-500/20", display: "Cancelled", icon: <X size={12} /> };
                    if (status === "pending") return { sColor: "text-orange-500", sBg: "bg-orange-500/10", sBorder: "border-orange-500/20", display: "Pending", icon: <Clock size={12} /> };
                    return { sColor: "text-primary", sBg: "bg-primary/10", sBorder: "border-primary/20", display: "Confirmed", icon: <AlertOctagon size={12} /> };
                };

                setRawBookings(bData.map(b => {
                    const dt = new Date(b.scheduled_at);
                    const styles = getStatusStyles(b.status);
                    const athInfo = usersMap.get(b.athlete_id) || { name: "Unknown", initials: "U" };
                    const trnInfo = usersMap.get(b.trainer_id) || { name: "Unknown", initials: "U" };
                    return {
                        id: b.id,
                        refId: b.id.substring(0, 8),
                        athlete: athInfo.name,
                        athleteInitials: athInfo.initials,
                        trainer: trnInfo.name,
                        trainerInitials: trnInfo.initials,
                        date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        category: b.sport || "General",
                        rawStatus: b.status,
                        rawScheduledAt: b.scheduled_at,
                        status: styles.display,
                        sColor: styles.sColor,
                        sBg: styles.sBg,
                        sBorder: styles.sBorder,
                        sIcon: styles.icon
                    };
                }));
                const { data: sportsData } = await supabase.from("sports").select("name").eq("is_active", true).order("name");
                setSportsList(["All Sports", ...(sportsData || []).map((s: any) => s.name)]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadBookings();
    }, []);

    // Handle outside click for dropdowns and menus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDateOpen(false);
                setIsSportOpen(false);
            }
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActionMenuOpen(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const bookings = rawBookings.filter(b => {
        if (activeTab === "Upcoming" && (b.rawStatus === "cancelled" || b.rawStatus === "completed" || new Date(b.rawScheduledAt) < new Date())) return false;
        if (activeTab === "Completed" && b.rawStatus !== "completed") return false;
        if (activeTab === "Cancelled" && b.rawStatus !== "cancelled") return false;

        if (selectedSport !== "All Sports" && b.category.toLowerCase() !== selectedSport.toLowerCase()) return false;

        if (selectedDate === "Today") {
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (b.date !== today) return false;
        }
        if (selectedDate === "This Week") {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const bookingDate = new Date(b.rawScheduledAt);
            if (bookingDate < startOfWeek || bookingDate > endOfWeek) return false;
        }
        if (selectedDate === "This Month") {
            const now = new Date();
            const bookingDate = new Date(b.rawScheduledAt);
            if (bookingDate.getMonth() !== now.getMonth() || bookingDate.getFullYear() !== now.getFullYear()) return false;
        }

        const searchLower = searchQuery.toLowerCase();
        return !searchQuery || b.athlete.toLowerCase().includes(searchLower) || b.trainer.toLowerCase().includes(searchLower) || b.id.toLowerCase().includes(searchLower);
    });

    const totalPages = Math.ceil(bookings.length / itemsPerPage);
    const paginatedBookings = bookings.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const clearFilters = () => {
        setSearchQuery("");
        setActiveTab("All");
        setSelectedDate("Any Date");
        setSelectedSport("All Sports");
        setCurrentPage(1);
    };

    const requestAction = (id: string, refId: string, action: "cancel" | "complete") => {
        setActionMenuOpen(null);
        setConfirmModal({ isOpen: true, id, refId, action });
    };

    const confirmAction = async () => {
        const { id, action } = confirmModal;
        if (!id || !action) return;

        setActionLoading(true);
        try {
            const newStatus = action === "cancel" ? "cancelled" : "completed";
            const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
            
            if (!error) {
                // Update local state without full reload
                setRawBookings(prev => prev.map(b => {
                    if (b.id !== id) return b;
                    
                    const getStatusStyles = (status: string) => {
                        if (status === "completed") return { sColor: "text-green-500", sBg: "bg-green-500/10", sBorder: "border-green-500/20", display: "Completed", icon: <CheckCircle size={12} /> };
                        if (status === "cancelled") return { sColor: "text-red-500", sBg: "bg-red-500/10", sBorder: "border-red-500/20", display: "Cancelled", icon: <X size={12} /> };
                        if (status === "pending") return { sColor: "text-orange-500", sBg: "bg-orange-500/10", sBorder: "border-orange-500/20", display: "Pending", icon: <Clock size={12} /> };
                        return { sColor: "text-primary", sBg: "bg-primary/10", sBorder: "border-primary/20", display: "Confirmed", icon: <AlertOctagon size={12} /> };
                    };
                    
                    const styles = getStatusStyles(newStatus);
                    return { ...b, rawStatus: newStatus, status: styles.display, sColor: styles.sColor, sBg: styles.sBg, sBorder: styles.sBorder, sIcon: styles.icon };
                }));
            }
            setConfirmModal({ isOpen: false, id: null, action: null, refId: "" });
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ["Booking ID", "Athlete", "Trainer", "Date", "Time", "Sport", "Status"];
        const rows = bookings.map(b => [b.id, b.athlete, b.trainer, b.date, b.time, b.category, b.status]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `bookings_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 max-w-[1600px] w-full">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                        <span className="text-text-main">Global</span>
                        <span className="text-primary border-b-4 border-primary pb-1">Bookings</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                        Manage all platform-wide training appointments, conflicts, and schedules.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <button type="button" onClick={handleExportCSV} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-white/[0.04] bg-surface/50 text-sm font-bold text-text-main/80 hover:text-text-main hover:bg-white/5 transition-colors">
                        <Download size={18} /> Export List
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface/50 border border-white/5 p-2 rounded-[24px]">
                
                {/* Search */}
                <div className="relative w-full lg:w-80 flex items-center">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            placeholder="Search athlete, trainer or ID..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-[#12141A] border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                        />
                    </div>
                    {searchQuery && (
                        <button 
                            type="button"
                            onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                            className="p-3 ml-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0"
                            title="Clear Search"
                        >
                            <XCircle size={18} />
                        </button>
                    )}
                </div>

                <div ref={dropdownRef} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:flex-1 justify-end">
                    {/* Date Dropdown */}
                    <div className="relative z-50">
                        <button 
                            type="button" 
                            onClick={() => { setIsDateOpen(!isDateOpen); setIsSportOpen(false); }}
                            className="flex items-center justify-between gap-3 w-full sm:w-auto bg-[#12141A] border border-white/5 rounded-full px-5 py-3 text-xs uppercase tracking-widest font-bold text-text-main/80 hover:bg-white/5 hover:text-text-main transition-colors whitespace-nowrap"
                        >
                            <span className="flex items-center gap-2"><Calendar size={14} className="text-primary"/> {selectedDate}</span> 
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isDateOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isDateOpen && (
                            <div className="absolute top-full right-0 sm:left-0 sm:right-auto lg:right-0 lg:left-auto mt-2 w-48 bg-surface border border-white/[0.04] rounded-2xl shadow-2xl overflow-hidden py-2 backdrop-blur-xl">
                                {["Any Date", "Today", "This Week", "This Month"].map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => { setSelectedDate(opt); setIsDateOpen(false); setCurrentPage(1); }}
                                        className={`w-full text-left px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${selectedDate === opt ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-text-main/60 hover:bg-white/5 hover:text-text-main border-l-2 border-transparent"}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sport Dropdown */}
                    <div className="relative z-40">
                        <button
                            type="button"
                            onClick={() => { setIsSportOpen(!isSportOpen); setIsDateOpen(false); }}
                            className="flex items-center justify-between gap-3 w-full sm:w-auto min-w-[180px] bg-[#12141A] border border-white/5 rounded-full px-5 py-3 text-xs uppercase tracking-widest font-bold text-text-main/80 hover:bg-white/5 hover:text-text-main transition-colors whitespace-nowrap"
                        >
                            <span className="flex items-center gap-2"><LayoutGrid size={14} className="text-primary"/> {selectedSport}</span> 
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isSportOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSportOpen && (
                            <div className="absolute top-full right-0 sm:left-0 sm:right-auto lg:right-0 lg:left-auto mt-2 w-52 bg-surface border border-white/[0.04] rounded-2xl shadow-2xl max-h-[60vh] overflow-y-auto py-2 backdrop-blur-xl">
                                {sportsList.map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => { setSelectedSport(opt); setIsSportOpen(false); setCurrentPage(1); }}
                                        className={`w-full text-left px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${selectedSport === opt ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-text-main/60 hover:bg-white/5 hover:text-text-main border-l-2 border-transparent"}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-[#12141A] border border-white/5 rounded-full p-1.5 overflow-x-auto scrollbar-none">
                        {["All", "Upcoming", "Completed", "Cancelled"].map(tab => (
                            <button
                                type="button"
                                key={tab}
                                onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                                className={`px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-full transition-all whitespace-nowrap ${
                                    activeTab === tab 
                                    ? "bg-primary text-bg shadow-[0_0_15px_rgba(69,208,255,0.3)]" 
                                    : "text-text-main/50 hover:text-text-main hover:bg-white/5"
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/[0.05] text-[10px] uppercase font-bold tracking-widest text-text-main/30 bg-white/[0.03]">
                                <th className="px-6 py-5 pl-8">Booking ref</th>
                                <th className="px-6 py-5">Athlete</th>
                                <th className="px-6 py-5">Trainer</th>
                                <th className="px-6 py-5">Schedule</th>
                                <th className="px-6 py-5">Sport</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 pr-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-text-main/50 font-bold">
                                        Loading bookings...
                                    </td>
                                </tr>
                            ) : paginatedBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-text-main/50 font-bold">
                                        No bookings match your current filters.
                                    </td>
                                </tr>
                            ) : paginatedBookings.map((b, i) => (
                                <tr key={b.id} onClick={() => setDetailBooking(b)} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors group cursor-pointer">
                                    <td className="px-6 py-5 pl-8">
                                        <div className="flex items-center gap-2 text-text-main/60 font-black text-xs tracking-wider uppercase">
                                            <span className="text-primary/50">#</span>{b.refId}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs border border-primary/20 flex-shrink-0">
                                                {b.athleteInitials}
                                            </div>
                                            <span className="font-bold text-text-main tracking-wide hover:text-primary transition-colors cursor-pointer">{b.athlete}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/5 text-white flex items-center justify-center font-black text-xs border border-white/[0.04] flex-shrink-0">
                                                {b.trainerInitials}
                                            </div>
                                            <span className="font-medium text-text-main/80 tracking-wide hover:text-white transition-colors cursor-pointer">{b.trainer}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-text-main font-bold text-sm tracking-wide">{b.date}</span>
                                            <span className="text-text-main/40 text-[10px] font-black uppercase tracking-widest mt-0.5">{b.time}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="px-3 py-1 bg-white/5 border border-white/[0.04] text-text-main/90 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex">
                                            {b.category}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest inline-flex ${b.sBg} ${b.sColor} ${b.sBorder}`}>
                                            {b.sIcon}
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 pr-8 text-right relative">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActionMenuOpen(actionMenuOpen === b.id ? null : b.id);
                                            }}
                                            className={`w-8 h-8 rounded-full flex justify-center items-center ml-auto transition-all outline-none ${actionMenuOpen === b.id ? 'bg-primary/20 text-primary' : 'text-text-main/40 hover:text-text-main hover:bg-white/5'}`}
                                        >
                                            <MoreVertical size={18} />
                                        </button>
                                        
                                        {actionMenuOpen === b.id && (
                                            <div ref={actionMenuRef} className="absolute right-8 top-12 z-[100] w-48 bg-[#1A1D24] border border-white/[0.04] rounded-2xl shadow-2xl py-2 flex flex-col overflow-hidden text-left origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                                {b.rawStatus !== "completed" && b.rawStatus !== "cancelled" && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); requestAction(b.id, b.refId, "complete"); }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-text-main hover:bg-white/5 transition-colors"
                                                    >
                                                        <CheckCircle size={14} className="text-green-500" /> Mark Completed
                                                    </button>
                                                )}
                                                {b.rawStatus !== "cancelled" && b.rawStatus !== "completed" && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); requestAction(b.id, b.refId, "cancel"); }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <XCircle size={14} /> Cancel Booking
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setDetailBooking(b); setActionMenuOpen(null); }}
                                                    className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-text-main/70 hover:bg-white/5 transition-colors"
                                                >
                                                    <Edit2 size={14} className="text-primary/60" /> View Details
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && bookings.length > 0 && (
                    <div className="px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5 bg-[#12141A]/50">
                        <div className="text-[10px] font-bold text-text-main/40 tracking-wide uppercase">
                            Showing <span className="text-text-main mx-1">{(currentPage - 1) * itemsPerPage + 1}</span>
                            to <span className="text-text-main mx-1">{Math.min(currentPage * itemsPerPage, bookings.length)}</span>
                            of <span className="text-text-main mx-1">{bookings.length}</span> results
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-text-main/60 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button 
                                    type="button"
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-full text-xs font-black transition-all hidden sm:inline-block ${
                                        currentPage === page 
                                            ? "bg-primary text-bg shadow-[0_0_10px_rgba(69,208,255,0.3)]" 
                                            : "text-text-main/60 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-text-main/60 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Booking Detail Popup */}
            {detailBooking && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setDetailBooking(null)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative bg-[#13161D] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md p-6 z-10 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Booking Details</p>
                                <h3 className="text-lg font-black text-white uppercase tracking-wide">#{detailBooking.id}</h3>
                            </div>
                            <button onClick={() => setDetailBooking(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-main/50 hover:text-white hover:bg-white/10 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                                <span className="text-xs font-bold text-text-main/40 uppercase tracking-widest">Status</span>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${detailBooking.sBg} ${detailBooking.sColor} ${detailBooking.sBorder}`}>
                                    {detailBooking.sIcon} {detailBooking.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                                <span className="text-xs font-bold text-text-main/40 uppercase tracking-widest">Athlete</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">{detailBooking.athleteInitials}</div>
                                    <span className="text-sm font-bold text-white">{detailBooking.athlete}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                                <span className="text-xs font-bold text-text-main/40 uppercase tracking-widest">Trainer</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-white/5 text-white flex items-center justify-center font-black text-[10px]">{detailBooking.trainerInitials}</div>
                                    <span className="text-sm font-bold text-white">{detailBooking.trainer}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                                <span className="text-xs font-bold text-text-main/40 uppercase tracking-widest">Schedule</span>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">{detailBooking.date}</p>
                                    <p className="text-[10px] text-text-main/40 font-bold uppercase">{detailBooking.time}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <span className="text-xs font-bold text-text-main/40 uppercase tracking-widest">Sport</span>
                                <span className="px-3 py-1 bg-white/5 border border-white/[0.04] text-text-main/90 rounded-lg text-[10px] font-black uppercase tracking-widest">{detailBooking.category}</span>
                            </div>
                        </div>

                        {detailBooking.rawStatus !== "completed" && detailBooking.rawStatus !== "cancelled" && (
                            <div className="flex gap-3 mt-5 pt-4 border-t border-white/[0.04]">
                                <button
                                    onClick={() => { setDetailBooking(null); requestAction(detailBooking.id, detailBooking.refId, "complete"); }}
                                    className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-500 text-xs font-black uppercase tracking-widest hover:bg-green-500/20 transition-colors border border-green-500/20"
                                >
                                    Mark Complete
                                </button>
                                <button
                                    onClick={() => { setDetailBooking(null); requestAction(detailBooking.id, detailBooking.refId, "cancel"); }}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-colors border border-red-500/20"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.action === "cancel" ? "Cancel Booking" : "Complete Booking"}
                message={
                    <span>
                        Are you sure you want to mark booking <strong>#{confirmModal.refId}</strong> as 
                        <span className={confirmModal.action === "cancel" ? "text-red-500 ml-1" : "text-green-500 ml-1"}>
                            {confirmModal.action === "cancel" ? "Cancelled" : "Completed"}
                        </span>?
                    </span>
                }
                confirmText={confirmModal.action === "cancel" ? "Yes, Cancel it" : "Mark Completed"}
                type={confirmModal.action === "cancel" ? "danger" : "success"}
                onCancel={() => setConfirmModal({ isOpen: false, id: null, action: null, refId: "" })}
                onConfirm={confirmAction}
                isLoading={actionLoading}
            />

        </div>
    );
}
