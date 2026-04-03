import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type BookingWithTrainer = {
    id: string;
    athlete_id: string;
    trainer_id: string;
    sport: string;
    status: string;
    scheduled_at: string;
    duration_minutes: number;
    total_paid: number;
    price: number;
    created_at: string;
    trainer: {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
    };
};

export default function AthleteDashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<BookingWithTrainer[]>([]);
    const [stats, setStats] = useState({ totalBookings: 0, upcoming: 0, completed: 0, totalSpent: 0 });
    const [nextSession, setNextSession] = useState<BookingWithTrainer | null>(null);
    const [recentSessions, setRecentSessions] = useState<BookingWithTrainer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('bookings')
                .select('*, trainer:users!bookings_trainer_id_fkey(first_name, last_name, avatar_url)')
                .eq('athlete_id', user.id)
                .order('scheduled_at', { ascending: false });

            const allBookings = (data || []) as BookingWithTrainer[];
            setBookings(allBookings);

            const now = new Date().toISOString();
            const upcomingBookings = allBookings.filter(
                (b) => b.status === 'confirmed' && b.scheduled_at > now
            );
            const completedBookings = allBookings.filter((b) => b.status === 'completed');
            const totalSpent = completedBookings.reduce(
                (sum, b) => sum + (Number(b.total_paid) || Number(b.price) || 0),
                0
            );

            setStats({
                totalBookings: allBookings.length,
                upcoming: upcomingBookings.length,
                completed: completedBookings.length,
                totalSpent,
            });

            // Next session: nearest upcoming confirmed booking
            const sortedUpcoming = [...upcomingBookings].sort(
                (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
            );
            setNextSession(sortedUpcoming.length > 0 ? sortedUpcoming[0] : null);

            // Recent 5 sessions
            setRecentSessions(allBookings.slice(0, 5));
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

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return Colors.success;
            case 'completed': return Colors.primary;
            case 'pending': return Colors.warning;
            case 'cancelled': return Colors.error;
            default: return Colors.textTertiary;
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'confirmed': return Colors.successLight;
            case 'completed': return Colors.infoLight;
            case 'pending': return Colors.warningLight;
            case 'cancelled': return Colors.errorLight;
            default: return Colors.glass;
        }
    };

    const getInitials = (firstName?: string, lastName?: string) => {
        return (firstName?.[0] || '') + (lastName?.[0] || '');
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                    <Text style={styles.headerTitle}>{user?.firstName}</Text>
                </View>
                <TouchableOpacity style={styles.notifButton} onPress={() => navigation.navigate('Notifications')}>
                    <Ionicons name="notifications-outline" size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <LinearGradient colors={['#45D0FF', '#0047AB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCardPrimary}>
                    <Ionicons name="wallet-outline" size={24} color="#fff" />
                    <Text style={styles.statValuePrimary}>${stats.totalSpent.toFixed(0)}</Text>
                    <Text style={styles.statLabelPrimary}>Total Spent</Text>
                </LinearGradient>
                <View style={styles.statCard}>
                    <Ionicons name="bookmark-outline" size={22} color={Colors.primary} />
                    <Text style={styles.statValue}>{stats.totalBookings}</Text>
                    <Text style={styles.statLabel}>Total Bookings</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="time-outline" size={22} color={Colors.warning} />
                    <Text style={styles.statValue}>{stats.upcoming}</Text>
                    <Text style={styles.statLabel}>Upcoming</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
                    <Text style={styles.statValue}>{stats.completed}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
            </View>

            {/* Next Session */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Next Session</Text>
                {nextSession ? (
                    <TouchableOpacity
                        style={styles.nextSessionCard}
                        onPress={() => navigation.navigate('BookingDetail', { bookingId: nextSession.id })}
                    >
                        <View style={styles.nextSessionTop}>
                            <View style={styles.nextSessionAvatar}>
                                <Text style={styles.nextSessionAvatarText}>
                                    {getInitials(nextSession.trainer?.first_name, nextSession.trainer?.last_name)}
                                </Text>
                            </View>
                            <View style={styles.nextSessionInfo}>
                                <Text style={styles.nextSessionName}>
                                    {nextSession.trainer?.first_name} {nextSession.trainer?.last_name}
                                </Text>
                                <Text style={styles.nextSessionSport}>{nextSession.sport}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.viewBtn}
                                onPress={() => navigation.navigate('BookingDetail', { bookingId: nextSession.id })}
                            >
                                <Text style={styles.viewBtnText}>View</Text>
                                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.nextSessionMeta}>
                            <View style={styles.nextSessionMetaItem}>
                                <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.nextSessionMetaText}>{formatDate(nextSession.scheduled_at)}</Text>
                            </View>
                            <View style={styles.nextSessionMetaItem}>
                                <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.nextSessionMetaText}>{formatTime(nextSession.scheduled_at)}</Text>
                            </View>
                            <View style={styles.nextSessionMetaItem}>
                                <Ionicons name="hourglass-outline" size={14} color={Colors.textTertiary} />
                                <Text style={styles.nextSessionMetaText}>{nextSession.duration_minutes}min</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No upcoming sessions</Text>
                    </View>
                )}
            </View>

            {/* Recent Sessions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Sessions</Text>
                {recentSessions.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="fitness-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No sessions yet</Text>
                    </View>
                ) : (
                    recentSessions.map((booking) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.recentCard}
                            onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                        >
                            <View style={styles.recentAvatar}>
                                <Text style={styles.recentAvatarText}>
                                    {getInitials(booking.trainer?.first_name, booking.trainer?.last_name)}
                                </Text>
                            </View>
                            <View style={styles.recentInfo}>
                                <Text style={styles.recentName}>
                                    {booking.trainer?.first_name} {booking.trainer?.last_name}
                                </Text>
                                <View style={styles.recentMeta}>
                                    <Text style={styles.recentSport}>{booking.sport}</Text>
                                    <Text style={styles.recentDate}>{formatDate(booking.scheduled_at)}</Text>
                                </View>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(booking.status) }]}>
                                <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Discover')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(69,208,255,0.15)' }]}>
                            <Ionicons name="compass" size={22} color="#45D0FF" />
                        </View>
                        <Text style={styles.quickActionLabel}>Find Trainer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Bookings')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(69,208,255,0.15)' }]}>
                            <Ionicons name="calendar" size={22} color="#45D0FF" />
                        </View>
                        <Text style={styles.quickActionLabel}>My Bookings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Messages')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(69,208,255,0.15)' }]}>
                            <Ionicons name="chatbubbles" size={22} color="#45D0FF" />
                        </View>
                        <Text style={styles.quickActionLabel}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('SubAccounts')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(69,208,255,0.15)' }]}>
                            <Ionicons name="people" size={22} color="#45D0FF" />
                        </View>
                        <Text style={styles.quickActionLabel}>Family</Text>
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
    contentContainer: { paddingHorizontal: Spacing.xxl, paddingTop: 60 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl },
    greeting: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    notifButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl },
    statCardPrimary: { width: '100%', padding: Spacing.xl, borderRadius: BorderRadius.lg, alignItems: 'center', ...Shadows.glow },
    statValuePrimary: { fontSize: 32, fontWeight: FontWeight.bold, color: '#fff', marginTop: Spacing.sm },
    statLabelPrimary: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    statCard: { flex: 1, minWidth: '28%', backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF', marginTop: Spacing.xs },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    section: { marginBottom: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.md },
    // Next Session Card
    nextSessionCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', ...Shadows.small },
    nextSessionTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    nextSessionAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    nextSessionAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#45D0FF' },
    nextSessionInfo: { flex: 1 },
    nextSessionName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    nextSessionSport: { fontSize: FontSize.sm, color: '#45D0FF', marginTop: 1 },
    viewBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 2 },
    viewBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primary },
    nextSessionMeta: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    nextSessionMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    nextSessionMetaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
    // Recent Sessions
    recentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    recentAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    recentAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#45D0FF' },
    recentInfo: { flex: 1 },
    recentName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    recentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
    recentSport: { fontSize: FontSize.sm, color: Colors.primary },
    recentDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
    statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
    // Empty state
    emptyCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: Spacing.sm },
    emptyText: { fontSize: FontSize.md, color: Colors.textTertiary },
    // Quick Actions
    quickActionsGrid: { flexDirection: 'row', gap: Spacing.md },
    quickAction: { flex: 1, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: Spacing.sm },
    quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickActionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: '#FFFFFF' },
});
