"use client";

import { useEffect, useState, useRef } from "react";
import { getSession, setSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
    Pencil,
    FileText,
    Crosshair,
    Briefcase,
    Award,
    DollarSign,
    X,
    FileUp,
    CheckCircle,
    AlertTriangle,
    MapPin,
    Clock,
    Eye,
    Upload,
    Trash2,
    ExternalLink,
    ShieldCheck
} from "lucide-react";

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

export default function TrainerEditProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [sportsList, setSportsList] = useState<{ id: string; name: string; slug: string }[]>([]);
    const [sportsLoading, setSportsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [popup, setPopup] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        bio: "",
        sports: [] as string[],
        yearsExperience: "",
        previousFacility: "",
        hourlyRate: "75",
        packageRate: "650",
        certifications: "",
        city: "",
        state: "",
        travelRadius: "20",
        targetSkillLevels: ["beginner", "intermediate", "advanced", "pro"] as ("beginner"|"intermediate"|"advanced"|"pro")[],
        preferredTrainingTimes: ["morning", "afternoon", "evening"] as ("morning"|"afternoon"|"evening")[],
    });

    const [sessionLengths, setSessionLengths] = useState<number[]>([60]);
    const [trainingLocations, setTrainingLocations] = useState<string[]>([]);

    const [newTag, setNewTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    const [requireVerification, setRequireVerification] = useState(true);

    // Verification documents state
    const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // File upload refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

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
        if (!session) {
            router.push("/auth/login");
            return;
        }
        if (session.role !== "trainer") {
            router.push("/dashboard");
            return;
        }
        setUser(session);

        const fetchData = async () => {
            // Fetch Platform Settings & Latest Profile in parallel
            const [settingsRes, profileRes] = await Promise.all([
                supabase.from("platform_settings").select("require_trainer_verification").single(),
                supabase.from("trainer_profiles").select("*").eq("user_id", session.id).single()
            ]);
            
            if (settingsRes.data) {
                setRequireVerification(settingsRes.data.require_trainer_verification);
            }

            const latestProfile = profileRes.data;
            if (latestProfile) {
                const updatedSession = { ...session, trainerProfile: latestProfile };
                setUser(updatedSession);
                setSession(updatedSession); // Update local storage too

                let initialCerts = "";
                if (typeof latestProfile.certifications === "string") initialCerts = latestProfile.certifications;
                else if (Array.isArray(latestProfile.certifications)) initialCerts = latestProfile.certifications.join("\n");

                setFormData(prev => ({
                    ...prev,
                    firstName: session.firstName || "",
                    lastName: session.lastName || "",
                    bio: latestProfile.bio || "",
                    sports: latestProfile.sports || [],
                    yearsExperience: latestProfile.years_experience?.toString() || "",
                    hourlyRate: latestProfile.hourly_rate?.toString() || "75",
                    previousFacility: prev.previousFacility,
                    packageRate: prev.packageRate,
                    certifications: initialCerts,
                    city: latestProfile.city || "",
                    state: latestProfile.state || "",
                    travelRadius: latestProfile.travel_radius_miles?.toString() || "20",
                    targetSkillLevels: latestProfile.target_skill_levels || ["beginner", "intermediate", "advanced", "pro"],
                    preferredTrainingTimes: latestProfile.preferredTrainingTimes || ["morning", "afternoon", "evening"],
                }));
                if (latestProfile.session_lengths?.length) setSessionLengths(latestProfile.session_lengths);
                if (latestProfile.training_locations?.length) setTrainingLocations(latestProfile.training_locations);
                if (latestProfile.verification_documents?.length) setVerificationDocs(latestProfile.verification_documents);
            }
            setLoading(false);
        };

        fetchData();
    }, [router]);

    const handleSaveProfile = async () => {
        if (!user) return;

        // Validate required fields
        const missing: string[] = [];
        if (!formData.firstName.trim()) missing.push("First Name");
        if (!formData.lastName.trim()) missing.push("Last Name");
        if (!formData.sports || formData.sports.length === 0) missing.push("Sports (select at least one)");
        if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) missing.push("Hourly Rate");
        if (!formData.yearsExperience) missing.push("Years Experience");
        if (!formData.city?.trim()) missing.push("City");

        if (missing.length > 0) {
            setPopup({ type: "error", message: `Please fill in: ${missing.join(", ")}` });
            return;
        }

        setSaving(true);
        try {
            const updateData: Record<string, unknown> = {
                bio: formData.bio,
                sports: formData.sports,
                years_experience: Math.max(0, parseInt(formData.yearsExperience) || 0),
                hourly_rate: parseFloat(formData.hourlyRate) || 75,
                certifications: formData.certifications,
                city: formData.city || null,
                state: formData.state || null,
                travel_radius_miles: parseInt(formData.travelRadius) || 20,
                target_skill_levels: formData.targetSkillLevels,
                "preferredTrainingTimes": formData.preferredTrainingTimes,
                session_lengths: sessionLengths.length > 0 ? sessionLengths : [60],
                training_locations: trainingLocations,
            };

            const [profileRes, userRes] = await Promise.all([
                supabase.from("trainer_profiles").update(updateData).eq("user_id", user.id),
                supabase.from("users").update({ first_name: formData.firstName, last_name: formData.lastName }).eq("id", user.id)
            ]);

            if (profileRes.error) throw profileRes.error;
            if (userRes.error) throw userRes.error;

            const updatedSession = {
                ...user,
                firstName: formData.firstName,
                lastName: formData.lastName,
                trainerProfile: {
                    ...user.trainerProfile,
                    ...updateData
                },
            };
            setSession(updatedSession as AuthUser);
            setPopup({ type: "success", message: "Profile saved successfully!" });
        } catch (err) {
            console.error("Failed to save:", err);
            setPopup({ type: "error", message: "Failed to save profile. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0 || !user) {
                return;
            }

            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${uuidv4()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Try to upload to a "avatars" storage bucket
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Storage upload error details:", uploadError);
                throw uploadError;
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = publicUrlData.publicUrl;

            // Updated auth user
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: avatarUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            const updatedUser = { ...user, avatarUrl };
            setUser(updatedUser);
            setSession(updatedUser);

            setPopup({ type: "success", message: "Avatar updated successfully!" });

        } catch (error) {
            console.error('Error uploading image: ', error);
            setPopup({ type: "error", message: "Error uploading image! Please try again." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user || !user.avatarUrl) return;
        try {
            setUploading(true);

            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (updateError) throw updateError;

            const updatedUser = { ...user, avatarUrl: null };
            setUser(updatedUser);
            setSession(updatedUser as AuthUser);

            setPopup({ type: "success", message: "Avatar removed successfully!" });
        } catch (error) {
            console.error('Error removing image: ', error);
            setPopup({ type: "error", message: "Error removing image!" });
        } finally {
            setUploading(false);
        }
    };

    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];

        if (file.type !== "application/pdf") {
            setPopup({ type: "error", message: "Only PDF files are allowed for verification documents." });
            if (docInputRef.current) docInputRef.current.value = "";
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setPopup({ type: "error", message: "File size must be under 10 MB." });
            if (docInputRef.current) docInputRef.current.value = "";
            return;
        }

        setUploadingDoc(true);
        try {
            const fileName = `${user.id}/${uuidv4()}.pdf`;
            const { error: uploadError } = await supabase.storage
                .from("verification-documents")
                .upload(fileName, file, { contentType: "application/pdf" });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from("verification-documents")
                .getPublicUrl(fileName);

            const docUrl = publicUrlData.publicUrl;
            const updatedDocs = [...verificationDocs, docUrl];

            const { error: updateError } = await supabase
                .from("trainer_profiles")
                .update({ verification_documents: updatedDocs })
                .eq("user_id", user.id);

            if (updateError) throw updateError;

            setVerificationDocs(updatedDocs);
            setPopup({ type: "success", message: "Document uploaded successfully. An admin will review it shortly." });
        } catch (err) {
            console.error("Document upload error:", err);
            setPopup({ type: "error", message: "Failed to upload document. Please try again." });
        } finally {
            setUploadingDoc(false);
            if (docInputRef.current) docInputRef.current.value = "";
        }
    };

    const handleRemoveDocument = async (docUrl: string) => {
        if (!user) return;
        const updatedDocs = verificationDocs.filter(d => d !== docUrl);
        try {
            const { error } = await supabase
                .from("trainer_profiles")
                .update({ verification_documents: updatedDocs })
                .eq("user_id", user.id);
            if (error) throw error;
            setVerificationDocs(updatedDocs);
        } catch (err) {
            console.error("Failed to remove document:", err);
            setPopup({ type: "error", message: "Failed to remove document." });
        }
    };

    const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && newTag.trim() !== "") {
            e.preventDefault();
            const tag = newTag.trim().toUpperCase();
            if (!formData.sports.includes(tag)) {
                setFormData({ ...formData, sports: [...formData.sports, tag] });
            }
            setNewTag("");
            setShowTagInput(false);
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, sports: formData.sports.filter(s => s !== tag) });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        EDIT PROFILE
                    </h1>
                    <p className="text-text-main/60 font-medium text-15px">
                        Enhance your visibility to prospective athletes.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {user?.id && (
                        <a
                            href={`/dashboard/trainers/${user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-text-main/60 font-bold text-sm bg-white/4 hover:bg-white/8 hover:text-white transition-all"
                        >
                            <Eye size={15} strokeWidth={2} />
                            Preview Profile
                        </a>
                    )}
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-6 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all flex items-center gap-2 disabled:bg-primary/50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* Verification Notice */}
            {requireVerification && user?.trainerProfile && !user.trainerProfile.is_verified && (
                <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-[24px] flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="text-blue-400 w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-blue-400 font-bold text-lg mb-1">Profile Verification Required</h3>
                        <p className="text-text-main/70 text-sm leading-relaxed max-w-2xl">
                            Your profile is currently hidden from athletes because the platform requires admin verification. 
                            Complete your profile details below, and an admin will review your account for approval.
                        </p>
                    </div>
                </div>
            )}

            {/* Content Blocks */}
            <div className="space-y-6">

                {/* Profile Identity - Temporarily hidden per user request
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-8 shadow-md">
                    <div className="relative shrink-0">
                        ...
                    </div>
                </div>
                */}

                {/* Personal Information */}
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">First Name</label>
                            <input
                                value={formData.firstName}
                                onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Last Name</label>
                            <input
                                value={formData.lastName}
                                onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Professional Bio */}
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText size={20} className="text-primary" strokeWidth={2.5} />
                        <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PROFESSIONAL BIO</h3>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">INTRODUCTION</label>
                        <div className="relative">
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                maxLength={500}
                                placeholder="Write about your coaching philosophy and track record..."
                                className="w-full h-32 bg-[#12141A] border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors placeholder:text-text-main/30"
                            />
                            <div className="absolute bottom-4 right-5 text-[10px] font-medium text-text-main/40 uppercase tracking-wider italic">
                                {formData.bio.length} / 500 characters
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Specialization */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Crosshair size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">SPECIALIZATION</h3>
                        </div>

                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">CORE DISCIPLINES</label>
                            <div className="flex flex-wrap gap-2.5">
                                {sportsLoading
                                    ? Array.from({ length: 10 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="px-5 py-2.5 rounded-full bg-white/10 animate-pulse w-20 h-8"
                                        />
                                    ))
                                    : sportsList.map((sport) => {
                                        const selected = formData.sports.includes(sport.slug);
                                        return (
                                            <button
                                                key={sport.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData((p) => ({
                                                        ...p,
                                                        sports: selected
                                                            ? p.sports.filter((s) => s !== sport.slug)
                                                            : [...p.sports, sport.slug],
                                                    }));
                                                }}
                                                className={`
                                                    px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200 border
                                                    ${selected
                                                        ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                        : "bg-transparent border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                                    }
                                                `}
                                            >
                                                {sport.name}
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>

                    {/* Experience */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Briefcase size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">EXPERIENCE</h3>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">YEARS IN COACHING</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={formData.yearsExperience}
                                    onChange={(e) => setFormData({ ...formData, yearsExperience: String(Math.max(0, parseInt(e.target.value) || 0)) })}
                                    placeholder="e.g. 8"
                                    className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">PREVIOUS FACILITY</label>
                                <input
                                    type="text"
                                    value={formData.previousFacility}
                                    onChange={(e) => setFormData({ ...formData, previousFacility: e.target.value })}
                                    placeholder="Elite Performance Academy"
                                    className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Certifications */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Award size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">CERTIFICATIONS DETAILS</h3>
                        </div>

                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">LIST YOUR CREDENTIALS</label>
                            <textarea
                                value={formData.certifications}
                                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                                placeholder="E.g. NASM Certified Personal Trainer, ISSA Nutritionist..."
                                className="w-full h-32 bg-[#12141A] border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors placeholder:text-text-main/30"
                            />
                        </div>
                    </div>

                    {/* Location & Matching */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <MapPin size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">LOCATION & MATCHING</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">City</label>
                                <input
                                    value={formData.city}
                                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                                    placeholder="e.g. Austin"
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">State</label>
                                <input
                                    value={formData.state}
                                    onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                                    placeholder="e.g. TX"
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Travel Radius (Miles)</label>
                                <input
                                    type="number"
                                    value={formData.travelRadius}
                                    onChange={(e) => setFormData((p) => ({ ...p, travelRadius: e.target.value }))}
                                    min="1"
                                    max="100"
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Target Skill Levels */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <Crosshair size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">TARGET ATHLETE SKILL LEVELS</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {["beginner", "intermediate", "advanced", "pro"].map((skill) => {
                                const selected = formData.targetSkillLevels.includes(skill as any);
                                return (
                                    <button
                                        key={skill}
                                        type="button"
                                        onClick={() => {
                                            setFormData((p) => ({
                                                ...p,
                                                targetSkillLevels: selected
                                                    ? p.targetSkillLevels.filter((s) => s !== skill)
                                                    : [...p.targetSkillLevels, skill as any],
                                            }));
                                        }}
                                        className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                                            selected
                                                ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                : "bg-[#12141A] border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                        }`}
                                    >
                                        {skill}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Availability */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PREFERRED AVAILABILITY</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: "morning", label: "Morning (6am-12pm)" },
                                { id: "afternoon", label: "Afternoon (12pm-5pm)" },
                                { id: "evening", label: "Evening (5pm-9pm)" },
                            ].map((time) => {
                                const selected = formData.preferredTrainingTimes.includes(time.id as any);
                                return (
                                    <button
                                        key={time.id}
                                        type="button"
                                        onClick={() => {
                                            setFormData((p) => ({
                                                ...p,
                                                preferredTrainingTimes: selected
                                                    ? p.preferredTrainingTimes.filter((t) => t !== time.id)
                                                    : [...p.preferredTrainingTimes, time.id as any],
                                            }));
                                        }}
                                        className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                                            selected
                                                ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                : "bg-[#12141A] border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                        }`}
                                    >
                                        {time.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pricing Plans */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <DollarSign size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PRICING PLANS</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-5 h-36">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">HOURLY RATE ($)</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/40 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.hourlyRate}
                                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-2xl pl-10 pr-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">PACKAGE 10X ($)</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/40 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.packageRate}
                                        onChange={(e) => setFormData({ ...formData, packageRate: e.target.value })}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-2xl pl-10 pr-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Verification Documents */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={20} className="text-primary" strokeWidth={2.5} />
                                <div>
                                    <h3 className="text-[15px] font-black text-white tracking-widest uppercase">VERIFICATION DOCUMENTS</h3>
                                    <p className="text-[11px] text-text-main/40 font-medium mt-0.5">Upload certifications or ID (PDF only). Reviewed by admin.</p>
                                </div>
                            </div>
                            <div>
                                <input
                                    ref={docInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleUploadDocument}
                                />
                                <button
                                    type="button"
                                    onClick={() => docInputRef.current?.click()}
                                    disabled={uploadingDoc}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploadingDoc ? (
                                        <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload size={14} /> Upload PDF</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {verificationDocs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/10 rounded-xl text-center">
                                <FileUp size={28} className="text-text-main/20 mb-3" />
                                <p className="text-text-main/40 text-sm font-medium">No documents uploaded yet</p>
                                <p className="text-text-main/25 text-xs mt-1">Certificates, coaching licenses, or photo ID (PDF only, max 10 MB)</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {verificationDocs.map((docUrl, idx) => {
                                    const fileName = docUrl.split("/").pop()?.split("?")[0] || `Document ${idx + 1}`;
                                    return (
                                        <div key={docUrl} className="flex items-center justify-between p-3 bg-[#12141A] border border-white/5 rounded-xl group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                                    <FileText size={14} className="text-red-400" />
                                                </div>
                                                <span className="text-text-main/70 text-xs font-medium truncate max-w-50">
                                                    Document {idx + 1}.pdf
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={docUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-text-main/60 text-[10px] font-black uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                                                >
                                                    <ExternalLink size={11} /> View
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDocument(docUrl)}
                                                    className="p-1.5 rounded-lg text-text-main/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Remove document"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Session Lengths */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="mb-8">
                            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Session Lengths Offered</h3>
                            <p className="text-zinc-400 text-xs mb-4">Select which session durations you offer</p>
                            <div className="flex flex-wrap gap-3">
                                {[30, 45, 60, 90].map(mins => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => {
                                            setSessionLengths(prev =>
                                                prev.includes(mins) ? prev.filter(l => l !== mins) : [...prev, mins]
                                            )
                                        }}
                                        className={`px-5 py-3 rounded-xl text-sm font-bold border transition-all ${
                                            sessionLengths.includes(mins)
                                                ? 'bg-white text-black border-white'
                                                : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        {mins < 60 ? `${mins} min` : mins === 60 ? '1 hr' : `${mins/60 % 1 === 0 ? mins/60 : '1.5'} hr`}
                                    </button>
                                ))}
                            </div>
                            {sessionLengths.length === 0 && (
                                <p className="text-red-400 text-xs mt-2">Please select at least one session length</p>
                            )}
                        </div>

                        {/* Training Locations */}
                        <div className="mb-8">
                            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Training Locations</h3>
                            <p className="text-zinc-400 text-xs mb-4">Where do you train? (select all that apply)</p>
                            <div className="flex flex-wrap gap-3">
                                {['Rink', 'Field', 'Gym', 'Indoor Facility', 'Outdoor Court', 'Pool', 'Track', 'Home Visits', 'Virtual/Online'].map(loc => (
                                    <button
                                        key={loc}
                                        type="button"
                                        onClick={() => {
                                            setTrainingLocations(prev =>
                                                prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
                                            )
                                        }}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                            trainingLocations.includes(loc)
                                                ? 'bg-white text-black border-white'
                                                : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Popup Modal */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            {popup.type === "success" ? (
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                                    <CheckCircle size={28} strokeWidth={2.5} />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-500">
                                    <AlertTriangle size={28} strokeWidth={2.5} />
                                </div>
                            )}
                            <h3 className={`text-xl font-black font-display uppercase tracking-wider mb-2 ${popup.type === "success" ? "text-primary" : "text-red-500"}`}>
                                {popup.type === "success" ? "Success!" : "Error"}
                            </h3>
                            <p className="text-text-main/80 text-sm font-medium mb-6">
                                {popup.message}
                            </p>
                            <button
                                onClick={() => setPopup(null)}
                                className={`w-full py-3 rounded-full font-black text-sm uppercase tracking-wider transition-all ${
                                    popup.type === "success" 
                                    ? "bg-primary text-bg hover:shadow-[0_0_15px_rgba(69,208,255,0.3)]" 
                                    : "bg-red-500 text-white hover:bg-red-600"
                                }`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
