import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
    Modal, ScrollView, Alert, Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import {
    ScreenWrapper, ScreenHeader, Card, Badge, EmptyState, LoadingScreen, Button, Avatar,
} from '../../components/ui';
import { Config } from '../../lib/config';
import { formatSportName } from '../../lib/format';

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | string;

interface TrainerLite {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
}

interface OfferRow {
    id: string;
    trainer_id: string;
    athlete_id: string;
    sport: string | null;
    price: number | null;
    session_length_min: number | null;
    message: string | null;
    proposed_dates: any;
    status: OfferStatus;
    expires_at: string | null;
    created_at: string;
    trainer: TrainerLite | null;
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: Colors.warning, bg: Colors.warningLight, label: 'Pending' },
    accepted: { color: Colors.success, bg: Colors.successLight, label: 'Accepted' },
    declined: { color: Colors.error, bg: Colors.errorLight, label: 'Declined' },
    expired: { color: Colors.textTertiary, bg: Colors.surface, label: 'Expired' },
};

const STATUS_GROUP_ORDER: { key: string; title: string; statuses: string[] }[] = [
    { key: 'active', title: 'Active', statuses: ['pending'] },
    { key: 'booked', title: 'Accepted', statuses: ['accepted'] },
    { key: 'history', title: 'History', statuses: ['declined', 'expired'] },
];

