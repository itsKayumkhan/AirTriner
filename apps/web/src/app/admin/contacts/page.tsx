"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { Mail, MailOpen, Trash2, Loader2, Search, X, Check, CheckCheck, ChevronDown, ChevronRight, Copy, Reply } from "lucide-react";

type DropdownOption = { value: string; label: string };

function Dropdown({ value, options, onChange, width = 160 }: { value: string; options: DropdownOption[]; onChange: (v: string) => void; width?: number }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find((o) => o.value === value);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    return (
        <div ref={ref} className="relative" style={{ width }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface border text-xs font-bold text-text-main hover:bg-white/[0.04] transition-colors ${
                    open ? "border-primary/40" : "border-white/5"
                }`}
            >
                <span className="truncate">{current?.label ?? "Select"}</span>
                <ChevronDown size={12} className={`shrink-0 text-text-main/50 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-30 mt-1.5 left-0 right-0 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl shadow-black/50 overflow-hidden py-1">
                    {options.map((opt) => {
                        const active = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                    active ? "bg-primary/15 text-primary" : "text-text-main/80 hover:bg-white/5 hover:text-text-main"
                                }`}
                            >
                                <span className="truncate">{opt.label}</span>
                                {active && <Check size={12} className="shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
import { supabase } from "@/lib/supabase";

export default function AdminContactsPage() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
    const [subjectFilter, setSubjectFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<"all" | "today" | "7d" | "30d">("all");
    const [userTypeFilter, setUserTypeFilter] = useState<"all" | "athlete" | "trainer" | "admin" | "guest">("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<Record<string, { first_name?: string; last_name?: string; role?: string }>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => { loadMessages(); }, []);

    useEffect(() => {
        const ids = Array.from(new Set(messages.map((m) => m.user_id).filter((id): id is string => !!id && !userInfo[id])));
        if (ids.length === 0) return;
        (async () => {
            const { data } = await supabase.from("users").select("id, first_name, last_name, role").in("id", ids);
            if (!data) return;
            setUserInfo((prev) => {
                const next = { ...prev };
                for (const u of data) next[u.id] = { first_name: u.first_name, last_name: u.last_name, role: u.role };
                return next;
            });
        })();
    }, [messages, userInfo]);

    const copy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1200);
        } catch {}
    };

    const toggleExpand = (msg: any) => {
        const willOpen = expandedId !== msg.id;
        setExpandedId(willOpen ? msg.id : null);
        if (willOpen && !msg.is_read) handleMarkRead(msg.id, true);
    };

    const loadMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("contact_messages")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error("Failed to load contact messages:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleting(id);
        try {
            const { error } = await supabase
                .from("contact_messages")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setMessages((prev) => prev.filter((m) => m.id !== id));
        } catch (err) {
            console.error("Failed to delete message:", err);
        } finally {
            setDeleting(null);
        }
    };

    const handleMarkRead = async (id: string, nextRead: boolean) => {
        setMarkingId(id);
        try {
            const { error } = await supabase
                .from("contact_messages")
                .update({ is_read: nextRead })
                .eq("id", id);

            if (error) throw error;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: nextRead } : m)));
        } catch (err) {
            console.error("Failed to update read state:", err);
        } finally {
            setMarkingId(null);
        }
    };

    const handleMarkAllRead = async () => {
        const unreadIds = messages.filter((m) => !m.is_read).map((m) => m.id);
        if (unreadIds.length === 0) return;
        setMarkingAll(true);
        try {
            const { error } = await supabase
                .from("contact_messages")
                .update({ is_read: true })
                .in("id", unreadIds);

            if (error) throw error;
            setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
        } catch (err) {
            console.error("Failed to mark all read:", err);
        } finally {
            setMarkingAll(false);
        }
    };

    const unreadCount = messages.filter((m) => !m.is_read).length;

    const subjectOptions = Array.from(new Set(messages.map((m) => m.subject || "General"))).sort();

    const now = Date.now();
    const dateCutoff = dateFilter === "today" ? now - 24 * 60 * 60 * 1000
        : dateFilter === "7d" ? now - 7 * 24 * 60 * 60 * 1000
        : dateFilter === "30d" ? now - 30 * 24 * 60 * 60 * 1000
        : 0;

    const filtered = messages.filter((m) => {
        if (filter === "unread" && m.is_read) return false;
        if (filter === "read" && !m.is_read) return false;
        if (subjectFilter !== "all" && (m.subject || "General") !== subjectFilter) return false;
        if (dateCutoff && new Date(m.created_at).getTime() < dateCutoff) return false;
        if (userTypeFilter !== "all") {
            if (userTypeFilter === "guest") {
                if (m.user_id) return false;
            } else {
                const role = m.user_id ? userInfo[m.user_id]?.role : undefined;
                if (role !== userTypeFilter) return false;
            }
        }
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (m.email || "").toLowerCase().includes(q) ||
            (m.subject || "").toLowerCase().includes(q) ||
            (m.message || "").toLowerCase().includes(q)
        );
    });

    const activeFilterCount =
        (subjectFilter !== "all" ? 1 : 0) +
        (dateFilter !== "all" ? 1 : 0) +
        (userTypeFilter !== "all" ? 1 : 0);

    const clearAllFilters = () => {
        setSubjectFilter("all");
        setDateFilter("all");
        setUserTypeFilter("all");
        setSearchQuery("");
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Mail size={20} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-main">Contact Messages</h1>
                        <p className="text-text-main/50 text-sm font-medium">
                            {messages.length} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <span className="ml-2 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-black">
                            {unreadCount} NEW
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/30" />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface border border-white/5 text-sm text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/30"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-main/30 hover:text-text-main">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter tabs + Mark all read */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 bg-surface border border-white/5 rounded-xl p-1">
                    {(["all", "unread", "read"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                filter === f
                                    ? "bg-white/10 text-text-main"
                                    : "text-text-main/50 hover:text-text-main"
                            }`}
                        >
                            {f}
                            {f === "unread" && unreadCount > 0 && (
                                <span className="ml-1.5 text-primary">({unreadCount})</span>
                            )}
                        </button>
                    ))}
                </div>

                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        disabled={markingAll}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                        {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={14} />}
                        Mark all read
                    </button>
                )}
            </div>

            {/* Advanced filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Dropdown
                    value={subjectFilter}
                    onChange={setSubjectFilter}
                    width={180}
                    options={[{ value: "all", label: "All subjects" }, ...subjectOptions.map((s) => ({ value: s, label: s }))]}
                />
                <Dropdown
                    value={dateFilter}
                    onChange={(v) => setDateFilter(v as any)}
                    width={150}
                    options={[
                        { value: "all", label: "Any date" },
                        { value: "today", label: "Last 24h" },
                        { value: "7d", label: "Last 7 days" },
                        { value: "30d", label: "Last 30 days" },
                    ]}
                />
                <Dropdown
                    value={userTypeFilter}
                    onChange={(v) => setUserTypeFilter(v as any)}
                    width={170}
                    options={[
                        { value: "all", label: "All users" },
                        { value: "athlete", label: "Athlete" },
                        { value: "trainer", label: "Trainer" },
                        { value: "admin", label: "Admin" },
                        { value: "guest", label: "Guest (no user)" },
                    ]}
                />
                {activeFilterCount > 0 && (
                    <button
                        onClick={clearAllFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 text-text-main/70 text-xs font-bold hover:bg-white/10"
                    >
                        <X size={12} /> Clear ({activeFilterCount})
                    </button>
                )}
                <span className="text-text-main/40 text-xs ml-auto">{filtered.length} of {messages.length}</span>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Mail size={40} className="mx-auto mb-3 text-text-main/10" />
                    <p className="text-text-main/40 font-medium">
                        {searchQuery
                            ? "No messages match your search"
                            : filter === "unread"
                                ? "No unread messages"
                                : filter === "read"
                                    ? "No read messages yet"
                                    : "No contact messages yet"}
                    </p>
                </div>
            ) : (
                <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto admin-table-scroll" style={{ scrollbarColor: 'rgba(255,255,255,0.2) transparent', scrollbarWidth: 'thin' }}>
                        <table className="w-full text-sm min-w-[900px]">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-10"></th>
                                    <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-40">Date</th>
                                    <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Email</th>
                                    <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-40">Subject</th>
                                    <th className="text-right px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((msg) => {
                                    const isUnread = !msg.is_read;
                                    const isExpanded = expandedId === msg.id;
                                    const u = msg.user_id ? userInfo[msg.user_id] : undefined;
                                    const fullName = u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "";
                                    return (
                                        <Fragment key={msg.id}>
                                        <tr
                                            onClick={() => toggleExpand(msg)}
                                            className={`border-b border-white/5 transition-colors cursor-pointer ${
                                                isUnread ? "bg-primary/3 hover:bg-primary/6" : "hover:bg-white/2"
                                            } ${isExpanded ? "bg-white/[0.04]" : ""}`}
                                        >
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown size={14} className="text-text-main/60" /> : <ChevronRight size={14} className="text-text-main/30" />}
                                                    {isUnread ? (
                                                        <span className="block w-2 h-2 rounded-full bg-primary" title="Unread" />
                                                    ) : (
                                                        <span className="block w-2 h-2 rounded-full bg-transparent" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-text-main/60 whitespace-nowrap text-xs">
                                                {formatDate(msg.created_at)}
                                            </td>
                                            <td className={`px-3 py-3 truncate ${isUnread ? "text-text-main font-black" : "text-text-main font-semibold"}`}>
                                                {msg.email}
                                            </td>
                                            <td className={`px-3 py-3 truncate ${isUnread ? "text-text-main font-bold" : "text-text-main/80"}`}>
                                                {msg.subject || "General"}
                                            </td>
                                            <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <div className="inline-flex items-center gap-2">
                                                    {msg.email && (
                                                        <a
                                                            href={`mailto:${msg.email}?subject=${encodeURIComponent("Re: " + (msg.subject || "AirTrainr Contact"))}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const mailto = `mailto:${msg.email}?subject=${encodeURIComponent("Re: " + (msg.subject || "AirTrainr Contact"))}`;
                                                                const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(msg.email)}&su=${encodeURIComponent("Re: " + (msg.subject || "AirTrainr Contact"))}`;
                                                                e.preventDefault();
                                                                const w = window.open(mailto, "_blank");
                                                                if (!w) {
                                                                    window.open(gmail, "_blank");
                                                                }
                                                            }}
                                                            aria-label="Reply via email"
                                                            title="Reply via email"
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-text-main/60 hover:bg-white/10 hover:text-text-main transition-colors"
                                                        >
                                                            <Reply size={12} />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleMarkRead(msg.id, isUnread)}
                                                        disabled={markingId === msg.id}
                                                        title={isUnread ? "Mark as read" : "Mark as unread"}
                                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-50 ${
                                                            isUnread
                                                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                                                : "bg-white/5 text-text-main/60 hover:bg-white/10"
                                                        }`}
                                                    >
                                                        {markingId === msg.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : isUnread ? (
                                                            <Check size={12} />
                                                        ) : (
                                                            <MailOpen size={12} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        disabled={deleting === msg.id}
                                                        title="Delete"
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        {deleting === msg.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={12} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-black/20 border-b border-white/5">
                                                <td colSpan={5} className="px-5 py-5">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="md:col-span-2">
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Full message</div>
                                                            <div className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-sm text-text-main whitespace-pre-wrap break-words leading-relaxed">
                                                                {msg.message}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Email</div>
                                                            <div className="flex items-center gap-2">
                                                                <code className="font-mono text-xs text-text-main bg-surface border border-white/5 rounded-lg px-2.5 py-1.5 break-all">{msg.email}</code>
                                                                <button onClick={() => copy(msg.email, `email-${msg.id}`)} className="text-text-main/50 hover:text-text-main"><Copy size={12} /></button>
                                                                {copiedId === `email-${msg.id}` && <span className="text-primary text-[10px] font-bold">copied</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Subject</div>
                                                            <div className="text-sm text-text-main">{msg.subject || "General"}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">User</div>
                                                            {msg.user_id ? (
                                                                <div className="space-y-1">
                                                                    <div className="text-sm text-text-main font-semibold">
                                                                        {fullName || <span className="text-text-main/40 italic">unknown</span>}
                                                                        {u?.role && <span className="ml-2 text-[10px] uppercase tracking-wider text-text-main/40">{u.role}</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <code className="font-mono text-xs text-text-main/60 bg-surface border border-white/5 rounded-lg px-2.5 py-1.5 break-all">{msg.user_id}</code>
                                                                        <button onClick={() => copy(msg.user_id, `uid-${msg.id}`)} className="text-text-main/50 hover:text-text-main"><Copy size={12} /></button>
                                                                        {copiedId === `uid-${msg.id}` && <span className="text-primary text-[10px] font-bold">copied</span>}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-text-main/40 italic">guest (no user_id)</div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Submitted</div>
                                                            <div className="text-sm text-text-main">{formatDate(msg.created_at)}</div>
                                                            <div className="text-text-main/40 text-xs font-mono mt-0.5">{msg.created_at}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Message ID</div>
                                                            <div className="flex items-center gap-2">
                                                                <code className="font-mono text-xs text-text-main/60 bg-surface border border-white/5 rounded-lg px-2.5 py-1.5 break-all">{msg.id}</code>
                                                                <button onClick={() => copy(msg.id, `mid-${msg.id}`)} className="text-text-main/50 hover:text-text-main"><Copy size={12} /></button>
                                                                {copiedId === `mid-${msg.id}` && <span className="text-primary text-[10px] font-bold">copied</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
