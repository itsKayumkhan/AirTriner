"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { Send, Loader2, CheckCircle, Mail, MapPin, Clock } from "lucide-react";

const SUBJECTS = [
    "General",
    "Become a Trainer",
    "Founding 50 Program",
    "Bug Report",
    "Billing",
    "Other",
] as const;

const MAX_MESSAGE = 500;

export default function GlobalContactPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState<string>(SUBJECTS[0]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            setEmail(session.email);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!message.trim() || !email.trim()) {
            setError("Email and message are required.");
            return;
        }

        setLoading(true);
        try {
            const fullMessage = name.trim()
                ? `Name: ${name.trim()}\n\n${message.trim()}`
                : message.trim();

            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.id ?? null,
                    email: email.trim(),
                    subject,
                    message: fullMessage,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to send");
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message || "Could not send. Please try again or email contact@airtrainr.com");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: "var(--color-bg)", color: "white", minHeight: "100vh" }}>
            {/* Top bar — minimal, just logo + back to home */}
            <nav
                style={{
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--gray-900)",
                }}
            >
                <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            overflow: "hidden",
                        }}
                    >
                        <img src="/logo.jpeg" alt="AirTrainr" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span
                        style={{
                            fontSize: "20px",
                            fontWeight: 800,
                            fontFamily: "var(--font-display)",
                            color: "white",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                        }}
                    >
                        AIRTRAINR
                    </span>
                </a>
                <a
                    href="/"
                    style={{
                        color: "var(--gray-300)",
                        textDecoration: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                    }}
                >
                    ← Back to home
                </a>
            </nav>

            <section
                style={{
                    padding: "80px 24px",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "10%",
                        right: "-10%",
                        width: "500px",
                        height: "500px",
                        background: "var(--primary)",
                        filter: "blur(200px)",
                        opacity: 0.06,
                        borderRadius: "50%",
                        zIndex: 0,
                    }}
                />

                <div
                    className="contact-container"
                    style={{
                        maxWidth: "1100px",
                        margin: "0 auto",
                        position: "relative",
                        zIndex: 1,
                        display: "grid",
                        gridTemplateColumns: "1fr 1.4fr",
                        gap: "64px",
                        alignItems: "start",
                    }}
                >
                    {/* LEFT — info */}
                    <div className="contact-left">
                        <div
                            style={{
                                display: "inline-block",
                                background: "rgba(69,208,255,0.1)",
                                border: "1px solid rgba(69,208,255,0.25)",
                                borderRadius: "var(--radius-full)",
                                padding: "6px 16px",
                                marginBottom: "20px",
                                fontSize: "11px",
                                fontWeight: 800,
                                color: "var(--primary)",
                                letterSpacing: "1.5px",
                                textTransform: "uppercase",
                            }}
                        >
                            We're listening
                        </div>
                        <h1
                            style={{
                                fontSize: "clamp(32px, 5vw, 48px)",
                                fontWeight: 900,
                                fontFamily: "var(--font-display)",
                                textTransform: "uppercase",
                                lineHeight: 1.05,
                                letterSpacing: "-0.5px",
                                marginBottom: "20px",
                            }}
                        >
                            GET IN{" "}
                            <span
                                style={{
                                    color: "var(--primary)",
                                    fontStyle: "italic",
                                    textShadow: "0 0 30px rgba(69,208,255,0.45)",
                                }}
                            >
                                TOUCH
                            </span>
                        </h1>
                        <p style={{ color: "var(--gray-400)", fontSize: "15px", lineHeight: 1.7, marginBottom: "32px" }}>
                            Question about pricing, the Founding 50 program, or just want to say hi?
                            Drop us a message — we usually reply within 24 hours.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {[
                                {
                                    icon: <Mail className="w-5 h-5" />,
                                    label: "Email us",
                                    value: "contact@airtrainr.com",
                                },
                                {
                                    icon: <Clock className="w-5 h-5" />,
                                    label: "Response time",
                                    value: "Usually within 24 hours",
                                },
                                {
                                    icon: <MapPin className="w-5 h-5" />,
                                    label: "Based in",
                                    value: "North America — serving athletes worldwide",
                                },
                            ].map((c) => (
                                <div key={c.label} style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                                    <div
                                        style={{
                                            width: "44px",
                                            height: "44px",
                                            borderRadius: "12px",
                                            background: "rgba(69,208,255,0.1)",
                                            color: "var(--primary)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            border: "1px solid rgba(69,208,255,0.2)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {c.icon}
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "11px",
                                                fontWeight: 800,
                                                color: "var(--gray-500)",
                                                letterSpacing: "1px",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {c.label}
                                        </div>
                                        <div style={{ fontSize: "14px", color: "white", fontWeight: 600 }}>{c.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT — form / success */}
                    <div className="contact-right">
                        {submitted ? (
                            <div
                                style={{
                                    background: "var(--surface)",
                                    border: "1px solid rgba(69,208,255,0.4)",
                                    borderRadius: "var(--radius-xl)",
                                    padding: "48px 32px",
                                    textAlign: "center",
                                    boxShadow: "0 0 30px rgba(69,208,255,0.12)",
                                }}
                            >
                                <div
                                    style={{
                                        width: "72px",
                                        height: "72px",
                                        borderRadius: "50%",
                                        background: "rgba(69,208,255,0.15)",
                                        border: "1px solid rgba(69,208,255,0.4)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 24px",
                                    }}
                                >
                                    <CheckCircle size={36} color="var(--primary)" />
                                </div>
                                <h2
                                    style={{
                                        fontSize: "28px",
                                        fontWeight: 900,
                                        fontFamily: "var(--font-display)",
                                        textTransform: "uppercase",
                                        marginBottom: "12px",
                                    }}
                                >
                                    Message sent
                                </h2>
                                <p style={{ color: "var(--gray-400)", fontSize: "14px", lineHeight: 1.6 }}>
                                    Thanks for reaching out! We&apos;ll get back to you at{" "}
                                    <span style={{ color: "white", fontWeight: 600 }}>{email}</span> within 24 hours.
                                </p>
                                <button
                                    onClick={() => {
                                        setSubmitted(false);
                                        setMessage("");
                                        setName("");
                                    }}
                                    style={{
                                        marginTop: "28px",
                                        padding: "12px 28px",
                                        background: "transparent",
                                        color: "white",
                                        border: "1px solid var(--gray-700)",
                                        borderRadius: "var(--radius-full)",
                                        fontWeight: 700,
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        letterSpacing: "1.5px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form
                                onSubmit={handleSubmit}
                                style={{
                                    background: "var(--surface)",
                                    border: "1px solid var(--gray-800)",
                                    borderRadius: "var(--radius-xl)",
                                    padding: "32px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "18px",
                                }}
                            >
                                <div className="contact-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                    <div>
                                        <label style={labelStyle}>Your name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Optional"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Email *</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            placeholder="you@example.com"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Topic</label>
                                    <select
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        style={{ ...inputStyle, cursor: "pointer" }}
                                    >
                                        {SUBJECTS.map((s) => (
                                            <option key={s} value={s} style={{ background: "var(--color-bg)" }}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>
                                        Message * <span style={{ color: "var(--gray-500)", fontWeight: 400 }}>({message.length}/{MAX_MESSAGE})</span>
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                                        required
                                        rows={6}
                                        placeholder="Tell us what's on your mind..."
                                        style={{ ...inputStyle, resize: "vertical", minHeight: "140px", lineHeight: 1.5 }}
                                    />
                                </div>

                                {error && (
                                    <div
                                        style={{
                                            background: "rgba(239,68,68,0.08)",
                                            border: "1px solid rgba(239,68,68,0.3)",
                                            color: "#fca5a5",
                                            padding: "10px 14px",
                                            borderRadius: "var(--radius-md)",
                                            fontSize: "13px",
                                        }}
                                    >
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        marginTop: "8px",
                                        padding: "14px 24px",
                                        background: "var(--primary)",
                                        color: "var(--color-bg)",
                                        border: "none",
                                        borderRadius: "var(--radius-full)",
                                        fontWeight: 800,
                                        fontSize: "13px",
                                        textTransform: "uppercase",
                                        letterSpacing: "1.5px",
                                        cursor: loading ? "wait" : "pointer",
                                        opacity: loading ? 0.7 : 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "10px",
                                        boxShadow: "0 0 20px rgba(69,208,255,0.35)",
                                    }}
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
                        )}
                    </div>
                </div>

                <style>{`
                    @media (max-width: 968px) {
                        .contact-container {
                            grid-template-columns: 1fr !important;
                            gap: 40px !important;
                        }
                    }
                    @media (max-width: 540px) {
                        .contact-row { grid-template-columns: 1fr !important; }
                    }
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </section>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 800,
    color: "var(--gray-400)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "var(--color-bg)",
    border: "1px solid var(--gray-800)",
    borderRadius: "var(--radius-md)",
    color: "white",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
};
