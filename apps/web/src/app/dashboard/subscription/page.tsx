"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, setSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
    Crown, CheckCircle, Clock, XCircle, Zap, Star, Trophy,
    Calendar, MessageSquare, CreditCard, BarChart3, Shield,
    Bell, Loader2, AlertTriangle, CheckCheck, Users
} from "lucide-react";

const FOUNDING_50_MAX = 50;
const TRIAL_DAYS = 7;

type SubStatus = "trial" | "active" | "expired" | "cancelled";

type TrainerProfile = {
    id: string;
    subscription_status: SubStatus;
    subscription_expires_at: string | null;
    trial_started_at: string | null;
    is_founding_50: boolean;
    verification_status: string | null;
};

const PRO_FEATURES = [
    { icon: Star, label: "Appear in athlete search results" },
    { icon: Calendar, label: "Manage your booking calendar" },
    { icon: MessageSquare, label: "Direct messaging with athletes" },
    { icon: CreditCard, label: "Accept payments (3% platform fee)" },
    { icon: Shield, label: "Identity verified badge" },
    { icon: BarChart3, label: "Earnings dashboard & analytics" },
    { icon: CheckCheck, label: "Build your reviews & reputation" },
    { icon: Bell, label: "Nearby training request alerts" },
];

export default function SubscriptionPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<TrainerProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual" | null>(null);
    const [founding50Count, setFounding50Count] = useState(0);
    const [applyingFounding50, setApplyingFounding50] = useState(false);
    const [popup, setPopup] = useState<{
        type: "success" | "error" | "info";
        title: string;
        message: string;
    } | null>(null);

    const fetchData = useCallback(async () => {
        const session = getSession();
        if (!session || session.role !== "trainer") {
            router.push("/dashboard");
            return;
        }

        try {
            const [profileRes, countRes] = await Promise.all([
                supabase
                    .from("trainer_profiles")
                    .select("id, subscription_status, subscription_expires_at, trial_started_at, is_founding_50, verification_status")
                    .eq("user_id", session.id)
                    .single(),
                supabase
                    .from("trainer_profiles")
                    .select("id", { count: "exact", head: true })
                    .eq("is_founding_50", true),
            ]);

            if (profileRes.error) throw profileRes.error;
            setProfile(profileRes.data as TrainerProfile);
            setFounding50Count(countRes.count || 0);
        } catch (err) {
            console.error("SubscriptionPage fetchData:", err);
            setPopup({ type: "error", title: "Error", message: "Could not load subscription details." });
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // -----------------------------------------------
    // Compute trial state
    // -----------------------------------------------
    const getTrialInfo = () => {
        if (!profile?.trial_started_at) return { isActive: false, daysLeft: 0, trialEnd: null };
        const trialEnd = new Date(profile.trial_started_at);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
        const now = new Date();
        const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        return { isActive: now < trialEnd, daysLeft, trialEnd };
    };

    const trialInfo = getTrialInfo();
    const isTrialActive = profile?.subscription_status === "trial" && trialInfo.isActive;
    const isActive = profile?.subscription_status === "active";
    const isExpiredOrCancelled =
        profile?.subscription_status === "expired" ||
        profile?.subscription_status === "cancelled" ||
        (profile?.subscription_status === "trial" && !trialInfo.isActive);

    const isFoundingPending = profile?.is_founding_50 && !isActive;
    const spotsLeft = Math.max(0, FOUNDING_50_MAX - founding50Count);
    const isVerified = profile?.verification_status === "verified";
    const isPendingVerification = (isActive || isTrialActive) && !isVerified;
    const canApplyFounding50 = spotsLeft > 0 && !profile?.is_founding_50 && !isActive && !isPendingVerification;

    // -----------------------------------------------
    // Subscribe via Stripe Checkout
    // -----------------------------------------------
    const handleSubscribe = async (plan: "monthly" | "annual") => {
        const session = getSession();
        if (!session) return;

        setCheckoutLoading(plan);
        try {
            const res = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan,
                    userId: session.id,
                    email: session.email,
                    trainerProfileId: profile?.id || "",
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.url) {
                throw new Error(data.error || "Failed to start checkout");
            }

            window.location.href = data.url;
        } catch (err: any) {
            console.error("Subscribe error:", err);
            setPopup({ type: "error", title: "Checkout Failed", message: err.message || "Please try again." });
            setCheckoutLoading(null);
        }
    };

    // -----------------------------------------------
    // Apply for Founding 50
    // -----------------------------------------------
    const handleApplyFounding50 = async () => {
        const session = getSession();
        if (!session || !profile) return;

        if (spotsLeft <= 0) {
            setPopup({ type: "info", title: "No Spots Left", message: "All 50 founding spots have been claimed. Subscribe normally to continue." });
            return;
        }

        setApplyingFounding50(true);
        try {
            const { error } = await supabase
                .from("trainer_profiles")
                .update({ is_founding_50: true })
                .eq("id", profile.id);

            if (error) throw error;

            // Update local session
            if (session.trainerProfile) {
                setSession({ ...session, trainerProfile: { ...session.trainerProfile, is_founding_50: true } });
            }

            setProfile(prev => prev ? { ...prev, is_founding_50: true } : prev);
            setFounding50Count(c => c + 1);
            setPopup({
                type: "success",
                title: "Application Submitted!",
                message: "You've applied for the Founding 50 program. An admin will review your application and activate 6 months free access shortly.",
            });
        } catch (err: any) {
            setPopup({ type: "error", title: "Error", message: err.message || "Failed to apply. Please try again." });
        } finally {
            setApplyingFounding50(false);
        }
    };

    // -----------------------------------------------
    // Render helpers
    // -----------------------------------------------
    const getExpiryDisplay = () => {
        if (!profile?.subscription_expires_at) return null;
        const date = new Date(profile.subscription_expires_at);
        const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return { date: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), daysLeft };
    };
    const expiry = getExpiryDisplay();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 size={32} className="animate-spin text-primary opacity-60" />
            </div>
        );
    }

    return (
        <div className="max-w-[900px] w-full pb-12 space-y-8">

            {/* Header */}
            <div>
                <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm flex items-center gap-3">
                    <Crown size={28} className="text-primary" />
                    Subscription
                </h1>
                <p className="text-sm text-text-main/50 font-medium mt-1">
                    Manage your AirTrainr coach subscription
                </p>
            </div>

            {/* Current Status Banner */}
            {isTrialActive && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-[20px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Clock size={24} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-black text-blue-400 uppercase tracking-wider text-sm mb-1">
                            Free Trial Active — {trialInfo.daysLeft} day{trialInfo.daysLeft !== 1 ? "s" : ""} remaining
                        </p>
                        <p className="text-text-main/60 text-sm">
                            Trial ends{" "}
                            {trialInfo.trialEnd?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                            Subscribe now to keep uninterrupted access.
                        </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                        <span className="text-4xl font-black text-blue-400">{trialInfo.daysLeft}</span>
                        <p className="text-[10px] uppercase tracking-widest text-text-main/40 font-bold">days left</p>
                    </div>
                </div>
            )}

            {isActive && expiry && (
                <div className={`rounded-[20px] p-6 flex items-center gap-5 ${isVerified ? "bg-primary/5 border border-primary/20" : "bg-amber-500/5 border border-amber-500/20"}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isVerified ? "bg-primary/15" : "bg-amber-500/15"}`}>
                        {isVerified ? <CheckCircle size={24} className="text-primary" /> : <Clock size={24} className="text-amber-400" />}
                    </div>
                    <div className="flex-1">
                        <p className={`font-black uppercase tracking-wider text-sm mb-1 ${isVerified ? "text-primary" : "text-amber-400"}`}>
                            {profile?.is_founding_50 ? "Founding 50 — Active" : "Pro Subscription — Active"}
                            {!isVerified && " (Verification Pending)"}
                        </p>
                        <p className="text-text-main/60 text-sm">
                            {isVerified
                                ? <>Your subscription renews on {expiry.date}
                                    {expiry.daysLeft <= 14 && (
                                        <span className="ml-2 text-yellow-400 font-bold">({expiry.daysLeft} days left)</span>
                                    )}</>
                                : <>Your subscription is active. Awaiting admin verification to go live. Renews on {expiry.date}.</>
                            }
                        </p>
                    </div>
                    {profile?.is_founding_50 && (
                        <div className="shrink-0">
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase tracking-widest">
                                <Trophy size={12} /> Founding 50
                            </span>
                        </div>
                    )}
                </div>
            )}

            {isExpiredOrCancelled && !isFoundingPending && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-[20px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0">
                        <XCircle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-black text-red-400 uppercase tracking-wider text-sm mb-1">
                            {profile?.subscription_status === "cancelled" ? "Subscription Cancelled" : "Subscription Expired"}
                        </p>
                        <p className="text-text-main/60 text-sm">
                            Resubscribe below to restore your coaching profile and accept bookings.
                        </p>
                    </div>
                </div>
            )}

            {isFoundingPending && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-[20px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                        <Trophy size={24} className="text-yellow-500" />
                    </div>
                    <div>
                        <p className="font-black text-yellow-400 uppercase tracking-wider text-sm mb-1">
                            Founding 50 — Pending Admin Approval
                        </p>
                        <p className="text-text-main/60 text-sm">
                            Your application is under review. Once approved, you'll receive 6 months of free Pro access. You'll be notified shortly.
                        </p>
                    </div>
                </div>
            )}

            {/* Verification Pending Banner */}
            {isPendingVerification && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-[20px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Shield size={24} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-black text-amber-400 uppercase tracking-wider text-sm mb-1">
                            Pending Admin Verification
                        </p>
                        <p className="text-text-main/60 text-sm">
                            Your subscription is active but your profile is awaiting admin verification. You won&apos;t appear in search results or receive bookings until verified. This usually takes 24-48 hours.
                        </p>
                    </div>
                </div>
            )}

            {/* Pricing Cards — show when subscription is not active (trial/expired/cancelled can subscribe) */}
            {!isActive && (
                <div>
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-text-main/40 mb-5">
                        Choose Your Plan
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        {/* Monthly */}
                        <div className="bg-surface border border-white/5 rounded-[24px] p-7 flex flex-col gap-6 hover:border-white/[0.08] transition-all">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Monthly</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-main/30 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">Flexible</span>
                                </div>
                                <div className="flex items-end gap-1.5">
                                    <span className="text-5xl font-black text-text-main tracking-tighter">$25</span>
                                    <span className="text-text-main/40 font-medium mb-2 text-sm">/month</span>
                                </div>
                                <p className="text-text-main/40 text-xs mt-2">Cancel anytime. No lock-in.</p>
                            </div>
                            <button
                                onClick={() => handleSubscribe("monthly")}
                                disabled={checkoutLoading !== null}
                                className="w-full py-3.5 rounded-full bg-white/5 border border-white/10 text-text-main font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {checkoutLoading === "monthly" ? (
                                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                                ) : (
                                    "Subscribe Monthly"
                                )}
                            </button>
                        </div>

                        {/* Annual — Best Value */}
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25 rounded-[24px] p-7 flex flex-col gap-6 relative overflow-hidden">
                            {/* Best Value Badge */}
                            <div className="absolute top-5 right-5">
                                <span className="bg-primary text-bg text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                    Best Value
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Annual</span>
                                </div>
                                <div className="flex items-end gap-1.5">
                                    <span className="text-5xl font-black text-text-main tracking-tighter">$250</span>
                                    <span className="text-text-main/40 font-medium mb-2 text-sm">/year</span>
                                </div>
                                <p className="text-primary/80 text-xs font-bold mt-2">
                                    Save $50 vs monthly — ~$20.83/mo
                                </p>
                            </div>
                            <button
                                onClick={() => handleSubscribe("annual")}
                                disabled={checkoutLoading !== null}
                                className="w-full py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(69,208,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {checkoutLoading === "annual" ? (
                                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                                ) : (
                                    <><Zap size={16} /> Subscribe Annually</>
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-xs text-text-main/30 mt-4 font-medium">
                        Secure payment via Stripe · Cancel anytime from your subscription settings
                    </p>
                </div>
            )}

            {/* Founding 50 Section */}
            {(canApplyFounding50 || isFoundingPending) && (
                <div className="bg-gradient-to-br from-[#1a1500] to-[#1a1200] border border-yellow-500/20 rounded-[24px] p-7 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />

                    <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                            <Trophy size={24} className="text-yellow-500" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="text-lg font-black text-text-main uppercase tracking-wide">Founding 50</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                                    {spotsLeft} of {FOUNDING_50_MAX} spots left
                                </span>
                            </div>
                            <p className="text-text-main/60 text-sm leading-relaxed mb-5">
                                Are you one of our first coaches? Apply for the <strong className="text-yellow-400">Founding 50</strong> program and get{" "}
                                <strong className="text-yellow-400">6 months of free Pro access</strong> after admin approval. Founding members receive a special gold badge and lifetime recognition.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                {[
                                    { icon: Trophy, label: "Gold Founder Badge" },
                                    { icon: Calendar, label: "6 Months Free" },
                                    { icon: Users, label: "Lifetime Recognition" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2.5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl px-4 py-3">
                                        <Icon size={16} className="text-yellow-500 shrink-0" />
                                        <span className="text-xs font-bold text-text-main/80">{label}</span>
                                    </div>
                                ))}
                            </div>

                            {isFoundingPending ? (
                                <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold">
                                    <Clock size={16} />
                                    Application submitted — awaiting admin approval
                                </div>
                            ) : (
                                <button
                                    onClick={handleApplyFounding50}
                                    disabled={applyingFounding50 || spotsLeft <= 0}
                                    className="px-8 py-3 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-sm uppercase tracking-widest hover:bg-yellow-500/20 hover:border-yellow-500/50 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {applyingFounding50 ? (
                                        <><Loader2 size={16} className="animate-spin" /> Applying...</>
                                    ) : (
                                        <><Trophy size={16} /> Apply for Founding 50</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pro Features */}
            <div className="bg-surface border border-white/5 rounded-[24px] p-7">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-text-main/40 mb-5">
                    What's Included
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRO_FEATURES.map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Icon size={16} className="text-primary" />
                            </div>
                            <span className="text-sm font-medium text-text-main/80">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Popup */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-7 shadow-2xl max-w-sm w-full">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                                popup.type === "success" ? "bg-primary/20 text-primary" :
                                popup.type === "error" ? "bg-red-500/20 text-red-500" :
                                "bg-blue-500/20 text-blue-400"
                            }`}>
                                {popup.type === "success" ? <CheckCircle size={28} /> :
                                 popup.type === "error" ? <AlertTriangle size={28} /> :
                                 <Clock size={28} />}
                            </div>
                            <h3 className={`text-lg font-black uppercase tracking-wide mb-2 ${
                                popup.type === "success" ? "text-primary" :
                                popup.type === "error" ? "text-red-400" : "text-blue-400"
                            }`}>{popup.title}</h3>
                            <p className="text-text-main/70 text-sm leading-relaxed mb-6">{popup.message}</p>
                            <button
                                onClick={() => setPopup(null)}
                                className="w-full py-3 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all"
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
