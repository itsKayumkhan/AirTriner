import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, ReviewRow, UserRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function TrainerDetailScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const { trainerId, trainer } = route.params;
    const [reviews, setReviews] = useState<(ReviewRow & { reviewer: UserRow })[]>([]);
    const [isBooking, setIsBooking] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        const { data } = await supabase
            .from('reviews')
            .select('*, reviewer:users!reviews_reviewer_id_fkey(*)')
            .eq('reviewee_id', trainerId)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(10);
        setReviews((data || []) as any);
    };

    const handleBooking = async () => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to book a session');
            return;
        }
        setIsBooking(true);
        try {
            const { data: booking, error } = await supabase.from('bookings').insert({
                athlete_id: user.id,
                trainer_id: trainerId,
                sport: trainer.sports?.[0] || 'General',
                scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(),
                duration_minutes: 60,
                price: Number(trainer.hourly_rate || 50),
                platform_fee: Number(trainer.hourly_rate || 50) * 0.03,
                total_paid: Number(trainer.hourly_rate || 50) * 1.03,
                status: 'pending',
            }).select().single();

            if (error) throw error;

            // Send initial message so the conversation appears in Messages tab
            if (booking) {
                await supabase.from('messages').insert({
                    booking_id: booking.id,
                    sender_id: user.id,
                    content: `Hi! I'd like to book a ${trainer.sports?.[0] || 'training'} session with you.`,
                });

                // Notify the trainer about the new booking
                await createNotification({
                    userId: trainerId,
                    type: 'NEW_REQUEST_NEARBY',
                    title: 'New Booking Request! 🏋️',
                    body: `${user.firstName} ${user.lastName} wants to book a ${trainer.sports?.[0] || 'training'} session with you.`,
                    data: { bookingId: booking.id },
                });
            }

            Alert.alert('Booking Requested!', 'Your booking request has been sent. The trainer will confirm shortly.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error: any) {
            Alert.alert('Booking Failed', error.message);
        } finally {
            setIsBooking(false);
        }
    };

    const handleMessage = async () => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to message this trainer');
            return;
        }
        try {
            // Find existing booking/conversation with this trainer
            const { data: existingBookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('athlete_id', user.id)
                .eq('trainer_id', trainerId)
                .in('status', ['pending', 'confirmed'])
                .order('created_at', { ascending: false })
                .limit(1);

            if (existingBookings && existingBookings.length > 0) {
                navigation.navigate('Chat', {
                    bookingId: existingBookings[0].id,
                    otherUser: trainer.users,
                });
            } else {
                // Create a pending booking to start a conversation
                const { data: newBooking, error } = await supabase.from('bookings').insert({
                    athlete_id: user.id,
                    trainer_id: trainerId,
                    sport: trainer.sports?.[0] || 'General',
                    scheduled_at: new Date(Date.now() + 86400000 * 7).toISOString(),
                    duration_minutes: 60,
                    price: Number(trainer.hourly_rate || 50),
                    platform_fee: Number(trainer.hourly_rate || 50) * 0.03,
                    total_paid: Number(trainer.hourly_rate || 50) * 1.03,
                    status: 'pending',
                }).select().single();

                if (error) throw error;
                navigation.navigate('Chat', {
                    bookingId: newBooking.id,
                    otherUser: trainer.users,
                });
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to open chat');
        }
    };

    const initials = (trainer.users?.first_name?.[0] || '') + (trainer.users?.last_name?.[0] || '');

    const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 'N/A';

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>

                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <LinearGradient
                        colors={[Colors.primary, Colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarGradient}
                    >
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    </LinearGradient>
                    <View style={styles.nameRow}>
                        <Text style={styles.trainerName}>
                            {trainer.users?.first_name} {trainer.users?.last_name}
                        </Text>
                        {trainer.is_verified && (
                            <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                        )}
                    </View>
                    <Text style={styles.headline}>{trainer.headline || 'Professional Sports Trainer'}</Text>

                    {/* Badges */}
                    <View style={styles.badgeRow}>
                        {trainer.is_verified && (
                            <View style={[styles.badge, { backgroundColor: '#45D0FF' }]}>
                                <Ionicons name="shield-checkmark" size={14} color="#0A0D14" />
                                <Text style={[styles.badgeText, { color: '#0A0D14' }]}>Verified</Text>
                            </View>
                        )}
                        <View style={[styles.badge, { backgroundColor: Colors.infoLight }]}>
                            <Ionicons name="trophy" size={14} color={Colors.info} />
                            <Text style={[styles.badgeText, { color: Colors.info }]}>{trainer.years_experience || 0}yr</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: Colors.warningLight }]}>
                            <Ionicons name="star" size={14} color={Colors.warning} />
                            <Text style={[styles.badgeText, { color: Colors.warning }]}>{avgRating}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>${Number(trainer.hourly_rate || 50).toFixed(0)}</Text>
                        <Text style={styles.statLabel}>per hour</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{trainer.total_sessions || 0}</Text>
                        <Text style={styles.statLabel}>sessions</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{Number(trainer.completion_rate || 100).toFixed(0)}%</Text>
                        <Text style={styles.statLabel}>completion</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{trainer.travel_radius_miles || 25}mi</Text>
                        <Text style={styles.statLabel}>radius</Text>
                    </View>
                </View>

                {/* Bio */}
                {trainer.bio && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bioText}>{trainer.bio}</Text>
                    </View>
                )}

                {/* Sports */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sports</Text>
                    <View style={styles.sportsContainer}>
                        {(trainer.sports || []).map((sport: string) => (
                            <View key={sport} style={styles.sportChip}>
                                <Text style={styles.sportChipText}>{sport}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Location */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.locationCard}>
                        <Ionicons name="location" size={20} color={Colors.primary} />
                        <Text style={styles.locationText}>
                            {trainer.city || 'Not specified'}{trainer.state ? `, ${trainer.state}` : ''}{trainer.country ? `, ${trainer.country}` : ''}
                        </Text>
                    </View>
                </View>

                {/* Reviews */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Reviews</Text>
                        <Text style={styles.sectionCount}>{reviews.length}</Text>
                    </View>
                    {reviews.length > 0 ? (
                        reviews.map((review) => (
                            <View key={review.id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewerAvatar}>
                                        <Text style={styles.reviewerAvatarText}>
                                            {(review.reviewer?.first_name?.[0] || '') + (review.reviewer?.last_name?.[0] || '')}
                                        </Text>
                                    </View>
                                    <View style={styles.reviewerInfo}>
                                        <Text style={styles.reviewerName}>
                                            {review.reviewer?.first_name} {review.reviewer?.last_name}
                                        </Text>
                                        <View style={styles.starsRow}>
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Ionicons key={s} name="star" size={14} color={s <= review.rating ? '#45D0FF' : Colors.textTertiary} />
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewDate}>
                                        {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                                {review.review_text && <Text style={styles.reviewText}>{review.review_text}</Text>}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noReviews}>No reviews yet</Text>
                    )}
                </View>

                {/* Spacer for bottom button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Book Button */}
            {user?.role === 'athlete' && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity onPress={handleMessage} style={styles.messageBtn}>
                        <Ionicons name="chatbubble-outline" size={22} color="#45D0FF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleBooking} disabled={isBooking} activeOpacity={0.8} style={[styles.bookButton, { flex: 1 }]}>
                        {isBooking ? (
                            <ActivityIndicator color="#0A0D14" size="small" />
                        ) : (
                            <>
                                <Ionicons name="calendar" size={20} color="#0A0D14" />
                                <Text style={styles.bookButtonText}>Book Session</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    scrollContent: { paddingHorizontal: Spacing.xxl, paddingTop: 56 },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    profileHeader: { alignItems: 'center', marginBottom: Spacing.xxxl },
    avatarGradient: { width: 100, height: 100, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.glow },
    avatar: { width: 92, height: 92, borderRadius: 28, backgroundColor: '#0A0D14', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
    trainerName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    headline: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
    badgeRow: { flexDirection: 'row', gap: Spacing.sm },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill },
    badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxxl },
    statCard: { flex: 1, minWidth: '45%', backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    section: { marginBottom: Spacing.xxl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.md },
    sectionCount: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
    bioText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
    sportsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    sportChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, backgroundColor: Colors.primaryGlow },
    sportChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#45D0FF' },
    locationCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: '#161B22', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    locationText: { fontSize: FontSize.md, color: '#FFFFFF' },
    reviewCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    reviewerAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    reviewerAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#45D0FF' },
    reviewerInfo: { flex: 1 },
    reviewerName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    starsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
    reviewDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
    reviewText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
    noReviews: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xxl },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg, paddingBottom: 36, backgroundColor: '#161B22', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: Spacing.lg },
    messageBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(69,208,255,0.3)', backgroundColor: '#161B22', justifyContent: 'center', alignItems: 'center' },
    priceContainer: {},
    priceLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
    priceValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    bookButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: BorderRadius.md, gap: Spacing.sm, backgroundColor: '#45D0FF', shadowColor: '#45D0FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
    bookButtonText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#0A0D14' },
});
