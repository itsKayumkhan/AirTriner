"use client";

import { useState, useEffect } from "react";
import { Download, Plus, FileText, CheckCircle, Search, XCircle, ChevronLeft, ChevronRight, UserCheck, Clock, Award, ExternalLink, ShieldCheck, ShieldX, X, Mail, Phone, MapPin, Calendar, CreditCard, Loader2, Activity, DollarSign, ImageIcon, Eye, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FoundingBadgeTooltip } from "@/components/ui/FoundingBadge";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/admin/LocationMap"), { ssr: false });

type DocsModalState = {
    isOpen: boolean;
    trainerId: string | null;
    trainerName: string;
    docs: string[];
    isVerified: boolean;
    isDeclined: boolean;
};

export default function AdminTrainersPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("Pending");
    const [trainers, setTrainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Docs modal
    const [docsModal, setDocsModal] = useState<DocsModalState>({
        isOpen: false, trainerId: null, trainerName: "", docs: [], isVerified: false, isDeclined: false
    });
    const [docsActionLoading, setDocsActionLoading] = useState(false);

    // Image approval modal
    const [imageModal, setImageModal] = useState<{
        isOpen: boolean;
        trainerId: string | null;
        trainerName: string;
        imageUrl: string | null;
        status: "none" | "pending" | "approved" | "rejected";
        rejectionReason: string | null;
    }>({ isOpen: false, trainerId: null, trainerName: "", imageUrl: null, status: "none", rejectionReason: null });
    const [imageActionLoading, setImageActionLoading] = useState(false);
    const [rejectReasonInput, setRejectReasonInput] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Trainer Detail Modal
    const [trainerDetail, setTrainerDetail] = useState<{ isOpen: boolean; loading: boolean; data: any }>({ isOpen: false, loading: false, data: null });

    const openTrainerDetail = async (trainerId: string) => {
        setTrainerDetail({ isOpen: true, loading: true, data: null });
        try {
            const res = await fetch(`/api/admin/trainer-detail?userId=${trainerId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setTrainerDetail({ isOpen: true, loading: false, data: json });
        } catch (err) {
            console.error(err);
            setTrainerDetail({ isOpen: true, loading: false, data: null });
        }
    };

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const loadTrainers = async () => {
        try {
            const { data: usersData } = await supabase.from("users").select("*").eq("role", "trainer");
            if (!usersData) return;

            const userIds = usersData.map(u => u.id);
            const { data: profilesData } = await supabase
                .from("trainer_profiles")
                .select("user_id, verification_status, sports, is_founding_50, verification_documents, latitude, longitude, city, state, profile_image_url, profile_image_status, profile_image_rejection_reason")
                .in("user_id", userIds);
            const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

            setTrainers(usersData.map(u => {
                const profile = profilesMap.get(u.id);
                const isVerified = profile?.verification_status === "verified";
                const isDeclined = profile?.verification_status === "rejected";
                const statusText = isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review");
                const sports = profile?.sports || [];
                const docs: string[] = profile?.verification_documents || [];

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
                    docs,
                    lat: profile?.latitude,
                    lng: profile?.longitude,
                    city: profile?.city,
                    state: profile?.state,
                    profileImageUrl: profile?.profile_image_url || null,
                    profileImageStatus: profile?.profile_image_status || "none",
                    profileImageRejectionReason: profile?.profile_image_rejection_reason || null,
                };
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrainers();
    }, []);

    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | null, newStatus: string | null, name: string}>({isOpen: false, id: null, newStatus: null, name: ""});
    const [actionLoading, setActionLoading] = useState(false);
    const [founding50Loading, setFounding50Loading] = useState<string | null>(null);

    const founding50Count = trainers.filter(t => t.isFounding50).length;

    const openDocsModal = (t: any) => {
        setDocsModal({
            isOpen: true,
            trainerId: t.id,
            trainerName: t.name,
            docs: t.docs,
            isVerified: t.isVerified,
            isDeclined: t.isDeclined,
        });
    };

    const openImageModal = (t: any) => {
        setImageModal({
            isOpen: true,
            trainerId: t.id,
            trainerName: t.name,
            imageUrl: t.profileImageUrl,
            status: t.profileImageStatus,
            rejectionReason: t.profileImageRejectionReason,
        });
        setRejectReasonInput("");
        setShowRejectInput(false);
    };

    const handleImageAction = async (action: "approve" | "reject") => {
        if (!imageModal.trainerId) return;
        setImageActionLoading(true);
        try {
            const res = await fetch("/api/admin/approve-trainer-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trainerId: imageModal.trainerId,
                    action,
                    ...(action === "reject" ? { reason: rejectReasonInput } : {}),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            await loadTrainers();
            setImageModal(prev => ({
                ...prev,
                isOpen: false,
            }));
            setShowRejectInput(false);
            setRejectReasonInput("");
        } catch (err) {
            console.error(err);
        } finally {
            setImageActionLoading(false);
        }
    };

    const handleDocsStatusUpdate = async (newStatus: "verified" | "rejected") => {
        if (!docsModal.trainerId) return;
        setDocsActionLoading(true);
        try {
            await supabase
                .from("trainer_profiles")
                .update({ verification_status: newStatus, is_verified: newStatus === "verified" })
                .eq("user_id", docsModal.trainerId);

            // Insert notification for the trainer
            const notification = newStatus === "verified"
                ? {
                    user_id: docsModal.trainerId,
                    type: "PROFILE_VERIFIED",
                    title: "Profile Approved!",
                    body: "Congratulations! Your trainer profile has been verified. Athletes can now find and book you.",
                    read: false,
                }
                : {
                    user_id: docsModal.trainerId,
                    type: "PROFILE_REJECTED",
                    title: "Verification Update",
                    body: "Your profile verification needs attention. Please review your documents and resubmit.",
                    read: false,
                };
            await supabase.from("notifications").insert(notification);

            setTrainers(prev => prev.map(t => {
                if (t.id === docsModal.trainerId) {
                    const isVerified = newStatus === "verified";
                    const isDeclined = newStatus === "rejected";
                    return { ...t, isVerified, isDeclined, status: isVerified ? "Verified" : "Declined" };
                }
                return t;
            }));

            setDocsModal(prev => ({
                ...prev,
                isVerified: newStatus === "verified",
                isDeclined: newStatus === "rejected",
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setDocsActionLoading(false);
        }
    };

    const toggleFounding50 = async (id: string, current: boolean) => {
        setFounding50Loading(id);
        try {
            await supabase.from("trainer_profiles").update({
                is_founding_50: !current,
                founding_50_granted_at: !current ? new Date().toISOString() : null,
                ...((!current) ? { subscription_status: "active", subscription_expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() } : {})
            }).eq("user_id", id);
            await loadTrainers();
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
                    const isDeclined = newStatus === "rejected";
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
        if (activeTab === "Image Approval" && t.profileImageStatus !== "pending") return false;

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

            {/* Location Map */}
            <LocationMap
                pins={trainers.filter(t => t.lat && t.lng).map(t => ({
                    id: t.id,
                    name: t.name,
                    lat: t.lat,
                    lng: t.lng,
                    role: "trainer" as const,
                    status: t.status,
                    sport: t.specialty,
                    city: t.city,
                    state: t.state,
                }))}
                title="Trainer Locations"
                subtitle="Track where trainers are concentrated and where coverage is lacking"
            />

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
                    {["Pending", "Verified", "Declined", "Image Approval"].map(tab => (
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
                                <th className="px-6 py-5">Location</th>
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
                                    <td colSpan={7} className="py-10 text-center text-text-main/50 font-bold">
                                        Loading trainers...
                                    </td>
                                </tr>
                            ) : paginatedTrainers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-text-main/50 font-bold">
                                        No trainers found matching your filters.
                                        {searchQuery && (
                                            <button onClick={clearFilters} className="ml-2 text-primary hover:underline">Clear Search</button>
                                        )}
                                    </td>
                                </tr>
                            ) : paginatedTrainers.map((t, i) => (
                                <tr key={t.id} onClick={() => openTrainerDetail(t.id)} className="border-b border-white/[0.04] hover:bg-white/5 transition-colors group cursor-pointer">
                                    <td className="px-6 py-5 pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black flex-shrink-0 border border-primary/20">
                                                {t.initials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-text-main tracking-wide group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                    {t.name}
                                                    {t.isFounding50 && <FoundingBadgeTooltip size={18} />}
                                                    {t.isVerified && (
                                                        <span title="Verified" className="text-green-400">
                                                            <CheckCircle size={14} />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-text-main/60 font-medium text-xs">{t.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-text-main/80 font-medium text-xs tracking-wide flex items-center gap-1">
                                            {t.city || t.state ? (
                                                <><MapPin size={11} className="text-primary/60" /> {[t.city, t.state].filter(Boolean).join(", ")}</>
                                            ) : (
                                                <span className="text-text-main/30">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="bg-white/5 text-text-main/90 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg inline-flex border border-white/[0.04]">
                                            {t.specialty}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 flex-wrap">
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
                                            {t.profileImageStatus && t.profileImageStatus !== "none" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openImageModal(t); }}
                                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border cursor-pointer transition-all hover:opacity-80 ${
                                                        t.profileImageStatus === "pending"
                                                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                            : t.profileImageStatus === "approved"
                                                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                            : "bg-red-500/10 text-red-500 border-red-500/20"
                                                    }`}
                                                >
                                                    <ImageIcon size={10} />
                                                    Image: {t.profileImageStatus}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
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
                                    <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openDocsModal(t)}
                                            className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10"
                                        >
                                            <FileText size={14} />
                                            {t.docs.length > 0 ? `${t.docs.length} Doc${t.docs.length > 1 ? "s" : ""}` : "No Docs"}
                                        </button>
                                    </td>
                                    <td className="px-6 py-5 pr-8 text-right" onClick={e => e.stopPropagation()}>
                                        {t.isVerified || t.isDeclined ? (
                                            <span className="text-text-main/40 italic text-[10px] font-bold uppercase tracking-wider">Action completed</span>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => requestStatusUpdate(t.id, t.name, "verified")} className="px-4 py-2 rounded-xl bg-primary text-bg font-black text-xs uppercase tracking-widest hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all">
                                                    Approve
                                                </button>
                                                <button onClick={() => requestStatusUpdate(t.id, t.name, "rejected")} className="px-4 py-2 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-black uppercase tracking-widest hover:bg-white/5 hover:text-red-500 hover:border-red-500/50 transition-all">
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

            {/* Trainer Detail Modal */}
            {trainerDetail.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#1A1C23] z-10 rounded-t-[24px]">
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">Trainer Details</h3>
                            <button onClick={() => setTrainerDetail({ isOpen: false, loading: false, data: null })} className="p-2 rounded-xl text-text-main/50 hover:text-white hover:bg-white/5 transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {trainerDetail.loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 size={32} className="animate-spin text-primary mb-3" />
                                <p className="text-text-main/40 text-sm font-bold uppercase tracking-widest">Loading Details...</p>
                            </div>
                        ) : !trainerDetail.data ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <p className="text-text-main/40 text-sm font-bold">Failed to load trainer details</p>
                            </div>
                        ) : (() => {
                            const { user, profile, stats, recentPayments } = trainerDetail.data;
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
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                    profile?.verification_status === "verified" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                                    profile?.verification_status === "rejected" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                                }`}>
                                                    {profile?.verification_status || "Pending"}
                                                </span>
                                                {profile?.is_founding_50 && (
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">Founding 50</span>
                                                )}
                                                <span className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <Calendar size={10} /> Joined {new Date(user?.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bio */}
                                    {profile?.bio && (
                                        <div className="bg-white/5 border border-white/[0.04] rounded-xl px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Bio</p>
                                            <p className="text-text-main/80 text-sm font-medium">{profile.bio}</p>
                                        </div>
                                    )}

                                    {/* Sports & Rate */}
                                    <div className="flex flex-wrap gap-3">
                                        {(profile?.sports || []).map((s: string) => (
                                            <span key={s} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">{s}</span>
                                        ))}
                                        {profile?.hourly_rate && (
                                            <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20 flex items-center gap-1">
                                                <DollarSign size={10} /> ${profile.hourly_rate}/hr
                                            </span>
                                        )}
                                    </div>

                                    {/* Booking Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40 mb-1">Total Bookings</p>
                                            <p className="text-2xl font-black text-text-main">{stats?.totalBookings ?? 0}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-green-500/60 mb-1">Completed</p>
                                            <p className="text-2xl font-black text-green-500">{stats?.completedBookings ?? 0}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500/60 mb-1">Pending</p>
                                            <p className="text-2xl font-black text-yellow-500">{stats?.pendingBookings ?? 0}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-red-500/60 mb-1">Cancelled</p>
                                            <p className="text-2xl font-black text-red-500">{stats?.cancelledBookings ?? 0}</p>
                                        </div>
                                    </div>

                                    {/* Financial Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-[#12141A] border border-primary/20 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 mb-1">Total Revenue</p>
                                            <p className="text-xl font-black text-primary">${(stats?.totalRevenue ?? 0).toFixed(2)}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40 mb-1">Platform Fees</p>
                                            <p className="text-xl font-black text-text-main">${(stats?.totalPlatformFee ?? 0).toFixed(2)}</p>
                                        </div>
                                        <div className="bg-[#12141A] border border-white/5 rounded-xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40 mb-1">Total Volume</p>
                                            <p className="text-xl font-black text-text-main">${(stats?.totalVolume ?? 0).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    {/* Subscription Info */}
                                    <div className="bg-white/5 border border-white/[0.04] rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40">Subscription</p>
                                            <p className="text-sm font-bold text-text-main capitalize">{profile?.subscription_status || "None"}</p>
                                        </div>
                                        {profile?.subscription_expires_at && (
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40">Expires</p>
                                                <p className="text-sm font-bold text-text-main">{new Date(profile.subscription_expires_at).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {profile?.stripe_account_id && (
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-main/40">Stripe</p>
                                                <p className="text-sm font-bold text-green-500">Connected</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent Payments */}
                                    {recentPayments && recentPayments.length > 0 && (
                                        <div>
                                            <h5 className="text-xs font-black uppercase tracking-widest text-text-main/40 mb-3">Recent Payments</h5>
                                            <div className="space-y-2">
                                                {recentPayments.map((p: any) => (
                                                    <div key={p.id} className="flex items-center justify-between bg-[#12141A] border border-white/5 rounded-xl px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                                <CreditCard size={14} className="text-text-main/40" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-text-main">${p.trainerPayout.toFixed(2)}</p>
                                                                <p className="text-[10px] text-text-main/40 font-medium">{new Date(p.date).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                                            p.status === "released" ? "bg-primary/10 text-primary border-primary/20" :
                                                            p.status === "held" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                                            "bg-red-500/10 text-red-500 border-red-500/20"
                                                        }`}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Image Approval Modal */}
            {imageModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-wider">Profile Image Review</h3>
                                <p className="text-xs text-text-main/50 font-medium mt-0.5">{imageModal.trainerName}</p>
                            </div>
                            <button
                                onClick={() => { setImageModal(prev => ({ ...prev, isOpen: false })); setShowRejectInput(false); setRejectReasonInput(""); }}
                                className="p-2 rounded-xl text-text-main/50 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current status badge */}
                        <div className="px-6 pt-4 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Current Status:</span>
                            {imageModal.status === "approved" ? (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">Approved</span>
                            ) : imageModal.status === "rejected" ? (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">Rejected</span>
                            ) : (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Review</span>
                            )}
                        </div>

                        {/* Image preview */}
                        <div className="p-6">
                            {imageModal.imageUrl ? (
                                <div className="flex justify-center">
                                    <img
                                        src={imageModal.imageUrl}
                                        alt={`${imageModal.trainerName} profile`}
                                        className="w-[400px] h-[400px] object-cover rounded-xl border border-white/10"
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-xl text-center">
                                    <ImageIcon size={28} className="text-text-main/20 mb-3" />
                                    <p className="text-text-main/40 text-sm font-medium">No image uploaded</p>
                                </div>
                            )}

                            {imageModal.rejectionReason && imageModal.status === "rejected" && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Rejection Reason</p>
                                    <p className="text-text-main/80 text-sm font-medium">{imageModal.rejectionReason}</p>
                                </div>
                            )}
                        </div>

                        {/* Reject reason input */}
                        {showRejectInput && (
                            <div className="px-6 pb-4 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Enter rejection reason..."
                                    value={rejectReasonInput}
                                    onChange={e => setRejectReasonInput(e.target.value)}
                                    className="w-full bg-[#12141A] border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleImageAction("reject")}
                                        disabled={imageActionLoading || !rejectReasonInput.trim()}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {imageActionLoading ? (
                                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <ShieldX size={14} />
                                        )}
                                        Confirm Reject
                                    </button>
                                    <button
                                        onClick={() => { setShowRejectInput(false); setRejectReasonInput(""); }}
                                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-text-main/60 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Approve / Reject actions */}
                        {!showRejectInput && (
                            <div className="p-6 pt-0 flex gap-3">
                                <button
                                    onClick={() => handleImageAction("approve")}
                                    disabled={imageActionLoading || imageModal.status === "approved"}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black uppercase tracking-widest hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {imageActionLoading ? (
                                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <ShieldCheck size={15} />
                                    )}
                                    {imageModal.status === "approved" ? "Already Approved" : "Approve"}
                                </button>
                                <button
                                    onClick={() => setShowRejectInput(true)}
                                    disabled={imageActionLoading || imageModal.status === "rejected"}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ShieldX size={15} />
                                    {imageModal.status === "rejected" ? "Already Rejected" : "Reject"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Documents Modal */}
            {docsModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-wider">Verification Documents</h3>
                                <p className="text-xs text-text-main/50 font-medium mt-0.5">{docsModal.trainerName}</p>
                            </div>
                            <button
                                onClick={() => setDocsModal(prev => ({ ...prev, isOpen: false }))}
                                className="p-2 rounded-xl text-text-main/50 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current status badge */}
                        <div className="px-6 pt-4 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Current Status:</span>
                            {docsModal.isVerified ? (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">Verified</span>
                            ) : docsModal.isDeclined ? (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">Declined</span>
                            ) : (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/20">Pending Review</span>
                            )}
                        </div>

                        {/* Document list */}
                        <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
                            {docsModal.docs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-xl text-center">
                                    <FileText size={28} className="text-text-main/20 mb-3" />
                                    <p className="text-text-main/40 text-sm font-medium">No documents uploaded</p>
                                    <p className="text-text-main/25 text-xs mt-1">This trainer has not uploaded any verification documents yet.</p>
                                </div>
                            ) : (
                                docsModal.docs.map((docUrl, idx) => (
                                    <div key={docUrl} className="flex items-center justify-between p-3 bg-[#12141A] border border-white/5 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                                <FileText size={14} className="text-red-400" />
                                            </div>
                                            <span className="text-text-main/70 text-xs font-medium">Document {idx + 1}.pdf</span>
                                        </div>
                                        <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-white/10 transition-all"
                                        >
                                            <ExternalLink size={11} /> Open PDF
                                        </a>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Approve / Reject actions */}
                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={() => handleDocsStatusUpdate("verified")}
                                disabled={docsActionLoading || docsModal.isVerified}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black uppercase tracking-widest hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {docsActionLoading ? (
                                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ShieldCheck size={15} />
                                )}
                                {docsModal.isVerified ? "Already Approved" : "Approve"}
                            </button>
                            <button
                                onClick={() => handleDocsStatusUpdate("rejected")}
                                disabled={docsActionLoading || docsModal.isDeclined}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {docsActionLoading ? (
                                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ShieldX size={15} />
                                )}
                                {docsModal.isDeclined ? "Already Rejected" : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
