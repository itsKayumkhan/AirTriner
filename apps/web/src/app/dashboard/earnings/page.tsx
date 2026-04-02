"use client";

import { Wallet, Download, Clock, ShieldCheck, TrendingUp, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";

type PaymentTransaction = {
    id: string;
    booking_id: string;
    amount: number;
    platform_fee: number;
    trainer_payout: number;
    status: string;
    hold_until: string | null;
    created_at: string;
};

type UpcomingBooking = BookingRow & {
    payment_transaction?: PaymentTransaction | null;
    athlete_name?: string;
    trainer_name?: string;
};

export default function EarningsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [completedBookings, setCompletedBookings] = useState<BookingRow[]>([]);
    const [upcomingPaid, setUpcomingPaid] = useState<UpcomingBooking[]>([]);
    // Trainer-specific: released payment transactions
    const [releasedTransactions, setReleasedTransactions] = useState<PaymentTransaction[]>([]);
    // Trainer-specific: held transactions on completed bookings (awaiting admin release)
    const [heldCompletedTransactions, setHeldCompletedTransactions] = useState<PaymentTransaction[]>([]);
    // Athlete-specific: all payment transactions made by athlete
    const [athleteTransactions, setAthleteTransactions] = useState<(PaymentTransaction & { booking?: BookingRow; trainer_name?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (session) { setUser(session); loadEarnings(session); }
    }, []);

    const loadEarnings = async (u: AuthUser, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const column = u.role === "trainer" ? "trainer_id" : "athlete_id";

            // Completed bookings (for both roles — history)
            const { data: completed } = await supabase
                .from("bookings").select("*").eq(column, u.id)
                .eq("status", "completed").order("scheduled_at", { ascending: false });
            setCompletedBookings((completed || []) as BookingRow[]);

            if (u.role === "trainer") {
                // Trainer: fetch released transactions for completed bookings
                const completedBookingIds = (completed || []).map((b: BookingRow) => b.id);
                if (completedBookingIds.length) {
                    const { data: releasedTx } = await supabase
                        .from("payment_transactions")
                        .select("*")
                        .in("booking_id", completedBookingIds)
                        .eq("status", "released");
                    setReleasedTransactions((releasedTx || []) as PaymentTransaction[]);

                    const { data: heldTx } = await supabase
                        .from("payment_transactions")
                        .select("*")
                        .in("booking_id", completedBookingIds)
                        .eq("status", "held");
                    setHeldCompletedTransactions((heldTx || []) as PaymentTransaction[]);
                } else {
                    setReleasedTransactions([]);
                    setHeldCompletedTransactions([]);
                }

                // Trainer: upcoming confirmed with held payments
                const { data: confirmedBookings } = await supabase
                    .from("bookings").select("*").eq("trainer_id", u.id)
                    .eq("status", "confirmed").order("scheduled_at", { ascending: true });

                if (confirmedBookings?.length) {
                    const bookingIds = confirmedBookings.map((b: BookingRow) => b.id);
                    const { data: txData } = await supabase
                        .from("payment_transactions").select("*").in("booking_id", bookingIds).eq("status", "held");
                    const txMap = new Map((txData || []).map((t: PaymentTransaction) => [t.booking_id, t]));

                    const athleteIds = [...new Set(confirmedBookings.map((b: BookingRow) => b.athlete_id))];
                    const { data: athletes } = await supabase.from("users").select("id, first_name, last_name").in("id", athleteIds);
                    const athleteMap = new Map((athletes || []).map((a: any) => [a.id, `${a.first_name} ${a.last_name}`]));

                    setUpcomingPaid(
                        confirmedBookings.filter((b: BookingRow) => txMap.has(b.id)).map((b: BookingRow) => ({
                            ...b,
                            payment_transaction: txMap.get(b.id) || null,
                            athlete_name: athleteMap.get(b.athlete_id) as string || "Unknown",
                        })).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    );
                }
            } else {
                // Athlete: fetch ALL their bookings then get payment_transactions for those booking IDs
                const { data: allBookings } = await supabase
                    .from("bookings").select("*").eq("athlete_id", u.id).order("scheduled_at", { ascending: false });

                if (allBookings?.length) {
                    const bookingIds = allBookings.map((b: BookingRow) => b.id);
                    const { data: txData } = await supabase
                        .from("payment_transactions").select("*").in("booking_id", bookingIds).order("created_at", { ascending: false });

                    const bookingMap = new Map((allBookings as BookingRow[]).map((b) => [b.id, b]));
                    const trainerIds = [...new Set((allBookings as BookingRow[]).map((b) => b.trainer_id))];
                    const { data: trainers } = await supabase.from("users").select("id, first_name, last_name").in("id", trainerIds);
                    const trainerMap = new Map((trainers || []).map((t: any) => [t.id, `${t.first_name} ${t.last_name}`]));

                    setAthleteTransactions(
                        (txData || []).map((tx: PaymentTransaction) => ({
                            ...tx,
                            booking: bookingMap.get(tx.booking_id),
                            trainer_name: trainerMap.get(bookingMap.get(tx.booking_id)?.trainer_id || "") || "Unknown",
                        }))
                    );

                    // Upcoming confirmed paid (in escrow for athlete view)
                    const { data: confirmedPaid } = await supabase
                        .from("payment_transactions").select("*").in("booking_id", bookingIds).eq("status", "held");
                    const confirmedTxMap = new Map((confirmedPaid || []).map((t: PaymentTransaction) => [t.booking_id, t]));
                    const confirmedBookings = (allBookings as BookingRow[]).filter((b) => b.status === "confirmed" && confirmedTxMap.has(b.id));

                    setUpcomingPaid(
                        confirmedBookings.map((b) => ({
                            ...b,
                            payment_transaction: confirmedTxMap.get(b.id) || null,
                            trainer_name: trainerMap.get(b.trainer_id) || "Unknown",
                        })).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    );
                }
            }
        } catch (err) {
            console.error("Failed to load records:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const isTrainer = user?.role === "trainer";

    const downloadCSV = () => {
        // Build CSV rows from all payment transactions
        const headers = ['Date', 'Athlete', 'Sport', 'Duration (min)', 'Amount ($)', 'Platform Fee ($)', 'Net Payout ($)', 'Status']

        let rows: string[][]
        if (isTrainer) {
            rows = completedBookings.map((b) => [
                new Date(b.scheduled_at).toLocaleDateString(),
                '',
                b.sport.replace(/_/g, ' '),
                String(b.duration_minutes || 60),
                Number(b.price).toFixed(2),
                '0.00',
                Number(b.price).toFixed(2),
                'completed',
            ])
        } else {
            rows = athleteTransactions.map((t) => [
                new Date(t.created_at).toLocaleDateString(),
                t.trainer_name || '',
                (t.booking?.sport || '').replace(/_/g, ' '),
                String(t.booking?.duration_minutes || 60),
                Number(t.amount).toFixed(2),
                Number(t.platform_fee || 0).toFixed(2),
                Number(t.trainer_payout || (Number(t.amount) - Number(t.platform_fee || 0))).toFixed(2),
                t.status || 'completed',
            ])
        }

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `airtrainr-earnings-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Trainer stats — only count funds that have been released by admin
    // Coach gets full session fee — platform fee is charged to athlete separately
    const totalEarnings = releasedTransactions.reduce((s, t) => s + Number(t.trainer_payout), 0);
    const netEarnings = totalEarnings;
    // In Escrow: confirmed upcoming sessions + completed sessions awaiting admin release
    const pendingPayout = upcomingPaid.reduce((s, b) => s + Number(b.payment_transaction?.trainer_payout || 0), 0);
    const heldCompletedPayout = heldCompletedTransactions.reduce((s, t) => s + Number(t.trainer_payout), 0);
    const totalEscrow = pendingPayout + heldCompletedPayout;
    const totalEscrowSessions = upcomingPaid.length + heldCompletedTransactions.length;

    // Athlete stats (from payment_transactions)
    const athleteTotalPaid = athleteTransactions.filter((t) => t.status !== "refunded").reduce((s, t) => s + Number(t.amount), 0);
    const athleteRefunded = athleteTransactions.filter((t) => t.status === "refunded").reduce((s, t) => s + Number(t.amount), 0);
    const athleteInEscrow = athleteTransactions.filter((t) => t.status === "held").reduce((s, t) => s + Number(t.amount), 0);

    // Group by month (trainer: completed; athlete: from transactions)
    const monthlyData = new Map<string, { amount: number; sessions: number }>();
    if (isTrainer) {
        completedBookings.forEach((b) => {
            const month = new Date(b.scheduled_at).toLocaleString("en-US", { month: "short", year: "numeric" });
            const ex = monthlyData.get(month) || { amount: 0, sessions: 0 };
            monthlyData.set(month, { amount: ex.amount + Number(b.price), sessions: ex.sessions + 1 });
        });
    } else {
        athleteTransactions.filter((t) => t.status !== "refunded").forEach((t) => {
            const month = new Date(t.created_at).toLocaleString("en-US", { month: "short", year: "numeric" });
            const ex = monthlyData.get(month) || { amount: 0, sessions: 0 };
            monthlyData.set(month, { amount: ex.amount + Number(t.amount), sessions: ex.sessions + 1 });
        });
    }
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={downloadCSV}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 border border-white/10 text-white/70 text-xs font-bold hover:bg-white/10 hover:text-white transition-all"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                    <button
                        onClick={() => user && loadEarnings(user, true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#272A35] hover:bg-white/10 border border-white/5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                    >
                        <RotateCcw size={14} className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {isTrainer ? (
                <div className="grid gap-5 mb-8 grid-cols-2 md:grid-cols-4">
                    <div className="bg-surface rounded-2xl p-7 border border-white/5">
                        <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Total Earned</div>
                        <div className="text-3xl font-black font-display text-green-500">${totalEarnings.toFixed(2)}</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-7 border border-white/5">
                        <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Platform Fees</div>
                        <div className="text-3xl font-black font-display text-orange-500">-${totalFees.toFixed(2)}</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-7 border border-white/5">
                        <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Net Earnings</div>
                        <div className="text-3xl font-black font-display bg-primary bg-clip-text text-transparent">${netEarnings.toFixed(2)}</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-7 border border-white/5 border-l-2 border-l-yellow-500/50">
                        <div className="flex items-center gap-2 text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">
                            <Clock size={12} className="text-yellow-500" /> In Escrow
                        </div>
                        <div className="text-3xl font-black font-display text-yellow-400">${totalEscrow.toFixed(2)}</div>
                        <div className="text-[10px] text-text-main/40 mt-1 font-medium">{totalEscrowSessions} session{totalEscrowSessions !== 1 ? "s" : ""} pending</div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-5 mb-8 grid-cols-2 md:grid-cols-4">
                    <div className="bg-surface rounded-2xl p-7 border border-white/5">
                        <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Total Paid</div>
                        <div className="text-3xl font-black font-display text-green-500">${athleteTotalPaid.toFixed(2)}</div>
                        <div className="text-[10px] text-text-main/40 mt-1">{athleteTransactions.filter(t => t.status !== "refunded").length} payment{athleteTransactions.filter(t => t.status !== "refunded").length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-7 border border-white/5 border-l-2 border-l-yellow-500/50">
                        <div className="flex items-center gap-2 text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">
                            <Clock size={12} className="text-yellow-500" /> In Escrow
                        </div>
                        <div className="text-3xl font-black font-display text-yellow-400">${athleteInEscrow.toFixed(2)}</div>
                        <div className="text-[10px] text-text-main/40 mt-1">{upcomingPaid.length} upcoming session{upcomingPaid.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="bg-surface rounded-2xl p-7 border border-white/5">
                        <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Completed Sessions</div>
                        <div className="text-3xl font-black font-display">{completedBookings.length}</div>
                    </div>
                    {athleteRefunded > 0 && (
                        <div className="bg-surface rounded-2xl p-7 border border-white/5 border-l-2 border-l-blue-500/50">
                            <div className="text-xs text-text-main/50 mb-2 uppercase tracking-wider font-bold">Refunded</div>
                            <div className="text-3xl font-black font-display text-blue-400">${athleteRefunded.toFixed(2)}</div>
                            <div className="text-[10px] text-text-main/40 mt-1">{athleteTransactions.filter(t => t.status === "refunded").length} refund{athleteTransactions.filter(t => t.status === "refunded").length !== 1 ? "s" : ""}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Upcoming Payments in Escrow — trainer only */}
            {isTrainer && upcomingPaid.length > 0 && (
                <div className="bg-surface rounded-2xl border border-white/5 mb-8 overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
                        <ShieldCheck size={18} className="text-yellow-400" />
                        <div>
                            <h3 className="text-base font-bold font-display uppercase tracking-wider">Upcoming Payouts</h3>
                            <p className="text-xs text-text-main/50 font-medium mt-0.5">Funds held in escrow — released after session completes</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#272A35]">
                                    <th className="text-left px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Session Date</th>
                                    <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Athlete</th>
                                    <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Sport</th>
                                    <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Releases</th>
                                    <th className="text-right px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Your Payout</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcomingPaid.map((b) => {
                                    const sessionDate = new Date(b.scheduled_at);
                                    const isPast = sessionDate < new Date();
                                    const holdUntil = b.payment_transaction?.hold_until
                                        ? new Date(b.payment_transaction.hold_until)
                                        : null;

                                    return (
                                        <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-sm">{sessionDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                                                <div className="text-xs text-text-main/40 font-medium">{sessionDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                                            </td>
                                            <td className="px-4 py-4 font-medium whitespace-nowrap">{b.athlete_name}</td>
                                            <td className="px-4 py-4 font-medium capitalize whitespace-nowrap">{b.sport.replace(/_/g, " ")} · {b.duration_minutes}min</td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {holdUntil ? (
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isPast ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                                                        <Clock size={11} />
                                                        {isPast ? "Ready soon" : holdUntil.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                    </span>
                                                ) : (
                                                    <span className="text-text-main/40 text-xs">After session</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="font-black text-yellow-400">${Number(b.payment_transaction?.trainer_payout || 0).toFixed(2)}</div>
                                                <div className="text-[10px] text-text-main/40 font-medium">of ${Number(b.total_paid).toFixed(2)} paid</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 bg-yellow-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-yellow-400/80 font-medium">
                            <TrendingUp size={14} />
                            Complete sessions to release funds to your account
                        </div>
                        <div className="text-sm font-black text-yellow-400">Total: ${pendingPayout.toFixed(2)}</div>
                    </div>
                </div>
            )}

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
                                <div className="text-base font-black text-green-500">${data.amount.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Session History */}
            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5">
                    <h3 className="text-base font-bold font-display uppercase tracking-wider">
                        {isTrainer ? "Session History" : "Payment History"}
                    </h3>
                </div>

                {/* Trainer history */}
                {isTrainer && (
                    completedBookings.length === 0 ? (
                        <div className="p-12 text-center">
                            <Wallet className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1} />
                            <p className="text-text-main/50 font-medium">No completed sessions yet. Start accepting bookings!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#272A35]">
                                        <th className="text-left px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Date</th>
                                        <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Sport</th>
                                        <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Duration</th>
                                        <th className="text-right px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Amount</th>
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
                    )
                )}

                {/* Athlete history — from payment_transactions */}
                {!isTrainer && (
                    athleteTransactions.length === 0 ? (
                        <div className="p-12 text-center">
                            <Wallet className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1} />
                            <p className="text-text-main/50 font-medium">No payments yet. Book your first session!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#272A35]">
                                        <th className="text-left px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Date Paid</th>
                                        <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Trainer</th>
                                        <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Sport</th>
                                        <th className="text-left px-4 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Status</th>
                                        <th className="text-right px-6 py-3 font-bold text-text-main/40 text-[10px] uppercase tracking-widest">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {athleteTransactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-4 font-medium whitespace-nowrap">{tx.trainer_name}</td>
                                            <td className="px-4 py-4 font-medium capitalize whitespace-nowrap">
                                                {tx.booking?.sport?.replace(/_/g, " ") || "—"} · {tx.booking?.duration_minutes || "—"}min
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {tx.status === "held" && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-lg">
                                                        <Clock size={10} /> In Escrow
                                                    </span>
                                                )}
                                                {tx.status === "released" && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                                        <ShieldCheck size={10} /> Released
                                                    </span>
                                                )}
                                                {tx.status === "refunded" && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                                                        ↩ Refunded
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black whitespace-nowrap ${tx.status === "refunded" ? "text-blue-400 line-through opacity-60" : "text-green-500"}`}>
                                                ${Number(tx.amount).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
