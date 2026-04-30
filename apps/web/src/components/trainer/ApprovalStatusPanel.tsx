"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck, CreditCard, UserCheck, Lock, Sparkles, AlertTriangle } from "lucide-react";
import { computeTrainerCompleteness } from "@/lib/profile-completeness";

type Props = {
    user: {
        is_suspended?: boolean | null;
        deleted_at?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        date_of_birth?: string | null;
        avatar_url?: string | null;
    } | null;
    trainerProfile: {
        verification_status?: string | null;
        subscription_status?: string | null;
        bio?: string | null;
        sports?: string[] | null;
        city?: string | null;
        years_experience?: number | null;
        session_pricing?: any;
        training_locations?: string[] | null;
    } | null;
};

const ACTIVE_SUB = new Set(["trial", "active"]);

export default function ApprovalStatusPanel({ user, trainerProfile }: Props) {
    const completeness = computeTrainerCompleteness(user || {}, trainerProfile || {});

    const verified = trainerProfile?.verification_status === "verified";
    const subStatus = (trainerProfile?.subscription_status || "").toLowerCase();
    const subActive = ACTIVE_SUB.has(subStatus);
    const accountActive = !user?.is_suspended && !user?.deleted_at;
    const profileComplete = completeness.complete;

    const conditions = [
        {
            key: "verification",
            met: verified,
            icon: ShieldCheck,
            title: "Admin verification",
            explainer: verified
                ? "An admin has reviewed and verified your account."
                : "An admin needs to review your credentials before you go live.",
            cta: verified ? null : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300/80">
                    <AlertTriangle size={12} /> Awaiting admin review — typically 24-48 hours
                </span>
            ),
        },
        {
            key: "subscription",
            met: subActive,
            icon: CreditCard,
            title: "Active subscription",
            explainer: subActive
                ? subStatus === "trial"
                    ? "You're on the 7-day trial. Upgrade anytime to keep your profile live."
                    : "Your subscription is active."
                : "Start a subscription (or trial) to be discoverable by athletes.",
            cta: subActive ? null : (
                <Link
                    href="/dashboard/subscription"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-bg text-xs font-bold hover:brightness-110 active:scale-95 transition"
                >
                    Start subscription
                </Link>
            ),
        },
        {
            key: "profile",
            met: profileComplete,
            icon: UserCheck,
            title: "Profile complete",
            explainer: profileComplete
                ? `All ${completeness.total} mandatory fields are filled.`
                : `${completeness.filled} of ${completeness.total} mandatory fields filled.`,
            sublist: !profileComplete ? completeness.missing : undefined,
            cta: profileComplete ? null : (
                <Link
                    href="/dashboard/trainer/setup"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-bg text-xs font-bold hover:brightness-110 active:scale-95 transition"
                >
                    Complete profile
                </Link>
            ),
        },
        {
            key: "account",
            met: accountActive,
            icon: Lock,
            title: "Account active",
            explainer: accountActive
                ? "Your account is in good standing."
                : user?.deleted_at
                    ? "Your account has been deleted."
                    : "Your account is currently suspended.",
            cta: accountActive ? null : (
                <a
                    href="mailto:support@airtrainr.com"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/20 transition"
                >
                    Contact support
                </a>
            ),
        },
    ];

    const metCount = conditions.filter((c) => c.met).length;
    const allMet = metCount === conditions.length;
    const remaining = conditions.length - metCount;

    return (
        <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-bold text-text-main">Public Visibility Status</h2>
                <p className="text-xs text-text-main/40 mt-0.5">
                    All four steps must be complete before athletes can find and book you.
                </p>
            </div>

            <div className="p-5">
                {allMet ? (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Sparkles size={15} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-emerald-300">You&apos;re live!</p>
                            <p className="text-text-main/50 text-xs mt-0.5 leading-relaxed">
                                Athletes can now find and book you. Keep your availability and profile up to date.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <AlertTriangle size={15} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-amber-300">
                                {remaining} of {conditions.length} step{remaining > 1 ? "s" : ""} remaining
                            </p>
                            <p className="text-text-main/50 text-xs mt-0.5 leading-relaxed">
                                Your profile is hidden from athletes until everything below is checked off.
                            </p>
                        </div>
                    </div>
                )}

                <ul className="space-y-3">
                    {conditions.map((c) => {
                        const Icon = c.icon;
                        return (
                            <li
                                key={c.key}
                                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                                    c.met
                                        ? "bg-emerald-500/[0.03] border-emerald-500/15"
                                        : "bg-white/[0.02] border-white/[0.06]"
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                        c.met ? "bg-emerald-500/10" : "bg-white/[0.04]"
                                    }`}
                                >
                                    {c.met ? (
                                        <CheckCircle2 size={18} className="text-emerald-400" />
                                    ) : (
                                        <XCircle size={18} className="text-red-400" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Icon size={13} className="text-text-main/40" />
                                        <p className="text-sm font-bold text-text-main">{c.title}</p>
                                    </div>
                                    <p className="text-xs text-text-main/50 mt-1 leading-relaxed">{c.explainer}</p>

                                    {c.sublist && c.sublist.length > 0 && (
                                        <ul className="mt-3 space-y-1.5">
                                            {c.sublist.map((m) => (
                                                <li key={m} className="flex items-center gap-2 text-xs text-text-main/60">
                                                    <span className="w-1 h-1 rounded-full bg-red-400/70" />
                                                    {m}
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {c.cta && <div className="mt-3">{c.cta}</div>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