function getProposedAt(offer: OfferRow): string | null {
    const pd = offer.proposed_dates;
    if (!pd) return null;
    if (Array.isArray(pd?.sessions) && pd.sessions[0]?.date) return pd.sessions[0].date;
    if (pd?.scheduledAt) return pd.scheduledAt;
    if (pd?.camp?.dates?.[0]) return pd.camp.dates[0];
    return null;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

function timeUntil(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = d - now;
    if (diff <= 0) return 'expired';
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m left`;
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
}

export default function AthleteOffersScreen({ navigation }: any) {
    const { user } = useAuth();
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<OfferRow | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchOffers = useCallback(async () => {
        if (!user) return;
        try {
            try {
                await fetch(`${Config.appUrl}/api/offers/expire`, { method: 'POST' });
            } catch {}

            const { data, error } = await supabase
                .from('training_offers')
                .select('*, trainer:users!training_offers_trainer_id_fkey(id, first_name, last_name, avatar_url)')
                .eq('athlete_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOffers((data || []) as OfferRow[]);
        } catch (err) {
            console.error('Error fetching offers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOffers();
        if (!user) return;
        const channel = supabase
            .channel(`athlete-offers-${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'training_offers',
                filter: `athlete_id=eq.${user.id}`,
            }, () => { fetchOffers(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchOffers, user]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOffers();
        setRefreshing(false);
    };

    const grouped = useMemo(() => {
        return STATUS_GROUP_ORDER
            .map((g) => ({
                ...g,
                data: offers.filter((o) => g.statuses.includes(o.status)),
            }))
            .filter((g) => g.data.length > 0);
    }, [offers]);

    const pendingCount = offers.filter((o) => o.status === 'pending').length;

    const openOffer = (offer: OfferRow) => {
        setSelectedOffer(offer);
        setModalVisible(true);
    };

    const handleAccept = async (offer: OfferRow) => {
        if (!user) return;
        setActionLoading(true);
        try {
            const { data: athleteUser } = await supabase
                .from('users')
                .select('email')
                .eq('id', user.id)
                .single();

            const apiUrl = Config.appUrl;
            if (!apiUrl) throw new Error('App URL not configured');

            const res = await fetch(`${apiUrl}/api/stripe/create-offer-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: offer.id,
                    athleteId: user.id,
                    athleteEmail: athleteUser?.email,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create payment');

            await Linking.openURL(data.url);

            setModalVisible(false);
            Alert.alert(
                'Payment Required',
                'You will be redirected to complete payment. The booking will be created after payment is confirmed.'
            );
        } catch (err: any) {
            console.error('Error accepting offer:', err);
            Alert.alert('Error', err?.message || 'Could not accept the offer. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDecline = async (offer: OfferRow) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('training_offers')
                .update({ status: 'declined' })
                .eq('id', offer.id);
            if (error) throw error;

            await supabase.from('notifications').insert({
                user_id: offer.trainer_id,
                type: 'OFFER_DECLINED',
                title: 'Offer Declined',
                body: 'Your training offer was declined',
                data: { offerId: offer.id, offer_id: offer.id },
                read: false,
            });

            setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: 'declined' } : o)));
            setSelectedOffer({ ...offer, status: 'declined' });
            Alert.alert('Offer Declined');
        } catch (err) {
            console.error('Error declining offer:', err);
            Alert.alert('Error', 'Could not decline the offer. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewBooking = async (offer: OfferRow) => {
        try {
            const { data } = await supabase
                .from('notifications')
                .select('data')
                .eq('user_id', user?.id)
                .contains('data', { offer_id: offer.id })
                .order('created_at', { ascending: false })
                .limit(20);

            const bookingId = (data || [])
                .map((n: any) => (n.data?.booking_id || n.data?.bookingId))
                .find((id: any) => Boolean(id));

            setModalVisible(false);
            if (bookingId) {
                navigation.navigate('BookingDetail', { bookingId });
            } else {
                navigation.navigate('Bookings');
            }
        } catch {
            navigation.navigate('Bookings');
        }
    };

    const renderOffer = (offer: OfferRow, index: number) => {
        const status = STATUS_BADGE[offer.status] || STATUS_BADGE.expired;
        const trainerName = offer.trainer
            ? `${offer.trainer.first_name || ''} ${offer.trainer.last_name || ''}`.trim() || 'Trainer'
            : 'Trainer';
        const proposedAt = getProposedAt(offer);
        const expiresIn = offer.status === 'pending' ? timeUntil(offer.expires_at) : null;

        return (
            <Animated.View key={offer.id} entering={FadeInDown.duration(200).delay(index * 25)}>
                <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => openOffer(offer)}
                    accessibilityLabel={`Offer from ${trainerName}`}
                >
                    <Card style={styles.offerCard}>
                        <View style={styles.offerHeader}>
                            <Avatar
                                uri={offer.trainer?.avatar_url}
                                name={trainerName}
                                size={44}
                            />
                            <View style={styles.offerHeaderText}>
                                <Text style={styles.offerTrainer} numberOfLines={1}>{trainerName}</Text>
                                <Text style={styles.offerSport} numberOfLines={1}>
                                    {offer.sport ? formatSportName(offer.sport) : 'General training'}
                                </Text>
                            </View>
                            <Badge
                                label={status.label}
                                color={status.color}
                                bgColor={status.bg}
                                size="sm"
                                dot
                            />
                        </View>

                        <View style={styles.offerMetaRow}>
                            <View style={styles.offerMetaItem}>
                                <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.offerMetaText} numberOfLines={1}>{formatDateTime(proposedAt)}</Text>
                            </View>
                            <View style={styles.offerMetaItem}>
                                <Ionicons name="cash-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.offerMetaText}>${offer.price ?? '—'}</Text>
                            </View>
                            {offer.session_length_min ? (
                                <View style={styles.offerMetaItem}>
                                    <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
                                    <Text style={styles.offerMetaText}>{offer.session_length_min}m</Text>
                                </View>
                            ) : null}
                        </View>

                        {expiresIn && (
                            <View style={styles.expiryRow}>
                                <Ionicons name="hourglass-outline" size={12} color={Colors.warning} />
                                <Text style={styles.expiryText}>{expiresIn}</Text>
                            </View>
                        )}

                        {offer.status === 'pending' && (
                            <View style={styles.cardActions}>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Decline"
                                        onPress={() => handleDecline(offer)}
                                        variant="secondary"
                                        size="sm"
                                        icon="close"
                                        disabled={actionLoading}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Accept & Pay"
                                        onPress={() => handleAccept(offer)}
                                        variant="primary"
                                        size="sm"
                                        icon="checkmark"
                                        disabled={actionLoading}
                                    />
                                </View>
                            </View>
                        )}

                        {offer.status === 'accepted' && (
                            <View style={styles.cardActions}>
                                <Button
                                    title="View Booking"
                                    onPress={() => handleViewBooking(offer)}
                                    variant="primary"
                                    size="sm"
                                    icon="calendar"
                                />
                            </View>
                        )}
                    </Card>
                </Pressable>
            </Animated.View>
        );
    };

    if (isLoading) {
        return <LoadingScreen message="Loading offers..." />;
    }

    return (
        <ScreenWrapper scrollable={false}>
            <ScreenHeader
                title="My Offers"
                subtitle={pendingCount > 0 ? `${pendingCount} pending` : 'All offers from trainers'}
                onBack={() => navigation.goBack()}
            />

            <FlatList
                data={grouped}
                keyExtractor={(g) => g.key}
                renderItem={({ item: group }) => (
                    <View style={styles.groupSection}>
                        <View style={styles.groupHeader}>
                            <View style={styles.groupHeaderLine} />
                            <Text style={styles.groupHeaderText}>{group.title} ({group.data.length})</Text>
                            <View style={styles.groupHeaderLine} />
                        </View>
                        {group.data.map((o, i) => renderOffer(o, i))}
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
                        icon="pricetag-outline"
                        title="No offers yet"
                        description="Browse trainers to request a session."
                        actionLabel="Find a Coach"
                        onAction={() => navigation.navigate('Tabs', { screen: 'Discover' })}
                    />
                }
            />

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {selectedOffer ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Training Offer</Text>
                                    <Pressable
                                        onPress={() => setModalVisible(false)}
                                        accessibilityLabel="Close"
                                        style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                                    >
                                        <Ionicons name="close" size={24} color={Colors.textSecondary} />
                                    </Pressable>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Trainer</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedOffer.trainer?.first_name} {selectedOffer.trainer?.last_name}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Sport</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedOffer.sport ? formatSportName(selectedOffer.sport) : 'General'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Price</Text>
                                    <Text style={styles.detailValue}>${selectedOffer.price}</Text>
                                </View>
                                {selectedOffer.session_length_min != null && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Session Length</Text>
                                        <Text style={styles.detailValue}>{selectedOffer.session_length_min} min</Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Proposed Date</Text>
                                    <Text style={styles.detailValue}>{formatDateTime(getProposedAt(selectedOffer))}</Text>
                                </View>
                                {selectedOffer.message ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Message</Text>
                                        <Text style={[styles.detailValue, { flex: 1 }]}>{selectedOffer.message}</Text>
                                    </View>
                                ) : null}
                                {selectedOffer.proposed_dates?.camp?.description ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>
                                            Camp{selectedOffer.proposed_dates.camp.name ? ` — ${selectedOffer.proposed_dates.camp.name}` : ''}
                                        </Text>
                                        <Text style={[styles.detailValue, { flex: 1 }]}>
                                            {selectedOffer.proposed_dates.camp.description}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedOffer.status === 'pending' ? (
                                    <View style={styles.modalActions}>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                title="Decline"
                                                onPress={() => handleDecline(selectedOffer)}
                                                variant="danger"
                                                icon="close"
                                                loading={actionLoading}
                                                disabled={actionLoading}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                title="Accept & Pay"
                                                onPress={() => handleAccept(selectedOffer)}
                                                variant="primary"
                                                icon="checkmark"
                                                loading={actionLoading}
                                                disabled={actionLoading}
                                            />
                                        </View>
                                    </View>
                                ) : selectedOffer.status === 'accepted' ? (
                                    <View style={styles.modalActions}>
                                        <Button
                                            title="View Booking"
                                            onPress={() => handleViewBooking(selectedOffer)}
                                            variant="primary"
                                            icon="calendar"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.statusBadgeContainer}>
                                        <Badge
                                            label={(STATUS_BADGE[selectedOffer.status] || STATUS_BADGE.expired).label}
                                            color={(STATUS_BADGE[selectedOffer.status] || STATUS_BADGE.expired).color}
                                            bgColor={(STATUS_BADGE[selectedOffer.status] || STATUS_BADGE.expired).bg}
                                            size="md"
                                            dot
                                        />
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

    offerCard: {
        marginBottom: Spacing.sm,
        gap: Spacing.md,
    },
    offerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    offerHeaderText: {
        flex: 1,
    },
    offerTrainer: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    offerSport: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    offerMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.lg,
    },
    offerMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    offerMetaText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    expiryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    expiryText: {
        fontSize: FontSize.xs,
        color: Colors.warning,
        fontWeight: FontWeight.semibold,
    },
    cardActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
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
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    detailLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    detailValue: {
        fontSize: FontSize.sm,
        color: Colors.text,
        fontWeight: FontWeight.semibold,
        textAlign: 'right',
        maxWidth: '60%',
    },
    modalActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.xxl,
    },
    statusBadgeContainer: {
        alignItems: 'center',
        marginTop: Spacing.xxl,
    },
});
