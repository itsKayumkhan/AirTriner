import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, NotificationRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    NEW_REQUEST_NEARBY: { icon: 'location', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
    BOOKING_CONFIRMED: { icon: 'checkmark-circle', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
    BOOKING_CANCELLED: { icon: 'close-circle', color: Colors.error, bg: Colors.errorLight },
    BOOKING_COMPLETED: { icon: 'trophy', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
    PAYMENT_RECEIVED: { icon: 'cash', color: Colors.success, bg: Colors.successLight },
    REVIEW_RECEIVED: { icon: 'star', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
    VERIFICATION_UPDATE: { icon: 'shield-checkmark', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
    SUBSCRIPTION_EXPIRING: { icon: 'warning', color: Colors.warning, bg: Colors.warningLight },
    MESSAGE_RECEIVED: { icon: 'chatbubble', color: '#45D0FF', bg: 'rgba(69,208,255,0.1)' },
};

export default function NotificationsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to new notifications in real-time
        if (!user) return;
        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const newNotif = payload.new as NotificationRow;
                setNotifications((prev) => [newNotif, ...prev]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchNotifications, user]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderNotification = ({ item }: { item: NotificationRow }) => {
        const config = NOTIF_ICONS[item.type] || { icon: 'notifications', color: Colors.textSecondary, bg: Colors.surface };

        return (
            <TouchableOpacity
                style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                activeOpacity={0.7}
                onPress={() => markAsRead(item.id)}
            >
                <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon as any} size={20} color={config.color} />
                </View>
                <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                    <Text style={styles.notifTime}>{formatTime(item.created_at)}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>
            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No notifications</Text>
                        <Text style={styles.emptyText}>You're all caught up!</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingTop: 56, paddingBottom: Spacing.lg },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    markAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#45D0FF' },
    listContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 40 },
    notifCard: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.lg, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    notifCardUnread: { backgroundColor: 'rgba(69,208,255,0.04)', borderLeftWidth: 3, borderLeftColor: '#45D0FF' },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF', marginBottom: 2 },
    notifTitleUnread: { fontWeight: FontWeight.bold },
    notifBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
    notifTime: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#45D0FF', marginLeft: Spacing.sm, marginTop: 4 },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
