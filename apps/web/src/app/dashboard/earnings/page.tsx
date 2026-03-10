"use client";

import { Wallet, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";

export default function EarningsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [completedBookings, setCompletedBookings] = useState<BookingRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadEarnings(session);
        }
    }, []);

    const loadEarnings = async (u: AuthUser) => {
        try {
            const column = u.role === "trainer" ? "trainer_id" : "athlete_id";
            const { data } = await supabase
                .from("bookings")
                .select("*")
                .eq(column, u.id)
                .eq("status", "completed")
                .order("scheduled_at", { ascending: false });

            setCompletedBookings((data || []) as BookingRow[]);
        } catch (err) {
            console.error("Failed to load records:", err);
        } finally {
            setLoading(false);
        }
    };

    const isTrainer = user?.role === "trainer";
    const totalEarnings = completedBookings.reduce((s, b) => s + Number(b.price), 0);
    const totalFees = completedBookings.reduce((s, b) => s + Number(b.platform_fee), 0);
    const netEarnings = totalEarnings - totalFees;

    const exportData = () => {
        alert("Exporting CSV data...");
    };

    // Group by month
    const monthlyData = new Map<string, { earnings: number; sessions: number }>();
    completedBookings.forEach((b) => {
        const month = new Date(b.scheduled_at).toLocaleString("en-US", { month: "short", year: "numeric" });
        const existing = monthlyData.get(month) || { earnings: 0, sessions: 0 };
        monthlyData.set(month, {
            earnings: existing.earnings + Number(b.price),
            sessions: existing.sessions + 1,
        });
    });

    const months = Array.from(monthlyData.entries());

    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">{isTrainer ? "Earnings" : "Payments"}</h1>
                    <p className="text-text-main/60 text-sm">{isTrainer ? "Track your income from completed sessions." : "Track your payments for completed sessions."}</p>
                </div>
                <button
                    onClick={exportData}
                    className="flex items-center gap-2 px-4 py-2 bg-[#272A35] hover:bg-white/10 border border-white/5 rounded-xl text-sm font-bold text-white transition-colors"
                >
                    <Download size={16} /> Export CSV
                </button>
            </div>

            {/* Summary Cards */}
            <div className={`grid gap-5 mb-8 ${isTrainer ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
                <div className="bg-surface rounded-2xl p-7 border border-white/5">
                    <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">{isTrainer ? "Total Earned" : "Total Spent"}</div>
                    <div className="text-3xl font-black font-display text-green-500">${totalEarnings.toFixed(2)}</div>
                </div>
                {isTrainer && (
                    <>
                        <div className="bg-surface rounded-2xl p-7 border border-white/5">
                            <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Platform Fees</div>
                            <div className="text-3xl font-black font-display text-orange-500">-${totalFees.toFixed(2)}</div>
                        </div>
                        <div className="bg-surface rounded-2xl p-7 border border-white/5">
                            <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Net Earnings</div>
                            <div className="text-3xl font-black font-display bg-primary bg-clip-text text-transparent">${netEarnings.toFixed(2)}</div>
                        </div>
                    </>
                )}
                <div className="bg-surface rounded-2xl p-7 border border-white/5">
                    <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Completed Sessions</div>
                    <div className="text-3xl font-black font-display">{completedBookings.length}</div>
                </div>
            </div>

            {/* Monthly Breakdown */}
            {months.length > 0 && (
                <div className="bg-surface rounded-2xl border border-white/5 mb-8 overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5">
                        <h3 className="text-base font-bold font-display uppercase tracking-wider">Monthly Breakdown</h3>
                    </div>
                    <div>
                        {months.map(([month, data], i) => (
                            <div key={month} className={`px-6 py-4 flex items-center justify-between ${i < months.length - 1 ? "border-b border-white/5" : ""}`}>
                                <div>
                                    <div className="font-bold text-sm mb-0.5">{month}</div>
                                    <div className="text-xs text-text-main/50 font-medium">{data.sessions} session{data.sessions !== 1 ? "s" : ""}</div>
                                </div>
                                <div className="text-base font-black text-green-500">${data.earnings.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5">
                    <h3 className="text-base font-bold font-display uppercase tracking-wider">Session History</h3>
                </div>
                {completedBookings.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wallet className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1} />
                        <p className="text-text-main/50 font-medium tracking-wide">No completed sessions yet. {isTrainer ? "Start accepting bookings!" : "Book your first session!"}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#272A35]">
                                    <th className="text-left px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest leading-none">Date</th>
                                    <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest leading-none">Sport</th>
                                    <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest leading-none">Duration</th>
                                    <th className="text-right px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest leading-none">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {completedBookings.map((b) => (
                                    <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium whitespace-nowrap">{new Date(b.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                                        <td className="px-4 py-4 font-medium capitalize whitespace-nowrap">{b.sport.replace(/_/g, " ")}</td>
                                        <td className="px-4 py-4 font-medium text-text-main/60 whitespace-nowrap">{b.duration_minutes} min</td>
                                        <td className="px-6 py-4 text-right font-black text-green-500 whitespace-nowrap">${Number(b.price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
