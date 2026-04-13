import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';

type BookingWithUsers = BookingRow & {
    athlete: UserRow;
    trainer: UserRow;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    pending:    { color: '#0A0D14', bg: '#ffab00',           icon: 'time-outline',             label: 'Pending' },
    confirmed:  { color: '#0A0D14', bg: '#45D0FF',           icon: 'checkmark-circle-outline', label: 'Confirmed' },
    completed:  { color: '#0A0D14', bg: Colors.success,      icon: 'trophy-outline',           label: 'Completed' },
    cancelled:  { color: '#fff',    bg: Colors.error,        icon: 'close-circle-outline',     label: 'Cancelled' },
    no_show:    { color: '#fff',    bg: '#6b6b7b',           icon: 'alert-circle-outline',     label: 'No Show' },
    disputed:   { color: '#fff',    bg: Colors.error,        icon: 'warning-outline',          label: 'Disputed' },
};

type FilterTab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
];

export default function BookingsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<BookingWithUsers[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');

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

    const getCountForTab = (tab: FilterTab): number => {
        if (tab === 'all') return bookings.length;
        return bookings.filter((b) => b.status === tab).length;
    };

    const getFilteredBookings = (): BookingWithUsers[] => {
        if (activeTab === 'all') return bookings;
        return bookings.filter((b) => b.status === activeTab);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const getInitials = (u: UserRow | undefined): string => {
        if (!u) return '??';
        return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase();
    };

    const getEmptyMessage = (): string => {
        switch (activeTab) {
            case 'pending':   return 'No pending bookings right now.';
            case 'confirmed': return 'No confirmed sessions yet.';
            case 'completed': return 'No completed sessions yet.';
            case 'cancelled': return 'No cancelled bookings.';
            default:          return 'Book a session to get started!';
        }
    };

    const renderBookingCard = ({ item }: { item: BookingWithUsers }) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const otherUser = user?.role === 'trainer' ? item.athlete : item.trainer;

        return (
            <TouchableOpacity
                style={styles.bookingCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
            >
                <View style={styles.cardTop}>
                    {/* Date block */}
                    <View style={styles.dateContainer}>
                        <Text style={styles.dateDay}>{new Date(item.scheduled_at).getDate()}</Text>
                        <Text style={styles.dateMonth}>
                            {new Date(item.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                    </View>

                    <View style={styles.cardContent}>
                        {/* Sport + status badge */}
                        <View style={styles.sportRow}>
                            <Text style={styles.sportLabel}>{item.sport}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                                <Ionicons name={config.icon as any} size={12} color={config.color} />
                                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                            </View>
                        </View>

                        {/* Other user with initials */}
                        <View style={styles.personRow}>
                            <View style={styles.personAvatar}>
                                <Text style={styles.personAvatarText}>{getInitials(otherUser)}</Text>
                            </View>
                            <Text style={styles.personName}>
                                {otherUser?.first_name} {otherUser?.last_name}
                            </Text>
                        </View>

                        {/* Info: time, duration, price */}
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

                {/* Date line beneath card content */}
                <View style={styles.dateLine}>
                    <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.dateLineText}>{formatDate(item.scheduled_at)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const filtered = getFilteredBookings();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Bookings</Text>
                <Text style={styles.headerSubtitle}>{bookings.length} total sessions</Text>
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabsWrapper}>
                <FlatList
                    data={TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(t) => t.key}
                    contentContainerStyle={styles.tabsContainer}
                    renderItem={({ item: tab }) => {
                        const count = getCountForTab(tab.key);
                        const isActive = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                style={[styles.tab, isActive && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                    {tab.label}
                                </Text>
                                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                                        {count}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {/* Bookings List */}
            <FlatList
                data={filtered}
                renderItem={renderBookingCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No bookings</Text>
                        <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { paddingHorizontal: Layout.screenPadding, paddingTop: Layout.headerTopPadding, paddingBottom: Spacing.lg },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

    // Tabs
    tabsWrapper: { marginBottom: Spacing.md },
    tabsContainer: { paddingHorizontal: Layout.screenPadding, gap: Spacing.sm },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    tabActive: {
        backgroundColor: Colors.surface,
        borderColor: Colors.border,
        borderBottomWidth: 2,
        borderBottomColor: '#45D0FF',
    },
    tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    tabTextActive: { color: '#45D0FF' },
    tabCount: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    tabCountActive: { backgroundColor: 'rgba(69,208,255,0.15)' },
    tabCountText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary },
    tabCountTextActive: { color: '#45D0FF' },

    // List
    listContent: { paddingHorizontal: Layout.screenPadding, paddingBottom: 100 },

    // Booking Card
    bookingCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    cardTop: { flexDirection: 'row', gap: Spacing.lg },
    dateContainer: {
        width: 50,
        height: 56,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateDay: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    dateMonth: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: '#45D0FF', textTransform: 'uppercase' },
    cardContent: { flex: 1 },
    sportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sportLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        gap: 4,
    },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

    // Person row with avatar
    personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
    personAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    personAvatarText: { fontSize: 9, fontWeight: FontWeight.bold, color: '#45D0FF' },
    personName: { fontSize: FontSize.sm, color: Colors.textSecondary },

    // Info row
    infoRow: { flexDirection: 'row', gap: Spacing.lg },
    infoItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    infoText: { fontSize: FontSize.xs, color: Colors.textTertiary },

    // Date line
    dateLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    dateLineText: { fontSize: FontSize.xs, color: Colors.textTertiary },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
