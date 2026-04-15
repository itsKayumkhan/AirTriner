"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, BookingRow } from "@/lib/supabase";
import { Plus, X, CheckCircle2, Circle, Clock, CalendarDays, List } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface AvailabilitySlot {
    id: string;
    trainer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_blocked: boolean;
}

interface RecurringDay {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DURATIONS = [30, 45, 60] as const;

/** Returns true if the Supabase error indicates the table does not exist. */
function isTableMissingError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const e = err as Record<string, unknown>;
    const code = e.code as string | undefined;
    const msg = (e.message as string | undefined) ?? "";
    // PostgreSQL error code 42P01 = undefined_table
    return code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation");
}

function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function slotDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

function to12h(t: string): string {
    const [hStr, m] = t.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

export default function AvailabilityPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
    const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Mode toggle
    const [mode, setMode] = useState<"recurring" | "per_slot">("per_slot");

    // Recurring availability state
    const [recurring, setRecurring] = useState<RecurringDay[]>(
        Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false }))
    );
    const [recurringSaving, setRecurringSaving] = useState(false);
    const [recurringSaved, setRecurringSaved] = useState(false);

    // Whether the recurring table exists (graceful degradation)
    const [recurringTableAvailable, setRecurringTableAvailable] = useState(true);

    // New slot form — duration-based
    const [newSlot, setNewSlot] = useState({ day: 1, start: "09:00", duration: 30 as number });

    const endTime = addMinutes(newSlot.start, newSlot.duration);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadSlots(session);
            loadRecurring(session);
        }
    }, []);

    const loadRecurring = async (u: AuthUser) => {
        try {
            if (!u.trainerProfile?.id) return;

            const { data, error: fetchError } = await supabase
                .from("availability_recurring")
                .select("*")
                .eq("trainer_id", u.trainerProfile.id)
                .order("day_of_week");

            if (fetchError) {
                if (isTableMissingError(fetchError)) {
                    console.info("availability_recurring table not found, using fallback per-slot mode");
                    setRecurringTableAvailable(false);
                    return;
                }
                throw fetchError;
            }

            if (data && data.length > 0) {
                // Merge fetched rows into the 7-day state
                setRecurring((prev) =>
                    prev.map((day) => {
                        const match = (data as Array<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }>).find(
                            (r) => r.day_of_week === day.day_of_week
                        );
                        if (match) {
                            return {
                                day_of_week: match.day_of_week,
                                start_time: match.start_time.slice(0, 5),
                                end_time: match.end_time.slice(0, 5),
                                is_active: match.is_active,
                            };
                        }
                        return day;
                    })
                );
                setMode("recurring");
            }
        } catch (err) {
            if (isTableMissingError(err)) {
                console.info("availability_recurring table not found, using fallback per-slot mode");
                setRecurringTableAvailable(false);
            } else {
                console.error("Failed to load recurring availability:", err);
            }
        }
    };

    const loadSlots = async (u: AuthUser) => {
        try {
            if (!u.trainerProfile?.id) return;

            const { data } = await supabase
                .from("availability_slots")
                .select("*")
                .eq("trainer_id", u.trainerProfile.id)
                .order("day_of_week")
                .order("start_time");

            const loadedSlots = (data || []) as AvailabilitySlot[];
            setSlots(loadedSlots);

            // Check which slots have upcoming confirmed/pending bookings
            const { data: bookings } = await supabase
                .from("bookings")
                .select("scheduled_at, duration_minutes, status")
                .eq("trainer_id", u.id)
                .in("status", ["confirmed", "pending"]);

            if (bookings?.length && loadedSlots.length) {
                const booked = new Set<string>();
                (bookings as BookingRow[]).forEach((b) => {
                    const bDate = new Date(b.scheduled_at);
                    const bDay = bDate.getDay();
                    const bTime = `${String(bDate.getHours()).padStart(2, "0")}:${String(bDate.getMinutes()).padStart(2, "0")}`;
                    loadedSlots.forEach((s) => {
                        if (s.day_of_week === bDay && s.start_time.slice(0, 5) === bTime) {
                            booked.add(s.id);
                        }
                    });
                });
                setBookedSlotIds(booked);
            }
        } catch (err) {
            console.error("Failed to load availability:", err);
        } finally {
            setLoading(false);
        }
    };

    const addSlot = async () => {
        if (!user) return;

        if (!newSlot.start) {
            toast.error("Please select a start time.");
            return;
        }

        const computedEnd = endTime;

        // Validate end doesn't wrap past midnight in a weird way
        if (computedEnd <= newSlot.start && newSlot.duration > 0) {
            toast.error("Slot would extend past midnight. Choose an earlier start time.");
            return;
        }

        // Check for conflicts
        const conflictingSlot = slots.find((s) => {
            if (s.day_of_week !== newSlot.day) return false;
            const existingStart = s.start_time.slice(0, 5);
            const existingEnd = s.end_time.slice(0, 5);
            return (
                (newSlot.start >= existingStart && newSlot.start < existingEnd) ||
                (computedEnd > existingStart && computedEnd <= existingEnd) ||
                (newSlot.start <= existingStart && computedEnd >= existingEnd)
            );
        });

        if (conflictingSlot) {
            toast.error(`Time conflicts with existing slot: ${to12h(conflictingSlot.start_time.slice(0, 5))} – ${to12h(conflictingSlot.end_time.slice(0, 5))}`);
            return;
        }

                setSaving(true);
        try {
            if (!user.trainerProfile?.id) {
                toast.error("Trainer profile not found. Please setup your profile first.");
                return;
            }

            const { data, error: insertError } = await supabase
                .from("availability_slots")
                .insert({
                    trainer_id: user.trainerProfile.id,
                    day_of_week: newSlot.day,
                    start_time: newSlot.start,
                    end_time: computedEnd,
                    is_blocked: false,
                })
                .select()
                .single();

            if (insertError) throw insertError;
            setSlots((prev) => [...prev, data as AvailabilitySlot].sort((a, b) =>
                a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
            ));
            toast.success("Availability updated!");
        } catch (err) {
            console.error("Failed to add slot:", err);
            toast.error("Failed to add slot. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const deleteSlot = async (slotId: string) => {
        try {
            await supabase.from("availability_slots").delete().eq("id", slotId);
            setSlots((prev) => prev.filter((s) => s.id !== slotId));
        } catch (err) {
            console.error("Failed to delete slot:", err);
        }
    };

    const updateRecurringDay = (dayIndex: number, field: keyof RecurringDay, value: string | boolean) => {
        setRecurring((prev) =>
            prev.map((d) =>
                d.day_of_week === dayIndex ? { ...d, [field]: value } : d
            )
        );
    };

    const saveRecurring = async () => {
        if (!user?.trainerProfile?.id) {
            toast.error("Trainer profile not found. Please setup your profile first.");
            return;
        }

        // Validate: for active days, end must be after start
        for (const day of recurring) {
            if (day.is_active && timeToMinutes(day.end_time) <= timeToMinutes(day.start_time)) {
                toast.error(`${DAYS[day.day_of_week]}: End time must be after start time.`);
                return;
            }
        }

                setRecurringSaving(true);
        try {
            const rows = recurring.map((d) => ({
                trainer_id: user.trainerProfile!.id,
                day_of_week: d.day_of_week,
                start_time: d.start_time,
                end_time: d.end_time,
                is_active: d.is_active,
                updated_at: new Date().toISOString(),
            }));

            const { error: upsertError } = await supabase
                .from("availability_recurring")
                .upsert(rows, { onConflict: "trainer_id,day_of_week" });

            if (upsertError) throw upsertError;

            toast.success("Recurring schedule saved!");
        } catch (err) {
            console.error("Failed to save recurring availability:", err);
            toast.error("Failed to save recurring schedule. Please try again.");
        } finally {
            setRecurringSaving(false);
        }
    };

    // Group slots by day — only show days that have slots
    const slotsByDay = DAYS.map((day, i) => ({
        day,
        dayNum: i,
        slots: slots.filter((s) => s.day_of_week === i),
    })).filter(({ slots: daySlots }) => daySlots.length > 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">
            <div className="mb-8">
                <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">Availability</h1>
                <p className="text-text-main/60 font-medium text-[15px]">
                    {mode === "recurring"
                        ? "Set your recurring weekly schedule — athletes will see these hours."
                        : "Add individual time slots — athletes book directly from these."}
                </p>
            </div>

            {/* Mode Toggle */}
            {recurringTableAvailable && (
                <div className="flex gap-2 mb-8">
                    <button
                        onClick={() => setMode("recurring")}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold border transition-all ${
                            mode === "recurring"
                                ? "bg-white text-[#0A0D14] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                                : "bg-[#12141A] text-text-main/60 border-white/10 hover:border-white/20 hover:text-white"
                        }`}
                    >
                        <CalendarDays size={16} /> Recurring Weekly
                    </button>
                    <button
                        onClick={() => setMode("per_slot")}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold border transition-all ${
                            mode === "per_slot"
                                ? "bg-white text-[#0A0D14] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                                : "bg-[#12141A] text-text-main/60 border-white/10 hover:border-white/20 hover:text-white"
                        }`}
                    >
                        <List size={16} /> Per-Slot
                    </button>
                </div>
            )}

            {/* Confirmation banners */}
            {/* ====== RECURRING MODE ====== */}
            {mode === "recurring" && recurringTableAvailable && (
                <div className="flex flex-col gap-4">
                    {recurring.map((day) => (
                        <div
                            key={day.day_of_week}
                            className={`bg-[#1A1C23] rounded-[20px] border p-6 lg:p-8 shadow-md transition-all ${
                                day.is_active ? "border-primary/20" : "border-white/5"
                            }`}
                        >
                            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                {/* Day name */}
                                <div className="w-[110px] shrink-0">
                                    <h4 className="text-[18px] font-bold text-white tracking-wide">{DAYS[day.day_of_week]}</h4>
                                </div>

                                {/* Toggle */}
                                <button
                                    onClick={() => updateRecurringDay(day.day_of_week, "is_active", !day.is_active)}
                                    className={`px-4 py-2 rounded-xl text-[13px] font-black uppercase tracking-wider border transition-all ${
                                        day.is_active
                                            ? "bg-primary/15 border-primary/30 text-primary"
                                            : "bg-[#12141A] border-white/10 text-text-main/40 hover:border-white/20 hover:text-text-main/60"
                                    }`}
                                >
                                    {day.is_active ? "Available" : "Off"}
                                </button>

                                {/* Time inputs (shown only when active) */}
                                {day.is_active && (
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-1">Start</label>
                                            <input
                                                type="time"
                                                step="900"
                                                value={day.start_time}
                                                onChange={(e) => updateRecurringDay(day.day_of_week, "start_time", e.target.value)}
                                                className="bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-2.5 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all [color-scheme:dark]"
                                            />
                                        </div>
                                        <span className="text-text-main/30 mt-5">—</span>
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-1">End</label>
                                            <input
                                                type="time"
                                                step="900"
                                                value={day.end_time}
                                                onChange={(e) => updateRecurringDay(day.day_of_week, "end_time", e.target.value)}
                                                className="bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-2.5 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all [color-scheme:dark]"
                                            />
                                        </div>
                                        <span className="text-primary text-[13px] font-semibold mt-5">
                                            {to12h(day.start_time)} – {to12h(day.end_time)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Save button */}
                    <button
                        onClick={saveRecurring}
                        disabled={recurringSaving}
                        className="w-full mt-4 py-3.5 rounded-xl bg-[#12141A] border border-white/10 text-white font-black uppercase tracking-widest hover:border-white/20 hover:bg-[#1E2028] transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {recurringSaving ? "Saving..." : recurringSaved ? "Saved!" : "Save Weekly Schedule"}
                    </button>
                </div>
            )}

            {/* ====== PER-SLOT MODE (existing behavior, unchanged) ====== */}
            {mode === "per_slot" && (
                <>
                    {/* Add new slot */}
                    <div className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-6 lg:p-8 mb-8 shadow-md">
                        <h3 className="text-[18px] font-black font-display text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-primary" /> Add Time Slot
                        </h3>

                        <div className="flex flex-wrap gap-6 items-start">
                            {/* Day */}
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">Day</label>
                                <select
                                    value={newSlot.day}
                                    onChange={(e) => setNewSlot((p) => ({ ...p, day: Number(e.target.value) }))}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-3 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all appearance-none custom-select-arrow"
                                >
                                    {DAYS.map((d, i) => (
                                        <option key={d} value={i} className="bg-[#1A1C23]">{d}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Start Time */}
                            <div className="flex-1 min-w-[160px]">
                                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">Start Time</label>
                                <input
                                    type="time"
                                    step="900"
                                    value={newSlot.start}
                                    onChange={(e) => setNewSlot((p) => ({ ...p, start: e.target.value }))}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-3 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all [color-scheme:dark]"
                                />
                                <p className="text-primary text-[13px] font-semibold mt-1.5">
                                    Ends at {to12h(endTime)}
                                </p>
                            </div>

                            {/* Duration */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">Duration</label>
                                <div className="flex gap-2">
                                    {DURATIONS.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setNewSlot((p) => ({ ...p, duration: d }))}
                                            className={`px-5 py-3 rounded-xl text-[14px] font-bold border transition-all ${newSlot.duration === d
                                                ? "bg-white text-[#0A0D14] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                                                : "bg-[#12141A] text-text-main/60 border-white/10 hover:border-white/20 hover:text-white"
                                                }`}
                                        >
                                            {d}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Slot Preview */}
                        <div className="mt-5">
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">Slot Preview</label>
                            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-[13px] font-bold tracking-wide">
                                {to12h(newSlot.start)} – {to12h(endTime)}
                            </span>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={addSlot}
                            disabled={saving}
                            className="w-full mt-6 py-3.5 rounded-xl bg-[#12141A] border border-white/10 text-white font-black uppercase tracking-widest hover:border-white/20 hover:bg-[#1E2028] transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? "Adding..." : "+ Add Slot"}
                        </button>
                    </div>

                    {/* Weekly view — only days with slots */}
                    <div className="flex flex-col gap-5">
                        {slotsByDay.length === 0 && (
                            <div className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-8 text-center">
                                <Clock size={32} className="text-text-main/20 mx-auto mb-3" />
                                <p className="text-text-main/40 text-[15px] font-medium">No time slots added yet. Add your first slot above.</p>
                            </div>
                        )}

                        {slotsByDay.map(({ day, slots: daySlots }) => {
                            const availableCount = daySlots.filter((s) => !bookedSlotIds.has(s.id) && !s.is_blocked).length;
                            const bookedCount = daySlots.filter((s) => bookedSlotIds.has(s.id)).length;

                            return (
                                <div key={day} className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-6 lg:p-8 shadow-md">
                                    <div className="flex items-center justify-between mb-5">
                                        <h4 className="text-[18px] font-bold text-white tracking-wide">{day}</h4>
                                        <span className="text-[13px] font-medium text-text-main/40">
                                            {availableCount} available{bookedCount > 0 ? ` · ${bookedCount} booked` : ""}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {daySlots.map((slot) => {
                                            const isBooked = bookedSlotIds.has(slot.id);
                                            const duration = slotDurationMinutes(slot.start_time.slice(0, 5), slot.end_time.slice(0, 5));

                                            return (
                                                <div
                                                    key={slot.id}
                                                    className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all ${isBooked
                                                        ? "bg-white/[0.03] border-white/10"
                                                        : "bg-[#12141A] border-white/5 hover:border-white/10"
                                                        }`}
                                                >
                                                    <span className={`text-[15px] font-bold tracking-wide ${isBooked ? "text-primary" : "text-primary"}`}>
                                                        {to12h(slot.start_time.slice(0, 5))} – {to12h(slot.end_time.slice(0, 5))}
                                                    </span>

                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[13px] text-text-main/40 font-medium">{duration} min</span>

                                                        {isBooked ? (
                                                            <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-black uppercase tracking-wider">
                                                                Booked
                                                            </span>
                                                        ) : (
                                                            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-black uppercase tracking-wider">
                                                                Available
                                                            </span>
                                                        )}

                                                        {!isBooked && (
                                                            <button
                                                                onClick={() => deleteSlot(slot.id)}
                                                                title="Remove slot"
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1A1C23] border border-white/10 text-text-main/40 hover:text-red-400 hover:border-red-500/30 transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
