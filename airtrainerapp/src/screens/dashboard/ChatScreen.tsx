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

export default function ChatScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const { bookingId, otherUser } = route.params;
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Mark incoming messages as read
    const markMessagesAsRead = useCallback(async () => {
        if (!user) return;
        const { error } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('booking_id', bookingId)
            .neq('sender_id', user.id)
            .is('read_at', null);

        if (error) console.error('Error marking messages as read:', error);

        // Also update local state to show read receipts
        setMessages((prev) =>
            prev.map((m) =>
                m.sender_id !== user.id && !m.read_at
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
            )
        );
    }, [bookingId, user]);

    const fetchMessages = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);

            // Mark as read after a short delay
            if (user) {
                setTimeout(() => markMessagesAsRead(), 500);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    }, [bookingId, user, markMessagesAsRead]);

    useEffect(() => {
        fetchMessages();

        // Subscribe to new messages and read receipt updates
        const channel = supabase
            .channel(`chat-${bookingId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `booking_id=eq.${bookingId}`,
            }, (payload) => {
                const newMsg = payload.new as MessageRow;
                setMessages((prev) => {
                    if (prev.some((m) => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                // If the message is from other user, mark it as read immediately since we're in the chat
                if (newMsg.sender_id !== user?.id) {
                    setTimeout(() => markMessagesAsRead(), 300);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `booking_id=eq.${bookingId}`,
            }, (payload) => {
                // Update read receipts in real-time
                const updatedMsg = payload.new as MessageRow;
                setMessages((prev) =>
                    prev.map((m) => m.id === updatedMsg.id ? updatedMsg : m)
                );
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchMessages, bookingId, user, markMessagesAsRead]);

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
            const { data, error } = await supabase.from('messages').insert({
                booking_id: bookingId,
                sender_id: user.id,
                content,
            }).select().single();

            if (error) throw error;

            // Replace optimistic message with real one
            if (data) {
                setMessages((prev) =>
                    prev.map((m) => m.id === optimisticMessage.id ? (data as MessageRow) : m)
                );
            }

            // Create notification for the other user
            if (otherUser?.id) {
                await createNotification({
                    userId: otherUser.id,
                    type: 'MESSAGE_RECEIVED',
                    title: `${user.firstName} ${user.lastName}`,
                    body: content.length > 100 ? content.substring(0, 100) + '...' : content,
                    data: { bookingId, senderId: user.id },
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const renderMessage = ({ item, index }: { item: MessageRow; index: number }) => {
        const isMe = item.sender_id === user?.id;
        const showDateHeader = index === 0 ||
            new Date(item.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

        // Check if this is the last message sent by current user for showing read receipt status
        const isLastMyMessage = isMe && (
            index === messages.length - 1 ||
            !messages.slice(index + 1).some(m => m.sender_id === user?.id)
        );

        return (
            <>
                {showDateHeader && (
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderText}>
                            {new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                )}
                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                        {item.content}
                    </Text>
                    <View style={styles.messageFooter}>
                        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>{formatTime(item.created_at)}</Text>
                        {isMe && (
                            <View style={styles.readReceiptContainer}>
                                {item.id.startsWith('temp-') ? (
                                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
                                ) : item.read_at ? (
                                    <Ionicons name="checkmark-done" size={14} color="#4FC3F7" />
                                ) : (
                                    <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.5)" />
                                )}
                            </View>
                        )}
                    </View>
                </View>
                {isLastMyMessage && isMe && item.read_at && (
                    <Text style={styles.readText}>Read {formatTime(item.read_at)}</Text>
                )}
            </>
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
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerAvatar}>
                    <Text style={styles.headerAvatarText}>
                        {(otherUser?.first_name?.[0] || '') + (otherUser?.last_name?.[0] || '')}
                    </Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>{otherUser?.first_name} {otherUser?.last_name}</Text>
                    <Text style={styles.headerOnline}>Online</Text>
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
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.textTertiary} />
                            <Text style={styles.emptyChatText}>Send your first message!</Text>
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
                        onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200)}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                >
                    <Ionicons name="send" size={20} color={newMessage.trim() ? '#0A0D14' : Colors.textTertiary} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg, backgroundColor: '#0A0D14', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
    headerAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    headerAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#45D0FF' },
    headerInfo: { flex: 1 },
    headerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headerOnline: { fontSize: FontSize.xs, color: Colors.success },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messagesList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, flexGrow: 1, justifyContent: 'flex-end' },
    dateHeader: { alignSelf: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 4, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface, marginVertical: Spacing.md },
    dateHeaderText: { fontSize: FontSize.xs, color: Colors.textTertiary },
    messageBubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#0047AB', borderBottomRightRadius: 4 },
    otherMessage: { alignSelf: 'flex-start', backgroundColor: '#161B22', borderBottomLeftRadius: 4 },
    messageText: { fontSize: FontSize.md, lineHeight: 22 },
    myMessageText: { color: '#fff' },
    otherMessageText: { color: '#FFFFFF' },
    messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
    messageTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    myMessageTime: { color: 'rgba(255,255,255,0.7)' },
    readReceiptContainer: { marginLeft: 2 },
    readText: { fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginBottom: Spacing.sm, marginRight: Spacing.xs },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.sm, backgroundColor: '#161B22', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: Spacing.sm },
    inputContainer: { flex: 1, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 0, maxHeight: 100 },
    textInput: { color: Colors.text, fontSize: FontSize.md, maxHeight: 80, paddingTop: Platform.OS === 'ios' ? 0 : Spacing.sm, paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.sm },
    sendButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#45D0FF', justifyContent: 'center', alignItems: 'center' },
    sendButtonDisabled: { backgroundColor: Colors.surface },
    emptyChat: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: Spacing.md },
    emptyChatText: { fontSize: FontSize.md, color: Colors.textTertiary },
});
