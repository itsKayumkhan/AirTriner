import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function EarningsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ totalEarnings: 0, pendingPayout: 0, completedSessions: 0, thisMonth: 0 });
    const [recentPayments, setRecentPayments] = useState<any[]>([]);

    const fetchEarnings = useCallback(async () => {
        if (!user) return;
        try {
            // Completed bookings earnings
            const { data: completed } = await supabase
                .from('bookings')
                .select('price, platform_fee, total_paid, scheduled_at, sport, status')
                .eq('trainer_id', user.id)
                .eq('status', 'completed')
                .order('scheduled_at', { ascending: false });

            const totalEarnings = (completed || []).reduce((s, b) => s + (Number(b.price) - Number(b.platform_fee)), 0);

            // This month's earnings
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const thisMonth = (completed || [])
                .filter(b => new Date(b.scheduled_at) >= monthStart)
                .reduce((s, b) => s + (Number(b.price) - Number(b.platform_fee)), 0);

            // Pending (confirmed but not yet completed)
            const { data: pending } = await supabase
                .from('bookings')
                .select('price, platform_fee')
                .eq('trainer_id', user.id)
                .eq('status', 'confirmed');

            const pendingPayout = (pending || []).reduce((s, b) => s + (Number(b.price) - Number(b.platform_fee)), 0);

            setStats({
                totalEarnings,
                pendingPayout,
                completedSessions: (completed || []).length,
                thisMonth,
            });

            setRecentPayments((completed || []).slice(0, 10));
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchEarnings(); }, [fetchEarnings]);
    const onRefresh = async () => { setRefreshing(true); await fetchEarnings(); setRefreshing(false); };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                <LinearGradient colors={[Colors.primary, Colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.earningsCard}>
                    <Text style={styles.earningsLabel}>Total Earnings</Text>
                    <Text style={styles.earningsValue}>${stats.totalEarnings.toFixed(2)}</Text>
                    <Text style={styles.earningsSub}>After 3% platform fee</Text>
                </LinearGradient>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Ionicons name="calendar-outline" size={22} color={Colors.success} />
                        <Text style={styles.statValue}>${stats.thisMonth.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>This Month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Ionicons name="hourglass-outline" size={22} color={Colors.warning} />
                        <Text style={styles.statValue}>${stats.pendingPayout.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Ionicons name="checkmark-circle-outline" size={22} color={Colors.primary} />
                        <Text style={styles.statValue}>{stats.completedSessions}</Text>
                        <Text style={styles.statLabel}>Sessions</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Recent Sessions</Text>
                {recentPayments.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No completed sessions yet</Text>
                    </View>
                ) : (
                    recentPayments.map((item, i) => (
                        <View key={i} style={styles.paymentRow}>
                            <View style={styles.paymentIcon}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                            </View>
                            <View style={styles.paymentInfo}>
                                <Text style={styles.paymentSport}>{item.sport} Session</Text>
                                <Text style={styles.paymentDate}>{new Date(item.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                            </View>
                            <Text style={styles.paymentAmount}>+${(Number(item.price) - Number(item.platform_fee)).toFixed(2)}</Text>
                        </View>
                    ))
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
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    earningsCard: { borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', marginBottom: Spacing.xl, ...Shadows.glow },
    earningsLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
    earningsValue: { fontSize: 40, fontWeight: FontWeight.bold, color: '#fff', marginTop: Spacing.xs },
    earningsSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    statsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xxl },
    statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
    emptyCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
    emptyText: { fontSize: FontSize.md, color: Colors.textTertiary },
    paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    paymentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.successLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    paymentInfo: { flex: 1 },
    paymentSport: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    paymentDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    paymentAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
});
