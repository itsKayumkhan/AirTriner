import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import Animated, { FadeInUp, Layout as ReanimatedLayout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import {
    ScreenWrapper,
    Avatar,
    EmptyState,
    LoadingScreen,
} from '../../components/ui';

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

/** Map status to the date-tile and top-accent color */
const STATUS_ACCENT: Record<string, string> = {
    pending:   '#ffab00',
    confirmed: '#45D0FF',
    completed: Colors.success,
    cancelled: Colors.error,
    no_show:   '#6b6b7b',
    disputed:  Colors.error,
};

type FilterTab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
];

/* ─────────────────── stat mini-card config ─────────────────── */
const STAT_CARDS: { key: 'confirmed' | 'completed' | 'pending'; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; tintBg: string }[] = [
    { key: 'confirmed', label: 'Upcoming',  icon: 'calendar-outline',           tint: '#45D0FF',      tintBg: 'rgba(69,208,255,0.10)' },
    { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline',     tint: Colors.success, tintBg: 'rgba(16,185,129,0.10)' },
    { key: 'pending',   label: 'Pending',   icon: 'time-outline',               tint: '#ffab00',      tintBg: 'rgba(255,171,0,0.10)' },
];

export default function BookingsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<BookingWithUsers[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');

    /* ── data fetching ── */
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

    /* ── helpers ── */
    const getCountForTab = (tab: FilterTab): number => {
        if (tab === 'all') return bookings.length;
        return bookings.filter((b) => b.status === tab).length;
    };

    const getFilteredBookings = (): BookingWithUsers[] => {
        if (activeTab === 'all') return bookings;
        return bookings.filter((b) => b.status === activeTab);
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const getEmptyIcon = (): keyof typeof Ionicons.glyphMap => {
        switch (activeTab) {
            case 'pending':   return 'time-outline';
            case 'confirmed': return 'checkmark-circle-outline';
            case 'completed': return 'trophy-outline';
            case 'cancelled': return 'close-circle-outline';
            default:          return 'calendar-outline';
        }
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

    /* ────────────────────────── render helpers ────────────────────────── */

    /** Stats summary row */
    const renderStatsRow = () => (
        <View style={styles.statsRow}>
            {STAT_CARDS.map((s) => {
                const count = getCountForTab(s.key);
                return (
                    <View key={s.key} style={[styles.statCard, { backgroundColor: s.tintBg }]}>
                        <View style={[styles.statAccent, { backgroundColor: s.tint }]} />
                        <View style={styles.statBody}>
                            <Ionicons name={s.icon} size={18} color={s.tint} />
                            <Text style={[styles.statCount, { color: s.tint }]}>{count}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );

    /** Pill-style tab filter */
    const renderPillTabs = () => (
        <View style={styles.pillRow}>
            {TABS.map((t) => {
                const isActive = activeTab === t.key;
                const count = getCountForTab(t.key);
                return (
                    <Pressable
                        key={t.key}
                        onPress={() => setActiveTab(t.key)}
                        style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                        accessibilityLabel={`${t.label} filter, ${count} bookings`}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                            {t.label}
                        </Text>
                        <View style={[styles.pillBadge, isActive ? styles.pillBadgeActive : styles.pillBadgeInactive]}>
                            <Text style={[styles.pillBadgeText, isActive && styles.pillBadgeTextActive]}>
                                {count}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );

    /** Single booking card */
    const renderBookingCard = ({ item, index }: { item: BookingWithUsers; index: number }) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const accent = STATUS_ACCENT[item.status] || '#ffab00';
        const otherUser = user?.role === 'trainer' ? item.athlete : item.trainer;
        const otherName = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim();
        const d = new Date(item.scheduled_at);
        const dayNum = d.getDate();
        const monthStr = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

        return (
            <Animated.View
                entering={FadeInUp.delay(index * 30).duration(250)}
                layout={ReanimatedLayout}
            >
                <Pressable
                    onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
                    style={({ pressed }) => [
                        styles.card,
                        pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] },
                    ]}
                    accessibilityLabel={`${item.sport} booking with ${otherName}, ${config.label}`}
                    accessibilityRole="button"
                >
                    {/* top accent bar */}
                    <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />

                    <View style={styles.cardInner}>
                        {/* LEFT: date tile */}
                        <View style={[styles.dateTile, { backgroundColor: accent + '18' }]}>
                            <Text style={[styles.dateTileDay, { color: accent }]}>{dayNum}</Text>
                            <Text style={[styles.dateTileMonth, { color: accent }]}>{monthStr}</Text>
                        </View>

                        {/* CENTER */}
                        <View style={styles.cardCenter}>
                            <Text style={styles.sportName} numberOfLines={1}>{item.sport}</Text>

                            {/* person row */}
                            <View style={styles.personRow}>
                                <Avatar uri={otherUser?.avatar_url} name={otherName} size={24} />
                                <Text style={styles.personName} numberOfLines={1}>{otherName}</Text>
                            </View>

                            {/* time + duration */}
                            <View style={styles.metaRow}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
                                    <Text style={styles.metaText}>{formatTime(item.scheduled_at)}</Text>
                                </View>
                                <View style={styles.metaDot} />
                                <View style={styles.metaItem}>
                                    <Ionicons name="hourglass-outline" size={13} color={Colors.textTertiary} />
                                    <Text style={styles.metaText}>{item.duration_minutes} min</Text>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT: price */}
                        <View style={styles.priceWrap}>
                            <Text style={styles.priceDollar}>$</Text>
                            <Text style={styles.priceAmount}>{Number(item.total_paid).toFixed(0)}</Text>
                        </View>
                    </View>

                    {/* bottom separator + view details */}
                    <View style={styles.cardFooter}>
                        <View style={styles.cardFooterSep} />
                        <View style={styles.cardFooterContent}>
                            <View style={[styles.statusDot, { backgroundColor: accent }]} />
                            <Text style={[styles.statusText, { color: accent }]}>{config.label}</Text>
                            <View style={{ flex: 1 }} />
                            <Text style={styles.viewDetails}>View Details</Text>
                            <Ionicons name="arrow-forward" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
                        </View>
                    </View>
                </Pressable>
            </Animated.View>
        );
    };

    /* ────────────────────────── loading state ────────────────────────── */
    if (isLoading) {
        return <LoadingScreen message="Loading bookings..." />;
    }

    const filtered = getFilteredBookings();

    /* ────────────────────────── main render ────────────────────────── */
    return (
        <ScreenWrapper scrollable={false} noPadding>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Bookings</Text>
                    <Text style={styles.headerSubtitle}>{bookings.length} total sessions</Text>
                </View>
                <Pressable
                    style={styles.filterBtn}
                    accessibilityLabel="Open filters"
                    accessibilityRole="button"
                >
                    <Ionicons name="options-outline" size={22} color={Colors.text} />
                </Pressable>
            </View>

            {/* STATS ROW */}
            {renderStatsRow()}

            {/* PILL TABS */}
            {renderPillTabs()}

            {/* LIST */}
            <FlatList
                data={filtered}
                renderItem={renderBookingCard}
                keyExtractor={(item) => item.id}
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
                        icon={getEmptyIcon()}
                        title="No bookings"
                        description={getEmptyMessage()}
                    />
                }
            />
        </ScreenWrapper>
    );
}

/* ═══════════════════════════ STYLES ═══════════════════════════ */

const styles = StyleSheet.create({
    /* ── Header ── */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    filterBtn: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* ── Stats row ── */
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        minHeight: 62,
    },
    statAccent: {
        width: 3,
    },
    statBody: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        gap: 2,
    },
    statCount: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
    },
    statLabel: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ── Pill tabs ── */
    pillRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        gap: 6,
        minHeight: 44,
    },
    pillActive: {
        backgroundColor: Colors.primary,
    },
    pillInactive: {
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    pillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
    pillTextActive: {
        color: Colors.textInverse,
        fontWeight: FontWeight.semibold,
    },
    pillBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    pillBadgeActive: {
        backgroundColor: 'rgba(10,13,20,0.25)',
    },
    pillBadgeInactive: {
        backgroundColor: Colors.glassLight,
    },
    pillBadgeText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },
    pillBadgeTextActive: {
        color: '#fff',
    },

    /* ── List ── */
    listContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 100,
        gap: 12,
    },

    /* ── Card ── */
    card: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.medium,
    },
    cardAccentBar: {
        height: 4,
        width: '100%',
    },
    cardInner: {
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.md,
        alignItems: 'center',
    },

    /* date tile */
    dateTile: {
        width: 54,
        height: 60,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateTileDay: {
        fontSize: 24,
        fontWeight: FontWeight.bold,
        lineHeight: 28,
    },
    dateTileMonth: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    /* center content */
    cardCenter: {
        flex: 1,
        gap: 4,
    },
    sportName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    personName: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        flex: 1,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: Colors.textTertiary,
    },
    metaText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    /* price */
    priceWrap: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    priceDollar: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
        marginTop: 2,
    },
    priceAmount: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },

    /* footer */
    cardFooter: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    cardFooterSep: {
        height: 1,
        backgroundColor: Colors.border,
        marginBottom: Spacing.sm,
    },
    cardFooterContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
    viewDetails: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.primary,
    },
});
