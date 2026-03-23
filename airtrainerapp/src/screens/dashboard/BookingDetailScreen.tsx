import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
};

export default function BookingDetailScreen({ route, navigation }: any) {
    const { bookingId } = route.params;
    const { user } = useAuth();
    const [booking, setBooking] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trainerNotes, setTrainerNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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

    useEffect(() => { fetchBooking(); }, [fetchBooking]);

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
                                    onPress={() => handleStatusChange('cancelled', 'Decline this booking request?')}
                                >
                                    <Ionicons name="close-circle" size={20} color="#ff1744" />
                                    <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Decline</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {booking.status === 'confirmed' && (
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
                                    onPress={() => handleStatusChange('cancelled', 'Cancel this session?')}
                                >
                                    <Ionicons name="close" size={20} color="#ff1744" />
                                    <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!isPast && booking.status === 'confirmed' && (
                            <Text style={styles.futureNote}>
                                Complete and No-Show actions will be available after the scheduled session time.
                            </Text>
                        )}
                    </View>
                )}

                {/* Athlete: Cancel option */}
                {!isTrainer && (booking.status === 'pending' || booking.status === 'confirmed') && (
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionDecline, { flex: 0, width: '100%' }]}
                            onPress={() => handleStatusChange('cancelled', 'Cancel this booking?')}
                        >
                            <Ionicons name="close-circle" size={20} color="#ff1744" />
                            <Text style={[styles.actionButtonText, { color: '#ff1744' }]}>Cancel Booking</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Cancellation details */}
                {booking.status === 'cancelled' && booking.cancellation_reason && (
                    <>
                        <Text style={styles.sectionTitle}>Cancellation Reason</Text>
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

                <View style={{ height: 60 }} />
            </ScrollView>
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
});
