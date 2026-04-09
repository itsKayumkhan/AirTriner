import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
    Modal, ScrollView, Alert,
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
    TRAINING_OFFER: { icon: 'pricetag', color: Colors.warning, bg: Colors.warningLight },
    NEW_OFFER: { icon: 'pricetag', color: Colors.warning, bg: Colors.warningLight },
    OFFER_ACCEPTED: { icon: 'checkmark-circle', color: Colors.success, bg: Colors.successLight },
    OFFER_DECLINED: { icon: 'close-circle', color: Colors.error, bg: Colors.errorLight },
};

const isOfferNotification = (type: string) =>
    type.includes('TRAINING_OFFER') || type.includes('NEW_OFFER');

const getOfferIdFromNotification = (item: NotificationRow): string | null => {
    if (!item.data) return null;
    const d = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
    return d?.offerId || d?.offer_id || null;
};

export default function NotificationsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [offerModalVisible, setOfferModalVisible] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<any>(null);
    const [offerLoading, setOfferLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

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

    const clearAllNotifications = async () => {
        if (!user) return;
        Alert.alert(
            'Clear All Notifications',
            'This will permanently delete all your notifications. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await supabase.from('notifications').delete().eq('user_id', user.id);
                            setNotifications([]);
                        } catch (err) {
                            console.error('Failed to clear notifications:', err);
                        }
                    },
                },
            ]
        );
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

    const handleViewOffer = async (notif: NotificationRow) => {
        const offerId = getOfferIdFromNotification(notif);
        if (!offerId) return;
        markAsRead(notif.id);
        setOfferModalVisible(true);
        setOfferLoading(true);
        try {
            const { data, error } = await supabase
                .from('training_offers')
                .select('*, trainer:users!training_offers_trainer_id_fkey(first_name, last_name)')
                .eq('id', offerId)
                .single();
            if (error) throw error;
            setSelectedOffer(data);
        } catch (err) {
            console.error('Error fetching offer:', err);
            Alert.alert('Error', 'Could not load offer details.');
            setOfferModalVisible(false);
        } finally {
            setOfferLoading(false);
        }
    };

    const handleAcceptOffer = async (offer: any) => {
        if (!user) return;
        setActionLoading(true);
        try {
            const { data: settings } = await supabase
                .from('platform_settings')
                .select('platform_fee_percentage')
                .single();
            const feePercent = settings?.platform_fee_percentage || 3;
            const platformFee = offer.price * (feePercent / 100);

            await supabase.from('training_offers').update({ status: 'accepted' }).eq('id', offer.id);

            await supabase.from('bookings').insert({
                athlete_id: user.id,
                trainer_id: offer.trainer_id,
                sport: offer.sport || 'General',
                scheduled_at: offer.proposed_dates?.scheduledAt || new Date().toISOString(),
                duration_minutes: offer.session_length_min || 60,
                price: offer.price,
                platform_fee: platformFee,
                total_paid: offer.price + platformFee,
                status: 'pending',
                status_history: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Created from accepted offer' }],
            });

            await supabase.from('notifications').insert({
                user_id: offer.trainer_id,
                type: 'OFFER_ACCEPTED',
                title: 'Offer Accepted!',
                body: 'Your training offer has been accepted',
                data: { offerId: offer.id },
                read: false,
            });

            setSelectedOffer({ ...offer, status: 'accepted' });
            Alert.alert('Offer Accepted', 'A booking has been created. The trainer will confirm it.');
        } catch (err) {
            console.error('Error accepting offer:', err);
            Alert.alert('Error', 'Could not accept the offer. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeclineOffer = async (offer: any) => {
        setActionLoading(true);
        try {
            await supabase.from('training_offers').update({ status: 'declined' }).eq('id', offer.id);

            await supabase.from('notifications').insert({
                user_id: offer.trainer_id,
                type: 'OFFER_DECLINED',
                title: 'Offer Declined',
                body: 'Your training offer was declined',
                data: { offerId: offer.id },
                read: false,
            });

            setSelectedOffer({ ...offer, status: 'declined' });
            Alert.alert('Offer Declined');
        } catch (err) {
            console.error('Error declining offer:', err);
            Alert.alert('Error', 'Could not decline the offer. Please try again.');
        } finally {
            setActionLoading(false);
        }
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
                    {isOfferNotification(item.type) && user?.role === 'athlete' && getOfferIdFromNotification(item) && (
                        <TouchableOpacity
                            style={styles.viewOfferButton}
                            onPress={() => handleViewOffer(item)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="eye-outline" size={14} color="#fff" />
                            <Text style={styles.viewOfferButtonText}>View Offer</Text>
                        </TouchableOpacity>
                    )}
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
                <View style={styles.headerActions}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllAsRead}>
                            <Text style={styles.markAllText}>Mark all read</Text>
                        </TouchableOpacity>
                    )}
                    {notifications.length > 0 && (
                        <TouchableOpacity onPress={clearAllNotifications}>
                            <Text style={styles.clearAllText}>Clear all</Text>
                        </TouchableOpacity>
                    )}
                </View>
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

            {/* Offer Detail Modal */}
            <Modal
                visible={offerModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setOfferModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {offerLoading ? (
                            <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 40 }} />
                        ) : selectedOffer ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Training Offer</Text>
                                    <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.offerDetailRow}>
                                    <Text style={styles.offerLabel}>Trainer</Text>
                                    <Text style={styles.offerValue}>
                                        {selectedOffer.trainer?.first_name} {selectedOffer.trainer?.last_name}
                                    </Text>
                                </View>
                                <View style={styles.offerDetailRow}>
                                    <Text style={styles.offerLabel}>Sport</Text>
                                    <Text style={styles.offerValue}>{selectedOffer.sport || 'General'}</Text>
                                </View>
                                <View style={styles.offerDetailRow}>
                                    <Text style={styles.offerLabel}>Price</Text>
                                    <Text style={styles.offerValue}>${selectedOffer.price}</Text>
                                </View>
                                {selectedOffer.session_length_min != null && (
                                    <View style={styles.offerDetailRow}>
                                        <Text style={styles.offerLabel}>Session Length</Text>
                                        <Text style={styles.offerValue}>{selectedOffer.session_length_min} min</Text>
                                    </View>
                                )}
                                {selectedOffer.message ? (
                                    <View style={styles.offerDetailRow}>
                                        <Text style={styles.offerLabel}>Message</Text>
                                        <Text style={[styles.offerValue, { flex: 1 }]}>{selectedOffer.message}</Text>
                                    </View>
                                ) : null}
                                {selectedOffer.proposed_dates && (
                                    <View style={styles.offerDetailRow}>
                                        <Text style={styles.offerLabel}>Proposed Dates</Text>
                                        <Text style={styles.offerValue}>
                                            {typeof selectedOffer.proposed_dates === 'object' && selectedOffer.proposed_dates.scheduledAt
                                                ? new Date(selectedOffer.proposed_dates.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                : JSON.stringify(selectedOffer.proposed_dates)}
                                        </Text>
                                    </View>
                                )}

                                {selectedOffer.status === 'accepted' || selectedOffer.status === 'declined' ? (
                                    <View style={styles.statusBadgeContainer}>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: selectedOffer.status === 'accepted' ? Colors.successLight : Colors.errorLight },
                                        ]}>
                                            <Ionicons
                                                name={selectedOffer.status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                                                size={16}
                                                color={selectedOffer.status === 'accepted' ? Colors.success : Colors.error}
                                            />
                                            <Text style={[
                                                styles.statusBadgeText,
                                                { color: selectedOffer.status === 'accepted' ? Colors.success : Colors.error },
                                            ]}>
                                                {selectedOffer.status === 'accepted' ? 'Accepted' : 'Declined'}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.offerActions}>
                                        <TouchableOpacity
                                            style={[styles.offerActionBtn, styles.declineBtn]}
                                            onPress={() => handleDeclineOffer(selectedOffer)}
                                            disabled={actionLoading}
                                            activeOpacity={0.7}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="close" size={18} color="#fff" />
                                                    <Text style={styles.offerActionText}>Decline Offer</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.offerActionBtn, styles.acceptBtn]}
                                            onPress={() => handleAcceptOffer(selectedOffer)}
                                            disabled={actionLoading}
                                            activeOpacity={0.7}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                                    <Text style={styles.offerActionText}>Accept Offer</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    markAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#45D0FF' },
    clearAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
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

    // View Offer button on notification card
    viewOfferButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary, gap: 4 },
    viewOfferButtonText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#fff' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
    modalCard: { width: '100%', maxHeight: '80%', backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.glassBorder },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF' },

    // Offer detail rows
    offerDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
    offerLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
    offerValue: { fontSize: FontSize.sm, color: '#FFFFFF', fontWeight: FontWeight.semibold, textAlign: 'right', maxWidth: '60%' },

    // Status badge
    statusBadgeContainer: { alignItems: 'center', marginTop: Spacing.xxl },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, gap: 6 },
    statusBadgeText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },

    // Action buttons
    offerActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxl },
    offerActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: 6 },
    acceptBtn: { backgroundColor: Colors.success },
    declineBtn: { backgroundColor: Colors.error },
    offerActionText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#fff' },
});
