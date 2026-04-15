"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, setSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";

export default function SubscriptionSuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        const refresh = async () => {
            const authSession = getSession();
            if (!authSession) {
                router.push("/auth/login");
                return;
            }

            // Fallback: directly verify session with Stripe and activate subscription
            // (in case webhook hasn't fired yet — common on localhost)
            if (sessionId) {
                try {
                    await fetch("/api/stripe/verify-subscription", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId }),
                    });
                } catch (err) {
                    console.warn("Verify subscription fallback failed:", err);
                }
            }

            // Poll for up to 10 seconds for DB to reflect active status
            let attempts = 0;
            const maxAttempts = 10;

            const check = async () => {
                const { data } = await supabase
                    .from("trainer_profiles")
                    .select("subscription_status, subscription_expires_at, is_founding_50, verification_status")
                    .eq("user_id", authSession.id)
                    .single();

                if (data?.subscription_status === "active" || attempts >= maxAttempts) {
                    setProfile(data);
                    setIsVerified(data?.verification_status === "verified");
                    // Refresh local session with updated subscription info
                    if (data && authSession.trainerProfile) {
                        setSession({
                            ...authSession,
                            trainerProfile: { ...authSession.trainerProfile, ...data },
                        });
                    }
                    setLoading(false);
                } else {
                    attempts++;
                    setTimeout(check, 1000);
                }
            };

            await check();
        };

        refresh();
    }, [router]);

    const expiryDate = profile?.subscription_expires_at
        ? new Date(profile.subscription_expires_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
          })
        : null;

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            {loading ? (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="animate-spin text-primary opacity-60" />
                    <p className="text-text-main/50 font-medium">Activating your subscription...</p>
                </div>
            ) : (
                <div className="max-w-md w-full bg-surface border border-white/5 rounded-[28px] p-10 flex flex-col items-center gap-6">
                    {/* Success Icon */}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isVerified ? "bg-primary/15" : "bg-amber-500/15"}`}>
                        {isVerified ? (
                            <CheckCircle size={40} className="text-primary" strokeWidth={2} />
                        ) : (
                            <Loader2 size={40} className="text-amber-400" strokeWidth={2} />
                        )}
                    </div>

                    <div>
                        <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                            {isVerified ? "You're Live!" : "Almost There!"}
                        </h1>
                        <p className="text-text-main/60 text-sm leading-relaxed">
                            {isVerified ? (
                                <>Your AirTrainr Pro subscription is now active.
                                {expiryDate && (
                                    <> Your plan renews on <strong className="text-text-main">{expiryDate}</strong>.</>
                                )}</>
                            ) : (
                                <>Your subscription is active, but your profile is <strong className="text-amber-400">pending admin verification</strong>. You won&apos;t appear in search results until verified.
                                {expiryDate && (
                                    <> Your plan renews on <strong className="text-text-main">{expiryDate}</strong>.</>
                                )}</>
                            )}
                        </p>
                    </div>

                    {/* What's next */}
                    <div className={`w-full rounded-2xl p-5 text-left space-y-3 ${isVerified ? "bg-primary/5 border border-primary/15" : "bg-amber-500/5 border border-amber-500/15"}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isVerified ? "text-primary/70" : "text-amber-400/70"}`}>
                            What&apos;s next
                        </p>
                        {(isVerified ? [
                            "Complete your profile to appear in search results",
                            "Set your availability so athletes can book you",
                            "Connect Stripe to receive payments",
                        ] : [
                            "Wait for admin to verify your profile",
                            "Complete your profile setup while you wait",
                            "Set your availability so athletes can book you once verified",
                            "Connect Stripe to receive payments",
                        ]).map((item) => (
                            <div key={item} className="flex items-start gap-2.5">
                                <CheckCircle size={14} className={`shrink-0 mt-0.5 ${isVerified ? "text-primary" : "text-amber-400"}`} />
                                <span className="text-sm text-text-main/70 font-medium">{item}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(69,208,255,0.3)] transition-all flex items-center justify-center gap-2"
                    >
                        Go to Dashboard <ArrowRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
