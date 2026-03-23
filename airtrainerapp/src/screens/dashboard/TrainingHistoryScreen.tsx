import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

type HistoryBooking = BookingRow & { trainer: UserRow };

export default function TrainingHistoryScreen({ navigation }: any) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<HistoryBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, trainer:users!bookings_trainer_id_fkey(*)')
                .eq('athlete_id', user.id)
                .in('status', ['completed', 'cancelled', 'no_show'])
                .order('scheduled_at', { ascending: false });

            if (error) throw error;
            setBookings((data || []) as HistoryBooking[]);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);
    const onRefresh = async () => { setRefreshing(true); await fetchHistory(); setRefreshing(false); };

    const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
        completed: { color: Colors.success, icon: 'checkmark-circle', label: 'Completed' },
        cancelled: { color: Colors.error, icon: 'close-circle', label: 'Cancelled' },
        no_show: { color: Colors.warning, icon: 'alert-circle', label: 'No Show' },
    };

    const totalSessions = bookings.filter(b => b.status === 'completed').length;
    const totalSpent = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + Number(b.total_paid), 0);

    const renderBooking = ({ item }: { item: HistoryBooking }) => {
        const cfg = statusConfig[item.status] || statusConfig.completed;
        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{(item.trainer?.first_name?.[0] || '') + (item.trainer?.last_name?.[0] || '')}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{item.trainer?.first_name} {item.trainer?.last_name}</Text>
                        <Text style={styles.cardSport}>{item.sport} • {item.duration_minutes}min</Text>
                        <Text style={styles.cardDate}>{new Date(item.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                    <View style={styles.cardRight}>
                        <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                            <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={styles.cardPrice}>${Number(item.total_paid).toFixed(0)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Training History</Text>
                <View style={{ width: 44 }} />
            </View>

            {bookings.length > 0 && (
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{totalSessions}</Text>
                        <Text style={styles.statLabel}>Sessions</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Total Spent</Text>
                    </View>
                </View>
            )}

            <FlatList
                data={bookings}
                renderItem={renderBooking}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="trophy-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Training History</Text>
                        <Text style={styles.emptyText}>Complete your first session to see it here.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, marginHorizontal: Spacing.xxl, marginTop: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xxl },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
    listContent: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: 100 },
    card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    cardAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
    cardInfo: { flex: 1 },
    cardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
    cardSport: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 1 },
    cardDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: Spacing.xs },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.pill, gap: 3 },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
    cardPrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
