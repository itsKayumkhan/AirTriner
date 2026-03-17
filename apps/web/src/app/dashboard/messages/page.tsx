"use client";

import { MessageSquare, Hand, Send } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

export default function MessagesPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadConversations(session);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Subscribe to real-time messages for all active conversations
    useEffect(() => {
        if (!user || conversations.length === 0) return;

        const bookingIds = conversations.map(c => c.bookingId);
        
        // Use a single channel but filter by any of the booking IDs in the payload if needed
        // Or simpler: listen to all messages and filter in the handler (since we don't have many active bookings)
        const subscription = supabase
            .channel(`all_messages:${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "messages",
                },
                async (payload) => {
                    const newMessage = (payload.new || payload.old) as any;
                    if (!newMessage) return;

                    // If it's an UPDATE and we don't have booking_id, or if we want to be 100% sure we sync,
                    // just re-read the conversations. This is more robust than manual state incrementing
                    // when multiple fields (read, read_at) are involved.
                    if (payload.eventType === "UPDATE") {
                        loadConversations(user);
                        return;
                    }

                    // For INSERTS, we can still do the fast path
                    if (payload.eventType === "INSERT") {
                        const bookingId = newMessage.booking_id;
                        if (!bookingId || !bookingIds.includes(bookingId)) return;

                        // 1. If it's for the selected chat, add to message list
                        if (bookingId === selectedBookingId) {
                            setMessages((prev) => {
                                if (prev.some((m) => m.id === newMessage.id)) return prev;
                                return [...prev, newMessage as Message];
                            });
                            
                            if (newMessage.sender_id !== user.id) {
                                markAsReadApi(bookingId);
                            }
                        }

                        // 2. Update conversation list for the new message
                        setConversations((prev) => {
                            const existing = prev.find(c => c.bookingId === bookingId);
                            if (!existing) return prev;

                            const updated = {
                                ...existing,
                                lastMessage: newMessage.content || existing.lastMessage,
                                lastMessageAt: newMessage.created_at || existing.lastMessageAt,
                                unreadCount: (bookingId === selectedBookingId || newMessage.sender_id === user.id) 
                                    ? 0 
                                    : existing.unreadCount + 1
                            };

                            const filtered = prev.filter(c => c.bookingId !== bookingId);
                            return [updated, ...filtered];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [selectedBookingId, user, conversations.length]);

    const markAsReadApi = async (bookingId: string) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`${API_URL}/messages/booking/${bookingId}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (err) {
            console.error("Failed to mark as read:", err);
        }
    };

    const loadConversations = async (u: AuthUser) => {
        try {
            // Get all bookings where user is involved
            const isTrainer = u.role === "trainer";
            const col = isTrainer ? "trainer_id" : "athlete_id";
            const otherCol = isTrainer ? "athlete_id" : "trainer_id";

            const { data: bookings } = await supabase
                .from("bookings")
                .select("id, trainer_id, athlete_id, sport, status")
                .eq(col, u.id)
                .in("status", ["confirmed", "completed", "pending"]);

            if (!bookings || bookings.length === 0) {
                setLoading(false);
                return;
            }

            const otherUserIds = bookings.map((b: Record<string, string>) => b[otherCol]);
            const { data: otherUsers } = await supabase
                .from("users")
                .select("id, first_name, last_name")
                .in("id", [...new Set(otherUserIds)]);

            const userMap = new Map(
                (otherUsers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u])
            );

            // Get last messages for each booking
            const bookingIds = bookings.map((b: { id: string }) => b.id);
            const { data: allMessages } = await supabase
                .from("messages")
                .select("*")
                .in("booking_id", bookingIds)
                .order("created_at", { ascending: false });

            const convos: Conversation[] = bookings.map((b: Record<string, string>) => {
                const other = userMap.get(b[otherCol]) as { first_name: string; last_name: string } | undefined;
                const bookingMessages = (allMessages || []).filter((m: Message) => m.booking_id === b.id);
                const lastMsg = bookingMessages[0];
                
                // Calculate unread count (received messages that have no read_at or read is false)
                const unreadCount = bookingMessages.filter(m => m.sender_id !== u.id && (!m.read_at || (m as any).read === false)).length;

                return {
                    bookingId: b.id,
                    otherUserId: b[otherCol],
                    otherUserName: other ? `${other.first_name} ${other.last_name}` : "Unknown",
                    otherUserInitials: other ? `${other.first_name[0]}${other.last_name[0]}` : "?",
                    sport: b.sport,
                    lastMessage: lastMsg?.content || "No messages yet",
                    lastMessageAt: lastMsg?.created_at || b.id,
                    unreadCount: unreadCount,
                };
            });

            convos.sort((a, b) => {
                const timeA = new Date(a.lastMessageAt).getTime();
                const timeB = new Date(b.lastMessageAt).getTime();
                // Fallback for cases where it's not a date
                if (isNaN(timeA) && isNaN(timeB)) return 0;
                if (isNaN(timeA)) return 1;
                if (isNaN(timeB)) return -1;
                return timeB - timeA;
            });
            setConversations(convos);

            if (convos.length > 0 && !selectedBookingId) {
                setSelectedBookingId(convos[0].bookingId);
                loadMessages(convos[0].bookingId);
            }
        } catch (err) {
            console.error("Failed to load conversations:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (bookingId: string) => {
        const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("booking_id", bookingId)
            .order("created_at", { ascending: true });
        setMessages((data || []) as Message[]);
    };

    const selectConversation = async (bookingId: string) => {
        setSelectedBookingId(bookingId);
        loadMessages(bookingId);
        
        // Mark as read in UI immediately
        setConversations(prev => prev.map(c => 
            c.bookingId === bookingId ? { ...c, unreadCount: 0 } : c
        ));

        // Mark as read in backend
        markAsReadApi(bookingId);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !user || !selectedBookingId) return;
        setSending(true);

        try {
            const { data, error } = await supabase
                .from("messages")
                .insert({
                    booking_id: selectedBookingId,
                    sender_id: user.id,
                    content: newMessage.trim(),
                })
                .select()
                .single();

            if (error) throw error;
            setMessages((prev) => [...prev, data as Message]);
            setNewMessage("");

            // Update conversation list and move to top
            setConversations((prev) => {
                const existing = prev.find(c => c.bookingId === selectedBookingId);
                if (!existing) return prev;

                const updated = {
                    ...existing,
                    lastMessage: newMessage.trim(),
                    lastMessageAt: new Date().toISOString()
                };

                const filtered = prev.filter(c => c.bookingId !== selectedBookingId);
                return [updated, ...filtered];
            });
        } catch (err) {
            console.error("Send failed:", err);
        } finally {
            setSending(false);
        }
    };

    const selectedConvo = conversations.find((c) => c.bookingId === selectedBookingId);

    const timeFormat = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        // If not a valid date string from lastMessageAt (e.g. used bookingId as fallback), return empty
        if (isNaN(d.getTime())) return "";
        if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    if (loading) {
        return (
            <div className="flex justify-center p-16">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-black font-display tracking-wider mb-1">Messages</h1>
                <p className="text-text-main/60 text-sm">Chat with your {user?.role === "trainer" ? "athletes" : "trainers"}</p>
            </div>

            {conversations.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-16 text-center shadow-[0_0_30px_rgba(69,208,255,0.02)]">
                    <MessageSquare className="text-text-main/20 w-16 h-16 mb-6 mx-auto" strokeWidth={1} />
                    <h3 className="text-xl font-black font-display uppercase tracking-wider mb-3">No conversations yet</h3>
                    <p className="text-text-main/60 text-sm font-medium">
                        Conversations will appear here once you have active bookings.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] flex-1 bg-surface rounded-2xl border border-white/5 overflow-hidden shadow-[0_0_30px_rgba(69,208,255,0.02)]">
                    {/* Sidebar */}
                    <div className="border-r border-white/5 overflow-y-auto hidden md:block">
                        {conversations.map((c) => (
                            <div
                                key={c.bookingId}
                                onClick={() => selectConversation(c.bookingId)}
                                className={`p-4 flex gap-4 items-center cursor-pointer border-b border-white/5 transition-all hover:bg-white/5 relative ${c.bookingId === selectedBookingId
                                        ? "bg-primary/10 border-l-4 border-l-primary"
                                        : "border-l-4 border-l-transparent"
                                    }`}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-[#272A35] flex items-center justify-center text-primary font-black text-sm shrink-0 shadow-[0_0_10px_rgba(69,208,255,0.05)]">
                                        {c.otherUserInitials}
                                    </div>
                                    {c.unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 bg-primary text-background-main text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-surface">
                                            {c.unreadCount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm text-text-main truncate pr-2">{c.otherUserName}</span>
                                        <span className="text-[10px] text-text-main/40 uppercase tracking-widest font-bold whitespace-nowrap">{timeFormat(c.lastMessageAt)}</span>
                                    </div>
                                    <div className="text-xs text-text-main/60 truncate font-medium mb-1.5">
                                        {c.lastMessage}
                                    </div>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-text-main/50 font-black uppercase tracking-widest">
                                        {c.sport.replace(/_/g, " ")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chat area */}
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Chat header */}
                        {selectedConvo && (
                            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-4 bg-surface z-10 shrink-0 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-[#272A35] flex items-center justify-center text-primary font-black text-xs shadow-[0_0_10px_rgba(69,208,255,0.05)]">
                                    {selectedConvo.otherUserInitials}
                                </div>
                                <div>
                                    <div className="font-black text-sm font-display mb-0.5">{selectedConvo.otherUserName}</div>
                                    <div className="text-[10px] text-text-main/50 uppercase tracking-widest font-bold">
                                        {selectedConvo.sport.replace(/_/g, " ")} session
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="text-center text-text-main/40 mt-12">
                                    <Hand className="w-10 h-10 mb-4 mx-auto opacity-50" strokeWidth={1} />
                                    <p className="text-sm font-medium">Start the conversation!</p>
                                </div>
                            )}
                            {messages.map((m) => {
                                const isOwn = m.sender_id === user?.id;
                                return (
                                    <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`max-w-[75%] px-5 py-3 text-sm leading-relaxed ${isOwn
                                                    ? "bg-primary text-bg rounded-2xl rounded-tr-sm shadow-[0_5px_15px_rgba(69,208,255,0.2)]"
                                                    : "bg-[#272A35] text-text-main rounded-2xl rounded-tl-sm border border-white/5 shadow-md"
                                                }`}
                                        >
                                            <p className={isOwn ? "font-semibold" : "font-medium"}>{m.content}</p>
                                            <div className={`text-[9px] mt-2 font-bold uppercase tracking-widest text-right ${isOwn ? "text-bg/60" : "text-text-main/40"}`}>
                                                {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/5 flex gap-3 bg-surface shrink-0">
                            <input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                                placeholder="Type a message..."
                                className="flex-1 px-6 py-3.5 rounded-full bg-[#272A35] border border-white/5 outline-none text-sm text-text-main focus:border-primary/50 transition-colors"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={sending || !newMessage.trim()}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${newMessage.trim()
                                        ? "bg-primary text-bg shadow-[0_0_15px_rgba(69,208,255,0.3)] hover:scale-105"
                                        : "bg-[#272A35] text-text-main/20 cursor-not-allowed"
                                    }`}
                            >
                                <Send size={18} className={newMessage.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
