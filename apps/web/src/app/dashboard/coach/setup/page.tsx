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
    AlertTriangle
} from "lucide-react";

const SPORTS_LIST = [
    "hockey", "baseball", "basketball", "football", "soccer",
    "tennis", "golf", "swimming", "boxing", "lacrosse",
    "wrestling", "martial_arts", "gymnastics", "track_and_field", "volleyball",
];

export default function TrainerEditProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
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
    });

    const [newTag, setNewTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // File upload refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
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

        if (session.trainerProfile) {
            const tp = session.trainerProfile;
            let initialCerts = "";
            if (typeof tp.certifications === "string") initialCerts = tp.certifications;
            else if (Array.isArray(tp.certifications)) initialCerts = tp.certifications.join("\n");

            setFormData(prev => ({
                ...prev,
                firstName: session.firstName || "",
                lastName: session.lastName || "",
                bio: tp.bio || "",
                sports: tp.sports || [],
                yearsExperience: tp.years_experience?.toString() || "",
                hourlyRate: tp.hourly_rate?.toString() || "75",
                // previousFacility and packageRate are frontend-only for now unless added to DB
                previousFacility: prev.previousFacility,
                packageRate: prev.packageRate,
                certifications: initialCerts,
            }));
        }
        setLoading(false);
    }, [router]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const updateData: Record<string, unknown> = {
                bio: formData.bio,
                sports: formData.sports,
                years_experience: parseInt(formData.yearsExperience) || null,
                hourly_rate: parseFloat(formData.hourlyRate) || 75,
                certifications: formData.certifications,
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
            setSession(updatedUser);

            setPopup({ type: "success", message: "Avatar removed successfully!" });
        } catch (error) {
            console.error('Error removing image: ', error);
            setPopup({ type: "error", message: "Error removing image!" });
        } finally {
            setUploading(false);
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
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-6 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all flex items-center gap-2 disabled:bg-primary/50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

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
                                {SPORTS_LIST.map((sport) => {
                                    const selected = formData.sports.includes(sport);
                                    return (
                                        <button
                                            key={sport}
                                            type="button"
                                            onClick={() => {
                                                setFormData((p) => ({
                                                    ...p,
                                                    sports: selected ? p.sports.filter((s) => s !== sport) : [...p.sports, sport],
                                                }));
                                            }}
                                            className={`
                                                px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200
                                                ${selected
                                                    ? "bg-primary text-bg shadow-[0_4px_15px_rgba(163,255,18,0.25)] border-transparent"
                                                    : "bg-transparent border border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                                }
                                            `}
                                        >
                                            {sport.replace(/_/g, " ")}
                                        </button>
                                    );
                                })}
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
                                    value={formData.yearsExperience}
                                    onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
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
                                    ? "bg-primary text-bg hover:shadow-[0_0_15px_rgba(163,255,18,0.3)]" 
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
