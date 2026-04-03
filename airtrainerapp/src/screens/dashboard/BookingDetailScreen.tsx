import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
    ActivityIndicator, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Calendar from 'expo-calendar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    pending: { color: '#ffab00', bg: 'rgba(255,171,0,0.15)', icon: 'hourglass', label: 'Pending' },
    confirmed: { color: '#45D0FF', bg: 'rgba(69,208,255,0.15)', icon: 'checkmark-circle', label: 'Confirmed' },
    completed: { color: Colors.success, bg: Colors.successLight, icon: 'trophy', label: 'Completed' },
    cancelled: { color: '#ff1744', bg: 'rgba(255,23,68,0.15)', icon: 'close-circle', label: 'Cancelled' },
    no_show: { color: '#ff1744', bg: 'rgba(255,23,68,0.15)', icon: 'alert-circle', label: 'No-Show' },
    disputed: { color: '#ffab00', bg: 'rgba(255,171,0,0.15)', icon: 'flag', label: 'Disputed' },
    reschedule_requested: { color: '#ffab00', bg: 'rgba(255,171,0,0.15)', icon: 'time-outline', label: 'Reschedule Requested' },
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
    const [reviewSubmitted, setReviewSubmitted] = useState(false);

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

    useEffect(() => { fetchBooking(); }, [fetchBooking]);

    useEffect(() => {
        if (booking) {
            fetchRescheduleRequests(booking.id);
        }
    }, [booking, fetchRescheduleRequests]);

    useEffect(() => {
        if (booking && booking.status === 'completed' && user?.role === 'athlete') {
            fetchExistingReview(booking.id);
        }
    }, [booking, user, fetchExistingReview]);

    const isTrainer = user?.role === 'trainer';
    const otherUser = isTrainer ? booking?.athlete : booking?.trainer;

    const handleStatusChange = async (newStatus: string, confirmMsg: string) => {
        Alert.alert('Confirm Action', confirmMsg, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    setIsSaving(true);
                    try {
                        const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
                        if (newStatus === 'cancelled') {
                            updateData.cancelled_at = new Date().toISOString();
                            updateData.cancellation_reason = isTrainer ? 'Cancelled by trainer' : 'Cancelled by athlete';
                        }

                        const { error } = await supabase
                            .from('bookings')
                            .update(updateData)
                            .eq('id', bookingId);
                        if (error) throw error;

                        // Notify the other party
                        const notifMap: Record<string, { type: string; title: string; body: string }> = {
                            completed: {
                                type: 'BOOKING_COMPLETED',
                                title: 'Session Completed ✅',
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
                                title: 'Booking Confirmed! ✅',
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
            fetchBooking();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelWithReason = async () => {
        if (!cancelReason.trim()) return;
        setIsCancelling(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    cancellation_reason: cancelReason.trim(),
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bookingId);
            if (error) throw error;

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

    const handleSubmitReview = async () => {
        if (reviewRating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating before submitting.');
            return;
        }
        setIsSubmittingReview(true);
        try {
            // Insert review
            const { error: insertError } = await supabase.from('reviews').insert({
                booking_id: booking.id,
                trainer_id: booking.trainer_id,
                reviewer_id: user!.id,
                reviewee_id: booking.trainer_id,
                rating: reviewRating,
                review_text: reviewComment.trim() || null,
                created_at: new Date().toISOString(),
            });
            if (insertError) throw insertError;

            // Fetch current trainer profile stats
            const { data: profileData, error: profileFetchError } = await supabase
                .from('trainer_profiles')
                .select('average_rating, total_reviews')
                .eq('user_id', booking.trainer_id)
                .single();
            if (profileFetchError) throw profileFetchError;

            const currentCount = profileData?.total_reviews ?? 0;
            const currentAvg = profileData?.average_rating ?? 0;
            const newCount = currentCount + 1;
            const newAvg = ((currentAvg * currentCount) + reviewRating) / newCount;

            const { error: updateError } = await supabase
                .from('trainer_profiles')
                .update({ average_rating: newAvg, total_reviews: newCount })
                .eq('user_id', booking.trainer_id);
            if (updateError) throw updateError;

            setReviewSubmitted(true);
            setExistingReview({ rating: reviewRating, comment: reviewComment.trim() });
            Alert.alert('Review Submitted', 'Thank you for your feedback!');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

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

    if (isLoading || !booking) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
    const scheduledDate = new Date(booking.scheduled_at);
    const isPast = scheduledDate < new Date();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Session Details</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Status Banner */}
                <LinearGradient
                    colors={[sc.color, sc.color + '88']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.statusBanner}
                >
                    <Ionicons name={sc.icon as any} size={32} color="#fff" />
                    <Text style={styles.statusBannerText}>{sc.label}</Text>
                </LinearGradient>

                {/* User Card */}
                <View style={styles.userCard}>
                    <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                            {(otherUser?.first_name?.[0] || '') + (otherUser?.last_name?.[0] || '')}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{otherUser?.first_name} {otherUser?.last_name}</Text>
                        <Text style={styles.userRole}>{isTrainer ? 'Athlete' : 'Trainer'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => navigation.navigate('Chat', { bookingId, otherUser })}
                    >
                        <Ionicons name="chatbubble" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Session Info */}
                <Text style={styles.sectionTitle}>Session Information</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="tennisball" size={18} color={Colors.primary} />
                        <Text style={styles.infoLabel}>Sport</Text>
                        <Text style={styles.infoValue}>{booking.sport}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar" size={18} color={Colors.primary} />
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>
                            {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time" size={18} color={Colors.primary} />
                        <Text style={styles.infoLabel}>Time</Text>
                        <Text style={styles.infoValue}>
                            {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="hourglass" size={18} color={Colors.primary} />
                        <Text style={styles.infoLabel}>Duration</Text>
                        <Text style={styles.infoValue}>{booking.duration_minutes} minutes</Text>
                    </View>
                    {booking.address && (
                        <View style={styles.infoRow}>
                            <Ionicons name="location" size={18} color={Colors.primary} />
                            <Text style={styles.infoLabel}>Location</Text>
                            <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>{booking.address}</Text>
                        </View>
                    )}
                </View>

                {/* Payment Info */}
                <Text style={styles.sectionTitle}>Payment Details</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="cash" size={18} color={Colors.success} />
                        <Text style={styles.infoLabel}>Session Price</Text>
                        <Text style={[styles.infoValue, { color: '#45D0FF' }]}>${Number(booking.price).toFixed(2)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="remove-circle" size={18} color={Colors.textTertiary} />
                        <Text style={styles.infoLabel}>Platform Fee (3%)</Text>
                        <Text style={styles.infoValue}>-${Number(booking.platform_fee).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="wallet" size={18} color={Colors.primary} />
                        <Text style={[styles.infoLabel, { fontWeight: FontWeight.bold }]}>
                            {isTrainer ? 'Your Payout' : 'Total Paid'}
                        </Text>
                        <Text style={[styles.infoValue, { fontWeight: FontWeight.bold }]}>
                            ${isTrainer ? (Number(booking.price) - Number(booking.platform_fee)).toFixed(2) : Number(booking.total_paid).toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* Notes */}
                <Text style={styles.sectionTitle}>{isTrainer ? 'Session Notes' : 'Your Notes'}</Text>
                <TextInput
                    style={[styles.notesInput]}
                    value={trainerNotes}
                    onChangeText={setTrainerNotes}
                    placeholder="Add notes about this session..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                />
                <TouchableOpacity style={styles.saveNotesButton} onPress={handleSaveNotes} disabled={isSaving}>
                    <Text style={styles.saveNotesButtonText}>Save Notes</Text>
                </TouchableOpacity>

                {booking.athlete_notes && isTrainer && (
                    <>
                        <Text style={styles.sectionTitle}>Athlete Notes</Text>
                        <View style={styles.noteCard}>
                            <Text style={styles.noteText}>{booking.athlete_notes}</Text>
                        </View>
                    </>
                )}

                {/* Action Buttons */}
                {isTrainer && (
                    <View style={styles.actionsSection}>
                        <Text style={styles.sectionTitle}>Actions</Text>

                        {booking.status === 'pending' && (
                            <>
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionAccept]}
                                        onPress={() => handleStatusChange('confirmed', 'Accept this booking request?')}
                                    >
                                        <Ionicons name="checkmark-circle" size={20} color="#0A0D14" />
                                        <Text style={styles.actionButtonTextWhite}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionDecline]}
                                        onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                                    >
                                        <Ionicons name="close-circle" size={20} color="#ff1744" />
                                        <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.actionReschedule, { flex: 0, width: '100%', marginTop: Spacing.md }]}
                                    onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                                >
                                    <Ionicons name="time-outline" size={20} color="#fff" />
                                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Reschedule</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {booking.status === 'confirmed' && (
                            <>
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionComplete]}
                                        onPress={() => handleStatusChange('completed', 'Mark this session as completed?')}
                                        disabled={!isPast}
                                    >
                                        <Ionicons name="trophy" size={20} color="#0A0D14" />
                                        <Text style={styles.actionButtonTextWhite}>Complete</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionNoShow]}
                                        onPress={() => handleStatusChange('no_show', 'Report this athlete as a no-show?')}
                                        disabled={!isPast}
                                    >
                                        <Ionicons name="alert-circle" size={20} color="#ffab00" />
                                        <Text style={[styles.actionButtonText, { color: '#ffab00' }]}>No-Show</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionDecline]}
                                        onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                                    >
                                        <Ionicons name="close" size={20} color="#ff1744" />
                                        <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.actionReschedule, { flex: 0, width: '100%', marginTop: Spacing.md }]}
                                    onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                                >
                                    <Ionicons name="time-outline" size={20} color="#fff" />
                                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Reschedule</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.actionCalendar, { flex: 0, width: '100%', marginTop: Spacing.md }]}
                                    onPress={() => setCalendarModalVisible(true)}
                                >
                                    <Ionicons name="calendar-outline" size={20} color="#fff" />
                                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Add to Calendar</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {!isPast && booking.status === 'confirmed' && (
                            <Text style={styles.futureNote}>
                                Complete and No-Show actions will be available after the scheduled session time.
                            </Text>
                        )}
                    </View>
                )}

                {/* Athlete: Cancel & Reschedule options */}
                {!isTrainer && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'reschedule_requested') && (
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionReschedule, { flex: 0, width: '100%' }]}
                            onPress={() => { setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); setRescheduleModalVisible(true); }}
                        >
                            <Ionicons name="time-outline" size={20} color="#fff" />
                            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Reschedule</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionDecline, { flex: 0, width: '100%', marginTop: Spacing.md }]}
                            onPress={() => { setCancelReason(''); setCancelModalVisible(true); }}
                        >
                            <Ionicons name="close-circle" size={20} color="#ff1744" />
                            <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Cancel Booking</Text>
                        </TouchableOpacity>
                        {booking.status === 'confirmed' && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionCalendar, { flex: 0, width: '100%', marginTop: Spacing.md }]}
                                onPress={() => setCalendarModalVisible(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color="#fff" />
                                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Add to Calendar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Add to Calendar for completed bookings (reference) */}
                {booking.status === 'completed' && (
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionCalendar, { flex: 0, width: '100%' }]}
                            onPress={() => setCalendarModalVisible(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#fff" />
                            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Add to Calendar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Pending Reschedule Requests */}
                {rescheduleRequests.length > 0 && rescheduleRequests.map((req) => {
                    const proposedDate = new Date(req.proposed_time);
                    const isInitiator = req.initiated_by === user?.id;
                    return (
                        <View key={req.id} style={styles.rescheduleBanner}>
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
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.rescheduleAcceptButton]}
                                        onPress={() => handleAcceptReschedule(req)}
                                        disabled={isRespondingReschedule}
                                    >
                                        {isRespondingReschedule
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <>
                                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Accept</Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.rescheduleDeclineButton]}
                                        onPress={() => handleDeclineReschedule(req)}
                                        disabled={isRespondingReschedule}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#fff" />
                                        <Text style={[styles.actionButtonText, { color: '#fff' }]}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* Cancellation details */}
                {booking.status === 'cancelled' && booking.cancellation_reason && (
                    <>
                        <View style={styles.cancellationHeader}>
                            <Ionicons name="information-circle" size={20} color={Colors.error} />
                            <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0, marginLeft: Spacing.sm }]}>Cancellation Reason</Text>
                        </View>
                        <View style={styles.noteCard}>
                            <Text style={styles.noteText}>{booking.cancellation_reason}</Text>
                            {booking.cancelled_at && (
                                <Text style={styles.noteDate}>
                                    {new Date(booking.cancelled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </Text>
                            )}
                        </View>
                    </>
                )}

                {/* Review Section — athlete only, completed bookings */}
                {!isTrainer && booking.status === 'completed' && reviewChecked && (
                    <>
                        <Text style={styles.sectionTitle}>Your Review</Text>
                        {existingReview ? (
                            <View style={styles.reviewSubmittedCard}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                                <Text style={styles.reviewSubmittedText}>
                                    You reviewed this session ⭐ {existingReview.rating}/5
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.reviewCard}>
                                {/* Star selector */}
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
                                                color={star <= reviewRating ? '#45D0FF' : 'rgba(255,255,255,0.3)'}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Comment input */}
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

                                <TouchableOpacity
                                    style={[styles.reviewSubmitButton, isSubmittingReview && { opacity: 0.6 }]}
                                    onPress={handleSubmitReview}
                                    disabled={isSubmittingReview}
                                >
                                    {isSubmittingReview
                                        ? <ActivityIndicator size="small" color="#0A0D14" />
                                        : <Text style={styles.reviewSubmitButtonText}>Submit Review</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Calendar Options Modal */}
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

                        <TouchableOpacity
                            style={styles.calendarCancelButton}
                            onPress={() => setCalendarModalVisible(false)}
                        >
                            <Text style={styles.calendarCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Reschedule Modal */}
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

                        <Text style={styles.rescheduleInputLabel}>Date (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.rescheduleInput}
                            value={rescheduleDate}
                            onChangeText={setRescheduleDate}
                            placeholder="2026-04-15"
                            placeholderTextColor={Colors.textTertiary}
                            maxLength={10}
                        />

                        <Text style={styles.rescheduleInputLabel}>Time (HH:MM)</Text>
                        <TextInput
                            style={styles.rescheduleInput}
                            value={rescheduleTime}
                            onChangeText={setRescheduleTime}
                            placeholder="14:00"
                            placeholderTextColor={Colors.textTertiary}
                            maxLength={5}
                        />

                        <Text style={styles.rescheduleInputLabel}>Reason (optional)</Text>
                        <TextInput
                            style={[styles.rescheduleInput, { minHeight: 80 }]}
                            value={rescheduleReason}
                            onChangeText={setRescheduleReason}
                            placeholder="Reason for rescheduling..."
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity
                                style={styles.modalGoBackButton}
                                onPress={() => setRescheduleModalVisible(false)}
                                disabled={isSubmittingReschedule}
                            >
                                <Text style={styles.modalGoBackText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.rescheduleSubmitButton,
                                    (!rescheduleDate.trim() || !rescheduleTime.trim()) && { opacity: 0.4 },
                                ]}
                                onPress={handleSubmitReschedule}
                                disabled={!rescheduleDate.trim() || !rescheduleTime.trim() || isSubmittingReschedule}
                            >
                                {isSubmittingReschedule
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.rescheduleSubmitText}>Send Request</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Cancel Booking Modal */}
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
                            style={styles.modalInput}
                            value={cancelReason}
                            onChangeText={setCancelReason}
                            placeholder="Why are you cancelling this session?"
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity
                                style={styles.modalGoBackButton}
                                onPress={() => setCancelModalVisible(false)}
                                disabled={isCancelling}
                            >
                                <Text style={styles.modalGoBackText}>Go Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalCancelButton,
                                    !cancelReason.trim() && { opacity: 0.4 },
                                ]}
                                onPress={handleCancelWithReason}
                                disabled={!cancelReason.trim() || isCancelling}
                            >
                                {isCancelling
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.modalCancelText}>Cancel Booking</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    contentContainer: { padding: Spacing.xxl },
    statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, borderRadius: BorderRadius.lg, marginBottom: Spacing.xxl },
    statusBannerText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#fff' },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: Spacing.xxl },
    userAvatar: { width: 50, height: 50, borderRadius: 16, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    userAvatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#45D0FF' },
    userInfo: { flex: 1 },
    userName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    userRole: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
    messageButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#45D0FF', justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.md, marginTop: Spacing.md },
    infoCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: Spacing.md },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    infoLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary },
    infoValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    notesInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: Spacing.md, color: '#FFFFFF', fontSize: FontSize.md, minHeight: 100 },
    saveNotesButton: { alignSelf: 'flex-end', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginTop: Spacing.sm },
    saveNotesButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#45D0FF' },
    noteCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md },
    noteText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
    noteDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm },
    actionsSection: { marginTop: Spacing.xl },
    actionRow: { flexDirection: 'row', gap: Spacing.md },
    actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
    actionAccept: { backgroundColor: '#45D0FF' },
    actionComplete: { backgroundColor: '#45D0FF' },
    actionNoShow: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#ffab00' },
    actionDecline: { backgroundColor: 'rgba(255,23,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,23,68,0.2)' },
    actionButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    actionButtonTextWhite: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#0A0D14' },
    futureNote: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' },
    // Review styles
    reviewCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: Spacing.md },
    reviewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
    starsRow: { flexDirection: 'row', gap: Spacing.sm },
    starButton: { padding: 4 },
    reviewInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: Spacing.md, color: '#FFFFFF', fontSize: FontSize.md, minHeight: 80 },
    reviewSubmitButton: { marginTop: Spacing.lg, backgroundColor: '#45D0FF', borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    reviewSubmitButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#0A0D14' },
    reviewSubmittedCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: Spacing.md },
    reviewSubmittedText: { fontSize: FontSize.md, color: Colors.textSecondary },
    // Cancellation header
    cancellationHeader: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
    // Calendar button & modal styles
    actionCalendar: { backgroundColor: Colors.info },
    calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    calendarModalCard: { backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xxl, paddingBottom: 40 },
    calendarModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: Spacing.xl },
    calendarModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.xl },
    calendarOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    calendarOptionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(69,208,255,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    calendarOptionText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' },
    calendarCancelButton: { marginTop: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
    calendarCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
    // Cancel modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
    modalCard: { width: '100%', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xxl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: Spacing.xs },
    modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
    modalInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: '#FFFFFF', fontSize: FontSize.md, minHeight: 100, marginBottom: Spacing.xl },
    modalButtonRow: { flexDirection: 'row', gap: Spacing.md },
    modalGoBackButton: { flex: 1, backgroundColor: Colors.glass, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    modalGoBackText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
    modalCancelButton: { flex: 1, backgroundColor: Colors.error, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    modalCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    // Reschedule styles
    actionReschedule: { backgroundColor: Colors.warning },
    rescheduleInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: '#FFFFFF', fontSize: FontSize.md, marginBottom: Spacing.md },
    rescheduleInputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    rescheduleSubmitButton: { flex: 1, backgroundColor: Colors.warning, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    rescheduleSubmitText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    rescheduleBanner: { backgroundColor: Colors.warningLight, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.warning, padding: Spacing.lg, marginBottom: Spacing.md, marginTop: Spacing.md },
    rescheduleBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    rescheduleBannerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.warning },
    rescheduleBannerBody: { marginBottom: Spacing.sm },
    rescheduleBannerLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: 2 },
    rescheduleBannerValue: { fontSize: FontSize.md, color: '#FFFFFF', fontWeight: FontWeight.semibold },
    rescheduleResponseRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
    rescheduleAcceptButton: { backgroundColor: Colors.success },
    rescheduleDeclineButton: { backgroundColor: Colors.error },
});
