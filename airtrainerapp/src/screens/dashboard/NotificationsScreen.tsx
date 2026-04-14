import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator,
    Modal, ScrollView, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, NotificationRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, EmptyState, LoadingScreen, Button } from '../../components/ui';

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    NEW_REQUEST_NEARBY: { icon: 'location', color: Colors.primary, bg: Colors.primaryGlow },
    BOOKING_CONFIRMED: { icon: 'checkmark-circle', color: Colors.primary, bg: Colors.primaryGlow },
    BOOKING_CANCELLED: { icon: 'close-circle', color: Colors.error, bg: Colors.errorLight },
    BOOKING_COMPLETED: { icon: 'trophy', color: Colors.primary, bg: Colors.primaryGlow },
    PAYMENT_RECEIVED: { icon: 'cash', color: Colors.success, bg: Colors.successLight },
    REVIEW_RECEIVED: { icon: 'star', color: Colors.primary, bg: Colors.primaryGlow },
    VERIFICATION_UPDATE: { icon: 'shield-checkmark', color: Colors.primary, bg: Colors.primaryGlow },
    SUBSCRIPTION_EXPIRING: { icon: 'warning', color: Colors.warning, bg: Colors.warningLight },
    MESSAGE_RECEIVED: { icon: 'chatbubble', color: Colors.primary, bg: Colors.primaryGlow },
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

function getDateGroup(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const notifDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (notifDate.getTime() === today.getTime()) return 'Today';
    if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return 'Earlier';
}

type GroupedNotifications = { title: string; data: NotificationRow[] }[];

