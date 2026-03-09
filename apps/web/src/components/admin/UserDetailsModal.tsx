"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Crown, Clock, XCircle, CheckCircle, Mail, Calendar, Activity, Dumbbell, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserDetailsModalProps {
    userId: string;
    userRole: "athlete" | "trainer";
    onClose: () => void;
}

export default function UserDetailsModal({ userId, userRole, onClose }: UserDetailsModalProps) {
    const [userData, setUserData] = useState<any>(null);
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            setLoading(true);
            try {
                // Fetch basic user info
                const { data: user, error: userError } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", userId)
                    .single();

                if (userError) throw userError;
                setUserData(user);

                // Fetch role-specific details
                if (userRole === "trainer") {
                    const { data: profile, error: profileError } = await supabase
                        .from("trainer_profiles")
                        .select("*")
                        .eq("user_id", userId)
                        .single();
                    
                    if (profileError && profileError.code !== "PGRST116") throw profileError;
                    setProfileData(profile);
                } else {
                    // For athletes, maybe fetch session history or other metrics
                    const { count: sessionCount } = await supabase
                        .from("bookings")
                        .select("*", { count: "exact", head: true })
                        .eq("athlete_id", userId);
                    
                    setProfileData({ sessionCount: sessionCount || 0 });
                }
            } catch (err) {
                console.error("Error fetching user details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId, userRole]);

    const statusConfig: any = {
        active: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: <CheckCircle size={14} /> },
        trial: { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", icon: <Clock size={14} /> },
        expired: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: <XCircle size={14} /> },
        cancelled: { color: "text-text-main/60", bg: "bg-[#272A35]", border: "border-gray-700", icon: <XCircle size={14} /> },
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-12 shadow-2xl flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-text-main/60 font-bold uppercase tracking-widest text-xs">Loading User Details</p>
                </div>
            </div>
        );
    }

    if (!userData) return null;

    const initials = `${userData.first_name?.[0] || ""}${userData.last_name?.[0] || ""}`.toUpperCase();
    const fullName = `${userData.first_name || ""} ${userData.last_name || ""}`.trim();
    const subStatus = profileData?.subscription_status || "none";
    const subCfg = statusConfig[subStatus] || statusConfig.cancelled;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1A1C23] border border-white/10 rounded-[32px] shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header Decoration */}
                <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative">
                    <button 
                        onClick={onClose} 
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 text-white/60 hover:text-white flex items-center justify-center transition-all z-10"
                    >
                        <X size={20} />
                    </button>
                    
                    <div className="absolute -bottom-12 left-8 p-1.5 bg-[#1A1C23] rounded-full ring-4 ring-[#1A1C23]">
                        <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-3xl font-black text-primary">
                            {initials}
                        </div>
                    </div>
                </div>

                <div className="pt-16 px-10 pb-10">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-2">{fullName}</h2>
                            <div className="flex items-center gap-2 text-text-main/60">
                                <Mail size={14} />
                                <span className="text-sm font-medium">{userData.email}</span>
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            userData.deleted_at ? "border-red-500/30 text-red-500 bg-red-500/10" : "border-primary/30 text-primary bg-primary/10"
                        }`}>
                            {userData.deleted_at ? "Suspended" : "Active Account"}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-10">
                        {/* Status Section */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main/40 mb-3">Professional Info</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-text-main/40 leading-none mb-1">Role</div>
                                            <div className="text-sm font-bold text-white uppercase tracking-wider">{userRole}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-text-main/40 leading-none mb-1">Joined Date</div>
                                            <div className="text-sm font-bold text-white">{new Date(userData.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {userRole === "athlete" ? (
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main/40 mb-3">Engagement</h3>
                                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-text-main/40 leading-none mb-1">Total Sessions</div>
                                            <div className="text-sm font-bold text-white">{profileData?.sessionCount || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main/40 mb-3">Specialization</h3>
                                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                            <Dumbbell size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-text-main/40 leading-none mb-1">Main Sport</div>
                                            <div className="text-sm font-bold text-white capitalize">{Array.isArray(profileData?.sports) ? profileData.sports[0] : "General"}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Subscription & Verification Section */}
                        <div className="space-y-6">
                            {userRole === "trainer" && (
                                <>
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main/40 mb-3">Subscription Details</h3>
                                        <div className="bg-white/5 rounded-2xl border border-white/5 p-5 space-y-4">
                                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                                <div className="text-xs font-bold text-text-main/60">Status</div>
                                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${subCfg.bg} ${subCfg.color} ${subCfg.border}`}>
                                                    {subCfg.icon} {subStatus}
                                                </span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="text-xs font-bold text-text-main/60">Expires At</div>
                                                <div className="font-bold text-white">
                                                    {profileData?.subscription_expires_at 
                                                        ? new Date(profileData.subscription_expires_at).toLocaleDateString() 
                                                        : "—"}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-sm">
                                                <div className="text-xs font-bold text-text-main/60">Trial Started</div>
                                                <div className="font-bold text-white">
                                                    {profileData?.trial_started_at 
                                                        ? new Date(profileData.trial_started_at).toLocaleDateString() 
                                                        : "—"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main/40 mb-3">Verification</h3>
                                        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
                                            profileData?.verification_status === "verified" 
                                                ? "bg-primary/5 border-primary/20 text-primary" 
                                                : "bg-surface border-white/5 text-text-main/40"
                                        }`}>
                                            {profileData?.verification_status === "verified" ? <CheckCircle size={20} /> : <ShieldAlert size={20} />}
                                            <div className="text-sm font-black uppercase tracking-widest">
                                                {profileData?.verification_status || "Pending Verification"}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                    >
                        Close Profile View
                    </button>
                </div>
            </div>
        </div>
    );
}
