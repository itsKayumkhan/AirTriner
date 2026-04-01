"use client";

import { Users, XCircle, Plus, Edit2, Trash2, AlertTriangle, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface SubAccount {
    id: string;
    parent_user_id: string;
    profile_data: {
        first_name: string;
        last_name: string;
        age?: number;
        sport?: string;
        skill_level?: string;
        notes?: string;
    };
    max_bookings_per_month: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const MAX_SUB_ACCOUNTS = 6;
const SPORTS = ["hockey", "baseball", "basketball", "football", "soccer", "tennis", "golf", "swimming", "boxing", "lacrosse"];
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "pro"];

/** Returns true if the Supabase error indicates the table does not exist. */
function isTableMissingError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const e = err as Record<string, unknown>;
    const code = e.code as string | undefined;
    const msg = (e.message as string | undefined) ?? "";
    // PostgreSQL error code 42P01 = undefined_table
    return code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation");
}

export default function SubAccountsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accounts, setAccounts] = useState<SubAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableError, setTableError] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        age: "",
        sport: "hockey",
        skill_level: "beginner",
        notes: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadAccounts(session);
        } else {
            setLoading(false);
        }
    }, []);

    const loadAccounts = async (u: AuthUser) => {
        setLoadError(null);
        try {
            const { data, error } = await supabase
                .from("sub_accounts")
                .select("*")
                .eq("parent_user_id", u.id)
                .eq("is_active", true)
                .order("created_at");

            if (error) {
                if (isTableMissingError(error)) {
                    setTableError(true);
                } else {
                    setLoadError(error.message || "Failed to load sub-accounts.");
                }
                return;
            }
            setAccounts((data || []) as SubAccount[]);
        } catch (err) {
            if (isTableMissingError(err)) {
                setTableError(true);
            } else {
                setLoadError("An unexpected error occurred while loading sub-accounts.");
                console.error("Failed to load sub-accounts:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({ first_name: "", last_name: "", age: "", sport: "hockey", skill_level: "beginner", notes: "" });
        setFormErrors({});
        setSaveError(null);
        setEditingId(null);
        setShowForm(false);
    };

    const startEdit = (acct: SubAccount) => {
        setForm({
            first_name: acct.profile_data.first_name || "",
            last_name: acct.profile_data.last_name || "",
            age: String(acct.profile_data.age || ""),
            sport: acct.profile_data.sport || "hockey",
            skill_level: acct.profile_data.skill_level || "beginner",
            notes: acct.profile_data.notes || "",
        });
        setSaveError(null);
        setEditingId(acct.id);
        setShowForm(true);
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!form.first_name.trim()) {
            errors.first_name = "First name is required";
        } else if (form.first_name.trim().length < 2) {
            errors.first_name = "First name must be at least 2 characters";
        }

        if (!form.last_name.trim()) {
            errors.last_name = "Last name is required";
        } else if (form.last_name.trim().length < 2) {
            errors.last_name = "Last name must be at least 2 characters";
        }

        if (form.age && (Number(form.age) < 3 || Number(form.age) > 99)) {
            errors.age = "Age must be between 3 and 99";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveAccount = async () => {
        if (!user || !validateForm()) return;
        setSaving(true);
        setSaveError(null);

        const profileData = {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            age: form.age ? Number(form.age) : undefined,
            sport: form.sport,
            skill_level: form.skill_level,
            notes: form.notes.trim() || undefined,
        };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from("sub_accounts")
                    .update({ profile_data: profileData, updated_at: new Date().toISOString() })
                    .eq("id", editingId);

                if (error) throw error;

                setAccounts((prev) =>
                    prev.map((a) => (a.id === editingId ? { ...a, profile_data: profileData } : a))
                );
            } else {
                if (accounts.length >= MAX_SUB_ACCOUNTS) {
                    setSaveError(`You can only have up to ${MAX_SUB_ACCOUNTS} sub-accounts.`);
                    return;
                }
                const { data, error } = await supabase
                    .from("sub_accounts")
                    .insert({
                        parent_user_id: user.id,
                        profile_data: profileData,
                        max_bookings_per_month: 10,
                        is_active: true,
                    })
                    .select()
                    .single();

                if (error) throw error;
                setAccounts((prev) => [...prev, data as SubAccount]);
            }
            resetForm();
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err
                ? (err as { message: string }).message
                : "Failed to save. Please try again.";
            setSaveError(msg);
            console.error("Save failed:", err);
        } finally {
            setSaving(false);
        }
    };

    const deleteAccount = async (id: string) => {
        if (!confirm("Remove this sub-account? This cannot be undone.")) return;
        setDeletingId(id);
        setDeleteError(null);
        try {
            // Soft-delete: mark is_active = false instead of hard delete
            const { error } = await supabase
                .from("sub_accounts")
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq("id", id);

            if (error) throw error;

            // Remove from local state immediately — no need to refetch
            setAccounts((prev) => prev.filter((a) => a.id !== id));
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err
                ? (err as { message: string }).message
                : "Failed to remove sub-account. Please try again.";
            setDeleteError(msg);
            console.error("Delete failed:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const inputStyle = "w-full bg-[#272A35] border border-white/5 rounded-xl text-sm text-text-main p-4 outline-none focus:border-primary/50 transition-colors";

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    // ── Table missing — feature not yet set up in DB ──────────────────────────
    if (tableError) {
        return (
            <div>
                <div className="mb-8">
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">Sub-Accounts</h1>
                    <p className="text-text-main/60 text-sm">Manage profiles for family members</p>
                </div>

                <div className="bg-surface rounded-2xl border border-white/5 p-10 text-center max-w-lg mx-auto">
                    <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black font-display uppercase tracking-wider mb-3">
                        Family Accounts
                    </h3>
                    <p className="text-text-main/60 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
                        Add up to 6 family members under your account. Each member can book sessions and billing goes directly to your account.
                    </p>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
                        <div className="flex gap-3 items-start">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Setup Required</p>
                                <p className="text-xs text-text-main/60 leading-relaxed">
                                    The <code className="font-mono bg-white/5 px-1 rounded">sub_accounts</code> table needs to be created in your database. Run the migration below to enable this feature.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#272A35] rounded-xl border border-white/5 p-4 text-left mb-6">
                        <p className="text-[10px] font-bold text-text-main/30 uppercase tracking-widest mb-2">Migration SQL</p>
                        <pre className="text-xs text-primary/80 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{`CREATE TABLE IF NOT EXISTS sub_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_data jsonb NOT NULL DEFAULT '{}',
  max_bookings_per_month int DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON sub_accounts(parent_user_id);`}</pre>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-text-main/40 justify-center">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Run this in your Supabase SQL editor, then refresh this page.</span>
                    </div>
                </div>

                {/* Feature preview cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    {[
                        { title: "Family Profiles", desc: "Create up to 6 profiles for family members with their sport preferences and skill levels." },
                        { title: "Shared Billing", desc: "All bookings made by sub-accounts are billed to your main account automatically." },
                        { title: "Session Booking", desc: "Sub-accounts can be selected during checkout to book sessions under their profile." },
                    ].map((f) => (
                        <div key={f.title} className="bg-surface rounded-2xl border border-white/5 p-5 opacity-60">
                            <h4 className="font-bold text-sm mb-2 text-text-main">{f.title}</h4>
                            <p className="text-xs text-text-main/50 leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Generic load error ────────────────────────────────────────────────────
    if (loadError) {
        return (
            <div>
                <div className="mb-8">
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">Sub-Accounts</h1>
                    <p className="text-text-main/60 text-sm">Manage profiles for family members</p>
                </div>
                <div className="bg-surface rounded-2xl border border-red-500/20 p-10 text-center">
                    <XCircle className="w-12 h-12 text-red-500/60 mx-auto mb-4" strokeWidth={1} />
                    <h3 className="font-bold text-lg mb-2">Failed to load sub-accounts</h3>
                    <p className="text-sm text-text-main/50 mb-6">{loadError}</p>
                    <button
                        onClick={() => { if (user) { setLoading(true); loadAccounts(user); } }}
                        className="px-6 py-3 rounded-xl bg-primary text-bg font-bold text-sm hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ── Main UI ───────────────────────────────────────────────────────────────
    return (
        <div>
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black font-display tracking-wider mb-1">Sub-Accounts</h1>
                    <p className="text-text-main/60 text-sm">
                        Manage profiles for family members ({accounts.length}/{MAX_SUB_ACCOUNTS} used)
                    </p>
                </div>
                {accounts.length < MAX_SUB_ACCOUNTS && !showForm && (
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-bg font-bold text-sm hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all"
                    >
                        <Plus size={16} strokeWidth={3} /> Add Member
                    </button>
                )}
            </div>

            {/* Capacity bar */}
            {accounts.length > 0 && (
                <div className="mb-8">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${accounts.length >= MAX_SUB_ACCOUNTS ? "bg-orange-500" : "bg-primary"}`}
                            style={{ width: `${(accounts.length / MAX_SUB_ACCOUNTS) * 100}%` }}
                        />
                    </div>
                    {accounts.length >= MAX_SUB_ACCOUNTS && (
                        <p className="text-xs text-orange-400 font-bold mt-2">
                            Maximum sub-accounts reached. Remove one to add another.
                        </p>
                    )}
                </div>
            )}

            {/* Add / Edit form */}
            {showForm && (
                <div className="bg-surface rounded-2xl border border-primary/30 p-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-300 shadow-[0_0_30px_rgba(69,208,255,0.05)]">
                    <h3 className="text-lg font-black font-display uppercase tracking-wider mb-6">
                        {editingId ? "Edit Member" : "Add Family Member"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* First name */}
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">First Name *</label>
                            <input
                                value={form.first_name}
                                onChange={(e) => { setForm((p) => ({ ...p, first_name: e.target.value })); setFormErrors((p) => ({ ...p, first_name: "" })); }}
                                className={`${inputStyle} ${formErrors.first_name ? "border-red-500/50 focus:border-red-500" : ""}`}
                                placeholder="First name"
                                autoFocus
                            />
                            {formErrors.first_name && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.first_name}</span>}
                        </div>
                        {/* Last name */}
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Last Name *</label>
                            <input
                                value={form.last_name}
                                onChange={(e) => { setForm((p) => ({ ...p, last_name: e.target.value })); setFormErrors((p) => ({ ...p, last_name: "" })); }}
                                className={`${inputStyle} ${formErrors.last_name ? "border-red-500/50 focus:border-red-500" : ""}`}
                                placeholder="Last name"
                            />
                            {formErrors.last_name && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.last_name}</span>}
                        </div>
                        {/* Age */}
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Age</label>
                            <input
                                type="number"
                                value={form.age}
                                onChange={(e) => { setForm((p) => ({ ...p, age: e.target.value })); setFormErrors((p) => ({ ...p, age: "" })); }}
                                className={`${inputStyle} ${formErrors.age ? "border-red-500/50 focus:border-red-500" : ""}`}
                                min={3} max={99}
                                placeholder="Age (optional)"
                            />
                            {formErrors.age && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.age}</span>}
                        </div>
                        {/* Primary sport */}
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Primary Sport</label>
                            <select value={form.sport} onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value }))} className={inputStyle}>
                                {SPORTS.map((s) => (
                                    <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                                ))}
                            </select>
                        </div>
                        {/* Skill level */}
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Skill Level</label>
                            <select value={form.skill_level} onChange={(e) => setForm((p) => ({ ...p, skill_level: e.target.value }))} className={inputStyle}>
                                {SKILL_LEVELS.map((l) => (
                                    <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        {/* Notes */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Notes</label>
                            <input
                                value={form.notes}
                                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                                className={inputStyle}
                                placeholder="Injuries, preferences, or any special notes"
                            />
                        </div>
                    </div>

                    {/* Save error */}
                    {saveError && (
                        <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-xs font-bold text-red-400">{saveError}</span>
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 sm:justify-end">
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 rounded-xl border border-white/5 bg-surface text-text-main/60 font-bold text-sm hover:text-text-main hover:border-white/10 transition-colors w-full sm:w-auto"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveAccount}
                            disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                            className={`px-8 py-3 rounded-xl bg-primary text-bg font-bold text-sm transition-all w-full sm:w-auto ${(!form.first_name.trim() || !form.last_name.trim()) ? "opacity-30 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(69,208,255,0.3)]"}`}
                        >
                            {saving ? "Saving..." : editingId ? "Update Member" : "Add Member"}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {accounts.length === 0 && !showForm && (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black font-display uppercase tracking-wider mb-3">
                        No family members yet
                    </h3>
                    <p className="text-text-main/60 text-sm mb-2 max-w-sm mx-auto font-medium leading-relaxed">
                        Add up to {MAX_SUB_ACCOUNTS} family members who can book sessions under your account.
                    </p>
                    <p className="text-text-main/40 text-xs mb-8 max-w-xs mx-auto leading-relaxed">
                        All sessions booked by family members are billed to your account.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-bg font-bold text-sm hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all"
                    >
                        <Plus size={18} strokeWidth={3} /> Add First Member
                    </button>

                    {/* Feature hints */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 text-left">
                        {[
                            { title: "Shared Billing", desc: "Billing goes to the parent account automatically." },
                            { title: "Individual Profiles", desc: "Each member has their own sport and skill settings." },
                            { title: "Easy Booking", desc: "Select a family member when booking a session." },
                        ].map((f) => (
                            <div key={f.title} className="bg-[#272A35] rounded-xl border border-white/5 p-4">
                                <p className="text-xs font-black text-text-main/60 uppercase tracking-widest mb-1">{f.title}</p>
                                <p className="text-xs text-text-main/40 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Account cards */}
            {accounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {accounts.map((acct) => (
                        <div
                            key={acct.id}
                            className="bg-surface rounded-2xl border border-white/5 p-6 flex flex-col hover:border-white/10 transition-colors group"
                        >
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-14 h-14 rounded-full bg-[#272A35] border border-white/5 flex items-center justify-center text-primary font-black text-xl shadow-[0_0_10px_rgba(69,208,255,0.05)] shrink-0">
                                    {(acct.profile_data.first_name?.[0] ?? "").toUpperCase()}
                                    {(acct.profile_data.last_name?.[0] ?? "").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-lg text-text-main font-display mb-0.5 truncate">
                                        {acct.profile_data.first_name} {acct.profile_data.last_name}
                                    </h4>
                                    {acct.profile_data.age ? (
                                        <span className="text-xs text-text-main/50 font-medium tracking-widest uppercase">
                                            Age {acct.profile_data.age}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-main/30 font-medium italic">No age set</span>
                                    )}
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-5">
                                {acct.profile_data.sport && (
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest">
                                        {acct.profile_data.sport.replace(/_/g, " ")}
                                    </span>
                                )}
                                {acct.profile_data.skill_level && (
                                    <span className="px-3 py-1 rounded-full bg-white/5 text-text-main/60 border border-white/5 text-[10px] font-black uppercase tracking-widest">
                                        {acct.profile_data.skill_level}
                                    </span>
                                )}
                            </div>

                            {/* Notes */}
                            {acct.profile_data.notes ? (
                                <div className="mb-5 flex-1 bg-[#272A35] p-4 rounded-xl border border-white/5">
                                    <p className="text-xs text-text-main/50 font-medium uppercase tracking-widest mb-1">Notes</p>
                                    <p className="text-sm text-text-main/70 font-medium leading-relaxed line-clamp-3">
                                        {acct.profile_data.notes}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1" />
                            )}

                            {/* Actions */}
                            <div className="flex justify-between gap-3 mt-auto pt-5 border-t border-white/5">
                                <button
                                    onClick={() => startEdit(acct)}
                                    disabled={deletingId === acct.id}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-text-main/80 text-xs font-bold hover:bg-white/10 hover:text-text-main transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Edit2 size={13} /> Edit
                                </button>
                                <button
                                    onClick={() => deleteAccount(acct.id)}
                                    disabled={deletingId === acct.id}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {deletingId === acct.id
                                        ? <><div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> Removing...</>
                                        : <><Trash2 size={13} /> Remove</>
                                    }
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete error toast */}
            {deleteError && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="text-sm font-bold text-red-400">{deleteError}</span>
                    <button onClick={() => setDeleteError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
                        <XCircle size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
