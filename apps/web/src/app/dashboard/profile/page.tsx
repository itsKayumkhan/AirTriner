"use client";

import { AlertTriangle, CheckCircle, User, ShieldAlert, MapPin, Clock, Eye, Save, Camera } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { getSession, setSession, clearSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { type LocationValue } from "@/components/forms/LocationAutocomplete";
import { detectCountry, radiusUnit, formatRadius, kmToMi, miToKm } from "@/lib/units";
import { toast } from "@/components/ui/Toast";

const FALLBACK_SPORTS: { id: string; name: string; slug: string }[] = [
    { id: "hockey", name: "Hockey", slug: "hockey" },
    { id: "baseball", name: "Baseball", slug: "baseball" },
    { id: "basketball", name: "Basketball", slug: "basketball" },
    { id: "football", name: "Football", slug: "football" },
    { id: "soccer", name: "Soccer", slug: "soccer" },
    { id: "tennis", name: "Tennis", slug: "tennis" },
    { id: "golf", name: "Golf", slug: "golf" },
    { id: "swimming", name: "Swimming", slug: "swimming" },
    { id: "boxing", name: "Boxing", slug: "boxing" },
    { id: "lacrosse", name: "Lacrosse", slug: "lacrosse" },
    { id: "wrestling", name: "Wrestling", slug: "wrestling" },
    { id: "martial_arts", name: "Martial Arts", slug: "martial_arts" },
    { id: "gymnastics", name: "Gymnastics", slug: "gymnastics" },
    { id: "track_and_field", name: "Track and Field", slug: "track_and_field" },
    { id: "volleyball", name: "Volleyball", slug: "volleyball" },
];

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [saving, setSaving] = useState(false);
    const [sportsList, setSportsList] = useState<{ id: string; name: string; slug: string }[]>([]);
    const [sportsLoading, setSportsLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const initialFormRef = useRef<typeof form | null>(null);
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
        country: "",
        latitude: null as number | null,
        longitude: null as number | null,
        travelRadius: "25",
        preferredTimes: [] as string[],
    });
    // Local display value for travel radius (may differ from stored miles when country is CA)
    const [displayRadius, setDisplayRadius] = useState("25");

    useEffect(() => {
        const fetchSports = async () => {
            setSportsLoading(true);
            const { data, error } = await supabase
                .from("sports")
                .select("id, name, slug")
                .eq("is_active", true)
                .order("name");
            if (error || !data || data.length === 0) {
                setSportsList(FALLBACK_SPORTS);
            } else {
                setSportsList(data as { id: string; name: string; slug: string }[]);
            }
            setSportsLoading(false);
        };

        fetchSports();

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
        if (userData?.avatar_url) setAvatarUrl(userData.avatar_url);
        let loaded: typeof form;

        if (u.role === "trainer" && u.trainerProfile) {
            const { data: tp } = await supabase.from("trainer_profiles").select("*").eq("user_id", u.id).single();
            const { data: disputes } = await supabase
                .from("disputes")
                .select("id, booking:bookings!inner(trainer_id)")
                .eq("booking.trainer_id", u.id);
            const dc = (disputes || []).length;
            const ts = tp?.total_sessions || 0;
            const isPerfVerified = ts >= 3 && dc === 0 && Number(tp?.completion_rate) >= 95 && Number(tp?.reliability_score) >= 95;
            setStatusData({ isPerformanceVerified: isPerfVerified, isPro: ts > 0 && !isPerfVerified, totalSessions: ts, disputeCount: dc });
            const loadedZip = (tp as any)?.zip_code || "";
            const loadedCountry = (tp as any)?.country || detectCountry(loadedZip);
            const storedMiles = Number(tp?.travel_radius_miles || 25);
            loaded = {
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
                skillLevel: "beginner",
                addressLine1: tp?.city || "",
                city: tp?.city || "",
                state: tp?.state || "",
                zipCode: loadedZip,
                country: loadedCountry,
                latitude: tp?.latitude ?? null,
                longitude: tp?.longitude ?? null,
                travelRadius: String(storedMiles),
                preferredTimes: (tp as any)?.preferredTrainingTimes || [],
            };
            // Hydrate display radius: if CA, show km equivalent
            if (loadedCountry === "CA") {
                setDisplayRadius(String(Math.round(miToKm(storedMiles))));
            } else {
                setDisplayRadius(String(storedMiles));
            }
        } else {
            const { data: ap } = await supabase.from("athlete_profiles").select("*").eq("user_id", u.id).single();
            const loadedZip = ap?.zip_code || "";
            const loadedCountry = (ap as any)?.country || detectCountry(loadedZip);
            const storedMiles = Number(ap?.travel_radius_miles || 25);
            loaded = {
                firstName: userData?.first_name || "",
                lastName: userData?.last_name || "",
                phone: userData?.phone || "",
                dateOfBirth: userData?.date_of_birth || "",
                sex: userData?.sex || "",
                bio: (ap as any)?.bio || "",
                headline: "",
                hourlyRate: "",
                yearsExperience: "",
                sports: ap?.sports || [],
                skillLevel: ap?.skill_level || "beginner",
                addressLine1: ap?.address_line1 || "",
                city: ap?.city || "",
                state: ap?.state || "",
                zipCode: loadedZip,
                country: loadedCountry,
                latitude: (ap as any)?.latitude ?? null,
                longitude: (ap as any)?.longitude ?? null,
                travelRadius: String(storedMiles),
                preferredTimes: (ap as any)?.preferredTrainingTimes || [],
            };
            // Hydrate display radius: if CA, show km equivalent
            if (loadedCountry === "CA") {
                setDisplayRadius(String(Math.round(miToKm(storedMiles))));
            } else {
                setDisplayRadius(String(storedMiles));
            }
        }
        setForm(loaded);
        initialFormRef.current = loaded;
        setIsDirty(false);
    };

    const updateForm = (patch: Partial<typeof form>) => {
        const changedKeys = Object.keys(patch);
        if (changedKeys.length > 0) {
            setFieldErrors(prev => {
                const next = { ...prev };
                changedKeys.forEach(k => delete next[k]);
                return next;
            });
        }
        setForm(p => {
            const next = { ...p, ...patch };
            setIsDirty(JSON.stringify(next) !== JSON.stringify(initialFormRef.current));
            return next;
        });
    };

    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        if (!form.firstName.trim()) errors.firstName = "First name is required";
        else if (form.firstName.trim().length < 2) errors.firstName = "Must be at least 2 characters";

        if (!form.lastName.trim()) errors.lastName = "Last name is required";
        else if (form.lastName.trim().length < 2) errors.lastName = "Must be at least 2 characters";

        if (form.phone && !/^\+?[\d\s\-()\/.]{10,}$/.test(form.phone))
            errors.phone = "Enter a valid phone number (10+ digits)";

        if (form.dateOfBirth) {
            const dob = new Date(form.dateOfBirth);
            const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            if (isNaN(dob.getTime())) errors.dateOfBirth = "Invalid date";
            else if (age < 5) errors.dateOfBirth = "Age must be at least 5 years";
            else if (age > 120) errors.dateOfBirth = "Invalid date of birth";
        }

        if (form.zipCode) {
            const zipCountry = detectCountry(form.zipCode);
            if (zipCountry === "OTHER") {
                errors.zipCode = "Enter a valid US ZIP (e.g. 90210) or Canadian postal code (e.g. K0L 1B0)";
            } else if (form.country && form.country !== zipCountry) {
                const countryName = form.country === "CA" ? "Canada" : form.country === "US" ? "the US" : form.country;
                errors.zipCode = `Your city is in ${countryName} — postal code doesn't match`;
            }
        }

        if (user?.role === "trainer") {
            if (!form.hourlyRate || isNaN(Number(form.hourlyRate)))
                errors.hourlyRate = "Hourly rate is required";
            else if (Number(form.hourlyRate) < 10)
                errors.hourlyRate = "Minimum rate is $10/hr";
            else if (Number(form.hourlyRate) > 1000)
                errors.hourlyRate = "Maximum rate is $1000/hr";

            if (form.yearsExperience === "" || isNaN(Number(form.yearsExperience)))
                errors.yearsExperience = "Years of experience is required";
            else if (Number(form.yearsExperience) < 0 || Number(form.yearsExperience) > 60)
                errors.yearsExperience = "Must be between 0 and 60 years";

            if (!form.headline.trim()) errors.headline = "Headline is required";
            else if (form.headline.trim().length < 5) errors.headline = "Headline must be at least 5 characters";

            if (form.sports.length === 0) errors.sports = "Select at least one sport";
        }

        if (user?.role === "athlete") {
            if (form.sports.length === 0) errors.sports = "Select at least one sport";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!user) return;
        if (!validate()) {
            toast.error("Please fix the highlighted fields below before saving.");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        setSaving(true);
        try {
            const userUpdate: Record<string, unknown> = {
                first_name: form.firstName,
                last_name: form.lastName,
                phone: form.phone || null,
                date_of_birth: form.dateOfBirth || null,
                sex: form.sex || null,
            };
            if (avatarUrl) userUpdate.avatar_url = avatarUrl;
            const { error: userError } = await supabase.from("users").update(userUpdate).eq("id", user.id);
            if (userError) throw userError;

            if (user.role === "trainer") {
                const profileUpdate: Record<string, unknown> = {
                    user_id: user.id,
                    bio: form.bio || null,
                    headline: form.headline || null,
                    hourly_rate: Number(form.hourlyRate),
                    years_experience: Number(form.yearsExperience),
                    sports: form.sports,
                    preferredTrainingTimes: form.preferredTimes,
                    travel_radius_miles: Number(form.travelRadius),
                    city: form.city || null,
                    state: form.state || null,
                    zip_code: form.zipCode || null,
                };
                // Persist location fields if provided
                if (form.country || form.latitude != null || form.longitude != null) {
                    profileUpdate.country = form.country || null;
                    profileUpdate.latitude = form.latitude;
                    profileUpdate.longitude = form.longitude;
                }
                const { error: pError } = await supabase.from("trainer_profiles").upsert(profileUpdate, { onConflict: 'user_id' });
                if (pError) throw pError;
            } else {
                // Storage is always in miles; form.travelRadius is already in miles
                const profileUpdate: Record<string, unknown> = {
                    user_id: user.id,
                    bio: form.bio || null,
                    sports: form.sports,
                    skill_level: form.skillLevel,
                    address_line1: form.addressLine1 || null,
                    city: form.city || null,
                    state: form.state || null,
                    zip_code: form.zipCode || null,
                    travel_radius_miles: Number(form.travelRadius),
                    preferredTrainingTimes: form.preferredTimes,
                };

                // Attempt to persist location fields; retry without them if columns don't exist yet
                if (form.country || form.latitude != null || form.longitude != null) {
                    profileUpdate.country = form.country || null;
                    profileUpdate.latitude = form.latitude;
                    profileUpdate.longitude = form.longitude;
                }

                const { error: pError } = await supabase.from("athlete_profiles").upsert(profileUpdate, { onConflict: 'user_id' });
                if (pError) {
                    // If Supabase rejects due to missing columns, retry without location fields
                    if (pError.message?.includes("column") || pError.code === "42703") {
                        console.warn("athlete_profiles missing country/latitude/longitude columns — saving without them. Run migration to add these columns.");
                        delete profileUpdate.country;
                        delete profileUpdate.latitude;
                        delete profileUpdate.longitude;
                        const { error: retryError } = await supabase.from("athlete_profiles").upsert(profileUpdate, { onConflict: 'user_id' });
                        if (retryError) throw retryError;
                    } else {
                        throw pError;
                    }
                }
            }

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
            initialFormRef.current = form;
            setIsDirty(false);
            toast.success("Profile updated successfully!");
            setSaved(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            console.error("Save failed:", err);
            toast.error(err.message || "Failed to save profile. Please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setDeleting(true);
        try {
            await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
            await clearSession();
            router.push("/auth/login");
        } catch (err) {
            console.error("Failed to delete account:", err);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Please upload a PNG, JPEG, or WebP image.");
            return;
        }
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB.");
            return;
        }

        setAvatarUploading(true);
        try {
            const result = await uploadToCloudinary(file, "airtrainer/avatars", { resourceType: "image" });
            const url = result.url;

            const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", user.id);
            if (error) throw error;

            setAvatarUrl(url);
            // Update session
            const updated = { ...user, avatarUrl: url } as AuthUser;
            setSession(updated);
            setUser(updated);
            toast.success("Profile photo updated!");
        } catch (err: any) {
            console.error("Avatar upload failed:", err);
            toast.error(err.message || "Failed to upload photo. Please try again.");
        } finally {
            setAvatarUploading(false);
            // Reset input so the same file can be re-selected
            if (avatarInputRef.current) avatarInputRef.current.value = "";
        }
    };

    const inputCls = (field?: string) =>
        `w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
            field && fieldErrors[field]
                ? "border-red-500/50 focus:border-red-500/70"
                : "border-white/[0.07] focus:border-white/[0.18]"
        }`;

    const FieldError = ({ field }: { field: string }) =>
        fieldErrors[field] ? (
            <p className="mt-1.5 text-[11px] text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle size={11} /> {fieldErrors[field]}
            </p>
        ) : null;

    const isTrainer = user?.role === "trainer";

    return (
        <div className="max-w-[900px] w-full pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">My Profile</h1>
                    <p className="text-text-main/50 font-medium text-sm">
                        Manage your personal information and {isTrainer ? "training profile" : "preferences"}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {isTrainer && user?.id && (
                        <a
                            href={`/dashboard/trainers/${user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-text-main/60 font-bold text-sm hover:bg-white/[0.05] hover:text-text-main transition-all"
                        >
                            <Eye size={14} strokeWidth={2} />
                            Preview Profile
                        </a>
                    )}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 rounded-xl border border-red-500/20 text-red-500/70 font-bold text-sm hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Profile Header Card */}
            <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                <div className="flex gap-5 items-center flex-wrap">
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                    />
                    <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="relative w-20 h-20 rounded-full shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface"
                        title="Click to change profile photo"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border border-white/[0.10]" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-white/[0.08] border border-white/[0.10] flex items-center justify-center font-black text-2xl text-text-main uppercase">
                                {form.firstName?.[0]}{form.lastName?.[0]}
                            </div>
                        )}
                        <div className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            {avatarUploading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Camera size={18} className="text-white" />
                            )}
                        </div>
                        {/* Always-visible pencil badge */}
                        <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-bg border-2 border-surface flex items-center justify-center shadow-lg">
                            {avatarUploading ? (
                                <div className="w-3 h-3 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                            )}
                        </div>
                    </button>
                    <div className="flex-1 min-w-[180px]">
                        {avatarUploading && (
                            <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Uploading photo...
                            </p>
                        )}
                        <h2 className="text-xl font-black text-white mb-0.5">
                            {form.firstName} {form.lastName}
                        </h2>
                        <p className="text-text-main/40 text-sm font-medium mb-3">{user?.email}</p>
                        {(form.city || form.state) && (
                            <div className="flex items-center gap-1.5 text-text-main/50 text-xs font-medium mb-3">
                                <MapPin size={12} className="text-text-main/30" />
                                <span>{form.city}{form.city && form.state ? ", " : ""}{form.state}</span>
                            </div>
                        )}
                        <div className="flex gap-2 items-center flex-wrap">
                            <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-text-main/60 text-[10px] font-black uppercase tracking-widest">
                                {user?.role}
                            </span>
                            {isTrainer && (
                                <>
                                    {statusData.isPerformanceVerified ? (
                                        <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-text-main/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <CheckCircle size={11} strokeWidth={3} /> Performance Verified
                                        </span>
                                    ) : statusData.totalSessions > 0 ? (
                                        <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                                            Pro Coach
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-text-main/40 text-[10px] font-black uppercase tracking-widest">
                                            New Trainer
                                        </span>
                                    )}
                                    {user?.trainerProfile?.is_verified && !statusData.isPerformanceVerified && (
                                        <span className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-text-main/40 text-[10px] font-black uppercase tracking-widest">
                                            Admin Approved
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2.5 mb-5">
                    <User size={16} className="text-text-main/40" strokeWidth={2.5} />
                    <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase">Personal Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">First Name <span className="text-red-400">*</span></label>
                        <input value={form.firstName} onChange={(e) => updateForm({ firstName: e.target.value })} className={inputCls("firstName")} />
                        <FieldError field="firstName" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Last Name <span className="text-red-400">*</span></label>
                        <input value={form.lastName} onChange={(e) => updateForm({ lastName: e.target.value })} className={inputCls("lastName")} />
                        <FieldError field="lastName" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Date of Birth</label>
                        <input type="date" value={form.dateOfBirth} onChange={(e) => updateForm({ dateOfBirth: e.target.value })} className={inputCls("dateOfBirth")} />
                        <FieldError field="dateOfBirth" />
                        {form.dateOfBirth && !fieldErrors.dateOfBirth && (
                            <p className="mt-1.5 text-[10px] text-text-main/30 font-bold uppercase tracking-widest">
                                Age: {new Date().getFullYear() - new Date(form.dateOfBirth).getFullYear()} years old
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Sex</label>
                        <select
                            value={form.sex}
                            onChange={(e) => updateForm({ sex: e.target.value })}
                            className={inputCls() + " appearance-none cursor-pointer"}
                            style={{ backgroundColor: "#13151b", colorScheme: "dark" }}
                        >
                            <option value="">Select Sex</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Phone</label>
                        <input value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} placeholder="(555) 123-4567" className={inputCls("phone")} />
                        <FieldError field="phone" />
                    </div>
                </div>
            </div>

            {/* About Me (Athlete Only — trainers have bio in "Training Profile" section below) */}
            {!isTrainer && (
                <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-5">
                        <User size={16} className="text-text-main/40" strokeWidth={2.5} />
                        <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase">About Me</h3>
                    </div>
                    <textarea
                        value={form.bio}
                        onChange={(e) => updateForm({ bio: e.target.value })}
                        placeholder="Tell trainers a bit about yourself, your goals, and what you're looking for..."
                        className={inputCls() + " h-28 resize-none"}
                    />
                </div>
            )}

            {/* Location Info */}
            <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-5">
                        <MapPin size={16} className="text-text-main/40" strokeWidth={2.5} />
                        <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase">Location Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Address</label>
                            <input value={form.addressLine1} onChange={(e) => updateForm({ addressLine1: e.target.value })} placeholder="123 Training Way" className={inputCls()} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">City / Town</label>
                            <LocationAutocomplete
                                value={
                                    form.city
                                        ? { city: form.city, state: form.state, country: form.country, lat: form.latitude, lng: form.longitude }
                                        : null
                                }
                                onChange={(loc: LocationValue) => {
                                    if (loc) {
                                        updateForm({
                                            city: loc.city,
                                            state: loc.state,
                                            country: loc.country || form.country,
                                            latitude: loc.lat,
                                            longitude: loc.lng,
                                            ...(loc.zipCode ? { zipCode: loc.zipCode } : {}),
                                        });
                                    } else {
                                        updateForm({ city: "", state: "", country: "", latitude: null, longitude: null });
                                    }
                                }}
                                placeholder="Start typing a city..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:col-span-2">
                            <div>
                                <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">State / Province</label>
                                <input value={form.state} onChange={(e) => updateForm({ state: e.target.value })} className={inputCls()} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">ZIP / Postal Code</label>
                                <input
                                    value={form.zipCode}
                                    onChange={(e) => {
                                        const zip = e.target.value;
                                        const newCountry = detectCountry(zip);
                                        // Re-derive display radius when country changes
                                        const prevCountry = detectCountry(form.zipCode);
                                        if (newCountry !== prevCountry) {
                                            const storedMiles = Number(form.travelRadius) || 25;
                                            if (newCountry === "CA") {
                                                setDisplayRadius(String(Math.round(miToKm(storedMiles))));
                                            } else {
                                                setDisplayRadius(String(storedMiles));
                                            }
                                        }
                                        updateForm({ zipCode: zip, country: newCountry !== "OTHER" ? newCountry : form.country });
                                    }}
                                    className={inputCls("zipCode")}
                                />
                                <FieldError field="zipCode" />
                            </div>
                        </div>
                        {(() => {
                            const country = detectCountry(form.zipCode);
                            const unit = radiusUnit(country);
                            return (
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-3">
                                        Travel Radius ({unit === "km" ? "kilometers" : "miles"}) — <span className="text-text-main/70">{formatRadius(parseInt(displayRadius || "0"), country)}</span>
                                    </label>
                                    <input
                                        type="range" min="5" max={unit === "km" ? "160" : "100"} step="5"
                                        value={displayRadius}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setDisplayRadius(val);
                                            // Convert to miles for storage
                                            if (country === "CA") {
                                                updateForm({ travelRadius: String(Math.round(kmToMi(Number(val)))) });
                                            } else {
                                                updateForm({ travelRadius: val });
                                            }
                                        }}
                                        className="w-full h-1.5 bg-white/[0.06] rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between mt-1.5 text-[10px] font-bold text-text-main/25 tracking-widest">
                                        <span>5 {unit.toUpperCase()}</span><span>{unit === "km" ? "160" : "100"} {unit.toUpperCase()}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

            {/* Training Preferences (Athlete Only) */}
            {!isTrainer && (
                <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-5">
                        <Clock size={16} className="text-text-main/40" strokeWidth={2.5} />
                        <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase">Training Preferences</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-3">Skill Level</label>
                            <div className="grid grid-cols-2 gap-2">
                                {["beginner", "intermediate", "advanced", "pro"].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => updateForm({ skillLevel: level })}
                                        className={`px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                                            form.skillLevel === level
                                                ? "bg-primary/10 border-primary/40 text-primary"
                                                : "bg-white/[0.02] border-white/[0.06] text-text-main/40 hover:border-white/[0.14] hover:text-text-main/70"
                                        }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-3">Preferred Times</label>
                            <div className="flex flex-col gap-2">
                                {["morning", "afternoon", "evening"].map((time) => {
                                    const selected = form.preferredTimes.includes(time);
                                    return (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => updateForm({
                                                preferredTimes: selected
                                                    ? form.preferredTimes.filter(t => t !== time)
                                                    : [...form.preferredTimes, time]
                                            })}
                                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
                                                selected
                                                    ? "bg-primary/10 border-primary/40 text-primary"
                                                    : "bg-white/[0.02] border-white/[0.06] text-text-main/40 hover:border-white/[0.12]"
                                            }`}
                                        >
                                            <span className="text-[11px] font-black uppercase tracking-wider">{time}</span>
                                            {selected && <CheckCircle size={13} className="text-primary/70" strokeWidth={2.5} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trainer-specific fields */}
            {isTrainer && (
                <div className="bg-surface border border-white/[0.06] rounded-2xl p-6 mb-4">
                    <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase mb-5">Training Profile</h3>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Headline</label>
                            <input value={form.headline} onChange={(e) => updateForm({ headline: e.target.value })} placeholder="e.g. Former NCAA D1 Player" className={inputCls("headline")} />
                            <FieldError field="headline" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Bio</label>
                            <textarea
                                value={form.bio}
                                onChange={(e) => updateForm({ bio: e.target.value })}
                                placeholder="Tell athletes about your experience..."
                                className={inputCls() + " h-28 resize-none"}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Hourly Rate ($) <span className="text-red-400">*</span></label>
                                <input type="number" value={form.hourlyRate} onChange={(e) => updateForm({ hourlyRate: e.target.value })} min={10} max={1000} className={inputCls("hourlyRate")} />
                                <FieldError field="hourlyRate" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-main/40 uppercase tracking-[0.12em] mb-2">Years Experience <span className="text-red-400">*</span></label>
                                <input type="number" value={form.yearsExperience} onChange={(e) => updateForm({ yearsExperience: e.target.value })} min={0} max={60} className={inputCls("yearsExperience")} />
                                <FieldError field="yearsExperience" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sports */}
            <div className={`bg-surface border rounded-2xl p-6 ${fieldErrors.sports ? "border-red-500/30" : "border-white/[0.06]"}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-black text-text-main/50 tracking-[0.15em] uppercase">Sports Interests <span className="text-red-400">*</span></h3>
                    {fieldErrors.sports && <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors.sports}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {sportsLoading
                        ? Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className="px-4 py-2 rounded-xl bg-white/10 animate-pulse w-20 h-8"
                            />
                        ))
                        : sportsList.map((sport) => {
                            const selected = form.sports.includes(sport.slug);
                            return (
                                <button
                                    key={sport.id}
                                    type="button"
                                    onClick={() => updateForm({
                                        sports: selected
                                            ? form.sports.filter(s => s !== sport.slug)
                                            : [...form.sports, sport.slug]
                                    })}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                        selected
                                            ? "bg-primary/10 border-primary/40 text-primary"
                                            : "bg-white/[0.02] border-white/[0.06] text-text-main/40 hover:border-white/[0.14] hover:text-text-main/70"
                                    }`}
                                >
                                    {sport.name}
                                </button>
                            );
                        })
                    }
                </div>
            </div>

            {/* Floating Save Button */}
            {isDirty && (
                <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-40">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-bg font-black text-sm shadow-lg hover:opacity-90 transition-all disabled:opacity-60 whitespace-nowrap"
                    >
                        <Save size={15} strokeWidth={2.5} />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            )}

            {/* Delete Account Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-surface border border-white/[0.08] rounded-2xl p-8 w-full max-w-[400px] text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <ShieldAlert className="text-red-400 w-7 h-7" strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">Delete Account?</h3>
                        <p className="text-text-main/50 text-sm mb-7 leading-relaxed">
                            This action cannot be undone. Your account and all associated data will be permanently deleted.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="flex-1 px-5 py-3 rounded-xl border border-white/[0.08] text-text-main/70 font-bold text-sm hover:bg-white/[0.04] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex-1 px-5 py-3 rounded-xl bg-red-500 text-white font-black text-sm hover:bg-red-400 transition-colors flex items-center justify-center"
                            >
                                {deleting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
