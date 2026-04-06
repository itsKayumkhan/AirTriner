import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

interface MonthlyEntry {
    gross: number;
    fees: number;
    sessions: number;
}

export default function EarningsScreen({ navigation }: any) {
    const { user } = useAuth();
    const isTrainer = user?.role === 'trainer';
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [completedBookings, setCompletedBookings] = useState<any[]>([]);
    const [stats, setStats] = useState({
        grossEarnings: 0,
        platformFees: 0,
        netEarnings: 0,
        inEscrow: 0,
        completedSessions: 0,
    });
    const [upcomingPayouts, setUpcomingPayouts] = useState<any[]>([]);
    const [monthlyData, setMonthlyData] = useState<Record<string, MonthlyEntry>>({});
    const [recentPayments, setRecentPayments] = useState<any[]>([]);

    const fetchEarnings = useCallback(async () => {
        if (!user) return;
        try {
            // --- Athlete path ---
            if (!isTrainer) {
                const { data: athleteBookings } = await supabase
                    .from('bookings')
                    .select('price, platform_fee, total_paid, scheduled_at, sport, status, duration_minutes, trainer:users!bookings_trainer_id_fkey(first_name, last_name)')
                    .eq('athlete_id', user.id)
                    .order('scheduled_at', { ascending: false });

                const allBookings = athleteBookings || [];
                const completed = allBookings.filter(b => b.status === 'completed');
                const confirmed = allBookings.filter(b => b.status === 'confirmed');

                const totalPaid = completed.reduce((s, b) => s + Number(b.total_paid || b.price), 0);
                const inEscrow = confirmed.reduce((s, b) => s + Number(b.total_paid || b.price), 0);

                setStats({
                    grossEarnings: totalPaid,       // reuse as "Total Paid"
                    platformFees: completed.reduce((s, b) => s + Number(b.platform_fee || b.price * 0.03), 0),
                    netEarnings: 0,
                    inEscrow,
                    completedSessions: completed.length,
                });
                setRecentPayments(allBookings.slice(0, 10));
                setCompletedBookings(allBookings);
                setIsLoading(false);
                return;
            }

            // --- Trainer path ---
            // Completed bookings with athlete info
            const { data: completed } = await supabase
                .from('bookings')
                .select('price, platform_fee, total_paid, scheduled_at, sport, status, duration_minutes, athlete:users!bookings_athlete_id_fkey(first_name, last_name)')
                .eq('trainer_id', user.id)
                .eq('status', 'completed')
                .order('scheduled_at', { ascending: false });

            const completedList = completed || [];
            setCompletedBookings(completedList);

            // Calculate stats
            const grossEarnings = completedList.reduce((s, b) => s + Number(b.price), 0);
            const platformFees = completedList.reduce((s, b) => s + Number(b.platform_fee || b.price * 0.03), 0);
            const netEarnings = grossEarnings - platformFees;

            // In Escrow: confirmed bookings
            const { data: confirmed } = await supabase
                .from('bookings')
                .select('price, platform_fee')
                .eq('trainer_id', user.id)
                .eq('status', 'confirmed');

            const inEscrow = (confirmed || []).reduce((s, b) => s + Number(b.price), 0);

            setStats({
                grossEarnings,
                platformFees,
                netEarnings,
                inEscrow,
                completedSessions: completedList.length,
            });

            // Upcoming payouts - try payment_transactions first
            let payoutsSet = false;
            try {
                const { data: transactions, error } = await supabase
                    .from('payment_transactions')
                    .select('*, booking:bookings!payment_transactions_booking_id_fkey(sport, scheduled_at, athlete_id)')
                    .eq('status', 'held')
                    .order('hold_until', { ascending: true });

                if (!error && transactions && transactions.length > 0) {
                    setUpcomingPayouts(transactions.map(t => ({
                        sport: t.booking?.sport || 'Session',
                        athleteName: 'Athlete',
                        scheduledAt: t.booking?.scheduled_at,
                        amount: Number(t.amount) - Number(t.platform_fee || 0),
                        releaseDate: t.hold_until,
                    })));
                    payoutsSet = true;
                }
            } catch {
                // table may not exist, fall through
            }

            if (!payoutsSet) {
                // Fallback: use confirmed bookings
                const { data: upcomingBookings } = await supabase
                    .from('bookings')
                    .select('*, athlete:users!bookings_athlete_id_fkey(first_name, last_name)')
                    .eq('trainer_id', user.id)
                    .eq('status', 'confirmed')
                    .order('scheduled_at', { ascending: true });

                setUpcomingPayouts((upcomingBookings || []).map(b => {
                    const fee = Number(b.platform_fee || b.price * 0.03);
                    const releaseDate = new Date(b.scheduled_at);
                    releaseDate.setHours(releaseDate.getHours() + 48);
                    return {
                        sport: b.sport,
                        athleteName: `${b.athlete?.first_name || ''} ${b.athlete?.last_name || ''}`.trim() || 'Athlete',
                        scheduledAt: b.scheduled_at,
                        amount: Number(b.price) - fee,
                        releaseDate: releaseDate.toISOString(),
                    };
                }));
            }

            // Monthly breakdown
            const monthly = completedList.reduce<Record<string, MonthlyEntry>>((acc, booking) => {
                const month = new Date(booking.scheduled_at).toLocaleString('default', { month: 'short', year: 'numeric' });
                if (!acc[month]) acc[month] = { gross: 0, fees: 0, sessions: 0 };
                acc[month].gross += Number(booking.price);
                acc[month].fees += Number(booking.platform_fee || booking.price * 0.03);
                acc[month].sessions += 1;
                return acc;
            }, {});
            setMonthlyData(monthly);

            setRecentPayments(completedList.slice(0, 10));
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchEarnings(); }, [fetchEarnings]);
    const onRefresh = async () => { setRefreshing(true); await fetchEarnings(); setRefreshing(false); };

    const handleExportCSV = async () => {
        try {
            let header: string;
            let rows: string;

            if (isTrainer) {
                header = 'Date,Sport,Athlete,Duration,Price,Fee,Net\n';
                rows = completedBookings.map(b => {
                    const date = new Date(b.scheduled_at).toLocaleDateString();
                    const fee = Number(b.platform_fee || b.price * 0.03);
                    const net = Number(b.price) - fee;
                    const athleteName = `${b.athlete?.first_name || ''} ${b.athlete?.last_name || ''}`.trim();
                    return `${date},${b.sport},${athleteName},${b.duration_minutes || ''},${b.price},${fee.toFixed(2)},${net.toFixed(2)}`;
                }).join('\n');
            } else {
                header = 'Date,Sport,Trainer,Duration,Status,Amount Paid,Fee\n';
                rows = completedBookings.map(b => {
                    const date = new Date(b.scheduled_at).toLocaleDateString();
                    const fee = Number(b.platform_fee || b.price * 0.03);
                    const trainerName = `${b.trainer?.first_name || ''} ${b.trainer?.last_name || ''}`.trim();
                    const amountPaid = Number(b.total_paid || b.price);
                    return `${date},${b.sport},${trainerName},${b.duration_minutes || ''},${b.status},${amountPaid.toFixed(2)},${fee.toFixed(2)}`;
                }).join('\n');
            }

            const csv = header + rows;
            await Share.share({
                message: csv,
                title: isTrainer ? 'Earnings Export' : 'Payments Export',
            });
        } catch (error) {
            console.error('Error exporting CSV:', error);
            Alert.alert('Export Error', 'Could not export data.');
        }
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    const monthlyEntries = Object.entries(monthlyData);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isTrainer ? 'Earnings' : 'Payments'}</Text>
                <TouchableOpacity onPress={handleExportCSV} style={styles.exportButton}>
                    <Ionicons name="share-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* Stats Grid - 2x2 */}
                {isTrainer ? (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Ionicons name="trending-up-outline" size={22} color={Colors.primary} />
                            <Text style={styles.statValue}>${stats.grossEarnings.toFixed(2)}</Text>
                            <Text style={styles.statLabel}>Gross Earnings</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="cut-outline" size={22} color={Colors.error} />
                            <Text style={[styles.statValue, { color: Colors.error }]}>-${stats.platformFees.toFixed(2)}</Text>
                            <Text style={styles.statLabel}>Platform Fees</Text>
                        </View>
                        <LinearGradient
                            colors={[Colors.gradientStart, Colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.statCardGradient}
                        >
                            <Ionicons name="wallet-outline" size={22} color="#fff" />
                            <Text style={[styles.statValue, { color: '#fff' }]}>${stats.netEarnings.toFixed(2)}</Text>
                            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Net Earnings</Text>
                        </LinearGradient>
                        <View style={styles.statCard}>
                            <Ionicons name="lock-closed-outline" size={22} color={Colors.warning} />
                            <Text style={[styles.statValue, { color: Colors.warning }]}>${stats.inEscrow.toFixed(2)}</Text>
                            <Text style={styles.statLabel}>In Escrow</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.statsGrid}>
                        <LinearGradient
                            colors={[Colors.gradientStart, Colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.statCardGradient}
                        >
                            <Ionicons name="card-outline" size={22} color="#fff" />
                            <Text style={[styles.statValue, { color: '#fff' }]}>${stats.grossEarnings.toFixed(2)}</Text>
                            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Total Paid</Text>
                        </LinearGradient>
                        <View style={styles.statCard}>
                            <Ionicons name="lock-closed-outline" size={22} color={Colors.warning} />
                            <Text style={[styles.statValue, { color: Colors.warning }]}>${stats.inEscrow.toFixed(2)}</Text>
                            <Text style={styles.statLabel}>In Escrow</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="cut-outline" size={22} color={Colors.error} />
                            <Text style={[styles.statValue, { color: Colors.error }]}>-${stats.platformFees.toFixed(2)}</Text>
                            <Text style={styles.statLabel}>Platform Fees</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
                            <Text style={styles.statValue}>{stats.completedSessions}</Text>
                            <Text style={styles.statLabel}>Completed Sessions</Text>
                        </View>
                    </View>
                )}

                {/* Upcoming Payouts (trainer only) */}
                {isTrainer && upcomingPayouts.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Upcoming Payouts</Text>
                        {upcomingPayouts.map((payout, i) => (
                            <View key={i} style={styles.payoutCard}>
                                <View style={styles.payoutLeft}>
                                    <View style={styles.sportDot} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.payoutSport}>{payout.sport} Session</Text>
                                        <Text style={styles.payoutAthlete}>{payout.athleteName}</Text>
                                        <Text style={styles.payoutDate}>
                                            Session: {new Date(payout.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.payoutRight}>
                                    <Text style={styles.payoutAmount}>${payout.amount.toFixed(2)}</Text>
                                    <Text style={styles.payoutRelease}>
                                        Release: {new Date(payout.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* Monthly Breakdown (trainer only) */}
                {isTrainer && monthlyEntries.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Monthly Breakdown</Text>
                        <View style={styles.monthlyHeader}>
                            <Text style={[styles.monthlyHeaderText, { flex: 2 }]}>Month</Text>
                            <Text style={[styles.monthlyHeaderText, { flex: 1, textAlign: 'center' }]}>Sessions</Text>
                            <Text style={[styles.monthlyHeaderText, { flex: 1.2, textAlign: 'right' }]}>Gross</Text>
                            <Text style={[styles.monthlyHeaderText, { flex: 1.2, textAlign: 'right' }]}>Net</Text>
                        </View>
                        {monthlyEntries.map(([month, data], i) => (
                            <View key={month} style={[styles.monthlyRow, i % 2 === 0 && styles.monthlyRowAlt]}>
                                <Text style={[styles.monthlyCell, { flex: 2 }]}>{month}</Text>
                                <Text style={[styles.monthlyCell, { flex: 1, textAlign: 'center' }]}>{data.sessions}</Text>
                                <Text style={[styles.monthlyCell, { flex: 1.2, textAlign: 'right' }]}>${data.gross.toFixed(0)}</Text>
                                <Text style={[styles.monthlyCellNet, { flex: 1.2, textAlign: 'right' }]}>${(data.gross - data.fees).toFixed(0)}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* Recent Sessions / Payment History */}
                <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>{isTrainer ? 'Recent Sessions' : 'Payment History'}</Text>
                {recentPayments.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>{isTrainer ? 'No completed sessions yet' : 'No payments yet'}</Text>
                    </View>
                ) : (
                    recentPayments.map((item, i) => {
                        const statusColor = item.status === 'confirmed' ? Colors.warning : Colors.success;
                        const statusIcon = item.status === 'confirmed' ? 'time-outline' : 'checkmark-circle';
                        const personName = isTrainer
                            ? `${item.athlete?.first_name || ''} ${item.athlete?.last_name || ''}`.trim()
                            : `${item.trainer?.first_name || ''} ${item.trainer?.last_name || ''}`.trim();

                        return (
                            <View key={i} style={styles.paymentRow}>
                                <View style={[styles.paymentIcon, !isTrainer && item.status === 'confirmed' && { backgroundColor: 'rgba(255,193,7,0.12)' }]}>
                                    <Ionicons name={statusIcon as any} size={20} color={statusColor} />
                                </View>
                                <View style={styles.paymentInfo}>
                                    <Text style={styles.paymentSport}>{item.sport} Session</Text>
                                    <Text style={styles.paymentDate}>
                                        {personName ? `${personName} · ` : ''}{new Date(item.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        {!isTrainer && item.status === 'confirmed' ? ' · In Escrow' : ''}
                                    </Text>
                                </View>
                                {isTrainer ? (
                                    <Text style={styles.paymentAmount}>+${(Number(item.price) - Number(item.platform_fee || item.price * 0.03)).toFixed(2)}</Text>
                                ) : (
                                    <Text style={[styles.paymentAmount, item.status === 'confirmed' && { color: Colors.warning }]}>
                                        ${Number(item.total_paid || item.price).toFixed(2)}
                                    </Text>
                                )}
                            </View>
                        );
                    })
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    exportButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },

    // Stats 2x2 Grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl },
    statCard: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '45%' as any,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.xs,
    },
    statCardGradient: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '45%' as any,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        gap: Spacing.xs,
        ...Shadows.glow,
    },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },

    // Section
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },

    // Upcoming Payouts
    payoutCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    payoutLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    sportDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginRight: Spacing.md },
    payoutSport: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    payoutAthlete: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    payoutDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    payoutRight: { alignItems: 'flex-end' },
    payoutAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
    payoutRelease: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },

    // Monthly Breakdown
    monthlyHeader: {
        flexDirection: 'row',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    monthlyHeaderText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textTertiary, textTransform: 'uppercase' },
    monthlyRow: {
        flexDirection: 'row',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    monthlyRowAlt: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: BorderRadius.sm,
    },
    monthlyCell: { fontSize: FontSize.sm, color: Colors.textSecondary },
    monthlyCellNet: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.success },

    // Empty
    emptyCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
    emptyText: { fontSize: FontSize.md, color: Colors.textTertiary },

    // Recent Sessions
    paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    paymentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.successLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    paymentInfo: { flex: 1 },
    paymentSport: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    paymentDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    paymentAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
});
