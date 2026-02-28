"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface AvailabilitySlot {
    id: string;
    trainer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
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
            const { data } = await supabase
                .from("availability_slots")
                .select("*")
                .eq("trainer_id", u.id)
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
        
        // Validate start time is before end time
        if (newSlot.start >= newSlot.end) {
            setError("Start time must be before end time");
            return;
        }
        
        // Check for conflicts with existing slots
        const conflictingSlot = slots.find((s) => 
            s.day_of_week === newSlot.day && 
            s.is_active &&
            ((newSlot.start >= s.start_time.slice(0, 5) && newSlot.start < s.end_time.slice(0, 5)) ||
             (newSlot.end > s.start_time.slice(0, 5) && newSlot.end <= s.end_time.slice(0, 5)) ||
             (newSlot.start <= s.start_time.slice(0, 5) && newSlot.end >= s.end_time.slice(0, 5)))
        );
        
        if (conflictingSlot) {
            setError(`Time conflicts with existing slot: ${conflictingSlot.start_time.slice(0, 5)} - ${conflictingSlot.end_time.slice(0, 5)}`);
            return;
        }
        
        setError("");
        setSaving(true);
        try {
            const { data, error: insertError } = await supabase
                .from("availability_slots")
                .insert({
                    trainer_id: user.id,
                    day_of_week: newSlot.day,
                    start_time: newSlot.start + ":00",
                    end_time: newSlot.end + ":00",
                    is_active: true,
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

    const toggleSlot = async (slotId: string, isActive: boolean) => {
        try {
            await supabase.from("availability_slots").update({ is_active: !isActive }).eq("id", slotId);
            setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, is_active: !isActive } : s)));
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

    // Group slots by day
    const slotsByDay = DAYS.map((day, i) => ({
        day,
        dayNum: i,
        slots: slots.filter((s) => s.day_of_week === i),
    }));

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
                <div style={{ width: "40px", height: "40px", border: "3px solid var(--gray-200)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: "28px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: "4px" }}>Availability</h1>
                <p style={{ color: "var(--gray-500)", fontSize: "14px" }}>
                    Set your weekly availability so athletes know when to book.
                </p>
            </div>

            {saved && (
                <div style={{ padding: "12px 16px", background: "#d1fae5", borderRadius: "var(--radius-md)", color: "#059669", fontSize: "14px", fontWeight: 600, marginBottom: "24px" }}>
                    ✅ Availability updated!
                </div>
            )}

            {error && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", borderRadius: "var(--radius-md)", color: "#dc2626", fontSize: "14px", fontWeight: 600, marginBottom: "24px", borderLeft: "4px solid #dc2626" }}>
                    ❌ {error}
                </div>
            )}

            {/* Add new slot */}
            <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "24px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", fontFamily: "var(--font-display)" }}>Add Time Slot</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ minWidth: "140px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>Day</label>
                        <select value={newSlot.day} onChange={(e) => setNewSlot((p) => ({ ...p, day: Number(e.target.value) }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)", fontSize: "14px", outline: "none" }}>
                            {DAYS.map((d, i) => (
                                <option key={d} value={i}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ minWidth: "110px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>From</label>
                        <input type="time" value={newSlot.start} onChange={(e) => setNewSlot((p) => ({ ...p, start: e.target.value }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)", fontSize: "14px", outline: "none" }} />
                    </div>
                    <div style={{ minWidth: "110px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>To</label>
                        <input type="time" value={newSlot.end} onChange={(e) => setNewSlot((p) => ({ ...p, end: e.target.value }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--gray-200)", fontSize: "14px", outline: "none" }} />
                    </div>
                    <button onClick={addSlot} disabled={saving}
                        style={{ padding: "10px 24px", borderRadius: "var(--radius-md)", background: "var(--gradient-primary)", color: "white", border: "none", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)" }}>
                        {saving ? "Adding..." : "+ Add Slot"}
                    </button>
                </div>
            </div>

            {/* Weekly view */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {slotsByDay.map(({ day, slots: daySlots }) => (
                    <div key={day} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "20px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: daySlots.length > 0 ? "16px" : "0" }}>
                            <h4 style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-display)" }}>{day}</h4>
                            {daySlots.length === 0 && (
                                <span style={{ fontSize: "13px", color: "var(--gray-400)", fontStyle: "italic" }}>No slots set</span>
                            )}
                        </div>
                        {daySlots.length > 0 && (
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {daySlots.map((slot) => (
                                    <div
                                        key={slot.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "8px 14px",
                                            borderRadius: "var(--radius-md)",
                                            background: slot.is_active ? "var(--primary-50)" : "var(--gray-50)",
                                            border: `1px solid ${slot.is_active ? "var(--primary-light)" : "var(--gray-200)"}`,
                                            opacity: slot.is_active ? 1 : 0.6,
                                        }}
                                    >
                                        <span style={{ fontSize: "14px", fontWeight: 600, color: slot.is_active ? "var(--primary)" : "var(--gray-400)" }}>
                                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                                        </span>
                                        <button onClick={() => toggleSlot(slot.id, slot.is_active)} title={slot.is_active ? "Disable" : "Enable"}
                                            style={{ border: "none", background: "none", cursor: "pointer", fontSize: "14px", padding: "2px" }}>
                                            {slot.is_active ? "🟢" : "⚪"}
                                        </button>
                                        <button onClick={() => deleteSlot(slot.id)} title="Remove"
                                            style={{ border: "none", background: "none", cursor: "pointer", fontSize: "14px", padding: "2px", color: "#ef4444" }}>
                                            ✕
                                        </button>
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
