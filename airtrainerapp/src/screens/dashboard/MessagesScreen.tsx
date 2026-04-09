import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, MessageRow, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type ConversationItem = {
    bookingId: string;         // most recent booking id (for display/sending)
    allBookingIds: string[];   // all booking ids with this user
    otherUserId: string;
    otherUserName: string;
    otherUserInitials: string;
    sport: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
};

export default function MessagesScreen({ navigation }: any) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        try {
            // 1. Load all bookings for this user (as trainer or athlete)
            const { data: bookings, error: bookingsError } = await supabase
                .from('bookings')
                .select('*')
                .or(`athlete_id.eq.${user.id},trainer_id.eq.${user.id}`)
                .in('status', ['pending', 'confirmed', 'completed']);

            if (bookingsError) throw bookingsError;
            if (!bookings || bookings.length === 0) {
                setConversations([]);
                setIsLoading(false);
                return;
            }

            // 2. Get unique other user IDs
            const otherCol = user.role === 'trainer' ? 'athlete_id' : 'trainer_id';
            const otherUserIds = [...new Set(bookings.map((b: any) => b[otherCol]))];

            // 3. Fetch other users' profiles
            const { data: otherUsers } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .in('id', otherUserIds);

            const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));

            // 4. Fetch ALL messages across all booking IDs in one query
            const bookingIds = bookings.map((b: any) => b.id);
            const { data: allMessages } = await supabase
                .from('messages')
                .select('*')
                .in('booking_id', bookingIds)
                .order('created_at', { ascending: false });

            // 5. Build one conversation per other user (merge all bookings)
            const userConvoMap = new Map<string, ConversationItem>();

            bookings.forEach((b: any) => {
                const otherUserId = b[otherCol];
                const other = userMap.get(otherUserId);
                const bookingMessages = (allMessages || []).filter(
                    (m: MessageRow) => m.booking_id === b.id
                );
                const lastMsg = bookingMessages[0]; // already sorted desc
                const unreadCount = bookingMessages.filter(
                    (m: any) => m.sender_id !== user.id && !m.read_at
                ).length;

                const existing = userConvoMap.get(otherUserId);
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
                    userConvoMap.set(otherUserId, {
                        bookingId: b.id,
                        allBookingIds: [b.id],
                        otherUserId,
                        otherUserName: other
                            ? `${other.first_name} ${other.last_name}`
                            : 'Unknown',
                        otherUserInitials: other
                            ? `${other.first_name?.[0] || ''}${other.last_name?.[0] || ''}`.toUpperCase()
                            : '?',
                        sport: b.sport,
                        lastMessage: lastMsg?.content || 'No messages yet',
                        lastMessageAt: lastMsg?.created_at || b.id,
                        unreadCount,
                    });
                }
            });

            // 6. Sort by most recent message
            const convos = Array.from(userConvoMap.values());
            convos.sort((a, b) => {
                const tA = new Date(a.lastMessageAt).getTime();
                const tB = new Date(b.lastMessageAt).getTime();
                if (isNaN(tA) && isNaN(tB)) return 0;
                if (isNaN(tA)) return 1;
                if (isNaN(tB)) return -1;
                return tB - tA;
            });

            setConversations(convos);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Re-load conversations when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadConversations();
        });
        return unsubscribe;
    }, [navigation, loadConversations]);

    // Real-time subscription for new messages
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel(`messages_list:${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                (payload) => {
                    const msg = (payload.new || payload.old) as any;
                    if (!msg) return;

                    if (payload.eventType === 'UPDATE') {
                        // Read receipt update - reload to refresh unread counts
                        loadConversations();
                        return;
                    }

                    if (payload.eventType === 'INSERT') {
                        setConversations((prev) => {
                            const existing = prev.find((c) =>
                                c.allBookingIds.includes(msg.booking_id)
                            );
                            if (!existing) {
                                // New conversation - reload fully
                                loadConversations();
                                return prev;
                            }

                            const updated: ConversationItem = {
                                ...existing,
                                lastMessage: msg.content || existing.lastMessage,
                                lastMessageAt: msg.created_at || existing.lastMessageAt,
                                unreadCount:
                                    msg.sender_id === user.id
                                        ? existing.unreadCount
                                        : existing.unreadCount + 1,
                            };
                            return [
                                updated,
                                ...prev.filter(
                                    (c) => !c.allBookingIds.includes(msg.booking_id)
                                ),
                            ];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user, loadConversations]);

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const diff = Date.now() - d.getTime();
        if (diff < 86400000) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        if (diff < 604800000) {
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderConversation = ({ item }: { item: ConversationItem }) => (
        <TouchableOpacity
            style={styles.convCard}
            activeOpacity={0.7}
            onPress={() =>
                navigation.navigate('Chat', {
                    bookingId: item.bookingId,
                    allBookingIds: item.allBookingIds,
                    otherUser: {
                        id: item.otherUserId,
                        first_name: item.otherUserName.split(' ')[0],
                        last_name: item.otherUserName.split(' ').slice(1).join(' '),
                    },
                    sport: item.sport,
                })
            }
        >
            <LinearGradient
                colors={['#45D0FF', '#0047AB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, item.unreadCount > 0 && styles.avatarUnread]}
            >
                <Text style={styles.avatarText}>{item.otherUserInitials}</Text>
            </LinearGradient>
            <View style={styles.convContent}>
                <View style={styles.convTopRow}>
                    <Text
                        style={[
                            styles.convName,
                            item.unreadCount > 0 && styles.convNameUnread,
                        ]}
                    >
                        {item.otherUserName}
                    </Text>
                    <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
                </View>
                <Text style={styles.convSport}>
                    {(item.sport || '').replace(/_/g, ' ')}
                    {item.allBookingIds.length > 1
                        ? ` \u00B7 ${item.allBookingIds.length} bookings`
                        : ''}
                </Text>
                <Text
                    style={[
                        styles.convMessage,
                        item.unreadCount > 0 && styles.convMessageUnread,
                    ]}
                    numberOfLines={1}
                >
                    {item.lastMessage}
                </Text>
            </View>
            {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <Text style={styles.headerSubtitle}>
                    {conversations.length} conversation
                    {conversations.length !== 1 ? 's' : ''}
                    {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
                        ` \u00B7 ${conversations.reduce((acc, c) => acc + c.unreadCount, 0)} unread`
                    )}
                </Text>
            </View>
            <FlatList
                data={conversations}
                renderItem={renderConversation}
                keyExtractor={(item) => item.otherUserId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="chatbubbles-outline"
                            size={48}
                            color={Colors.textTertiary}
                        />
                        <Text style={styles.emptyTitle}>No conversations yet</Text>
                        <Text style={styles.emptyText}>
                            Messages appear after you have active bookings with{' '}
                            {user?.role === 'trainer' ? 'athletes' : 'a trainer'}.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: Spacing.xxl,
        paddingTop: 60,
        paddingBottom: Spacing.lg,
    },
    headerTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    listContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
    convCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    avatarUnread: { borderWidth: 2, borderColor: '#45D0FF' },
    avatarText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    convContent: { flex: 1 },
    convTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    convName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: '#FFFFFF',
    },
    convNameUnread: { fontWeight: FontWeight.bold },
    convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    convSport: { fontSize: FontSize.xs, color: '#45D0FF', marginTop: 2 },
    convMessage: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 4,
    },
    convMessageUnread: { color: '#FFFFFF' },
    unreadBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#45D0FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.sm,
    },
    unreadText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: '#0A0D14',
    },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        maxWidth: 260,
    },
});
