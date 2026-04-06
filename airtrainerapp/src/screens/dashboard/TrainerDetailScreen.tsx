import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
    Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, ReviewRow, UserRow } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import Founding50Badge from '../../components/Founding50Badge';

const getDefaultDate = () => {
    const d = new Date(Date.now() + 86400000 * 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const DURATION_OPTIONS = [30, 45, 60, 90];

type SubAccount = {
    id: string;
    parent_user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    [key: string]: any;
};

type AvailabilitySlot = {
    id: string;
    trainer_id: string;
    day_of_week: number;
    start_time: string; // "HH:MM"
    end_time: string;   // "HH:MM"
    is_blocked: boolean;
};

type ExistingBooking = {
    scheduled_at: string;
    duration_minutes: number;
};

/**
 * Parse "HH:MM" or "HH:MM:SS" into total minutes since midnight.
 */
const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
};

/**
 * Format hour (0-23) into "h:mm AM/PM".
 */
const formatHour = (hour: number, minute: number = 0): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    const mm = String(minute).padStart(2, '0');
    return `${h}:${mm} ${period}`;
};

export default function TrainerDetailScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const { trainerId, trainer } = route.params;
    const [reviews, setReviews] = useState<(ReviewRow & { reviewer: UserRow })[]>([]);
    const [isBooking, setIsBooking] = useState(false);

    // Booking modal state
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getDefaultDate());
    const [selectedSport, setSelectedSport] = useState<string>(
        trainer.sports?.length === 1 ? trainer.sports[0] : ''
    );

    // New booking state
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [noAvailability, setNoAvailability] = useState(false);

    // Sub-account state
    const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
    const [selectedSubAccount, setSelectedSubAccount] = useState<SubAccount | null>(null);
    const [showSubAccountPicker, setShowSubAccountPicker] = useState(false);

    // Platform fee
    const [platformFeePercent, setPlatformFeePercent] = useState(3);

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

    const fetchPlatformFee = async () => {
        try {
            const { data: settings } = await supabase
                .from('platform_settings')
                .select('platform_fee_percentage')
                .single();
            if (settings?.platform_fee_percentage != null) {
                setPlatformFeePercent(Number(settings.platform_fee_percentage));
            }
        } catch {
            // Keep default 3%
        }
    };

    const fetchSubAccounts = async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('sub_accounts')
                .select('*')
                .eq('parent_user_id', user.id);
            setSubAccounts((data || []) as SubAccount[]);
        } catch {
            setSubAccounts([]);
        }
    };

    const fetchAvailability = useCallback(async (date: string) => {
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            setAvailableSlots([]);
            setUnavailableSlots(new Set());
            setNoAvailability(false);
            return;
        }

        setLoadingSlots(true);
        setSelectedTime('');
        setNoAvailability(false);

        try {
            const dayOfWeek = new Date(date + 'T12:00:00').getDay();

            // Fetch availability slots and existing bookings in parallel
            const [slotsRes, bookingsRes] = await Promise.all([
                supabase
                    .from('availability_slots')
                    .select('*')
                    .eq('trainer_id', trainerId)
                    .eq('day_of_week', dayOfWeek)
                    .eq('is_blocked', false),
                supabase
                    .from('bookings')
                    .select('scheduled_at, duration_minutes')
                    .eq('trainer_id', trainerId)
                    .in('status', ['pending', 'confirmed'])
                    .gte('scheduled_at', `${date}T00:00:00`)
                    .lte('scheduled_at', `${date}T23:59:59`),
            ]);

            const slots: AvailabilitySlot[] = slotsRes.data || [];
            const existingBookings: ExistingBooking[] = bookingsRes.data || [];

            if (slots.length === 0) {
                setAvailableSlots([]);
                setNoAvailability(true);
                setLoadingSlots(false);
                return;
            }

            // Generate hourly time slots from availability windows
            const allTimeSlots: string[] = [];
            const conflicting = new Set<string>();

            for (const slot of slots) {
                const startMin = timeToMinutes(slot.start_time);
                const endMin = timeToMinutes(slot.end_time);

                // Generate slots on the hour within the window
                for (let min = startMin; min < endMin; min += 60) {
                    const hour = Math.floor(min / 60);
                    const minute = min % 60;
                    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    if (!allTimeSlots.includes(timeStr)) {
                        allTimeSlots.push(timeStr);
                    }
                }
            }

            // Sort time slots
            allTimeSlots.sort();

            // Check for conflicts with existing bookings
            for (const timeStr of allTimeSlots) {
                const slotStartMin = timeToMinutes(timeStr);

                for (const booking of existingBookings) {
                    const bookingDate = new Date(booking.scheduled_at);
                    const bookingStartMin = bookingDate.getHours() * 60 + bookingDate.getMinutes();
                    const bookingEndMin = bookingStartMin + (booking.duration_minutes || 60);

                    // Check if this slot overlaps with the booking
                    // A slot at slotStartMin with default duration would overlap if:
                    // slotStartMin < bookingEndMin AND slotStartMin + duration > bookingStartMin
                    if (slotStartMin < bookingEndMin && slotStartMin + 60 > bookingStartMin) {
                        conflicting.add(timeStr);
                        break;
                    }
                }
            }

            setAvailableSlots(allTimeSlots);
            setUnavailableSlots(conflicting);
            setNoAvailability(allTimeSlots.length === 0);
        } catch {
            setAvailableSlots([]);
            setNoAvailability(true);
        } finally {
            setLoadingSlots(false);
        }
    }, [trainerId]);

    // Re-fetch availability when date changes
    useEffect(() => {
        if (showBookingModal && selectedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fetchAvailability(selectedDate);
        }
    }, [selectedDate, showBookingModal, fetchAvailability]);

    const handleBookingPress = () => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to book a session');
            return;
        }
        // Reset to defaults each time modal opens
        const defaultDate = getDefaultDate();
        setSelectedDate(defaultDate);
        setSelectedSport(trainer.sports?.length === 1 ? trainer.sports[0] : '');
        setSelectedTime('');
        setSelectedDuration(60);
        setSelectedSubAccount(null);
        setShowSubAccountPicker(false);
        setShowBookingModal(true);

        // Fetch ancillary data
        fetchPlatformFee();
        fetchSubAccounts();
    };

    // Price calculations
    const hourlyRate = Number(trainer.hourly_rate || 50);
    const sessionPrice = hourlyRate * (selectedDuration / 60);
    const platformFee = sessionPrice * (platformFeePercent / 100);
    const totalPrice = sessionPrice + platformFee;

    const handleConfirmBooking = async () => {
        if (!selectedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            Alert.alert('Invalid Date', 'Please enter a date in YYYY-MM-DD format.');
            return;
        }
        if (!selectedSport) {
            Alert.alert('Select Sport', 'Please select a sport for your session.');
            return;
        }
        if (!selectedTime) {
            Alert.alert('Select Time', 'Please select a time slot for your session.');
            return;
        }
        setShowBookingModal(false);
        setIsBooking(true);
        try {
            const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
            const price = hourlyRate * (selectedDuration / 60);
            const fee = price * (platformFeePercent / 100);
            const totalPaid = price + fee;

            const { data: booking, error } = await supabase.from('bookings').insert({
                athlete_id: user!.id,
                trainer_id: trainerId,
                sub_account_id: selectedSubAccount?.id || null,
                sport: selectedSport,
                scheduled_at: scheduledAt,
                duration_minutes: selectedDuration,
                price,
                platform_fee: fee,
                total_paid: totalPaid,
                status: 'pending',
                status_history: [{ status: 'pending', timestamp: new Date().toISOString() }],
            }).select().single();

            if (error) throw error;

            if (booking) {
                const bookingForLabel = selectedSubAccount
                    ? `${selectedSubAccount.first_name}`
                    : 'myself';
                await supabase.from('messages').insert({
                    booking_id: booking.id,
                    sender_id: user!.id,
                    content: `Hi! I'd like to book a ${selectedSport} session with you on ${selectedDate} at ${formatHour(
                        parseInt(selectedTime.split(':')[0]),
                        parseInt(selectedTime.split(':')[1])
                    )} for ${selectedDuration} minutes (for ${bookingForLabel}).`,
                });

                await createNotification({
                    userId: trainerId,
                    type: 'NEW_REQUEST_NEARBY',
                    title: 'New Booking Request! 🏋️',
                    body: `${user!.firstName} ${user!.lastName} wants to book a ${selectedSport} session with you.`,
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

    const handleMessage = () => {
        Alert.alert('Messaging', 'Send a message to this trainer by booking a session first.');
    };

    const initials = (trainer.users?.first_name?.[0] || '') + (trainer.users?.last_name?.[0] || '');

    const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 'N/A';

    const sports: string[] = trainer.sports || [];

    // Verification badge logic
    const totalSessions = trainer.total_sessions || 0;
    const completionRate = trainer.completion_rate || 0;
    const reliabilityScore = trainer.reliability_score || 0;
    const isPerformanceVerified = totalSessions >= 3 && completionRate >= 95 && reliabilityScore >= 4.5;
    const isProCoach = totalSessions > 0 && !isPerformanceVerified;
    const isNew = totalSessions === 0;

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
                    {trainer.is_founding_50 && (
                        <View style={{ marginBottom: 8 }}>
                            <Founding50Badge size="medium" />
                        </View>
                    )}
                    <Text style={styles.headline}>{trainer.headline || 'Professional Sports Trainer'}</Text>

                    {/* Badges */}
                    <View style={styles.badgeRow}>
                        {trainer.is_verified && (
                            <View style={[styles.badge, { backgroundColor: '#45D0FF' }]}>
                                <Ionicons name="shield-checkmark" size={14} color="#0A0D14" />
                                <Text style={[styles.badgeText, { color: '#0A0D14' }]}>Verified</Text>
                            </View>
                        )}
                        {isPerformanceVerified && (
                            <View style={[styles.badge, styles.badgePillGreen]}>
                                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                                <Text style={[styles.badgeText, { color: '#10B981' }]}>Performance Verified</Text>
                            </View>
                        )}
                        {isProCoach && (
                            <View style={[styles.badge, styles.badgePillBlue]}>
                                <Ionicons name="ribbon" size={14} color="#45D0FF" />
                                <Text style={[styles.badgeText, { color: '#45D0FF' }]}>Pro Coach</Text>
                            </View>
                        )}
                        {isNew && (
                            <View style={[styles.badge, styles.badgePillGray]}>
                                <Ionicons name="sparkles" size={14} color="#9CA3AF" />
                                <Text style={[styles.badgeText, { color: '#9CA3AF' }]}>New</Text>
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
                    <TouchableOpacity onPress={handleBookingPress} disabled={isBooking} activeOpacity={0.8} style={[styles.bookButton, { flex: 1 }]}>
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

            {/* Booking Modal */}
            <Modal
                visible={showBookingModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowBookingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            <Text style={styles.modalTitle}>Book Session</Text>

                            {/* Date Input */}
                            <Text style={styles.modalLabel}>Session Date</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={selectedDate}
                                onChangeText={setSelectedDate}
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                            />

                            {/* Time Slot Selection */}
                            <Text style={styles.modalLabel}>Time Slot</Text>
                            {loadingSlots ? (
                                <View style={styles.slotsLoadingContainer}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                    <Text style={styles.slotsLoadingText}>Checking availability...</Text>
                                </View>
                            ) : noAvailability ? (
                                <View style={styles.noSlotsContainer}>
                                    <Ionicons name="calendar-outline" size={20} color={Colors.textTertiary} />
                                    <Text style={styles.noSlotsText}>No availability on this date</Text>
                                </View>
                            ) : availableSlots.length > 0 ? (
                                <View style={styles.timeSlotsGrid}>
                                    {availableSlots.map((timeStr) => {
                                        const isUnavailable = unavailableSlots.has(timeStr);
                                        const isSelected = selectedTime === timeStr;
                                        const hour = parseInt(timeStr.split(':')[0]);
                                        const minute = parseInt(timeStr.split(':')[1]);

                                        return (
                                            <TouchableOpacity
                                                key={timeStr}
                                                style={[
                                                    styles.timeSlotButton,
                                                    isSelected && styles.timeSlotSelected,
                                                    isUnavailable && styles.timeSlotUnavailable,
                                                ]}
                                                onPress={() => {
                                                    if (!isUnavailable) setSelectedTime(timeStr);
                                                }}
                                                disabled={isUnavailable}
                                                activeOpacity={isUnavailable ? 1 : 0.7}
                                            >
                                                <Text
                                                    style={[
                                                        styles.timeSlotText,
                                                        isSelected && styles.timeSlotTextSelected,
                                                        isUnavailable && styles.timeSlotTextUnavailable,
                                                    ]}
                                                >
                                                    {formatHour(hour, minute)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={styles.slotsHintText}>Enter a valid date to see available times</Text>
                            )}

                            {/* Duration Selector */}
                            <Text style={styles.modalLabel}>Duration</Text>
                            <View style={styles.durationRow}>
                                {DURATION_OPTIONS.map((dur) => (
                                    <TouchableOpacity
                                        key={dur}
                                        style={[
                                            styles.durationChip,
                                            selectedDuration === dur && styles.durationChipSelected,
                                        ]}
                                        onPress={() => setSelectedDuration(dur)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.durationChipText,
                                                selectedDuration === dur && styles.durationChipTextSelected,
                                            ]}
                                        >
                                            {dur} min
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Sport Selector */}
                            {sports.length > 1 && (
                                <>
                                    <Text style={styles.modalLabel}>Select Sport</Text>
                                    <View style={styles.sportSelectorRow}>
                                        {sports.map((sport) => (
                                            <TouchableOpacity
                                                key={sport}
                                                style={[
                                                    styles.sportOption,
                                                    selectedSport === sport && styles.sportOptionSelected,
                                                ]}
                                                onPress={() => setSelectedSport(sport)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.sportOptionText,
                                                        selectedSport === sport && styles.sportOptionTextSelected,
                                                    ]}
                                                >
                                                    {sport}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            {sports.length === 1 && (
                                <>
                                    <Text style={styles.modalLabel}>Sport</Text>
                                    <View style={[styles.sportOption, styles.sportOptionSelected, { alignSelf: 'flex-start' }]}>
                                        <Text style={styles.sportOptionTextSelected}>{sports[0]}</Text>
                                    </View>
                                </>
                            )}

                            {/* Sub-Account Selector */}
                            <Text style={styles.modalLabel}>Booking For</Text>
                            <TouchableOpacity
                                style={styles.subAccountSelector}
                                onPress={() => setShowSubAccountPicker(!showSubAccountPicker)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.subAccountSelectorLeft}>
                                    <View style={styles.subAccountAvatar}>
                                        <Ionicons
                                            name={selectedSubAccount ? 'person' : 'person-circle'}
                                            size={18}
                                            color={Colors.primary}
                                        />
                                    </View>
                                    <Text style={styles.subAccountSelectorText}>
                                        {selectedSubAccount
                                            ? `${selectedSubAccount.first_name} ${selectedSubAccount.last_name}`
                                            : 'Myself'}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={showSubAccountPicker ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={Colors.textTertiary}
                                />
                            </TouchableOpacity>

                            {showSubAccountPicker && (
                                <View style={styles.subAccountDropdown}>
                                    {/* Myself option */}
                                    <TouchableOpacity
                                        style={[
                                            styles.subAccountOption,
                                            !selectedSubAccount && styles.subAccountOptionActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedSubAccount(null);
                                            setShowSubAccountPicker(false);
                                        }}
                                    >
                                        <View style={styles.subAccountAvatar}>
                                            <Ionicons name="person-circle" size={18} color={Colors.primary} />
                                        </View>
                                        <Text style={[
                                            styles.subAccountOptionText,
                                            !selectedSubAccount && styles.subAccountOptionTextActive,
                                        ]}>
                                            Myself
                                        </Text>
                                        {!selectedSubAccount && (
                                            <Ionicons name="checkmark" size={16} color={Colors.primary} />
                                        )}
                                    </TouchableOpacity>

                                    {subAccounts.map((acc) => (
                                        <TouchableOpacity
                                            key={acc.id}
                                            style={[
                                                styles.subAccountOption,
                                                selectedSubAccount?.id === acc.id && styles.subAccountOptionActive,
                                            ]}
                                            onPress={() => {
                                                setSelectedSubAccount(acc);
                                                setShowSubAccountPicker(false);
                                            }}
                                        >
                                            <View style={styles.subAccountAvatar}>
                                                <Text style={styles.subAccountAvatarText}>
                                                    {(acc.first_name?.[0] || '') + (acc.last_name?.[0] || '')}
                                                </Text>
                                            </View>
                                            <Text style={[
                                                styles.subAccountOptionText,
                                                selectedSubAccount?.id === acc.id && styles.subAccountOptionTextActive,
                                            ]}>
                                                {acc.first_name} {acc.last_name}
                                            </Text>
                                            {selectedSubAccount?.id === acc.id && (
                                                <Ionicons name="checkmark" size={16} color={Colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}

                                    {subAccounts.length === 0 && (
                                        <Text style={styles.noSubAccountsText}>No sub-accounts added</Text>
                                    )}
                                </View>
                            )}

                            {/* Price Breakdown */}
                            <Text style={styles.modalLabel}>Price Breakdown</Text>
                            <View style={styles.priceBreakdownCard}>
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceRowLabel}>
                                        Session ({selectedDuration} min)
                                    </Text>
                                    <Text style={styles.priceRowValue}>
                                        ${sessionPrice.toFixed(2)}
                                    </Text>
                                </View>
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceRowLabel}>
                                        Platform Fee ({platformFeePercent}%)
                                    </Text>
                                    <Text style={styles.priceRowValue}>
                                        ${platformFee.toFixed(2)}
                                    </Text>
                                </View>
                                <View style={styles.priceDivider} />
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceTotalLabel}>Total</Text>
                                    <Text style={styles.priceTotalValue}>
                                        ${totalPrice.toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {/* Actions */}
                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmBooking} activeOpacity={0.85}>
                                <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowBookingModal(false)} activeOpacity={0.7}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            {/* Bottom padding for scroll */}
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    badgeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.sm },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill },
    badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    badgePillGreen: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
    badgePillBlue: { backgroundColor: 'rgba(69, 208, 255, 0.15)' },
    badgePillGray: { backgroundColor: 'rgba(156, 163, 175, 0.15)' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxxl },
    statCard: { flex: 1, minWidth: 140, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
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
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#161B22', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xxl, paddingBottom: 48, borderTopWidth: 1, borderTopColor: 'rgba(69,208,255,0.15)', maxHeight: '90%' },
    modalTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.xl, textAlign: 'center' },
    modalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.lg },
    modalInput: { backgroundColor: '#0A0D14', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(69,208,255,0.25)', paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: FontSize.md, color: '#FFFFFF', marginBottom: Spacing.sm },
    sportSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    sportOption: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' },
    sportOptionSelected: { borderColor: '#45D0FF', backgroundColor: 'rgba(69,208,255,0.12)' },
    sportOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    sportOptionTextSelected: { color: '#45D0FF', fontWeight: FontWeight.semibold },
    modalPriceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xl, marginBottom: Spacing.sm },
    modalPriceText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#45D0FF' },
    confirmButton: { marginTop: Spacing.xl, height: 52, borderRadius: BorderRadius.md, backgroundColor: '#45D0FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#45D0FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
    confirmButtonText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#0A0D14' },
    cancelButton: { marginTop: Spacing.md, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    cancelButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textSecondary },

    // Time slots
    timeSlotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    timeSlotButton: {
        width: '31%',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeSlotSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    timeSlotUnavailable: {
        backgroundColor: Colors.surface,
        borderColor: 'rgba(255,255,255,0.04)',
        opacity: 0.45,
    },
    timeSlotText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    timeSlotTextSelected: {
        color: '#0A0D14',
        fontWeight: FontWeight.bold,
    },
    timeSlotTextUnavailable: {
        color: Colors.textTertiary,
    },
    slotsLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
    },
    slotsLoadingText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    noSlotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.md,
    },
    noSlotsText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
    slotsHintText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        paddingVertical: Spacing.sm,
    },

    // Duration chips
    durationRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    durationChip: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'transparent',
        alignItems: 'center',
    },
    durationChipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    durationChipText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    durationChipTextSelected: {
        color: '#0A0D14',
        fontWeight: FontWeight.bold,
    },

    // Sub-account selector
    subAccountSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0A0D14',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(69,208,255,0.25)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    subAccountSelectorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    subAccountSelectorText: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: FontWeight.medium,
    },
    subAccountAvatar: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    subAccountAvatarText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    subAccountDropdown: {
        marginTop: Spacing.sm,
        backgroundColor: '#0A0D14',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    subAccountOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    subAccountOptionActive: {
        backgroundColor: Colors.primaryGlow,
    },
    subAccountOptionText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    subAccountOptionTextActive: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    noSubAccountsText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        textAlign: 'center',
    },

    // Price breakdown
    priceBreakdownCard: {
        backgroundColor: '#0A0D14',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: Spacing.lg,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    priceRowLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    priceRowValue: {
        fontSize: FontSize.sm,
        color: Colors.text,
        fontWeight: FontWeight.medium,
    },
    priceDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginVertical: Spacing.sm,
    },
    priceTotalLabel: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: FontWeight.bold,
    },
    priceTotalValue: {
        fontSize: FontSize.lg,
        color: Colors.primary,
        fontWeight: FontWeight.bold,
    },
});
