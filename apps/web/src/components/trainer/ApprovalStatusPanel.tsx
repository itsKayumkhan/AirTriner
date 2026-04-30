"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck, CreditCard, UserCheck, Lock, Sparkles, AlertTriangle, ChevronDown } from "lucide-react";
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
    const [open, setOpen] = useState(!allMet && remaining > 0 ? false : false);

    return (
        <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="w-full text-left flex items-start gap-3 p-4 hover:bg-white/[0.02] transition-colors"
                aria-expanded={open}
            >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${allMet ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                    {allMet ? <Sparkles size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${allMet ? "text-emerald-300" : "text-amber-300"}`}>
                        {allMet ? "You're live!" : `${remaining} of ${conditions.length} step${remaining > 1 ? "s" : ""} remaining`}
                    </p>
                    <p className="text-xs text-text-main/50 mt-0.5 leading-relaxed">
                        {allMet
                            ? "Athletes can now find and book you. Tap to review checklist."
                            : "Your profile is hidden from athletes. Tap to see what's missing."}
                    </p>
                </div>
                <ChevronDown
                    size={18}
                    className={`text-text-main/40 shrink-0 mt-2 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
            <div className="p-5 border-t border-white/[0.06]">
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
            )}
        </div>
    );
}
