import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, TouchableOpacity, TextInput, Alert,
    ActivityIndicator, Modal, Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Calendar from 'expo-calendar';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Config } from '../../lib/config';
import { apiFetchJson } from '../../lib/api-fetch';
import { createNotification, scheduleRebookReminder } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import {
    ScreenWrapper,
    ScreenHeader,
    Card,
    Badge,
    Avatar,
    Button,
    SectionHeader,
    Divider,
    LoadingScreen,
} from '../../components/ui';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    pending:              { color: '#ffab00',       bg: 'rgba(255,171,0,0.15)',     icon: 'hourglass',        label: 'Pending' },
    confirmed:            { color: '#45D0FF',       bg: 'rgba(69,208,255,0.15)',    icon: 'checkmark-circle', label: 'Confirmed' },
    completed:            { color: Colors.success,  bg: Colors.successLight,        icon: 'trophy',           label: 'Completed' },
    cancelled:            { color: Colors.error,    bg: Colors.errorLight,          icon: 'close-circle',     label: 'Cancelled' },
    no_show:              { color: '#6b6b7b',       bg: 'rgba(107,107,123,0.15)',   icon: 'alert-circle',     label: 'No-Show' },
    disputed:             { color: Colors.error,    bg: Colors.errorLight,          icon: 'flag',             label: 'Disputed' },
    reschedule_requested: { color: '#ffab00',       bg: 'rgba(255,171,0,0.15)',     icon: 'time-outline',     label: 'Reschedule Requested' },
};

