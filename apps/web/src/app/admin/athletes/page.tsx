"use client";

import { useState, useEffect } from "react";
import { Plus, Search, ChevronDown, Users, Activity, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminAthletesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [athletes, setAthletes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAthletes = async () => {
            try {
                const { data } = await supabase.from("users").select("*").eq("role", "athlete");
                if (data) {
                    setAthletes(data.map(u => ({
                        id: u.id,
                        name: `${u.first_name} ${u.last_name}`,
                        email: u.email,
                        date: new Date(u.created_at).toLocaleDateString(),
                        status: "Active", // or check some suspension status if exists
                        sessions: 0, // could fetch from bookings, but 0 for now to keep it fast
                        initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`
                    })));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadAthletes();
    }, []);

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">All Athletes</h1>
                    <p className="text-sm font-medium text-text-main/60">Manage and monitor professional athlete performance across all disciplines.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all">
                        <Plus size={18} strokeWidth={3} /> Add Athlete
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Filter by name, email, or discipline..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm font-medium text-text-main focus:outline-none focus:border-gray-600 transition-colors"
                    />
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center justify-between gap-3 bg-surface border border-white/5 rounded-full px-5 py-3 text-sm font-bold text-text-main/80 w-40">
                        Status: All <ChevronDown size={14} />
                    </button>
                    <button className="flex items-center justify-between gap-3 bg-surface border border-white/5 rounded-full px-5 py-3 text-sm font-bold text-text-main/80 w-44">
                        Date Joined <ChevronDown size={14} />
                    </button>
                    <button className="flex items-center justify-between gap-3 bg-surface border border-white/5 rounded-full px-5 py-3 text-sm font-bold text-text-main/80 w-36">
                        Sessions <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-surface text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Joined Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Sessions</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface text-sm">
                            {athletes.map((a, i) => (
                                <tr key={a.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black flex-shrink-0 border border-primary/30 text-sm">
                                                {a.initials}
                                            </div>
                                            <div className="font-bold text-text-main tracking-wide">{a.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-text-main/60 font-medium text-sm">{a.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-text-main/80 font-bold text-sm tracking-wide">{a.date}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex border ${a.status === "Active"
                                            ? "border-primary text-primary"
                                            : "border-red-500/50 text-red-500 bg-red-500/10"
                                            }`}>
                                            {a.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-text-main font-black text-sm">{a.sessions}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="px-4 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 text-[10px] font-black uppercase tracking-widest transition-colors">
                                                View
                                            </button>
                                            {a.status === "Suspended" ? (
                                                <button className="px-4 py-1.5 rounded-full bg-primary text-bg text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_10px_rgba(163,255,18,0.3)] transition-all">
                                                    Activate
                                                </button>
                                            ) : (
                                                <button className="px-4 py-1.5 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-colors">
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
                <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                    <div className="text-xs font-bold text-text-main/40 tracking-wide">
                        Showing <span className="text-text-main">1</span> to <span className="text-text-main">5</span> of <span className="text-text-main">24</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-50">‹</button>
                        <button className="w-8 h-8 rounded-full bg-primary text-bg font-black shadow-[0_0_10px_rgba(163,255,18,0.3)]">1</button>
                        <button className="w-8 h-8 rounded-full text-text-main/60 font-bold hover:text-text-main">2</button>
                        <button className="w-8 h-8 rounded-full text-text-main/60 font-bold hover:text-text-main">3</button>
                        <button className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main">›</button>
                    </div>
                </div>
            </div>

            {/* Bottom Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-surface border border-white/5 rounded-[24px] p-6 relative overflow-hidden">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Users size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Total Athletes</div>
                    <div className="text-3xl font-black text-text-main">1,284</div>
                    <div className="absolute bottom-6 left-6 right-6 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 bg-primary w-[70%] rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>

                <div className="bg-surface border border-white/5 rounded-[24px] p-6 relative overflow-hidden">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Activity size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Total Sessions</div>
                    <div className="text-3xl font-black text-text-main">12,402</div>
                    <div className="absolute bottom-6 left-6 right-6 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 bg-primary w-[45%] rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>

                <div className="bg-surface border border-white/5 rounded-[24px] p-6 relative overflow-hidden">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Active Now</div>
                    <div className="text-3xl font-black text-text-main">412</div>
                    <div className="absolute bottom-6 left-6 right-6 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 bg-primary w-[25%] rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>
            </div>

        </div>
    );
}
