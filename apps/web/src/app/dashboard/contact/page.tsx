"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/Toast";

const SUBJECTS = [
    "General",
    "Bug Report",
    "Feature Request",
    "Billing",
    "Other",
] as const;

const MAX_MESSAGE = 500;

export default function ContactPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState<string>(SUBJECTS[0]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            setEmail(session.email);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !email.trim()) return;

        setLoading(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.id ?? null,
                    email: email.trim(),
                    subject,
                    message: message.trim(),
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to send");
            }

            setSubmitted(true);
            toast.success("Message Sent", "We'll get back to you soon.");
        } catch {
            toast.error("Failed to Send", "Please try again or email us at contact@airtrainr.com");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-xl mx-auto py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} className="text-emerald-400" />
                </div>
                <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                    Message Sent
                </h1>
                <p className="text-text-main/60 mt-3 text-sm">
                    Thanks for reaching out! We&apos;ll get back to you at <span className="text-text-main/80 font-semibold">{email}</span> as soon as possible.
                </p>
                <button
                    onClick={() => {
                        setSubmitted(false);
                        setMessage("");
                        setSubject(SUBJECTS[0]);
                    }}
                    className="mt-8 px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-lg text-sm font-semibold text-text-main transition-colors"
                >
                    Send Another Message
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                    Contact Us
                </h1>
                <p className="text-text-main/50 text-sm mt-2">
                    Have a question, found a bug, or want to request a feature? We&apos;d love to hear from you.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                    <label className="block text-sm font-semibold text-text-main/70 mb-1.5">
                        Email
                    </label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-sm text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                </div>

                {/* Subject */}
                <div>
                    <label className="block text-sm font-semibold text-text-main/70 mb-1.5">
                        Subject
                    </label>
                    <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors appearance-none cursor-pointer"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                    >
                        {SUBJECTS.map((s) => (
                            <option key={s} value={s} className="bg-zinc-900 text-white">
                                {s}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-semibold text-text-main/70 mb-1.5">
                        Message
                    </label>
                    <textarea
                        required
                        value={message}
                        onChange={(e) => {
                            if (e.target.value.length <= MAX_MESSAGE) {
                                setMessage(e.target.value);
                            }
                        }}
                        placeholder="Tell us what's on your mind..."
                        rows={5}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-sm text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
                    />
                    <div className="flex justify-end mt-1">
                        <span className={`text-xs font-medium ${message.length >= MAX_MESSAGE ? "text-red-400" : message.length >= MAX_MESSAGE * 0.8 ? "text-amber-400" : "text-text-main/30"}`}>
                            {message.length}/{MAX_MESSAGE}
                        </span>
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading || !message.trim() || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-bg font-bold text-sm py-3 rounded-lg transition-all"
                >
                    {loading ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send size={16} />
                            Send Message
                        </>
                    )}
                </button>
            </form>

            {/* Fallback info */}
            <p className="text-center text-text-main/30 text-xs mt-6">
                You can also reach us at{" "}
                <a href="mailto:contact@airtrainr.com" className="text-primary/60 hover:text-primary transition-colors underline">
                    contact@airtrainr.com
                </a>
            </p>
        </div>
    );
}
