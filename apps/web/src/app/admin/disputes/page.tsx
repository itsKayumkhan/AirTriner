"use client";

import { useState, useEffect } from "react";
import {
    Search, X, CheckCircle, RotateCcw, MessageSquare, Loader2,
    ShieldAlert, ChevronRight, Scale, Zap, TrendingUp, StickyNote, Save
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";
import PopupModal from "@/components/common/PopupModal";

export default function AdminDisputesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("PENDING");
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [savingNote, setSavingNote] = useState(false);

    const [popup, setPopup] = useState<{
        type: "success" | "error" | "confirm" | "warning" | "info";
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    const showAlert = (type: "success" | "error" | "info", title: string, message: string) => setPopup({ type, title, message });
    const showConfirm = (title: string, message: string, onConfirm: () => void) => setPopup({ type: "confirm", title, message, onConfirm });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: dData, error: dError } = await supabase
                .from("disputes")
                .select(`id, booking_id, initiated_by, reason, status, resolution, admin_note, evidence_deadline, created_at, resolved_at, bookings (id, price, athlete_id, trainer_id, sport)`)
                .order("created_at", { ascending: false });

            if (dError) throw dError;

            if (dData && dData.length > 0) {
                const userIds = new Set<string>();
                dData.forEach((d: any) => {
                    if (d.bookings) { userIds.add(d.bookings.athlete_id); userIds.add(d.bookings.trainer_id); }
                });

                const { data: usersData } = await supabase
                    .from("users").select("id, first_name, last_name").in("id", Array.from(userIds));

                const usersMap = new Map((usersData || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`.trim()]));

                const formatted = dData.map((d: any) => {
                    const price = Number(d.bookings?.price || 0);
                    return {
                        id: d.id,
                        displayId: `#DIS-${d.id.substring(0, 5).toUpperCase()}`,
                        bookingId: d.booking_id,
                        displayBookingId: `BK-${d.booking_id.substring(0, 6).toUpperCase()}`,
                        athlete: usersMap.get(d.bookings?.athlete_id) || "Unknown Athlete",
                        trainer: usersMap.get(d.bookings?.trainer_id) || "Unknown Trainer",
                        amount: `$${price.toFixed(2)}`,
                        rawAmount: price,
                        status: d.status,
                        reason: d.reason || "No specific reason provided.",
                        resolution: d.resolution || "",
                        adminNote: d.admin_note || "",
                        createdAt: new Date(d.created_at),
                        sport: d.bookings?.sport || "General Session"
                    };
                });

                // Pre-populate admin notes from admin_note column
                const notesMap: Record<string, string> = {};
                formatted.forEach(d => { if (d.adminNote) notesMap[d.id] = d.adminNote; });
                setAdminNotes(prev => ({ ...notesMap, ...prev }));

                setDisputes(formatted);
                // Always sync selectedDispute with fresh DB data
                setSelectedDispute((prev: any) => {
                    if (!prev) return formatted.length > 0 ? formatted[0] : null;
                    const updated = formatted.find((d: any) => d.id === prev.id);
                    return updated || prev;
                });
            }
        } catch (err) {
            console.error("Failed to load disputes:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'refund' | 'resolve') => {
        if (!selectedDispute) return;
        showConfirm(
            action === 'refund' ? "Process Refund" : "Resolve Dispute",
            action === 'refund'
                ? "Issue a full refund to the athlete? This will cancel the booking."
                : "Resolve in favor of the trainer? Held funds will be released.",
            async () => {
                setProcessing(true);
                try {
                    const res = await adminFetch('/api/admin/resolve-dispute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ disputeId: selectedDispute.id, action })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data?.error || `Action failed (HTTP ${res.status})`);

                    setDisputes(prev => prev.map(d => d.id === selectedDispute.id ? { ...d, status: 'resolved' } : d));
                    setSelectedDispute((prev: any) => prev ? { ...prev, status: 'resolved' } : null);
                    loadData();
                    showAlert("success", "Done", `Dispute ${action === 'refund' ? 'refunded' : 'resolved'} successfully.`);
                } catch (err: any) {
                    console.error(err);
                    showAlert("error", "Failed", err?.message || "Could not process action. Try again.");
                } finally {
                    setProcessing(false);
                }
            }
        );
    };

    const saveNote = async () => {
        if (!selectedDispute) return;
        setSavingNote(true);
        try {
            const note = adminNotes[selectedDispute.id] || "";
            const { error } = await supabase.from("disputes").update({ admin_note: note || null }).eq("id", selectedDispute.id);
            if (error) throw error;
            showAlert("success", "Saved", "Admin note saved successfully.");
        } catch (err: any) {
            showAlert("error", "Failed", err?.message || "Could not save note.");
        } finally {
            setSavingNote(false);
        }
    };

    const filteredDisputes = disputes.filter(d => {
        if (activeTab === "PENDING" && d.status !== "under_review" && d.status !== "escalated") return false;
        if (activeTab === "RESOLVED" && d.status !== "resolved") return false;
        if (activeTab === "ESCALATED" && d.status !== "escalated") return false;
        if (searchQuery && !d.athlete.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !d.trainer.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !d.displayId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const totalDisputes = disputes.length;
    const needsAction = disputes.filter(d => d.status === "under_review" || d.status === "escalated").length;
    const refundedTotal = disputes.filter(d => d.status === "resolved").reduce((s, d) => s + d.rawAmount, 0);
    const highRisk = disputes.filter(d => d.status === "escalated").length;

    const getStatusMeta = (status: string) => {
        if (status === "under_review") return { label: "OPEN",    color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20",   dot: "bg-primary" };
        if (status === "escalated")   return { label: "FLAGGED",  color: "text-red-400",   bg: "bg-red-400/10",   border: "border-red-400/20",    dot: "bg-red-400" };
        return                               { label: "CLOSED",   color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20",  dot: "bg-green-400" };
    };

    const statCards = [
        { label: "TOTAL CASES",  value: totalDisputes,              icon: <Scale size={16} />,     accent: "default" },
        { label: "NEEDS ACTION", value: needsAction,                 icon: <Zap size={16} />,       accent: "primary" },
        { label: "REFUNDED",     value: `$${refundedTotal.toFixed(0)}`, icon: <TrendingUp size={16} />, accent: "default" },
        { label: "HIGH RISK",    value: highRisk, icon: <ShieldAlert size={16} />, accent: "red"  },
    ];

    return (
        <>
            <style>{`
                /* ── row accent ── */
                .drow { position: relative; }
                .drow::after { content:''; position:absolute; left:0; top:0; bottom:0; width:2px; background:transparent; transition:background .15s; border-radius:0 1px 1px 0; }
                .drow:hover::after { background:rgba(69,208,255,.3); }
                .drow.drow-active::after { background:#45D0FF; }
                .drow.drow-active { background:rgba(69,208,255,.03); }

                /* ── entry animations ── */
                .fade-up { animation: fade-up .4s cubic-bezier(.16,1,.3,1) both; }
                @keyframes fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
                .panel-slide { animation: panel-slide .22s cubic-bezier(.16,1,.3,1) both; }
                @keyframes panel-slide { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:none; } }

                /* ── stat card grid lines ── */
                .stat-card { background-image: repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,.015) 23px, rgba(255,255,255,.015) 24px); }

                /* ── glow on primary button ── */
                .btn-cyan:hover { box-shadow: 0 0 24px rgba(69,208,255,.35); }
            `}</style>

            <div className="flex flex-col gap-7 w-full">

                {/* ════════════════════════════════
                    HEADER  — full width
                ════════════════════════════════ */}
                <div className="fade-up" style={{ animationDelay: '0ms' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3.5 rounded-full bg-primary/60" />
                        <span className="text-[10px] font-black tracking-[0.35em] text-primary/50 uppercase">Admin · Dispute Center</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div>
                            <h1 className="text-5xl md:text-6xl font-black uppercase leading-none tracking-tight">
                                <span className="text-text-main">Dispute&nbsp;</span>
                                <span className="relative inline-block">
                                    <span className="text-primary">Management</span>
                                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-primary/60 to-transparent rounded-full" />
                                </span>
                            </h1>
                            <p className="text-text-main/40 text-sm font-medium mt-2.5 max-w-md leading-relaxed">
                                Resolve payment conflicts and review fraud flags across the platform.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-bold text-text-main/30 tracking-widest uppercase">
                                {loading ? "Loading..." : `${disputes.length} total cases`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════
                    STAT CARDS  — full width
                ════════════════════════════════ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: '60ms' }}>
                    {statCards.map((s, i) => (
                        <div
                            key={i}
                            className={`stat-card relative overflow-hidden rounded-2xl border p-5 group transition-all duration-300 cursor-default ${
                                s.accent === "primary" ? "bg-surface border-primary/25 hover:border-primary/40" :
                                s.accent === "red"     ? "bg-surface border-red-500/20 hover:border-red-500/35" :
                                "bg-surface border-white/[0.05] hover:border-white/10"
                            }`}
                        >
                            {/* left stripe */}
                            <div className={`absolute inset-y-0 left-0 w-[3px] transition-all duration-300 group-hover:w-1 ${
                                s.accent === "primary" ? "bg-primary/60" :
                                s.accent === "red"     ? "bg-red-500/70" :
                                "bg-white/[0.08]"
                            }`} />
                            {/* top-right glow blob */}
                            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                                s.accent === "primary" ? "bg-primary/10" :
                                s.accent === "red"     ? "bg-red-500/10" :
                                "bg-white/[0.04]"
                            }`} />

                            <div className="flex items-start justify-between mb-6">
                                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-text-main/35 leading-tight max-w-[80px]">{s.label}</p>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                    s.accent === "primary" ? "bg-primary/10 text-primary" :
                                    s.accent === "red"     ? "bg-red-500/10 text-red-400" :
                                    "bg-white/[0.05] text-text-main/30 group-hover:text-text-main/60"
                                }`}>
                                    {s.icon}
                                </div>
                            </div>

                            <div className={`text-4xl font-black tracking-tighter leading-none ${
                                s.accent === "primary" ? "text-primary" :
                                s.accent === "red"     ? "text-red-400"  :
                                "text-text-main"
                            }`}>
                                {loading ? <span className="opacity-20 text-2xl">—</span> : s.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ════════════════════════════════
                    LIST  +  DETAIL CARD
                ════════════════════════════════ */}
                <div className="flex flex-col xl:flex-row gap-5 w-full fade-up" style={{ animationDelay: '120ms' }}>

                    {/* ── LIST (left) ─────────────────── */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* Search + Filter bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/25" />
                                <input
                                    type="text"
                                    placeholder="Search by case ID, athlete, trainer…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-surface border border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-text-main placeholder-text-main/20 focus:outline-none focus:border-primary/30 transition-colors"
                                />
                            </div>
                            <div className="flex bg-surface border border-white/[0.06] rounded-xl p-1 gap-0.5 flex-shrink-0">
                                {(["PENDING", "RESOLVED", "ESCALATED"] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap ${
                                            activeTab === tab
                                                ? "bg-primary text-[#0A0D14] shadow-[0_0_18px_rgba(69,208,255,.28)]"
                                                : "text-text-main/35 hover:text-text-main/60 hover:bg-white/[0.03]"
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-surface border border-white/[0.05] rounded-2xl overflow-hidden">

                            {/* thead */}
                            <div className="grid grid-cols-[1fr_1.3fr_1.3fr_90px_100px_36px] gap-2 px-5 py-3.5 border-b border-white/[0.04] bg-white/[0.015]">
                                {["CASE ID", "CLAIMANT", "RESPONDENT", "AMOUNT", "STATUS", ""].map((h, i) => (
                                    <span key={i} className={`text-[8px] font-black tracking-[0.3em] text-text-main/25 uppercase select-none ${i === 5 ? "text-right" : ""}`}>
                                        {h}
                                    </span>
                                ))}
                            </div>

                            {loading ? (
                                <div className="py-20 flex flex-col items-center gap-3">
                                    <Loader2 size={20} className="animate-spin text-primary/40" />
                                    <span className="text-[10px] font-black tracking-widest text-text-main/25 uppercase">Loading cases…</span>
                                </div>
                            ) : filteredDisputes.length === 0 ? (
                                <div className="py-20 flex flex-col items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] flex items-center justify-center">
                                        <Scale size={18} className="text-text-main/20" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-text-main/40">No disputes found</p>
                                        <p className="text-xs text-text-main/25 mt-1">Try a different filter or search term.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.03]">
                                    {filteredDisputes.map(d => {
                                        const meta = getStatusMeta(d.status);
                                        const isActive = selectedDispute?.id === d.id;
                                        return (
                                            <div
                                                key={d.id}
                                                onClick={() => setSelectedDispute(d)}
                                                className={`drow grid grid-cols-[1fr_1.3fr_1.3fr_90px_100px_36px] gap-2 px-5 py-4 cursor-pointer hover:bg-white/[0.015] transition-colors ${isActive ? "drow-active" : ""}`}
                                            >
                                                {/* Case ID */}
                                                <div className="min-w-0">
                                                    <div className={`text-xs font-black tracking-wide font-mono ${isActive ? "text-primary" : "text-text-main/60"} transition-colors`}>
                                                        {d.displayId}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-text-main/25 uppercase tracking-wider mt-0.5">
                                                        {d.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                                {/* Claimant */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-[10px] flex-shrink-0 uppercase">
                                                        {d.athlete[0]}
                                                    </div>
                                                    <span className="text-xs font-bold text-text-main/75 truncate">{d.athlete}</span>
                                                </div>
                                                {/* Respondent */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-text-main/40 font-black text-[10px] flex-shrink-0 uppercase">
                                                        {d.trainer[0]}
                                                    </div>
                                                    <span className="text-xs font-medium text-text-main/45 truncate">{d.trainer}</span>
                                                </div>
                                                {/* Amount */}
                                                <div className="flex items-center">
                                                    <span className="text-xs font-black text-text-main/80">{d.amount}</span>
                                                </div>
                                                {/* Status */}
                                                <div className="flex items-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[8px] font-black tracking-widest uppercase ${meta.bg} ${meta.color} ${meta.border}`}>
                                                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${meta.dot} ${d.status !== "resolved" ? "animate-pulse" : ""}`} />
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                {/* Arrow */}
                                                <div className={`flex items-center justify-end transition-colors ${isActive ? "text-primary" : "text-white/10"}`}>
                                                    <ChevronRight size={13} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── DETAIL CARD (right) ─────────────────── */}
                    <div className="w-full xl:w-[360px] flex-shrink-0 xl:sticky xl:top-6 h-fit">
                        {selectedDispute ? (
                            <div key={selectedDispute.id} className="panel-slide bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">

                                {/* ── Top bar: label + id + status + close ── */}
                                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                                        <span className="text-xs font-black text-text-main font-mono truncate">{selectedDispute.displayId}</span>
                                        {(() => {
                                            const meta = getStatusMeta(selectedDispute.status);
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black tracking-widest uppercase flex-shrink-0 ${meta.bg} ${meta.color} ${meta.border}`}>
                                                    <span className={`w-1 h-1 rounded-full ${meta.dot} ${selectedDispute.status !== "resolved" ? "animate-pulse" : ""}`} />
                                                    {meta.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <button
                                        onClick={() => setSelectedDispute(null)}
                                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] text-text-main/30 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>

                                <div className="px-4 py-3 space-y-3">

                                    {/* Parties — one row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: "Claimant", name: selectedDispute.athlete, cyan: true },
                                            { label: "Respondent", name: selectedDispute.trainer, cyan: false },
                                        ].map(p => (
                                            <div key={p.label} className="bg-bg/50 border border-white/[0.04] rounded-xl px-3 py-2.5">
                                                <p className="text-[8px] font-black tracking-widest text-text-main/25 uppercase mb-1.5">{p.label}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] uppercase flex-shrink-0 ${p.cyan ? "bg-primary/10 border border-primary/20 text-primary" : "bg-white/[0.05] border border-white/[0.07] text-text-main/40"}`}>
                                                        {p.name[0]}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-text-main/70 truncate">{p.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Booking — compact single row */}
                                    <div className="bg-bg/50 border border-white/[0.04] rounded-xl px-3 py-2.5">
                                        <p className="text-[8px] font-black tracking-widest text-text-main/25 uppercase mb-2">Booking</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-text-main/40 font-mono">{selectedDispute.displayBookingId}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-text-main/25 bg-white/[0.04] px-1.5 py-0.5 rounded capitalize">{selectedDispute.sport}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-base font-black text-text-main">{selectedDispute.amount}</span>
                                                <span className="text-[10px] font-bold text-text-main/30">{selectedDispute.createdAt.toLocaleDateString('en-GB')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Complaint — clamped */}
                                    <div className="relative pl-3">
                                        <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-gradient-to-b from-primary/40 to-transparent" />
                                        <p className="text-[11px] text-text-main/50 leading-relaxed italic line-clamp-3">
                                            "{selectedDispute.reason}"
                                        </p>
                                    </div>

                                    {/* Admin Note */}
                                    <div className="bg-bg/50 border border-white/[0.04] rounded-xl px-3 py-2.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <StickyNote size={11} className="text-primary/60" />
                                                <p className="text-[8px] font-black tracking-widest text-text-main/25 uppercase">Admin Note</p>
                                            </div>
                                            <button
                                                onClick={saveNote}
                                                disabled={savingNote}
                                                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
                                            >
                                                {savingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                                {savingNote ? "Saving…" : "Save"}
                                            </button>
                                        </div>

                                        {/* Templates */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {[
                                                { label: "Needs Evidence", text: "Awaiting evidence submission from both parties before proceeding." },
                                                { label: "Under Review", text: "Case is currently under admin review. Decision pending." },
                                                { label: "Refund Approved", text: "Refund approved. Processing initiated for the full session amount." },
                                                { label: "No Merit", text: "Dispute reviewed — insufficient grounds to proceed. Closing case." },
                                                { label: "Trainer Fault", text: "Trainer found responsible. Refund issued to athlete." },
                                            ].map(t => (
                                                <button
                                                    key={t.label}
                                                    onClick={() => setAdminNotes(prev => ({ ...prev, [selectedDispute.id]: t.text }))}
                                                    className="text-[8px] font-medium px-2 py-1 rounded bg-white/[0.04] text-text-main/35 hover:text-text-main/70 hover:bg-white/[0.07] transition-colors"
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>

                                        <textarea
                                            rows={2}
                                            placeholder="Add internal notes about this dispute…"
                                            value={adminNotes[selectedDispute.id] || ""}
                                            onChange={e => setAdminNotes(prev => ({ ...prev, [selectedDispute.id]: e.target.value }))}
                                            className="w-full bg-transparent text-[11px] text-text-main/70 placeholder-text-main/20 resize-none focus:outline-none leading-relaxed font-medium"
                                        />
                                    </div>

                                    {/* Actions */}
                                    {(selectedDispute.status === "under_review" || selectedDispute.status === "escalated") ? (
                                        <div className="space-y-2 pt-1">
                                            <button
                                                onClick={() => handleAction('refund')}
                                                disabled={processing}
                                                className="btn-cyan w-full py-2.5 rounded-xl bg-primary text-[#0A0D14] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {processing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} strokeWidth={2.5} />}
                                                Process Refund
                                            </button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/[0.06] text-text-main/40 text-[9px] font-bold uppercase tracking-widest hover:bg-white/[0.04] hover:text-text-main/70 transition-all">
                                                    <MessageSquare size={11} /> Contact
                                                </button>
                                                <button
                                                    onClick={() => handleAction('resolve')}
                                                    disabled={processing}
                                                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-green-500/20 bg-green-500/[0.06] text-green-400 text-[9px] font-bold uppercase tracking-widest hover:bg-green-500/10 transition-all disabled:opacity-40"
                                                >
                                                    <CheckCircle size={11} /> Resolve
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-500/20 bg-green-500/[0.05]">
                                            <CheckCircle size={13} className="text-green-400" />
                                            <span className="text-[9px] font-black text-green-400 tracking-widest uppercase">Case Closed</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-surface border border-white/[0.05] border-dashed rounded-2xl min-h-[200px] flex flex-col items-center justify-center p-6 text-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                                    <Scale size={16} className="text-text-main/20" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-main/30">No case selected</p>
                                    <p className="text-xs text-text-main/20 mt-0.5">Click a row to review</p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>{/* end list+card */}
            </div>{/* end outer */}

            <PopupModal
                isOpen={!!popup}
                onClose={() => setPopup(null)}
                type={popup?.type || "info"}
                title={popup?.title || ""}
                message={popup?.message || ""}
                onConfirm={popup?.onConfirm}
            />
        </>
    );
}
