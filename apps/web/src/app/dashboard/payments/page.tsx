"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import {
    CheckCircle,
    AlertTriangle,
    ExternalLink,
    Loader2,
    Building2,
    CreditCard,
    ShieldCheck,
    ArrowRight,
} from "lucide-react";

type ConnectStatus = {
    hasAccount: boolean;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    bankLast4: string | null;
    bankName: string | null;
    dashboardUrl: string | null;
    accountId?: string;
};

export default function PaymentSettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [status, setStatus] = useState<ConnectStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        fetchStatus(session.id);
    }, [router]);

    // Show success toast when returning from Stripe onboarding
    useEffect(() => {
        if (searchParams.get("onboarding") === "complete") {
            // Re-fetch status after returning from Stripe
            if (user) fetchStatus(user.id);
        }
        if (searchParams.get("refresh") === "true") {
            if (user) fetchStatus(user.id);
        }
    }, [searchParams, user]);

    const fetchStatus = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/stripe/connect-status?userId=${userId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch status");
            setStatus(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        if (!user) return;
        setConnecting(true);
        setError(null);
        try {
            const res = await fetch("/api/stripe/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, email: user.email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to start onboarding");
            // Redirect to Stripe onboarding
            window.location.href = data.url;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setConnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-[800px] w-full pb-12">
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary mb-4" />
                    <p className="text-text-main/60 text-sm">Loading payment settings...</p>
                </div>
            </div>
        );
    }

    const isFullyConnected = status?.hasAccount && status?.onboardingComplete && status?.payoutsEnabled;
    const isPartial = status?.hasAccount && !status?.onboardingComplete;

    return (
        <div className="max-w-[800px] w-full pb-12">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                    PAYMENT SETTINGS
                </h1>
                <p className="text-text-main/60 font-medium text-[15px]">
                    Connect your bank account to receive payouts from training sessions.
                </p>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/25 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-red-300 text-sm font-semibold">{error}</p>
                        <button
                            onClick={() => user && fetchStatus(user.id)}
                            className="text-red-400 text-xs font-bold mt-1 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {/* Main Card */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">

                {/* Status Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        isFullyConnected
                            ? "bg-emerald-500/15 text-emerald-400"
                            : isPartial
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-white/5 text-text-main/40"
                    }`}>
                        {isFullyConnected ? (
                            <ShieldCheck size={28} strokeWidth={2} />
                        ) : isPartial ? (
                            <AlertTriangle size={28} strokeWidth={2} />
                        ) : (
                            <Building2 size={28} strokeWidth={2} />
                        )}
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">
                            {isFullyConnected
                                ? "Payouts Enabled"
                                : isPartial
                                ? "Setup Incomplete"
                                : "Bank Account Not Connected"}
                        </h2>
                        <p className="text-text-main/50 text-sm">
                            {isFullyConnected
                                ? "Your bank account is connected and ready to receive payouts."
                                : isPartial
                                ? "You started the setup but haven't finished. Complete it to receive payouts."
                                : "Connect your bank account through Stripe to start receiving payouts."}
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5 my-6" />

                {/* Fully Connected State */}
                {isFullyConnected && (
                    <div className="space-y-5">
                        {/* Status Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 flex items-center gap-3">
                                <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Payouts</p>
                                    <p className="text-white text-sm font-semibold">Enabled</p>
                                </div>
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 flex items-center gap-3">
                                <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Charges</p>
                                    <p className="text-white text-sm font-semibold">Enabled</p>
                                </div>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                                <CreditCard size={18} className="text-text-main/50 shrink-0" />
                                <div>
                                    <p className="text-text-main/50 text-xs font-bold uppercase tracking-wider">Bank</p>
                                    <p className="text-white text-sm font-semibold">
                                        {status.bankName ? `${status.bankName} ` : ""}
                                        {status.bankLast4 ? `****${status.bankLast4}` : "Connected"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stripe Dashboard Link */}
                        {status.dashboardUrl && (
                            <a
                                href={status.dashboardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-text-main/70 text-sm font-bold hover:border-primary/30 hover:text-primary transition-all"
                            >
                                <ExternalLink size={16} />
                                Manage on Stripe Dashboard
                            </a>
                        )}
                    </div>
                )}

                {/* Partial / Incomplete Onboarding */}
                {isPartial && (
                    <div className="space-y-5">
                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-5 py-4">
                            <p className="text-amber-300 text-sm font-semibold mb-1">Almost there!</p>
                            <p className="text-text-main/60 text-sm">
                                Your Stripe account was created but onboarding is not complete.
                                You need to finish adding your bank details and identity verification.
                            </p>
                        </div>
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(69,208,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {connecting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <ArrowRight size={18} />
                            )}
                            {connecting ? "Redirecting..." : "Complete Setup"}
                        </button>
                    </div>
                )}

                {/* Not Connected */}
                {!status?.hasAccount && (
                    <div className="space-y-5">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl px-5 py-5">
                            <h3 className="text-white font-bold text-sm mb-3">How it works</h3>
                            <div className="space-y-3">
                                {[
                                    "Click the button below to connect via Stripe (our payment processor).",
                                    "Stripe will ask for your bank details and verify your identity.",
                                    "Once set up, payouts from completed training sessions go directly to your bank.",
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-text-main/50 text-xs font-bold shrink-0 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <p className="text-text-main/60 text-sm">{step}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(69,208,255,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {connecting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Building2 size={18} />
                            )}
                            {connecting ? "Redirecting to Stripe..." : "Connect Bank Account"}
                        </button>

                        <p className="text-text-main/30 text-xs">
                            Powered by Stripe. Your banking details are never stored on our servers.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
