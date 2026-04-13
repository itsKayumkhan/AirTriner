import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type BookingWithOtherUser = BookingRow & {
    other_user?: { first_name: string; last_name: string };
};

export default function TrainerDashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const isSmallScreen = screenWidth < 380;
    const [stats, setStats] = useState({
        totalBookings: 0,
        upcomingBookings: 0,
        completedBookings: 0,
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

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            // Fetch platform settings (matching web dashboard page)
            const { data: platformData } = await supabase
                .from('platform_settings')
                .select('require_trainer_verification')
                .single();
            if (platformData) {
                setRequireVerification(platformData.require_trainer_verification);
            }

            // Fetch all bookings (matching web TrainerContext pattern)
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('trainer_id', user.id)
                .order('scheduled_at', { ascending: false });

            const allBookings = (bookings || []) as BookingRow[];
            const now = new Date().toISOString();

            // Fetch reviews (matching web TrainerContext pattern)
            const { data: reviews } = await supabase
                .from('reviews')
                .select('*')
                .eq('reviewee_id', user.id);

            const avgRating =
                reviews && reviews.length > 0
                    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
                    : 0;

            // Compute stats exactly as web does
            setStats({
                totalBookings: allBookings.length,
                upcomingBookings: allBookings.filter(
                    (b) => b.status === 'confirmed' && b.scheduled_at > now
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

            // Get recent 5 bookings with other user info (matching web pattern)
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

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return Colors.warning;
            case 'confirmed': return Colors.info;
            case 'completed': return Colors.success;
            case 'cancelled': return Colors.error;
            case 'no_show': return Colors.textTertiary;
            case 'disputed': return Colors.error;
            default: return Colors.warning;
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'pending': return Colors.warningLight;
            case 'confirmed': return Colors.infoLight;
            case 'completed': return Colors.successLight;
            case 'cancelled': return Colors.errorLight;
            case 'no_show': return 'rgba(107,107,123,0.1)';
            case 'disputed': return Colors.errorLight;
            default: return Colors.warningLight;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'Pending';
            case 'confirmed': return 'Confirmed';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            case 'no_show': return 'No Show';
            case 'disputed': return 'Disputed';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    const getInitials = (firstName?: string, lastName?: string) => {
        return (firstName?.[0] || '') + (lastName?.[0] || '');
    };

    // Next session: upcoming confirmed session (matching web logic)
    const upcomingSession = recentBookings.find(
        (b) => b.status === 'confirmed' && new Date(b.scheduled_at) > new Date()
    );

    const isVerificationPending =
        requireVerification &&
        user?.trainerProfile &&
        !user.trainerProfile.is_verified;

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const statCards = [
        { label: 'Total Sessions', value: `${stats.totalBookings}`, icon: 'pulse-outline' as const },
        { label: 'Upcoming', value: `${stats.upcomingBookings}`, icon: 'time-outline' as const },
        { label: 'Completed', value: `${stats.completedBookings}`, icon: 'checkmark-circle-outline' as const },
        { label: 'Earnings', value: `$${stats.totalEarnings.toFixed(0)}`, icon: 'wallet-outline' as const },
        { label: 'Avg Rating', value: stats.averageRating > 0 ? `${stats.averageRating}` : '\u2014', icon: 'star-outline' as const },
        { label: 'Reviews', value: `${stats.totalReviews}`, icon: 'chatbubble-outline' as const },
    ];

    const quickActions = [
        { label: 'Update Availability', icon: 'time-outline' as const, screen: 'Availability' },
        { label: 'View Bookings', icon: 'calendar-outline' as const, screen: 'Bookings' },
        { label: 'Earnings & Payouts', icon: 'wallet-outline' as const, screen: 'Earnings' },
        { label: 'Edit Profile', icon: 'person-outline' as const, screen: 'EditProfile' },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingHorizontal: isSmallScreen ? Spacing.lg : Spacing.xxl }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                />
            }
        >
            {/* Verification Banner */}
            {isVerificationPending && (
                <View style={styles.verificationBanner}>
                    <View style={styles.verificationIcon}>
                        <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                    </View>
                    <View style={styles.verificationContent}>
                        <Text style={styles.verificationTitle}>Profile verification pending</Text>
                        <Text style={styles.verificationText}>
                            Your profile is hidden from athletes until an admin verifies your account.{' '}
                            <Text
                                style={styles.verificationLink}
                                onPress={() => navigation.navigate('EditProfile')}
                            >
                                Complete your setup
                            </Text>{' '}
                            to speed up the process.
                        </Text>
                    </View>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                    >
                        <Ionicons name="menu-outline" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.dateText}>{today.toUpperCase()}</Text>
                        <Text style={[styles.headerTitle, isSmallScreen && { fontSize: FontSize.xl }]} numberOfLines={1}>
                            Good {getGreeting()},{' '}
                            <Text style={{ color: Colors.primary }}>{user?.firstName}</Text>
                        </Text>
                        <Text style={styles.subtitle}>Your training business at a glance.</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.notifButton}
                    onPress={() => navigation.navigate('Notifications')}
                >
                    <Ionicons name="notifications-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Stats Grid (6 stats, 3 columns x 2 rows) */}
            <View style={styles.statsGrid}>
                {statCards.map((card, i) => (
                    <View key={i} style={styles.statCard}>
                        <View style={styles.statCardHeader}>
                            <Text style={styles.statLabel}>{card.label.toUpperCase()}</Text>
                            <Ionicons name={card.icon} size={13} color={Colors.textTertiary} />
                        </View>
                        <Text style={styles.statValue}>{card.value}</Text>
                    </View>
                ))}
            </View>

            {/* Recent Sessions */}
            <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Recent Sessions</Text>
                    <TouchableOpacity
                        style={styles.viewAllBtn}
                        onPress={() => navigation.navigate('Bookings')}
                    >
                        <Text style={styles.viewAllText}>View all</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </View>
                {recentBookings.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="file-tray-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No sessions yet</Text>
                        <Text style={styles.emptySubtext}>
                            Bookings will appear here once athletes schedule sessions.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.sessionsCard}>
                        {recentBookings.map((booking, index) => {
                            const initials = booking.other_user
                                ? getInitials(booking.other_user.first_name, booking.other_user.last_name)
                                : '?';
                            const name = booking.other_user
                                ? `${booking.other_user.first_name} ${booking.other_user.last_name}`
                                : 'Unknown';
                            const date = new Date(booking.scheduled_at);

                            return (
                                <TouchableOpacity
                                    key={booking.id}
                                    style={[
                                        styles.sessionRow,
                                        index < recentBookings.length - 1 && styles.sessionRowBorder,
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('BookingDetail', { bookingId: booking.id })
                                    }
                                >
                                    <View style={styles.sessionAvatar}>
                                        <Text style={styles.sessionAvatarText}>{initials}</Text>
                                    </View>
                                    <View style={styles.sessionInfo}>
                                        <Text style={styles.sessionName}>{name}</Text>
                                        <View style={styles.sessionMeta}>
                                            <Text style={styles.sessionSport}>{booking.sport}</Text>
                                            <Text style={styles.sessionDot}> . </Text>
                                            <Text style={styles.sessionDuration}>
                                                {booking.duration_minutes}min
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.sessionRight}>
                                        <Text style={styles.sessionDate}>
                                            {date.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Text>
                                        <Text style={styles.sessionTime}>
                                            {date.toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: getStatusBg(booking.status) },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.statusDot,
                                                { backgroundColor: getStatusColor(booking.status) },
                                            ]}
                                        />
                                        <Text
                                            style={[
                                                styles.statusText,
                                                { color: getStatusColor(booking.status) },
                                            ]}
                                        >
                                            {getStatusLabel(booking.status)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            {/* Next Session Card */}
            <View style={styles.section}>
                <View style={styles.nextSessionCard}>
                    <View style={styles.nextSessionAccent} />
                    <View style={styles.nextSessionContent}>
                        <View style={styles.nextSessionHeader}>
                            <View
                                style={[
                                    styles.nextSessionDot,
                                    {
                                        backgroundColor: upcomingSession
                                            ? Colors.info
                                            : 'rgba(255,255,255,0.15)',
                                    },
                                ]}
                            />
                            <Text style={styles.nextSessionLabel}>NEXT SESSION</Text>
                        </View>

                        {upcomingSession ? (
                            <>
                                <View style={styles.nextSessionUser}>
                                    <View style={styles.nextSessionAvatar}>
                                        <Text style={styles.nextSessionAvatarText}>
                                            {upcomingSession.other_user
                                                ? getInitials(
                                                      upcomingSession.other_user.first_name,
                                                      upcomingSession.other_user.last_name
                                                  )
                                                : '?'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.nextSessionName}>
                                            {upcomingSession.other_user
                                                ? `${upcomingSession.other_user.first_name} ${upcomingSession.other_user.last_name}`
                                                : 'Unknown'}
                                        </Text>
                                        <Text style={styles.nextSessionSport}>
                                            {upcomingSession.sport} . {upcomingSession.duration_minutes}min
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.nextSessionGrid}>
                                    <View style={styles.nextSessionGridItem}>
                                        <Text style={styles.nextSessionGridLabel}>DATE</Text>
                                        <Text style={styles.nextSessionGridValue}>
                                            {formatDate(upcomingSession.scheduled_at)}
                                        </Text>
                                    </View>
                                    <View style={styles.nextSessionGridItem}>
                                        <Text style={styles.nextSessionGridLabel}>TIME</Text>
                                        <Text style={styles.nextSessionGridValue}>
                                            {formatTime(upcomingSession.scheduled_at)}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <Text style={styles.nextSessionEmpty}>
                                No upcoming sessions scheduled.
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsCard}>
                    {quickActions.map((action, index) => (
                        <TouchableOpacity
                            key={action.screen}
                            style={[
                                styles.quickActionRow,
                                index < quickActions.length - 1 && styles.quickActionRowBorder,
                            ]}
                            onPress={() => navigation.navigate(action.screen)}
                        >
                            <View style={styles.quickActionIcon}>
                                <Ionicons name={action.icon} size={14} color={Colors.textTertiary} />
                            </View>
                            <Text style={styles.quickActionLabel}>{action.label}</Text>
                            <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Insight Card */}
            <View style={styles.section}>
                <View style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                        <Ionicons name="trending-up-outline" size={14} color={Colors.primary} />
                        <Text style={styles.insightLabel}>INSIGHT</Text>
                    </View>
                    <Text style={styles.insightText}>
                        {stats.completedBookings > 0
                            ? `You've completed ${stats.completedBookings} session${stats.completedBookings > 1 ? 's' : ''}. Keep your availability updated to attract more athletes.`
                            : 'Complete your profile and set your availability to start receiving bookings.'}
                    </Text>
                    <TouchableOpacity
                        style={styles.insightAction}
                        onPress={() => navigation.navigate('EditProfile')}
                    >
                        <Text style={styles.insightActionText}>Update profile</Text>
                        <Ionicons name="arrow-up-outline" size={12} color={Colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    contentContainer: { paddingBottom: 20 },

    // Verification Banner
    verificationBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        backgroundColor: 'rgba(255,171,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,171,0,0.2)',
        marginBottom: Spacing.xl,
    },
    verificationIcon: {
        width: 32,
        height: 32,
        borderRadius: Spacing.sm,
        backgroundColor: 'rgba(255,171,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    verificationContent: { flex: 1 },
    verificationTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    verificationText: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
        lineHeight: 18,
    },
    verificationLink: {
        color: Colors.primary,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
    },
    headerTextContainer: {
        flex: 1,
    },
    dateText: {
        fontSize: 10,
        fontWeight: FontWeight.medium,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 2,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    menuButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    notifButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },

    // Stats Grid (6 cards, 3 per row)
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
    },
    statCard: {
        width: '31%',
        flexGrow: 1,
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1,
    },
    statValue: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.heavy,
        color: '#FFFFFF',
    },

    // Section
    section: { marginBottom: Spacing.xl },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
        marginBottom: Spacing.md,
    },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: Spacing.md },
    viewAllText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary },

    // Recent Sessions
    sessionsCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    sessionRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    sessionAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    sessionAvatarText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.5)',
    },
    sessionInfo: { flex: 1, marginRight: Spacing.sm },
    sessionName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: 'rgba(255,255,255,0.8)',
    },
    sessionMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    sessionSport: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.3)',
        textTransform: 'capitalize',
    },
    sessionDot: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.1)' },
    sessionDuration: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.3)' },
    sessionRight: { alignItems: 'flex-end', marginRight: Spacing.sm },
    sessionDate: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: 'rgba(255,255,255,0.4)',
    },
    sessionTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        gap: 4,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Empty state
    emptyCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        padding: Spacing.xxl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    emptyTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.4)',
        marginTop: Spacing.md,
    },
    emptySubtext: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.25)',
        marginTop: 4,
        textAlign: 'center',
    },

    // Next Session Card
    nextSessionCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    nextSessionAccent: {
        height: 2,
        backgroundColor: Colors.primary,
        opacity: 0.6,
    },
    nextSessionContent: { padding: Spacing.lg },
    nextSessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    nextSessionDot: { width: 8, height: 8, borderRadius: 4 },
    nextSessionLabel: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 2,
    },
    nextSessionUser: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    nextSessionAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextSessionAvatarText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.6)',
    },
    nextSessionName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    nextSessionSport: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    nextSessionGrid: { flexDirection: 'row', gap: Spacing.sm },
    nextSessionGridItem: {
        flex: 1,
        backgroundColor: 'rgba(10,13,20,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    nextSessionGridLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: 1,
        marginBottom: 6,
    },
    nextSessionGridValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
    nextSessionEmpty: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.25)',
    },

    // Quick Actions
    quickActionsCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    quickActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    quickActionRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    quickActionIcon: {
        width: 28,
        height: 28,
        borderRadius: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    quickActionLabel: {
        flex: 1,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: 'rgba(255,255,255,0.55)',
    },

    // Insight Card
    insightCard: {
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: Spacing.lg,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    insightLabel: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 2,
    },
    insightText: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 20,
    },
    insightAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: Spacing.lg,
    },
    insightActionText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
