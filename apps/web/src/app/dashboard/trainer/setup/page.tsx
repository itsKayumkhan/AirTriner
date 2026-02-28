"use client";

import { useEffect, useState, useRef } from "react";
import { getSession, setSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
    Pencil,
    FileText,
    Crosshair,
    Briefcase,
    Award,
    DollarSign,
    X,
    FileUp
} from "lucide-react";

export default function TrainerEditProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        bio: "",
        sports: [] as string[],
        yearsExperience: "",
        previousFacility: "",
        hourlyRate: "75",
        packageRate: "650",
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
            setFormData(prev => ({
                ...prev,
                bio: tp.bio || "",
                sports: tp.sports || [],
                yearsExperience: tp.years_experience?.toString() || "",
                hourlyRate: tp.hourly_rate?.toString() || "75",
                // previousFacility and packageRate are frontend-only for now unless added to DB
                previousFacility: prev.previousFacility,
                packageRate: prev.packageRate
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
            };

            const { error } = await supabase
                .from("trainer_profiles")
                .update(updateData)
                .eq("user_id", user.id);

            if (error) throw error;

            const updatedSession = {
                ...user,
                trainerProfile: {
                    ...user.trainerProfile,
                    ...updateData
                },
            };
            setSession(updatedSession as AuthUser);
            // Optionally show a toast instead of redirecting immediately
            // router.push("/dashboard");
            alert("Profile saved successfully!");
        } catch (err) {
            console.error("Failed to save:", err);
            alert("Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
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

                {/* Profile Identity */}
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-8 shadow-md">
                    {/* Avatar Area */}
                    <div className="relative shrink-0">
                        <div className="w-36 h-36 rounded-2xl bg-gray-800 overflow-hidden border border-white/5 shadow-inner">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-[#272A35] flex items-center justify-center text-5xl font-black text-text-main/40">
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                </div>
                            )}
                        </div>
                        <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-bg flex items-center justify-center shadow-[0_4px_10px_rgba(163,255,18,0.4)] hover:scale-105 transition-transform z-10">
                            <Pencil size={14} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Identity Info */}
                    <div className="flex-1 text-center sm:text-left pt-2">
                        <h2 className="text-[22px] font-bold text-white mb-2 tracking-tight">Profile Identity</h2>
                        <p className="text-text-main/60 text-sm mb-6 max-w-md leading-relaxed pr-4">
                            Use a professional high-quality headshot. Recommended size 800x800px. Supports JPG, PNG or WebP.
                        </p>
                        <div className="flex items-center justify-center sm:justify-start gap-4">
                            <button className="bg-primary text-bg font-bold text-sm px-6 py-2.5 rounded-full hover:shadow-[0_4px_15px_rgba(163,255,18,0.25)] hover:-translate-y-0.5 transition-all">
                                Upload New
                            </button>
                            <button className="bg-[#2a2d36] text-white font-bold text-sm px-6 py-2.5 rounded-full hover:bg-[#343844] transition-colors">
                                Remove
                            </button>
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
                                {formData.sports.map(tag => (
                                    <span key={tag} className="bg-primary text-bg text-[11px] font-black px-4 py-2 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-[0_2px_8px_rgba(163,255,18,0.15)]">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity">
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </span>
                                ))}

                                {showTagInput ? (
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={addTag}
                                        onBlur={() => setShowTagInput(false)}
                                        autoFocus
                                        placeholder="Type & press Enter"
                                        className="bg-[#12141A] border border-white/10 text-white text-[11px] font-bold px-4 py-2 rounded-full outline-none focus:border-primary uppercase min-w-[140px]"
                                    />
                                ) : (
                                    <button
                                        onClick={() => setShowTagInput(true)}
                                        className="border border-dashed border-white/20 text-text-main/50 hover:text-white hover:border-white/40 text-[11px] font-bold px-5 py-2 rounded-full uppercase tracking-wider transition-colors"
                                    >
                                        + Add Tag
                                    </button>
                                )}
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
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <Award size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">CERTIFICATIONS</h3>
                        </div>

                        <div className="border-2 border-dashed border-white/10 rounded-[20px] bg-[#12141A] p-8 flex flex-col items-center justify-center text-center hover:border-primary/30 transition-colors cursor-pointer group h-36">
                            <div className="mb-2 group-hover:-translate-y-1 transition-transform duration-300 relative">
                                <FileText size={20} className="text-text-main/40 group-hover:text-primary transition-colors" strokeWidth={2} />
                                <div className="absolute -top-1 -right-1.5 bg-[#12141A] rounded-full p-0.5">
                                    <div className="w-2.5 h-2.5 bg-text-main/40 group-hover:bg-primary text-bg flex items-center justify-center rounded-full text-[8px] font-black transition-colors">↑</div>
                                </div>
                            </div>
                            <h4 className="text-white font-bold text-[13px] mb-1">Drag certifications here</h4>
                            <p className="text-text-main/40 text-[11px]">PDF or Images up to 10MB</p>
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
        </div>
    );
}
