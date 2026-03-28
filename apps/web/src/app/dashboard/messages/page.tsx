"use client";

import { MessageSquare, Send, Activity, ArrowLeft, CheckCheck } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useMessages } from "@/context/MessagesContext";

interface Conversation {
    bookingId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserInitials: string;
    sport: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

interface Message {
    id: string;
    booking_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at?: string;
}

// Group messages by date for separators
function groupMessagesByDate(messages: Message[]) {
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach((m) => {
        const d = new Date(m.created_at);
        const label = isToday(d) ? "Today" : isYesterday(d)
            ? "Yesterday"
            : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const last = groups[groups.length - 1];
        if (last && last.date === label) last.msgs.push(m);
        else groups.push({ date: label, msgs: [m] });
    });
    return groups;
}
function isToday(d: Date) {
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
function isYesterday(d: Date) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
}

export default function MessagesPage() {
    const { markConversationRead } = useMessages();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const session = getSession();
        if (session) { setUser(session); loadConversations(session); }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!user || conversations.length === 0) return;
        const bookingIds = conversations.map(c => c.bookingId);
        const subscription = supabase
            .channel(`all_messages:${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
                const msg = (payload.new || payload.old) as any;
                if (!msg) return;
                if (payload.eventType === "UPDATE") { loadConversations(user); return; }
                if (payload.eventType === "INSERT") {
                    const bookingId = msg.booking_id;
                    if (!bookingId || !bookingIds.includes(bookingId)) return;
                    if (bookingId === selectedBookingId) {
                        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg as Message]);
                        if (msg.sender_id !== user.id) markAsReadApi(bookingId);
                    }
                    setConversations((prev) => {
                        const existing = prev.find(c => c.bookingId === bookingId);
                        if (!existing) return prev;
                        const updated = { ...existing, lastMessage: msg.content || existing.lastMessage, lastMessageAt: msg.created_at || existing.lastMessageAt, unreadCount: (bookingId === selectedBookingId || msg.sender_id === user.id) ? 0 : existing.unreadCount + 1 };
                        return [updated, ...prev.filter(c => c.bookingId !== bookingId)];
                    });
                }
            }).subscribe();
        return () => { subscription.unsubscribe(); };
    }, [selectedBookingId, user, conversations.length]);

    const markAsReadApi = markConversationRead;

    const loadConversations = async (u: AuthUser) => {
        try {
            const isTrainer = u.role === "trainer";
            const col = isTrainer ? "trainer_id" : "athlete_id";
            const otherCol = isTrainer ? "athlete_id" : "trainer_id";
            const { data: bookings } = await supabase.from("bookings").select("id, trainer_id, athlete_id, sport, status").eq(col, u.id).in("status", ["confirmed", "completed", "pending"]);
            if (!bookings?.length) { setLoading(false); return; }
            const otherUserIds = bookings.map((b: any) => b[otherCol]);
            const { data: otherUsers } = await supabase.from("users").select("id, first_name, last_name").in("id", [...new Set(otherUserIds)]);
            const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));
            const bookingIds = bookings.map((b: any) => b.id);
            const { data: allMessages } = await supabase.from("messages").select("*").in("booking_id", bookingIds).order("created_at", { ascending: false });
            const convos: Conversation[] = bookings.map((b: any) => {
                const other = userMap.get(b[otherCol]) as any;
                const bookingMessages = (allMessages || []).filter((m: Message) => m.booking_id === b.id);
                const lastMsg = bookingMessages[0];
                const unreadCount = bookingMessages.filter((m: any) => m.sender_id !== u.id && !m.read_at).length;
                return {
                    bookingId: b.id, otherUserId: b[otherCol],
                    otherUserName: other ? `${other.first_name} ${other.last_name}` : "Unknown",
                    otherUserInitials: other ? `${other.first_name[0]}${other.last_name[0]}`.toUpperCase() : "?",
                    sport: b.sport, lastMessage: lastMsg?.content || "No messages yet",
                    lastMessageAt: lastMsg?.created_at || b.id, unreadCount,
                };
            });
            convos.sort((a, b) => {
                const tA = new Date(a.lastMessageAt).getTime(), tB = new Date(b.lastMessageAt).getTime();
                if (isNaN(tA) && isNaN(tB)) return 0;
                if (isNaN(tA)) return 1; if (isNaN(tB)) return -1;
                return tB - tA;
            });
            setConversations(convos);
            if (convos.length > 0 && !selectedBookingId) {
                setSelectedBookingId(convos[0].bookingId);
                loadMessages(convos[0].bookingId);
            }
        } catch (err) { console.error("Failed to load conversations:", err); }
        finally { setLoading(false); }
    };

    const loadMessages = async (bookingId: string) => {
        const { data } = await supabase.from("messages").select("*").eq("booking_id", bookingId).order("created_at", { ascending: true });
        setMessages((data || []) as Message[]);
    };

    const selectConversation = async (bookingId: string) => {
        setSelectedBookingId(bookingId);
        loadMessages(bookingId);
        setConversations(prev => prev.map(c => c.bookingId === bookingId ? { ...c, unreadCount: 0 } : c));
        markAsReadApi(bookingId);
        setShowSidebar(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !user || !selectedBookingId || sending) return;
        setSending(true);
        const content = newMessage.trim();
        setNewMessage("");
        try {
            const { data, error } = await supabase.from("messages").insert({ booking_id: selectedBookingId, sender_id: user.id, content }).select().single();
            if (error) throw error;
            setMessages((prev) => [...prev, data as Message]);
            setConversations((prev) => {
                const existing = prev.find(c => c.bookingId === selectedBookingId);
                if (!existing) return prev;
                const updated = { ...existing, lastMessage: content, lastMessageAt: new Date().toISOString() };
                return [updated, ...prev.filter(c => c.bookingId !== selectedBookingId)];
            });
        } catch (err) { console.error("Send failed:", err); setNewMessage(content); }
        finally { setSending(false); }
    };

    const selectedConvo = conversations.find((c) => c.bookingId === selectedBookingId);

    const timeFormat = (date: string) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        const diff = Date.now() - d.getTime();
        if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const grouped = groupMessagesByDate(messages);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs text-text-main/30 font-medium tracking-widest uppercase">Loading messages...</p>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                    <MessageSquare size={36} className="text-text-main/20" strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg">No conversations yet</h3>
                    <p className="text-text-main/40 text-sm mt-1 max-w-xs">
                        Messages appear after you have active bookings with {user?.role === "trainer" ? "athletes" : "a trainer"}.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Page title — compact */}
            <div className="shrink-0 mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-[28px] font-black uppercase tracking-tight text-white leading-none">Messages</h1>
                    <p className="text-text-main/40 text-xs font-medium mt-1">
                        {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                        {conversations.reduce((s, c) => s + c.unreadCount, 0) > 0 &&
                            <span className="ml-2 text-primary font-bold">· {conversations.reduce((s, c) => s + c.unreadCount, 0)} unread</span>
                        }
                    </p>
                </div>
            </div>

            {/* Chat layout */}
            <div className="flex-1 flex min-h-0 rounded-2xl overflow-hidden border border-white/7 bg-[#0F1118]">

                {/* ── Sidebar ── */}
                <div className={`w-[300px] shrink-0 flex flex-col border-r border-white/6 ${showSidebar ? "flex" : "hidden md:flex"}`}>
                    {/* Sidebar header */}
                    <div className="px-4 py-4 border-b border-white/6 shrink-0">
                        <p className="text-[10px] font-black text-text-main/30 uppercase tracking-[0.2em]">
                            {user?.role === "trainer" ? "Athletes" : "Trainers"}
                        </p>
                    </div>

                    {/* Conversation list */}
                    <div className="flex-1 overflow-y-auto">
                        {conversations.map((c) => {
                            const isActive = c.bookingId === selectedBookingId;
                            return (
                                <button
                                    key={c.bookingId}
                                    onClick={() => selectConversation(c.bookingId)}
                                    className={`w-full text-left px-4 py-3.5 flex gap-3 items-start transition-all border-b border-white/[0.04] relative ${
                                        isActive
                                            ? "bg-white/[0.06] border-l-2 border-l-white/20"
                                            : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                                            isActive ? "bg-white/[0.10] text-text-main" : "bg-white/[0.06] text-text-main/70"
                                        }`}>
                                            {c.otherUserInitials}
                                        </div>
                                        {c.unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-bg text-[9px] font-black flex items-center justify-center border border-[#0F1118]">
                                                {c.unreadCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                            <span className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-text-main/80"}`}>
                                                {c.otherUserName}
                                            </span>
                                            <span className="text-[10px] text-text-main/30 font-medium shrink-0">
                                                {timeFormat(c.lastMessageAt)}
                                            </span>
                                        </div>
                                        <p className={`text-[12px] truncate ${c.unreadCount > 0 ? "text-text-main/70 font-semibold" : "text-text-main/35 font-medium"}`}>
                                            {c.lastMessage}
                                        </p>
                                        <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-wider text-text-main/40 bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">
                                            <Activity size={8} />
                                            {c.sport.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Chat Area ── */}
                <div className={`flex-1 flex flex-col min-w-0 ${!showSidebar ? "flex" : "hidden md:flex"}`}>

