"use client";

import { useState } from "react";
import { Search, X, FileText, BarChart2, Image as ImageIcon, CheckCircle, RotateCcw, MessageSquare } from "lucide-react";

export default function AdminDisputesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("PENDING");

    const stats = [
        { title: "TOTAL DISPUTES", value: "142", icon: <BarChart2 size={16} /> },
        { title: "NEEDS ACTION", value: "28", highlight: "border-primary" },
        { title: "REFUNDED THIS WEEK", value: "$4,290", highlight: "border-white/5" },
        { title: "HIGH RISK FRAUD", value: "03", highlight: "border-red-500", highlightColor: "text-red-500" },
    ];

    const disputes = [
        { id: "#DIS-9021-X", athlete: "Alex Rivera", trainer: "Coach Sarah", amount: "$120.00", status: "OPEN" },
        { id: "#DIS-8842-Y", athlete: "Jordan Smith", trainer: "Mike Tyson", amount: "$250.00", status: "FLAGGED" },
        { id: "#DIS-8710-Z", athlete: "Emma Wilson", trainer: "Adriene Mishler", amount: "$85.00", status: "RESOLVED" },
        { id: "#DIS-8655-W", athlete: "Chris Pratt", trainer: "Trainer Joe", amount: "$150.00", status: "OPEN" },
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
                                {disputes.map((d, i) => (
                                    <tr
                                        key={d.id}
                                        className={`border-b border-white/5/50 hover:bg-white/5 cursor-pointer transition-colors ${i === 0 ? "bg-[#272A35]/50" : ""}`}
                                    >
                                        <td className="px-6 py-5">
                                            <span className={`font-black text-sm tracking-wide ${i === 0 ? "text-primary" : "text-text-main/60"}`}>
                                                {d.id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex-shrink-0 border border-[#2563eb]/20"></div>
                                                <span className="font-bold text-text-main tracking-wide">{d.athlete}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex-shrink-0 border border-[#2563eb]/20"></div>
                                                <span className="text-text-main/80 font-medium">{d.trainer}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-black text-base text-text-main">{d.amount}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${d.status === "OPEN" ? "bg-primary/10 text-primary border-primary/20" :
                                                    d.status === "FLAGGED" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                        "bg-[#272A35] text-text-main/60 border-gray-700"
                                                }`}>
                                                {d.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Right Column: Active Ticket Side Panel */}
            <div className="w-full lg:w-[450px] flex-shrink-0 bg-surface border border-white/5 rounded-[32px] overflow-hidden flex flex-col h-fit sticky top-8 shadow-2xl">

                {/* Panel Header */}
                <div className="p-8 pb-6 border-b border-white/5/50 relative">
                    <button className="absolute top-8 right-8 text-text-main/40 hover:text-text-main transition-colors">
                        <X size={20} />
                    </button>
                    <div className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-md inline-block mb-6">
                        Active Ticket
                    </div>
                    <h2 className="text-2xl font-black text-text-main tracking-tight mb-2">#DIS-9021-X</h2>
                    <p className="text-text-main/40 text-xs font-bold tracking-wide">Reported on Oct 24, 2023 • 14:32</p>
                </div>

                {/* Panel Body */}
                <div className="p-8 pt-6 flex-1 flex flex-col gap-8">

                    {/* Booking Details Box */}
                    <div className="bg-surface border border-white/5 rounded-[20px] p-5 relative overflow-hidden">
                        <FileText size={48} className="absolute -right-4 -top-4 text-gray-800/30 rotate-12" />

                        <div className="mb-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Booking Reference</div>
                            <div className="font-bold text-text-main tracking-wide">BK-7721-TRANS-88</div>
                        </div>

                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Service</div>
                                <div className="font-medium text-text-main/80 text-sm">1-on-1 HIIT Session</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-1">Total Paid</div>
                                <div className="font-black text-primary text-lg">$120.00</div>
                            </div>
                        </div>
                    </div>

                    {/* Complaint Details */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-4 px-2">Complaint Details</div>
                        <div className="bg-primary/5 border-l-2 border-primary p-5 rounded-r-xl relative">
                            <p className="font-medium text-text-main/80 text-sm leading-relaxed italic relative z-10">
                                "Trainer did not show up for the scheduled session. I waited for 30 minutes and tried contacting them via the app chat but received no response. I would like a full refund for this booking as the service was never rendered."
                            </p>
                        </div>
                    </div>

                    {/* Evidence */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-text-main/40 mb-4 px-2">Evidence Attachments</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="aspect-square bg-surface border border-white/5 rounded-2xl flex items-center justify-center cursor-pointer hover:border-gray-600 transition-colors group">
                                <ImageIcon size={28} className="text-gray-700 group-hover:text-text-main/60 transition-colors" />
                            </div>
                            <div className="aspect-[4/3] bg-surface border border-white/5 rounded-2xl flex items-center justify-center cursor-pointer hover:border-gray-600 transition-colors group">
                                <FileText size={28} className="text-gray-700 group-hover:text-text-main/60 transition-colors" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Panel Footer Actions */}
                <div className="p-8 pt-4 border-t border-white/5/50 bg-surface flex flex-col gap-3">
                    <button className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.25)] transition-all">
                        <RotateCcw size={18} strokeWidth={3} /> Full Refund
                    </button>
                    <div className="flex gap-3">
                        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-[#272A35] border border-gray-700 text-text-main/80 text-xs font-black uppercase tracking-widest hover:text-text-main hover:bg-[#272A35] transition-colors">
                            <MessageSquare size={16} /> Contact Parties
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-[#272A35] border border-gray-700 text-text-main/80 text-xs font-black uppercase tracking-widest hover:text-text-main hover:bg-[#272A35] transition-colors">
                            <CheckCircle size={16} /> Resolve Case
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
}
