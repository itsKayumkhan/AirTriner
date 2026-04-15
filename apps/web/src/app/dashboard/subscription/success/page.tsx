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

    useEffect(() => {
        const refresh = async () => {
            const authSession = getSession();
            if (!authSession) {
                router.push("/auth/login");
                return;
            }

            // Poll for up to 10 seconds for webhook to update the DB
            let attempts = 0;
            const maxAttempts = 10;

            const check = async () => {
                const { data } = await supabase
                    .from("trainer_profiles")
                    .select("subscription_status, subscription_expires_at, is_founding_50")
                    .eq("user_id", authSession.id)
                    .single();

                if (data?.subscription_status === "active" || attempts >= maxAttempts) {
                    setProfile(data);
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
                    <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
                        <CheckCircle size={40} className="text-primary" strokeWidth={2} />
                    </div>

                    <div>
                        <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                            You&apos;re Live!
                        </h1>
                        <p className="text-text-main/60 text-sm leading-relaxed">
                            Your AirTrainr Pro subscription is now active.
                            {expiryDate && (
                                <> Your plan renews on <strong className="text-text-main">{expiryDate}</strong>.</>
                            )}
                        </p>
                    </div>

                    {/* What's next */}
                    <div className="w-full bg-primary/5 border border-primary/15 rounded-2xl p-5 text-left space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3">
                            What&apos;s next
                        </p>
                        {[
                            "Complete your profile to appear in search results",
                            "Set your availability so athletes can book you",
                            "Connect Stripe to receive payments",
                        ].map((item) => (
                            <div key={item} className="flex items-start gap-2.5">
                                <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
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
