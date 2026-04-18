"use client";

import { useState, useEffect } from "react";
import { Mail, MailOpen, Trash2, Loader2, Search, X, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminContactsPage() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

    useEffect(() => { loadMessages(); }, []);

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

    const filtered = messages.filter((m) => {
        if (filter === "unread" && m.is_read) return false;
        if (filter === "read" && !m.is_read) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (m.email || "").toLowerCase().includes(q) ||
            (m.subject || "").toLowerCase().includes(q) ||
            (m.message || "").toLowerCase().includes(q)
        );
    });

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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider w-10"></th>
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Date</th>
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Email</th>
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Subject</th>
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Message</th>
                                    <th className="text-left px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">User ID</th>
                                    <th className="text-right px-5 py-4 text-text-main/40 font-bold text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((msg) => {
                                    const isUnread = !msg.is_read;
                                    return (
                                        <tr
                                            key={msg.id}
                                            className={`border-b border-white/5 transition-colors ${
                                                isUnread ? "bg-primary/3 hover:bg-primary/6" : "hover:bg-white/2"
                                            }`}
                                        >
                                            <td className="px-5 py-4">
                                                {isUnread ? (
                                                    <span className="block w-2 h-2 rounded-full bg-primary" title="Unread" />
                                                ) : (
                                                    <span className="block w-2 h-2 rounded-full bg-transparent" />
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-text-main/60 whitespace-nowrap">
                                                {formatDate(msg.created_at)}
                                            </td>
                                            <td className={`px-5 py-4 ${isUnread ? "text-text-main font-black" : "text-text-main font-semibold"}`}>
                                                {msg.email}
                                            </td>
                                            <td className={`px-5 py-4 ${isUnread ? "text-text-main font-bold" : "text-text-main/80"}`}>
                                                {msg.subject || "General"}
                                            </td>
                                            <td className="px-5 py-4 text-text-main/60 max-w-xs truncate">
                                                {msg.message}
                                            </td>
                                            <td className="px-5 py-4 text-text-main/40 font-mono text-xs">
                                                {msg.user_id ? msg.user_id.substring(0, 8) + "..." : "—"}
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleMarkRead(msg.id, isUnread)}
                                                        disabled={markingId === msg.id}
                                                        title={isUnread ? "Mark as read" : "Mark as unread"}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
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
                                                        {isUnread ? "Mark read" : "Read"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        disabled={deleting === msg.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        {deleting === msg.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={12} />
                                                        )}
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
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
