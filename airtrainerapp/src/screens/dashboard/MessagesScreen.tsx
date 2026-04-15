import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, MessageRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout } from '../../theme';
import { formatSportName } from '../../lib/format';
import {
    ScreenWrapper,
    Avatar,
    Badge,
    EmptyState,
    LoadingScreen,
} from '../../components/ui';

type ConversationItem = {
    bookingId: string;
    allBookingIds: string[];
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
    const [searchQuery, setSearchQuery] = useState('');

    const loadConversations = useCallback(async () => {
        if (!user) return;
        try {
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

            const otherCol = user.role === 'trainer' ? 'athlete_id' : 'trainer_id';
            const otherUserIds = [...new Set(bookings.map((b: any) => b[otherCol]))];

            const { data: otherUsers } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .in('id', otherUserIds);

            const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));

            const bookingIds = bookings.map((b: any) => b.id);
            const { data: allMessages } = await supabase
                .from('messages')
                .select('*')
                .in('booking_id', bookingIds)
                .order('created_at', { ascending: false });

            const userConvoMap = new Map<string, ConversationItem>();

            bookings.forEach((b: any) => {
                const otherUserId = b[otherCol];
                const other = userMap.get(otherUserId);
                const bookingMessages = (allMessages || []).filter(
                    (m: MessageRow) => m.booking_id === b.id
                );
                const lastMsg = bookingMessages[0];
                const unreadCount = bookingMessages.filter(
                    (m: any) => m.sender_id !== user.id && !m.read_at
                ).length;

                const existing = userConvoMap.get(otherUserId);
                if (existing) {
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

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadConversations();
        });
        return unsubscribe;
    }, [navigation, loadConversations]);

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
                        loadConversations();
                        return;
                    }

                    if (payload.eventType === 'INSERT') {
                        setConversations((prev) => {
                            const existing = prev.find((c) =>
                                c.allBookingIds.includes(msg.booking_id)
                            );
                            if (!existing) {
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

    const isRecent = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return Date.now() - d.getTime() < 600000; // 10 minutes
    };

    const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c) =>
                c.otherUserName.toLowerCase().includes(q) ||
                c.sport?.toLowerCase().includes(q) ||
                c.lastMessage.toLowerCase().includes(q)
        );
    }, [conversations, searchQuery]);

    const renderConversation = ({ item, index }: { item: ConversationItem; index: number }) => {
        const hasUnread = item.unreadCount > 0;
        const recentActivity = isRecent(item.lastMessageAt);

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.convItem,
                    hasUnread && styles.convItemUnread,
                    pressed && styles.convItemPressed,
                ]}
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
                accessibilityLabel={`Conversation with ${item.otherUserName}${hasUnread ? `, ${item.unreadCount} unread messages` : ''}`}
                accessibilityRole="button"
            >
                {/* Avatar with online indicator */}
                <View style={styles.avatarContainer}>
                    <Avatar
                        name={item.otherUserName}
                        size={48}
                    />
                    {recentActivity && <View style={styles.onlineDot} />}
                </View>

                {/* Center content */}
                <View style={styles.convContent}>
                    <View style={styles.convTopRow}>
                        <Text
                            style={[
                                styles.convName,
                                hasUnread && styles.convNameUnread,
                            ]}
                            numberOfLines={1}
                        >
                            {item.otherUserName}
                        </Text>
                        <Text style={[styles.convTime, hasUnread && styles.convTimeUnread]}>
                            {formatTime(item.lastMessageAt)}
                        </Text>
                    </View>
                    <View style={styles.convBottomRow}>
                        <View style={styles.messageLine}>
                            <Text
                                style={[
                                    styles.convMessage,
                                    hasUnread && styles.convMessageUnread,
                                ]}
                                numberOfLines={1}
                            >
                                {item.lastMessage}
                            </Text>
                            <Badge
                                label={formatSportName(item.sport || '')}
                                color={Colors.primary}
                                size="sm"
                                style={styles.sportBadge}
                            />
                        </View>
                        {hasUnread && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>
                                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderSeparator = () => <View style={styles.separator} />;

    if (isLoading) {
        return <LoadingScreen message="Loading conversations..." />;
    }

    return (
        <ScreenWrapper scrollable={false} noPadding>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Messages</Text>
                <Text style={styles.headerSubtitle}>
                    {totalUnread > 0
                        ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}`
                        : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
                </Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons
                        name="search-outline"
                        size={18}
                        color={Colors.textTertiary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search conversations..."
                        placeholderTextColor={Colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        accessibilityLabel="Search conversations"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable
                            onPress={() => setSearchQuery('')}
                            hitSlop={8}
                            style={styles.clearButton}
                            accessibilityLabel="Clear search"
                        >
                            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Conversation list */}
            <FlatList
                data={filteredConversations}
                renderItem={renderConversation}
                keyExtractor={(item) => item.otherUserId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={renderSeparator}
                ListEmptyComponent={
                    <EmptyState
                        icon="chatbubbles-outline"
                        title={
                            searchQuery.trim()
                                ? 'No results found'
                                : 'No conversations yet'
                        }
                        description={
                            searchQuery.trim()
                                ? `No conversations match "${searchQuery}"`
                                : `Messages appear after you have active bookings with ${
                                      user?.role === 'trainer' ? 'athletes' : 'a trainer'
                                  }.`
                        }
                    />
                }
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        paddingHorizontal: Layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },

    // Search bar
    searchContainer: {
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: Spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.lg,
        height: 44,
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        paddingVertical: 0,
    },
    clearButton: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // List
    listContent: {
        paddingBottom: 100,
        flexGrow: 1,
    },

    // Separator
    separator: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Layout.screenPadding + 48 + Spacing.lg, // avatar + gap
        marginRight: Layout.screenPadding,
    },

    // Conversation item
    convItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: Spacing.lg,
        gap: Spacing.lg,
    },
    convItemUnread: {
        backgroundColor: Colors.surfaceElevated,
    },
    convItemPressed: {
        opacity: 0.7,
    },

    // Avatar
    avatarContainer: {
        position: 'relative',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.success,
        borderWidth: 2,
        borderColor: Colors.background,
    },

    // Content
    convContent: {
        flex: 1,
        gap: 4,
    },
    convTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    convName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        flex: 1,
        marginRight: Spacing.sm,
    },
    convNameUnread: {
        fontWeight: FontWeight.bold,
    },
    convTime: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
    },
    convTimeUnread: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },

    convBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    messageLine: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    convMessage: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        flexShrink: 1,
    },
    convMessageUnread: {
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    sportBadge: {
        flexShrink: 0,
    },

    // Unread badge
    unreadBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
    },
    unreadText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
});
