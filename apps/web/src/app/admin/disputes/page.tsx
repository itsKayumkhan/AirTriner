"use client";

import { useEffect, useState } from "react";
import { Search, X, FileText, BarChart2, Image as ImageIcon, CheckCircle, RotateCcw, MessageSquare, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type UserBasic = { id: string; first_name: string; last_name: string };
type BookingBasic = { id: string; athlete_id: string; trainer_id: string; total_paid: number; sport: string };
type DisputeData = {
    id: string;
    booking_id: string;
    reason: string;
    status: "under_review" | "resolved" | "escalated";
    created_at: string;
};

type JoinedDispute = DisputeData & {
    booking?: BookingBasic;
    athlete?: UserBasic;
    trainer?: UserBasic;
};

export default function AdminDisputesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("PENDING");
    const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>("#DIS-9021-X");
    
    // Dummy Data for testing
    const [disputes, setDisputes] = useState<JoinedDispute[]>([
        {
            id: "#DIS-9021-X",
            booking_id: "BK-7721-TRANS-88",
            reason: "Trainer did not show up for the scheduled session. I waited for 30 minutes and tried contacting them via the app chat but received no response. I would like a full refund for this booking as the service was never rendered.",
            status: "under_review",
            created_at: "2023-10-24T14:32:00Z",
            booking: { id: "BK-7721-TRANS-88", athlete_id: "a1", trainer_id: "t1", total_paid: 120.00, sport: "1-on-1 HIIT Session" },
            athlete: { id: "a1", first_name: "Alex", last_name: "Rivera" },
            trainer: { id: "t1", first_name: "Coach", last_name: "Sarah" }
        },
        {
            id: "#DIS-8842-Y",
            booking_id: "BK-2244-TRANS-12",
            reason: "The trainer was extremely unprofessional and arrived 40 minutes late.",
            status: "escalated",
            created_at: "2023-10-23T10:15:00Z",
            booking: { id: "BK-2244-TRANS-12", athlete_id: "a2", trainer_id: "t2", total_paid: 250.00, sport: "Boxing" },
            athlete: { id: "a2", first_name: "Jordan", last_name: "Smith" },
            trainer: { id: "t2", first_name: "Mike", last_name: "Tyson" }
        },
        {
            id: "#DIS-8710-Z",
            booking_id: "BK-1122-TRANS-99",
            reason: "Session was cancelled but I was still charged.",
            status: "resolved",
            created_at: "2023-10-21T09:00:00Z",
            booking: { id: "BK-1122-TRANS-99", athlete_id: "a3", trainer_id: "t3", total_paid: 85.00, sport: "Yoga" },
            athlete: { id: "a3", first_name: "Emma", last_name: "Wilson" },
            trainer: { id: "t3", first_name: "Adriene", last_name: "Mishler" }
        },
        {
            id: "#DIS-8655-W",
            booking_id: "BK-9988-TRANS-44",
            reason: "Facility was closed when we arrived.",
            status: "under_review",
            created_at: "2023-10-20T16:45:00Z",
            booking: { id: "BK-9988-TRANS-44", athlete_id: "a4", trainer_id: "t4", total_paid: 150.00, sport: "Weightlifting" },
            athlete: { id: "a4", first_name: "Chris", last_name: "Pratt" },
            trainer: { id: "t4", first_name: "Trainer", last_name: "Joe" }
        }
    ]);
    const loading = false;

    useEffect(() => {
        // Dummy load effect
    }, []);

    const processRefund = async (disputeId: string, bookingId?: string) => {
        if (!bookingId) return;
        if (!confirm("Are you sure you want to process a full refund for this booking? (Dummy action)")) return;
        
        // Dummy update local state
        setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: "resolved" } : d));
        setSelectedDisputeId(null);
        alert("Refund processed successfully. (Dummy)");
    };

    const resolveCase = async (disputeId: string) => {
        if (!confirm("Are you sure you want to resolve this case without further action? (Dummy action)")) return;
        
        // Dummy update local state
        setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: "resolved" } : d));
        setSelectedDisputeId(null);
    };

    const pendingDisputes = disputes.filter(d => d.status === "under_review");
    const resolvedDisputes = disputes.filter(d => d.status === "resolved");
    const escalatedDisputes = disputes.filter(d => d.status === "escalated");

    const totalCount = 142; // Dummy stat value
    const actionCount = pendingDisputes.length;
    const refundedAllTime = 4290; // Dummy stat value
    const highRiskCount = 3; // Dummy stat value

    const stats = [
        { title: "TOTAL DISPUTES", value: totalCount, icon: <BarChart2 size={18} />, highlight: "border-white/10" },
        { title: "NEEDS ACTION", value: actionCount > 0 ? actionCount : "28", icon: <AlertTriangle size={18} />, highlight: "border-primary", highlightColor: "text-primary" },
        { title: "REFUNDED THIS WEEK", value: `$${refundedAllTime.toLocaleString()}`, icon: <RotateCcw size={18} />, highlight: "border-white/10" },
        { title: "HIGH RISK FRAUD", value: `0${highRiskCount}`, icon: <ShieldAlert size={18} />, highlight: "border-red-500", highlightColor: "text-red-500" },
    ];

    const filteredDisputes = disputes.filter(d => {
        const matchesStatus = activeTab === "PENDING" ? d.status === "under_review" : 
                              activeTab === "RESOLVED" ? d.status === "resolved" : 
                              d.status === "escalated";
        
        const searchLow = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
                               d.id.toLowerCase().includes(searchLow) || 
                               (d.athlete && `${d.athlete.first_name} ${d.athlete.last_name}`.toLowerCase().includes(searchLow)) ||
                               (d.trainer && `${d.trainer.first_name} ${d.trainer.last_name}`.toLowerCase().includes(searchLow));

        return matchesStatus && matchesSearch;
    });

    const activeDispute = disputes.find(d => d.id === selectedDisputeId);

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
                                    <tr><td colSpan={6} className="text-center py-10 text-text-main/60">Loading disputes...</td></tr>
                                ) : filteredDisputes.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10 text-text-main/60">No disputes found for this status.</td></tr>
                                ) : (
                                filteredDisputes.map((d) => {
                                    const athleteName = d.athlete ? `${d.athlete.first_name} ${d.athlete.last_name}` : "Unknown Athlete";
                                    const trainerName = d.trainer ? `${d.trainer.first_name} ${d.trainer.last_name}` : "Unknown Trainer";
                                    const uiStatus = d.status === "under_review" ? "OPEN" : d.status === "escalated" ? "FLAGGED" : "RESOLVED";
                                    const dateStr = new Date(d.created_at).toLocaleDateString();

                                    return (
                                    <tr
                                        key={d.id}
                                        onClick={() => setSelectedDisputeId(d.id)}
                                        className={`border-b border-white/5 last:border-0 cursor-pointer transition-all duration-200 group
                                            ${selectedDisputeId === d.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/5 border-l-2 border-l-transparent"}
                                        `}
                                    >
                                        <td className="px-6 py-5 pl-8">
                                            <div className="flex flex-col">
                                                <span className={`font-black text-sm tracking-wide ${selectedDisputeId === d.id ? "text-primary" : "text-text-main group-hover:text-primary transition-colors"}`}>
                                                    {d.id.substring(0, 12)}...
                                                </span>
                                                <span className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider">{dateStr}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex-shrink-0 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs uppercase">
                                                    {athleteName.charAt(0)}
                                                </div>
                                                <span className="font-bold text-text-main tracking-wide">{athleteName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex-shrink-0 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs uppercase">
                                                    {trainerName.charAt(0)}
                                                </div>
                                                <span className="text-text-main/80 font-medium">{trainerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="font-black text-base text-text-main tracking-tight">${Number(d.booking?.total_paid || 0).toFixed(2)}</span>
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
                                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${selectedDisputeId === d.id ? "bg-primary text-bg" : "bg-white/5 text-text-main/40 group-hover:bg-white/10 group-hover:text-text-main"}`}>
                                                <ArrowRight size={16} />
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                }))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Right Column: Active Ticket Side Panel */}
            <div className={`w-full xl:w-[480px] flex-shrink-0 bg-gradient-to-b from-surface to-[#12141A] border border-white/5 rounded-[32px] overflow-hidden flex flex-col h-fit sticky top-8 shadow-2xl transition-all duration-500 ${activeDispute ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none hidden xl:flex"}`}>

                {activeDispute && (
                    <>
                        {/* Panel Header */}
                        <div className="p-8 pb-6 border-b border-white/5 relative bg-[url('/noise.png')] bg-cover">
                            <button 
                                onClick={() => setSelectedDisputeId(null)}
                                className="absolute top-8 right-8 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={16} />
                            </button>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                                <div className="text-primary text-[10px] font-black tracking-widest uppercase">
                                    Active Ticket Review
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-text-main tracking-tighter mb-2">{activeDispute.id.substring(0, 16)}...</h2>
                            <p className="text-text-main/40 text-xs font-bold tracking-wide uppercase">Reported on {new Date(activeDispute.created_at).toLocaleDateString()}</p>
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
                                    <div className="font-bold text-text-main tracking-wide bg-white/5 inline-block px-3 py-1 rounded-lg">{activeDispute.booking?.id?.substring(0, 12)}...</div>
                                </div>

                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1.5">Service</div>
                                        <div className="font-semibold text-text-main/80 text-sm capitalize">{activeDispute.booking?.sport || "General Session"}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1.5">Total Paid</div>
                                        <div className="font-black text-text-main text-2xl tracking-tighter">${Number(activeDispute.booking?.total_paid || 0).toFixed(2)}</div>
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
                                        "{activeDispute.reason}"
                                    </p>
                                </div>
                            </div>

                        </div>

                        {/* Panel Footer Actions */}
                        <div className="p-8 pt-6 border-t border-white/5 bg-[#12141A]/50 flex flex-col gap-4">
                            {activeDispute.status === "under_review" || activeDispute.status === "escalated" ? (
                                <>
                                    <button onClick={() => processRefund(activeDispute.id, activeDispute.booking?.id)} className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-bg font-black text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(163,255,18,0.3)] transition-all">
                                        <RotateCcw size={18} strokeWidth={2.5} /> Process Full Refund
                                    </button>
                                    <div className="flex gap-4">
                                        <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-bold transition-all hover:bg-white/5 hover:border-white/10 hover:text-white">
                                            <MessageSquare size={16} /> Contact Parties
                                        </button>
                                        <button onClick={() => resolveCase(activeDispute.id)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface border border-white/5 text-text-main/80 text-xs font-bold transition-all hover:bg-white/5 hover:border-white/10 hover:text-white">
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
                    </>
                )}
            </div>

        </div>
    );
}
