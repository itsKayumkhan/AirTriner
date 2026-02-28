"use client";

import { Download, Wallet, Percent, TrendingUp, TrendingDown, Info, MoreHorizontal } from "lucide-react";

export default function AdminPaymentsPage() {
    const stats = [
        { title: "Total Platform Volume", value: "$1,240,500.00", req: "+12.5%", desc: "vs last month", icon: <Wallet size={24} />, isNegative: false },
        { title: "Commissions Earned", value: "$186,075.00", req: "+8.2%", desc: "vs last month", icon: <Percent size={24} />, isNegative: false },
        { title: "Pending Payouts", value: "$42,300.00", req: "-2.4%", desc: "from yesterday", icon: <TrendingDown size={24} />, isNegative: true },
    ];

    const transactions = [
        { id: "#TRX-942850", customer: "John Doe", initials: "JD", date: "Oct 24, 2023", amount: "$1,200.00", status: "Completed" },
        { id: "#TRX-942849", customer: "Sarah Chen", initials: "SC", date: "Oct 24, 2023", amount: "$450.00", status: "Completed" },
        { id: "#TRX-942848", customer: "Marcus Thorne", initials: "MT", date: "Oct 23, 2023", amount: "$85.00", status: "Pending" },
        { id: "#TRX-942847", customer: "Elena White", initials: "EW", date: "Oct 23, 2023", amount: "$250.00", status: "Completed" },
    ];

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Payments & Revenue</h1>
                    <p className="text-sm font-medium text-text-main/60">Real-time overview of platform volume and payout distribution.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all">
                        <Download size={18} strokeWidth={3} /> Export Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-surface border border-white/5 rounded-[24px] p-6 relative overflow-hidden group hover:border-gray-700 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-text-main/60 text-sm font-bold tracking-wide mb-1">{stat.title}</div>
                                <div className="text-3xl font-black text-text-main">{stat.value}</div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center text-gray-600 transition-colors group-hover:text-primary group-hover:bg-primary/10">
                                {stat.icon}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <span className={`px-2 py-1 rounded bg-[#272A35] text-xs font-black tracking-widest flex items-center gap-1 ${stat.isNegative ? "text-red-500" : "text-primary"}`}>
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
                <div className="lg:col-span-2 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-black text-text-main">Revenue Trends</h2>
                            <p className="text-sm text-text-main/60 font-medium">Monthly performance analytics</p>
                        </div>
                        <select className="bg-surface border border-white/5 rounded-full px-4 py-2 text-xs font-bold text-text-main/80 focus:outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors">
                            <option>Last 6 Months</option>
                            <option>Last 12 Months</option>
                            <option>This Year</option>
                        </select>
                    </div>
                    {/* Bar Chart Simulation */}
                    <div className="flex-1 min-h-[200px] flex items-end justify-between gap-3 mt-4 border-b border-white/5/50 pb-4">
                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN"].map((month, i) => {
                            const heights = [30, 50, 100, 45, 60, 75];
                            const isHigh = i === 2; // MAR
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-4 group h-full">
                                    <div className="w-full flex-1 flex items-end justify-center">
                                        <div
                                            style={{ height: `${heights[i]}%` }}
                                            className={`w-full max-w-[48px] rounded-t-xl transition-all duration-500 ease-out group-hover:bg-primary/80 ${isHigh ? "bg-primary shadow-[0_0_15px_rgba(163,255,18,0.25)]" : "bg-[#272A35]"}`}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-text-main/40 tracking-widest">{month}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Payout Distribution */}
                <div className="lg:col-span-1 bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <h2 className="text-lg font-black text-text-main mb-6">Payout Distribution</h2>

                    <div className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold">Subscription Fees</span>
                                <span className="text-text-main font-black">65%</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(163,255,18,0.3)] w-[65%]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold">Marketplace Commission</span>
                                <span className="text-text-main font-black">20%</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#1e3a8a] rounded-full w-[20%]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-text-main/80 text-sm font-bold">Direct Payouts</span>
                                <span className="text-text-main font-black">15%</span>
                            </div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-[#3f6212] rounded-full w-[15%]"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 bg-surface border border-white/5 rounded-xl p-4 flex gap-3 text-sm">
                        <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-text-main/60 font-medium leading-relaxed">
                            Automatic payouts are processed every Friday at 12:00 PM UTC.
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-surface border border-white/5 rounded-[24px] p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-text-main">Recent Transactions</h2>
                    <button className="text-primary text-xs font-black uppercase tracking-widest hover:text-text-main transition-colors">
                        View All
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="pb-4 font-black">Transaction ID</th>
                                <th className="pb-4 font-black">Customer</th>
                                <th className="pb-4 font-black">Date</th>
                                <th className="pb-4 font-black">Amount</th>
                                <th className="pb-4 font-black">Status</th>
                                <th className="pb-4 font-black text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {transactions.map((t, i) => (
                                <tr key={i} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="py-4 font-medium text-text-main/60">{t.id}</td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#272A35] text-text-main/80 flex items-center justify-center font-bold text-xs border border-gray-700">
                                                {t.initials}
                                            </div>
                                            <span className="font-bold text-text-main tracking-wide">{t.customer}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 text-text-main/60 font-medium">{t.date}</td>
                                    <td className="py-4 font-black text-text-main text-base">{t.amount}</td>
                                    <td className="py-4">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${t.status === "Completed"
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : "bg-[#272A35] text-text-main/80 border-gray-700"
                                            }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <button className="text-text-main/40 hover:text-text-main transition-colors">
                                            <MoreHorizontal size={20} />
                                        </button>
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
