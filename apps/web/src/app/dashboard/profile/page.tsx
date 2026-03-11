"use client";

import { AlertTriangle, CheckCircle, User, Edit2, ShieldAlert, MapPin, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, setSession, clearSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        dateOfBirth: "",
        sex: "",
        bio: "",
        headline: "",
        hourlyRate: "",
        yearsExperience: "",
        sports: [] as string[],
        skillLevel: "beginner",
        addressLine1: "",
        city: "",
        state: "",
        zipCode: "",
        travelRadius: "25",
        preferredTimes: [] as string[],
    });

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadProfile(session);
        }
    }, []);

    const [statusData, setStatusData] = useState({
        isPerformanceVerified: false,
        isPro: false,
        totalSessions: 0,
        disputeCount: 0
    });

    const loadProfile = async (u: AuthUser) => {
        const { data: userData } = await supabase.from("users").select("*").eq("id", u.id).single();

        if (u.role === "trainer" && u.trainerProfile) {
            const { data: tp } = await supabase.from("trainer_profiles").select("*").eq("user_id", u.id).single();
            
            // Fetch performance metrics
            const { data: disputes } = await supabase
                .from("disputes")
                .select("id, booking:bookings!inner(trainer_id)")
                .eq("booking.trainer_id", u.id);
            
            const dc = (disputes || []).length;
            const ts = tp?.total_sessions || 0;
            const isPerfVerified = ts >= 3 && dc === 0 && Number(tp?.completion_rate) >= 95 && Number(tp?.reliability_score) >= 95;

            setStatusData({
                isPerformanceVerified: isPerfVerified,
                isPro: ts > 0 && !isPerfVerified,
                totalSessions: ts,
                disputeCount: dc
            });

            setForm({
                firstName: userData?.first_name || "",
                lastName: userData?.last_name || "",
                phone: userData?.phone || "",
                dateOfBirth: userData?.date_of_birth || "",
                sex: userData?.sex || "",
                bio: tp?.bio || "",
                headline: tp?.headline || "",
                hourlyRate: String(tp?.hourly_rate || 50),
                yearsExperience: String(tp?.years_experience || 0),
                sports: tp?.sports || [],
                skillLevel: "beginner", // Trainers don't have a 'skill level' but form needs it
                addressLine1: tp?.city || "", // Mapping city/state for trainers too if available
                city: tp?.city || "",
                state: tp?.state || "",
                zipCode: "",
                travelRadius: String(tp?.travel_radius_miles || 25),
                preferredTimes: (tp as any)?.preferredTrainingTimes || [],
            });
        } else {
            const { data: ap } = await supabase.from("athlete_profiles").select("*").eq("user_id", u.id).single();
            setForm({
                firstName: userData?.first_name || "",
                lastName: userData?.last_name || "",
                phone: userData?.phone || "",
                dateOfBirth: userData?.date_of_birth || "",
                sex: userData?.sex || "",
                bio: "",
                headline: "",
                hourlyRate: "",
                yearsExperience: "",
                sports: ap?.sports || [],
                skillLevel: ap?.skill_level || "beginner",
                addressLine1: ap?.address_line1 || "",
                city: ap?.city || "",
                state: ap?.state || "",
                zipCode: ap?.zip_code || "",
                travelRadius: String(ap?.travel_radius_miles || 25),
                preferredTimes: (ap as any)?.preferredTrainingTimes || [],
            });
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        try {
            setError(null);
            const { error: userError } = await supabase.from("users").update({
                first_name: form.firstName,
                last_name: form.lastName,
                phone: form.phone || null,
                date_of_birth: form.dateOfBirth || null,
                sex: form.sex || null,
            }).eq("id", user.id);

            if (userError) throw userError;

            if (user.role === "trainer") {
                const profileUpdate = {
                    user_id: user.id,
                    bio: form.bio || null,
                    headline: form.headline || null,
                    hourly_rate: Number(form.hourlyRate),
                    years_experience: Number(form.yearsExperience),
                    sports: form.sports,
                    preferredTrainingTimes: form.preferredTimes,
                    travel_radius_miles: Number(form.travelRadius),
                };
                const { error: pError } = await supabase.from("trainer_profiles").upsert(profileUpdate, { onConflict: 'user_id' });
                if (pError) throw pError;
            } else {
                const profileUpdate = {
                    user_id: user.id,
                    sports: form.sports,
                    skill_level: form.skillLevel,
                    address_line1: form.addressLine1 || null,
                    city: form.city || null,
                    state: form.state || null,
                    zip_code: form.zipCode || null,
                    travel_radius_miles: Number(form.travelRadius),
                    preferredTrainingTimes: form.preferredTimes,
                };
                const { error: pError } = await supabase.from("athlete_profiles").upsert(profileUpdate, { onConflict: 'user_id' });
                if (pError) throw pError;
            }

            // Update session and local state
            const updatedUser: AuthUser = { 
                ...user, 
                firstName: form.firstName, 
                lastName: form.lastName,
                trainerProfile: user.role === "trainer" 
                    ? { ...(user.trainerProfile || {}), sports: form.sports, preferredTrainingTimes: form.preferredTimes } as any 
                    : user.trainerProfile,
                athleteProfile: user.role === "athlete" 
                    ? { ...(user.athleteProfile || {}), sports: form.sports, preferredTrainingTimes: form.preferredTimes, skill_level: form.skillLevel as any } as any 
                    : user.athleteProfile
            };
            setSession(updatedUser);
            setUser(updatedUser);
            setSaved(true);
            setEditing(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            console.error("Save failed:", err);
            setError(err.message || "Failed to save profile. Please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setDeleting(true);
        try {
            // Soft delete - update deleted_at timestamp
            await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);

            // Clear session and redirect to login
            await clearSession();
            router.push("/auth/login");
        } catch (err) {
            console.error("Failed to delete account:", err);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const SPORTS = [
        "hockey", "baseball", "basketball", "football", "soccer",
        "tennis", "golf", "swimming", "boxing", "lacrosse",
        "wrestling", "martial_arts", "gymnastics", "track_and_field", "volleyball",
    ];

    const isTrainer = user?.role === "trainer";

    return (
        <div className="max-w-[1000px] w-full pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">My Profile</h1>
                    <p className="text-text-main/60 font-medium text-[15px]">
                        Manage your personal information and {isTrainer ? "training profile" : "preferences"}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {editing ? (
                        <>
                            <button
                                onClick={() => setEditing(false)}
                                className="px-6 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all flex items-center gap-2 disabled:bg-primary/50"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-6 py-2.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500/20 transition-colors"
                            >
                                Delete Account
                            </button>
                            <button
                                onClick={() => setEditing(true)}
                                className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all flex items-center gap-2"
                            >
                                <Edit2 size={16} strokeWidth={3} />
                                Edit Profile
                            </button>
                        </>
                    )}
                </div>
            </div>

            {saved && (
                <div className="px-5 py-4 bg-primary/10 border border-primary/20 rounded-2xl text-primary text-sm font-bold mb-6 flex items-center shadow-[0_0_15px_rgba(163,255,18,0.05)] animate-in fade-in slide-in-from-top-4">
                    <CheckCircle className="w-5 h-5 mr-3 shrink-0" /> Profile updated successfully!
                </div>
            )}

            {error && (
                <div className="px-5 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold mb-6 flex items-center animate-in fade-in slide-in-from-top-4">
                    <AlertTriangle className="w-5 h-5 mr-3 shrink-0" /> {error}
                </div>
            )}

            {/* Profile Header */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 mb-6 shadow-md">
                <div className="flex gap-6 items-center flex-wrap">
                    <div className="w-24 h-24 rounded-full bg-primary text-bg flex items-center justify-center font-black text-[32px] font-display uppercase shadow-[0_0_20px_rgba(163,255,18,0.2)] shrink-0">
                        {form.firstName?.[0]}{form.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <h2 className="text-[28px] font-black font-display tracking-tight text-white mb-1">
                            {form.firstName} {form.lastName}
                        </h2>
                        <p className="text-text-main/50 text-[15px] font-medium mb-3">{user?.email}</p>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            <div className="flex items-center gap-1.5 text-text-main/60 text-[13px] font-medium">
                                <MapPin size={14} className="text-primary/70" />
                                <span>
                                    {form.city && form.state 
                                        ? `${form.city}, ${form.state}` 
                                        : form.addressLine1 || "Location not set"}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-center">
                            <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20 shadow-[0_0_10px_rgba(163,255,18,0.1)]">
                                {user?.role}
                            </span>
                            {isTrainer && (
                                <div className="flex gap-2 items-center flex-wrap">
                                    {statusData.isPerformanceVerified ? (
                                        <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(163,255,18,0.1)]">
                                            <CheckCircle size={14} strokeWidth={3} /> Performance Verified
                                        </span>
                                    ) : statusData.totalSessions > 0 ? (
                                        <span className="px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-widest border border-blue-500/20">
                                            Pro Coach
                                        </span>
                                    ) : (
                                        <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-black uppercase tracking-widest border border-emerald-500/20">
                                            New Trainer
                                        </span>
                                    )}
                                    {user?.trainerProfile?.is_verified && !statusData.isPerformanceVerified && (
                                        <span className="px-4 py-1.5 rounded-full bg-white/5 text-text-main/40 text-[10px] font-bold uppercase tracking-widest border border-white/5">
                                            Admin Approved
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 mb-6 shadow-md">
                <div className="flex items-center gap-3 mb-6">
                    <User size={20} className="text-primary" strokeWidth={2.5} />
                    <h3 className="text-[15px] font-black text-white tracking-widest uppercase">Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">First Name</label>
                        <input
                            value={form.firstName}
                            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                            disabled={!editing}
                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Last Name</label>
                        <input
                            value={form.lastName}
                            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                            disabled={!editing}
                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Date of Birth</label>
                        <input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                            disabled={!editing}
                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {form.dateOfBirth && (
                            <p className="mt-2 text-[10px] text-text-main/40 font-bold uppercase tracking-widest">
                                Age: {new Date().getFullYear() - new Date(form.dateOfBirth).getFullYear()} years old
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Sex</label>
                        <select
                            value={form.sex}
                            onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value }))}
                            disabled={!editing}
                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                        >
                            <option value="">Select Sex</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Phone</label>
                        <input
                            value={form.phone}
                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                            disabled={!editing}
                            placeholder="(555) 123-4567"
                            className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:placeholder:text-text-main/30"
                        />
                    </div>
                </div>
            </div>

            {/* Location Info (Athlete Only) */}
            {!isTrainer && (
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 mb-6 shadow-md">
                    <div className="flex items-center gap-3 mb-6">
                        <MapPin size={20} className="text-primary" strokeWidth={2.5} />
                        <h3 className="text-[15px] font-black text-white tracking-widest uppercase">Location Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Address</label>
                            <input
                                value={form.addressLine1}
                                onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))}
                                disabled={!editing}
                                placeholder="123 Training Way"
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">City</label>
                            <input
                                value={form.city}
                                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                                disabled={!editing}
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">State</label>
                                <input
                                    value={form.state}
                                    onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                                    disabled={!editing}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Zip Code</label>
                                <input
                                    value={form.zipCode}
                                    onChange={(e) => setForm((p) => ({ ...p, zipCode: e.target.value }))}
                                    disabled={!editing}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">
                                Travel Radius: <span className="text-primary">{form.travelRadius} miles</span>
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={form.travelRadius}
                                onChange={(e) => setForm((p) => ({ ...p, travelRadius: e.target.value }))}
                                disabled={!editing}
                                className="w-full h-2 bg-[#12141A] rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <div className="flex justify-between mt-2 text-[10px] font-bold text-text-main/30 tracking-widest">
                                <span>5 MI</span>
                                <span>100 MI</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Preferences (Athlete Only) */}
            {!isTrainer && (
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 mb-6 shadow-md">
                    <div className="flex items-center gap-3 mb-6">
                        <Clock size={20} className="text-primary" strokeWidth={2.5} />
                        <h3 className="text-[15px] font-black text-white tracking-widest uppercase">Training Preferences</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Skill Level</label>
                            <div className="grid grid-cols-2 gap-3">
                                {["beginner", "intermediate", "advanced", "pro"].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        disabled={!editing}
                                        onClick={() => setForm(p => ({ ...p, skillLevel: level }))}
                                        className={`px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                                            form.skillLevel === level 
                                                ? "bg-primary text-bg border-transparent shadow-[0_0_20px_rgba(163,255,18,0.3)]" 
                                                : "bg-[#12141A] border-white/5 text-text-main/40 hover:border-white/20"
                                        } disabled:cursor-not-allowed`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Preferred Times</label>
                            <div className="flex flex-col gap-3">
                                {["morning", "afternoon", "evening"].map((time) => {
                                    const selected = form.preferredTimes.includes(time);
                                    return (
                                        <button
                                            key={time}
                                            type="button"
                                            disabled={!editing}
                                            onClick={() => {
                                                setForm(p => ({
                                                    ...p,
                                                    preferredTimes: selected 
                                                        ? p.preferredTimes.filter(t => t !== time)
                                                        : [...p.preferredTimes, time]
                                                }));
                                            }}
                                            className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all ${
                                                selected 
                                                    ? "bg-primary text-bg border-transparent shadow-[0_0_20px_rgba(163,255,18,0.3)]" 
                                                    : "bg-[#12141A] border-white/5 hover:border-white/20"
                                            } disabled:cursor-not-allowed`}
                                        >
                                            <span className={`text-[11px] font-black uppercase tracking-wider ${selected ? "text-bg" : "text-text-main/40"}`}>
                                                {time}
                                            </span>
                                            {selected && <CheckCircle size={14} className="text-bg" strokeWidth={3} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trainer-specific fields (only visible if logged in as trainer) */}
            {isTrainer && (
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 mb-6 shadow-md">
                    <h3 className="text-[15px] font-black text-white tracking-widest uppercase mb-6">Training Profile</h3>
                    <div className="grid gap-6">
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Headline</label>
                            <input
                                value={form.headline}
                                onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                                disabled={!editing}
                                placeholder="e.g. Former NCAA D1 Player"
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Bio</label>
                            <textarea
                                value={form.bio}
                                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                                disabled={!editing}
                                placeholder="Tell athletes about your experience..."
                                className="w-full h-32 bg-[#12141A] border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Hourly Rate ($)</label>
                                <input
                                    type="number"
                                    value={form.hourlyRate}
                                    onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                                    disabled={!editing}
                                    min={10} max={500}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Years Experience</label>
                                <input
                                    type="number"
                                    value={form.yearsExperience}
                                    onChange={(e) => setForm((p) => ({ ...p, yearsExperience: e.target.value }))}
                                    disabled={!editing}
                                    min={0} max={50}
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sports */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                <h3 className="text-[15px] font-black text-white tracking-widest uppercase mb-6">Sports Interests</h3>
                <div className="flex flex-wrap gap-2.5">
                    {SPORTS.map((sport) => {
                        const selected = form.sports.includes(sport);
                        return (
                            <button
                                key={sport}
                                type="button"
                                disabled={!editing}
                                onClick={() => {
                                    if (!editing) return;
                                    setForm((p) => ({
                                        ...p,
                                        sports: selected ? p.sports.filter((s) => s !== sport) : [...p.sports, sport],
                                    }));
                                }}
                                className={`
                                    px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200
                                    ${selected
                                        ? "bg-primary text-bg shadow-[0_4px_15px_rgba(163,255,18,0.25)] border-transparent"
                                        : "bg-transparent border border-white/10 text-text-main/50"
                                    }
                                    ${editing ? (selected ? "hover:shadow-[0_4px_20px_rgba(163,255,18,0.4)] hover:-translate-y-0.5" : "hover:border-white/30 hover:text-white") : "cursor-default opacity-80"}
                                `}
                            >
                                {sport.replace(/_/g, " ")}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-[24px] p-8 w-full max-w-[420px] text-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert className="text-red-500 w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-[22px] font-black text-white tracking-tight mb-2">
                            Delete Account?
                        </h3>
                        <p className="text-text-main/60 text-sm mb-8 leading-relaxed px-2">
                            This action cannot be undone. Your account and all associated data will be permanently deleted.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="flex-1 px-6 py-3.5 rounded-xl border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex-1 px-6 py-3.5 rounded-xl bg-red-500 text-white font-black text-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center"
                            >
                                {deleting ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
