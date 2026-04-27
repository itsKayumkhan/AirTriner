"use client";

import { useState, useEffect, Fragment } from "react";
import { ScrollText, Loader2, ChevronDown, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuditRow = {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    payload: any;
    created_at: string;
};

export default function AdminAuditLogPage() {
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actorMap, setActorMap] = useState<Record<string, { first_name?: string; last_name?: string; email?: string }>>({});
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("all");

    const load = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("admin_audit_log")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(500);
            if (error) throw error;
            setRows(data || []);
        } catch (err) {
            console.error("Failed to load audit log:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id && !actorMap[id])));
        if (ids.length === 0) return;
        (async () => {
            const { data } = await supabase.from("users").select("id, first_name, last_name, email").in("id", ids);
            if (!data) return;
            setActorMap((prev) => {
                const next = { ...prev };
                for (const u of data) next[u.id] = { first_name: u.first_name, last_name: u.last_name, email: u.email };
                return next;
            });
        })();
    }, [rows, actorMap]);

    const formatDate = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

    const actions = Array.from(new Set(rows.map((r) => r.action))).sort();

    const filtered = rows.filter((r) => {
        if (actionFilter !== "all" && r.action !== actionFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        const actor = r.actor_id ? actorMap[r.actor_id] : undefined;
        const actorStr = actor ? `${actor.first_name ?? ""} ${actor.last_name ?? ""} ${actor.email ?? ""}`.toLowerCase() : "";
        return (
            r.action.toLowerCase().includes(q) ||
            (r.target_type ?? "").toLowerCase().includes(q) ||
            (r.target_id ?? "").toLowerCase().includes(q) ||
            actorStr.includes(q) ||
            JSON.stringify(r.payload ?? {}).toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ScrollText size={20} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-main">Audit Log</h1>
                        <p className="text-text-main/50 text-sm font-medium">{rows.length} entries · last 500 actions</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/30" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search actor, action, target..."
                            className="pl-9 pr-8 py-2 rounded-xl bg-surface border border-white/5 text-xs text-text-main placeholder:text-text-main/30 focus:outline-none focus:border-primary/30 w-64"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-main/30 hover:text-text-main">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-surface border border-white/5 text-xs font-bold text-text-main focus:outline-none"
                    >
                        <option value="all">All actions</option>
                        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-text-main text-xs font-bold hover:bg-white/10 disabled:opacity-50">
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <ScrollText size={40} className="mx-auto mb-3 text-text-main/10" />
                    <p className="text-text-main/40 font-medium">No audit log entries match.</p>
                </div>
            ) : (
                <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-10"></th>
                                <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-44">When</th>
                                <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-56">Actor</th>
                                <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-52">Action</th>
                                <th className="text-left px-3 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const isExpanded = expandedId === r.id;
                                const actor = r.actor_id ? actorMap[r.actor_id] : undefined;
                                const actorName = actor ? [actor.first_name, actor.last_name].filter(Boolean).join(" ") : "";
                                return (
                                    <Fragment key={r.id}>
                                        <tr
                                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                            className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.03] ${isExpanded ? "bg-white/[0.04]" : ""}`}
                                        >
                                            <td className="px-3 py-3">
                                                {isExpanded ? <ChevronDown size={14} className="text-text-main/60" /> : <ChevronRight size={14} className="text-text-main/30" />}
                                            </td>
                                            <td className="px-3 py-3 text-text-main/60 whitespace-nowrap text-xs font-mono">{formatDate(r.created_at)}</td>
                                            <td className="px-3 py-3 truncate">
                                                <div className="text-text-main font-semibold">{actorName || <span className="text-text-main/30 italic">unknown</span>}</div>
                                                <div className="text-text-main/40 text-xs truncate">{actor?.email ?? r.actor_id ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-3 truncate">
                                                <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold font-mono">{r.action}</span>
                                            </td>
                                            <td className="px-3 py-3 truncate text-xs text-text-main/60 font-mono">
                                                {r.target_type ? `${r.target_type}${r.target_id ? `:${r.target_id.substring(0, 8)}…` : ""}` : "—"}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-black/20 border-b border-white/5">
                                                <td colSpan={5} className="px-5 py-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                        <div>
                                                            <div className="text-text-main/40 font-bold uppercase tracking-wider mb-1">Actor ID</div>
                                                            <code className="block bg-surface border border-white/5 rounded-lg px-2.5 py-1.5 text-text-main/70 break-all">{r.actor_id ?? "—"}</code>
                                                        </div>
                                                        <div>
                                                            <div className="text-text-main/40 font-bold uppercase tracking-wider mb-1">Target</div>
                                                            <code className="block bg-surface border border-white/5 rounded-lg px-2.5 py-1.5 text-text-main/70 break-all">
                                                                {r.target_type ? `${r.target_type} / ${r.target_id ?? "—"}` : "—"}
                                                            </code>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <div className="text-text-main/40 font-bold uppercase tracking-wider mb-1">Payload</div>
                                                            <pre className="bg-surface border border-white/5 rounded-lg px-3 py-2 text-text-main/80 overflow-auto max-h-64 whitespace-pre-wrap break-all">{JSON.stringify(r.payload ?? {}, null, 2)}</pre>
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
            )}
        </div>
    );
}
