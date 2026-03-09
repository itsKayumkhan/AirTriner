"use client";

import { useState, useEffect } from "react";
import { Search, X, FileText, BarChart2, Image as ImageIcon, CheckCircle, RotateCcw, MessageSquare, Loader2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PopupModal from "@/components/common/PopupModal";

export default function AdminDisputesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("PENDING");
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

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
            // Fetch disputes with their related booking details
            const { data: dData, error: dError } = await supabase
                .from("disputes")
                .select(`
                    id, booking_id, initiated_by, reason, status, resolution, evidence_deadline, created_at, resolved_at,
                    bookings (id, price, athlete_id, trainer_id, sport)
                `)
                .order("created_at", { ascending: false });

            if (dError) throw dError;

            if (dData && dData.length > 0) {
                // Collect all user IDs involved
                const userIds = new Set<string>();
                dData.forEach((d: any) => {
                    if (d.bookings) {
                        userIds.add(d.bookings.athlete_id);
                        userIds.add(d.bookings.trainer_id);
                    }
                });

                // Fetch user names
                const { data: usersData } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", Array.from(userIds));
                
                const usersMap = new Map((usersData || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`.trim()]));

                // Format the dispute data
                const formatted = dData.map((d: any) => {
                    const price = Number(d.bookings?.price || 0);
                    return {
                        id: d.id,
                        displayId: `#DIS-${d.id.substring(0, 5).toUpperCase()}`,
                        bookingId: d.booking_id,
                        displayBookingId: `BK-${d.booking_id.substring(0, 6).toUpperCase()}`,
                        athlete: usersMap.get(d.bookings?.athlete_id) || "Unknown Athlete",
                        trainer: usersMap.get(d.bookings?.trainer_id) || "Unknown Trainer",
                        amount: `$${price.toFixed(2)}`,
                        rawAmount: price,
                        status: d.status,
                        reason: d.reason || "No specific reason provided.",
                        createdAt: new Date(d.created_at),
                        sport: d.bookings?.sport || "General Session"
                    };
                });
                
                setDisputes(formatted);
                if (formatted.length > 0 && !selectedDispute) setSelectedDispute(formatted[0]);
            }
        } catch (err) {
            console.error("Failed to load disputes:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'refund' | 'resolve') => {
        if (!selectedDispute) return;

        const title = action === 'refund' ? "Refund Dispute" : "Resolve Dispute";
        const message = action === 'refund' 
            ? "Are you sure you want to issue a full refund to the athlete? This will also cancel the booking."
            : "Are you sure you want to resolve this dispute in favor of the trainer? The held funds will be released.";

        showConfirm(title, message, async () => {
            setProcessing(true);
            try {
                const newStatus = action === 'resolve' ? 'resolved' : 'resolved';
                
                // 1. Update dispute status
                await supabase
                    .from("disputes")
                    .update({ 
                        status: newStatus, 
                        resolved_at: new Date().toISOString(), 
                        resolution: action === 'refund' ? "Refunded" : "Resolved in favor of Trainer" 
                    })
                    .eq("id", selectedDispute.id);

                // 2. Update payment transaction if refunding
                if (action === 'refund') {
                    await supabase
                        .from("payment_transactions")
                        .update({ status: 'refunded' })
                        .eq("booking_id", selectedDispute.bookingId);
                    
                    // Update booking status
                    await supabase
                        .from("bookings")
                        .update({ status: 'cancelled' })
                        .eq("id", selectedDispute.bookingId);
                } else if (action === 'resolve') {
                     await supabase
                        .from("payment_transactions")
                        .update({ status: 'released', released_at: new Date().toISOString() })
                        .eq("booking_id", selectedDispute.bookingId);
                }

                // Update local state
                setDisputes(prev => prev.map(d => d.id === selectedDispute.id ? { ...d, status: newStatus } : d));
                setSelectedDispute(null);
                loadData();
                showAlert("success", "Dispute Resolved", `The dispute has been successfully ${action === 'refund' ? 'refunded' : 'resolved'}.`);
            } catch (err) {
                console.error(err);
                showAlert("error", "Error", "Failed to process dispute action. Please try again.");
            } finally {
                setProcessing(false);
            }
        });
    };

    const filteredDisputes = disputes.filter(d => {
        if (activeTab === "PENDING" && d.status !== "under_review" && d.status !== "escalated") return false;
        if (activeTab === "RESOLVED" && d.status !== "resolved") return false;
        if (searchQuery && !d.athlete.toLowerCase().includes(searchQuery.toLowerCase()) && !d.trainer.toLowerCase().includes(searchQuery.toLowerCase()) && !d.displayId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const stats = [
        { title: "TOTAL DISPUTES", value: disputes.length.toString(), icon: <BarChart2 size={16} /> },
        { title: "NEEDS ACTION", value: disputes.filter(d => d.status === "under_review" || d.status === "escalated").length.toString(), highlight: "border-primary" },
        { title: "REFUNDED THIS WEEK", value: `$${disputes.filter(d => d.status === "resolved").reduce((sum, d) => sum + d.rawAmount, 0).toFixed(0)}`, highlight: "border-white/5" },
        { title: "HIGH RISK FRAUD", value: disputes.filter(d => d.status === "escalated").length.toString().padStart(2, '0'), highlight: "border-red-500", highlightColor: "text-red-500" },
    ];



    return (
        <div className="flex flex-col lg:flex-row gap-8 max-w-[1400px]">

            {/* Left Column: Disputes List */}
            <div className="flex-1 space-y-8">

                {/* Header */}
                <div className="flex flex-col gap-4">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none">
                        <span className="text-text-main block">Dispute</span>
                        <span className="text-primary block">Management</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-sm mb-4">
                        Resolve payment conflicts and review fraud flags across the platform.
                    </p>
                </div>

                {/* Search & Tabs */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            placeholder="Search disputes, tickets, athletes..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-surface border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm text-text-main focus:outline-none focus:border-gray-600 transition-colors"
                        />
                    </div>

                    <div className="flex bg-surface border border-white/5 rounded-full p-1.5 self-start md:self-auto">
                        {["PENDING", "RESOLVED", "ARCHIVE"].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-full transition-all ${activeTab === tab ? "bg-[#272A35] text-text-main shadow-sm" : "text-text-main/40 hover:text-text-main/80"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <div key={i} className={`bg-surface border border-white/5 rounded-[16px] p-5 flex flex-col justify-between relative overflow-hidden group`}>
                            {stat.highlight && (
                                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${stat.highlight}`}></div>
                            )}
                            <div className="flex justify-between items-start mb-4 pl-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40 leading-tight w-20">
                                    {stat.title}
                                </span>
                                {stat.icon && <div className="text-gray-600">{stat.icon}</div>}
                            </div>
                            <div className={`text-4xl font-black pl-2 ${stat.highlightColor || "text-text-main"}`}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                    <th className="px-6 py-5">Dispute ID</th>
                                    <th className="px-6 py-5">Athlete</th>
                                    <th className="px-6 py-5">Trainer</th>
                                    <th className="px-6 py-5">Amount</th>
                                    <th className="px-6 py-5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm border-t border-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12">
                                            <Loader2 size={24} className="mx-auto animate-spin text-primary opacity-50 mb-2" />
                                            <p className="text-text-main/40 text-sm font-bold tracking-widest uppercase">Loading Disputes</p>
                                        </td>
                                    </tr>
                                ) : filteredDisputes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12">
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                                <FileText size={20} className="text-text-main/40" />
                                            </div>
                                            <p className="text-text-main font-bold">No disputes found</p>
                                            <p className="text-sm text-text-main/40">Try adjusting your filters or search query.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDisputes.map((d, i) => (
                                        <tr
                                            key={d.id}
                                            onClick={() => setSelectedDispute(d)}
                                            className={`border-b border-white/5/50 hover:bg-white/5 cursor-pointer transition-colors ${selectedDispute?.id === d.id ? "bg-[#272A35]/50" : ""}`}
                                        >
                                            <td className="px-6 py-5">
                                                <span className={`font-black text-sm tracking-wide ${selectedDispute?.id === d.id ? "text-primary" : "text-text-main/60"}`}>
                                                    {d.displayId}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex-shrink-0 border border-[#2563eb]/20 flex items-center justify-center text-xs font-bold text-white uppercase">{d.athlete[0]}</div>
                                                    <span className="font-bold text-text-main tracking-wide">{d.athlete}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex-shrink-0 border border-[#2563eb]/20 flex items-center justify-center text-xs font-bold text-white uppercase">{d.trainer[0]}</div>
                                                    <span className="text-text-main/80 font-medium">{d.trainer}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 font-black text-base text-text-main">{d.amount}</td>
                                            <td className="px-6 py-5">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                    d.status === "under_review" ? "bg-primary/10 text-primary border-primary/20" :
                                                    d.status === "escalated" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-[#272A35] text-text-main/60 border-gray-700"
                                                }`}>
                                                    {d.status.replace("_", " ")}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Right Column: Active Ticket Side Panel */}
            <div className="w-full lg:w-[450px] flex-shrink-0 flex flex-col h-fit sticky top-8">
                {selectedDispute ? (
                    <div className="bg-surface border border-white/5 rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                        {/* Panel Header */}
                        <div className="p-8 pb-6 border-b border-white/5/50 relative">
                            <button onClick={() => setSelectedDispute(null)} className="absolute top-8 right-8 text-text-main/40 hover:text-text-main transition-colors">
                                <X size={20} />
                            </button>
                            <div className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-md inline-block mb-6">
                                Active Ticket
                            </div>
                            <h2 className="text-2xl font-black text-text-main tracking-tight mb-2">{selectedDispute.displayId}</h2>
                            <p className="text-text-main/40 text-xs font-bold tracking-wide">
                                Reported on {selectedDispute.createdAt.toLocaleDateString()}
                            </p>
                        </div>

                        {/* Panel Body */}
                        <div className="p-8 pt-6 flex-1 flex flex-col gap-8">
                            {/* Booking Details Box */}
                            <div className="bg-surface border border-white/5 rounded-[20px] p-5 relative overflow-hidden">
                                <FileText size={48} className="absolute -right-4 -top-4 text-gray-800/30 rotate-12" />

                                <div className="mb-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Booking Reference</div>
                                    <div className="font-bold text-text-main tracking-wide">{selectedDispute.displayBookingId}</div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Service</div>
                                        <div className="font-medium text-text-main/80 text-sm">{selectedDispute.sport} Session</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Total Paid</div>
                                        <div className="font-black text-primary text-lg">{selectedDispute.amount}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Complaint Details */}
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-4 px-2">Complaint Details</div>
                                <div className="bg-primary/5 border-l-2 border-primary p-5 rounded-r-xl relative">
                                    <p className="font-medium text-text-main/80 text-sm leading-relaxed italic relative z-10">
                                        "{selectedDispute.reason}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Panel Footer Actions */}
                        <div className="p-8 pt-4 border-t border-white/5/50 bg-surface flex flex-col gap-3">
                            <button 
                                onClick={() => handleAction('refund')}
                                disabled={processing || selectedDispute.status === "resolved"}
                                className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.25)] transition-all disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {processing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} strokeWidth={3} />} 
                                Full Refund
                            </button>
                            <div className="flex gap-3">
                                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-[#272A35] border border-gray-700 text-text-main/80 text-xs font-black uppercase tracking-widest hover:text-text-main hover:bg-[#272A35] transition-colors">
                                    <MessageSquare size={16} /> Contact Parties
                                </button>
                                <button 
                                    onClick={() => handleAction('resolve')}
                                    disabled={processing || selectedDispute.status === "resolved"}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-[#272A35] border border-gray-700 text-text-main/80 text-xs font-black uppercase tracking-widest hover:text-text-main hover:bg-[#272A35] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <CheckCircle size={16} /> Resolve Case
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface border border-white/5 rounded-[32px] h-full min-h-[500px] flex flex-col items-center justify-center p-8 text-center text-text-main/40">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <h3 className="text-lg font-bold text-text-main/80 mb-2">No Ticket Selected</h3>
                        <p className="text-sm">Select a dispute from the list to view evidence and resolution tools.</p>
                    </div>
                )}
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
