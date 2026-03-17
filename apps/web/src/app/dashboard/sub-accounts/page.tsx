"use client";

import { Users, XCircle, Plus, Edit2, Trash2 } from "lucide-react";
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
    created_at: string;
}

const MAX_SUB_ACCOUNTS = 6;
const SPORTS = ["hockey", "baseball", "basketball", "football", "soccer", "tennis", "golf", "swimming", "boxing", "lacrosse"];
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "pro"];

export default function SubAccountsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accounts, setAccounts] = useState<SubAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
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
        }
    }, []);

    const loadAccounts = async (u: AuthUser) => {
        try {
            const { data } = await supabase
                .from("sub_accounts")
                .select("*")
                .eq("parent_user_id", u.id)
                .order("created_at");
            setAccounts((data || []) as SubAccount[]);
        } catch (err) {
            console.error("Failed to load sub-accounts:", err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({ first_name: "", last_name: "", age: "", sport: "hockey", skill_level: "beginner", notes: "" });
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

        const profileData = {
            first_name: form.first_name,
            last_name: form.last_name,
            age: form.age ? Number(form.age) : undefined,
            sport: form.sport,
            skill_level: form.skill_level,
            notes: form.notes || undefined,
        };

        try {
            if (editingId) {
                await supabase.from("sub_accounts").update({ profile_data: profileData }).eq("id", editingId);
                setAccounts((prev) =>
                    prev.map((a) => (a.id === editingId ? { ...a, profile_data: profileData } : a))
                );
            } else {
                const { data, error } = await supabase
                    .from("sub_accounts")
                    .insert({
                        parent_user_id: user.id,
                        profile_data: profileData,
                        max_bookings_per_month: 10,
                    })
                    .select()
                    .single();

                if (error) throw error;
                setAccounts((prev) => [...prev, data as SubAccount]);
            }
            resetForm();
        } catch (err) {
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
            const { error } = await supabase.from("sub_accounts").delete().eq("id", id);
            if (error) throw error;
            // Refetch from server to ensure UI is in sync with database
            if (user) await loadAccounts(user);
        } catch (err) {
            console.error("Delete failed:", err);
            setDeleteError("Failed to delete sub-account. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const inputStyle = "w-full bg-[#272A35] border border-white/5 rounded-xl text-sm text-text-main p-4 outline-none focus:border-primary/50 transition-colors";

    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
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
                        <Plus size={16} strokeWidth={3} /> Add Sub-Account
                    </button>
                )}
            </div>

            {/* Capacity bar */}
            <div className="mb-8">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${accounts.length >= MAX_SUB_ACCOUNTS ? "bg-orange-500" : "bg-primary"}`}
                        style={{ width: `${(accounts.length / MAX_SUB_ACCOUNTS) * 100}%` }}
                    />
                </div>
            </div>

            {/* Add/Edit form */}
            {showForm && (
                <div className="bg-surface rounded-2xl border border-primary/30 p-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-300 shadow-[0_0_30px_rgba(69,208,255,0.05)]">
                    <h3 className="text-lg font-black font-display uppercase tracking-wider mb-6">
                        {editingId ? "Edit Sub-Account" : "New Sub-Account"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">First Name *</label>
                            <input
                                value={form.first_name}
                                onChange={(e) => { setForm((p) => ({ ...p, first_name: e.target.value })); setFormErrors((p) => ({ ...p, first_name: "" })); }}
                                className={`${inputStyle} ${formErrors.first_name ? 'border-red-500/50 focus:border-red-500' : ''}`}
                                placeholder="First name"
                            />
                            {formErrors.first_name && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.first_name}</span>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Last Name *</label>
                            <input
                                value={form.last_name}
                                onChange={(e) => { setForm((p) => ({ ...p, last_name: e.target.value })); setFormErrors((p) => ({ ...p, last_name: "" })); }}
                                className={`${inputStyle} ${formErrors.last_name ? 'border-red-500/50 focus:border-red-500' : ''}`}
                                placeholder="Last name"
                            />
                            {formErrors.last_name && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.last_name}</span>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Age</label>
                            <input
                                type="number"
                                value={form.age}
                                onChange={(e) => { setForm((p) => ({ ...p, age: e.target.value })); setFormErrors((p) => ({ ...p, age: "" })); }}
                                className={`${inputStyle} ${formErrors.age ? 'border-red-500/50 focus:border-red-500' : ''}`}
                                min={3} max={99}
                                placeholder="Age"
                            />
                            {formErrors.age && <span className="text-[11px] text-red-500 font-bold mt-1.5 block">{formErrors.age}</span>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Primary Sport</label>
                            <select value={form.sport} onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value }))} className={inputStyle}>
                                {SPORTS.map((s) => (
                                    <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Skill Level</label>
                            <select value={form.skill_level} onChange={(e) => setForm((p) => ({ ...p, skill_level: e.target.value }))} className={inputStyle}>
                                {SKILL_LEVELS.map((l) => (
                                    <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-text-main/40 uppercase tracking-widest mb-2">Notes</label>
                            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputStyle} placeholder="Any special notes or considerations" />
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 sm:justify-end">
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 rounded-xl border border-white/5 bg-surface text-text-main/60 font-bold text-sm hover:text-text-main hover:border-white/10 transition-colors w-full sm:w-auto"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveAccount}
                            disabled={saving || !form.first_name || !form.last_name}
                            className={`px-8 py-3 rounded-xl bg-primary text-bg font-bold text-sm transition-all w-full sm:w-auto ${(!form.first_name || !form.last_name) ? "opacity-30 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(69,208,255,0.3)]"
                                }`}
                        >
                            {saving ? "Saving..." : editingId ? "Update Account" : "Create Sub-Account"}
                        </button>
                    </div>
                </div>
            )}

            {/* Account cards */}
            {accounts.length === 0 && !showForm ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center">
                    <Users className="text-text-main/20 w-16 h-16 mb-6 mx-auto" strokeWidth={1} />
                    <h3 className="text-xl font-black font-display uppercase tracking-wider mb-3">No sub-accounts yet</h3>
                    <p className="text-text-main/60 text-sm mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                        Add up to 6 family members who can book sessions under your account.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-bg font-bold text-sm hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all"
                    >
                        <Plus size={18} strokeWidth={3} /> Add First Sub-Account
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {accounts.map((acct) => (
                        <div key={acct.id} className="bg-surface rounded-2xl border border-white/5 p-6 flex flex-col hover:border-white/10 transition-colors group">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-14 h-14 rounded-full bg-[#272A35] border border-white/5 flex items-center justify-center text-primary font-black text-xl shadow-[0_0_10px_rgba(69,208,255,0.05)]">
                                    {acct.profile_data.first_name?.[0]}{acct.profile_data.last_name?.[0]}
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-text-main font-display mb-1">
                                        {acct.profile_data.first_name} {acct.profile_data.last_name}
                                    </h4>
                                    {acct.profile_data.age && (
                                        <span className="text-xs text-text-main/50 font-medium tracking-widest uppercase">Age {acct.profile_data.age}</span>
                                    )}
                                </div>
                            </div>

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

                            {acct.profile_data.notes && (
                                <div className="mb-6 flex-1 bg-[#272A35] p-4 rounded-xl border border-white/5">
                                    <p className="text-sm text-text-main/70 font-medium leading-relaxed">
                                        {acct.profile_data.notes}
                                    </p>
                                </div>
                            )} {!acct.profile_data.notes && <div className="flex-1" />}

                            <div className="flex justify-between gap-3 mt-auto pt-5 border-t border-white/5">
                                <button
                                    onClick={() => startEdit(acct)}
                                    disabled={deletingId === acct.id}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-text-main/80 text-xs font-bold hover:bg-white/10 hover:text-text-main transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => deleteAccount(acct.id)}
                                    disabled={deletingId === acct.id}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {deletingId === acct.id ? "Removing..." : <><Trash2 size={14} /> Remove</>}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {deleteError && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="text-sm font-bold text-red-500">{deleteError}</span>
                </div>
            )}
        </div>
    );
}