                    {/* Chat header */}
                    {selectedConvo ? (
                        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-3 shrink-0 bg-[#0F1118]">
                            {/* Mobile back */}
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="md:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-main/50 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={16} />
                            </button>

                            <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.10] flex items-center justify-center font-black text-sm text-text-main shrink-0">
                                {selectedConvo.otherUserInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold text-white leading-tight truncate">{selectedConvo.otherUserName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <Activity size={9} className="text-primary/50" />
                                    <p className="text-[10px] text-text-main/40 font-semibold uppercase tracking-wider">
                                        {selectedConvo.sport.replace(/_/g, " ")} Session
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 py-4 border-b border-white/6 shrink-0" />
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                                <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                                    <MessageSquare size={22} className="text-text-main/25" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-main/40">No messages yet</p>
                                    <p className="text-xs text-text-main/25 mt-0.5">Start the conversation below</p>
                                </div>
                            </div>
                        ) : (
                            grouped.map((group) => (
                                <div key={group.date}>
                                    {/* Date separator */}
                                    <div className="flex items-center gap-3 my-4">
                                        <div className="flex-1 h-px bg-white/6" />
                                        <span className="text-[10px] font-bold text-text-main/25 uppercase tracking-widest">{group.date}</span>
                                        <div className="flex-1 h-px bg-white/6" />
                                    </div>

                                    {/* Messages in group */}
                                    <div className="flex flex-col gap-1.5">
                                        {group.msgs.map((m, idx) => {
                                            const isOwn = m.sender_id === user?.id;
                                            const prevMsg = idx > 0 ? group.msgs[idx - 1] : null;
                                            const isFirst = !prevMsg || prevMsg.sender_id !== m.sender_id;
                                            const nextMsg = idx < group.msgs.length - 1 ? group.msgs[idx + 1] : null;
                                            const isLast = !nextMsg || nextMsg.sender_id !== m.sender_id;
                                            const time = new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                                            return (
                                                <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isFirst ? "mt-2" : ""}`}>
                                                    <div className={`max-w-[72%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                                        <div className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                                                            isOwn
                                                                ? `bg-primary text-bg font-medium shadow-[0_4px_12px_rgba(69,208,255,0.2)] ${
                                                                    isFirst && isLast ? "rounded-2xl" :
                                                                    isFirst ? "rounded-2xl rounded-br-md" :
                                                                    isLast ? "rounded-2xl rounded-tr-md" :
                                                                    "rounded-2xl rounded-r-md"
                                                                  }`
                                                                : `bg-[#1C1F2E] text-text-main/85 border border-white/7 ${
                                                                    isFirst && isLast ? "rounded-2xl" :
                                                                    isFirst ? "rounded-2xl rounded-bl-md" :
                                                                    isLast ? "rounded-2xl rounded-tl-md" :
                                                                    "rounded-2xl rounded-l-md"
                                                                  }`
                                                        }`}>
                                                            {m.content}
                                                        </div>
                                                        {isLast && (
                                                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                                                                <span className="text-[10px] text-text-main/25 font-medium">{time}</span>
                                                                {isOwn && <CheckCheck size={11} className="text-primary/40" />}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input bar */}
                    <div className="px-4 py-3.5 border-t border-white/6 shrink-0 bg-[#0F1118]">
                        <div className="flex items-center gap-3 bg-[#1A1D29] border border-white/8 rounded-2xl px-4 py-2.5 focus-within:border-primary/30 transition-all">
                            <input
                                ref={inputRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent outline-none text-[13px] text-text-main placeholder:text-text-main/25 font-medium"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={sending || !newMessage.trim()}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                    newMessage.trim()
                                        ? "bg-primary text-bg hover:shadow-[0_0_12px_rgba(69,208,255,0.4)] hover:scale-105 active:scale-95"
                                        : "bg-white/5 text-text-main/20 cursor-not-allowed"
                                }`}
                            >
                                <Send size={14} className={newMessage.trim() ? "translate-x-px -translate-y-px" : ""} strokeWidth={2.5} />
                            </button>
                        </div>
                        <p className="text-[10px] text-text-main/20 text-center mt-2 font-medium">Press Enter to send</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
