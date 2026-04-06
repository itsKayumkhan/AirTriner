import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerActions } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type BookingWithAthlete = BookingRow & { athlete: UserRow };

export default function TrainerDashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const [pendingRequests, setPendingRequests] = useState<BookingWithAthlete[]>([]);
    const [todayBookings, setTodayBookings] = useState<BookingWithAthlete[]>([]);
    const [stats, setStats] = useState({ totalSessions: 0, totalEarnings: 0, pendingCount: 0, avgRating: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            // Fetch pending booking requests
            const { data: pending } = await supabase
                .from('bookings')
                .select('*, athlete:users!bookings_athlete_id_fkey(*)')
                .eq('trainer_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            setPendingRequests((pending || []) as BookingWithAthlete[]);

            // Fetch today's confirmed bookings
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const { data: today } = await supabase
                .from('bookings')
                .select('*, athlete:users!bookings_athlete_id_fkey(*)')
                .eq('trainer_id', user.id)
                .eq('status', 'confirmed')
                .gte('scheduled_at', todayStart.toISOString())
                .lte('scheduled_at', todayEnd.toISOString())
                .order('scheduled_at', { ascending: true });

            setTodayBookings((today || []) as BookingWithAthlete[]);

            // Fetch stats
            const { count: totalSessions } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('trainer_id', user.id)
                .eq('status', 'completed');

            const { data: earningsData } = await supabase
                .from('bookings')
                .select('price')
                .eq('trainer_id', user.id)
                .eq('status', 'completed');

            const totalEarnings = (earningsData || []).reduce((sum, b) => sum + Number(b.price), 0);

            const { data: reviews } = await supabase
                .from('reviews')
                .select('rating')
                .eq('reviewee_id', user.id);

            const avgRating = reviews && reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

            setStats({
                totalSessions: totalSessions || 0,
                totalEarnings,
                pendingCount: (pending || []).length,
                avgRating,
            });
        } catch (error) {
            console.error('Error fetching dashboard:', error);
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

    const handleAcceptBooking = async (bookingId: string) => {
        const booking = pendingRequests.find(b => b.id === bookingId);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'confirmed', updated_at: new Date().toISOString() })
                .eq('id', bookingId);
            if (error) throw error;

            // Notify the athlete
            if (booking?.athlete_id && user) {
                await createNotification({
                    userId: booking.athlete_id,
                    type: 'BOOKING_CONFIRMED',
                    title: 'Booking Confirmed! ✅',
                    body: `${user.firstName} ${user.lastName} has accepted your ${booking.sport} session.`,
                    data: { bookingId },
                });
            }
            fetchDashboardData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const handleDeclineBooking = async (bookingId: string) => {
        Alert.alert('Decline Request', 'Are you sure you want to decline this booking?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const booking = pendingRequests.find(b => b.id === bookingId);
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Declined by trainer' })
                            .eq('id', bookingId);
                        if (error) throw error;

                        // Notify the athlete
                        if (booking?.athlete_id && user) {
                            await createNotification({
                                userId: booking.athlete_id,
                                type: 'BOOKING_CANCELLED',
                                title: 'Booking Declined',
                                body: `${user.firstName} ${user.lastName} has declined your ${booking.sport} session request.`,
                                data: { bookingId },
                            });
                        }
                        fetchDashboardData();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    }
                },
            },
        ]);
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                        <Ionicons name="menu-outline" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.greeting}>Welcome back 👋</Text>
                        <Text style={styles.headerTitle}>{user?.firstName}'s Dashboard</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.notifButton} onPress={() => navigation.navigate('Notifications')}>
                    <Ionicons name="notifications-outline" size={24} color={Colors.text} />
                    {stats.pendingCount > 0 && <View style={styles.notifBadge} />}
                </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <LinearGradient colors={['#45D0FF', '#0047AB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCardPrimary}>
                    <Ionicons name="cash-outline" size={24} color="#fff" />
                    <Text style={styles.statValuePrimary}>${stats.totalEarnings.toFixed(0)}</Text>
                    <Text style={styles.statLabelPrimary}>Total Earned</Text>
                </LinearGradient>
                <View style={styles.statCard}>
                    <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
                    <Text style={styles.statValue}>{stats.totalSessions}</Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="star-outline" size={22} color={Colors.warning} />
                    <Text style={styles.statValue}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}</Text>
                    <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="hourglass-outline" size={22} color={Colors.info} />
                    <Text style={styles.statValue}>{stats.pendingCount}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
            </View>

            {/* Pending Requests */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pending Requests</Text>
                    {pendingRequests.length > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
                        </View>
                    )}
                </View>
                {pendingRequests.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="checkmark-circle-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No pending requests</Text>
                    </View>
                ) : (
                    pendingRequests.map((booking) => (
                        <View key={booking.id} style={styles.requestCard}>
                            <View style={styles.requestTop}>
                                <View style={styles.requestAvatar}>
                                    <Text style={styles.requestAvatarText}>
                                        {(booking.athlete?.first_name?.[0] || '') + (booking.athlete?.last_name?.[0] || '')}
                                    </Text>
                                </View>
                                <View style={styles.requestInfo}>
                                    <Text style={styles.requestName}>
                                        {booking.athlete?.first_name} {booking.athlete?.last_name}
                                    </Text>
                                    <Text style={styles.requestSport}>{booking.sport}</Text>
                                    <View style={styles.requestMeta}>
                                        <Ionicons name="calendar-outline" size={12} color={Colors.textTertiary} />
                                        <Text style={styles.requestMetaText}>{formatDate(booking.scheduled_at)}</Text>
                                        <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                                        <Text style={styles.requestMetaText}>{formatTime(booking.scheduled_at)}</Text>
                                    </View>
                                </View>
                                <View style={styles.requestPrice}>
                                    <Text style={styles.requestPriceValue}>${Number(booking.price).toFixed(0)}</Text>
                                    <Text style={styles.requestPriceDuration}>{booking.duration_minutes}min</Text>
                                </View>
                            </View>
                            <View style={styles.requestActions}>
                                <TouchableOpacity
                                    style={styles.declineBtn}
                                    onPress={() => handleDeclineBooking(booking.id)}
                                >
                                    <Ionicons name="close" size={18} color="#ff1744" />
                                    <Text style={styles.declineBtnText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.messageBtn}
                                    onPress={() => navigation.navigate('Chat', { bookingId: booking.id, otherUser: booking.athlete })}
                                >
                                    <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                                    <Text style={styles.messageBtnText}>Message</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.acceptBtn}
                                    onPress={() => handleAcceptBooking(booking.id)}
                                >
                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                    <Text style={styles.acceptBtnText}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Today's Schedule */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's Schedule</Text>
                {todayBookings.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="sunny-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No sessions scheduled today</Text>
                    </View>
                ) : (
                    todayBookings.map((booking) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.scheduleCard}
                            onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                        >
                            <View style={styles.scheduleTime}>
                                <Text style={styles.scheduleTimeText}>{formatTime(booking.scheduled_at)}</Text>
                                <Text style={styles.scheduleDuration}>{booking.duration_minutes}min</Text>
                            </View>
                            <View style={styles.scheduleDivider} />
                            <View style={styles.scheduleInfo}>
                                <Text style={styles.scheduleName}>
                                    {booking.athlete?.first_name} {booking.athlete?.last_name}
                                </Text>
                                <Text style={styles.scheduleSport}>{booking.sport}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('Availability')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="calendar" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Availability</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('Earnings')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="wallet" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Earnings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('Reviews')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="star" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Reviews</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('Certifications')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="ribbon" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Certs</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.quickActionsGrid, { marginTop: 12 }]}>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('TrainingOffers')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="paper-plane" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Offers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('Subscription')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="diamond" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Plan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('EditProfile')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="create" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={() => navigation.navigate('HelpCenter')}>
                        <View style={styles.quickActionCard}>
                            <View style={styles.quickActionIconWrap}>
                                <Ionicons name="help-circle" size={24} color="#45D0FF" />
                            </View>
                        </View>
                        <Text style={styles.quickActionLabel}>Help</Text>
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
    menuButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    notifButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    notifBadge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl },
    statCardPrimary: { width: '100%', padding: Spacing.xl, borderRadius: BorderRadius.lg, alignItems: 'center', ...Shadows.glow },
    statValuePrimary: { fontSize: 32, fontWeight: FontWeight.bold, color: '#fff', marginTop: Spacing.sm },
    statLabelPrimary: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    statCard: { flex: 1, minWidth: '28%', backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF', marginTop: Spacing.xs },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    section: { marginBottom: Spacing.xxl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.md },
    countBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
    countBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#fff' },
    emptyCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: Spacing.sm },
    emptyText: { fontSize: FontSize.md, color: Colors.textTertiary },
    requestCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', ...Shadows.small },
    requestTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    requestAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    requestAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#45D0FF' },
    requestInfo: { flex: 1 },
    requestName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    requestSport: { fontSize: FontSize.sm, color: '#45D0FF', marginTop: 1 },
    requestMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    requestMetaText: { fontSize: FontSize.xs, color: Colors.textTertiary, marginRight: Spacing.sm },
    requestPrice: { alignItems: 'flex-end' },
    requestPriceValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    requestPriceDuration: { fontSize: FontSize.xs, color: Colors.textTertiary },
    requestActions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    declineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: 'rgba(255,23,68,0.15)', borderWidth: 1, borderColor: 'rgba(255,23,68,0.3)', gap: 4 },
    declineBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#ff1744' },
    messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
    messageBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#45D0FF' },
    acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: BorderRadius.md, backgroundColor: '#45D0FF', gap: 4 },
    acceptBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#0A0D14' },
    scheduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    scheduleTime: { alignItems: 'center', width: 60 },
    scheduleTimeText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#45D0FF' },
    scheduleDuration: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    scheduleDivider: { width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
    scheduleInfo: { flex: 1 },
    scheduleName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    scheduleSport: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    quickActionsGrid: { flexDirection: 'row', gap: 12 },
    quickAction: { flex: 1, alignItems: 'center', gap: 8 },
    quickActionCard: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 20,
        backgroundColor: '#161B22',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.medium,
    },
    quickActionIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(69,208,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(69,208,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: FontWeight.semibold, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
