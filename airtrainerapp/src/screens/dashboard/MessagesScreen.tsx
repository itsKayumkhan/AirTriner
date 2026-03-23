import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView,
    Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, MessageRow, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

// Conversation list view
type ConversationItem = {
    booking_id: string;
    booking: BookingRow;
    otherUser: UserRow;
    lastMessage: MessageRow | null;
    unreadCount: number;
};

export default function MessagesScreen({ navigation }: any) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConversations = useCallback(async () => {
        if (!user) return;
        try {
            const idColumn = user.role === 'trainer' ? 'trainer_id' : 'athlete_id';
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('*, athlete:users!bookings_athlete_id_fkey(*), trainer:users!bookings_trainer_id_fkey(*)')
                .eq(idColumn, user.id)
                .in('status', ['pending', 'confirmed', 'completed'])
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const convos: ConversationItem[] = [];
            for (const booking of bookings || []) {
                const { data: messages } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('booking_id', booking.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const { count } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('booking_id', booking.id)
                    .neq('sender_id', user.id)
                    .is('read_at', null);

                const otherUser = user.role === 'trainer' ? (booking as any).athlete : (booking as any).trainer;

                convos.push({
                    booking_id: booking.id,
                    booking: booking as BookingRow,
                    otherUser,
                    lastMessage: messages?.[0] || null,
                    unreadCount: count || 0,
                });
            }

            // Sort by last message or booking created_at
            convos.sort((a, b) => {
                const aTime = a.lastMessage?.created_at || a.booking.created_at;
                const bTime = b.lastMessage?.created_at || b.booking.created_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            });

            setConversations(convos);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchConversations(); }, [fetchConversations]);

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderConversation = ({ item }: { item: ConversationItem }) => (
        <TouchableOpacity
            style={styles.convCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Chat', { bookingId: item.booking_id, otherUser: item.otherUser })}
        >
            <LinearGradient
                colors={['#45D0FF', '#0047AB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, item.unreadCount > 0 && styles.avatarUnread]}
            >
                <Text style={styles.avatarText}>
                    {(item.otherUser?.first_name?.[0] || '') + (item.otherUser?.last_name?.[0] || '')}
                </Text>
            </LinearGradient>
            <View style={styles.convContent}>
                <View style={styles.convTopRow}>
                    <Text style={[styles.convName, item.unreadCount > 0 && styles.convNameUnread]}>
                        {item.otherUser?.first_name} {item.otherUser?.last_name}
                    </Text>
                    <Text style={styles.convTime}>
                        {item.lastMessage ? formatTime(item.lastMessage.created_at) : ''}
                    </Text>
                </View>
                <Text style={styles.convSport}>{item.booking.sport}</Text>
                <Text style={[styles.convMessage, item.unreadCount > 0 && styles.convMessageUnread]} numberOfLines={1}>
                    {item.lastMessage
                        ? (item.lastMessage.sender_id === user?.id ? 'You: ' : '') + item.lastMessage.content
                        : 'No messages yet'}
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
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <Text style={styles.headerSubtitle}>
                    {conversations.reduce((acc, c) => acc + c.unreadCount, 0)} unread
                </Text>
            </View>
            <FlatList
                data={conversations}
                renderItem={renderConversation}
                keyExtractor={(item) => item.booking_id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No messages yet</Text>
                        <Text style={styles.emptyText}>Start a conversation by booking a session</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    listContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
    convCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    avatar: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarUnread: { borderWidth: 2, borderColor: '#45D0FF' },
    avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    convContent: { flex: 1 },
    convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    convName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    convNameUnread: { fontWeight: FontWeight.bold },
    convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
    convSport: { fontSize: FontSize.xs, color: '#45D0FF', marginTop: 2 },
    convMessage: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 4 },
    convMessageUnread: { color: '#FFFFFF' },
    unreadBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#45D0FF', justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },
    unreadText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#0A0D14' },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
