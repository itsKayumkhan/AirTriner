"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Send, Users, Plus, X, Clock, MapPin, DollarSign, Star, ChevronRight, Filter, Search, Calendar, MessageSquare, Zap, Award, PartyPopper } from "lucide-react";

interface Athlete {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    athlete_profile: {
        sports: string[];
        skill_level: string;
        city: string | null;
        state: string | null;
    } | null;
}

interface Offer {
    id: string;
    athlete_id: string;
    athlete_name: string;
    sport: string;
    message: string;
    session_type: string;
    rate: number;
    status: "pending" | "accepted" | "declined";
    created_at: string;
}

export default function TrainingOffersPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [showNewOffer, setShowNewOffer] = useState(false);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sending, setSending] = useState(false);
    const [tab, setTab] = useState<"athletes" | "sent">("athletes");

    const [offerData, setOfferData] = useState({
        message: "",
        sessionType: "private",
        rate: "",
        introDiscount: false,
        discountPercent: "20",
        timeSlot: "",
    });

    useEffect(() => {
        const session = getSession();
        if (!session || session.role !== "trainer") {
            router.push("/dashboard");
            return;
        }
        setUser(session);
        loadData(session);
    }, [router]);

    const loadData = async (session: AuthUser) => {
        try {
            // Load athletes
            const { data: athleteData } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url, athlete_profiles(sports, skill_level, city, state)")
                .eq("role", "athlete")
                .limit(50);

            if (athleteData) {
                setAthletes(athleteData.map((a: Record<string, unknown>) => ({
                    id: a.id as string,
                    first_name: a.first_name as string,
                    last_name: a.last_name as string,
                    avatar_url: a.avatar_url as string | null,
                    athlete_profile: Array.isArray(a.athlete_profiles) && a.athlete_profiles.length > 0
                        ? a.athlete_profiles[0] as Athlete['athlete_profile']
                        : null,
                })));
            }

            // Load sent offers (from notifications)
            const { data: notifData } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", session.id)
                .eq("type", "training_offer_sent")
                .order("created_at", { ascending: false });

            if (notifData) {
                setOffers(notifData.map((n: Record<string, unknown>) => {
                    const data = n.data as Record<string, unknown> || {};
                    return {
                        id: n.id as string,
                        athlete_id: data.athlete_id as string || "",
                        athlete_name: data.athlete_name as string || "Unknown",
                        sport: data.sport as string || "",
                        message: data.message as string || "",
                        session_type: data.session_type as string || "private",
                        rate: data.rate as number || 0,
                        status: data.status as "pending" | "accepted" | "declined" || "pending",
                        created_at: n.created_at as string,
                    };
                }));
            }
        } catch (err) {
            console.error("Failed to load data:", err);
        } finally {
            setLoading(false);
        }
    };

    const sendOffer = async () => {
        if (!user || !selectedAthlete) return;
        setSending(true);

        try {
            const rate = parseFloat(offerData.rate) || (user.trainerProfile?.hourly_rate ? Number(user.trainerProfile.hourly_rate) : 50);
            const finalRate = offerData.introDiscount ? rate * (1 - parseInt(offerData.discountPercent) / 100) : rate;

            // Create notification for the athlete
            await supabase.from("notifications").insert({
                user_id: selectedAthlete.id,
                type: "training_offer",
                title: `Training Offer from ${user.firstName} ${user.lastName}`,
                body: offerData.message || `${user.firstName} wants to train with you! Rate: $${finalRate.toFixed(0)}/hr`,
                data: {
                    trainer_id: user.id,
                    trainer_name: `${user.firstName} ${user.lastName}`,
                    sport: selectedAthlete.athlete_profile?.sports?.[0] || "",
                    session_type: offerData.sessionType,
                    rate: finalRate,
                    original_rate: rate,
                    has_discount: offerData.introDiscount,
                    time_slot: offerData.timeSlot,
                },
            });

            // Track in trainer's notifications
            await supabase.from("notifications").insert({
                user_id: user.id,
                type: "training_offer_sent",
                title: `Offer sent to ${selectedAthlete.first_name} ${selectedAthlete.last_name}`,
                body: `Rate: $${finalRate.toFixed(0)}/hr — ${offerData.sessionType} session`,
                data: {
                    athlete_id: selectedAthlete.id,
                    athlete_name: `${selectedAthlete.first_name} ${selectedAthlete.last_name}`,
                    sport: selectedAthlete.athlete_profile?.sports?.[0] || "",
                    message: offerData.message,
                    session_type: offerData.sessionType,
                    rate: finalRate,
                    status: "pending",
                },
            });

            // Reset
            setShowNewOffer(false);
            setSelectedAthlete(null);
            setOfferData({ message: "", sessionType: "private", rate: "", introDiscount: false, discountPercent: "20", timeSlot: "" });

            // Reload
            if (user) loadData(user);
        } catch (err) {
            console.error("Failed to send offer:", err);
            alert("Failed to send offer. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const filteredAthletes = athletes.filter(a => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        const sports = a.athlete_profile?.sports?.join(" ").toLowerCase() || "";
        const location = `${a.athlete_profile?.city || ""} ${a.athlete_profile?.state || ""}`.toLowerCase();
        const query = searchTerm.toLowerCase();
        return name.includes(query) || sports.includes(query) || location.includes(query);
    });

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "12px 16px", borderRadius: "12px",
        border: "1px solid #e2e8f0", fontSize: "15px", outline: "none",
        background: "#fff", color: "#0f172a",
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <div style={{ width: "48px", height: "48px", border: "4px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Training Offers</h1>
                    <p style={{ color: "#64748b", fontSize: "15px" }}>Send personalized offers to athletes and grow your business.</p>
                </div>
                <button
                    onClick={() => { setShowNewOffer(true); setTab("athletes"); }}
                    style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "12px 24px", borderRadius: "12px", border: "none",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                    }}
                >
                    <Plus size={18} /> New Offer
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", padding: "4px", background: "#f1f5f9", borderRadius: "14px", marginBottom: "24px" }}>
                {[
                    { key: "athletes", label: "Browse Athletes", icon: <Users size={16} /> },
                    { key: "sent", label: `Sent Offers (${offers.length})`, icon: <Send size={16} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as "athletes" | "sent")}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            padding: "10px", borderRadius: "10px", border: "none",
                            background: tab === t.key ? "white" : "transparent",
                            color: tab === t.key ? "#0f172a" : "#64748b",
                            fontWeight: tab === t.key ? 700 : 500, fontSize: "14px", cursor: "pointer",
                            boxShadow: tab === t.key ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                            transition: "all 0.2s",
                        }}
                    >{t.icon} {t.label}</button>
                ))}
            </div>

            {/* Athletes Tab */}
            {tab === "athletes" && (
                <div>
                    {/* Search */}
                    <div style={{ position: "relative", marginBottom: "20px" }}>
                        <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search athletes by name, sport, or location..."
                            style={{ ...inputStyle, paddingLeft: "42px" }}
                        />
                    </div>

                    {/* Athletes Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                        {filteredAthletes.length === 0 ? (
                            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
                                <Users size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                                <p style={{ fontSize: "16px", fontWeight: 600 }}>No athletes found</p>
                                <p style={{ fontSize: "14px" }}>Try adjusting your search or check back soon.</p>
                            </div>
                        ) : (
                            filteredAthletes.map((athlete) => (
                                <div key={athlete.id}
                                    style={{
                                        background: "white", borderRadius: "16px", border: "1px solid #e2e8f0",
                                        padding: "20px", cursor: "pointer", transition: "all 0.2s",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)"; }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                                        <div style={{
                                            width: "48px", height: "48px", borderRadius: "14px",
                                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "white", fontWeight: 800, fontSize: "16px",
                                        }}>
                                            {athlete.first_name?.charAt(0)}{athlete.last_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>{athlete.first_name} {athlete.last_name}</h3>
                                            <p style={{ fontSize: "13px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                                                {athlete.athlete_profile?.city && athlete.athlete_profile?.state ? (
                                                    <><MapPin size={12} /> {athlete.athlete_profile.city}, {athlete.athlete_profile.state}</>
                                                ) : (
                                                    "Location not set"
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Sports Tags */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                                        {(athlete.athlete_profile?.sports || []).slice(0, 3).map((s: string) => (
                                            <span key={s} style={{
                                                padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
                                                background: "#eef2ff", color: "#4338ca",
                                            }}>
                                                {s.replace(/_/g, " ")}
                                            </span>
                                        ))}
                                        {athlete.athlete_profile?.skill_level && (
                                            <span style={{
                                                padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
                                                background: "#f0fdf4", color: "#16a34a",
                                            }}>
                                                {athlete.athlete_profile.skill_level}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => { setSelectedAthlete(athlete); setShowNewOffer(true); }}
                                        style={{
                                            width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                            color: "white", fontWeight: 600, fontSize: "13px", cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        }}
                                    >
                                        <Send size={14} /> Send Offer
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Sent Offers Tab */}
            {tab === "sent" && (
                <div style={{ display: "grid", gap: "12px" }}>
                    {offers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8", background: "white", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                            <Send size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                            <p style={{ fontSize: "16px", fontWeight: 600 }}>No offers sent yet</p>
                            <p style={{ fontSize: "14px" }}>Browse athletes and send your first training offer!</p>
                        </div>
                    ) : (
                        offers.map((offer) => (
                            <div key={offer.id} style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                    <div style={{
                                        width: "44px", height: "44px", borderRadius: "12px",
                                        background: offer.status === "accepted" ? "#dcfce7" : offer.status === "declined" ? "#fee2e2" : "#f1f5f9",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        {offer.status === "accepted" ? <Award size={20} style={{ color: "#16a34a" }} /> : offer.status === "declined" ? <X size={20} style={{ color: "#ef4444" }} /> : <Clock size={20} style={{ color: "#64748b" }} />}
                                    </div>
                                    <div>
                                        <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>{offer.athlete_name}</h3>
                                        <p style={{ fontSize: "13px", color: "#64748b" }}>
                                            ${offer.rate?.toFixed(0)}/hr · {offer.session_type} · {new Date(offer.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <span style={{
                                    padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                                    background: offer.status === "accepted" ? "#dcfce7" : offer.status === "declined" ? "#fee2e2" : "#f1f5f9",
                                    color: offer.status === "accepted" ? "#16a34a" : offer.status === "declined" ? "#ef4444" : "#64748b",
                                    textTransform: "capitalize",
                                }}>{offer.status}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* New Offer Modal */}
            {showNewOffer && selectedAthlete && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 100, padding: "20px", backdropFilter: "blur(4px)",
                }}>
                    <div style={{
                        background: "white", borderRadius: "20px", padding: "32px", maxWidth: "520px", width: "100%",
                        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Send Training Offer</h2>
                            <button onClick={() => { setShowNewOffer(false); setSelectedAthlete(null); }}
                                style={{ background: "#f1f5f9", border: "none", borderRadius: "10px", padding: "8px", cursor: "pointer" }}>
                                <X size={18} style={{ color: "#64748b" }} />
                            </button>
                        </div>

                        {/* Athlete Info */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", background: "#f8fafc", borderRadius: "14px", marginBottom: "24px" }}>
                            <div style={{
                                width: "44px", height: "44px", borderRadius: "12px",
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center",
                                color: "white", fontWeight: 800, fontSize: "15px",
                            }}>
                                {selectedAthlete.first_name?.charAt(0)}{selectedAthlete.last_name?.charAt(0)}
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: "15px" }}>{selectedAthlete.first_name} {selectedAthlete.last_name}</h3>
                                <p style={{ fontSize: "13px", color: "#64748b" }}>
                                    {(selectedAthlete.athlete_profile?.sports || []).slice(0, 2).map((s: string) => s.replace(/_/g, " ")).join(", ") || "No sports listed"}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: "grid", gap: "18px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                                    Personal Message
                                </label>
                                <textarea
                                    value={offerData.message}
                                    onChange={(e) => setOfferData(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="Hi! I'd love to work with you on improving your skills. I specialize in..."
                                    rows={4}
                                    style={{ ...inputStyle, resize: "vertical" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>Session Type</label>
                                    <select value={offerData.sessionType} onChange={(e) => setOfferData(prev => ({ ...prev, sessionType: e.target.value }))} style={inputStyle}>
                                        <option value="private">Private (1-on-1)</option>
                                        <option value="semi_private">Semi-Private</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>Rate ($/hr)</label>
                                    <input type="number" value={offerData.rate} onChange={(e) => setOfferData(prev => ({ ...prev, rate: e.target.value }))}
                                        placeholder={user?.trainerProfile?.hourly_rate?.toString() || "50"} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>Preferred Time Slot</label>
                                <input type="text" value={offerData.timeSlot} onChange={(e) => setOfferData(prev => ({ ...prev, timeSlot: e.target.value }))}
                                    placeholder="e.g. Weekdays 4-6pm, Saturday mornings" style={inputStyle} />
                            </div>

                            {/* Intro Discount Toggle */}
                            <label style={{
                                display: "flex", alignItems: "center", gap: "12px", padding: "14px",
                                borderRadius: "12px", border: `2px solid ${offerData.introDiscount ? "#6366f1" : "#e2e8f0"}`,
                                background: offerData.introDiscount ? "#eef2ff" : "#fff", cursor: "pointer",
                            }}>
                                <input type="checkbox" checked={offerData.introDiscount}
                                    onChange={(e) => setOfferData(prev => ({ ...prev, introDiscount: e.target.checked }))}
                                    style={{ width: "20px", height: "20px", accentColor: "#6366f1" }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}><PartyPopper className="inline-block w-4 h-4 mr-1 text-primary" /> Add Intro Session Discount</p>
                                    <p style={{ fontSize: "12px", color: "#64748b" }}>Offer a special rate for the first session</p>
                                </div>
                                {offerData.introDiscount && (
                                    <select value={offerData.discountPercent} onChange={(e) => setOfferData(prev => ({ ...prev, discountPercent: e.target.value }))}
                                        style={{ ...inputStyle, width: "80px", padding: "6px 8px", fontSize: "13px" }} onClick={e => e.stopPropagation()}>
                                        <option value="10">10%</option>
                                        <option value="15">15%</option>
                                        <option value="20">20%</option>
                                        <option value="25">25%</option>
                                        <option value="50">50%</option>
                                    </select>
                                )}
                            </label>
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={sendOffer}
                            disabled={sending}
                            style={{
                                width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                                background: sending ? "#94a3b8" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                color: "white", fontWeight: 700, fontSize: "15px", cursor: sending ? "not-allowed" : "pointer",
                                marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                            }}
                        >
                            {sending ? "Sending..." : <><Send size={16} /> Send Offer</>}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