function groupNotifications(notifications: NotificationRow[]): GroupedNotifications {
    const groups: Record<string, NotificationRow[]> = {};
    const order = ['Today', 'Yesterday', 'Earlier'];

    for (const n of notifications) {
        const group = getDateGroup(n.created_at);
        if (!groups[group]) groups[group] = [];
        groups[group].push(n);
    }

    return order
        .filter((key) => groups[key]?.length > 0)
        .map((key) => ({ title: key, data: groups[key] }));
}

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
                            const { error } = await supabase
                                .from('notifications')
                                .delete()
                                .eq('user_id', user.id);

                            if (error) {
                                console.error('Supabase delete error:', error);
                                await supabase
                                    .from('notifications')
                                    .update({ read: true })
                                    .eq('user_id', user.id);
                                Alert.alert('Note', 'Notifications were marked as read instead of deleted.');
                            }

                            setNotifications([]);
                        } catch (err) {
                            console.error('Failed to clear notifications:', err);
                            Alert.alert('Error', 'Could not clear notifications. Please try again.');
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

    const unreadCount = notifications.filter((n) => !n.read).length;
    const grouped = groupNotifications(notifications);

    const renderNotification = (item: NotificationRow, index: number) => {
        const config = NOTIF_ICONS[item.type] || { icon: 'notifications', color: Colors.textSecondary, bg: Colors.surface };

        return (
            <Animated.View key={item.id} entering={FadeInDown.duration(200).delay(index * 25)}>
                <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => markAsRead(item.id)}
                    accessibilityLabel={`Notification: ${item.title}`}
                >
                    <Card
                        style={{
                            ...styles.notifCard,
                            ...(!item.read ? styles.notifCardUnread : {}),
                        }}
                    >
                        <View style={styles.notifRow}>
                            {/* Icon circle colored by type */}
                            <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                                <Ionicons name={config.icon as any} size={20} color={config.color} />
                            </View>
                            <View style={styles.notifContent}>
                                <View style={styles.notifTitleRow}>
                                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.notifTime}>{formatTime(item.created_at)}</Text>
                                </View>
                                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                                {isOfferNotification(item.type) && user?.role === 'athlete' && getOfferIdFromNotification(item) && (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.viewOfferButton,
                                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                        ]}
                                        onPress={() => handleViewOffer(item)}
                                        accessibilityLabel="View Offer"
                                    >
                                        <Ionicons name="eye-outline" size={14} color={Colors.textInverse} />
                                        <Text style={styles.viewOfferButtonText}>View Offer</Text>
                                    </Pressable>
                                )}
                            </View>
                            {/* Unread dot indicator */}
                            {!item.read && <View style={styles.unreadDot} />}
                        </View>
                    </Card>
                </Pressable>
            </Animated.View>
        );
    };

    if (isLoading) {
        return <LoadingScreen message="Loading notifications..." />;
    }

    return (
        <ScreenWrapper scrollable={false}>
            <ScreenHeader
                title="Notifications"
                subtitle={`${unreadCount} unread`}
                onBack={() => navigation.goBack()}
                rightAction={
                    notifications.length > 0
                        ? { icon: 'trash-outline', onPress: clearAllNotifications }
                        : undefined
                }
                rightAction2={
                    unreadCount > 0
                        ? { icon: 'checkmark-done-outline', onPress: markAllAsRead }
                        : undefined
                }
            />

            <FlatList
                data={grouped}
                keyExtractor={(item) => item.title}
                renderItem={({ item: group }) => (
                    <View style={styles.groupSection}>
                        {/* Date group header */}
                        <View style={styles.groupHeader}>
                            <View style={styles.groupHeaderLine} />
                            <Text style={styles.groupHeaderText}>{group.title}</Text>
                            <View style={styles.groupHeaderLine} />
                        </View>
                        {group.data.map((notif, idx) => renderNotification(notif, idx))}
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="notifications-off-outline"
                        title="No notifications"
                        description="You're all caught up!"
                    />
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
                            <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: Spacing.huge }} />
                        ) : selectedOffer ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Training Offer</Text>
                                    <Pressable
                                        onPress={() => setOfferModalVisible(false)}
                                        accessibilityLabel="Close"
                                        style={({ pressed }) => [
                                            styles.modalCloseBtn,
                                            pressed && { opacity: 0.7 },
                                        ]}
                                    >
                                        <Ionicons name="close" size={24} color={Colors.textSecondary} />
                                    </Pressable>
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
                                        <Badge
                                            label={selectedOffer.status === 'accepted' ? 'Accepted' : 'Declined'}
                                            color={selectedOffer.status === 'accepted' ? Colors.success : Colors.error}
                                            bgColor={selectedOffer.status === 'accepted' ? Colors.successLight : Colors.errorLight}
                                            size="md"
                                            dot
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.offerActions}>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                title="Decline Offer"
                                                onPress={() => handleDeclineOffer(selectedOffer)}
                                                variant="danger"
                                                icon="close"
                                                loading={actionLoading}
                                                disabled={actionLoading}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                title="Accept Offer"
                                                onPress={() => handleAcceptOffer(selectedOffer)}
                                                variant="primary"
                                                icon="checkmark"
                                                loading={actionLoading}
                                                disabled={actionLoading}
                                            />
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: Spacing.huge,
    },

    // Group sections - notifications grouped by date
    groupSection: {
        marginBottom: Spacing.md,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xs,
    },
    groupHeaderLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    groupHeaderText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    notifCard: {
        marginBottom: Spacing.sm,
    },
    notifCardUnread: {
        backgroundColor: Colors.primaryMuted,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    notifRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    // Icon circle colored by type
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    notifContent: {
        flex: 1,
    },
    notifTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    notifTitle: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginRight: Spacing.sm,
    },
    notifTitleUnread: {
        fontWeight: FontWeight.bold,
    },
    notifBody: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    notifTime: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    // Unread dot indicator
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
        marginLeft: Spacing.sm,
        marginTop: Spacing.xs,
    },
    viewOfferButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primary,
        gap: Spacing.xs,
        minHeight: 44,
    },
    viewOfferButtonText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textInverse,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xxl,
    },
    modalCard: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    modalCloseBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    offerDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    offerLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    offerValue: {
        fontSize: FontSize.sm,
        color: Colors.text,
        fontWeight: FontWeight.semibold,
        textAlign: 'right',
        maxWidth: '60%',
    },
    statusBadgeContainer: {
        alignItems: 'center',
        marginTop: Spacing.xxl,
    },
    offerActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.xxl,
    },
});
