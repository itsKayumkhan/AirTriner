import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout} from '../../theme';

type HistoryBooking = BookingRow & { trainer: Pick<UserRow, 'first_name' | 'last_name'> };

type SectionData = {
    title: string;
    data: HistoryBooking[];
};

function formatMonthYear(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatBookingDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function groupByMonth(bookings: HistoryBooking[]): SectionData[] {
    const map = new Map<string, HistoryBooking[]>();
    for (const b of bookings) {
        const key = formatMonthYear(b.created_at);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(b);
    }
    const sections: SectionData[] = [];
    map.forEach((data, title) => sections.push({ title, data }));
    return sections;
}

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
                .select('*, trainer:users!bookings_trainer_id_fkey(first_name, last_name)')
                .eq('athlete_id', user.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBookings((data || []) as HistoryBooking[]);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchHistory();
        setRefreshing(false);
    };

    const totalSessions = bookings.length;
    const totalSpent = bookings.reduce((sum, b) => sum + Number(b.total_paid || b.price || 0), 0);
    const sections = groupByMonth(bookings);

    const renderBooking = ({ item }: { item: HistoryBooking }) => {
        const initials =
            (item.trainer?.first_name?.[0] || '') + (item.trainer?.last_name?.[0] || '');
        return (
            <View style={styles.card}>
                <View style={styles.cardRow}>
                    <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{initials.toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>
                            {item.trainer?.first_name} {item.trainer?.last_name}
                        </Text>
                        <Text style={styles.cardSport}>{item.sport}</Text>
                        <Text style={styles.cardDate}>{formatBookingDate(item.scheduled_at)}</Text>
                    </View>
                    <View style={styles.cardRight}>
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                            <Text style={styles.completedText}>Completed</Text>
                        </View>
                        <Text style={styles.cardPrice}>
                            ${Number(item.total_paid || item.price || 0).toFixed(0)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderSectionHeader = ({ section }: { section: SectionData }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <Text style={styles.sectionCount}>
                {section.data.length} session{section.data.length !== 1 ? 's' : ''}
            </Text>
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Training History</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Stat cards */}
            {bookings.length > 0 && (
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={styles.statIconWrap}>
                            <Ionicons name="trophy" size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.statValue}>{totalSessions}</Text>
                        <Text style={styles.statLabel}>Total Sessions</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <View style={styles.statIconWrap}>
                            <Ionicons name="wallet" size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Total Spent</Text>
                    </View>
                </View>
            )}

            {/* Section list grouped by month */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderBooking}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons name="trophy-outline" size={40} color={Colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No Training History</Text>
                        <Text style={styles.emptyText}>
                            Complete your first session to see your history here.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxl,
        paddingTop: Layout.headerTopPadding,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.xl,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.xs,
    },
    statIconWrap: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    statValue: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
    },
    statDivider: {
        width: 1,
        height: 64,
        backgroundColor: Colors.border,
    },

    // List
    listContent: {
        paddingHorizontal: Spacing.xxl,
        paddingTop: Spacing.lg,
        paddingBottom: 100,
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        marginTop: Spacing.md,
    },
    sectionHeaderText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    sectionCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
    },

    // Booking card
    card: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardAvatar: {
        width: 46,
        height: 46,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    cardAvatarText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    cardInfo: {
        flex: 1,
        gap: 3,
    },
    cardName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    cardSport: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
    cardDate: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    cardRight: {
        alignItems: 'flex-end',
        gap: Spacing.xs,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.successLight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
    },
    completedText: {
        fontSize: FontSize.xs,
        color: Colors.success,
        fontWeight: FontWeight.medium,
    },
    cardPrice: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        gap: Spacing.md,
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.xxl,
    },
});
