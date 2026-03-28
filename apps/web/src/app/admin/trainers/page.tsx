"use client";

import { useState, useEffect } from "react";
import { Download, Plus, FileText, CheckCircle, Search, XCircle, ChevronLeft, ChevronRight, UserCheck, Clock, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FoundingBadgeTooltip } from "@/components/ui/FoundingBadge";

export default function AdminTrainersPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("Pending");
    const [trainers, setTrainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        const loadTrainers = async () => {
            try {
                const { data: usersData } = await supabase.from("users").select("*").eq("role", "trainer");
                if (!usersData) return;

                const userIds = usersData.map(u => u.id);
                const { data: profilesData } = await supabase.from("trainer_profiles").select("user_id, verification_status, sports, is_founding_50").in("user_id", userIds);
                const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

                setTrainers(usersData.map(u => {
                    const profile = profilesMap.get(u.id);
                    const isVerified = profile?.verification_status === "verified";
                    const isDeclined = profile?.verification_status === "declined";
                    const statusText = isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review");
                    const sports = profile?.sports || [];

                    return {
                        id: u.id,
                        name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email.split('@')[0],
                        email: u.email,
                        initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase() || u.email[0].toUpperCase(),
                        specialty: sports.length > 0 ? sports[0] : "General",
                        status: statusText,
                        isVerified,
                        isDeclined,
                        isFounding50: profile?.is_founding_50 ?? false,
                    };
                }));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadTrainers();
    }, []);

    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | null, newStatus: string | null, name: string}>({isOpen: false, id: null, newStatus: null, name: ""});
    const [actionLoading, setActionLoading] = useState(false);
    const [founding50Loading, setFounding50Loading] = useState<string | null>(null);

    const founding50Count = trainers.filter(t => t.isFounding50).length;

    const toggleFounding50 = async (id: string, current: boolean) => {
        setFounding50Loading(id);
        try {
            await supabase.from("trainer_profiles").update({
                is_founding_50: !current,
                founding_50_granted_at: !current ? new Date().toISOString() : null,
                ...((!current) ? { subscription_status: "active", subscription_expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() } : {})
            }).eq("user_id", id);
            setTrainers(prev => prev.map(t => t.id === id ? { ...t, isFounding50: !current } : t));
        } catch (err) {
            console.error(err);
        } finally {
            setFounding50Loading(null);
        }
    };

    const requestStatusUpdate = (id: string, name: string, newStatus: string) => {
        setConfirmModal({ isOpen: true, id, newStatus, name });
    };

    const confirmUpdateStatus = async () => {
        const { id, newStatus } = confirmModal;
        if (!id || !newStatus) return;

        setActionLoading(true);
        try {
            await supabase.from("trainer_profiles").update({ verification_status: newStatus }).eq("user_id", id);
            setTrainers(prev => prev.map(t => {
                if (t.id === id) {
                    const isVerified = newStatus === "verified";
                    const isDeclined = newStatus === "declined";
                    return { ...t, isVerified, isDeclined, status: isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review") };
                }
                return t;
            }));
            setConfirmModal({ isOpen: false, id: null, newStatus: null, name: "" });
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchQuery("");
        setActiveTab("Pending");
        setCurrentPage(1);
    };

    const filteredTrainers = trainers.filter(t => {
        if (activeTab === "Verified" && !t.isVerified) return false;
        if (activeTab === "Declined" && !t.isDeclined) return false;
        if (activeTab === "Pending" && (t.isVerified || t.isDeclined)) return false;
        
        const searchLower = searchQuery.toLowerCase();
        return !searchQuery || t.name.toLowerCase().includes(searchLower) || t.email.toLowerCase().includes(searchLower);
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredTrainers.length / itemsPerPage);
    const paginatedTrainers = filteredTrainers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats calculations
    const pendingCount = trainers.filter(t => !t.isVerified && !t.isDeclined).length;
    const verifiedCount = trainers.filter(t => t.isVerified).length;

    const stats = [
        { title: "TOTAL TRAINERS", value: trainers.length, icon: <FileText size={18} />, highlight: "border-white/[0.04]" },
        { title: "PENDING REVIEW", value: pendingCount, icon: <Clock size={18} />, highlight: "border-orange-500", highlightColor: "text-orange-500" },
        { title: "VERIFIED", value: verifiedCount, icon: <UserCheck size={18} />, highlight: "border-primary", highlightColor: "text-primary" },
        { title: "FOUNDING 50", value: `${founding50Count}/50`, icon: <Award size={18} />, highlight: "border-yellow-500", highlightColor: "text-yellow-500" },
    ];

    return (
        <div className="space-y-8 max-w-[1600px] w-full">

            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                    <span className="text-text-main">Trainer</span>
                    <span className="text-primary border-b-4 border-primary pb-1">Approvals</span>
                </h1>
                <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                    Review and verify professional certifications for new training partners to maintain platform quality.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className={`bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[20px] p-6 flex flex-col justify-between relative overflow-hidden group hover:border-white/[0.06] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]`}>
                        {stat.highlight && (
                            <div className={`absolute top-0 bottom-0 left-0 w-1 ${stat.highlight} transition-all duration-300 group-hover:w-1.5`}></div>
                        )}
                        <div className="flex justify-between items-start mb-6">
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight w-24">
                                {stat.title}
                            </span>
                            <div className={`p-2 rounded-xl bg-white/5 ${stat.highlightColor || "text-text-main/40 group-hover:text-text-main/80"} transition-colors`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className={`text-3xl sm:text-4xl font-black ${stat.highlightColor || "text-text-main"} tracking-tighter`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface/50 border border-white/5 p-2 rounded-[24px]">
                <div className="relative w-full md:w-96 flex-1 flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            placeholder="Search names or emails..."
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
                            onClick={clearFilters}
                            className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0"
                            title="Clear Filters"
                        >
                            <XCircle size={18} />
                        </button>
                    )}
                </div>

                <div className="flex bg-[#12141A] border border-white/5 rounded-full p-1.5 w-full md:w-auto overflow-x-auto scrollbar-none">
                    {["Pending", "Verified", "Declined"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                setCurrentPage(1);
                            }}
                            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-full transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === tab ? "bg-primary text-bg shadow-[0_0_15px_rgba(69,208,255,0.3)]" : "text-text-main/50 hover:text-text-main hover:bg-white/5"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40 bg-white/5">
                                <th className="px-6 py-5 pl-8">Trainer Name</th>
                                <th className="px-6 py-5">Specialty</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Founding 50</th>
                                <th className="px-6 py-5">Documents</th>
                                <th className="px-6 py-5 pr-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-text-main/50 font-bold">
                                        Loading trainers...
                                    </td>
                                </tr>
                            ) : paginatedTrainers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-text-main/50 font-bold">
                                        No trainers found matching your filters.
                                        {searchQuery && (
                                            <button onClick={clearFilters} className="ml-2 text-primary hover:underline">Clear Search</button>
                                        )}
                                    </td>
                                </tr>
                            ) : paginatedTrainers.map((t, i) => (
                                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5 pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black flex-shrink-0 border border-primary/20">
                                                {t.initials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-text-main tracking-wide group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                    {t.name}
                                                    {t.isFounding50 && <FoundingBadgeTooltip size={18} />}
                                                </div>
                                                <div className="text-text-main/60 font-medium text-xs">{t.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="bg-white/5 text-text-main/90 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg inline-flex border border-white/[0.04]">
                                            {t.specialty}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {t.isVerified ? (
                                            t.isFounding50 ? (
                                                <div className="flex items-center gap-2">
                                                    <FoundingBadgeTooltip size={28} />
                                                    <button
                                                        onClick={() => toggleFounding50(t.id, true)}
                                                        disabled={founding50Loading === t.id}
                                                        className="text-[10px] font-black uppercase tracking-wider text-yellow-500/60 hover:text-red-400 transition-colors"
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => founding50Count < 50 && toggleFounding50(t.id, false)}
                                                    disabled={founding50Count >= 50 || founding50Loading === t.id}
                                                    className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-black uppercase tracking-wider hover:bg-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {founding50Loading === t.id ? "..." : founding50Count >= 50 ? "Slots Full" : "Grant F50"}
                                                </button>
                                            )
                                        ) : (
                                            <span className="text-text-main/30 text-[10px] font-bold uppercase tracking-wider">Verify First</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            {t.isVerified ? (
                                                <span className="flex items-center justify-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-green-500/10 text-green-500 border-green-500/20">
                                                    Verified
                                                </span>
                                            ) : t.isDeclined ? (
                                                <span className="flex items-center justify-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-red-500/10 text-red-500 border-red-500/20">
                                                    Declined
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-orange-500/10 text-orange-500 border-orange-500/20">
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <button className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10">
                                            <FileText size={14} />
                                            {t.isVerified ? "View Certs" : "Preview PDF"}
                                        </button>
                                    </td>
                                    <td className="px-6 py-5 pr-8 text-right">
                                        {t.isVerified || t.isDeclined ? (
                                            <span className="text-text-main/40 italic text-[10px] font-bold uppercase tracking-wider">Action completed</span>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => requestStatusUpdate(t.id, t.name, "verified")} className="px-4 py-2 rounded-xl bg-primary text-bg font-black text-xs uppercase tracking-widest hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all">
                                                    Approve
                                                </button>
                                                <button onClick={() => requestStatusUpdate(t.id, t.name, "declined")} className="px-4 py-2 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-black uppercase tracking-widest hover:bg-white/5 hover:text-red-500 hover:border-red-500/50 transition-all">
                                                    Reject
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
                {!loading && filteredTrainers.length > 0 && (
                    <div className="px-8 py-5 flex items-center justify-between border-t border-white/5 bg-[#12141A]/50">
                        <div className="text-xs font-bold text-text-main/40 tracking-wide uppercase">
                            Showing <span className="text-text-main mx-1">{(currentPage - 1) * itemsPerPage + 1}</span> 
                            to <span className="text-text-main mx-1">{Math.min(currentPage * itemsPerPage, filteredTrainers.length)}</span> 
                            of <span className="text-text-main mx-1">{filteredTrainers.length}</span> {activeTab.toLowerCase()}
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-text-main/60 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button 
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
                title={confirmModal.newStatus === "verified" ? "Approve Trainer" : "Reject Trainer"}
                message={<span>Are you sure you want to <strong>{confirmModal.newStatus === "verified" ? "approve" : "reject"}</strong> {confirmModal.name}?</span>}
                confirmText={confirmModal.newStatus === "verified" ? "Approve" : "Reject"}
                type={confirmModal.newStatus === "verified" ? "success" : "danger"}
                onCancel={() => setConfirmModal({ isOpen: false, id: null, newStatus: null, name: "" })}
                onConfirm={confirmUpdateStatus}
                isLoading={actionLoading}
            />
        </div>
    );
}
