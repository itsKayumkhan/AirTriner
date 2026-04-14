import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
    FadeInDown,
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow } from '../../lib/supabase';
import {
    Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout, Shadows,
    getStatusColor, getStatusBg, getStatusLabel, getInitials, formatTime, formatDate,
} from '../../theme';
import {
    ScreenWrapper, Card, Avatar, EmptyState, LoadingScreen, Badge,
} from '../../components/ui';

type BookingWithOtherUser = BookingRow & {
    other_user?: { first_name: string; last_name: string };
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Pulsing Dot Component ── */
function PulsingDot() {
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.pulsingDot, animStyle]} />
    );
}

export default function AthleteDashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
    });
    const [recentBookings, setRecentBookings] = useState<BookingWithOtherUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('athlete_id', user.id)
                .order('scheduled_at', { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter(
                    (b) => b.status === 'confirmed' && b.scheduled_at > now
                ).length,
                completedBookings: allBookings.filter(
                    (b) => b.status === 'completed'
                ).length,
                totalSpent: allBookings
                    .filter((b) => b.status === 'completed')
                    .reduce((s, b) => s + Number(b.total_paid), 0),
            });

            const recentIds = allBookings.slice(0, 5);
            const otherUserIds = recentIds.map((b) => b.trainer_id);

            if (otherUserIds.length > 0) {
                const { data: otherUsers } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .in('id', otherUserIds);

                const usersMap = new Map(
                    (otherUsers || []).map((u: any) => [u.id, u])
                );
                setRecentBookings(
                    recentIds.map((b) => ({
                        ...b,
                        other_user: usersMap.get(b.trainer_id) as
                            | { first_name: string; last_name: string }
                            | undefined,
                    }))
                );
            } else {
                setRecentBookings([]);
            }
        } catch (error) {
            console.error('Error fetching athlete dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
        setRefreshing(false);
    };

    const upcomingSession = recentBookings.find(
        (b) => b.status === 'confirmed' && new Date(b.scheduled_at) > new Date()
    );

    if (isLoading) {
        return <LoadingScreen message="Loading dashboard..." />;
    }

    const firstName = user?.firstName || '';
    const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).toUpperCase();

    const statCards = [
        { label: 'Total Bookings', value: stats.totalBookings, icon: 'calendar-outline' as const, color: Colors.info },
        { label: 'Upcoming', value: stats.upcomingBookings, icon: 'time-outline' as const, color: Colors.warning },
        { label: 'Completed', value: stats.completedBookings, icon: 'checkmark-circle-outline' as const, color: Colors.success },
        { label: 'Total Spent', value: `$${stats.totalSpent.toFixed(0)}`, icon: 'wallet-outline' as const, color: Colors.primary },
    ];

    const quickActions = [
        { label: 'Find Trainer', icon: 'search-outline' as const, screen: 'Discover', color: Colors.primary },
        { label: 'My Bookings', icon: 'calendar-outline' as const, screen: 'Bookings', color: Colors.info },
        { label: 'Payments', icon: 'wallet-outline' as const, screen: 'Earnings', color: Colors.success },
        { label: 'Family Accounts', icon: 'people-outline' as const, screen: 'SubAccounts', color: Colors.warning },
    ];

    const scheduledDate = upcomingSession
        ? new Date(upcomingSession.scheduled_at)
        : null;

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={onRefresh}>

            {/* ───────── 1. GREETING HEADER ───────── */}
            <Animated.View entering={FadeInDown.delay(0).duration(250)} style={styles.header}>
                <Pressable
                    style={styles.headerIconBtn}
                    onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                    accessibilityLabel="Open menu"
                >
                    <Ionicons name="menu-outline" size={22} color={Colors.text} />
                </Pressable>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerDate}>{todayStr}</Text>
                    <Text style={styles.headerGreeting}>
                        Hey, <Text style={styles.headerName}>{firstName}</Text>
                    </Text>
                </View>

                <Pressable
                    style={styles.headerIconBtn}
                    onPress={() => navigation.navigate('Notifications')}
                    accessibilityLabel="Notifications"
                >
                    <Ionicons name="notifications-outline" size={22} color={Colors.text} />
                    <View style={styles.notifDot} />
                </Pressable>
            </Animated.View>

            {/* ───────── 2. NEXT SESSION HERO CARD ───────── */}
            <Animated.View entering={FadeInDown.delay(30).duration(250)} style={styles.section}>
                {upcomingSession && scheduledDate ? (
                    <View style={styles.heroCard}>
                        <View style={styles.heroAccent} />
                        <View style={styles.heroContent}>
                            {/* Top label row */}
                            <View style={styles.heroLabelRow}>
                                <PulsingDot />
                                <Text style={styles.heroLabel}>NEXT SESSION</Text>
                            </View>

                            {/* Trainer info */}
                            <View style={styles.heroTrainerRow}>
                                <Avatar
                                    name={
                                        upcomingSession.other_user
                                            ? `${upcomingSession.other_user.first_name} ${upcomingSession.other_user.last_name}`
                                            : undefined
                                    }
                                    size={40}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.heroTrainerName}>
                                        {upcomingSession.other_user
                                            ? `${upcomingSession.other_user.first_name} ${upcomingSession.other_user.last_name}`
                                            : 'Unknown'}
                                    </Text>
                                    <View style={styles.sportTag}>
                                        <Text style={styles.sportTagText}>
                                            {upcomingSession.sport}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Large date/time display */}
                            <View style={styles.heroDateTimeRow}>
                                <View>
                                    <Text style={styles.heroDay}>
                                        {scheduledDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                                    </Text>
                                    <Text style={styles.heroDateBig}>
                                        {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                                <View style={styles.heroTimeBadge}>
                                    <Ionicons name="time-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.heroTimeText}>
                                        {formatTime(upcomingSession.scheduled_at)}
                                    </Text>
                                </View>
                            </View>

                            {/* View details button */}
                            <Pressable
                                style={styles.heroDetailBtn}
                                onPress={() =>
                                    navigation.navigate('BookingDetail', { bookingId: upcomingSession.id })
                                }
                                accessibilityLabel="View session details"
                            >
                                <Text style={styles.heroDetailBtnText}>View Details</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    <View style={styles.heroCardEmpty}>
                        <Ionicons name="calendar-outline" size={28} color={Colors.textTertiary} />
                        <Text style={styles.heroEmptyText}>No upcoming sessions</Text>
                        <Pressable
                            style={styles.heroFindBtn}
                            onPress={() => navigation.navigate('Discover')}
                            accessibilityLabel="Find a trainer"
                        >
                            <Text style={styles.heroFindBtnText}>Find Trainer</Text>
                        </Pressable>
                    </View>
                )}
            </Animated.View>

            {/* ───────── 3. STATS GRID (2x2) ───────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(250)} style={styles.section}>
                <View style={styles.statsGrid}>
                    {statCards.map((card, i) => (
                        <View
                            key={i}
                            style={[
                                styles.statCard,
                                { backgroundColor: card.color + '08' },
                            ]}
                        >
                            <View style={[styles.statIconCircle, { backgroundColor: card.color + '18' }]}>
                                <Ionicons name={card.icon} size={16} color={card.color} />
                            </View>
                            <Text style={styles.statValue}>{card.value}</Text>
                            <Text style={styles.statLabel}>{card.label}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>

            {/* ───────── 4. RECENT SESSIONS LIST ───────── */}
            <Animated.View entering={FadeInDown.delay(30).duration(250)} style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Recent Sessions</Text>
                    <Pressable onPress={() => navigation.navigate('Bookings')}>
                        <Text style={styles.sectionLink}>View all &rarr;</Text>
                    </Pressable>
                </View>

                {recentBookings.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon="file-tray-outline"
                            title="No sessions yet"
                            description="Book a session with a trainer to get started."
                            actionLabel="Book a session"
                            onAction={() => navigation.navigate('Discover')}
                        />
                    </Card>
                ) : (
                    <View style={styles.sessionsCard}>
                        {recentBookings.map((booking, index) => {
                            const name = booking.other_user
                                ? `${booking.other_user.first_name} ${booking.other_user.last_name}`
                                : 'Unknown';

                            return (
                                <Pressable
                                    key={booking.id}
                                    style={({ pressed }) => [
                                        styles.sessionRow,
                                        index < recentBookings.length - 1 && styles.sessionRowBorder,
                                        pressed && styles.sessionRowPressed,
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('BookingDetail', { bookingId: booking.id })
                                    }
                                    accessibilityLabel={`Session with ${name}`}
                                >
                                    <Avatar name={name} size={32} />
                                    <View style={styles.sessionInfo}>
                                        <Text style={styles.sessionName} numberOfLines={1}>{name}</Text>
                                        <Text style={styles.sessionSport}>{booking.sport}</Text>
                                    </View>
                                    <View style={styles.sessionRight}>
                                        <Text style={styles.sessionDate}>{formatDate(booking.scheduled_at)}</Text>
                                        <Text style={styles.sessionTime}>{formatTime(booking.scheduled_at)}</Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            { backgroundColor: getStatusColor(booking.status) },
                                        ]}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </Animated.View>

            {/* ───────── 5. QUICK ACTIONS GRID ───────── */}
            <Animated.View entering={FadeInDown.delay(120).duration(250)} style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickGrid}>
                    {quickActions.map((action) => (
                        <Pressable
                            key={action.screen}
                            style={({ pressed }) => [
                                styles.quickCard,
                                pressed && styles.quickCardPressed,
                            ]}
                            onPress={() => navigation.navigate(action.screen)}
                            accessibilityLabel={action.label}
                        >
                            <View style={[styles.quickIconCircle, { backgroundColor: action.color + '18' }]}>
                                <Ionicons name={action.icon} size={20} color={action.color} />
                            </View>
                            <Text style={styles.quickLabel}>{action.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </Animated.View>

            {/* ───────── 6. INSIGHT CARD ───────── */}
            <Animated.View entering={FadeInDown.delay(50).duration(250)} style={styles.section}>
                <View style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                        <View style={styles.insightIconBg}>
                            <Ionicons name="trending-up-outline" size={14} color={Colors.primary} />
                        </View>
                        <Text style={styles.insightLabel}>INSIGHT</Text>
                    </View>
                    <Text style={styles.insightText}>
                        {stats.completedBookings > 0
                            ? `You've completed ${stats.completedBookings} session${stats.completedBookings > 1 ? 's' : ''}. Consistency is the key to progress.`
                            : 'Book your first session to start your training journey.'}
                    </Text>
                    <Pressable
                        style={styles.insightAction}
                        onPress={() => navigation.navigate('Discover')}
                        accessibilityLabel="Browse trainers"
                    >
                        <Text style={styles.insightActionText}>Browse trainers &rarr;</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </ScreenWrapper>
    );
}

/* ══════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    /* ── Section wrapper ── */
    section: {
        marginBottom: Layout.sectionGap,
    },

    /* ── 1. Header ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Layout.sectionGap,
        gap: Spacing.md,
    },
    headerIconBtn: {
        width: 42,
        height: 42,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerDate: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    headerGreeting: {
        fontSize: 26,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    headerName: {
        color: Colors.primary,
    },
    notifDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.error,
    },

    /* ── 2. Hero Card ── */
    heroCard: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.medium,
    },
    heroAccent: {
        width: 4,
        backgroundColor: Colors.primary,
    },
    heroContent: {
        flex: 1,
        padding: Spacing.lg,
    },
    heroLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    pulsingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
    },
    heroLabel: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        letterSpacing: 2,
    },
    heroTrainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    heroTrainerName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 4,
    },
    sportTag: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.primaryMuted,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.xs,
    },
    sportTagText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
        textTransform: 'capitalize',
    },
    heroDateTimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    heroDay: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        letterSpacing: 1,
    },
    heroDateBig: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    heroTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primaryMuted,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
    },
    heroTimeText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    heroDetailBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    heroDetailBtnText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    heroCardEmpty: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xxl,
        alignItems: 'center',
        gap: Spacing.md,
    },
    heroEmptyText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
    heroFindBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        marginTop: Spacing.xs,
    },
    heroFindBtnText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textInverse,
    },

    /* ── 3. Stats Grid ── */
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        minWidth: '46%' as any,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
    },
    statIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    statValue: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },

    /* ── 4. Recent Sessions ── */
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    sectionLink: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
        marginBottom: Spacing.md,
    },
    sessionsCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    sessionRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sessionRowPressed: {
        backgroundColor: Colors.glass,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    sessionSport: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textTransform: 'capitalize',
        marginTop: 2,
    },
    sessionRight: {
        alignItems: 'flex-end',
    },
    sessionDate: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    sessionTime: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    /* ── 5. Quick Actions Grid ── */
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    quickCard: {
        flex: 1,
        minWidth: '46%' as any,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    quickCardPressed: {
        backgroundColor: Colors.glassLight,
    },
    quickIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },

    /* ── 6. Insight Card ── */
    insightCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    insightIconBg: {
        width: 24,
        height: 24,
        borderRadius: BorderRadius.xs,
        backgroundColor: Colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    insightLabel: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        letterSpacing: 2,
    },
    insightText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    insightAction: {
        marginTop: Spacing.lg,
    },
    insightActionText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