export default function BookingDetailScreen({ route, navigation }: any) {
    const { bookingId } = route.params;
    const { user } = useAuth();
    const [booking, setBooking] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trainerNotes, setTrainerNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Calendar modal state
    const [calendarModalVisible, setCalendarModalVisible] = useState(false);

    // Cancel modal state
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Reject modal state (trainer declining a pending booking)
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    // Reschedule state
    const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
    const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
    const [isRespondingReschedule, setIsRespondingReschedule] = useState(false);

    // Review state
    const [existingReview, setExistingReview] = useState<any>(null);
    const [reviewChecked, setReviewChecked] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Notes modal for completed sessions (trainer)
    const [notesModalVisible, setNotesModalVisible] = useState(false);

    // Payment state
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'checking'>('checking');

    const fetchExistingReview = useCallback(async (bId: string) => {
        if (!user) return;
        const { data } = await supabase
            .from('reviews')
            .select('*')
            .eq('booking_id', bId)
            .eq('reviewer_id', user.id)
            .maybeSingle();
        setExistingReview(data || null);
        setReviewChecked(true);
    }, [user]);

    const fetchBooking = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, athlete:users!bookings_athlete_id_fkey(*), trainer:users!bookings_trainer_id_fkey(*)')
                .eq('id', bookingId)
                .single();
            if (error) throw error;
            setBooking(data);
            setTrainerNotes(data?.trainer_notes || '');
        } catch (error) {
            console.error('Error fetching booking:', error);
        } finally {
            setIsLoading(false);
        }
    }, [bookingId]);

    const fetchRescheduleRequests = useCallback(async (bId: string) => {
        const { data } = await supabase
            .from('reschedule_requests')
            .select('*')
            .eq('booking_id', bId)
            .eq('status', 'pending');
        setRescheduleRequests(data || []);
    }, []);

    const checkPaymentStatus = useCallback(async (bId: string) => {
        try {
            const { data } = await supabase
                .from('payment_transactions')
                .select('id, status')
                .eq('booking_id', bId)
                .maybeSingle();
            setPaymentStatus(data ? 'paid' : 'unpaid');
        } catch {
            setPaymentStatus('unpaid');
        }
    }, []);

    useEffect(() => { fetchBooking(); }, [fetchBooking]);

    useEffect(() => {
        if (booking) {
            fetchRescheduleRequests(booking.id);
            if (['confirmed', 'completed'].includes(booking.status)) {
                checkPaymentStatus(booking.id);
            } else {
                setPaymentStatus('unpaid');
            }
        }
    }, [booking, fetchRescheduleRequests, checkPaymentStatus]);

    useEffect(() => {
        if (booking && booking.status === 'completed' && user?.role === 'athlete') {
            fetchExistingReview(booking.id);
            if (booking.trainer) {
                scheduleRebookReminder({
                    bookingId: booking.id,
                    trainerName: `${booking.trainer.first_name} ${booking.trainer.last_name}`,
                    sport: booking.sport,
                }).catch(() => { /* silent fail */ });
            }
        }
    }, [booking, user, fetchExistingReview]);

    const isTrainer = user?.role === 'trainer';
    const otherUser = isTrainer ? booking?.athlete : booking?.trainer;

    // ── Status change (confirm, complete, no_show) ──
    const handleStatusChange = async (newStatus: string, confirmMsg: string) => {
        Alert.alert('Confirm Action', confirmMsg, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    setIsSaving(true);
                    try {
                        if (newStatus === 'cancelled') {
                            await apiFetchJson(`/api/booking/${bookingId}/cancel`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    reason: isTrainer ? 'Cancelled by trainer' : 'Cancelled by athlete',
                                }),
                            });
                        } else if (newStatus === 'completed') {
                            await apiFetchJson(`/api/booking/${bookingId}/complete`, {
                                method: 'POST',
                            });
                        } else {
                            // confirmed / no_show — keep direct update for now
                            // (no dedicated server route yet).
                            const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
                            const { error } = await supabase
                                .from('bookings')
                                .update(updateData)
                                .eq('id', bookingId);
                            if (error) throw error;
                        }

                        const notifMap: Record<string, { type: string; title: string; body: string }> = {
                            completed: {
                                type: 'BOOKING_COMPLETED',
                                title: 'Session Completed',
                                body: `Your ${booking.sport} session has been marked as completed.`,
                            },
                            cancelled: {
                                type: 'BOOKING_CANCELLED',
                                title: 'Session Cancelled',
                                body: `Your ${booking.sport} session has been cancelled.`,
                            },
                            no_show: {
                                type: 'BOOKING_CANCELLED',
                                title: 'No-Show Reported',
                                body: `You were reported as a no-show for your ${booking.sport} session.`,
                            },
                            confirmed: {
                                type: 'BOOKING_CONFIRMED',
                                title: 'Booking Confirmed',
                                body: `Your ${booking.sport} session has been confirmed.`,
                            },
                        };

                        if (notifMap[newStatus] && otherUser) {
                            await createNotification({
                                userId: otherUser.id,
                                ...notifMap[newStatus],
                                data: { bookingId },
                            });
                        }

                        fetchBooking();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setIsSaving(false);
                    }
                },
            },
        ]);
    };

    // ── Reject with reason (trainer declining pending) ──
    const handleRejectWithReason = async () => {
        if (!rejectReason.trim()) return;
        setIsRejecting(true);
        try {
            await apiFetchJson(`/api/booking/${bookingId}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: rejectReason.trim() }),
            });

            if (otherUser) {
                await createNotification({
                    userId: otherUser.id,
                    type: 'BOOKING_REJECTED',
                    title: 'Booking Declined',
                    body: `Your ${booking.sport} session request was declined.`,
                    data: { bookingId },
                });
            }

            setRejectModalVisible(false);
            setRejectReason('');
            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsRejecting(false);
        }
    };

    // ── Save session notes ──
    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            const field = isTrainer ? 'trainer_notes' : 'athlete_notes';
            const { error } = await supabase
                .from('bookings')
                .update({ [field]: trainerNotes.trim(), updated_at: new Date().toISOString() })
                .eq('id', bookingId);
            if (error) throw error;
            Alert.alert('Saved', 'Notes saved successfully.');
            setNotesModalVisible(false);
            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Cancel with reason ──
    const handleCancelWithReason = async () => {
        if (!cancelReason.trim()) return;
        setIsCancelling(true);
        try {
            await apiFetchJson(`/api/booking/${bookingId}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: cancelReason.trim() }),
            });

            if (otherUser) {
                await createNotification({
                    userId: otherUser.id,
                    type: 'BOOKING_CANCELLED',
                    title: 'Session Cancelled',
                    body: `Your ${booking.sport} session has been cancelled.`,
                    data: { bookingId },
                });
            }

            setCancelModalVisible(false);
            setCancelReason('');
            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsCancelling(false);
        }
    };

    // ── Reschedule ──
    const handleSubmitReschedule = async () => {
        if (!rescheduleDate.trim() || !rescheduleTime.trim()) {
            Alert.alert('Required Fields', 'Please enter both a date and time.');
            return;
        }
        setIsSubmittingReschedule(true);
        try {
            const { error: insertError } = await supabase.from('reschedule_requests').insert({
                booking_id: booking.id,
                initiated_by: user!.id,
                proposed_time: `${rescheduleDate}T${rescheduleTime}:00`,
                reason: rescheduleReason.trim() || null,
                status: 'pending',
            });
            if (insertError) throw insertError;

            const { error: updateError } = await supabase.from('bookings').update({
                status: 'reschedule_requested',
            }).eq('id', booking.id);
            if (updateError) throw updateError;

            const otherUserId = user!.role === 'trainer' ? booking.athlete_id : booking.trainer_id;
            await supabase.from('notifications').insert({
                user_id: otherUserId,
                type: 'RESCHEDULE_REQUEST',
                title: 'Reschedule Request',
                body: `A reschedule has been requested for your ${booking.sport} session`,
                data: { bookingId: booking.id },
                read: false,
            });

            setRescheduleModalVisible(false);
            setRescheduleDate('');
            setRescheduleTime('');
            setRescheduleReason('');
            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSubmittingReschedule(false);
        }
    };

    const handleAcceptReschedule = async (request: any) => {
        setIsRespondingReschedule(true);
        try {
            const { error: reqError } = await supabase.from('reschedule_requests')
                .update({ status: 'accepted' }).eq('id', request.id);
            if (reqError) throw reqError;

            const { error: bookError } = await supabase.from('bookings').update({
                scheduled_at: request.proposed_time,
                status: 'confirmed',
            }).eq('id', booking.id);
            if (bookError) throw bookError;

            await supabase.from('notifications').insert({
                user_id: request.initiated_by,
                type: 'RESCHEDULE_REQUEST',
                title: 'Reschedule Accepted',
                body: `Your reschedule request for the ${booking.sport} session has been accepted.`,
                data: { bookingId: booking.id },
                read: false,
            });

            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsRespondingReschedule(false);
        }
    };

    const handleDeclineReschedule = async (request: any) => {
        setIsRespondingReschedule(true);
        try {
            const { error: reqError } = await supabase.from('reschedule_requests')
                .update({ status: 'declined' }).eq('id', request.id);
            if (reqError) throw reqError;

            const { error: bookError } = await supabase.from('bookings').update({
                status: 'confirmed',
            }).eq('id', booking.id);
            if (bookError) throw bookError;

            await supabase.from('notifications').insert({
                user_id: request.initiated_by,
                type: 'RESCHEDULE_REQUEST',
                title: 'Reschedule Declined',
                body: `Your reschedule request for the ${booking.sport} session has been declined.`,
                data: { bookingId: booking.id },
                read: false,
            });

            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsRespondingReschedule(false);
        }
    };

    // ── Submit review ──
    const handleSubmitReview = async () => {
        if (reviewRating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating before submitting.');
            return;
        }
        setIsSubmittingReview(true);
        try {
            // Server inserts review + recomputes trainer_profiles.average_rating
            // and total_reviews. Auth via x-airtrainr-uid.
            await apiFetchJson('/api/reviews', {
                method: 'POST',
                body: JSON.stringify({
                    bookingId: booking.id,
                    rating: reviewRating,
                    reviewText: reviewComment.trim() || null,
                }),
            });

            await createNotification({
                userId: booking.trainer_id,
                type: 'REVIEW_RECEIVED',
                title: 'New Review',
                body: `You received a ${reviewRating}-star review for ${booking.sport}.`,
                data: { bookingId: booking.id },
            });

            setExistingReview({ rating: reviewRating, review_text: reviewComment.trim() });
            Alert.alert('Review Submitted', 'Thank you for your feedback!');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // ── Stripe Payment ──
    const handlePayNow = async () => {
        if (!booking || !user) return;
        setIsPaymentLoading(true);
        try {
            const apiUrl = Config.appUrl;
            if (!apiUrl) {
                throw new Error('Payment service is not configured. Please try again later.');
            }
            const response = await fetch(`${apiUrl}/api/stripe/create-booking-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: booking.id,
                    athleteId: user.id,
                    athleteEmail: user.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment session');
            }

            if (data.url) {
                const result = await WebBrowser.openBrowserAsync(data.url, {
                    dismissButtonStyle: 'cancel',
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                });

                if (result.type === 'cancel' || result.type === 'dismiss') {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                await checkPaymentStatus(booking.id);
                await fetchBooking();
            }
        } catch (error: any) {
            Alert.alert('Payment Error', error.message || 'Something went wrong with the payment.');
        } finally {
            setIsPaymentLoading(false);
        }
    };

    // ── Calendar ──
    const handleGoogleCalendar = () => {
        setCalendarModalVisible(false);
        const startTime = new Date(booking.scheduled_at);
        const endTime = new Date(startTime.getTime() + (booking.duration_minutes || 60) * 60000);

        const formatGCal = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

        const trainerName = booking.trainer?.first_name + ' ' + booking.trainer?.last_name;
        const athleteName = booking.athlete?.first_name + ' ' + booking.athlete?.last_name;
        const otherPerson = user?.role === 'trainer' ? athleteName : trainerName;

        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
            `&text=${encodeURIComponent(`AirTrainr: ${booking.sport} Session`)}` +
            `&dates=${formatGCal(startTime)}/${formatGCal(endTime)}` +
            `&details=${encodeURIComponent(`Training session with ${otherPerson}\nSport: ${booking.sport}\nDuration: ${booking.duration_minutes || 60} minutes`)}` +
            `&location=${encodeURIComponent(booking.address || '')}`;

        Linking.openURL(url);
    };

    const handleDeviceCalendar = async () => {
        setCalendarModalVisible(false);
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Calendar access is needed to add events.');
            return;
        }

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find(c => c.isPrimary) || calendars[0];

        if (!defaultCalendar) {
            Alert.alert('No Calendar', 'No calendar found on this device.');
            return;
        }

        const startTime = new Date(booking.scheduled_at);
        const endTime = new Date(startTime.getTime() + (booking.duration_minutes || 60) * 60000);

        const trainerName = booking.trainer?.first_name + ' ' + booking.trainer?.last_name;
        const athleteName = booking.athlete?.first_name + ' ' + booking.athlete?.last_name;
        const otherPerson = user?.role === 'trainer' ? athleteName : trainerName;

        try {
            await Calendar.createEventAsync(defaultCalendar.id, {
                title: `AirTrainr: ${booking.sport} Session`,
                startDate: startTime,
                endDate: endTime,
                notes: `Training session with ${otherPerson}\nSport: ${booking.sport}`,
                location: booking.address || '',
                alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
            });

            Alert.alert('Added!', 'Event has been added to your calendar.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // ── Loading ──
    if (isLoading || !booking) {
        return <LoadingScreen message="Loading session details..." />;
    }

    const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
    const scheduledDate = new Date(booking.scheduled_at);
    const isPast = scheduledDate < new Date();
    const otherName = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim();

    // ── Helper: Info row inside Card ──
    const InfoRow = ({ icon, label, value, valueColor, isLast = false, flexValue = false }: {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
        value: string;
        valueColor?: string;
        isLast?: boolean;
        flexValue?: boolean;
    }) => (
        <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
            <Ionicons name={icon} size={18} color={Colors.primary} />
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[
                styles.infoValue,
                valueColor ? { color: valueColor } : undefined,
                flexValue ? { flex: 1, textAlign: 'right' } : undefined,
            ]}>
                {value}
            </Text>
        </View>
    );

    return (
        <ScreenWrapper>
            <ScreenHeader
                title="Session Details"
                onBack={() => navigation.goBack()}
            />

            {/* Hero section with status banner */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <LinearGradient
                    colors={[sc.color, sc.color + '88']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.statusBanner}
                >
                    <Ionicons name={sc.icon as any} size={32} color="#fff" />
                    <Text style={styles.statusBannerText}>{sc.label}</Text>
                </LinearGradient>
            </Animated.View>

            {/* Status History */}
            <View style={styles.statusHistory}>
                <View style={styles.statusHistoryItem}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.statusHistoryText}>
                        Created {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                </View>
                {booking.status !== 'pending' && (
                    <View style={styles.statusHistoryItem}>
                        <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                        <Text style={styles.statusHistoryText}>
                            {sc.label} {booking.updated_at
                                ? new Date(booking.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* User Card - other user info */}
            <Animated.View entering={FadeInDown.duration(250).delay(60)}>
            <Card style={styles.userCard}>
                <View style={styles.userRow}>
                    <Avatar
                        uri={otherUser?.avatar_url}
                        name={otherName}
                        size={50}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{otherName}</Text>
                        <Text style={styles.userRole}>{isTrainer ? 'Athlete' : 'Trainer'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => navigation.navigate('Chat', { bookingId, otherUser })}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chatbubble" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Card>
            </Animated.View>

            {/* Session Info - in clearly separated card */}
            <Animated.View entering={FadeInDown.duration(250).delay(30)}>
            <SectionHeader title="Session Information" />
            <Card noPadding style={styles.sectionCard}>
                <View style={styles.infoCardInner}>
                    <InfoRow icon="tennisball" label="Sport" value={booking.sport} />
                    <InfoRow
                        icon="calendar"
                        label="Date"
                        value={scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    />
                    <InfoRow
                        icon="time"
                        label="Time"
                        value={scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    />
                    <InfoRow
                        icon="hourglass"
                        label="Duration"
                        value={`${booking.duration_minutes} minutes`}
                    />
                    {booking.address && (
                        <InfoRow icon="location" label="Location" value={booking.address} flexValue />
                    )}
                    <InfoRow
                        icon="cash"
                        label="Price"
                        value={`$${Number(booking.price).toFixed(2)}`}
                        valueColor={Colors.primary}
                        isLast
                    />
                </View>
            </Card>
            </Animated.View>

            {/* Payment Info */}
            <Animated.View entering={FadeInDown.duration(250).delay(120)}>
            <SectionHeader title="Payment Details" />
            <Card noPadding style={styles.sectionCard}>
                <View style={styles.infoCardInner}>
                    <InfoRow
                        icon="cash"
                        label="Session Price"
                        value={`$${Number(booking.price).toFixed(2)}`}
                        valueColor={Colors.primary}
                    />
                    <InfoRow
                        icon="remove-circle"
                        label="Platform Fee (3%)"
                        value={`-$${Number(booking.platform_fee || 0).toFixed(2)}`}
                    />
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="wallet" size={18} color={Colors.primary} />
                        <Text style={[styles.infoLabel, { fontWeight: FontWeight.bold }]}>
                            {isTrainer ? 'Your Payout' : 'Total Paid'}
                        </Text>
                        <Text style={[styles.infoValue, { fontWeight: FontWeight.bold }]}>
                            ${isTrainer
                                ? (Number(booking.price) - Number(booking.platform_fee || 0)).toFixed(2)
                                : Number(booking.total_paid || booking.price).toFixed(2)}
                        </Text>
                    </View>
                </View>
            </Card>
            </Animated.View>

            {/* Session Notes Display */}
            {booking.trainer_notes ? (
                <>
                    <SectionHeader title="Session Notes" />
                    <Card style={styles.sectionCard}>
                        <Text style={styles.noteText}>{booking.trainer_notes}</Text>
                    </Card>
                </>
            ) : null}

            {booking.athlete_notes && isTrainer ? (
                <>
                    <SectionHeader title="Athlete Notes" />
                    <Card style={styles.sectionCard}>
                        <Text style={styles.noteText}>{booking.athlete_notes}</Text>
                    </Card>
                </>
            ) : null}

            {/* ── TRAINER ACTIONS ── */}
            {isTrainer && (
                <View style={styles.actionsSection}>
                    <SectionHeader title="Actions" />

                    {/* Pending: Confirm or Reject */}
                    {booking.status === 'pending' && (
                        <>
                            <View style={styles.actionRow}>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Confirm"
                                        icon="checkmark-circle"
                                        onPress={() => handleStatusChange('confirmed', 'Accept this booking request?')}
                                        variant="primary"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Reject"
                                        icon="close-circle"
                                        onPress={() => { setRejectReason(''); setRejectModalVisible(true); }}
                                        variant="danger"
                                    />
                                </View>
                            </View>
                            <View style={styles.actionSpacing}>
                                <Button
                                    title="Reschedule"
                                    icon="time-outline"
                                    onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                                    variant="secondary"
                                />
                            </View>
                        </>
                    )}

                    {/* Confirmed: Complete, Cancel, No-Show, Reschedule, Calendar */}
                    {booking.status === 'confirmed' && (
                        <>
                            <View style={styles.actionRow}>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Complete"
                                        icon="trophy"
                                        onPress={() => handleStatusChange('completed', 'Mark this session as completed?')}
                                        variant="primary"
                                        disabled={!isPast}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Cancel"
                                        icon="close"
                                        onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                                        variant="danger"
                                    />
                                </View>
                            </View>
                            <View style={[styles.actionRow, styles.actionSpacing]}>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="No-Show"
                                        icon="alert-circle"
                                        onPress={() => handleStatusChange('no_show', 'Report this athlete as a no-show?')}
                                        variant="outline"
                                        disabled={!isPast}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Reschedule"
                                        icon="time-outline"
                                        onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                                        variant="secondary"
                                    />
                                </View>
                            </View>
                            <View style={styles.actionSpacing}>
                                <Button
                                    title="Add to Calendar"
                                    icon="calendar-outline"
                                    onPress={() => setCalendarModalVisible(true)}
                                    variant="secondary"
                                />
                            </View>
                            {!isPast && (
                                <Text style={styles.futureNote}>
                                    Complete and No-Show actions will be available after the scheduled session time.
                                </Text>
                            )}
                        </>
                    )}

                    {/* Completed: Session notes + Calendar */}
                    {booking.status === 'completed' && (
                        <>
                            <Button
                                title={booking.trainer_notes ? 'Edit Session Notes' : 'Add Session Notes'}
                                icon="document-text"
                                onPress={() => { setTrainerNotes(booking.trainer_notes || ''); setNotesModalVisible(true); }}
                                variant="primary"
                            />
                            <View style={styles.actionSpacing}>
                                <Button
                                    title="Add to Calendar"
                                    icon="calendar-outline"
                                    onPress={() => setCalendarModalVisible(true)}
                                    variant="secondary"
                                />
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* ── ATHLETE ACTIONS ── */}
            {!isTrainer && (
                <View style={styles.actionsSection}>
                    {/* Pending: Cancel */}
                    {booking.status === 'pending' && (
                        <>
                            <SectionHeader title="Actions" />
                            <Button
                                title="Cancel Booking"
                                icon="close-circle"
                                onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                                variant="danger"
                            />
                        </>
                    )}

                    {/* Confirmed: Pay, Reschedule, Cancel, Calendar */}
                    {(booking.status === 'confirmed' || booking.status === 'reschedule_requested') && (
                        <>
                            <SectionHeader title="Actions" />

                            {/* Pay Now */}
                            {booking.status === 'confirmed' && paymentStatus === 'unpaid' && (
                                <View style={styles.actionSpacingBottom}>
                                    <Button
                                        title={`Pay Now — $${Number(booking.total_paid || booking.price).toFixed(2)}`}
                                        icon="card"
                                        onPress={handlePayNow}
                                        loading={isPaymentLoading}
                                        variant="primary"
                                    />
                                </View>
                            )}

                            {/* Payment confirmed badge */}
                            {paymentStatus === 'paid' && (
                                <Card style={styles.paymentBadgeCard}>
                                    <View style={styles.paymentBadgeRow}>
                                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                                        <Text style={styles.paymentPaidText}>Payment Completed</Text>
                                    </View>
                                </Card>
                            )}

                            {paymentStatus === 'checking' && booking.status === 'confirmed' && (
                                <Card style={{ ...styles.paymentBadgeCard, backgroundColor: Colors.warningLight }}>
                                    <View style={styles.paymentBadgeRow}>
                                        <ActivityIndicator size="small" color={Colors.warning} />
                                        <Text style={[styles.paymentPaidText, { color: Colors.warning }]}>Checking payment status...</Text>
                                    </View>
                                </Card>
                            )}

                            <Button
                                title="Reschedule"
                                icon="time-outline"
                                onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                                variant="secondary"
                            />
                            <View style={styles.actionSpacing}>
                                <Button
                                    title="Cancel Booking"
                                    icon="close-circle"
                                    onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                                    variant="danger"
                                />
                            </View>
                            {booking.status === 'confirmed' && (
                                <View style={styles.actionSpacing}>
                                    <Button
                                        title="Add to Calendar"
                                        icon="calendar-outline"
                                        onPress={() => setCalendarModalVisible(true)}
                                        variant="secondary"
                                    />
                                </View>
                            )}
                        </>
                    )}

                    {/* Completed: Calendar */}
                    {booking.status === 'completed' && (
                        <>
                            <Button
                                title="Add to Calendar"
                                icon="calendar-outline"
                                onPress={() => setCalendarModalVisible(true)}
                                variant="secondary"
                            />
                        </>
                    )}
                </View>
            )}

            {/* Pending Reschedule Requests */}
            {rescheduleRequests.length > 0 && rescheduleRequests.map((req) => {
                const proposedDate = new Date(req.proposed_time);
                const isInitiator = req.initiated_by === user?.id;
                return (
                    <Card key={req.id} style={styles.rescheduleBanner}>
                        <View style={styles.rescheduleBannerHeader}>
                            <Ionicons name="time-outline" size={20} color={Colors.warning} />
                            <Text style={styles.rescheduleBannerTitle}>Reschedule Requested</Text>
                        </View>
                        <View style={styles.rescheduleBannerBody}>
                            <Text style={styles.rescheduleBannerLabel}>Proposed Date & Time</Text>
                            <Text style={styles.rescheduleBannerValue}>
                                {proposedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                {' at '}
                                {proposedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </Text>
                            {req.reason && (
                                <>
                                    <Text style={[styles.rescheduleBannerLabel, { marginTop: Spacing.sm }]}>Reason</Text>
                                    <Text style={styles.rescheduleBannerValue}>{req.reason}</Text>
                                </>
                            )}
                            <Text style={[styles.rescheduleBannerLabel, { marginTop: Spacing.sm }]}>
                                {isInitiator ? 'You requested this reschedule' : `Requested by the ${isTrainer ? 'athlete' : 'trainer'}`}
                            </Text>
                        </View>
                        {!isInitiator && (
                            <View style={styles.rescheduleResponseRow}>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Accept"
                                        icon="checkmark-circle"
                                        onPress={() => handleAcceptReschedule(req)}
                                        loading={isRespondingReschedule}
                                        variant="primary"
                                        size="sm"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Decline"
                                        icon="close-circle"
                                        onPress={() => handleDeclineReschedule(req)}
                                        disabled={isRespondingReschedule}
                                        variant="danger"
                                        size="sm"
                                    />
                                </View>
                            </View>
                        )}
                    </Card>
                );
            })}

            {/* Cancellation details */}
            {booking.status === 'cancelled' && booking.cancellation_reason && (
                <>
                    <View style={styles.cancellationHeader}>
                        <Ionicons name="information-circle" size={20} color={Colors.error} />
                        <Text style={styles.cancellationTitle}>Cancellation Reason</Text>
                    </View>
                    <Card style={styles.sectionCard}>
                        <Text style={styles.noteText}>{booking.cancellation_reason}</Text>
                        {booking.cancelled_at && (
                            <Text style={styles.noteDate}>
                                {new Date(booking.cancelled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </Text>
                        )}
                    </Card>
                </>
            )}

            {/* Review Section -- athlete only, completed bookings */}
            {!isTrainer && booking.status === 'completed' && reviewChecked && (
                <>
                    <SectionHeader title="Your Review" />
                    {existingReview ? (
                        <Card style={styles.sectionCard}>
                            <View style={styles.reviewSubmittedRow}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                                <Text style={styles.reviewSubmittedText}>
                                    You reviewed this session - {existingReview.rating}/5 stars
                                </Text>
                            </View>
                        </Card>
                    ) : (
                        <Card style={styles.sectionCard}>
                            <Text style={styles.reviewLabel}>Rating</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => setReviewRating(star)}
                                        style={styles.starButton}
                                    >
                                        <Ionicons
                                            name={star <= reviewRating ? 'star' : 'star-outline'}
                                            size={32}
                                            color={star <= reviewRating ? Colors.primary : 'rgba(255,255,255,0.3)'}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.reviewLabel, { marginTop: Spacing.md }]}>Comment (optional)</Text>
                            <TextInput
                                style={styles.reviewInput}
                                value={reviewComment}
                                onChangeText={setReviewComment}
                                placeholder="Share your experience..."
                                placeholderTextColor={Colors.textTertiary}
                                multiline
                                textAlignVertical="top"
                            />

                            <View style={{ marginTop: Spacing.lg }}>
                                <Button
                                    title="Submit Review"
                                    onPress={handleSubmitReview}
                                    loading={isSubmittingReview}
                                    variant="primary"
                                />
                            </View>
                        </Card>
                    )}
                </>
            )}

            {/* ── Calendar Options Modal ── */}
            <Modal
                visible={calendarModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCalendarModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.calendarModalOverlay}
                    activeOpacity={1}
                    onPress={() => setCalendarModalVisible(false)}
                >
                    <View style={styles.calendarModalCard}>
                        <View style={styles.calendarModalHandle} />
                        <Text style={styles.calendarModalTitle}>Add to Calendar</Text>

                        <TouchableOpacity style={styles.calendarOption} onPress={handleGoogleCalendar}>
                            <View style={styles.calendarOptionIcon}>
                                <Ionicons name="globe-outline" size={22} color={Colors.info} />
                            </View>
                            <Text style={styles.calendarOptionText}>Google Calendar</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.calendarOption} onPress={handleDeviceCalendar}>
                            <View style={styles.calendarOptionIcon}>
                                <Ionicons name="phone-portrait-outline" size={22} color={Colors.info} />
                            </View>
                            <Text style={styles.calendarOptionText}>Device Calendar</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={{ marginTop: Spacing.md }}>
                            <Button
                                title="Cancel"
                                onPress={() => setCalendarModalVisible(false)}
                                variant="ghost"
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Reschedule Modal ── */}
            <Modal
                visible={rescheduleModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRescheduleModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Reschedule Session</Text>
                        <Text style={styles.modalSubtitle}>Propose a new date and time</Text>

                        <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.modalInputSmall}
                            value={rescheduleDate}
                            onChangeText={setRescheduleDate}
                            placeholder="2026-04-15"
                            placeholderTextColor={Colors.textTertiary}
                            maxLength={10}
                        />

                        <Text style={styles.inputLabel}>Time (HH:MM)</Text>
                        <TextInput
                            style={styles.modalInputSmall}
                            value={rescheduleTime}
                            onChangeText={setRescheduleTime}
                            placeholder="14:00"
                            placeholderTextColor={Colors.textTertiary}
                            maxLength={5}
                        />

                        <Text style={styles.inputLabel}>Reason (optional)</Text>
                        <TextInput
                            style={[styles.modalInputSmall, { minHeight: 80 }]}
                            value={rescheduleReason}
                            onChangeText={setRescheduleReason}
                            placeholder="Reason for rescheduling..."
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Cancel"
                                    onPress={() => setRescheduleModalVisible(false)}
                                    disabled={isSubmittingReschedule}
                                    variant="ghost"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Send Request"
                                    onPress={handleSubmitReschedule}
                                    loading={isSubmittingReschedule}
                                    disabled={!rescheduleDate.trim() || !rescheduleTime.trim()}
                                    variant="primary"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Cancel Booking Modal ── */}
            <Modal
                visible={cancelModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Cancel Booking</Text>
                        <Text style={styles.modalSubtitle}>Please provide a reason for cancellation</Text>

                        <TextInput
                            style={styles.modalInputLarge}
                            value={cancelReason}
                            onChangeText={setCancelReason}
                            placeholder="Why are you cancelling this session?"
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Go Back"
                                    onPress={() => setCancelModalVisible(false)}
                                    disabled={isCancelling}
                                    variant="ghost"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Cancel Booking"
                                    onPress={handleCancelWithReason}
                                    loading={isCancelling}
                                    disabled={!cancelReason.trim()}
                                    variant="danger"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Reject Booking Modal ── */}
            <Modal
                visible={rejectModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRejectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Decline Booking</Text>
                        <Text style={styles.modalSubtitle}>Please provide a reason for declining this request</Text>

                        <TextInput
                            style={styles.modalInputLarge}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Reason for declining..."
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Go Back"
                                    onPress={() => setRejectModalVisible(false)}
                                    disabled={isRejecting}
                                    variant="ghost"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Decline"
                                    onPress={handleRejectWithReason}
                                    loading={isRejecting}
                                    disabled={!rejectReason.trim()}
                                    variant="danger"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Session Notes Modal ── */}
            <Modal
                visible={notesModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setNotesModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Session Notes</Text>
                        <Text style={styles.modalSubtitle}>Add notes about this training session</Text>

                        <TextInput
                            style={[styles.modalInputLarge, { minHeight: 120 }]}
                            value={trainerNotes}
                            onChangeText={setTrainerNotes}
                            placeholder="Add notes about this session..."
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Cancel"
                                    onPress={() => setNotesModalVisible(false)}
                                    disabled={isSaving}
                                    variant="ghost"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Save Notes"
                                    onPress={handleSaveNotes}
                                    loading={isSaving}
                                    variant="primary"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    // Status banner
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        padding: Spacing.xl,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    statusBannerText: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },

    // Status history
    statusHistory: {
        marginBottom: Spacing.xl,
        paddingLeft: Spacing.md,
    },
    statusHistoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusHistoryText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // User card
    userCard: {
        marginBottom: Spacing.xl,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    userName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    userRole: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textTransform: 'capitalize',
        marginTop: 2,
    },
    messageButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Section card spacing
    sectionCard: {
        marginBottom: Spacing.md,
    },

    // Info card
    infoCardInner: {
        padding: Spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    infoLabel: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },

    // Notes
    noteText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    noteDate: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: Spacing.sm,
    },

    // Actions
    actionsSection: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    actionSpacing: {
        marginTop: Spacing.md,
    },
    actionSpacingBottom: {
        marginBottom: Spacing.md,
    },
    futureNote: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.md,
        fontStyle: 'italic',
    },

    // Payment badge
    paymentBadgeCard: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.successLight,
    },
    paymentBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    paymentPaidText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.success,
    },

    // Review
    reviewSubmittedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    reviewSubmittedText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    reviewLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    starsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    starButton: {
        padding: 4,
    },
    reviewInput: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        minHeight: 80,
    },

    // Cancellation
    cancellationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    cancellationTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginLeft: Spacing.sm,
    },

    // Reschedule banner
    rescheduleBanner: {
        marginTop: Spacing.md,
        backgroundColor: Colors.warningLight,
        borderWidth: 1,
        borderColor: Colors.warning,
    },
    rescheduleBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    rescheduleBannerTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.warning,
    },
    rescheduleBannerBody: {
        marginBottom: Spacing.sm,
    },
    rescheduleBannerLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginBottom: 2,
    },
    rescheduleBannerValue: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: FontWeight.semibold,
    },
    rescheduleResponseRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.md,
    },

    // Calendar modal
    calendarModalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    calendarModalCard: {
        backgroundColor: Colors.card,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        paddingBottom: 40,
    },
    calendarModalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignSelf: 'center',
        marginBottom: Spacing.xl,
    },
    calendarModalTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.xl,
    },
    calendarOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    calendarOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.infoLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    calendarOptionText: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },

    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xxl,
    },
    modalCard: {
        width: '100%',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xxl,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    modalSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xl,
    },
    inputLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    modalInputSmall: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        marginBottom: Spacing.md,
    },
    modalInputLarge: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        minHeight: 100,
        marginBottom: Spacing.xl,
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
});
