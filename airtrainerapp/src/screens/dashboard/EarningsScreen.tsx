import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Share,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { formatSportName } from '../../lib/format';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';
import SectionHeader from '../../components/ui/SectionHeader';
import Divider from '../../components/ui/Divider';

type PaymentTransaction = {
    id: string;
    booking_id: string;
    amount: number;
    platform_fee: number;
    trainer_payout: number;
    status: string;
    hold_until: string | null;
    created_at: string;
};

type UpcomingBooking = BookingRow & {
    payment_transaction?: PaymentTransaction | null;
    athlete_name?: string;
    trainer_name?: string;
};

export default function EarningsScreen({ navigation }: any) {
    const { user } = useAuth();
    const isTrainer = user?.role === 'trainer';

    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [completedBookings, setCompletedBookings] = useState<BookingRow[]>([]);
    const [upcomingPaid, setUpcomingPaid] = useState<UpcomingBooking[]>([]);

    const [releasedTransactions, setReleasedTransactions] = useState<PaymentTransaction[]>([]);
    const [heldCompletedTransactions, setHeldCompletedTransactions] = useState<PaymentTransaction[]>([]);

    const [athleteTransactions, setAthleteTransactions] = useState<(PaymentTransaction & { booking?: BookingRow; trainer_name?: string })[]>([]);

    const loadEarnings = useCallback(async (isRefresh = false) => {
        if (!user) return;
        if (isRefresh) setRefreshing(true);

        try {
            const column = isTrainer ? 'trainer_id' : 'athlete_id';

            const { data: completed } = await supabase
                .from('bookings').select('*').eq(column, user.id)
                .eq('status', 'completed').order('scheduled_at', { ascending: false });
            setCompletedBookings((completed || []) as BookingRow[]);

            if (isTrainer) {
                const completedBookingIds = (completed || []).map((b: BookingRow) => b.id);
                if (completedBookingIds.length) {
                    const { data: releasedTx } = await supabase
                        .from('payment_transactions')
                        .select('*')
                        .in('booking_id', completedBookingIds)
                        .eq('status', 'released');
                    setReleasedTransactions((releasedTx || []) as PaymentTransaction[]);

                    const { data: heldTx } = await supabase
                        .from('payment_transactions')
                        .select('*')
                        .in('booking_id', completedBookingIds)
                        .eq('status', 'held');
                    setHeldCompletedTransactions((heldTx || []) as PaymentTransaction[]);
                } else {
                    setReleasedTransactions([]);
                    setHeldCompletedTransactions([]);
                }

                const { data: confirmedBookings } = await supabase
                    .from('bookings').select('*').eq('trainer_id', user.id)
                    .eq('status', 'confirmed').order('scheduled_at', { ascending: true });

                if (confirmedBookings?.length) {
                    const bookingIds = confirmedBookings.map((b: BookingRow) => b.id);
                    const { data: txData } = await supabase
                        .from('payment_transactions').select('*').in('booking_id', bookingIds).eq('status', 'held');
                    const txMap = new Map((txData || []).map((t: PaymentTransaction) => [t.booking_id, t]));

                    const athleteIds = [...new Set(confirmedBookings.map((b: BookingRow) => b.athlete_id))];
                    const { data: athletes } = await supabase.from('users').select('id, first_name, last_name').in('id', athleteIds);
                    const athleteMap = new Map((athletes || []).map((a: any) => [a.id, `${a.first_name} ${a.last_name}`]));

                    setUpcomingPaid(
                        confirmedBookings.filter((b: BookingRow) => txMap.has(b.id)).map((b: BookingRow) => ({
                            ...b,
                            payment_transaction: txMap.get(b.id) || null,
                            athlete_name: (athleteMap.get(b.athlete_id) as string) || 'Unknown',
                        })).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    );
                } else {
                    setUpcomingPaid([]);
                }
            } else {
                const { data: allBookings } = await supabase
                    .from('bookings').select('*').eq('athlete_id', user.id).order('scheduled_at', { ascending: false });

                if (allBookings?.length) {
                    const bookingIds = allBookings.map((b: BookingRow) => b.id);
                    const { data: txData } = await supabase
                        .from('payment_transactions').select('*').in('booking_id', bookingIds).order('created_at', { ascending: false });

                    const bookingMap = new Map((allBookings as BookingRow[]).map((b) => [b.id, b]));
                    const trainerIds = [...new Set((allBookings as BookingRow[]).map((b) => b.trainer_id))];
                    const { data: trainers } = await supabase.from('users').select('id, first_name, last_name').in('id', trainerIds);
                    const trainerMap = new Map((trainers || []).map((t: any) => [t.id, `${t.first_name} ${t.last_name}`]));

                    setAthleteTransactions(
                        (txData || []).map((tx: PaymentTransaction) => ({
                            ...tx,
                            booking: bookingMap.get(tx.booking_id),
                            trainer_name: trainerMap.get(bookingMap.get(tx.booking_id)?.trainer_id || '') || 'Unknown',
                        }))
                    );

                    const { data: confirmedPaid } = await supabase
                        .from('payment_transactions').select('*').in('booking_id', bookingIds).eq('status', 'held');
                    const confirmedTxMap = new Map((confirmedPaid || []).map((t: PaymentTransaction) => [t.booking_id, t]));
                    const confirmedBookings = (allBookings as BookingRow[]).filter((b) => b.status === 'confirmed' && confirmedTxMap.has(b.id));

                    setUpcomingPaid(
                        confirmedBookings.map((b) => ({
                            ...b,
                            payment_transaction: confirmedTxMap.get(b.id) || null,
                            trainer_name: trainerMap.get(b.trainer_id) || 'Unknown',
                        })).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    );
                } else {
                    setAthleteTransactions([]);
                    setUpcomingPaid([]);
                }
            }
        } catch (err) {
            console.error('Failed to load records:', err);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user, isTrainer]);

    useEffect(() => { loadEarnings(); }, [loadEarnings]);
    const onRefresh = () => loadEarnings(true);

    // --- Trainer stats ---
    const totalEarnings = completedBookings.reduce((s, b) => s + Number(b.price), 0);
    const totalFees = completedBookings.reduce((s, b) => s + Number((b as any).platform_fee || b.price * 0.03), 0);
    const netEarnings = totalEarnings - totalFees;
    const pendingPayout = upcomingPaid.reduce((s, b) => s + Number(b.payment_transaction?.trainer_payout || 0), 0);
    const heldCompletedPayout = heldCompletedTransactions.reduce((s, t) => s + Number(t.trainer_payout), 0);
    const totalEscrow = pendingPayout + heldCompletedPayout;
    const totalEscrowSessions = upcomingPaid.length + heldCompletedTransactions.length;

    // --- Athlete stats ---
    const athleteTotalPaid = completedBookings.reduce((s, b) => s + Number(b.total_paid || b.price), 0);
    const athleteRefunded = athleteTransactions.filter((t) => t.status === 'refunded').reduce((s, t) => s + Number(t.amount), 0);
    const athleteInEscrow = athleteTransactions.filter((t) => t.status === 'held').reduce((s, t) => s + Number(t.amount), 0);

    // --- Monthly breakdown ---
    const monthlyDataMap = new Map<string, { amount: number; sessions: number }>();
    if (isTrainer) {
        completedBookings.forEach((b) => {
            const month = new Date(b.scheduled_at).toLocaleString('en-US', { month: 'short', year: 'numeric' });
            const ex = monthlyDataMap.get(month) || { amount: 0, sessions: 0 };
            monthlyDataMap.set(month, { amount: ex.amount + Number(b.price), sessions: ex.sessions + 1 });
        });
    } else {
        athleteTransactions.filter((t) => t.status !== 'refunded').forEach((t) => {
            const month = new Date(t.created_at).toLocaleString('en-US', { month: 'short', year: 'numeric' });
            const ex = monthlyDataMap.get(month) || { amount: 0, sessions: 0 };
            monthlyDataMap.set(month, { amount: ex.amount + Number(t.amount), sessions: ex.sessions + 1 });
        });
    }
    const months = Array.from(monthlyDataMap.entries());

    // --- CSV Export ---
    const handleExportCSV = async () => {
        try {
            let csvContent: string;

            if (isTrainer) {
                const headers = ['Date', 'Sport', 'Duration (min)', 'Amount ($)', 'Status'];
                const rows = completedBookings.map((b) => [
                    new Date(b.scheduled_at).toLocaleDateString(),
                    formatSportName(b.sport),
                    String(b.duration_minutes || 60),
                    Number(b.price).toFixed(2),
                    'completed',
                ]);
                csvContent = [headers, ...rows]
                    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                    .join('\n');
            } else {
                const headers = ['Date Paid', 'Trainer', 'Sport', 'Duration (min)', 'Amount ($)', 'Platform Fee ($)', 'Net Payout ($)', 'Status'];
                const rows = athleteTransactions.map((t) => [
                    new Date(t.created_at).toLocaleDateString(),
                    t.trainer_name || '',
                    formatSportName(t.booking?.sport || ''),
                    String(t.booking?.duration_minutes || 60),
                    Number(t.amount).toFixed(2),
                    Number(t.platform_fee || 0).toFixed(2),
                    Number(t.trainer_payout || (Number(t.amount) - Number(t.platform_fee || 0))).toFixed(2),
                    t.status || 'completed',
                ]);
                csvContent = [headers, ...rows]
                    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                    .join('\n');
            }

            await Share.share({
                message: csvContent,
                title: isTrainer ? 'Earnings Export' : 'Payments Export',
            });
        } catch (error) {
            console.error('Error exporting CSV:', error);
            Alert.alert('Export Error', 'Could not export data.');
        }
    };

    const statusBadge = (status: string) => {
        if (status === 'held') {
            return <Badge label="In Escrow" color={Colors.warning} bgColor={Colors.warningLight} dot size="sm" />;
        }
        if (status === 'released') {
            return <Badge label="Released" color={Colors.success} bgColor={Colors.successLight} dot size="sm" />;
        }
        if (status === 'refunded') {
            return <Badge label="Refunded" color={Colors.info} bgColor={Colors.infoLight} size="sm" />;
        }
        return null;
    };

    if (isLoading) {
        return <LoadingScreen message={isTrainer ? 'Loading earnings...' : 'Loading payments...'} />;
    }

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={onRefresh}>
            <ScreenHeader
                title={isTrainer ? 'Earnings' : 'Payments'}
                onBack={() => navigation.goBack()}
                rightAction={{ icon: 'download-outline', onPress: handleExportCSV }}
            />

            {/* Summary cards */}
            {isTrainer ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.statsGrid}>
                    {/* Total Earned - gradient card */}
                    <LinearGradient
                        colors={[Colors.gradientStart, Colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientStat}
                    >
                        <Text style={styles.gradientStatLabel}>TOTAL EARNED</Text>
                        <Text style={styles.gradientStatValue}>${totalEarnings.toFixed(2)}</Text>
                    </LinearGradient>
                    {/* Net Earnings card */}
                    <Card style={styles.escrowCard}>
                        <Text style={styles.escrowLabel}>NET EARNINGS</Text>
                        <Text style={[styles.escrowValue, { color: Colors.primary }]}>${netEarnings.toFixed(2)}</Text>
                    </Card>
                    {/* In Escrow card */}
                    <Card style={styles.escrowCard}>
                        <View style={styles.escrowLabelRow}>
                            <Ionicons name="time-outline" size={12} color={Colors.warning} />
                            <Text style={styles.escrowLabel}>IN ESCROW</Text>
                        </View>
                        <Text style={[styles.escrowValue, { color: Colors.warning }]}>${totalEscrow.toFixed(2)}</Text>
                        <Text style={styles.escrowSubtext}>{totalEscrowSessions} session{totalEscrowSessions !== 1 ? 's' : ''} pending</Text>
                    </Card>
                </Animated.View>
            ) : (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.statsGrid}>
                    <LinearGradient
                        colors={[Colors.gradientStart, Colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientStat}
                    >
                        <Text style={styles.gradientStatLabel}>TOTAL PAID</Text>
                        <Text style={styles.gradientStatValue}>${athleteTotalPaid.toFixed(2)}</Text>
                        <Text style={styles.gradientStatSub}>
                            {athleteTransactions.filter(t => t.status !== 'refunded').length} payment{athleteTransactions.filter(t => t.status !== 'refunded').length !== 1 ? 's' : ''}
                        </Text>
                    </LinearGradient>
                    <Card style={styles.escrowCard}>
                        <View style={styles.escrowLabelRow}>
                            <Ionicons name="time-outline" size={12} color={Colors.warning} />
                            <Text style={styles.escrowLabel}>IN ESCROW</Text>
                        </View>
                        <Text style={[styles.escrowValue, { color: Colors.warning }]}>${athleteInEscrow.toFixed(2)}</Text>
                        <Text style={styles.escrowSubtext}>{upcomingPaid.length} upcoming session{upcomingPaid.length !== 1 ? 's' : ''}</Text>
                    </Card>
                    <StatCard
                        label="Completed Sessions"
                        value={String(completedBookings.length)}
                        icon="checkmark-circle-outline"
                        color={Colors.primary}
                    />
                    {athleteRefunded > 0 && (
                        <StatCard
                            label="Refunded"
                            value={`$${athleteRefunded.toFixed(2)}`}
                            icon="arrow-undo-outline"
                            color={Colors.info}
                        />
                    )}
                </Animated.View>
            )}

            {/* Upcoming Payouts (trainer only) */}
            {isTrainer && upcomingPaid.length > 0 && (
                <Card noPadding style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.warning} />
                        <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                            <Text style={styles.sectionCardTitle}>Upcoming Payouts</Text>
                            <Text style={styles.sectionCardSubtitle}>Funds held in escrow -- released after session completes</Text>
                        </View>
                    </View>
                    {upcomingPaid.map((b) => {
                        const sessionDate = new Date(b.scheduled_at);
                        const isPast = sessionDate < new Date();
                        const holdUntil = b.payment_transaction?.hold_until
                            ? new Date(b.payment_transaction.hold_until)
                            : null;

                        return (
                            <View key={b.id} style={styles.payoutRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.payoutSport}>
                                        {formatSportName(b.sport)} · {b.duration_minutes}min
                                    </Text>
                                    <Text style={styles.payoutAthlete}>{b.athlete_name}</Text>
                                    <Text style={styles.payoutDate}>
                                        {sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        {' · '}
                                        {sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    {holdUntil ? (
                                        <Badge
                                            label={isPast ? 'Ready soon' : holdUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            color={isPast ? Colors.success : Colors.warning}
                                            bgColor={isPast ? Colors.successLight : Colors.warningLight}
                                            dot
                                            size="sm"
                                        />
                                    ) : (
                                        <Text style={styles.payoutDateSmall}>After session</Text>
                                    )}
                                    <Text style={[styles.payoutAmount, { color: Colors.warning }]}>
                                        ${Number(b.payment_transaction?.trainer_payout || 0).toFixed(2)}
                                    </Text>
                                    <Text style={styles.payoutDateSmall}>of ${Number(b.total_paid).toFixed(2)} paid</Text>
                                </View>
                            </View>
                        );
                    })}
                    <View style={styles.payoutFooter}>
                        <View style={styles.payoutFooterLeft}>
                            <Ionicons name="trending-up-outline" size={14} color={Colors.warning} />
                            <Text style={styles.payoutFooterText}>Complete sessions to release funds</Text>
                        </View>
                        <Text style={styles.payoutFooterTotal}>Total: ${pendingPayout.toFixed(2)}</Text>
                    </View>
                </Card>
            )}

            {/* Monthly Breakdown */}
            {months.length > 0 && (
                <Card noPadding style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                        <Text style={styles.sectionCardTitle}>Monthly Breakdown</Text>
                    </View>
                    {months.map(([month, data], i) => (
                        <View
                            key={month}
                            style={[
                                styles.monthlyRow,
                                i < months.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                            ]}
                        >
                            <View>
                                <Text style={styles.monthlyMonth}>{month}</Text>
                                <Text style={styles.monthlySessions}>{data.sessions} session{data.sessions !== 1 ? 's' : ''}</Text>
                            </View>
                            <Text style={styles.monthlyAmount}>${data.amount.toFixed(2)}</Text>
                        </View>
                    ))}
                </Card>
            )}

            {/* Session / Payment History */}
            <Card noPadding style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardTitle}>{isTrainer ? 'Session History' : 'Payment History'}</Text>
                </View>

                {isTrainer && (
                    completedBookings.length === 0 ? (
                        <EmptyState
                            icon="wallet-outline"
                            title="No completed sessions yet"
                            description="Start accepting bookings!"
                        />
                    ) : (
                        completedBookings.map((b) => (
                            <View key={b.id} style={styles.historyRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.historyDate}>
                                        {new Date(b.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                    <Text style={styles.historySport}>
                                        {formatSportName(b.sport)} · {b.duration_minutes} min
                                    </Text>
                                </View>
                                <Text style={[styles.historyAmount, { color: Colors.success }]}>
                                    ${Number(b.price).toFixed(2)}
                                </Text>
                            </View>
                        ))
                    )
                )}

                {!isTrainer && (
                    athleteTransactions.length === 0 ? (
                        <EmptyState
                            icon="wallet-outline"
                            title="No payments yet"
                            description="Book your first session!"
                        />
                    ) : (
                        athleteTransactions.map((tx) => (
                            <View key={tx.id} style={styles.historyRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.historyDate}>
                                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                    <Text style={styles.historySport}>
                                        {tx.trainer_name} · {formatSportName(tx.booking?.sport || '') || '\u2014'} · {tx.booking?.duration_minutes || '\u2014'}min
                                    </Text>
                                    <View style={{ marginTop: Spacing.xs }}>
                                        {statusBadge(tx.status)}
                                    </View>
                                </View>
                                <Text style={[
                                    styles.historyAmount,
                                    tx.status === 'refunded'
                                        ? { color: Colors.info, textDecorationLine: 'line-through', opacity: 0.6 }
                                        : { color: Colors.success },
                                ]}>
                                    ${Number(tx.amount).toFixed(2)}
                                </Text>
                            </View>
                        ))
                    )
                )}
            </Card>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    // Stats grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginBottom: Spacing.xxl,
    },
    gradientStat: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '45%' as any,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        gap: Spacing.xs,
        ...Shadows.glow,
    },
    gradientStatLabel: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: FontWeight.bold,
        letterSpacing: 1,
    },
    gradientStatValue: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
    },
    gradientStatSub: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    escrowCard: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '45%' as any,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(255,171,0,0.5)',
    },
    escrowLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: Spacing.xs,
    },
    escrowLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.bold,
        letterSpacing: 1,
    },
    escrowValue: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
    },
    escrowSubtext: {
        fontSize: 10,
        color: Colors.textTertiary,
        marginTop: 2,
    },

    // Section cards
    sectionCard: {
        marginBottom: Spacing.xxl,
        overflow: 'hidden',
    },
    sectionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionCardTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionCardSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },

    // Payout rows
    payoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    payoutSport: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    payoutAthlete: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    payoutDate: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    payoutDateSmall: {
        fontSize: 10,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    payoutAmount: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        marginTop: Spacing.xs,
    },
    payoutFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.warningMuted,
    },
    payoutFooterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    payoutFooterText: {
        fontSize: FontSize.xs,
        color: Colors.warning,
        fontWeight: FontWeight.medium,
    },
    payoutFooterTotal: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.warning,
    },

    // Monthly breakdown
    monthlyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    monthlyMonth: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    monthlySessions: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    monthlyAmount: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.success,
    },

    // History rows
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    historyDate: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    historySport: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    historyAmount: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
});
