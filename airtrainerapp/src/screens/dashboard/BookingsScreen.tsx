import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type BookingWithUsers = BookingRow & {
    athlete: UserRow;
    trainer: UserRow;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    pending: { color: '#0A0D14', bg: '#ffab00', icon: 'time-outline', label: 'Pending' },
    confirmed: { color: '#0A0D14', bg: '#45D0FF', icon: 'checkmark-circle-outline', label: 'Confirmed' },
    completed: { color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)', icon: 'trophy-outline', label: 'Completed' },
    cancelled: { color: '#fff', bg: Colors.error, icon: 'close-circle-outline', label: 'Cancelled' },
    no_show: { color: '#fff', bg: Colors.error, icon: 'alert-circle-outline', label: 'No Show' },
    disputed: { color: '#0A0D14', bg: '#ffab00', icon: 'warning-outline', label: 'Disputed' },
};

const TABS = ['Upcoming', 'Past', 'All'];

export default function BookingsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<BookingWithUsers[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('Upcoming');

    const fetchBookings = useCallback(async () => {
        if (!user) return;
        try {
            const idColumn = user.role === 'trainer' ? 'trainer_id' : 'athlete_id';
            const { data, error } = await supabase
                .from('bookings')
                .select('*, athlete:users!bookings_athlete_id_fkey(*), trainer:users!bookings_trainer_id_fkey(*)')
                .eq(idColumn, user.id)
                .order('scheduled_at', { ascending: false });

            if (error) throw error;
            setBookings((data || []) as BookingWithUsers[]);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchBookings(); }, [fetchBookings]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchBookings();
        setRefreshing(false);
    };

    const getFilteredBookings = () => {
        const now = new Date();
        switch (activeTab) {
            case 'Upcoming':
                return bookings.filter((b) => new Date(b.scheduled_at) > now && b.status !== 'cancelled');
            case 'Past':
                return bookings.filter((b) => new Date(b.scheduled_at) <= now || b.status === 'completed');
            default:
                return bookings;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const handleCalendarExport = (booking: BookingWithUsers) => {
        const otherUser = user?.role === 'trainer' ? booking.athlete : booking.trainer;
        const otherUserName = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim();

        const start = new Date(booking.scheduled_at);
        const end = new Date(start.getTime() + (booking.duration_minutes || 60) * 60 * 1000);

        const formatGCalDate = (d: Date) =>
            d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

        const startStr = formatGCalDate(start);
        const endStr = formatGCalDate(end);

        const title = encodeURIComponent(`${booking.sport} Training Session`);
        const details = encodeURIComponent(`Training with ${otherUserName}`);

        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
        Linking.openURL(url);
    };

    const renderBookingCard = ({ item }: { item: BookingWithUsers }) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const otherUser = user?.role === 'trainer' ? item.athlete : item.trainer;

        return (
            <TouchableOpacity style={styles.bookingCard} activeOpacity={0.7} onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}>
                <View style={styles.cardTop}>
                    <View style={styles.dateContainer}>
                        <Text style={styles.dateDay}>{new Date(item.scheduled_at).getDate()}</Text>
                        <Text style={styles.dateMonth}>
                            {new Date(item.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                    </View>
                    <View style={styles.cardContent}>
                        <View style={styles.sportRow}>
                            <Text style={styles.sportLabel}>{item.sport}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                                <Ionicons name={config.icon as any} size={12} color={config.color} />
                                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                            </View>
                        </View>
                        <Text style={styles.personName}>
                            {user?.role === 'trainer' ? 'Athlete' : 'Trainer'}: {otherUser?.first_name} {otherUser?.last_name}
                        </Text>
                        <View style={styles.infoRow}>
                            <View style={styles.infoItem}>
                                <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.infoText}>{formatTime(item.scheduled_at)}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons name="hourglass-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.infoText}>{item.duration_minutes}min</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons name="cash-outline" size={14} color="#45D0FF" />
                                <Text style={[styles.infoText, { color: '#45D0FF' }]}>${Number(item.total_paid).toFixed(0)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Calendar export for completed bookings */}
                {item.status === 'completed' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleCalendarExport(item)}>
                            <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                            <Text style={styles.actionBtnSecondaryText}>Calendar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Action buttons for pending/confirmed */}
                {(item.status === 'pending' || item.status === 'confirmed') && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.actionBtnSecondary}
                            onPress={() => navigation.navigate('Chat', {
                                bookingId: item.id,
                                otherUser: otherUser,
                            })}
                        >
                            <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                            <Text style={styles.actionBtnSecondaryText}>Message</Text>
                        </TouchableOpacity>
                        {item.status === 'confirmed' && (
                            <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleCalendarExport(item)}>
                                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                                <Text style={styles.actionBtnSecondaryText}>Calendar</Text>
                            </TouchableOpacity>
                        )}
                        {item.status === 'pending' && user?.role === 'trainer' && (
                            <TouchableOpacity
                                style={styles.actionBtnPrimary}
                                onPress={async () => {
                                    try {
                                        const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', item.id);
                                        if (error) throw error;
                                        // Notify athlete
                                        if (user) {
                                            await createNotification({
                                                userId: item.athlete_id,
                                                type: 'BOOKING_CONFIRMED',
                                                title: 'Booking Confirmed! ✅',
                                                body: `${user.firstName} ${user.lastName} has confirmed your ${item.sport} session.`,
                                                data: { bookingId: item.id },
                                            });
                                        }
                                        fetchBookings();
                                    } catch (e: any) {
                                        Alert.alert('Error', e.message);
                                    }
                                }}
                            >
                                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                <Text style={styles.actionBtnPrimaryText}>Accept</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    const filtered = getFilteredBookings();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Bookings</Text>
                <Text style={styles.headerSubtitle}>{bookings.length} total sessions</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filtered}
                renderItem={renderBookingCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No bookings</Text>
                        <Text style={styles.emptyText}>
                            {activeTab === 'Upcoming'
                                ? 'Book a session to get started!'
                                : 'Your booking history will appear here'}
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
    header: { paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.xxl, gap: Spacing.sm, marginBottom: Spacing.lg },
    tab: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    tabActive: { backgroundColor: Colors.surface, borderColor: Colors.border, borderBottomWidth: 2, borderBottomColor: '#45D0FF' },
    tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    tabTextActive: { color: '#45D0FF' },
    listContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
    bookingCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
    cardTop: { flexDirection: 'row', gap: Spacing.lg },
    dateContainer: { width: 50, height: 56, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center' },
    dateDay: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    dateMonth: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: '#45D0FF', textTransform: 'uppercase' },
    cardContent: { flex: 1 },
    sportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sportLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: BorderRadius.pill, gap: 4 },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    personName: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6 },
    infoRow: { flexDirection: 'row', gap: Spacing.lg },
    infoItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    infoText: { fontSize: FontSize.xs, color: Colors.textTertiary },
    actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    actionBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
    actionBtnSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#45D0FF' },
    actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: BorderRadius.md, backgroundColor: '#45D0FF', gap: 6 },
    actionBtnPrimaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#0A0D14' },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
