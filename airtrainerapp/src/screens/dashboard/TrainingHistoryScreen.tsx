import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, BookingRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, Avatar, EmptyState, LoadingScreen, StatCard, SectionHeader } from '../../components/ui';

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

    const renderBooking = ({ item, index }: { item: HistoryBooking; index: number }) => {
        const trainerName = `${item.trainer?.first_name || ''} ${item.trainer?.last_name || ''}`.trim();

        return (
            <Animated.View entering={FadeInDown.duration(200).delay(index * 30)}>
                {/* Session card with status color left border accent */}
                <Card style={styles.bookingCard}>
                    <View style={styles.statusAccent} />
                    <View style={styles.cardContent}>
                        <View style={styles.cardRow}>
                            <Avatar
                                name={trainerName}
                                size={46}
                                borderColor={Colors.borderActive}
                            />
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardName}>{trainerName}</Text>
                                <Text style={styles.cardSport}>{item.sport}</Text>
                                <Text style={styles.cardDate}>{formatBookingDate(item.scheduled_at)}</Text>
                            </View>
                            <View style={styles.cardRight}>
                                <Text style={styles.cardPrice}>
                                    ${Number(item.total_paid || item.price || 0).toFixed(0)}
                                </Text>
                                <Badge
                                    label="Completed"
                                    color={Colors.success}
                                    bgColor={Colors.successLight}
                                    dot
                                    size="sm"
                                />
                            </View>
                        </View>
                    </View>
                </Card>
            </Animated.View>
        );
    };

    // Timeline-style date headers
    const renderSectionHeader = ({ section }: { section: SectionData }) => (
        <View style={styles.timelineHeader}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineHeaderContent}>
                <Text style={styles.timelineMonth}>{section.title}</Text>
                <Text style={styles.timelineCount}>
                    {section.data.length} session{section.data.length !== 1 ? 's' : ''}
                </Text>
            </View>
        </View>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading history..." />;
    }

    return (
        <ScreenWrapper scrollable={false}>
            <ScreenHeader
                title="Training History"
                onBack={() => navigation.goBack()}
            />

            {/* Stat cards */}
            {bookings.length > 0 && (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.statsRow}>
                    <StatCard
                        label="Total Sessions"
                        value={String(totalSessions)}
                        icon="trophy"
                        color={Colors.primary}
                    />
                    <StatCard
                        label="Total Spent"
                        value={`$${totalSpent.toFixed(0)}`}
                        icon="wallet"
                        color={Colors.primary}
                    />
                </Animated.View>
            )}

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
                    <EmptyState
                        icon="trophy-outline"
                        title="No Training History"
                        description="Complete your first session to see your history here."
                    />
                }
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    listContent: {
        paddingBottom: Spacing.huge + Spacing.huge,
    },

    // Timeline-style section header
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
        borderWidth: 2,
        borderColor: Colors.primaryGlow,
    },
    timelineHeaderContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timelineMonth: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    timelineCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
    },

    // Session card with left border accent
    bookingCard: {
        marginBottom: Spacing.sm,
        paddingLeft: 0,
        overflow: 'hidden',
    },
    statusAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: Colors.success,
        borderTopLeftRadius: BorderRadius.lg,
        borderBottomLeftRadius: BorderRadius.lg,
    },
    cardContent: {
        paddingLeft: Spacing.md,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
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
    cardPrice: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
});
