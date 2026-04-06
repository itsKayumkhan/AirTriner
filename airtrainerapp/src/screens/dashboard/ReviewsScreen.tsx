import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, ReviewRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

type ReviewWithUser = ReviewRow & { reviewer: UserRow; reviewee: UserRow };

export default function ReviewsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isTrainer = user?.role === 'trainer';

    const fetchReviews = useCallback(async () => {
        if (!user) return;
        try {
            const query = isTrainer
                ? supabase.from('reviews').select('*, reviewer:users!reviews_reviewer_id_fkey(*), reviewee:users!reviews_reviewee_id_fkey(*)').eq('reviewee_id', user.id)
                : supabase.from('reviews').select('*, reviewer:users!reviews_reviewer_id_fkey(*), reviewee:users!reviews_reviewee_id_fkey(*)').eq('reviewer_id', user.id);

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setReviews((data || []) as ReviewWithUser[]);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, isTrainer]);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const onRefresh = async () => { setRefreshing(true); await fetchReviews(); setRefreshing(false); };

    const renderStars = (rating: number) => (
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name={star <= rating ? 'star' : 'star-outline'} size={16} color={star <= rating ? '#45D0FF' : 'rgba(69,208,255,0.3)'} />
            ))}
        </View>
    );

    const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

    const distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => r.rating === star).length }));
    const maxCount = Math.max(...distribution.map(d => d.count), 1);

    const getBarColor = (star: number) => {
        if (star >= 4) return '#10B981';
        if (star === 3) return '#F59E0B';
        return '#EF4444';
    };

    const handleExportCSV = async () => {
        try {
            const header = 'Date,Reviewer,Rating,Review';
            const rows = reviews.map(r => {
                const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const reviewer = `${r.reviewer?.first_name || ''} ${r.reviewer?.last_name || ''}`.trim();
                const reviewText = (r.review_text || '').replace(/"/g, '""');
                return `${date},"${reviewer}",${r.rating},"${reviewText}"`;
            });
            const csv = [header, ...rows].join('\n');
            await Share.share({ message: csv, title: 'Reviews Export' });
        } catch (error) {
            console.error('Error exporting reviews:', error);
        }
    };

    const renderReview = ({ item }: { item: ReviewWithUser }) => {
        const displayUser = isTrainer ? item.reviewer : item.reviewee;
        return (
            <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                    <LinearGradient
                        colors={['#45D0FF', '#0047AB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.reviewAvatar}
                    >
                        <Text style={styles.reviewAvatarText}>{(displayUser?.first_name?.[0] || '') + (displayUser?.last_name?.[0] || '')}</Text>
                    </LinearGradient>
                    <View style={styles.reviewInfo}>
                        <Text style={styles.reviewName}>{displayUser?.first_name} {displayUser?.last_name}</Text>
                        <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                    {renderStars(item.rating)}
                </View>
                {item.review_text && <Text style={styles.reviewText}>{item.review_text}</Text>}
                {item.categories && (
                    <View style={styles.categoriesRow}>
                        {Object.entries(item.categories).map(([key, val]) => (
                            <View key={key} style={styles.categoryTag}>
                                <Text style={styles.categoryText}>{key}: {val}/5</Text>
                            </View>
                        ))}
                    </View>
                )}
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
                <Text style={styles.headerTitle}>{isTrainer ? 'My Reviews' : 'Reviews Written'}</Text>
                <TouchableOpacity onPress={handleExportCSV} style={styles.backButton}>
                    <Ionicons name="download-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {reviews.length > 0 && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryRating}>{avgRating}</Text>
                    {renderStars(Math.round(Number(avgRating)))}
                    <Text style={styles.summaryCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>

                    <View style={styles.distributionContainer}>
                        {distribution.map(({ star, count }) => (
                            <View key={star} style={styles.distributionRow}>
                                <Text style={styles.distributionStar}>{star}★</Text>
                                <View style={styles.distributionBarBg}>
                                    <View style={[styles.distributionBarFill, { width: `${(count / maxCount) * 100}%`, backgroundColor: getBarColor(star) }]} />
                                </View>
                                <Text style={styles.distributionCount}>{count}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <FlatList
                data={reviews}
                renderItem={renderReview}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="star-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
                        <Text style={styles.emptyText}>{isTrainer ? 'Complete sessions to receive reviews.' : 'Book and complete sessions to write reviews.'}</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    summaryCard: { alignItems: 'center', padding: Spacing.xl, marginHorizontal: Spacing.xxl, marginTop: Spacing.lg, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: Spacing.xs },
    summaryRating: { fontSize: 40, fontWeight: FontWeight.bold, color: '#45D0FF' },
    summaryCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
    distributionContainer: { marginTop: Spacing.md, gap: Spacing.xs, width: '100%' },
    distributionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    distributionStar: { width: 20, fontSize: FontSize.xs, color: Colors.textSecondary },
    distributionBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.surface },
    distributionBarFill: { height: 8, borderRadius: 4, minWidth: 4 },
    distributionCount: { width: 30, textAlign: 'right', fontSize: FontSize.xs, color: Colors.textSecondary },
    listContent: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: 100 },
    reviewCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    reviewAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    reviewAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    reviewInfo: { flex: 1 },
    reviewName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    reviewDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
    starsRow: { flexDirection: 'row', gap: 2 },
    reviewText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginTop: Spacing.sm },
    categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    categoryTag: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface },
    categoryText: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
