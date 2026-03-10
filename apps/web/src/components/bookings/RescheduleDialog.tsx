"use client";

import { useState } from "react";
import { PrimaryButton } from "../ui/Buttons";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

interface RescheduleDialogProps {
    bookingId: string;
    currentTime: string;
    sport: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function RescheduleDialog({
    bookingId,
    currentTime,
    sport,
    isOpen,
    onClose,
    onSuccess,
}: RescheduleDialogProps) {
    const [proposedTime, setProposedTime] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const sportLabel = sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const currentDate = new Date(currentTime);
    const formattedCurrent = currentDate.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    // Minimum selectable time = 2 hours from now
    const minTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const session = getSession();
            if (!session) {
                throw new Error("You must be logged in");
            }

            // Check if there's already a pending reschedule request
            const { data: existing } = await supabase
                .from("reschedule_requests")
                .select("id")
                .eq("booking_id", bookingId)
                .eq("status", "pending")
                .maybeSingle();

            if (existing) {
                throw new Error("There is already a pending reschedule request for this booking");
            }

            // Create the reschedule request
            const { error: insertError } = await supabase
                .from("reschedule_requests")
                .insert({
                    booking_id: bookingId,
                    initiated_by: session.id,
                    proposed_time: new Date(proposedTime).toISOString(),
                    reason: reason || null,
                    status: "pending",
                });

            if (insertError) {
                throw new Error(insertError.message);
            }

            // Update booking status to reschedule_requested
            const { error: updateError } = await supabase
                .from("bookings")
                .update({ status: "reschedule_requested" })
                .eq("id", bookingId);

            if (updateError) {
                throw new Error(updateError.message);
            }

            // Create notification for the other party
            const { data: booking } = await supabase
                .from("bookings")
                .select("athlete_id, trainer_id, sport")
                .eq("id", bookingId)
                .single();

            if (booking) {
                const notifyUserId = session.id === booking.athlete_id
                    ? booking.trainer_id
                    : booking.athlete_id;

                await supabase.from("notifications").insert({
                    user_id: notifyUserId,
                    type: "RESCHEDULE_REQUESTED",
                    title: "Reschedule Requested",
                    body: `A reschedule has been requested for your ${sportLabel} session.`,
                    data: { booking_id: bookingId },
                    read: false,
                });
            }

            setSuccess(true);
            setTimeout(() => {
                onClose();
                onSuccess?.();
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-md mx-4 bg-surface-elevated border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-text-main">
                                Reschedule Session
                            </h2>
                            <p className="text-sm text-text-main/50 mt-0.5">
                                {sportLabel} Training
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-text-main/40 hover:text-text-main transition-colors p-1 rounded-lg hover:bg-white/5"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18" />
                                <path d="M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {success ? (
                    <div className="px-6 py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        <p className="text-text-main font-semibold">Request Sent!</p>
                        <p className="text-text-main/50 text-sm mt-1">
                            Waiting for the other party to respond.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="px-6 py-5 space-y-4">
                            {/* Current time info */}
                            <div className="bg-white/5 rounded-xl px-4 py-3">
                                <p className="text-xs text-text-main/40 uppercase tracking-wider font-bold mb-1">
                                    Current Schedule
                                </p>
                                <p className="text-sm text-text-main/80">{formattedCurrent}</p>
                            </div>

                            {/* New time picker */}
                            <label className="block">
                                <span className="text-sm font-semibold text-text-main/70 block mb-1.5">
                                    Proposed New Time
                                </span>
                                <input
                                    type="datetime-local"
                                    required
                                    min={minTime}
                                    value={proposedTime}
                                    onChange={(e) => setProposedTime(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all [color-scheme:dark]"
                                />
                            </label>

                            {/* Reason */}
                            <label className="block">
                                <span className="text-sm font-semibold text-text-main/70 block mb-1.5">
                                    Reason <span className="text-text-main/30 font-normal">(optional)</span>
                                </span>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    placeholder="Let them know why you'd like to change the time..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-text-main text-sm placeholder:text-text-main/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                                />
                            </label>

                            {error && (
                                <div className="bg-error/10 border border-error/20 text-error text-sm rounded-xl px-4 py-2.5">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-text-main/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <PrimaryButton
                                type="submit"
                                disabled={loading || !proposedTime}
                                className="flex-1"
                            >
                                {loading ? "Sending..." : "Send Request"}
                            </PrimaryButton>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
