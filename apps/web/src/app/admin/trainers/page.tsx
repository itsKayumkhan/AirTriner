"use client";

import { useState, useEffect } from "react";
import { Download, Plus, FileText, CheckCircle, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminTrainersPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("Pending");
    const [trainers, setTrainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        const loadTrainers = async () => {
            try {
                const { data: usersData } = await supabase.from("users").select("*").eq("role", "trainer");
                if (!usersData) return;

                const userIds = usersData.map(u => u.id);
                const { data: profilesData } = await supabase.from("trainer_profiles").select("user_id, verification_status, sports").in("user_id", userIds);
                const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

                setTrainers(usersData.map(u => {
                    const profile = profilesMap.get(u.id);
                    const isVerified = profile?.verification_status === "verified";
                    const isDeclined = profile?.verification_status === "declined";
                    const statusText = isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review");
                    const sports = profile?.sports || [];

                    return {
                        id: u.id,
                        name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
                        email: u.email,
                        initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`,
                        specialty: sports.length > 0 ? sports[0] : "General",
                        status: statusText,
                        isVerified,
                        isDeclined
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

    const handleUpdateStatus = async (id: string, newStatus: string) => {
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
            if (newStatus === "verified") alert("Trainer approved!");
        } catch (err) {
            console.error(err);
        }
    };

    const filteredTrainers = trainers.filter(t => {
        if (activeTab === "Verified" && !t.isVerified) return false;
        if (activeTab === "Declined" && !t.isDeclined) return false;
        if (activeTab === "Pending" && (t.isVerified || t.isDeclined)) return false;
        return t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.email.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    const totalPages = Math.ceil(filteredTrainers.length / itemsPerPage);
    const paginatedTrainers = filteredTrainers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const pendingCount = trainers.filter(t => !t.isVerified && !t.isDeclined).length;

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Trainer Approvals</h1>
                    <p className="text-sm font-medium text-text-main/60">Review and verify professional certifications for new training partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 bg-surface text-sm font-bold text-text-main/80 hover:text-text-main hover:border-gray-500 transition-colors">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all">
                        <Plus size={18} strokeWidth={3} /> Add Trainer
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex justify-between items-center border-b border-white/5 pb-2 bg-bg sticky top-0 z-10 pt-2">
                <div className="flex gap-8">
                    {["Pending", "Verified", "Declined"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-sm font-bold tracking-wide relative whitespace-nowrap ${activeTab === tab ? "text-primary border-b-2 border-primary" : "text-text-main/40 hover:text-text-main/80"
                                }`}
                        >
                            {tab === "Pending" ? `Pending Requests (${pendingCount})` : tab}
                        </button>
                    ))}
                </div>

                <div className="relative w-64 hidden md:block">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Search trainers..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-10 pr-4 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-gray-500 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-surface text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="px-6 py-4">Trainer Name</th>
                                <th className="px-6 py-4">Specialty</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Documents</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface text-sm">
                            {paginatedTrainers.map((t, i) => (
                                <tr key={t.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#272A35] flex items-center justify-center text-primary font-black flex-shrink-0 border border-gray-700">
                                                {t.initials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-text-main tracking-wide">{t.name}</div>
                                                <div className="text-text-main/40 font-medium text-xs">{t.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="bg-[#272A35] text-text-main/80 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full inline-flex border border-gray-700">
                                            {t.specialty}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {t.isVerified ? (
                                                <span className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-black tracking-widest bg-primary/10 px-2 py-1 rounded">
                                                    <CheckCircle size={14} className="fill-current text-gray-900" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-orange-500 text-[10px] uppercase font-black tracking-widest">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    Pending Review
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest hover:text-text-main transition-colors">
                                            <FileText size={16} />
                                            {t.isVerified ? "View Certs" : "Preview PDF"}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {t.isVerified ? (
                                            <span className="text-text-main/40 italic text-xs font-medium">Action completed</span>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleUpdateStatus(t.id, "verified")} className="px-4 py-1.5 rounded-md border border-primary/20 text-primary hover:bg-primary/10 text-xs font-black uppercase tracking-widest transition-colors">
                                                    Approve
                                                </button>
                                                <button onClick={() => handleUpdateStatus(t.id, "declined")} className="px-4 py-1.5 rounded-md border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-black uppercase tracking-widest transition-colors">
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
                <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                    <div className="text-xs font-bold text-text-main/40 tracking-wide">
                        Showing <span className="text-text-main">{paginatedTrainers.length}</span> of <span className="text-text-main">{filteredTrainers.length}</span> requests
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ‹
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 rounded-full font-bold transition-all ${
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
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
