"use client";

import { MessageSquare, Send, Activity, ArrowLeft, CheckCheck, ShieldCheck } from "lucide-react";
import { FoundingBadge } from "@/components/ui/FoundingBadge";
import { useEffect, useState, useRef } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useMessages } from "@/context/MessagesContext";
import { formatSportName } from "@/lib/format";

interface Conversation {
    bookingId: string;       // most recent booking id (for display)
    allBookingIds: string[]; // all booking ids with this user
    otherUserId: string;
    otherUserName: string;
    otherUserInitials: string;
    sport: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    otherUserFounding50?: boolean;
    otherUserVerified?: boolean;
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
        // Include ALL booking IDs across merged conversations (not just the primary one),
        // otherwise realtime INSERTs on secondary bookings with the same other-user get dropped.
        const bookingIds = conversations.flatMap(c => c.allBookingIds);
        const subscription = supabase
            .channel(`all_messages:${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
                const msg = (payload.new || payload.old) as any;
                if (!msg) return;
                if (payload.eventType === "UPDATE") { loadConversations(user); return; }
                if (payload.eventType === "INSERT") {
                    const bookingId = msg.booking_id;
                    if (!bookingId || !bookingIds.includes(bookingId)) return;
                    // Find the merged conversation that owns this booking ID
                    setConversations((prev) => {
                        const existing = prev.find(c => c.allBookingIds.includes(bookingId));
                        if (!existing) return prev;
                        const isActive = existing.bookingId === selectedBookingId;
                        const updated = { ...existing, lastMessage: msg.content || existing.lastMessage, lastMessageAt: msg.created_at || existing.lastMessageAt, unreadCount: (isActive || msg.sender_id === user.id) ? 0 : existing.unreadCount + 1 };
                        return [updated, ...prev.filter(c => !c.allBookingIds.includes(bookingId))];
                    });
                    // If in the active conversation, add message to thread
                    const activeConvo = conversations.find(c => c.bookingId === selectedBookingId);
                    if (activeConvo?.allBookingIds.includes(bookingId)) {
                        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg as Message]);
                        if (msg.sender_id !== user.id) markAsReadApi(bookingId).catch(err => console.error('Failed to mark as read:', err));
                    }
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
            const otherUserIds = [...new Set(bookings.map((b: any) => b[otherCol]))];
            const { data: otherUsers } = await supabase.from("users").select("id, first_name, last_name").in("id", otherUserIds);
            const { data: trainerProfiles } = await supabase.from("trainer_profiles").select("user_id, is_founding_50, is_verified").in("user_id", otherUserIds);
            const trainerMap = new Map((trainerProfiles || []).map((tp: any) => [tp.user_id, tp]));
            const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));
            const bookingIds = bookings.map((b: any) => b.id);
            const { data: allMessages } = await supabase.from("messages").select("*").in("booking_id", bookingIds).order("created_at", { ascending: false });
            // Build one conversation per other user (merge all bookings)
            const userConvoMap = new Map<string, Conversation>();
            bookings.forEach((b: any) => {
                const other = userMap.get(b[otherCol]) as any;
                const tp = trainerMap.get(b[otherCol]) as any;
                const bookingMessages = (allMessages || []).filter((m: Message) => m.booking_id === b.id);
                const lastMsg = bookingMessages[0];
                const unreadCount = bookingMessages.filter((m: any) => m.sender_id !== u.id && !m.read_at).length;
                const existing = userConvoMap.get(b[otherCol]);
                if (existing) {
                    // Merge: accumulate booking IDs, unread counts; keep latest message
                    existing.allBookingIds.push(b.id);
                    existing.unreadCount += unreadCount;
                    const existingTime = new Date(existing.lastMessageAt).getTime();
                    const thisTime = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;
                    if (thisTime > existingTime) {
                        existing.lastMessage = lastMsg?.content || existing.lastMessage;
                        existing.lastMessageAt = lastMsg?.created_at || existing.lastMessageAt;
                        existing.bookingId = b.id;
                        existing.sport = b.sport;
                    }
                } else {
                    userConvoMap.set(b[otherCol], {
                        bookingId: b.id,
                        allBookingIds: [b.id],
                        otherUserId: b[otherCol],
                        otherUserName: other ? `${other.first_name} ${other.last_name}` : "Unknown",
                        otherUserInitials: other ? `${other.first_name[0]}${other.last_name[0]}`.toUpperCase() : "?",
                        sport: b.sport, lastMessage: lastMsg?.content || "No messages yet",
                        lastMessageAt: lastMsg?.created_at || b.id, unreadCount,
                        otherUserFounding50: tp?.is_founding_50 ?? false,
                        otherUserVerified: tp?.is_verified ?? false,
                    });
                }
            });
            const convos = Array.from(userConvoMap.values());
            convos.sort((a, b) => {
                const tA = new Date(a.lastMessageAt).getTime(), tB = new Date(b.lastMessageAt).getTime();
                if (isNaN(tA) && isNaN(tB)) return 0;
                if (isNaN(tA)) return 1; if (isNaN(tB)) return -1;
                return tB - tA;
            });
            setConversations(convos);
            if (convos.length > 0 && !selectedBookingId) {
                setSelectedBookingId(convos[0].bookingId);
                loadMessages(convos[0].bookingId, convos[0].allBookingIds);
                // Mark first conversation as read on initial load
                convos[0].allBookingIds.forEach(id => markConversationRead(id));
            }
        } catch (err) { console.error("Failed to load conversations:", err); }
        finally { setLoading(false); }
    };

    const loadMessages = async (bookingId: string, allIds?: string[]) => {
        const ids = allIds || [bookingId];
        const { data } = await supabase.from("messages").select("*").in("booking_id", ids).order("created_at", { ascending: true });
        setMessages((data || []) as Message[]);
    };

    const selectConversation = async (bookingId: string) => {
        const convo = conversations.find(c => c.bookingId === bookingId);
        setSelectedBookingId(bookingId);
        loadMessages(bookingId, convo?.allBookingIds);
        setConversations(prev => prev.map(c => c.bookingId === bookingId ? { ...c, unreadCount: 0 } : c));
        // Mark all booking IDs for this conversation as read
        (convo?.allBookingIds || [bookingId]).forEach(id => markAsReadApi(id));
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

    const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
    const sidebarLabel = user?.role === "trainer" ? "Athletes" : user?.role === "admin" ? "Conversations" : "Trainers";

    return (
        <div className="fixed inset-y-0 right-0 left-0 md:left-[260px] top-[calc(64px+var(--banner-h,0px))] md:top-[calc(72px+var(--banner-h,0px))] flex flex-col bg-[#0A0C12] z-20">
            {/* Chat layout — full remaining viewport */}
            <div className="flex-1 flex min-h-0 overflow-hidden bg-[#0F1118]">

                {/* ── Sidebar ── */}
                <div className={`w-full md:w-[280px] lg:w-[300px] shrink-0 flex-col border-r border-white/8 bg-[#0B0D13] ${showSidebar ? "flex" : "hidden md:flex"}`}>
                    {/* Sidebar header */}
                    <div className="px-4 py-3.5 border-b border-white/8 shrink-0 flex items-center justify-between">
                        <p className="text-[10px] font-black text-white/55 uppercase tracking-[0.2em]">
                            {sidebarLabel}
                        </p>
                        <span className="text-[10px] font-bold text-text-main/40 bg-white/[0.05] px-2 py-0.5 rounded-full">
                            {conversations.length}
                        </span>
                    </div>

                    {/* Conversation list */}
                    <div className="flex-1 overflow-y-auto">
                        {conversations.map((c) => {
                            const isActive = c.bookingId === selectedBookingId;
                            return (
                                <button
                                    key={c.bookingId}
                                    onClick={() => selectConversation(c.bookingId)}
                                    aria-label={`Open conversation with ${c.otherUserName}${c.unreadCount > 0 ? `, ${c.unreadCount} unread` : ""}`}
                                    className={`w-full text-left px-3.5 py-3 flex gap-2.5 items-start transition-all border-b border-white/[0.04] relative group ${
                                        isActive
                                            ? "bg-primary/[0.08]"
                                            : "hover:bg-white/[0.03]"
                                    }`}
                                >
                                    {isActive && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[11px] transition-colors ${
                                            isActive ? "bg-primary/20 text-primary" : "bg-white/[0.08] text-text-main/80 group-hover:bg-white/[0.12]"
                                        }`}>
                                            {c.otherUserInitials}
                                        </div>
                                        {c.unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-bg text-[9px] font-black flex items-center justify-center border border-[#0B0D13]">
                                                {c.unreadCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                            <span className={`text-[13px] font-bold truncate flex items-center gap-1 ${isActive ? "text-white" : "text-text-main/90"}`}>
                                                {c.otherUserName}
                                                {c.otherUserFounding50 && <FoundingBadge size={13} />}
                                                {c.otherUserVerified && !c.otherUserFounding50 && <ShieldCheck size={12} className="text-primary shrink-0" />}
                                            </span>
                                            <span className={`text-[10px] font-semibold shrink-0 ${c.unreadCount > 0 ? "text-primary" : "text-text-main/40"}`}>
                                                {timeFormat(c.lastMessageAt)}
                                            </span>
                                        </div>
                                        <p className={`text-[11.5px] truncate leading-snug ${c.unreadCount > 0 ? "text-white/80 font-semibold" : "text-text-main/50 font-medium"}`}>
                                            {c.lastMessage}
                                        </p>
                                        <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-wider text-text-main/50 bg-white/[0.06] px-1.5 py-0.5 rounded-full border border-white/[0.06]">
                                            <Activity size={8} />
                                            {formatSportName(c.sport)}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Chat Area ── */}
                <div className={`w-full md:flex-1 flex-col min-w-0 ${!showSidebar ? "flex" : "hidden md:flex"}`}>

                    {/* Chat header */}
                    {selectedConvo ? (
                        <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-3 shrink-0 bg-[#0F1118]">
                            {/* Mobile back */}
                            <button
                                onClick={() => setShowSidebar(true)}
                                aria-label="Back to conversations"
                                className="md:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-main/70 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={16} />
                            </button>

                            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center font-black text-[11px] text-primary shrink-0">
                                {selectedConvo.otherUserInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold text-white leading-tight truncate flex items-center gap-1">
                                    {selectedConvo.otherUserName}
                                    {selectedConvo.otherUserFounding50 && <FoundingBadge size={14} />}
                                    {selectedConvo.otherUserVerified && !selectedConvo.otherUserFounding50 && <ShieldCheck size={13} className="text-primary shrink-0" />}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Activity size={9} className="text-primary/60" />
                                    <p className="text-[10px] text-text-main/55 font-semibold uppercase tracking-wider">
                                        {formatSportName(selectedConvo.sport)} Session
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 py-3.5 border-b border-white/8 shrink-0" />
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-0.5 bg-[#0A0C12]">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                                    <MessageSquare size={24} className="text-text-main/30" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/70">No messages yet</p>
                                    <p className="text-xs text-text-main/40 mt-0.5">Start the conversation below</p>
                                </div>
                            </div>
                        ) : (
                            grouped.map((group) => (
                                <div key={group.date}>
                                    {/* Date separator */}
                                    <div className="flex items-center gap-2 my-3.5">
                                        <div className="flex-1 h-px bg-white/[0.08]" />
                                        <span className="text-[10px] font-bold text-text-main/40 uppercase tracking-widest bg-[#0A0C12] px-2.5">{group.date}</span>
                                        <div className="flex-1 h-px bg-white/[0.08]" />
                                    </div>

                                    {/* Messages in group */}
                                    <div className="flex flex-col gap-1">
                                        {group.msgs.map((m, idx) => {
                                            const isOwn = m.sender_id === user?.id;
                                            const prevMsg = idx > 0 ? group.msgs[idx - 1] : null;
                                            const isFirst = !prevMsg || prevMsg.sender_id !== m.sender_id;
                                            const nextMsg = idx < group.msgs.length - 1 ? group.msgs[idx + 1] : null;
                                            const isLast = !nextMsg || nextMsg.sender_id !== m.sender_id;
                                            const time = new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                                            return (
                                                <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isFirst ? "mt-2" : ""} items-end gap-1.5`}>
                                                    {/* Small avatar bubble for other user, hidden on grouped messages */}
                                                    {!isOwn && (
                                                        <div className={`w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center font-black text-[9px] text-text-main/70 shrink-0 ${isLast ? "" : "invisible"}`}>
                                                            {selectedConvo?.otherUserInitials}
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[78%] md:max-w-[60%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                                        <div className={`px-3 py-2 text-[13px] leading-snug break-words ${
                                                            isOwn
                                                                ? `bg-primary text-bg font-medium shadow-[0_2px_12px_rgba(69,208,255,0.2)] ${
                                                                    isFirst && isLast ? "rounded-2xl" :
                                                                    isFirst ? "rounded-2xl rounded-br-md" :
                                                                    isLast ? "rounded-2xl rounded-tr-md" :
                                                                    "rounded-2xl rounded-r-md"
                                                                  }`
                                                                : `bg-[#1C1F2E] text-white border border-white/[0.08] ${
                                                                    isFirst && isLast ? "rounded-2xl" :
                                                                    isFirst ? "rounded-2xl rounded-bl-md" :
                                                                    isLast ? "rounded-2xl rounded-tl-md" :
                                                                    "rounded-2xl rounded-l-md"
                                                                  }`
                                                        }`}>
                                                            {m.content}
                                                        </div>
                                                        {isLast && (
                                                            <div className={`flex items-center gap-1 mt-1 px-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                                                                <span className="text-[10px] text-text-main/40 font-medium">{time}</span>
                                                                {isOwn && <CheckCheck size={10} className={m.read_at ? "text-primary" : "text-text-main/30"} />}
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
                    <div className="px-4 md:px-5 py-3 border-t border-white/8 shrink-0 bg-[#0F1118]">
                        <div className="flex items-center gap-2.5 bg-[#1A1D29] border border-white/[0.10] rounded-xl px-3.5 py-2.5 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgba(69,208,255,0.08)] transition-all">
                            <input
                                ref={inputRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                                placeholder="Type a message..."
                                aria-label="Message input"
                                className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder:text-text-main/35 font-medium"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={sending || !newMessage.trim()}
                                aria-label="Send message"
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                    newMessage.trim()
                                        ? "bg-primary text-bg hover:shadow-[0_0_12px_rgba(69,208,255,0.45)] hover:scale-105 active:scale-95"
                                        : "bg-white/[0.06] text-text-main/25 cursor-not-allowed"
                                }`}
                            >
                                <Send size={14} strokeWidth={2.5} className={newMessage.trim() ? "translate-x-px -translate-y-px" : ""} />
                            </button>
                        </div>
                        <p className="text-[10px] text-text-main/25 text-center mt-1.5 font-medium">Press Enter to send</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
