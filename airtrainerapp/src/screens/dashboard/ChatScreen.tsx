import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, Pressable,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, MessageRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout } from '../../theme';
import { formatSportName } from '../../lib/format';
import {
    ScreenWrapper,
    Avatar,
    EmptyState,
    LoadingScreen,
} from '../../components/ui';

// ---------- Date helpers ----------
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

    const allBookingIds: string[] =
        paramAllBookingIds && paramAllBookingIds.length > 0
            ? paramAllBookingIds
            : [bookingId];

    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const otherUserName = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim();
    const sportLabel = formatSportName(sport || '');

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

        setMessages((prev) =>
            prev.map((m) =>
                m.sender_id !== user.id && !m.read_at
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
            )
        );
    }, [allBookingIds, user]);

    // ---------- Fetch messages ----------
    const fetchMessages = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .in('booking_id', allBookingIds)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);

            if (user) {
                setTimeout(() => markMessagesAsRead(), 500);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    }, [allBookingIds, user, markMessagesAsRead]);

    // ---------- Real-time subscription ----------
    useEffect(() => {
        fetchMessages();

        const channel = supabase
            .channel(`chat:${allBookingIds.join(',')}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new as MessageRow;
                    if (!allBookingIds.includes(newMsg.booking_id)) return;

                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });

                    if (newMsg.sender_id !== user?.id) {
                        setTimeout(() => markMessagesAsRead(), 300);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages' },
                (payload) => {
                    const updatedMsg = payload.new as MessageRow;
                    if (!allBookingIds.includes(updatedMsg.booking_id)) return;

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

    // ---------- Auto-scroll ----------
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

            if (data) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === optimisticMessage.id ? (data as MessageRow) : m
                    )
                );
            }

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
            setNewMessage(content);
        } finally {
            setIsSending(false);
        }
    };

    // ---------- Time formatting ----------
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // ---------- Build flat list data ----------
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

    // ---------- Render items ----------
    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'date') {
            return (
                <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <View style={styles.datePill}>
                        <Text style={styles.dateText}>{item.label}</Text>
                    </View>
                    <View style={styles.dateLine} />
                </View>
            );
        }

        const m = item.message;
        const isMe = m.sender_id === user?.id;
        const isTemp = m.id.startsWith('temp-');

        const isLastMyMessage =
            isMe &&
            !messages
                .slice(messages.indexOf(m) + 1)
                .some((msg) => msg.sender_id === user?.id);

        return (
            <View>
                <View
                    style={[
                        styles.bubbleRow,
                        isMe ? styles.bubbleRowMe : styles.bubbleRowOther,
                    ]}
                >
                    {/* Received: small avatar to the left */}
                    {!isMe && (
                        <Avatar name={otherUserName} size={24} />
                    )}
                    <View
                        style={[
                            styles.bubble,
                            isMe ? styles.bubbleMe : styles.bubbleOther,
                        ]}
                    >
                        <Text
                            style={[
                                styles.bubbleText,
                                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
                            ]}
                        >
                            {m.content}
                        </Text>
                    </View>
                </View>

                {/* Timestamp + read receipts below bubble */}
                <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
                    <Text style={styles.metaTime}>{formatTime(m.created_at)}</Text>
                    {isMe && (
                        <View style={styles.readReceipt}>
                            {isTemp ? (
                                <Ionicons
                                    name="time-outline"
                                    size={12}
                                    color={Colors.textMuted}
                                />
                            ) : m.read_at ? (
                                <Ionicons
                                    name="checkmark-done"
                                    size={12}
                                    color={Colors.primary}
                                />
                            ) : (
                                <Ionicons
                                    name="checkmark-done"
                                    size={12}
                                    color={Colors.textMuted}
                                />
                            )}
                        </View>
                    )}
                </View>

                {/* "Read at" label for last sent message */}
                {isLastMyMessage && isMe && m.read_at && (
                    <Text style={styles.readLabel}>Read {formatTime(m.read_at)}</Text>
                )}
            </View>
        );
    };

    // ---------- Loading state ----------
    if (isLoading) {
        return <LoadingScreen message="Loading messages..." />;
    }

    const hasText = newMessage.trim().length > 0;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <ScreenWrapper scrollable={false} noPadding>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Ionicons name="chevron-back" size={24} color={Colors.text} />
                    </Pressable>

                    <Avatar name={otherUserName} size={32} />

                    <View style={styles.headerInfo}>
                        <Text style={styles.headerName} numberOfLines={1}>
                            {otherUserName || 'Chat'}
                        </Text>
                        {sportLabel ? (
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {sportLabel} Session
                            </Text>
                        ) : null}
                    </View>

                    <Pressable
                        style={styles.callButton}
                        accessibilityLabel={`Call ${otherUserName}`}
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Ionicons name="call-outline" size={20} color={Colors.primary} />
                    </Pressable>
                </View>

                <View style={styles.divider} />

                {/* Messages list */}
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
                        <View style={styles.emptyContainer}>
                            <EmptyState
                                icon="chatbubble-ellipses-outline"
                                title="Start the conversation!"
                                description={`Say hello to ${otherUserName}`}
                            />
                        </View>
                    }
                />

                {/* Input bar */}
                <View style={styles.inputBar}>
                    <View style={styles.inputPill}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type a message..."
                            placeholderTextColor={Colors.textTertiary}
                            value={newMessage}
                            onChangeText={setNewMessage}
                            multiline
                            maxLength={1000}
                            accessibilityLabel="Message input"
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
                    {hasText && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.sendButton,
                                pressed && styles.sendButtonPressed,
                            ]}
                            onPress={sendMessage}
                            disabled={isSending}
                            accessibilityLabel="Send message"
                            accessibilityRole="button"
                        >
                            <Ionicons name="arrow-up" size={22} color={Colors.textInverse} />
                        </Pressable>
                    )}
                </View>
            </ScreenWrapper>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
    },
    headerName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 1,
    },
    callButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
    },

    // Messages
    messagesList: {
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: Spacing.lg,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },

    // Date separator
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xl,
        gap: Spacing.sm,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    datePill: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    dateText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Bubble rows
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 2,
        gap: Spacing.sm,
    },
    bubbleRowMe: {
        justifyContent: 'flex-end',
    },
    bubbleRowOther: {
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },

    // Bubbles
    bubble: {
        maxWidth: '75%',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    bubbleMe: {
        backgroundColor: Colors.accent,
        borderRadius: BorderRadius.xl,
        borderBottomRightRadius: Spacing.xs,
    },
    bubbleOther: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        borderBottomLeftRadius: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    bubbleText: {
        fontSize: FontSize.md,
        lineHeight: 22,
    },
    bubbleTextMe: {
        color: '#FFFFFF',
    },
    bubbleTextOther: {
        color: '#FFFFFF',
    },

    // Meta row (time + read receipt)
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: Spacing.sm,
        paddingHorizontal: 2,
    },
    metaRowMe: {
        justifyContent: 'flex-end',
    },
    metaRowOther: {
        justifyContent: 'flex-start',
        marginLeft: 24 + Spacing.sm, // avatar width + gap
    },
    metaTime: {
        fontSize: 10,
        color: Colors.textMuted,
    },
    readReceipt: {
        marginLeft: 2,
    },
    readLabel: {
        fontSize: 10,
        color: Colors.textTertiary,
        textAlign: 'right',
        marginBottom: Spacing.sm,
        marginRight: Spacing.xs,
    },

    // Empty
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Input bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Layout.screenPadding,
        paddingTop: Spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: Spacing.sm,
    },
    inputPill: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
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
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonPressed: {
        opacity: 0.7,
    },
});
