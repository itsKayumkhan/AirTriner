import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView,
    Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, MessageRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

// ---------- Date helpers (matching web) ----------
function isToday(d: Date) {
    const n = new Date();
    return (
        d.getDate() === n.getDate() &&
        d.getMonth() === n.getMonth() &&
        d.getFullYear() === n.getFullYear()
    );
}
function isYesterday(d: Date) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return (
        d.getDate() === y.getDate() &&
        d.getMonth() === y.getMonth() &&
        d.getFullYear() === y.getFullYear()
    );
}
function getDateLabel(d: Date): string {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

// Group messages by date for section separators
type DateGroup = { date: string; msgs: MessageRow[] };
function groupMessagesByDate(messages: MessageRow[]): DateGroup[] {
    const groups: DateGroup[] = [];
    messages.forEach((m) => {
        const label = getDateLabel(new Date(m.created_at));
        const last = groups[groups.length - 1];
        if (last && last.date === label) {
            last.msgs.push(m);
        } else {
            groups.push({ date: label, msgs: [m] });
        }
    });
    return groups;
}

export default function ChatScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const { bookingId, allBookingIds: paramAllBookingIds, otherUser, sport } = route.params;

    // Use allBookingIds if passed; fall back to single bookingId
    const allBookingIds: string[] = paramAllBookingIds && paramAllBookingIds.length > 0
        ? paramAllBookingIds
        : [bookingId];

    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // ---------- Mark messages as read ----------
    const markMessagesAsRead = useCallback(async () => {
        if (!user) return;
        const { error } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('booking_id', allBookingIds)
            .neq('sender_id', user.id)
            .is('read_at', null);

        if (error) console.error('Error marking messages as read:', error);

        // Update local state to reflect read status
        setMessages((prev) =>
            prev.map((m) =>
                m.sender_id !== user.id && !m.read_at
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
            )
        );
    }, [allBookingIds, user]);

    // ---------- Fetch all messages for this conversation ----------
    const fetchMessages = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .in('booking_id', allBookingIds)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);

            // Mark as read after short delay
            if (user) {
                setTimeout(() => markMessagesAsRead(), 500);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    }, [allBookingIds, user, markMessagesAsRead]);

    // ---------- Load messages + real-time subscription ----------
    useEffect(() => {
        fetchMessages();

        // Subscribe to new messages and updates across ALL booking IDs in this conversation
        const channel = supabase
            .channel(`chat:${allBookingIds.join(',')}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMsg = payload.new as MessageRow;
                    // Only handle messages belonging to this conversation
                    if (!allBookingIds.includes(newMsg.booking_id)) return;

                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });

                    // If message is from the other user, mark as read since we're viewing
                    if (newMsg.sender_id !== user?.id) {
                        setTimeout(() => markMessagesAsRead(), 300);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const updatedMsg = payload.new as MessageRow;
                    if (!allBookingIds.includes(updatedMsg.booking_id)) return;

                    // Update read receipts in real-time
                    setMessages((prev) =>
                        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchMessages, allBookingIds, user, markMessagesAsRead]);

    // ---------- Auto-scroll on new messages ----------
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages.length]);

    // ---------- Send message ----------
    const sendMessage = async () => {
        if (!newMessage.trim() || !user || isSending) return;
        const content = newMessage.trim();
        setNewMessage('');
        setIsSending(true);

        // Optimistic update
        const optimisticMessage: MessageRow = {
            id: `temp-${Date.now()}`,
            booking_id: bookingId,
            sender_id: user.id,
            content,
            read_at: null,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMessage]);

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    booking_id: bookingId,
                    sender_id: user.id,
                    content,
                })
                .select()
                .single();

            if (error) throw error;

            // Replace optimistic message with real one
            if (data) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === optimisticMessage.id ? (data as MessageRow) : m
                    )
                );
            }

            // Create notification for the other user
            if (otherUser?.id) {
                await createNotification({
                    userId: otherUser.id,
                    type: 'MESSAGE_RECEIVED',
                    title: `${user.firstName} ${user.lastName}`,
                    body:
                        content.length > 100
                            ? content.substring(0, 100) + '...'
                            : content,
                    data: { bookingId, senderId: user.id },
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) =>
                prev.filter((m) => m.id !== optimisticMessage.id)
            );
            setNewMessage(content); // restore message on failure
        } finally {
            setIsSending(false);
        }
    };

    // ---------- Time formatting ----------
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // ---------- Build flat list data with date separators ----------
    type ListItem =
        | { type: 'date'; label: string; key: string }
        | { type: 'message'; message: MessageRow; key: string };

    const buildListData = (): ListItem[] => {
        const groups = groupMessagesByDate(messages);
        const items: ListItem[] = [];
        groups.forEach((group) => {
            items.push({ type: 'date', label: group.date, key: `date-${group.date}` });
            group.msgs.forEach((m) => {
                items.push({ type: 'message', message: m, key: m.id });
            });
        });
        return items;
    };

    const listData = buildListData();

    // ---------- Render ----------
    const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
        if (item.type === 'date') {
            return (
                <View style={styles.dateHeader}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateHeaderText}>{item.label}</Text>
                    <View style={styles.dateLine} />
                </View>
            );
        }

        const m = item.message;
        const isMe = m.sender_id === user?.id;

        // Check if this is the last message sent by current user (for read receipt)
        const isLastMyMessage =
            isMe &&
            !messages
                .slice(messages.indexOf(m) + 1)
                .some((msg) => msg.sender_id === user?.id);

        return (
            <View>
                <View
                    style={[
                        styles.messageBubble,
                        isMe ? styles.myMessage : styles.otherMessage,
                    ]}
                >
                    <Text
                        style={[
                            styles.messageText,
                            isMe ? styles.myMessageText : styles.otherMessageText,
                        ]}
                    >
                        {m.content}
                    </Text>
                    <View style={styles.messageFooter}>
                        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
                            {formatTime(m.created_at)}
                        </Text>
                        {isMe && (
                            <View style={styles.readReceiptContainer}>
                                {m.id.startsWith('temp-') ? (
                                    <Ionicons
                                        name="time-outline"
                                        size={14}
                                        color="rgba(255,255,255,0.5)"
                                    />
                                ) : m.read_at ? (
                                    <Ionicons
                                        name="checkmark-done"
                                        size={14}
                                        color="#4FC3F7"
                                    />
                                ) : (
                                    <Ionicons
                                        name="checkmark-done"
                                        size={14}
                                        color="rgba(255,255,255,0.5)"
                                    />
                                )}
                            </View>
                        )}
                    </View>
                </View>
                {isLastMyMessage && isMe && m.read_at && (
                    <Text style={styles.readText}>Read {formatTime(m.read_at)}</Text>
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerAvatar}>
                    <Text style={styles.headerAvatarText}>
                        {(otherUser?.first_name?.[0] || '') +
                            (otherUser?.last_name?.[0] || '')}
                    </Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>
                        {otherUser?.first_name} {otherUser?.last_name}
                    </Text>
                    {sport && (
                        <Text style={styles.headerSport}>
                            {(sport || '').replace(/_/g, ' ')} Session
                        </Text>
                    )}
                </View>
            </View>

            {/* Messages */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.key}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() =>
                        flatListRef.current?.scrollToEnd({ animated: true })
                    }
                    onLayout={() =>
                        flatListRef.current?.scrollToEnd({ animated: false })
                    }
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={40}
                                color={Colors.textTertiary}
                            />
                            <Text style={styles.emptyChatTitle}>No messages yet</Text>
                            <Text style={styles.emptyChatText}>
                                Start the conversation below
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Input Bar */}
            <View style={styles.inputBar}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor={Colors.textTertiary}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={1000}
                        onFocus={() =>
                            setTimeout(
                                () =>
                                    flatListRef.current?.scrollToEnd({
                                        animated: true,
                                    }),
                                200
                            )
                        }
                    />
                </View>
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        !newMessage.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                >
                    <Ionicons
                        name="send"
                        size={20}
                        color={newMessage.trim() ? '#0A0D14' : Colors.textTertiary}
                    />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: 56,
        paddingBottom: Spacing.lg,
        backgroundColor: '#0A0D14',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    headerAvatarText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#45D0FF',
    },
    headerInfo: { flex: 1 },
    headerName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    headerSport: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messagesList: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    // Date separators (matching web style)
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
        gap: Spacing.sm,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    dateHeaderText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        paddingHorizontal: Spacing.sm,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#0047AB',
        borderBottomRightRadius: 4,
    },
    otherMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#161B22',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    messageText: { fontSize: FontSize.md, lineHeight: 22 },
    myMessageText: { color: '#fff' },
    otherMessageText: { color: '#FFFFFF' },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 4,
    },
    messageTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    myMessageTime: { color: 'rgba(255,255,255,0.7)' },
    readReceiptContainer: { marginLeft: 2 },
    readText: {
        fontSize: 10,
        color: Colors.textTertiary,
        textAlign: 'right',
        marginBottom: Spacing.sm,
        marginRight: Spacing.xs,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.sm,
        backgroundColor: '#161B22',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        gap: Spacing.sm,
    },
    inputContainer: {
        flex: 1,
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 0,
        maxHeight: 100,
    },
    textInput: {
        color: Colors.text,
        fontSize: FontSize.md,
        maxHeight: 80,
        paddingTop: Platform.OS === 'ios' ? 0 : Spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.sm,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#45D0FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: { backgroundColor: Colors.surface },
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: Spacing.sm,
    },
    emptyChatTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.4)',
    },
    emptyChatText: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.25)',
    },
});
