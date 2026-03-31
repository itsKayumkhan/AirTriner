"use client";

import { useState, useEffect } from "react";
import { PrimaryButton } from "../ui/Buttons";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RescheduleDialogProps {
    bookingId: string;
    currentTime: string;
    sport: string;
    trainerId: string;
    durationMinutes: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function generateSlots(startHHMM: string, endHHMM: string, durationMins: number): string[] {
    const slots: string[] = [];
    const [sh, sm] = startHHMM.split(":").map(Number);
    const [eh, em] = endHHMM.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + durationMins <= end) {
        const h = Math.floor(cur / 60), m = cur % 60;
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        cur += 15;
    }
    return slots;
}

function buildCalendar(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const minDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
        const d = daysInPrev - firstDay + 1 + i;
        cells.push({ day: d, isCurrentMonth: false, fullDate: "", isPast: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const fullDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cells.push({ day: d, isCurrentMonth: true, fullDate, isPast: date < minDate });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, isCurrentMonth: false, fullDate: "", isPast: true });
    }
    return cells;
}

export function RescheduleDialog({
    bookingId, currentTime, sport, trainerId, durationMinutes, isOpen, onClose, onSuccess,
}: RescheduleDialogProps) {
    const now = new Date();
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [calMonth, setCalMonth] = useState(now.getMonth());
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [noSlotsMsg, setNoSlotsMsg] = useState<string | null>(null);

    const sportLabel = sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const formattedCurrent = new Date(currentTime).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const cells = buildCalendar(calYear, calMonth);

    useEffect(() => {
        if (!selectedDate) { setAvailableSlots([]); setNoSlotsMsg(null); return; }
        const fetchSlots = async () => {
            setSlotsLoading(true); setAvailableSlots([]); setSelectedTime(""); setNoSlotsMsg(null); setError(null);
            try {
                const date = new Date(selectedDate + "T00:00:00");
                const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                const { data: slots } = await supabase.from("availability_slots").select("start_time, end_time").eq("trainer_id", trainerId).eq("day_of_week", dayOfWeek);
                if (!slots || slots.length === 0) { setNoSlotsMsg(`Trainer is not available on ${date.toLocaleDateString("en-US", { weekday: "long" })}s.`); return; }

                const dayStart = selectedDate + "T00:00:00.000Z";
                const dayEnd = selectedDate + "T23:59:59.999Z";
                const { data: existingBookings } = await supabase.from("bookings").select("scheduled_at, duration_minutes").eq("trainer_id", trainerId).in("status", ["confirmed", "pending"]).neq("id", bookingId).gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd);

                const blockedRanges = (existingBookings || []).map((b: { scheduled_at: string; duration_minutes: number }) => {
                    const s = new Date(b.scheduled_at); return { start: s.getHours() * 60 + s.getMinutes(), end: s.getHours() * 60 + s.getMinutes() + (b.duration_minutes || 60) };
                });
                const isToday = selectedDate === new Date().toISOString().slice(0, 10);
                const nowMins = new Date().getHours() * 60 + new Date().getMinutes() + 120;

                const allSlots: string[] = [];
                for (const slot of slots) {
                    for (const t of generateSlots(slot.start_time, slot.end_time, durationMinutes)) {
                        const [h, m] = t.split(":").map(Number);
                        const startMins = h * 60 + m, endMins = startMins + durationMinutes;
                        if (isToday && startMins < nowMins) continue;
                        if (!blockedRanges.some(r => startMins < r.end && endMins > r.start)) allSlots.push(t);
                    }
                }
                if (allSlots.length === 0) setNoSlotsMsg("No available slots on this day.");
                else setAvailableSlots(allSlots);
            } catch { setNoSlotsMsg("Could not load availability. Please try again."); }
            finally { setSlotsLoading(false); }
        };
        fetchSlots();
    }, [selectedDate, trainerId, durationMinutes, bookingId]);

    if (!isOpen) return null;

    const formatSlot = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        const d = new Date(); d.setHours(h, m, 0, 0);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
    const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedDate || !selectedTime) return;
        setLoading(true); setError(null);
        try {
            const session = getSession();
            if (!session) throw new Error("You must be logged in");
            const proposed = new Date(`${selectedDate}T${selectedTime}`);
            const proposedEnd = new Date(proposed.getTime() + durationMinutes * 60 * 1000);
            const dayOfWeek = proposed.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            const timeHHMM = proposed.toTimeString().slice(0, 5);
            const endHHMM = proposedEnd.toTimeString().slice(0, 5);

            const { data: slots } = await supabase.from("availability_slots").select("start_time, end_time").eq("trainer_id", trainerId).eq("day_of_week", dayOfWeek);
            if (!(slots || []).some((s: { start_time: string; end_time: string }) => s.start_time <= timeHHMM && s.end_time >= endHHMM))
                throw new Error("Trainer is no longer available at this time. Please pick another slot.");

            const { data: conflicts } = await supabase.from("bookings").select("scheduled_at, duration_minutes").eq("trainer_id", trainerId).in("status", ["confirmed", "pending"]).neq("id", bookingId).gte("scheduled_at", selectedDate + "T00:00:00.000Z").lte("scheduled_at", selectedDate + "T23:59:59.999Z");
            if ((conflicts || []).some((b: { scheduled_at: string; duration_minutes: number }) => { const bs = new Date(b.scheduled_at).getTime(), be = bs + (b.duration_minutes || 60) * 60000; return proposed.getTime() < be && proposedEnd.getTime() > bs; }))
                throw new Error("This slot was just booked by someone else. Please pick another.");

            const { data: existing } = await supabase.from("reschedule_requests").select("id").eq("booking_id", bookingId).eq("status", "pending").maybeSingle();
            if (existing) throw new Error("There is already a pending reschedule request for this booking");

            const { error: insertError } = await supabase.from("reschedule_requests").insert({ booking_id: bookingId, initiated_by: session.id, proposed_time: proposed.toISOString(), reason: reason || null, status: "pending" });
            if (insertError) throw new Error(insertError.message);
            await supabase.from("bookings").update({ status: "reschedule_requested" }).eq("id", bookingId);

            const { data: booking } = await supabase.from("bookings").select("athlete_id, trainer_id").eq("id", bookingId).single();
            if (booking) {
                const notifyUserId = session.id === booking.athlete_id ? booking.trainer_id : booking.athlete_id;
                await supabase.from("notifications").insert({ user_id: notifyUserId, type: "RESCHEDULE_REQUESTED", title: "Reschedule Requested", body: `A reschedule has been requested for your ${sportLabel} session.`, data: { booking_id: bookingId }, read: false });
            }
            setSuccess(true);
            setTimeout(() => { onClose(); onSuccess?.(); }, 1500);
        } catch (err: unknown) { setError(err instanceof Error ? err.message : "Something went wrong"); }
        finally { setLoading(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[420px] mx-4 bg-[#1A1C23] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-white/[0.07] shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-[17px] font-black text-white tracking-tight">Reschedule Session</h2>
                            <p className="text-[12px] text-white/40 mt-0.5">{sportLabel} · {durationMinutes}min</p>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/8 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                    </div>
                    {/* Current time */}
                    <div className="mt-4 flex items-center gap-2 bg-white/4 rounded-xl px-3 py-2 border border-white/6">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest shrink-0">Now</span>
                        <span className="text-[12px] font-semibold text-white/60">{formattedCurrent}</span>
                    </div>
                </div>

                {success ? (
                    <div className="px-6 py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                        <p className="text-white font-bold">Request Sent!</p>
                        <p className="text-white/40 text-sm mt-1">Waiting for the other party to respond.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                        <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
                            {/* ── Mini Calendar ── */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.15em]">{monthLabel}</span>
                                    <div className="flex items-center gap-1 bg-[#12141A] rounded-full border border-white/5 p-0.5">
                                        <button type="button" onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                                            <ChevronLeft size={14} strokeWidth={2.5} />
                                        </button>
                                        <button type="button" onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                                            <ChevronRight size={14} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 mb-1">
                                    {WEEKDAYS.map(d => (
                                        <div key={d} className="text-[10px] text-white/25 font-bold uppercase text-center py-1">{d}</div>
                                    ))}
                                </div>

                                {/* Date cells */}
                                <div className="grid grid-cols-7 gap-y-1">
                                    {cells.map((cell, i) => (
                                        <div key={i} className="flex justify-center">
                                            {cell.isCurrentMonth ? (
                                                <button
                                                    type="button"
                                                    disabled={cell.isPast}
                                                    onClick={() => !cell.isPast && setSelectedDate(cell.fullDate)}
                                                    className={`w-8 h-8 rounded-[8px] text-[13px] font-black flex items-center justify-center transition-all duration-150
                                                        ${cell.isPast ? "text-white/15 cursor-not-allowed" : ""}
                                                        ${selectedDate === cell.fullDate
                                                            ? "bg-primary text-bg shadow-[0_0_12px_rgba(69,208,255,0.35)] scale-105"
                                                            : !cell.isPast ? "text-white hover:bg-white/8 hover:-translate-y-0.5" : ""
                                                        }`}
                                                >
                                                    {cell.day}
                                                </button>
                                            ) : (
                                                <span className="w-8 h-8 flex items-center justify-center text-[13px] text-white/10">{cell.day}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Time Slots ── */}
                            {selectedDate && (
                                <div>
                                    <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.15em] mb-3">Available Times</p>
                                    {slotsLoading ? (
                                        <div className="flex flex-wrap gap-2">
                                            {[...Array(8)].map((_, i) => <div key={i} className="h-8 w-16 rounded-lg bg-white/5 animate-pulse" />)}
                                        </div>
                                    ) : noSlotsMsg ? (
                                        <p className="text-[12px] text-amber-400/70 bg-amber-500/8 border border-amber-500/15 rounded-xl px-4 py-3">{noSlotsMsg}</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                                            {availableSlots.map(t => (
                                                <button key={t} type="button" onClick={() => setSelectedTime(t)}
                                                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all ${
                                                        selectedTime === t
                                                            ? "bg-primary text-bg border-primary shadow-[0_0_10px_rgba(69,208,255,0.3)]"
                                                            : "bg-white/4 border-white/8 text-white/60 hover:border-primary/40 hover:text-white"
                                                    }`}>
                                                    {formatSlot(t)}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Reason ── */}
                            <label className="block">
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.15em] block mb-2">
                                    Reason <span className="text-white/20 lowercase font-medium tracking-normal">(optional)</span>
                                </span>
                                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                                    placeholder="Let them know why you'd like to change the time..."
                                    className="w-full bg-[#12141A] border border-white/8 rounded-xl px-4 py-2.5 text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all resize-none"
                                />
                            </label>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] rounded-xl px-4 py-2.5">{error}</div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/[0.07] flex gap-3 shrink-0">
                            <button type="button" onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white/50 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-white transition-all">
                                Cancel
                            </button>
                            <PrimaryButton type="submit" disabled={loading || !selectedDate || !selectedTime} className="flex-1">
                                {loading ? "Sending..." : "Send Request"}
                            </PrimaryButton>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
