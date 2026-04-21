import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
    Modal, TextInput, Platform, Pressable, Image,
} from 'react-native';
import Animated, {
    FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MapView, Marker as MapsMarker, Circle as MapsCircle, PROVIDER_GOOGLE, MAPS_AVAILABLE } from '../../lib/maps';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, ReviewRow, UserRow } from '../../lib/supabase';
import { createNotification, scheduleSessionReminder } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout } from '../../theme';
import { formatSportName } from '../../lib/format';
import { miToKm } from '../../lib/units';
import {
    ScreenWrapper, ScreenHeader, Card, Avatar, Badge, Button,
    SectionHeader, StatCard, EmptyState, Divider,
} from '../../components/ui';
import Founding50Badge from '../../components/Founding50Badge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getDefaultDate = () => {
    const d = new Date(Date.now() + 86400000 * 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const DURATION_OPTIONS = [30, 45, 60, 90];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    start_time: string;
    end_time: string;
    is_blocked: boolean;
};

type ExistingBooking = {
    scheduled_at: string;
    duration_minutes: number;
};

const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
};

const formatHour = (hour: number, minute: number = 0): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    const mm = String(minute).padStart(2, '0');
    return `${h}:${mm} ${period}`;
};

/** Pressable card wrapper with scale feedback */
function PressableCard({ children, style, delay = 0 }: { children: React.ReactNode; style?: any; delay?: number }) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(delay).duration(250)}
            style={[animStyle, style]}
            onPressIn={() => { scale.value = withSpring(0.97); }}
            onPressOut={() => { scale.value = withSpring(1); }}
        >
            {children}
        </AnimatedPressable>
    );
}

