"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";

interface AvailabilitySlot {
    id: string;
    trainer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_blocked: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [error, setError] = useState("");

    // New slot form
    const [newSlot, setNewSlot] = useState({ day: 1, start: "09:00", end: "17:00" });

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadSlots(session);
        }
    }, []);

    const loadSlots = async (u: AuthUser) => {
        try {
            if (!u.trainerProfile?.id) return;

            const { data } = await supabase
                .from("availability_slots")
                .select("*")
                .eq("trainer_id", u.trainerProfile.id)
                .order("day_of_week")
                .order("start_time");

            setSlots((data || []) as AvailabilitySlot[]);
        } catch (err) {
            console.error("Failed to load availability:", err);
        } finally {
            setLoading(false);
        }
    };

    const addSlot = async () => {
        if (!user) return;

        if (!newSlot.start || !newSlot.end) {
            setError("Please provide both start and end times.");
            return;
        }

        // Validate start time is before end time
        if (newSlot.start >= newSlot.end) {
            setError("Start time must be before end time");
            return;
        }

        // Check for conflicts with existing slots
        const conflictingSlot = slots.find((s) => {
            if (s.day_of_week !== newSlot.day) return false;

            const existingStart = s.start_time.slice(0, 5);
            const existingEnd = s.end_time.slice(0, 5);

            return (
                (newSlot.start >= existingStart && newSlot.start < existingEnd) || // New start is inside existing
                (newSlot.end > existingStart && newSlot.end <= existingEnd) ||     // New end is inside existing
                (newSlot.start <= existingStart && newSlot.end >= existingEnd)     // New envelopes existing
            );
        });

        if (conflictingSlot) {
            setError(`Time conflicts with existing slot: ${conflictingSlot.start_time.slice(0, 5)} - ${conflictingSlot.end_time.slice(0, 5)}`);
            return;
        }

        setError("");
        setSaving(true);
        try {
            if (!user.trainerProfile?.id) {
                setError("Trainer profile not found. Please setup your profile first.");
                return;
            }

            const { data, error: insertError } = await supabase
                .from("availability_slots")
                .insert({
                    trainer_id: user.trainerProfile.id,
                    day_of_week: newSlot.day,
                    start_time: newSlot.start,
                    end_time: newSlot.end,
                    is_blocked: false,
                })
                .select()
                .single();

            if (insertError) throw insertError;
            setSlots((prev) => [...prev, data as AvailabilitySlot].sort((a, b) => a.day_of_week - b.day_of_week));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to add slot:", err);
            setError("Failed to add slot. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const toggleSlot = async (slotId: string, currentIsBlocked: boolean) => {
        try {
            await supabase.from("availability_slots").update({ is_blocked: !currentIsBlocked }).eq("id", slotId);
            setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, is_blocked: !currentIsBlocked } : s)));
        } catch (err) {
            console.error("Failed to toggle slot:", err);
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

    const to12h = (t: string) => {
        const [hStr, m] = t.split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    };

    // Group slots by day
    const slotsByDay = DAYS.map((day, i) => ({
        day,
        dayNum: i,
        slots: slots.filter((s) => s.day_of_week === i),
    }));

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
                    Set your weekly availability so athletes know when to book.
                </p>
            </div>

            {saved && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-[14px] font-bold mb-6 flex items-center gap-2">
                    <CheckCircle2 size={18} /> Availability updated!
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[14px] font-bold mb-6 flex items-center gap-2">
                    <Circle size={18} className="rotate-45" /> {error}
                </div>
            )}

            {/* Add new slot */}
            <div className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-6 lg:p-8 mb-8 shadow-md">
                <h3 className="text-[18px] font-black font-display text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <Plus size={20} className="text-primary" /> Add Time Slot
                </h3>
                <div className="flex flex-wrap gap-4 items-end">
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
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">From</label>
                        <input
                            type="time"
                            value={newSlot.start}
                            onChange={(e) => setNewSlot((p) => ({ ...p, start: e.target.value }))}
                            className="w-full bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-3 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all [color-scheme:dark]"
                        />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-text-main/40 mb-2">To</label>
                        <input
                            type="time"
                            value={newSlot.end}
                            onChange={(e) => setNewSlot((p) => ({ ...p, end: e.target.value }))}
                            className="w-full bg-[#12141A] border border-white/5 rounded-xl text-[15px] font-medium text-white px-4 py-3 outline-none focus:border-primary/50 focus:bg-[#1A1C23] transition-all [color-scheme:dark]"
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <button
                            onClick={addSlot}
                            disabled={saving}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-bg font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(69,208,255,0.4)] hover:-translate-y-0.5 transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {saving ? "Adding..." : "+ Add Slot"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Weekly view */}
            <div className="flex flex-col gap-5">
                {slotsByDay.map(({ day, slots: daySlots }) => (
                    <div key={day} className="bg-[#1A1C23] rounded-[20px] border border-white/5 p-6 lg:p-8 shadow-md hover:border-white/10 transition-colors">
                        <div className={`flex items-center justify-between ${daySlots.length > 0 ? "mb-5" : "mb-0"}`}>
                            <h4 className="text-[18px] font-bold text-white tracking-wide">{day}</h4>
                            {daySlots.length === 0 && (
                                <span className="text-[13px] font-medium text-text-main/30 italic px-3 py-1 bg-[#12141A] rounded-lg border border-white/5">No slots set</span>
                            )}
                        </div>
                        {daySlots.length > 0 && (
                            <div className="flex flex-wrap gap-3">
                                {daySlots.map((slot) => (
                                    <div
                                        key={slot.id}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${!slot.is_blocked
                                            ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_10px_rgba(69,208,255,0.05)]"
                                            : "bg-[#12141A] border-white/5 text-text-main/40 opacity-70"
                                            }`}
                                    >
                                        <Clock size={14} className={!slot.is_blocked ? "text-primary" : "text-text-main/30"} />
                                        <span className="text-[14px] font-bold tracking-wide">
                                            {to12h(slot.start_time.slice(0, 5))} – {to12h(slot.end_time.slice(0, 5))}
                                        </span>
                                        <div className="flex items-center gap-1.5 ml-1 border-l border-current/10 pl-2.5">
                                            <button
                                                onClick={() => toggleSlot(slot.id, slot.is_blocked)}
                                                title={!slot.is_blocked ? "Disable" : "Enable"}
                                                className={`p-1.5 rounded-md transition-colors ${!slot.is_blocked ? "hover:bg-primary/20 text-primary" : "hover:bg-white/5 text-text-main/30 hover:text-white"}`}
                                            >
                                                {!slot.is_blocked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                            </button>
                                            <button
                                                onClick={() => deleteSlot(slot.id)}
                                                title="Remove"
                                                className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
