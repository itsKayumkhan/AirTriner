"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle, AlertTriangle, XCircle, RefreshCw, ShieldQuestion } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

type ReconcileResponse = {
    booking: { id: string; status: string; price: number; total_paid: number; scheduled_at: string };
    db: null | {
        txId: string;
        status: string;
        amount: number;
        stripePaymentIntentId: string | null;
        stripeTransferId: string | null;
        releasedAt: string | null;
    };
    stripe: null | {
        sessionId: string;
        paymentStatus: string;
        paymentIntentId: string | null;
        amountTotal: number | null;
        currency: string | null;
        customerEmail: string | null;
        metadata: Record<string, string> | null;
        paymentIntentStatus: string | null;
        paymentIntentLatestCharge: string | null;
    };
    diagnosis: string;
    sync: { performed: boolean; reason?: string; createdTxId?: string };
};

const DIAGNOSIS_META: Record<string, { color: string; label: string; explain: string }> = {
    in_sync: { color: "emerald", label: "In sync", explain: "Stripe and DB agree — payment recorded correctly." },
    paid_in_stripe_missing_in_db: {
        color: "red",
        label: "Paid in Stripe, missing in DB",
        explain: "Athlete paid but no payment_transactions row exists. Click Sync to backfill.",
    },
    paid_in_stripe_db_status_mismatch: {
        color: "amber",
        label: "Status mismatch",
        explain: "Stripe says paid, DB has the row but with an unexpected status.",
    },
    unpaid_in_stripe_but_db_has_tx: {
        color: "amber",
        label: "DB has tx, Stripe shows unpaid",
        explain: "Suspicious — investigate manually before any action.",
    },
    no_stripe_session_found: {
        color: "zinc",
        label: "No Stripe session",
        explain: "No Stripe Checkout session is tagged with this bookingId. Athlete may not have started payment.",
    },
    unpaid: { color: "zinc", label: "Unpaid", explain: "Athlete has not paid yet." },
};

export default function AdminReconcilePage() {
    const [bookingId, setBookingId] = useState("");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<ReconcileResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const lookup = async (sync = false) => {
        if (!bookingId.trim()) return;
        setLoading(!sync);
        setSyncing(sync);
        setError(null);
        try {
            const res = await adminFetch("/api/admin/reconcile-booking-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: bookingId.trim(), sync }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Lookup failed");
            setResult(data);
        } catch (err: any) {
            setError(err.message || "Failed");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    const meta = result ? DIAGNOSIS_META[result.diagnosis] : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShieldQuestion size={20} className="text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-text-main">Payment Reconciliation</h1>
                    <p className="text-text-main/50 text-sm font-medium">
                        Look up a booking against Stripe and fix DB drift if Stripe charged but the platform didn't record it.
                    </p>
                </div>
            </div>

            <div className="bg-surface border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/30" />
                    <input
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                        placeholder="Booking ID (uuid)..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg border border-white/5 text-sm font-mono text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/30"
                        onKeyDown={(e) => { if (e.key === "Enter") lookup(false); }}
                    />
                </div>
                <button
                    onClick={() => lookup(false)}
                    disabled={!bookingId.trim() || loading}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 disabled:opacity-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Look up
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2 text-red-300 text-sm">
                    <XCircle size={16} /> {error}
                </div>
            )}

            {result && meta && (
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-5">
                    {/* Diagnosis banner */}
                    <div className={`flex items-start gap-3 p-4 rounded-xl border bg-${meta.color}-500/5 border-${meta.color}-500/25`}>
                        {result.diagnosis === "in_sync" ? (
                            <CheckCircle size={20} className="text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                            <AlertTriangle size={20} className={`text-${meta.color}-400 mt-0.5 shrink-0`} />
                        )}
                        <div>
                            <p className={`text-${meta.color}-300 text-sm font-black uppercase tracking-wider`}>{meta.label}</p>
                            <p className="text-text-main/70 text-sm mt-1">{meta.explain}</p>
                        </div>
                    </div>

                    {/* Sync button */}
                    {result.diagnosis === "paid_in_stripe_missing_in_db" && !result.sync.performed && (
                        <button
                            onClick={() => lookup(true)}
                            disabled={syncing}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs font-black uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Sync DB from Stripe
                        </button>
                    )}
                    {result.sync.performed && (
                        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-emerald-300 text-sm">
                            ✓ Synced. New transaction id: <code className="font-mono">{result.sync.createdTxId}</code>
                        </div>
                    )}
                    {result.sync.reason && !result.sync.performed && (
                        <div className="text-text-main/50 text-xs">{result.sync.reason}</div>
                    )}

                    {/* DB / Stripe side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-bg border border-white/5 rounded-xl p-4">
                            <h3 className="text-text-main/40 text-[10px] font-black uppercase tracking-wider mb-3">AirTrainr DB</h3>
                            <KV label="Booking" value={result.booking.id} mono />
                            <KV label="Status" value={result.booking.status} />
                            <KV label="Price" value={`$${Number(result.booking.price).toFixed(2)}`} />
                            <KV label="Total paid" value={`$${Number(result.booking.total_paid || 0).toFixed(2)}`} />
                            <div className="h-px bg-white/5 my-3" />
                            {result.db ? (
                                <>
                                    <KV label="Tx ID" value={result.db.txId} mono />
                                    <KV label="Tx status" value={result.db.status} />
                                    <KV label="Amount" value={`$${Number(result.db.amount).toFixed(2)}`} />
                                    <KV label="PI ID" value={result.db.stripePaymentIntentId || "—"} mono />
                                    <KV label="Transfer ID" value={result.db.stripeTransferId || "—"} mono />
                                    <KV label="Released at" value={result.db.releasedAt || "—"} />
                                </>
                            ) : (
                                <p className="text-text-main/40 text-xs italic">No payment_transactions row</p>
                            )}
                        </div>
                        <div className="bg-bg border border-white/5 rounded-xl p-4">
                            <h3 className="text-text-main/40 text-[10px] font-black uppercase tracking-wider mb-3">Stripe</h3>
                            {result.stripe ? (
                                <>
                                    <KV label="Session ID" value={result.stripe.sessionId} mono />
                                    <KV label="Payment status" value={result.stripe.paymentStatus} />
                                    <KV label="PI ID" value={result.stripe.paymentIntentId || "—"} mono />
                                    <KV label="PI status" value={result.stripe.paymentIntentStatus || "—"} />
                                    <KV label="Latest charge" value={result.stripe.paymentIntentLatestCharge || "—"} mono />
                                    <KV label="Amount total" value={result.stripe.amountTotal != null ? `$${result.stripe.amountTotal.toFixed(2)} ${result.stripe.currency?.toUpperCase()}` : "—"} />
                                    <KV label="Email" value={result.stripe.customerEmail || "—"} />
                                </>
                            ) : (
                                <p className="text-text-main/40 text-xs italic">No matching Stripe session found in last 20 sessions</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline gap-2 text-xs py-1">
            <span className="text-text-main/40 w-28 shrink-0">{label}</span>
            <span className={`text-text-main break-all ${mono ? "font-mono" : ""}`}>{value}</span>
        </div>
    );
}
