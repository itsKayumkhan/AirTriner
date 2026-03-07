"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Wallet, Percent, TrendingUp, TrendingDown, Info, MoreHorizontal, ArrowUpRight, CheckCircle, Clock } from "lucide-react";

export default function AdminPaymentsPage() {
    const stats = [
        { title: "Total Platform Volume", value: "$1,240,500.00", req: "+12.5%", desc: "vs last month", icon: <Wallet size={20} />, isNegative: false },
        { title: "Commissions Earned", value: "$186,075.00", req: "+8.2%", desc: "vs last month", icon: <Percent size={20} />, isNegative: false },
        { title: "Pending Payouts", value: "$42,300.00", req: "-2.4%", desc: "from yesterday", icon: <TrendingDown size={20} />, isNegative: true },
    ];

    const transactions = [
        { id: "#TRX-942850", customer: "John Doe", initials: "JD", date: "Oct 24, 2023", amount: "$1,200.00", status: "Completed", method: "Stripe", bank: "**** 4920" },
        { id: "#TRX-942849", customer: "Sarah Chen", initials: "SC", date: "Oct 24, 2023", amount: "$450.00", status: "Completed", method: "PayPal", bank: "s.chen@mail.com" },
        { id: "#TRX-942848", customer: "Marcus Thorne", initials: "MT", date: "Oct 23, 2023", amount: "$85.00", status: "Pending", method: "Stripe", bank: "**** 1198" },
        { id: "#TRX-942847", customer: "Elena White", initials: "EW", date: "Oct 23, 2023", amount: "$250.00", status: "Completed", method: "Bank Transfer", bank: "CHASE **** 8832" },
    ];

    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    // Handle outside click for action menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActionMenuOpen(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="space-y-8 max-w-[1600px] w-full">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                        <span className="text-text-main">Payments &</span>
                        <span className="text-primary border-b-4 border-primary pb-1">Revenue</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                        Real-time overview of platform volume, transaction history, and payout distribution.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button type="button" onClick={() => alert("Report generation started...")} className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-surface/80 border border-white/10 text-text-main hover:bg-white/5 font-black text-sm uppercase tracking-widest hover:border-primary/50 transition-all w-full md:w-auto">
                        <Download size={18} strokeWidth={3} /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-gradient-to-br from-surface to-[#12141A] border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                        <div className={`absolute top-0 bottom-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5 ${stat.isNegative ? "bg-red-500 border-red-500" : "bg-primary border-primary"}`}></div>
                        
                        <div className="flex justify-between items-start mb-6">
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-main/40 leading-tight">{stat.title}</span>
                            <div className={`p-2.5 rounded-xl transition-colors ${stat.isNegative ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black text-text-main tracking-tighter mb-4">{stat.value}</div>
                        
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest flex items-center gap-1 ${stat.isNegative ? "text-red-500 bg-red-500/10 border border-red-500/20" : "text-green-500 bg-green-500/10 border border-green-500/20"}`}>
                                {stat.isNegative ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                {stat.req}
                            </span>
                            <span className="text-text-main/40 text-xs font-medium">{stat.desc}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Trends */}
                <div className="lg:col-span-2 bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 flex flex-col shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-xl font-black text-text-main uppercase tracking-widest">Revenue Trends</h2>
                            <p className="text-xs font-medium text-text-main/40 mt-1 uppercase tracking-wider">Monthly performance analytics</p>
                        </div>
                        <select className="bg-[#12141A] border border-white/10 rounded-xl px-4 py-2 text-xs font-black text-text-main/80 focus:outline-none focus:border-primary/50 appearance-none cursor-pointer transition-colors shadow-inner">
                            <option>Last 6 Months</option>
                            <option>Last 12 Months</option>
                            <option>This Year</option>
                        </select>
                    </div>
                    {/* Bar Chart Simulation */}
                    <div className="flex-1 min-h-[240px] flex items-end justify-between gap-3 mt-4 border-b border-white/5 pb-4">
                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN"].map((month, i) => {
                            const heights = [30, 50, 100, 45, 60, 75];
                            const isHigh = i === 2; // MAR
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-4 group h-full relative cursor-pointer">
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                                    <div className="w-full flex-1 flex items-end justify-center z-10">
                                        <div
                                            style={{ height: `${heights[i]}%` }}
                                            className={`w-full max-w-[64px] rounded-t-xl transition-all duration-500 ease-out 
                                                ${isHigh ? "bg-gradient-to-t from-primary/50 to-primary shadow-[0_0_20px_rgba(163,255,18,0.3)]" : "bg-gradient-to-t from-white/5 to-white/10 group-hover:from-white/10 group-hover:to-white/20"}
                                            `}
                                        ></div>
                                    </div>
                                    <span className={`text-[10px] font-black tracking-widest transition-colors ${isHigh ? 'text-primary' : 'text-text-main/40 group-hover:text-text-main'}`}>{month}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Payout Distribution */}
                <div className="lg:col-span-1 bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 flex flex-col shadow-2xl relative overflow-hidden">
                    <h2 className="text-xl font-black text-text-main uppercase tracking-widest mb-8">Payout Distro</h2>

                    <div className="space-y-8 flex-1">
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/60 text-xs font-bold uppercase tracking-wider">Subscription Fees</span>
                                <span className="text-text-main font-black text-xl leading-none">65%</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(163,255,18,0.5)] w-[65%]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/60 text-xs font-bold uppercase tracking-wider">Marketplace Comms</span>
                                <span className="text-text-main font-black text-xl leading-none">20%</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-blue-500 rounded-full w-[20%] shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-text-main/60 text-xs font-bold uppercase tracking-wider">Direct Payouts</span>
                                <span className="text-text-main font-black text-xl leading-none">15%</span>
                            </div>
                            <div className="h-3 bg-[#12141A] rounded-full overflow-hidden border border-white/5 shadow-inner flex">
                                <div className="h-full bg-green-500 rounded-full w-[15%] shadow-[0_0_15px_rgba(34,197,94,0.3)]"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4 text-sm relative overflow-hidden">
                        <div className="w-1 bg-primary absolute top-0 bottom-0 left-0"></div>
                        <Info size={20} className="text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-text-main/80 font-medium leading-relaxed text-xs">
                            Automatic payouts are processed every <span className="text-primary font-bold">Friday at 12:00 PM UTC</span>. Manage settings via Stripe dashboard.
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-gradient-to-b from-surface to-surface/50 border border-white/5 rounded-[24px] overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-8 pb-4">
                    <h2 className="text-xl font-black text-text-main uppercase tracking-widest">Recent Ledgers</h2>
                    <button type="button" onClick={() => alert("Database view coming soon!")} className="flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                        View Database <ArrowUpRight size={14} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40 bg-white/5">
                                <th className="px-6 py-5 pl-8">Txn Ref</th>
                                <th className="px-6 py-5">End User</th>
                                <th className="px-6 py-5">Processed Date</th>
                                <th className="px-6 py-5">Payout Method</th>
                                <th className="px-6 py-5">Amount (USD)</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 pr-8 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {transactions.map((t, i) => (
                                <tr key={i} className="border-b border-white/5/50 hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5 pl-8">
                                        <div className="flex items-center gap-2 text-text-main/60 font-black text-xs tracking-wider uppercase">
                                            {t.id}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/5 text-text-main flex items-center justify-center font-black text-xs border border-white/10 flex-shrink-0">
                                                {t.initials}
                                            </div>
                                            <span className="font-bold text-text-main tracking-wide group-hover:text-primary transition-colors cursor-pointer">{t.customer}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-text-main/60 font-medium">{t.date}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-text-main font-bold text-sm">{t.method}</span>
                                            <span className="text-text-main/40 text-[10px] font-black uppercase tracking-widest mt-0.5">{t.bank}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 font-black text-text-main text-base tracking-tighter">{t.amount}</td>
                                    <td className="px-6 py-5">
                                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest inline-flex ${t.status === "Completed"
                                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                : "bg-[#272A35] text-text-main/80 border-gray-700"
                                            }`}>
                                            {t.status === 'Completed' ? <CheckCircle size={12}/> : <Clock size={12}/>}
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 pr-8 text-right relative">
                                        <button 
                                            type="button" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActionMenuOpen(actionMenuOpen === t.id ? null : t.id);
                                            }}
                                            className={`w-8 h-8 rounded-full flex justify-center items-center ml-auto transition-all outline-none ${actionMenuOpen === t.id ? 'bg-primary/20 text-primary' : 'text-text-main/40 hover:text-text-main hover:bg-white/5'}`}
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>

                                        {actionMenuOpen === t.id && (
                                            <div ref={actionMenuRef} className="absolute right-8 top-12 z-[100] w-48 bg-[#1A1D24] border border-white/10 rounded-2xl shadow-2xl py-2 flex flex-col overflow-hidden text-left origin-top-right animate-in fade-in zoom-in-95 duration-200">
                                                <button 
                                                    type="button"
                                                    onClick={() => { alert(`Downloading receipt for ${t.id}`); setActionMenuOpen(null); }}
                                                    className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-text-main hover:bg-white/5 transition-colors"
                                                >
                                                    <Download size={14} /> Download Receipt
                                                </button>
                                                {t.status === "Pending" && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => { alert(`Processing payout for ${t.id}`); setActionMenuOpen(null); }}
                                                        className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-text-main hover:bg-white/5 transition-colors"
                                                    >
                                                        <CheckCircle size={14} className="text-green-500" /> Process Payout
                                                    </button>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => { alert(`Refunding transaction ${t.id}`); setActionMenuOpen(null); }}
                                                    className="flex items-center gap-3 w-full px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors border-t border-white/5 mt-1 pt-3"
                                                >
                                                    <Clock size={14} /> Refund Transaction
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
