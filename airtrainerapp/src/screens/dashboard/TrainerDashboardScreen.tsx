import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow } from '../../lib/supabase';
import {
    Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout, Shadows,
    getStatusColor, getStatusBg, getStatusLabel, formatTime, formatDate,
} from '../../theme';
import {
    ScreenWrapper, Card, SectionHeader,
    Badge, EmptyState, LoadingScreen,
} from '../../components/ui';

type BookingWithOtherUser = BookingRow & {
    other_user?: { first_name: string; last_name: string };
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function TrainerDashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
        pendingBookings: 0,
        totalEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
    });
    const [recentBookings, setRecentBookings] = useState<BookingWithOtherUser[]>([]);
    const [requireVerification, setRequireVerification] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Morning';
        if (hour < 17) return 'Afternoon';
        return 'Evening';
    };

    const getTodayDate = () => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    };

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            const { data: platformData } = await supabase
                .from('platform_settings')
                .select('require_trainer_verification')
                .single();
            if (platformData) {
                setRequireVerification(platformData.require_trainer_verification);
            }

            const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('trainer_id', user.id)
                .order('scheduled_at', { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            const { data: reviews } = await supabase
                .from('reviews')
                .select('*')
                .eq('reviewee_id', user.id);

            const avgRating =
                reviews && reviews.length > 0
                    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
                    : 0;

            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter(
                    (b) => b.status === 'confirmed' && b.scheduled_at > now
                ).length,
                pendingBookings: allBookings.filter(
                    (b) => b.status === 'pending'
                ).length,
                completedBookings: allBookings.filter(
                    (b) => b.status === 'completed'
                ).length,
                totalEarnings: allBookings
                    .filter((b) => b.status === 'completed')
                    .reduce((s, b) => s + Number(b.price), 0),
                averageRating: Math.round(avgRating * 10) / 10,
                totalReviews: reviews?.length || 0,
            });

            const recentIds = allBookings.slice(0, 5);
            const otherUserIds = recentIds.map((b) => b.athlete_id);

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
                        other_user: usersMap.get(b.athlete_id) as
                            | { first_name: string; last_name: string }
                            | undefined,
                    }))
                );
            } else {
                setRecentBookings([]);
            }
        } catch (error) {
            console.error('Error fetching trainer dashboard:', error);
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

    const upcomingSessions = recentBookings.filter(
        (b) => b.status === 'confirmed' && new Date(b.scheduled_at) > new Date()
    ).slice(0, 3);

    const isVerificationPending =
        requireVerification &&
        user?.trainerProfile &&
        !user.trainerProfile.is_verified;

    if (isLoading) {
        return <LoadingScreen message="Loading dashboard..." />;
    }

    const responseRate = stats.totalBookings > 0
        ? Math.min(100, Math.round(((stats.completedBookings + stats.upcomingBookings) / stats.totalBookings) * 100))
        : 0;

    // ── Stats grid data ──
    const gridStats = [
        { label: 'Active Bookings', value: `${stats.upcomingBookings}`, icon: 'calendar' as const, color: Colors.info, bg: Colors.infoLight },
        { label: 'Pending', value: `${stats.pendingBookings}`, icon: 'hourglass' as const, color: Colors.warning, bg: Colors.warningLight },
        { label: 'Completed', value: `${stats.completedBookings}`, icon: 'checkmark-circle' as const, color: Colors.success, bg: Colors.successLight },
        { label: 'Revenue', value: `$${stats.totalEarnings.toFixed(0)}`, icon: 'cash' as const, color: Colors.primary, bg: Colors.primaryGlow },
        { label: 'Rating', value: stats.averageRating > 0 ? `${stats.averageRating}` : '\u2014', icon: 'star' as const, color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
        { label: 'Response Rate', value: `${responseRate}%`, icon: 'flash' as const, color: Colors.info, bg: Colors.infoLight },
    ];

    // ── Quick actions (2x2) ──
    const quickActions = [
        { label: 'Availability', icon: 'time' as const, screen: 'Availability', color: Colors.primary, bg: Colors.primaryGlow },
        { label: 'Offers', icon: 'pricetag' as const, screen: 'Bookings', color: Colors.warning, bg: Colors.warningLight },
        { label: 'Earnings', icon: 'wallet' as const, screen: 'Earnings', color: Colors.success, bg: Colors.successLight },
        { label: 'Reviews', icon: 'star' as const, screen: 'Reviews', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
    ];

    // ── Performance insight ──
    const getInsightText = () => {
        if (stats.completedBookings >= 10 && stats.averageRating >= 4.5) {
            return `Outstanding! ${stats.completedBookings} sessions completed with a ${stats.averageRating} rating. You're a top-performing trainer.`;
        }
        if (stats.completedBookings > 0) {
            return `You've completed ${stats.completedBookings} session${stats.completedBookings > 1 ? 's' : ''} so far. Keep your availability updated to attract more athletes and grow your revenue.`;
        }
        return 'Complete your profile and set your availability to start receiving bookings from athletes in your area.';
    };

    const getDateTile = (dateStr: string) => {
        const d = new Date(dateStr);
        return {
            day: d.getDate().toString(),
            month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        };
    };

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={onRefresh}>

            {/* ─── 1. HEADER ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(0)} style={styles.header}>
                <Pressable
                    onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                    style={styles.headerBtn}
                    accessibilityLabel="Open menu"
                >
                    <Ionicons name="menu" size={24} color={Colors.text} />
                </Pressable>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerDate}>{getTodayDate()}</Text>
                    <Text style={styles.headerGreeting}>
                        Hey, {user?.firstName || 'Trainer'}{' '}
                        <Text style={styles.waveEmoji}>{getGreeting() === 'Morning' ? '\u2600\uFE0F' : getGreeting() === 'Afternoon' ? '\uD83D\uDC4B' : '\uD83C\uDF19'}</Text>
                    </Text>
                </View>

                <Pressable
                    onPress={() => navigation.navigate('Notifications')}
                    style={styles.headerBtn}
                    accessibilityLabel="Notifications"
                >
                    <Ionicons name="notifications-outline" size={22} color={Colors.text} />
                </Pressable>
            </Animated.View>

            {/* ─── Verification Banner ─── */}
            {isVerificationPending && (
                <Animated.View entering={FadeInDown.duration(250).delay(80)}>
                    <View style={styles.verifyBanner}>
                        <View style={styles.verifyIconWrap}>
                            <Ionicons name="shield-half-outline" size={20} color="#92400E" />
                        </View>
                        <View style={styles.verifyContent}>
                            <Text style={styles.verifyTitle}>Profile verification pending</Text>
                            <Text style={styles.verifyDesc}>
                                Your profile is hidden until verified.
                            </Text>
                        </View>
                        <Pressable
                            style={styles.verifyCta}
                            onPress={() => navigation.navigate('EditProfile')}
                        >
                            <Text style={styles.verifyCtaText}>Complete</Text>
                            <Ionicons name="arrow-forward" size={14} color="#92400E" />
                        </Pressable>
                    </View>
                </Animated.View>
            )}

            {/* ─── 2. EARNINGS HERO CARD ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(120)} style={styles.heroWrapper}>
                <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroGradient}
                >
                    {/* Decorative circles */}
                    <View style={styles.heroDecor1} />
                    <View style={styles.heroDecor2} />

                    <View style={styles.heroBody}>
                        <Text style={styles.heroLabel}>Total Earnings</Text>
                        <Text style={styles.heroAmount}>
                            ${stats.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                        </Text>

                        <View style={styles.heroStatsRow}>
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatValue}>{stats.completedBookings}</Text>
                                <Text style={styles.heroStatLabel}>Sessions</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatValue}>{stats.pendingBookings}</Text>
                                <Text style={styles.heroStatLabel}>Pending</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatValue}>
                                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '\u2014'}
                                </Text>
                                <Text style={styles.heroStatLabel}>Rating</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* ─── 3. STATS GRID (3x2) ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.statsGrid}>
                {gridStats.map((stat, i) => (
                    <View key={i} style={styles.statsGridItem}>
                        <View style={[styles.statsIconCircle, { backgroundColor: stat.bg }]}>
                            <Ionicons name={stat.icon} size={18} color={stat.color} />
                        </View>
                        <Text style={styles.statsValue}>{stat.value}</Text>
                        <Text style={styles.statsLabel} numberOfLines={1}>{stat.label}</Text>
                    </View>
                ))}
            </Animated.View>

            {/* ─── 4. UPCOMING SESSIONS ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.section}>
                <SectionHeader
                    title="Upcoming Sessions"
                    actionLabel="View all"
                    onAction={() => navigation.navigate('Bookings')}
                />

                {upcomingSessions.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon="calendar-outline"
                            title="No upcoming sessions"
                            description="Your confirmed sessions will show up here."
                        />
                    </Card>
                ) : (
                    <View style={styles.sessionsList}>
                        {upcomingSessions.map((booking, index) => {
                            const name = booking.other_user
                                ? `${booking.other_user.first_name} ${booking.other_user.last_name}`
                                : 'Unknown';
                            const tile = getDateTile(booking.scheduled_at);

                            return (
                                <AnimatedPressable
                                    key={booking.id}
                                    entering={FadeInDown.duration(250).delay(60 + index * 30)}
                                    style={styles.sessionCard}
                                    onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                                    accessibilityLabel={`Session with ${name}`}
                                >
                                    {/* Date tile */}
                                    <View style={styles.dateTile}>
                                        <Text style={styles.dateTileDay}>{tile.day}</Text>
                                        <Text style={styles.dateTileMonth}>{tile.month}</Text>
                                    </View>

                                    {/* Center info */}
                                    <View style={styles.sessionCenter}>
                                        <Text style={styles.sessionName} numberOfLines={1}>{name}</Text>
                                        <Text style={styles.sessionMeta}>
                                            {booking.sport} {'\u00B7'} {booking.duration_minutes}min
                                        </Text>
                                    </View>

                                    {/* Right: time + badge */}
                                    <View style={styles.sessionRight}>
                                        <Text style={styles.sessionTime}>
                                            {formatTime(booking.scheduled_at)}
                                        </Text>
                                        <Badge
                                            label={getStatusLabel(booking.status)}
                                            color={getStatusColor(booking.status)}
                                            bgColor={getStatusBg(booking.status)}
                                            dot
                                        />
                                    </View>
                                </AnimatedPressable>
                            );
                        })}
                    </View>
                )}
            </Animated.View>

            {/* ─── 5. QUICK ACTIONS (2x2) ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(450)} style={styles.section}>
                <SectionHeader title="Quick Actions" />
                <View style={styles.actionsGrid}>
                    {quickActions.map((action, i) => (
                        <Pressable
                            key={action.screen + i}
                            style={styles.actionCard}
                            onPress={() => navigation.navigate(action.screen)}
                            accessibilityLabel={action.label}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: action.bg }]}>
                                <Ionicons name={action.icon} size={22} color={action.color} />
                            </View>
                            <Text style={styles.actionLabel}>{action.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </Animated.View>

            {/* ─── 6. PERFORMANCE INSIGHT ─── */}
            <Animated.View entering={FadeInDown.duration(250).delay(550)} style={styles.section}>
                <Card variant="elevated">
                    <View style={styles.insightRow}>
                        <View style={styles.insightIconCircle}>
                            <Ionicons name="trending-up" size={18} color={Colors.primary} />
                        </View>
                        <Text style={styles.insightTitle}>Performance Insight</Text>
                    </View>
                    <Text style={styles.insightText}>{getInsightText()}</Text>
                    <Pressable
                        style={styles.insightLink}
                        onPress={() => navigation.navigate('Earnings')}
                        accessibilityLabel="View analytics"
                    >
                        <Text style={styles.insightLinkText}>View analytics</Text>
                        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                    </Pressable>
                </Card>
            </Animated.View>

        </ScreenWrapper>
    );
}

