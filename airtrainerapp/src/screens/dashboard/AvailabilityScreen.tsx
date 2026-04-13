import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout} from '../../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DURATIONS = [30, 45, 60] as const;

// Helper: add minutes to a HH:MM time string
function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Detect duration from existing slot's start/end
function slotDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
}

// Hourly slots 06:00–20:00
const TIME_SLOTS: { label: string; start: string }[] = [];
for (let h = 6; h <= 20; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const period = h < 12 ? 'AM' : 'PM';
    const display12 = h === 12 ? 12 : h > 12 ? h - 12 : h;
    TIME_SLOTS.push({ label: `${display12}:00 ${period}`, start });
}

// selectedSlots shape: { [dayIndex: number]: Set<startTime> }
type SelectedSlots = Record<number, Set<string>>;

export default function AvailabilityScreen({ navigation }: any) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(new Date().getDay());
    const [selectedSlots, setSelectedSlots] = useState<SelectedSlots>({});
    const [trainerProfileId, setTrainerProfileId] = useState<string | null>(null);
    const [slotDuration, setSlotDuration] = useState(60);
    const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());

    const fetchAvailability = useCallback(async () => {
        if (!user) return;
        try {
            // Resolve trainer profile id
            let profileId: string | null =
                (user.trainerProfile as any)?.id ?? null;

            if (!profileId) {
                const { data: profile } = await supabase
                    .from('trainer_profiles')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();
                profileId = profile?.id ?? null;
            }

            if (!profileId) return;
            setTrainerProfileId(profileId);

            const { data, error } = await supabase
                .from('availability_slots')
                .select('day_of_week, start_time, end_time')
                .eq('trainer_id', profileId);

            if (error) throw error;

            const built: SelectedSlots = {};
            let detectedDuration: number | null = null;
            for (const slot of data || []) {
                const d = slot.day_of_week as number;
                if (!built[d]) built[d] = new Set();
                built[d].add(slot.start_time as string);

                // Detect duration from first slot that has both start and end
                if (detectedDuration === null && slot.start_time && slot.end_time) {
                    const dur = slotDurationMinutes(slot.start_time, slot.end_time);
                    if (dur === 30 || dur === 45 || dur === 60) {
                        detectedDuration = dur;
                    }
                }
            }
            setSelectedSlots(built);
            if (detectedDuration !== null) {
                setSlotDuration(detectedDuration);
            }

            // Fetch bookings for conflict detection
            const { data: bookings } = await supabase
                .from('bookings')
                .select('scheduled_at, duration_minutes, status')
                .eq('trainer_id', profileId)
                .in('status', ['confirmed', 'pending']);

            if (bookings?.length) {
                const booked = new Set<string>();
                for (const b of bookings) {
                    const bDate = new Date(b.scheduled_at);
                    const bDay = bDate.getDay();
                    const bTime = `${String(bDate.getHours()).padStart(2, '0')}:${String(bDate.getMinutes()).padStart(2, '0')}`;
                    // Key: "dayIndex-startTime"
                    booked.add(`${bDay}-${bTime}`);
                }
                setBookedSlots(booked);
            } else {
                setBookedSlots(new Set());
            }
        } catch (err) {
            console.error('Error fetching availability:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAvailability();
    }, [fetchAvailability]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAvailability();
        setRefreshing(false);
    };

    const toggleSlot = (startTime: string) => {
        // Do not toggle booked slots
        if (bookedSlots.has(`${selectedDay}-${startTime}`)) return;

        setSelectedSlots((prev) => {
            const next = { ...prev };
            const daySet = new Set(next[selectedDay] || []);
            if (daySet.has(startTime)) {
                daySet.delete(startTime);
            } else {
                daySet.add(startTime);
            }
            next[selectedDay] = daySet;
            return next;
        });
    };

    const saveAvailability = async () => {
        if (!trainerProfileId) {
            Alert.alert('Error', 'Trainer profile not found.');
            return;
        }
        setIsSaving(true);
        try {
            // 1. Delete all existing slots for this trainer
            const { error: deleteError } = await supabase
                .from('availability_slots')
                .delete()
                .eq('trainer_id', trainerProfileId);

            if (deleteError) throw deleteError;

            // 2. Build insert array from selectedSlots using selected duration
            const toInsert: {
                trainer_id: string;
                day_of_week: number;
                start_time: string;
                end_time: string;
                is_available: boolean;
            }[] = [];

            for (const [dayStr, times] of Object.entries(selectedSlots)) {
                const day = Number(dayStr);
                for (const startTime of Array.from(times)) {
                    const endTime = addMinutes(startTime, slotDuration);
                    toInsert.push({
                        trainer_id: trainerProfileId,
                        day_of_week: day,
                        start_time: startTime,
                        end_time: endTime,
                        is_available: true,
                    });
                }
            }

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('availability_slots')
                    .insert(toInsert);
                if (insertError) throw insertError;
            }

            Alert.alert('Saved', 'Your availability has been updated successfully.');
        } catch (err: any) {
            console.error('Error saving availability:', err);
            Alert.alert('Error', err.message || 'Failed to save availability.');
        } finally {
            setIsSaving(false);
        }
    };

    const totalSelectedForDay = selectedSlots[selectedDay]?.size ?? 0;
    const totalSelected = Object.values(selectedSlots).reduce(
        (sum, s) => sum + s.size,
        0,
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
                <Text style={styles.headerTitle}>Availability</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* Subtitle */}
                <Text style={styles.subtitle}>
                    Set your weekly recurring availability. Athletes can only book during these
                    windows.
                </Text>

                {/* Duration selector pills */}
                <View style={styles.durationRow}>
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.durationLabel}>Session length:</Text>
                    {DURATIONS.map((dur) => {
                        const isActive = slotDuration === dur;
                        return (
                            <TouchableOpacity
                                key={dur}
                                style={[
                                    styles.durationPill,
                                    isActive && styles.durationPillActive,
                                ]}
                                onPress={() => setSlotDuration(dur)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.durationPillText,
                                        isActive && styles.durationPillTextActive,
                                    ]}
                                >
                                    {dur}min
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Day tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dayTabsContent}
                    style={styles.dayTabs}
                >
                    {DAYS.map((day, i) => {
                        const count = selectedSlots[i]?.size ?? 0;
                        const isActive = selectedDay === i;
                        return (
                            <TouchableOpacity
                                key={day}
                                style={[styles.dayTab, isActive && styles.dayTabActive]}
                                onPress={() => setSelectedDay(i)}
                            >
                                <Text
                                    style={[
                                        styles.dayTabLabel,
                                        isActive && styles.dayTabLabelActive,
                                    ]}
                                >
                                    {day}
                                </Text>
                                {count > 0 && (
                                    <View
                                        style={[
                                            styles.dayTabBadge,
                                            isActive && styles.dayTabBadgeActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.dayTabBadgeText,
                                                isActive && styles.dayTabBadgeTextActive,
                                            ]}
                                        >
                                            {count}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Day heading */}
                <View style={styles.dayHeadingRow}>
                    <Text style={styles.dayHeading}>{DAY_LABELS[selectedDay]}</Text>
                    <Text style={styles.daySlotCount}>
                        {totalSelectedForDay} slot{totalSelectedForDay !== 1 ? 's' : ''} selected
                    </Text>
                </View>

                {/* Time slot grid */}
                <View style={styles.slotsGrid}>
                    {TIME_SLOTS.map((slot) => {
                        const active = selectedSlots[selectedDay]?.has(slot.start) ?? false;
                        const isBooked = bookedSlots.has(`${selectedDay}-${slot.start}`);

                        if (isBooked) {
                            return (
                                <View
                                    key={slot.start}
                                    style={[styles.slotButton, styles.slotButtonBooked]}
                                >
                                    <View>
                                        <Text style={styles.slotTextBooked}>
                                            {slot.label}
                                        </Text>
                                        <Text style={styles.bookedLabel}>BOOKED</Text>
                                    </View>
                                    <Ionicons
                                        name="lock-closed"
                                        size={18}
                                        color="#92400E"
                                    />
                                </View>
                            );
                        }

                        return (
                            <TouchableOpacity
                                key={slot.start}
                                style={[styles.slotButton, active && styles.slotButtonActive]}
                                onPress={() => toggleSlot(slot.start)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[styles.slotText, active && styles.slotTextActive]}
                                >
                                    {slot.label}
                                </Text>
                                {active ? (
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={18}
                                        color={Colors.background}
                                    />
                                ) : (
                                    <Ionicons
                                        name="add-circle-outline"
                                        size={18}
                                        color={Colors.textTertiary}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Weekly summary */}
                <View style={styles.summaryCard}>
                    <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={Colors.primary}
                    />
                    <Text style={styles.summaryText}>
                        <Text style={{ fontWeight: FontWeight.bold, color: Colors.primary }}>
                            {totalSelected}
                        </Text>{' '}
                        total weekly slot{totalSelected !== 1 ? 's' : ''} across all days
                    </Text>
                </View>

                {/* Bottom padding for fixed button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fixed save button */}
            <View style={styles.saveContainer}>
                <TouchableOpacity
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={saveAvailability}
                    disabled={isSaving}
                    activeOpacity={0.85}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={Colors.background} />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color={Colors.background} />
                            <Text style={styles.saveButtonText}>Save Availability</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
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

    contentContainer: {
        paddingHorizontal: Spacing.xxl,
        paddingTop: Spacing.xl,
    },
    subtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.lg,
    },

    // Duration selector
    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    durationLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginRight: Spacing.xs,
    },
    durationPill: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    durationPillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    durationPillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    durationPillTextActive: {
        color: Colors.background,
    },

    // Day tabs
    dayTabs: {
        marginBottom: Spacing.xl,
    },
    dayTabsContent: {
        gap: Spacing.sm,
        paddingRight: Spacing.xxl,
    },
    dayTab: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        minWidth: 56,
        gap: 4,
    },
    dayTabActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dayTabLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    dayTabLabelActive: {
        color: Colors.background,
    },
    dayTabBadge: {
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    dayTabBadgeActive: {
        backgroundColor: 'rgba(10, 13, 20, 0.25)',
    },
    dayTabBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    dayTabBadgeTextActive: {
        color: Colors.background,
    },

    // Day heading
    dayHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    dayHeading: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    daySlotCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // Slots grid
    slotsGrid: {
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
    },
    slotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    slotButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    slotButtonBooked: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    slotText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    slotTextActive: {
        color: Colors.background,
        fontWeight: FontWeight.bold,
    },
    slotTextBooked: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: '#92400E',
    },
    bookedLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: '#D97706',
        marginTop: 2,
    },

    // Summary
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    summaryText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.primary,
        lineHeight: 20,
    },

    // Save button
    saveContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.xxl,
        paddingBottom: 34,
        paddingTop: Spacing.md,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: '#45D0FF',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#0A0D14',
    },
});
