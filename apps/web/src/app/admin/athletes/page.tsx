"use client";

import { useState, useEffect } from "react";
import { Search, Users, Activity, CheckCircle, XCircle, ChevronLeft, ChevronRight, X, Calendar, CreditCard, MapPin, Phone, Mail, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/admin/LocationMap"), { ssr: false });

interface Athlete {
    id: string;
    name: string;
    email: string;
    date: string;
    status: "Active" | "Suspended";
    sessions: number;
    initials: string;
    lat?: number | null;
    lng?: number | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip_code?: string | null;
}

interface AthleteDetail {
    user: any;
    profile: any;
    stats: {
        totalBookings: number;
        completedBookings: number;
        pendingBookings: number;
        cancelledBookings: number;
        upcomingBookings: number;
        totalSpent: number;
        lastPaymentDate: string | null;
        paymentCount: number;
        subAccountCount: number;
    };
    recentBookings: { id: string; sport: string; status: string; scheduledAt: string; price: number; date: string }[];
}

export default function AdminAthletesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Suspended">("All");
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [totalBookingsCount, setTotalBookingsCount] = useState(0);

    // Detail Modal State
    const [detailModal, setDetailModal] = useState<{ isOpen: boolean; loading: boolean; data: AthleteDetail | null }>({ isOpen: false, loading: false, data: null });

    const openDetailModal = async (athleteId: string) => {
        setDetailModal({ isOpen: true, loading: true, data: null });
        try {
            const res = await fetch(`/api/admin/athlete-detail?userId=${athleteId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setDetailModal({ isOpen: true, loading: false, data: json });
        } catch (err) {
            console.error(err);
            setDetailModal({ isOpen: true, loading: false, data: null });
        }
    };

    // Custom Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | null, action: "suspend" | "activate" | null, name: string}>({isOpen: false, id: null, action: null, name: ""});

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        const loadAthletes = async () => {
            try {
                // Fetch athletes
                const { data } = await supabase.from("users").select("*").eq("role", "athlete");

                // Fetch total bookings count
                const { count: bookingsCount } = await supabase
                    .from("bookings")
                    .select("*", { count: "exact", head: true });

                setTotalBookingsCount(bookingsCount ?? 0);

                if (data && data.length > 0) {
                    const userIds = data.map((u: any) => u.id);

                    // Fetch booking counts per athlete
                    const { data: bookingRows } = await supabase
                        .from("bookings")
                        .select("athlete_id")
                        .in("athlete_id", userIds);

                    // Fetch athlete profiles for location data
                    const { data: profilesData } = await supabase
                        .from("athlete_profiles")
                        .select("user_id, latitude, longitude, city, state, country, zip_code")
                        .in("user_id", userIds);
                    const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));

                    const sessionCountMap: Record<string, number> = {};
                    (bookingRows || []).forEach((b: any) => {
                        sessionCountMap[b.athlete_id] = (sessionCountMap[b.athlete_id] || 0) + 1;
                    });

                    setAthletes(data.map((u: any) => {
                        const profile = profilesMap.get(u.id);
                        return {
                            id: u.id,
                            name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email.split('@')[0],
                            email: u.email,
                            date: new Date(u.created_at).toLocaleDateString(),
                            status: u.is_suspended ? "Suspended" : "Active",
                            sessions: sessionCountMap[u.id] ?? 0,
                            initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase() || u.email[0].toUpperCase(),
                            lat: profile?.latitude,
                            lng: profile?.longitude,
                            city: profile?.city,
                            state: profile?.state,
                            country: profile?.country,
                            zip_code: profile?.zip_code,
                        };
                    }));
                } else {
                    setAthletes([]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadAthletes();
    }, []);

    const filteredAthletes = athletes.filter(a => {
        if (statusFilter !== "All" && a.status !== statusFilter) return false;

        const searchLower = searchQuery.toLowerCase();
        return !searchQuery || a.name.toLowerCase().includes(searchLower) || a.email.toLowerCase().includes(searchLower);
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredAthletes.length / itemsPerPage);
    const paginatedAthletes = filteredAthletes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("All");
        setCurrentPage(1);
    };

    const requestStatusChange = (id: string, name: string, currentStatus: string) => {
        setConfirmModal({
            isOpen: true,
            id,
            name,
            action: currentStatus === "Active" ? "suspend" : "activate"
        });
    }

    const confirmStatusChange = async () => {
        const { id, action } = confirmModal;
        if (!id || !action) return;

        setActionLoading(true);
        try {
            await supabase.from("users").update({ is_suspended: action === "suspend" }).eq("id", id);
            setAthletes(prev => prev.map(a =>
                a.id === id ? { ...a, status: action === "suspend" ? "Suspended" : "Active" } : a
            ));
            setConfirmModal({ isOpen: false, id: null, action: null, name: "" });
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const totalAthletesCount = athletes.length;
    const activeAthletesCount = athletes.filter(a => a.status === "Active").length;

    return (
        <div className="space-y-8 max-w-[1600px] w-full">

            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                    <span className="text-text-main">All</span>
                    <span className="text-primary border-b-4 border-primary pb-1">Athletes</span>
                </h1>
                <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                    Manage and monitor platform users booking sessions across all disciplines.
                </p>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[20px] p-6 relative overflow-hidden group hover:border-white/[0.06] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]">
                    <div className="absolute top-0 bottom-0 left-0 w-1 border-primary transition-all duration-300 group-hover:w-1.5 bg-primary"></div>
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight">Total Athletes</span>
                        <div className="p-2 rounded-xl bg-white/5 text-primary transition-colors"><Users size={18} /></div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-text-main tracking-tighter">{totalAthletesCount || "0"}</div>
                </div>

                <div className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[20px] p-6 relative overflow-hidden group hover:border-white/[0.06] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]">
                    <div className="absolute top-0 bottom-0 left-0 w-1 border-white/[0.04] transition-all duration-300 group-hover:w-1.5 bg-white/10"></div>
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight">Total Bookings</span>
                        <div className="p-2 rounded-xl bg-white/5 text-text-main/40 transition-colors"><Activity size={18} /></div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-text-main tracking-tighter">{totalBookingsCount.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[20px] p-6 relative overflow-hidden group hover:border-white/[0.06] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]">
                    <div className="absolute top-0 bottom-0 left-0 w-1 border-green-500 transition-all duration-300 group-hover:w-1.5 bg-green-500"></div>
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight">Active Accounts</span>
                        <div className="p-2 rounded-xl bg-white/5 text-green-500 transition-colors"><CheckCircle size={18} /></div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-green-500 tracking-tighter">{activeAthletesCount}</div>
                </div>
            </div>

            {/* Location Map */}
            <LocationMap
                pins={athletes.filter(a => a.lat && a.lng).map(a => ({
                    id: a.id,
                    name: a.name,
                    lat: a.lat!,
                    lng: a.lng!,
                    role: "athlete" as const,
                    status: a.status,
                    city: a.city || undefined,
                    state: a.state || undefined,
                }))}
                title="Athlete Locations"
                subtitle="Track where athletes are concentrated and where to target marketing"
                onPinClick={(pin) => openDetailModal(pin.id)}
            />

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-surface/50 border border-white/5 p-2 rounded-[24px]">
                <div className="relative flex-1 flex items-center">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            placeholder="Filter by name or email..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-[#12141A] border border-white/5 rounded-full pl-12 pr-4 py-3.5 text-sm font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                        />
                    </div>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="p-3 ml-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0"
                            title="Clear Filters"
                        >
                            <XCircle size={18} />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 bg-[#12141A] border border-white/5 rounded-2xl md:rounded-full p-1.5 overflow-x-auto scrollbar-none">
                    <div className="flex gap-1">
                        {["All", "Active", "Suspended"].map((status) => (
                            <button
                                type="button"
                                key={status}
                                onClick={() => {
                                    setStatusFilter(status as "All" | "Active" | "Suspended");
                                    setCurrentPage(1);
                                }}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all whitespace-nowrap ${
                                    statusFilter === status
                                        ? "bg-primary text-bg shadow-[0_0_15px_rgba(69,208,255,0.3)]"
                                        : "text-text-main/50 hover:text-text-main hover:bg-white/5"
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40 bg-white/5">
                                <th className="px-6 py-5 pl-8">Athlete Name</th>
                                <th className="px-6 py-5">Location</th>
                                <th className="px-6 py-5">Joined Date</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Sessions</th>
                                <th className="px-6 py-5 pr-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-text-main/50 font-bold">
                                        Loading athletes...
                                    </td>
                                </tr>
                            ) : paginatedAthletes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-text-main/50 font-bold">
                                        No athletes found.
                                    </td>
                                </tr>
                            ) : paginatedAthletes.map((a) => (
                                <tr key={a.id} onClick={() => openDetailModal(a.id)} className="border-b border-white/[0.04] hover:bg-white/5 transition-colors group cursor-pointer">
                                    <td className="px-6 py-5 pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black flex-shrink-0 border border-primary/20">
                                                {a.initials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-text-main tracking-wide group-hover:text-primary transition-colors">{a.name}</div>
                                                <div className="text-text-main/60 font-medium text-xs">{a.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main/80 font-medium text-xs tracking-wide flex items-center gap-1">
                                            {a.city || a.state || a.country ? (
                                                <><MapPin size={11} className="text-primary/60" /> {[a.city, a.state, a.country].filter(Boolean).join(", ")}</>
                                            ) : (
                                                <span className="text-text-main/30">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main/80 font-bold text-xs tracking-wide">{a.date}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className={`flex justify-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex border ${
                                            a.status === "Active"
                                                ? "border-green-500/20 text-green-500 bg-green-500/10"
                                                : "border-red-500/20 text-red-500 bg-red-500/10"
                                            }`}>
                                            {a.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main/90 font-black text-sm bg-white/5 px-3 py-1.5 rounded-lg inline-block border border-white/[0.04]">{a.sessions}</div>
                                    </td>
                                    <td className="px-6 py-5 pr-8 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2">
                                            {a.status === "Suspended" ? (
                                                <button type="button" onClick={() => requestStatusChange(a.id, a.name, a.status)} className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-bg hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] border border-primary/20 transition-all">
                                                    Activate
                                                </button>
                                            ) : (
                                                <button type="button" onClick={() => requestStatusChange(a.id, a.name, a.status)} className="px-4 py-2 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all">
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && filteredAthletes.length > 0 && (
                    <div className="px-8 py-5 flex items-center justify-between border-t border-white/5 bg-[#12141A]/50">
                        <div className="text-xs font-bold text-text-main/40 tracking-wide uppercase">
                            Showing <span className="text-text-main mx-1">{(currentPage - 1) * itemsPerPage + 1}</span>
                            to <span className="text-text-main mx-1">{Math.min(currentPage * itemsPerPage, filteredAthletes.length)}</span>
                            of <span className="text-text-main mx-1">{filteredAthletes.length}</span> results
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

                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => (
                                <button
                                    type="button"
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-full text-xs font-black transition-all ${
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

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.action === "suspend" ? "Suspend Athlete" : "Activate Athlete"}
                message={<span>Are you sure you want to <strong>{confirmModal.action}</strong> the account for {confirmModal.name}?</span>}
                confirmText={confirmModal.action === "suspend" ? "Suspend Account" : "Activate"}
                type={confirmModal.action === "suspend" ? "danger" : "success"}
                onCancel={() => setConfirmModal({ isOpen: false, id: null, action: null, name: "" })}
                onConfirm={confirmStatusChange}
                isLoading={actionLoading}
            />

            {/* Athlete Detail Modal */}
            {detailModal.isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#1A1C23] z-10 rounded-t-[24px]">
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">Athlete Details</h3>
                            <button
                                onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                                className="p-2 rounded-xl text-text-main/50 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {detailModal.loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 size={32} className="animate-spin text-primary mb-3" />
                                <p className="text-text-main/40 text-sm font-bold uppercase tracking-widest">Loading Details...</p>
                            </div>
                        ) : !detailModal.data ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <p className="text-text-main/40 text-sm font-bold">Failed to load athlete details</p>
                            </div>
                        ) : (() => {
                            const { user, profile, stats, recentBookings } = detailModal.data;
                            const name = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email?.split("@")[0] || "Unknown";
                            const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || "?";
                            return (
                                <div className="p-6 space-y-6">
                                    {/* Profile Header */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-2xl border-2 border-primary/20 flex-shrink-0">
                                            {initials}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-xl font-black text-white tracking-wide">{name}</h4>
                                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1 text-text-main/60 text-xs font-medium"><Mail size={12} /> {user?.email}</span>
                                                {user?.phone && <span className="flex items-center gap-1 text-text-main/60 text-xs font-medium"><Phone size={12} /> {user.phone}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${user?.is_suspended ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                                                    {user?.is_suspended ? "Suspended" : "Active"}
                                                </span>
                                                <span className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <Calendar size={10} /> Joined {new Date(user?.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Location */}
                                    {(profile?.city || profile?.state || profile?.country) && (
                                        <div className="flex items-center gap-2 text-text-main/60 text-sm font-medium bg-white/5 border border-white/[0.04] rounded-xl px-4 py-3">
                                            <MapPin size={14} className="text-primary" />
                                            {[profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ")}
                                        </div>
                                    )}

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40 mb-1">Total Bookings</p>
                                            <p className="text-2xl font-black text-text-main">{stats.totalBookings}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-green-500/60 mb-1">Completed</p>
                                            <p className="text-2xl font-black text-green-500">{stats.completedBookings}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500/60 mb-1">Pending</p>
                                            <p className="text-2xl font-black text-yellow-500">{stats.pendingBookings}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-red-500/60 mb-1">Cancelled</p>
                                            <p className="text-2xl font-black text-red-500">{stats.cancelledBookings}</p>
                                        </div>
                                    </div>

                                    {/* Financial Info */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-[#12141A] border border-primary/20 rounded-xl p-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 mb-1">Total Spent</p>
                                            <p className="text-2xl font-black text-primary">${stats.totalSpent.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40 mb-1">Sub Accounts</p>
                                            <p className="text-2xl font-black text-text-main">{stats.subAccountCount}</p>
                                        </div>
                                    </div>

                                    {/* Recent Bookings */}
                                    {recentBookings.length > 0 && (
                                        <div>
                                            <h5 className="text-xs font-black uppercase tracking-widest text-text-main/40 mb-3">Recent Bookings</h5>
                                            <div className="space-y-2">
                                                {recentBookings.map((b) => (
                                                    <div key={b.id} className="flex items-center justify-between bg-[#12141A] border border-white/5 rounded-xl px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                                <Activity size={14} className="text-text-main/40" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-text-main">{b.sport || "Session"}</p>
                                                                <p className="text-[10px] text-text-main/40 font-medium flex items-center gap-1">
                                                                    <Clock size={9} /> {new Date(b.scheduledAt || b.date).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-text-main">${b.price.toFixed(2)}</span>
                                                            <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                                                b.status === "completed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                                                b.status === "confirmed" ? "bg-primary/10 text-primary border-primary/20" :
                                                                b.status === "cancelled" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                                "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                                            }`}>
                                                                {b.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {stats.lastPaymentDate && (
                                        <p className="text-[10px] text-text-main/30 font-medium text-center">
                                            Last payment: {new Date(stats.lastPaymentDate).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

        </div>
    );
}
