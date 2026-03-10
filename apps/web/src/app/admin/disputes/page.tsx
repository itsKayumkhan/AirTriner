"use client";

import { useState, useEffect } from "react";
import { Search, X, FileText, BarChart2, Image as ImageIcon, CheckCircle, RotateCcw, MessageSquare, Loader2, Shield, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
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
            const { data: dData, error: dError } = await supabase
                .from("disputes")
                .select(`
                    id, booking_id, initiated_by, reason, status, resolution, evidence_deadline, created_at, resolved_at,
                    bookings (id, price, athlete_id, trainer_id, sport)
                `)
                .order("created_at", { ascending: false });

            if (dError) throw dError;

            if (dData && dData.length > 0) {
                const userIds = new Set<string>();
                dData.forEach((d: any) => {
                    if (d.bookings) {
                        userIds.add(d.bookings.athlete_id);
                        userIds.add(d.bookings.trainer_id);
                    }
                });

                const { data: usersData } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", Array.from(userIds));

                const usersMap = new Map((usersData || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`.trim()]));

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
                const newStatus = 'resolved';

                await supabase
                    .from("disputes")
                    .update({
                        status: newStatus,
                        resolved_at: new Date().toISOString(),
                        resolution: action === 'refund' ? "Refunded" : "Resolved in favor of Trainer"
                    })
                    .eq("id", selectedDispute.id);

                if (action === 'refund') {
                    await supabase
                        .from("payment_transactions")
                        .update({ status: 'refunded' })
                        .eq("booking_id", selectedDispute.bookingId);

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

                setDisputes(prev => prev.map(d => d.id === selectedDispute.id ? { ...d, status: newStatus } : d));
                setSelectedDispute((prev: any) => prev ? { ...prev, status: newStatus } : null);
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
        if (activeTab === "ESCALATED" && d.status !== "escalated") return false;
        if (searchQuery && !d.athlete.toLowerCase().includes(searchQuery.toLowerCase()) && !d.trainer.toLowerCase().includes(searchQuery.toLowerCase()) && !d.displayId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const stats = [
        { title: "TOTAL DISPUTES", value: disputes.length.toString(), icon: <BarChart2 size={18} />, highlight: "border-white/10" },
        { title: "NEEDS ACTION", value: disputes.filter(d => d.status === "under_review" || d.status === "escalated").length.toString(), icon: <AlertTriangle size={18} />, highlight: "border-primary", highlightColor: "text-primary" },
        { title: "REFUNDED THIS WEEK", value: `$${disputes.filter(d => d.status === "resolved").reduce((sum, d) => sum + d.rawAmount, 0).toFixed(0)}`, icon: <RotateCcw size={18} />, highlight: "border-white/10" },
        { title: "HIGH RISK FRAUD", value: disputes.filter(d => d.status === "escalated").length.toString().padStart(2, '0'), icon: <ShieldAlert size={18} />, highlight: "border-red-500", highlightColor: "text-red-500" },
    ];

    return (
        <div className="flex flex-col xl:flex-row gap-8 max-w-[1600px] w-full">

            {/* Left Column: Disputes List */}
            <div className="flex-1 space-y-8 min-w-0">

                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                        <span className="text-text-main">Dispute</span>
                        <span className="text-primary border-b-4 border-primary pb-1">Management</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                        Resolve payment conflicts and review fraud flags across the platform. Efficiently mediate between athletes and trainers to maintain a safe ecosystem.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <div key={i} className={`bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[20px] p-6 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]`}>
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
                    <div className="relative w-full md:w-96 flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                        <input
                            type="text"
                            placeholder="Search disputes, tickets, athletes..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[#12141A] border border-white/5 rounded-full pl-12 pr-4 py-3.5 text-sm font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                        />
                    </div>

                    <div className="flex bg-[#12141A] border border-white/5 rounded-full p-1.5 w-full md:w-auto overflow-x-auto scrollbar-none">
                        {["PENDING", "RESOLVED", "ESCALATED"].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-full transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === tab ? "bg-primary text-bg shadow-[0_0_15px_rgba(163,255,18,0.3)]" : "text-text-main/50 hover:text-text-main hover:bg-white/5"
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
                                    <th className="px-6 py-5 pl-8">Dispute ID</th>
                                    <th className="px-6 py-5">Athlete</th>
                                    <th className="px-6 py-5">Trainer</th>
                                    <th className="px-6 py-5">Amount</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5 pr-8 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12">
                                            <Loader2 size={24} className="mx-auto animate-spin text-primary opacity-50 mb-2" />
                                            <p className="text-text-main/40 text-sm font-bold tracking-widest uppercase">Loading Disputes</p>
                                        </td>
                                    </tr>
                                ) : filteredDisputes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12">
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                                <FileText size={20} className="text-text-main/40" />
                                            </div>
                                            <p className="text-text-main font-bold">No disputes found</p>
                                            <p className="text-sm text-text-main/40">Try adjusting your filters or search query.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDisputes.map((d) => {
                                        const uiStatus = d.status === "under_review" ? "OPEN" : d.status === "escalated" ? "FLAGGED" : "RESOLVED";
                                        const dateStr = d.createdAt.toLocaleDateString();

                                        return (
                                            <tr
                                                key={d.id}
                                                onClick={() => setSelectedDispute(d)}
                                                className={`border-b border-white/5 last:border-0 cursor-pointer transition-all duration-200 group
                                                    ${selectedDispute?.id === d.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/5 border-l-2 border-l-transparent"}
                                                `}
                                            >
                                                <td className="px-6 py-5 pl-8">
                                                    <div className="flex flex-col">
                                                        <span className={`font-black text-sm tracking-wide ${selectedDispute?.id === d.id ? "text-primary" : "text-text-main group-hover:text-primary transition-colors"}`}>
                                                            {d.displayId}
                                                        </span>
                                                        <span className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider">{dateStr}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex-shrink-0 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs uppercase">
                                                            {d.athlete[0]}
                                                        </div>
                                                        <span className="font-bold text-text-main tracking-wide">{d.athlete}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex-shrink-0 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs uppercase">
                                                            {d.trainer[0]}
                                                        </div>
                                                        <span className="text-text-main/80 font-medium">{d.trainer}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="font-black text-base text-text-main tracking-tight">{d.amount}</span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                        uiStatus === "OPEN" ? "bg-primary/10 text-primary border-primary/20" :
                                                        uiStatus === "FLAGGED" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                        "bg-green-500/10 text-green-500 border-green-500/20"
                                                    }`}>
                                                        {uiStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 pr-8 text-right">
                                                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${selectedDispute?.id === d.id ? "bg-primary text-bg" : "bg-white/5 text-text-main/40 group-hover:bg-white/10 group-hover:text-text-main"}`}>
                                                        <ArrowRight size={16} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Right Column: Active Ticket Side Panel */}
            <div className="w-full xl:w-[480px] flex-shrink-0 flex flex-col h-fit sticky top-8">
                {selectedDispute ? (
                    <div className="bg-gradient-to-b from-surface to-[#12141A] border border-white/5 rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                        {/* Panel Header */}
                        <div className="p-8 pb-6 border-b border-white/5 relative">
                            <button
                                onClick={() => setSelectedDispute(null)}
                                className="absolute top-8 right-8 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={16} />
                            </button>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                                <div className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-md inline-block">
                                    Active Ticket Review
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-text-main tracking-tight mb-2">{selectedDispute.displayId}</h2>
                            <p className="text-text-main/40 text-xs font-bold tracking-wide uppercase">
                                Reported on {selectedDispute.createdAt.toLocaleDateString()}
                            </p>
                        </div>

                        {/* Panel Body */}
                        <div className="p-8 pt-6 flex-1 flex flex-col gap-8">
                            {/* Booking Details Box */}
                            <div className="bg-[#12141A] border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                                <FileText size={80} className="absolute -right-6 -top-6 text-white-[0.02] rotate-12 group-hover:scale-110 transition-transform duration-500" />

                                <div className="mb-6 relative z-10">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1.5 flex items-center gap-2">
                                        <FileText size={12} className="text-primary" /> Booking Reference
                                    </div>
                                    <div className="font-bold text-text-main tracking-wide bg-white/5 inline-block px-3 py-1 rounded-lg">{selectedDispute.displayBookingId}</div>
                                </div>

                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1.5">Service</div>
                                        <div className="font-semibold text-text-main/80 text-sm capitalize">{selectedDispute.sport} Session</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1.5">Total Paid</div>
                                        <div className="font-black text-text-main text-2xl tracking-tighter">{selectedDispute.amount}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Complaint Details */}
                            <div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-4 px-1">
                                    <MessageSquare size={12} className="text-primary" /> Complaint Details
                                </div>
                                <div className="bg-gradient-to-r from-primary/10 to-transparent border-l-2 border-primary p-6 rounded-r-2xl relative">
                                    <p className="font-medium text-text-main/90 text-sm leading-relaxed italic relative z-10">
                                        "{selectedDispute.reason}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Panel Footer Actions */}
                        <div className="p-8 pt-6 border-t border-white/5 bg-[#12141A]/50 flex flex-col gap-4">
                            {selectedDispute.status === "under_review" || selectedDispute.status === "escalated" ? (
                                <>
                                    <button
                                        onClick={() => handleAction('refund')}
                                        disabled={processing}
                                        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-bg font-black text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(163,255,18,0.3)] transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {processing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} strokeWidth={2.5} />}
                                        Process Full Refund
                                    </button>
                                    <div className="flex gap-4">
                                        <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-bold transition-all hover:bg-white/5 hover:border-white/10 hover:text-white">
                                            <MessageSquare size={16} /> Contact Parties
                                        </button>
                                        <button
                                            onClick={() => handleAction('resolve')}
                                            disabled={processing}
                                            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-bold transition-all hover:bg-white/5 hover:border-white/10 hover:text-white disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <CheckCircle size={16} /> Resolve Case
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-4 border border-green-500/20 bg-green-500/10 rounded-xl text-green-500 font-bold flex items-center justify-center gap-2">
                                    <CheckCircle size={18} /> Dispute has been resolved
                                </div>
                            )}
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