export default function TrainerDetailScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const { trainerId, trainer } = route.params;
    const [reviews, setReviews] = useState<(ReviewRow & { reviewer: UserRow })[]>([]);
    const [isBooking, setIsBooking] = useState(false);
    const [bioExpanded, setBioExpanded] = useState(false);

    // Booking modal state
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getDefaultDate());
    const [selectedSport, setSelectedSport] = useState<string>(
        trainer.sports?.length === 1 ? trainer.sports[0] : ''
    );
    const [bookingNotes, setBookingNotes] = useState('');

    // New booking state
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [noAvailability, setNoAvailability] = useState(false);

    // Availability calendar data
    const [availableDays, setAvailableDays] = useState<Set<number>>(new Set());

    // Calendar green-highlight: date string (YYYY-MM-DD) → available slot count
    const [availableDates, setAvailableDates] = useState<Map<string, number>>(new Map());
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    // Sub-account state
    const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
    const [selectedSubAccount, setSelectedSubAccount] = useState<SubAccount | null>(null);
    const [showSubAccountPicker, setShowSubAccountPicker] = useState(false);

    // Platform fee
    const [platformFeePercent, setPlatformFeePercent] = useState(3);

    // Session duration for pricing display
    const [pricingDuration, setPricingDuration] = useState(60);

    // Admin-uploaded sport images keyed by slug (see sports.image_url)
    const [sportImages, setSportImages] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchReviews();
        fetchAvailableDays();
        loadAvailableDates();
        fetchSportImages();
    }, []);

    const fetchSportImages = async () => {
        const { data, error } = await supabase
            .from('sports')
            .select('slug, image_url')
            .eq('is_active', true);
        if (!error && data) {
            const map: Record<string, string> = {};
            (data as { slug: string; image_url: string | null }[]).forEach((s) => {
                if (s.image_url) map[s.slug] = s.image_url;
            });
            setSportImages(map);
        }
    };

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

    const fetchAvailableDays = async () => {
        try {
            const { data } = await supabase
                .from('availability_slots')
                .select('day_of_week')
                .eq('trainer_id', trainerId)
                .eq('is_blocked', false);
            const days = new Set((data || []).map((s: any) => s.day_of_week as number));

            // Also include days from recurring availability
            try {
                const { data: recurData, error: recurErr } = await supabase
                    .from('availability_recurring')
                    .select('day_of_week')
                    .eq('trainer_id', trainerId)
                    .eq('is_active', true);
                if (!recurErr && recurData?.length) {
                    recurData.forEach((r: any) => days.add(r.day_of_week as number));
                }
            } catch {
                // Recurring table may not exist — silently ignore
            }

            setAvailableDays(days);
        } catch {
            // ignore
        }
    };

    // Load available dates for calendar green highlights (next 60 days)
    const loadAvailableDates = useCallback(async () => {
        try {
            const formatDate = (d: Date) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            // 1. Fetch non-blocked availability_slots for this trainer
            const { data: slotsData, error: slotsErr } = await supabase
                .from('availability_slots')
                .select('day_of_week')
                .eq('trainer_id', trainerId)
                .eq('is_blocked', false);
            if (slotsErr) throw slotsErr;

            // Build map: day_of_week → count of slots
            const slotsByDow = new Map<number, number>();
            (slotsData || []).forEach((s: { day_of_week: number }) => {
                slotsByDow.set(s.day_of_week, (slotsByDow.get(s.day_of_week) || 0) + 1);
            });

            // 2. Fetch recurring availability
            const recurringByDow = new Map<number, number>();
            try {
                const { data: recurData, error: recurErr } = await supabase
                    .from('availability_recurring')
                    .select('day_of_week')
                    .eq('trainer_id', trainerId)
                    .eq('is_active', true);
                if (!recurErr && recurData?.length) {
                    recurData.forEach((r: { day_of_week: number }) => {
                        recurringByDow.set(r.day_of_week, (recurringByDow.get(r.day_of_week) || 0) + 1);
                    });
                }
            } catch {
                // Recurring table may not exist — silently ignore
            }

            // 3. Expand dates in the 60-day window that have at least one slot
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateSlotCounts = new Map<string, number>();
            for (let i = 0; i < 60; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() + i);
                const dow = d.getDay();
                const slotsCount = (slotsByDow.get(dow) || 0) + (recurringByDow.get(dow) || 0);
                if (slotsCount > 0) {
                    dateSlotCounts.set(formatDate(d), slotsCount);
                }
            }

            // 4. Subtract already-booked dates
            if (dateSlotCounts.size > 0) {
                const startDate = formatDate(today);
                const endDate = formatDate(new Date(today.getTime() + 59 * 86400000));
                const { data: bookingsData } = await supabase
                    .from('bookings')
                    .select('scheduled_at')
                    .eq('trainer_id', trainerId)
                    .in('status', ['pending', 'confirmed'])
                    .gte('scheduled_at', `${startDate}T00:00:00`)
                    .lte('scheduled_at', `${endDate}T23:59:59`);

                if (bookingsData?.length) {
                    // Count bookings per date
                    const bookingsPerDate = new Map<string, number>();
                    bookingsData.forEach((b: { scheduled_at: string }) => {
                        const bDate = b.scheduled_at.slice(0, 10);
                        bookingsPerDate.set(bDate, (bookingsPerDate.get(bDate) || 0) + 1);
                    });
                    // Subtract booking counts; remove dates where all slots are booked
                    bookingsPerDate.forEach((bookedCount, dateStr) => {
                        const totalSlots = dateSlotCounts.get(dateStr) || 0;
                        if (bookedCount >= totalSlots) {
                            dateSlotCounts.delete(dateStr);
                        } else {
                            dateSlotCounts.set(dateStr, totalSlots - bookedCount);
                        }
                    });
                }
            }

            setAvailableDates(dateSlotCounts);
        } catch {
            setAvailableDates(new Map());
        }
    }, [trainerId]);

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

            // Also fetch recurring availability for this day of week
            let recurringSlots: { start_time: string; end_time: string }[] = [];
            try {
                const { data: recurData, error: recurErr } = await supabase
                    .from('availability_recurring')
                    .select('start_time, end_time, is_active')
                    .eq('trainer_id', trainerId)
                    .eq('day_of_week', dayOfWeek)
                    .eq('is_active', true);

                if (!recurErr && recurData?.length) {
                    const activeDur = selectedDuration || 60;
                    recurData.forEach((r: { start_time: string; end_time: string }) => {
                        const startMins = parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]);
                        const endMins = parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]);
                        for (let t = startMins; t + activeDur <= endMins; t += activeDur) {
                            const sh = String(Math.floor(t / 60)).padStart(2, '0');
                            const sm = String(t % 60).padStart(2, '0');
                            const eh = String(Math.floor((t + activeDur) / 60)).padStart(2, '0');
                            const em = String((t + activeDur) % 60).padStart(2, '0');
                            recurringSlots.push({ start_time: `${sh}:${sm}`, end_time: `${eh}:${em}` });
                        }
                    });
                }
            } catch {
                // Recurring table may not exist — silently ignore
            }

            if (slots.length === 0 && recurringSlots.length === 0) {
                setAvailableSlots([]);
                setNoAvailability(true);
                setLoadingSlots(false);
                return;
            }

            const allTimeSlots: string[] = [];
            const conflicting = new Set<string>();

            for (const slot of slots) {
                const startMin = timeToMinutes(slot.start_time);
                const endMin = timeToMinutes(slot.end_time);

                for (let min = startMin; min < endMin; min += 60) {
                    const hour = Math.floor(min / 60);
                    const minute = min % 60;
                    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    if (!allTimeSlots.includes(timeStr)) {
                        allTimeSlots.push(timeStr);
                    }
                }
            }

            // Merge recurring slots, deduplicate by start_time
            const existingStarts = new Set(allTimeSlots);
            for (const rs of recurringSlots) {
                const timeStr = rs.start_time.slice(0, 5);
                if (!existingStarts.has(timeStr)) {
                    allTimeSlots.push(timeStr);
                    existingStarts.add(timeStr);
                }
            }

            allTimeSlots.sort();

            for (const timeStr of allTimeSlots) {
                const slotStartMin = timeToMinutes(timeStr);

                for (const booking of existingBookings) {
                    const bookingDate = new Date(booking.scheduled_at);
                    const bookingStartMin = bookingDate.getHours() * 60 + bookingDate.getMinutes();
                    const bookingEndMin = bookingStartMin + (booking.duration_minutes || 60);

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
    }, [trainerId, selectedDuration]);

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
        const defaultDate = getDefaultDate();
        setSelectedDate(defaultDate);
        setSelectedSport(trainer.sports?.length === 1 ? trainer.sports[0] : '');
        setSelectedTime('');
        setSelectedDuration(60);
        setSelectedSubAccount(null);
        setShowSubAccountPicker(false);
        setBookingNotes('');
        setShowBookingModal(true);

        // Set calendar month to match the default date
        const defDate = new Date(defaultDate + 'T12:00:00');
        setCalendarMonth({ year: defDate.getFullYear(), month: defDate.getMonth() });

        fetchPlatformFee();
        fetchSubAccounts();
        loadAvailableDates();
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

                const notesPart = bookingNotes.trim() ? `\n\nNotes: ${bookingNotes.trim()}` : '';
                await supabase.from('messages').insert({
                    booking_id: booking.id,
                    sender_id: user!.id,
                    content: `Hi! I'd like to book a ${selectedSport} session with you on ${selectedDate} at ${formatHour(
                        parseInt(selectedTime.split(':')[0]),
                        parseInt(selectedTime.split(':')[1])
                    )} for ${selectedDuration} minutes (for ${bookingForLabel}).${notesPart}`,
                });

                await createNotification({
                    userId: trainerId,
                    type: 'new_booking',
                    title: 'New Booking Request!',
                    body: `${user!.firstName} ${user!.lastName} wants to book a ${selectedSport} session with you.`,
                    data: { bookingId: booking.id },
                });

                const trainerDisplayName = trainer?.users
                    ? `${trainer.users.first_name} ${trainer.users.last_name}`
                    : `${trainer?.first_name || ''} ${trainer?.last_name || ''}`.trim() || 'your trainer';
                await scheduleSessionReminder({
                    bookingId: booking.id,
                    scheduledAt: scheduledAt,
                    trainerName: trainerDisplayName,
                    sport: selectedSport,
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

    const trainerFullName = `${trainer.users?.first_name || ''} ${trainer.users?.last_name || ''}`.trim();
    const avatarUrl = trainer.users?.avatar_url || trainer.avatar_url || null;

    const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : trainer.average_rating ? Number(trainer.average_rating).toFixed(1) : 'New';

    const sports: string[] = trainer.sports || [];
    const certifications: string[] = Array.isArray(trainer.certifications) ? trainer.certifications : [];

    // Verification badge logic
    const totalSessions = trainer.total_sessions || 0;
    const completionRate = trainer.completion_rate || 0;
    const reliabilityScore = trainer.reliability_score || 0;
    const isPerformanceVerified = totalSessions >= 3 && completionRate >= 95 && reliabilityScore >= 95;
    const isProCoach = totalSessions > 0 && !isPerformanceVerified;
    const isNew = totalSessions === 0;

    const bioText = trainer.bio || '';
    const isBioLong = bioText.length > 180;
    const displayBio = isBioLong && !bioExpanded ? bioText.slice(0, 180) + '...' : bioText;

    const reviewCount = trainer.total_reviews || reviews.length;

    return (
        <ScreenWrapper scrollable refreshing={false}>
            {/* Header with Back Button */}
            <ScreenHeader
                title=""
                onBack={() => navigation.goBack()}
            />

            {/* ─── 1. HERO SECTION ─── */}
            <Animated.View entering={FadeInDown.duration(250)} style={styles.heroSection}>
                {/* Glow ring */}
                <View style={styles.avatarGlow}>
                    <Avatar
                        uri={avatarUrl}
                        name={trainerFullName}
                        size={110}
                        borderColor={Colors.primary}
                    />
                </View>

                <Text style={styles.trainerName} accessibilityRole="header">
                    {trainerFullName}
                    {trainer.is_verified && '  '}
                    {trainer.is_verified && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                </Text>

                {trainer.is_founding_50 && (
                    <View style={styles.foundingBadgeWrap}>
                        <Founding50Badge size="medium" />
                    </View>
                )}

                {(trainer.city || trainer.state) && (
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={15} color={Colors.textSecondary} />
                        <Text style={styles.locationText}>
                            {trainer.city || ''}{trainer.state ? `, ${trainer.state}` : ''}
                        </Text>
                    </View>
                )}

                {/* Star rating */}
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color={Colors.warning} />
                    <Text style={styles.ratingValue}>{avgRating}</Text>
                    <Text style={styles.ratingCount}>({reviewCount} review{reviewCount !== 1 ? 's' : ''})</Text>
                </View>

                {/* Badge row */}
                <View style={styles.badgeRow}>
                    {trainer.is_verified && (
                        <Badge label="Verified" color={Colors.textInverse} bgColor={Colors.success} size="md" />
                    )}
                    {sports.map((sport: string) => {
                        const slug = String(sport).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
                        const imageUrl = sportImages[slug];
                        return (
                            <View key={sport} style={styles.sportBadgeRow}>
                                {imageUrl ? (
                                    <Image source={{ uri: imageUrl }} style={styles.sportBadgeImage} />
                                ) : null}
                                <Badge
                                    label={formatSportName(sport)}
                                    color={Colors.primary}
                                    bgColor={Colors.primaryGlow}
                                    size="md"
                                />
                            </View>
                        );
                    })}
                    {isPerformanceVerified && (
                        <Badge label="Performance Verified" color={Colors.success} bgColor={Colors.successLight} size="md" />
                    )}
                    {isProCoach && (
                        <Badge label="Pro Coach" color={Colors.primary} bgColor={Colors.primaryGlow} size="md" />
                    )}
                    {isNew && (
                        <Badge label="New" color={Colors.textSecondary} bgColor={Colors.glass} size="md" />
                    )}
                    <Badge
                        label={`${trainer.years_experience || 0}yr exp`}
                        color={Colors.info}
                        bgColor={Colors.infoLight}
                        size="md"
                    />
                </View>
            </Animated.View>

            {/* ─── 2. STATS ROW ─── */}
            <Animated.View entering={FadeInDown.delay(30).duration(250)} style={styles.statsRow}>
                <View style={styles.statMini}>
                    <Text style={styles.statMiniValue}>{String(totalSessions)}</Text>
                    <Text style={styles.statMiniLabel}>Sessions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statMini}>
                    <Text style={styles.statMiniValue}>{avgRating}</Text>
                    <Text style={styles.statMiniLabel}>Rating</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statMini}>
                    <Text style={styles.statMiniValue}>{trainer.years_experience || 0}</Text>
                    <Text style={styles.statMiniLabel}>Years</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statMini}>
                    <Text style={[styles.statMiniValue, { color: Colors.primary }]}>${Number(trainer.hourly_rate || 50).toFixed(0)}</Text>
                    <Text style={styles.statMiniLabel}>Per hr</Text>
                </View>
            </Animated.View>

            {/* ─── 3. BIO SECTION ─── */}
            {bioText.length > 0 && (
                <PressableCard delay={200} style={styles.sectionWrap}>
                    <Card>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bioText}>{displayBio}</Text>
                        {isBioLong && (
                            <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)} activeOpacity={0.7}>
                                <Text style={styles.readMore}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
                            </TouchableOpacity>
                        )}
                    </Card>
                </PressableCard>
            )}

            {/* ─── 4. PRICING CARD ─── */}
            <PressableCard delay={300} style={styles.sectionWrap}>
                <Card>
                    <View style={styles.pricingHeader}>
                        <Text style={styles.pricingBigPrice}>${Number(trainer.hourly_rate || 50).toFixed(0)}</Text>
                        <Text style={styles.pricingPerHr}>/hr</Text>
                    </View>

                    {/* Session duration pills */}
                    <Text style={styles.pricingSubLabel}>Session length</Text>
                    <View style={styles.pricingPillRow}>
                        {[30, 60, 90].map((dur) => {
                            const isActive = pricingDuration === dur;
                            const calcPrice = (hourlyRate * dur / 60).toFixed(0);
                            return (
                                <TouchableOpacity
                                    key={dur}
                                    style={[styles.pricingPill, isActive && styles.pricingPillActive]}
                                    onPress={() => setPricingDuration(dur)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.pricingPillDur, isActive && styles.pricingPillTextActive]}>
                                        {dur} min
                                    </Text>
                                    <Text style={[styles.pricingPillPrice, isActive && styles.pricingPillTextActive]}>
                                        ${calcPrice}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Divider />

                    <View style={styles.pricingMetaRow}>
                        <View style={styles.pricingMetaItem}>
                            <Text style={styles.pricingMetaLabel}>Reliability</Text>
                            <Text style={styles.pricingMetaValue}>{Number(trainer.reliability_score || 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.pricingMetaItem}>
                            <Text style={styles.pricingMetaLabel}>Completion</Text>
                            <Text style={styles.pricingMetaValue}>{Number(trainer.completion_rate || 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.pricingMetaItem}>
                            <Text style={styles.pricingMetaLabel}>Platform Fee</Text>
                            <Text style={[styles.pricingMetaValue, { color: Colors.textSecondary }]}>{platformFeePercent}%</Text>
                        </View>
                    </View>
                </Card>
            </PressableCard>

            {/* ─── 5. AVAILABILITY SECTION ─── */}
            <PressableCard delay={400} style={styles.sectionWrap}>
                <Card>
                    <View style={styles.availabilityHeader}>
                        <Text style={styles.sectionTitle}>Availability</Text>
                        <View style={styles.availLegend}>
                            <View style={styles.availLegendDot} />
                            <Text style={styles.availLegendText}>Available</Text>
                        </View>
                    </View>
                    <View style={styles.weekStrip}>
                        {DAY_LABELS.map((label, idx) => {
                            const isAvail = availableDays.has(idx);
                            return (
                                <View key={idx} style={[styles.weekDayCol, isAvail && styles.weekDayColActive]}>
                                    <Text style={[styles.weekDayLabel, isAvail && styles.weekDayLabelActive]}>
                                        {label}
                                    </Text>
                                    <View style={[styles.weekDayDot, isAvail && styles.weekDayDotActive]} />
                                </View>
                            );
                        })}
                    </View>
                    {availableDays.size === 0 && (
                        <Text style={styles.noAvailText}>No availability set by trainer</Text>
                    )}
                </Card>
            </PressableCard>

            {/* Certifications */}
            {certifications.length > 0 && (
                <PressableCard delay={450} style={styles.sectionWrap}>
                    <Card>
                        <Text style={styles.sectionTitle}>Certifications</Text>
                        <View style={styles.chipRow}>
                            {certifications.map((cert, index) => (
                                <View key={index} style={styles.certChip}>
                                    <Ionicons name="ribbon-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.certChipText}>{cert}</Text>
                                </View>
                            ))}
                        </View>
                    </Card>
                </PressableCard>
            )}

            {/* Location */}
            <PressableCard delay={500} style={styles.sectionWrap}>
                <Card>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.locationCardRow}>
                        <Ionicons name="location" size={20} color={Colors.primary} />
                        <Text style={styles.locationCardText}>
                            {trainer.city || 'Not specified'}{trainer.state ? `, ${trainer.state}` : ''}{trainer.country ? `, ${trainer.country}` : ''}
                        </Text>
                    </View>
                    {trainer.travel_radius_miles > 0 && (
                        <>
                            <Divider />
                            <View style={styles.locationCardRow}>
                                <Ionicons name="navigate" size={18} color={Colors.textSecondary} />
                                <Text style={styles.locationCardSubtext}>
                                    Travels up to {trainer.country?.toLowerCase().includes('canada') || trainer.country === 'CA'
                                        ? `${Math.round(miToKm(trainer.travel_radius_miles))} km`
                                        : `${trainer.travel_radius_miles} mi`}
                                </Text>
                            </View>
                        </>
                    )}
                </Card>

                {/* Mini Map (native only) */}
                {trainer.latitude && trainer.longitude && MAPS_AVAILABLE && (
                    <View style={styles.miniMapContainer}>
                        <MapView
                            style={styles.miniMap}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                            initialRegion={{
                                latitude: Number(trainer.latitude),
                                longitude: Number(trainer.longitude),
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            customMapStyle={[
                                { elementType: 'geometry', stylers: [{ color: Colors.background }] },
                                { elementType: 'labels.text.stroke', stylers: [{ color: Colors.background }] },
                                { elementType: 'labels.text.fill', stylers: [{ color: Colors.textTertiary }] },
                                { featureType: 'road', elementType: 'geometry', stylers: [{ color: Colors.card }] },
                                { featureType: 'water', elementType: 'geometry', stylers: [{ color: Colors.backgroundSecondary }] },
                                { featureType: 'poi', elementType: 'geometry', stylers: [{ color: Colors.backgroundTertiary }] },
                            ]}
                        >
                            <MapsMarker
                                coordinate={{
                                    latitude: Number(trainer.latitude),
                                    longitude: Number(trainer.longitude),
                                }}
                            >
                                <View style={styles.miniMapPin}>
                                    <Ionicons name="person" size={14} color={Colors.textInverse} />
                                </View>
                            </MapsMarker>
                            {trainer.travel_radius_miles > 0 && (
                                <MapsCircle
                                    center={{
                                        latitude: Number(trainer.latitude),
                                        longitude: Number(trainer.longitude),
                                    }}
                                    radius={trainer.travel_radius_miles * 1609.34}
                                    fillColor={Colors.primaryMuted}
                                    strokeColor={Colors.borderActive}
                                    strokeWidth={1}
                                />
                            )}
                        </MapView>
                    </View>
                )}
            </PressableCard>

            {/* ─── 6. REVIEWS SECTION ─── */}
            <PressableCard delay={600} style={styles.sectionWrap}>
                <Card>
                    {/* Header with rating summary */}
                    <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>Reviews</Text>
                        <View style={styles.reviewsSummary}>
                            <Ionicons name="star" size={14} color={Colors.warning} />
                            <Text style={styles.reviewsSummaryText}>{avgRating}</Text>
                            <Text style={styles.reviewsSummaryCount}>({reviewCount})</Text>
                        </View>
                    </View>

                    {reviews.length > 0 ? (
                        <>
                            {reviews.slice(0, 3).map((review) => (
                                <View key={review.id} style={styles.reviewItem}>
                                    <View style={styles.reviewHeader}>
                                        <Avatar
                                            uri={review.reviewer?.avatar_url}
                                            name={`${review.reviewer?.first_name || ''} ${review.reviewer?.last_name || ''}`}
                                            size={36}
                                        />
                                        <View style={styles.reviewerInfo}>
                                            <Text style={styles.reviewerName}>
                                                {review.reviewer?.first_name} {review.reviewer?.last_name}
                                            </Text>
                                            <View style={styles.starsRow}>
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <Ionicons
                                                        key={s}
                                                        name="star"
                                                        size={12}
                                                        color={s <= review.rating ? Colors.warning : Colors.textTertiary}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                        <Text style={styles.reviewDate}>
                                            {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </Text>
                                    </View>
                                    {review.review_text && (
                                        <Text style={styles.reviewText}>{review.review_text}</Text>
                                    )}
                                </View>
                            ))}
                            {reviews.length > 3 && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Reviews', { trainerId })}
                                    activeOpacity={0.7}
                                    style={styles.seeAllBtn}
                                >
                                    <Text style={styles.seeAllText}>See all reviews</Text>
                                    <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <EmptyState
                            icon="chatbubble-outline"
                            title="No reviews yet"
                            description="Be the first to review this trainer"
                        />
                    )}
                </Card>
            </PressableCard>

            {/* Spacer for bottom button */}
            <View style={{ height: 110 }} />

            {/* ─── 7. BOOK NOW BUTTON (sticky) ─── */}
            {user?.role === 'athlete' && (
                <Animated.View entering={FadeInUp.delay(60).duration(250)} style={styles.bottomBar}>
                    <TouchableOpacity
                        onPress={handleMessage}
                        style={styles.messageBtn}
                        accessibilityLabel="Send message"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chatbubble-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleBookingPress}
                        style={styles.bookButton}
                        activeOpacity={0.85}
                        disabled={isBooking}
                        accessibilityLabel="Book session"
                    >
                        {isBooking ? (
                            <ActivityIndicator size="small" color={Colors.textInverse} />
                        ) : (
                            <>
                                <Ionicons name="calendar" size={18} color={Colors.textInverse} />
                                <Text style={styles.bookButtonText}>
                                    Book Session — ${Number(trainer.hourly_rate || 50).toFixed(0)}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
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

                            {/* Date Calendar Picker */}
                            <Text style={styles.modalLabel}>Session Date</Text>
                            {(() => {
                                const { year, month } = calendarMonth;
                                const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                                const firstDay = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const calendarCells: { day: number; dateStr: string; isPast: boolean }[] = [];
                                for (let i = 0; i < firstDay; i++) {
                                    calendarCells.push({ day: 0, dateStr: '', isPast: true });
                                }
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateObj = new Date(year, month, d);
                                    const yyyy = dateObj.getFullYear();
                                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const dd = String(dateObj.getDate()).padStart(2, '0');
                                    const dateStr = `${yyyy}-${mm}-${dd}`;
                                    calendarCells.push({ day: d, dateStr, isPast: dateObj < today });
                                }

                                const goToPrevMonth = () => {
                                    setCalendarMonth(prev => {
                                        if (prev.month === 0) return { year: prev.year - 1, month: 11 };
                                        return { ...prev, month: prev.month - 1 };
                                    });
                                };
                                const goToNextMonth = () => {
                                    setCalendarMonth(prev => {
                                        if (prev.month === 11) return { year: prev.year + 1, month: 0 };
                                        return { ...prev, month: prev.month + 1 };
                                    });
                                };

                                return (
                                    <View style={styles.calendarContainer}>
                                        {/* Month navigation */}
                                        <View style={styles.calendarNavRow}>
                                            <TouchableOpacity onPress={goToPrevMonth} style={styles.calendarNavBtn} activeOpacity={0.7}>
                                                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                                            </TouchableOpacity>
                                            <Text style={styles.calendarMonthLabel}>{monthName}</Text>
                                            <TouchableOpacity onPress={goToNextMonth} style={styles.calendarNavBtn} activeOpacity={0.7}>
                                                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                        {/* Day-of-week headers */}
                                        <View style={styles.calendarWeekRow}>
                                            {DAY_LABELS.map(label => (
                                                <View key={label} style={styles.calendarDayHeaderCell}>
                                                    <Text style={styles.calendarDayHeaderText}>{label}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        {/* Calendar grid */}
                                        <View style={styles.calendarGrid}>
                                            {calendarCells.map((cell, idx) => {
                                                if (cell.day === 0) {
                                                    return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                                                }
                                                const isSelected = selectedDate === cell.dateStr;
                                                const slotCount = availableDates.get(cell.dateStr) || 0;
                                                const hasAvailability = slotCount > 0 && !cell.isPast;
                                                const isToday = cell.dateStr === (() => {
                                                    const t = new Date();
                                                    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                                                })();

                                                return (
                                                    <TouchableOpacity
                                                        key={cell.dateStr}
                                                        style={[
                                                            styles.calendarCell,
                                                            hasAvailability && styles.calendarCellAvailable,
                                                            isSelected && styles.calendarCellSelected,
                                                            cell.isPast && styles.calendarCellPast,
                                                        ]}
                                                        onPress={() => {
                                                            if (!cell.isPast) {
                                                                setSelectedDate(cell.dateStr);
                                                            }
                                                        }}
                                                        disabled={cell.isPast}
                                                        activeOpacity={cell.isPast ? 1 : 0.7}
                                                        accessibilityLabel={`${cell.dateStr}${hasAvailability ? `, ${slotCount} slot${slotCount !== 1 ? 's' : ''} available` : ''}`}
                                                    >
                                                        <Text style={[
                                                            styles.calendarDayText,
                                                            hasAvailability && styles.calendarDayTextAvailable,
                                                            isSelected && styles.calendarDayTextSelected,
                                                            cell.isPast && styles.calendarDayTextPast,
                                                            isToday && !isSelected && styles.calendarDayTextToday,
                                                        ]}>
                                                            {cell.day}
                                                        </Text>
                                                        {hasAvailability && !isSelected && (
                                                            <View style={styles.calendarAvailDot} />
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                        {/* Legend */}
                                        <View style={styles.calendarLegendRow}>
                                            <View style={styles.calendarLegendItem}>
                                                <View style={[styles.calendarLegendDot, { backgroundColor: '#10b981' }]} />
                                                <Text style={styles.calendarLegendText}>Available</Text>
                                            </View>
                                            <Text style={styles.calendarSelectedDateText}>
                                                {selectedDate || 'Select a date'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })()}

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
                                                accessibilityLabel={`${formatHour(hour, minute)}${isUnavailable ? ', unavailable' : ''}`}
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
                                        accessibilityLabel={`${dur} minutes`}
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
                                                accessibilityLabel={sport}
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

                            {/* Notes */}
                            <Text style={styles.modalLabel}>Notes (Optional)</Text>
                            <TextInput
                                style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                                placeholder="Any details for the trainer (goals, injuries, etc.)"
                                placeholderTextColor={Colors.textMuted}
                                value={bookingNotes}
                                onChangeText={setBookingNotes}
                                multiline
                                numberOfLines={3}
                                maxLength={500}
                                accessibilityLabel="Booking notes"
                            />

                            {/* Sub-Account Selector */}
                            <Text style={styles.modalLabel}>Booking For</Text>
                            <TouchableOpacity
                                style={styles.subAccountSelector}
                                onPress={() => setShowSubAccountPicker(!showSubAccountPicker)}
                                activeOpacity={0.7}
                                accessibilityLabel="Select who the booking is for"
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
                            <Card style={styles.priceBreakdownCard}>
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
                                <Divider />
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceTotalLabel}>Total</Text>
                                    <Text style={styles.priceTotalValue}>
                                        ${totalPrice.toFixed(2)}
                                    </Text>
                                </View>
                            </Card>

                            {/* Actions */}
                            <View style={styles.modalActions}>
                                <Button
                                    title="Confirm Booking"
                                    onPress={handleConfirmBooking}
                                    variant="primary"
                                    size="lg"
                                />
                                <Button
                                    title="Cancel"
                                    onPress={() => setShowBookingModal(false)}
                                    variant="outline"
                                    size="md"
                                />
                            </View>

                            <View style={{ height: Spacing.xl }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    // ─── Hero Section ───
    heroSection: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    avatarGlow: {
        padding: 4,
        borderRadius: 62,
        borderWidth: 2,
        borderColor: Colors.primaryGlow,
        ...Shadows.glow,
        marginBottom: Spacing.lg,
    },
    trainerName: {
        fontSize: 26,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    foundingBadgeWrap: {
        marginBottom: Spacing.sm,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    locationText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    ratingValue: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.warning,
    },
    ratingCount: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    sportBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sportBadgeImage: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primaryGlow,
    },

    // ─── Stats Row ───
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.xxl,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statMini: {
        flex: 1,
        alignItems: 'center',
    },
    statMiniValue: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 2,
    },
    statMiniLabel: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: Colors.border,
    },

    // ─── Sections ───
    sectionWrap: {
        marginBottom: Layout.sectionGap,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    bioText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 24,
    },
    readMore: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
        marginTop: Spacing.sm,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    certChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.pill,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    certChipText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },

    // ─── Pricing Card ───
    pricingHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: Spacing.md,
    },
    pricingBigPrice: {
        fontSize: FontSize.hero,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
    },
    pricingPerHr: {
        fontSize: FontSize.md,
        color: Colors.textMuted,
        marginLeft: 2,
    },
    pricingSubLabel: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
    },
    pricingPillRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    pricingPill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.borderLight,
        backgroundColor: 'transparent',
    },
    pricingPillActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryMuted,
    },
    pricingPillDur: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    pricingPillPrice: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    pricingPillTextActive: {
        color: Colors.primary,
    },
    pricingMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.md,
    },
    pricingMetaItem: {
        alignItems: 'center',
    },
    pricingMetaLabel: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginBottom: 2,
    },
    pricingMetaValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },

    // ─── Availability ───
    availabilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    availLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    availLegendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00C853',
    },
    availLegendText: {
        fontSize: FontSize.xs,
        color: '#00C853',
        fontWeight: FontWeight.medium,
    },
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
    },
    weekDayCol: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    weekDayColActive: {
        backgroundColor: 'rgba(0,200,83,0.08)',
    },
    weekDayLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textMuted,
        marginBottom: Spacing.sm,
    },
    weekDayLabelActive: {
        color: '#00C853',
        fontWeight: FontWeight.bold,
    },
    weekDayDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.glass,
    },
    weekDayDotActive: {
        backgroundColor: '#00C853',
        shadowColor: '#00C853',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
        elevation: 4,
    },
    noAvailText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    // ─── Calendar Picker (Booking Modal) ───
    calendarContainer: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    calendarNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    calendarNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarMonthLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    calendarWeekRow: {
        flexDirection: 'row',
        marginBottom: Spacing.xs,
    },
    calendarDayHeaderCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    calendarDayHeaderText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textMuted,
        textTransform: 'uppercase',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    calendarCellAvailable: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    calendarCellSelected: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    calendarCellPast: {
        opacity: 0.35,
    },
    calendarDayText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    calendarDayTextAvailable: {
        color: '#10b981',
        fontWeight: FontWeight.bold,
    },
    calendarDayTextSelected: {
        color: Colors.textInverse,
        fontWeight: FontWeight.bold,
    },
    calendarDayTextPast: {
        color: Colors.textTertiary,
    },
    calendarDayTextToday: {
        color: Colors.primary,
        fontWeight: FontWeight.bold,
    },
    calendarAvailDot: {
        position: 'absolute',
        bottom: 4,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10b981',
    },
    calendarLegendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    calendarLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    calendarLegendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    calendarLegendText: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    calendarSelectedDateText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },

    // ─── Location Card ───
    locationCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    locationCardText: {
        fontSize: FontSize.md,
        color: Colors.text,
        flex: 1,
    },
    locationCardSubtext: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        flex: 1,
    },
    miniMapContainer: {
        marginTop: Spacing.md,
        height: 180,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    miniMap: {
        flex: 1,
    },
    miniMapPin: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.text,
    },

    // ─── Reviews ───
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    reviewsSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    reviewsSummaryText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.warning,
    },
    reviewsSummaryCount: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
    },
    reviewItem: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: Spacing.md,
    },
    reviewerInfo: {
        flex: 1,
    },
    reviewerName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 2,
    },
    reviewDate: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    reviewText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Spacing.lg,
        gap: Spacing.xs,
    },
    seeAllText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },

    // ─── Bottom Bar ───
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: Spacing.lg,
        ...Shadows.large,
    },
    messageBtn: {
        width: 52,
        height: 52,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: Colors.borderActive,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        height: 52,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.primary,
        ...Shadows.glow,
    },
    bookButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.textInverse,
    },

    // ─── Modal ───
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: Colors.card,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        padding: Layout.screenPadding,
        paddingBottom: Spacing.huge,
        borderTopWidth: 1,
        borderTopColor: Colors.borderActive,
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    modalLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
    },
    modalInput: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md + 2,
        fontSize: FontSize.md,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    modalActions: {
        gap: Spacing.md,
        marginTop: Spacing.xl,
    },
    sportSelectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    sportOption: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        borderWidth: 1.5,
        borderColor: Colors.borderLight,
        backgroundColor: 'transparent',
    },
    sportOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryMuted,
    },
    sportOptionText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    sportOptionTextSelected: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },

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
        borderColor: Colors.glassBorder,
        opacity: 0.45,
    },
    timeSlotText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    timeSlotTextSelected: {
        color: Colors.textInverse,
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
        borderColor: Colors.borderLight,
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
        color: Colors.textInverse,
        fontWeight: FontWeight.bold,
    },

    // Sub-account selector
    subAccountSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
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
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primaryMuted,
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
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    subAccountOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    subAccountOptionActive: {
        backgroundColor: Colors.primaryMuted,
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
        backgroundColor: Colors.background,
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
