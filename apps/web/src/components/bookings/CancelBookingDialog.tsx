"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface CancelBookingDialogProps {
    bookingId: string;
    sport: string;
    otherUserName: string;
    isOpen: boolean;
    isPaid?: boolean;
    totalPaid?: number;
    onClose: () => void;
    onConfirm: (bookingId: string, reason: string) => Promise<void>;
}

export function CancelBookingDialog({
    bookingId,
    sport,
    otherUserName,
    isOpen,
    isPaid = false,
    totalPaid = 0,
    onClose,
    onConfirm,
}: CancelBookingDialogProps) {
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const sportLabel = sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!reason.trim()) return;
        setLoading(true);
        try {
            await onConfirm(bookingId, reason.trim());
            onClose();
        } catch {
            // parent handles error
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="relative w-full max-w-md mx-4 bg-surface-elevated border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-text-main">Cancel Booking</h2>
                            <p className="text-sm text-text-main/50 mt-0.5">{sportLabel} with {otherUserName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-text-main/40 hover:text-text-main transition-colors p-1 rounded-lg hover:bg-white/5"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-5 space-y-4">
                        {/* Refund notice if paid */}
                        {isPaid ? (
                            <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                                <ShieldCheck size={18} className="text-green-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-green-400 mb-0.5">Full Refund Issued Automatically</p>
                                    <p className="text-xs text-green-400/70">
                                        ${totalPaid.toFixed(2)} will be refunded to the athlete's original payment method within 5–10 business days.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
                                <p className="text-sm text-red-400">
                                    This action cannot be undone. The other party will be notified of your cancellation and the reason.
                                </p>
                            </div>
                        )}

                        {/* Reason */}
                        <label className="block">
                            <span className="text-sm font-semibold text-text-main/70 block mb-1.5">
                                Reason for cancellation <span className="text-red-400">*</span>
                            </span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                required
                                placeholder="Please explain why you're cancelling this booking..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-text-main text-sm placeholder:text-text-main/25 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 transition-all resize-none"
                            />
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/10 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-text-main/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                        >
                            Keep Booking
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !reason.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Cancelling..." : isPaid ? "Cancel & Refund" : "Cancel Booking"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