/* ════════════════════════════════════════════════════════════ */
/*                        STYLES                               */
/* ════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    /* ── Header ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerDate: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    headerGreeting: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    waveEmoji: {
        fontSize: FontSize.md,
    },

    /* ── Verification Banner ── */
    verifyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    verifyIconWrap: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.sm,
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifyContent: {
        flex: 1,
    },
    verifyTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#FBBF24',
    },
    verifyDesc: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    verifyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        gap: 4,
    },
    verifyCtaText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: '#FBBF24',
    },

    /* ── Earnings Hero ── */
    heroWrapper: {
        marginBottom: Layout.sectionGap,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        // Subtle glow border
        borderWidth: 1,
        borderColor: 'rgba(69, 208, 255, 0.2)',
    },
    heroGradient: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        overflow: 'hidden',
        position: 'relative',
    },
    heroDecor1: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.06)',
        top: -40,
        right: -20,
    },
    heroDecor2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.04)',
        bottom: -20,
        left: 20,
    },
    heroBody: {
        alignItems: 'center',
    },
    heroLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: Spacing.xs,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    heroAmount: {
        fontSize: 36,
        fontWeight: FontWeight.heavy,
        color: '#FFFFFF',
        marginBottom: Spacing.xl,
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        width: '100%',
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    heroStatLabel: {
        fontSize: FontSize.xxs,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroStatDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },

    /* ── Stats Grid ── */
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Layout.sectionGap,
    },
    statsGridItem: {
        width: '31%',
        flexGrow: 1,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
    },
    statsIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    statsValue: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 2,
    },
    statsLabel: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
        textAlign: 'center',
    },

    /* ── Section ── */
    section: {
        marginBottom: Layout.sectionGap,
    },

    /* ── Upcoming Sessions ── */
    sessionsList: {
        gap: Spacing.sm,
    },
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    dateTile: {
        width: 48,
        height: 52,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: 'rgba(69, 208, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateTileDay: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
        lineHeight: 24,
    },
    dateTileMonth: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.primaryLight,
        letterSpacing: 1,
    },
    sessionCenter: {
        flex: 1,
    },
    sessionName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginBottom: 2,
    },
    sessionMeta: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textTransform: 'capitalize',
    },
    sessionRight: {
        alignItems: 'flex-end',
        gap: Spacing.xs,
    },
    sessionTime: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },

    /* ── Quick Actions 2x2 ── */
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    actionCard: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    actionIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textAlign: 'center',
    },

    /* ── Performance Insight ── */
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    insightIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    insightTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    insightText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    insightLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.lg,
    },
    insightLinkText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
