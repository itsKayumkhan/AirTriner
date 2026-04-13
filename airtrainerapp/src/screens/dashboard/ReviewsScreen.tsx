import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, ReviewRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';

type ReviewWithUser = ReviewRow & {
    reviewer?: { first_name: string; last_name: string };
};

export default function ReviewsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReviews = useCallback(async () => {
        if (!user) return;
        try {
            const { data: reviewData, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('reviewee_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const allReviews = (reviewData || []) as ReviewRow[];
            const reviewerIds = [...new Set(allReviews.map((r) => r.reviewer_id))];

            if (reviewerIds.length > 0) {
                const { data: reviewers } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .in('id', reviewerIds);

                const rMap = new Map(
                    (reviewers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u])
                );

                setReviews(
                    allReviews.map((r) => ({
                        ...r,
                        reviewer: rMap.get(r.reviewer_id) as { first_name: string; last_name: string } | undefined,
                    }))
                );
            } else {
                setReviews(allReviews.map((r) => ({ ...r, reviewer: undefined })));
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReviews();
        setRefreshing(false);
    };

    const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

    const ratingDist = [5, 4, 3, 2, 1].map((n) => ({
        stars: n,
        count: reviews.filter((r) => r.rating === n).length,
        pct: reviews.length
            ? Math.round((reviews.filter((r) => r.rating === n).length / reviews.length) * 100)
            : 0,
    }));

    const getBarColor = (star: number) => {
        if (star >= 4) return '#10B981';
        if (star === 3) return '#F59E0B';
        return '#EF4444';
    };

    const renderStars = (rating: number, size: number = 16) => (
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: size, color: star <= rating ? '#F59E0B' : 'rgba(255,255,255,0.1)' }}>
                    ★
                </Text>
            ))}
        </View>
    );

    const handleExportCSV = async () => {
        if (reviews.length === 0) return;
        try {
            const headers = ['Date', 'Reviewer', 'Rating', 'Review'];
            const rows = reviews.map((r) => [
                new Date(r.created_at).toLocaleDateString(),
                r.reviewer ? `${r.reviewer.first_name} ${r.reviewer.last_name}` : 'Anonymous',
                r.rating,
                `"${(r.review_text || '').replace(/"/g, '""')}"`,
            ]);
            const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');

            const filename = `reviews-${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export Reviews' });
            } else {
                Alert.alert('Sharing not available', 'Sharing is not available on this device.');
            }
        } catch (error) {
            console.error('Error exporting reviews:', error);
            Alert.alert('Export Failed', 'Could not export reviews. Please try again.');
        }
    };

    const renderReview = ({ item }: { item: ReviewWithUser }) => {
        const initials = item.reviewer
            ? `${item.reviewer.first_name[0]}${item.reviewer.last_name[0]}`
            : '?';
        const name = item.reviewer
            ? `${item.reviewer.first_name} ${item.reviewer.last_name}`
            : 'Anonymous';

        return (
            <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                    <View style={styles.reviewHeaderLeft}>
                        <View style={styles.reviewAvatar}>
                            <Text style={styles.reviewAvatarText}>{initials}</Text>
                        </View>
                        <View style={styles.reviewInfo}>
                            <Text style={styles.reviewName}>{name}</Text>
                            <Text style={styles.reviewDate}>
                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                    month: 'long', day: 'numeric', year: 'numeric',
                                })}
                            </Text>
                        </View>
                    </View>
                    {renderStars(item.rating, 18)}
                </View>
                {item.review_text ? (
                    <View style={styles.reviewTextContainer}>
                        <Text style={styles.reviewText}>{item.review_text}</Text>
                    </View>
                ) : (
                    <Text style={styles.reviewTextEmpty}>No written review provided.</Text>
                )}
            </View>
        );
    };

    const renderSummary = () => (
        <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
                <Text style={styles.summaryRating}>{avgRating || '\u2014'}</Text>
                {renderStars(Math.round(avgRating), 22)}
                <Text style={styles.summaryCount}>
                    {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRight}>
                {ratingDist.map((d) => (
                    <View key={d.stars} style={styles.distributionRow}>
                        <View style={styles.distributionLabel}>
                            <Text style={styles.distributionStar}>{d.stars}</Text>
                            <Text style={styles.distributionStarIcon}>★</Text>
                        </View>
                        <View style={styles.distributionBarBg}>
                            <View
                                style={[
                                    styles.distributionBarFill,
                                    {
                                        width: `${d.pct}%`,
                                        backgroundColor: getBarColor(d.stars),
                                    },
                                ]}
                            />
                        </View>
                        <Text style={styles.distributionCount}>{d.count}</Text>
                    </View>
                ))}
            </View>
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Reviews</Text>
                <TouchableOpacity onPress={handleExportCSV} style={styles.headerButton}>
                    <Ionicons name="download-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={reviews}
                renderItem={renderReview}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
                ListHeaderComponent={reviews.length > 0 ? renderSummary : null}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>No reviews yet</Text>
                        <Text style={styles.emptyText}>Complete sessions to start receiving reviews!</Text>
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
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
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
    listContent: {
        paddingHorizontal: Spacing.xxl,
        paddingTop: Spacing.lg,
        paddingBottom: 100,
    },
    // Summary card
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.xl,
        marginBottom: Spacing.xl,
        ...Shadows.medium,
    },
    summaryLeft: {
        alignItems: 'center',
        paddingRight: Spacing.xl,
    },
    summaryDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: Colors.border,
        marginRight: Spacing.xl,
    },
    summaryRight: {
        flex: 1,
        gap: Spacing.sm,
    },
    summaryRating: {
        fontSize: 52,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
        lineHeight: 58,
        marginBottom: Spacing.xs,
    },
    summaryCount: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: Spacing.xs,
    },
    // Distribution
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    distributionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 28,
        justifyContent: 'flex-end',
        gap: 2,
    },
    distributionStar: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.heavy,
        color: 'rgba(255,255,255,0.7)',
    },
    distributionStarIcon: {
        fontSize: FontSize.xs,
        color: '#F59E0B',
    },
    distributionBarBg: {
        flex: 1,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    distributionBarFill: {
        height: '100%',
        borderRadius: 5,
        minWidth: 2,
    },
    distributionCount: {
        width: 30,
        textAlign: 'right',
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },
    // Stars
    starsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    // Review card
    reviewCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.medium,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    reviewHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    reviewAvatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    reviewAvatarText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.heavy,
        color: Colors.textSecondary,
    },
    reviewInfo: {
        flex: 1,
    },
    reviewName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 2,
    },
    reviewDate: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
    reviewTextContainer: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
    },
    reviewText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    reviewTextEmpty: {
        fontSize: FontSize.md,
        color: Colors.textMuted,
        fontStyle: 'italic',
    },
    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: Spacing.xxl,
    },
    emptyIconContainer: {
        marginBottom: Spacing.lg,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
