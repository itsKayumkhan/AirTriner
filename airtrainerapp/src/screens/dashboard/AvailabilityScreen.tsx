import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import SectionHeader from '../../components/ui/SectionHeader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DURATIONS = [30, 45, 60] as const;

function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function slotDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function to12h(t: string): string {
    const hhmm = t.slice(0, 5);
    const [hStr, m] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

function formatDateLabel(d: Date): string {
    return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

const TIME_SLOTS: { label: string; start: string }[] = [];
for (let h = 6; h <= 20; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const period = h < 12 ? 'AM' : 'PM';
    const display12 = h === 12 ? 12 : h > 12 ? h - 12 : h;
    TIME_SLOTS.push({ label: `${display12}:00 ${period}`, start });
}

type SelectedSlots = Record<number, Set<string>>;

interface OneOffSlotRow {
    id: string;
    trainer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_blocked: boolean;
}

type Mode = 'recurring' | 'oneoff';

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

    // Mode toggle (default = recurring; preserves existing behavior)
    const [mode, setMode] = useState<Mode>('recurring');

    // One-off (per-slot) state
    const [oneOffDate, setOneOffDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [oneOffSlots, setOneOffSlots] = useState<OneOffSlotRow[]>([]);
    const [isOneOffLoading, setIsOneOffLoading] = useState(false);
    const [oneOffStart, setOneOffStart] = useState('09:00');
    const [oneOffDuration, setOneOffDuration] = useState<number>(60);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const fetchAvailability = useCallback(async () => {
        if (!user) return;
        try {
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

    const fetchOneOffForDate = useCallback(
        async (profileId: string, date: Date) => {
            setIsOneOffLoading(true);
            try {
                const dow = date.getDay();
                const { data, error } = await supabase
                    .from('availability_slots')
                    .select('id, trainer_id, day_of_week, start_time, end_time, is_blocked')
                    .eq('trainer_id', profileId)
                    .eq('day_of_week', dow)
                    .order('start_time');
                if (error) throw error;
                setOneOffSlots((data || []) as OneOffSlotRow[]);
            } catch (err) {
                console.error('Error loading one-off slots:', err);
                setOneOffSlots([]);
            } finally {
                setIsOneOffLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        if (mode === 'oneoff' && trainerProfileId) {
            fetchOneOffForDate(trainerProfileId, oneOffDate);
        }
    }, [mode, trainerProfileId, oneOffDate, fetchOneOffForDate]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAvailability();
        if (mode === 'oneoff' && trainerProfileId) {
            await fetchOneOffForDate(trainerProfileId, oneOffDate);
        }
        setRefreshing(false);
    };

    const toggleSlot = (startTime: string) => {
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
            const { error: deleteError } = await supabase
                .from('availability_slots')
                .delete()
                .eq('trainer_id', trainerProfileId);

            if (deleteError) throw deleteError;

            const toInsert: {
                trainer_id: string;
                day_of_week: number;
                start_time: string;
                end_time: string;
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

    const addOneOffSlot = async () => {
        if (!trainerProfileId) {
            Alert.alert('Error', 'Trainer profile not found.');
            return;
        }
        const computedEnd = addMinutes(oneOffStart, oneOffDuration);

        if (timeToMinutes(computedEnd) <= timeToMinutes(oneOffStart)) {
            Alert.alert('Invalid time', 'Slot would extend past midnight. Choose an earlier start time.');
            return;
        }

        // Conflict check against existing slots for this day_of_week
        const conflict = oneOffSlots.find((s) => {
            const eS = s.start_time.slice(0, 5);
            const eE = s.end_time.slice(0, 5);
            return (
                (oneOffStart >= eS && oneOffStart < eE) ||
                (computedEnd > eS && computedEnd <= eE) ||
                (oneOffStart <= eS && computedEnd >= eE)
            );
        });
        if (conflict) {
            Alert.alert(
                'Conflict',
                `Time conflicts with existing slot: ${to12h(conflict.start_time)} – ${to12h(conflict.end_time)}`
            );
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('availability_slots')
                .insert({
                    trainer_id: trainerProfileId,
                    day_of_week: oneOffDate.getDay(),
                    start_time: oneOffStart,
                    end_time: computedEnd,
                    is_blocked: false,
                })
                .select()
                .single();
            if (error) throw error;
            setOneOffSlots((prev) =>
                [...prev, data as OneOffSlotRow].sort((a, b) =>
                    a.start_time.localeCompare(b.start_time)
                )
            );
        } catch (err: any) {
            console.error('Error adding one-off slot:', err);
            Alert.alert('Error', err.message || 'Failed to add slot.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteOneOffSlot = async (slotId: string) => {
        try {
            const { error } = await supabase
                .from('availability_slots')
                .delete()
                .eq('id', slotId);
            if (error) throw error;
            setOneOffSlots((prev) => prev.filter((s) => s.id !== slotId));
        } catch (err: any) {
            console.error('Error deleting slot:', err);
            Alert.alert('Error', err.message || 'Failed to delete slot.');
        }
    };

    const handleDateChange = (_event: any, picked?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (picked) setOneOffDate(picked);
    };

    const handleTimeChange = (_event: any, picked?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (picked) {
            const hh = String(picked.getHours()).padStart(2, '0');
            const mm = String(picked.getMinutes()).padStart(2, '0');
            setOneOffStart(`${hh}:${mm}`);
        }
    };

    const oneOffStartAsDate = (() => {
        const [h, m] = oneOffStart.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    })();

    const totalSelectedForDay = selectedSlots[selectedDay]?.size ?? 0;
    const totalSelected = Object.values(selectedSlots).reduce(
        (sum, s) => sum + s.size,
        0,
    );

    if (isLoading) {
        return <LoadingScreen message="Loading availability..." />;
    }

    return (
        <ScreenWrapper
            refreshing={refreshing}
            onRefresh={onRefresh}
        >
            <ScreenHeader
                title="Availability"
                subtitle={mode === 'recurring' ? 'Set your weekly schedule' : 'Add one-off slots'}
                onBack={() => navigation.goBack()}
            />

            {/* Mode toggle */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <View style={styles.modeToggle}>
                    <Pressable
                        style={[styles.modePill, mode === 'recurring' && styles.modePillActive]}
                        onPress={() => setMode('recurring')}
                        accessibilityLabel="Recurring weekly mode"
                    >
                        <Ionicons
                            name="repeat-outline"
                            size={16}
                            color={mode === 'recurring' ? Colors.textInverse : Colors.textSecondary}
                        />
                        <Text style={[styles.modePillText, mode === 'recurring' && styles.modePillTextActive]}>
                            Recurring
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.modePill, mode === 'oneoff' && styles.modePillActive]}
                        onPress={() => setMode('oneoff')}
                        accessibilityLabel="One-off slots mode"
                    >
                        <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={mode === 'oneoff' ? Colors.textInverse : Colors.textSecondary}
                        />
                        <Text style={[styles.modePillText, mode === 'oneoff' && styles.modePillTextActive]}>
                            One-off slots
                        </Text>
                    </Pressable>
                </View>
            </Animated.View>

            {mode === 'recurring' ? (
                <>
                    {/* Description */}
                    <Animated.View entering={FadeInDown.duration(250)}>
                        <Text style={styles.subtitle}>
                            Set your weekly recurring availability. Athletes can only book during these windows.
                        </Text>
                    </Animated.View>

                    {/* Duration selector - segmented control style */}
                    <Animated.View entering={FadeInDown.duration(250).delay(30)}>
                        <Card style={styles.durationCard}>
                            <Text style={styles.durationHeading}>Session Duration</Text>
                            <View style={styles.segmentedControl}>
                                {DURATIONS.map((dur) => {
                                    const isActive = slotDuration === dur;
                                    return (
                                        <Pressable
                                            key={dur}
                                            style={({ pressed }) => [
                                                styles.segment,
                                                isActive && styles.segmentActive,
                                                pressed && { opacity: 0.9 },
                                            ]}
                                            onPress={() => setSlotDuration(dur)}
                                            accessibilityLabel={`${dur} minute sessions`}
                                        >
                                            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                                {dur} min
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Card>
                    </Animated.View>

                    {/* Day selector - horizontal scroll of day cards */}
                    <Animated.View entering={FadeInDown.duration(250).delay(60)}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dayCardsContent}
                            style={styles.dayCards}
                        >
                            {DAYS.map((day, i) => {
                                const count = selectedSlots[i]?.size ?? 0;
                                const isActive = selectedDay === i;
                                return (
                                    <Pressable
                                        key={day}
                                        style={({ pressed }) => [
                                            styles.dayCard,
                                            isActive && styles.dayCardActive,
                                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                        ]}
                                        onPress={() => setSelectedDay(i)}
                                        accessibilityLabel={`${DAY_LABELS[i]}, ${count} slots selected`}
                                    >
                                        <Text style={[styles.dayCardAbbr, isActive && styles.dayCardAbbrActive]}>
                                            {day}
                                        </Text>
                                        <Text style={[styles.dayCardCount, isActive && styles.dayCardCountActive]}>
                                            {count}
                                        </Text>
                                        <Text style={[styles.dayCardSlotLabel, isActive && styles.dayCardSlotLabelActive]}>
                                            slot{count !== 1 ? 's' : ''}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Animated.View>

                    {/* Day heading */}
                    <SectionHeader
                        title={DAY_LABELS[selectedDay]}
                        actionLabel={`${totalSelectedForDay} slot${totalSelectedForDay !== 1 ? 's' : ''}`}
                    />

                    {/* Time slot grid - pill buttons */}
                    <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.slotsGrid}>
                        {TIME_SLOTS.map((slot) => {
                            const active = selectedSlots[selectedDay]?.has(slot.start) ?? false;
                            const isBooked = bookedSlots.has(`${selectedDay}-${slot.start}`);

                            if (isBooked) {
                                return (
                                    <View key={slot.start} style={styles.slotPillBooked}>
                                        <Text style={styles.slotPillBookedText}>{slot.label}</Text>
                                        <Ionicons name="lock-closed" size={12} color={Colors.warning} />
                                    </View>
                                );
                            }

                            return (
                                <Pressable
                                    key={slot.start}
                                    style={({ pressed }) => [
                                        styles.slotPill,
                                        active && styles.slotPillActive,
                                        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                                    ]}
                                    onPress={() => toggleSlot(slot.start)}
                                    accessibilityLabel={`${slot.label}${active ? ', selected' : ''}`}
                                >
                                    <Text style={[styles.slotPillText, active && styles.slotPillTextActive]}>
                                        {slot.label}
                                    </Text>
                                    {active && (
                                        <Ionicons name="checkmark" size={14} color={Colors.textInverse} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </Animated.View>

                    {/* Weekly summary */}
                    <Animated.View entering={FadeInDown.duration(250).delay(120)}>
                        <Card style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                                <Text style={styles.summaryText}>
                                    <Text style={{ fontWeight: FontWeight.bold, color: Colors.primary }}>
                                        {totalSelected}
                                    </Text>{' '}
                                    total weekly slot{totalSelected !== 1 ? 's' : ''} across all days
                                </Text>
                            </View>
                        </Card>
                    </Animated.View>

                    {/* Save button */}
                    <Animated.View entering={FadeInDown.duration(250).delay(50)} style={styles.saveArea}>
                        <Button
                            title="Save Availability"
                            onPress={saveAvailability}
                            icon="save-outline"
                            loading={isSaving}
                            disabled={isSaving}
                            size="lg"
                        />
                    </Animated.View>
                </>
            ) : (
                <>
                    {/* One-off mode */}
                    <Animated.View entering={FadeInDown.duration(250)}>
                        <Text style={styles.subtitle}>
                            Add a one-off slot for a specific date. Useful for ad-hoc sessions or extra hours outside your recurring schedule.
                        </Text>
                    </Animated.View>

                    {/* Date picker card */}
                    <Animated.View entering={FadeInDown.duration(250).delay(30)}>
                        <Card style={styles.durationCard}>
                            <Text style={styles.durationHeading}>Date</Text>
                            <Pressable
                                style={styles.dateRow}
                                onPress={() => setShowDatePicker(true)}
                                accessibilityLabel="Pick date"
                            >
                                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                                <Text style={styles.dateRowText}>{formatDateLabel(oneOffDate)}</Text>
                                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                            </Pressable>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={oneOffDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                    minimumDate={new Date()}
                                    onChange={handleDateChange}
                                />
                            )}
                            {Platform.OS === 'ios' && showDatePicker && (
                                <Pressable
                                    style={styles.iosPickerDone}
                                    onPress={() => setShowDatePicker(false)}
                                >
                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                </Pressable>
                            )}
                        </Card>
                    </Animated.View>

                    {/* Add slot form */}
                    <Animated.View entering={FadeInDown.duration(250).delay(60)}>
                        <Card style={styles.durationCard}>
                            <Text style={styles.durationHeading}>Start Time</Text>
                            <Pressable
                                style={styles.dateRow}
                                onPress={() => setShowTimePicker(true)}
                                accessibilityLabel="Pick start time"
                            >
                                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                                <Text style={styles.dateRowText}>{to12h(oneOffStart)}</Text>
                                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                            </Pressable>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={oneOffStartAsDate}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    minuteInterval={15}
                                    onChange={handleTimeChange}
                                />
                            )}
                            {Platform.OS === 'ios' && showTimePicker && (
                                <Pressable
                                    style={styles.iosPickerDone}
                                    onPress={() => setShowTimePicker(false)}
                                >
                                    <Text style={styles.iosPickerDoneText}>Done</Text>
                                </Pressable>
                            )}

                            <Text style={[styles.durationHeading, { marginTop: Spacing.lg }]}>Duration</Text>
                            <View style={styles.segmentedControl}>
                                {DURATIONS.map((dur) => {
                                    const isActive = oneOffDuration === dur;
                                    return (
                                        <Pressable
                                            key={dur}
                                            style={({ pressed }) => [
                                                styles.segment,
                                                isActive && styles.segmentActive,
                                                pressed && { opacity: 0.9 },
                                            ]}
                                            onPress={() => setOneOffDuration(dur)}
                                        >
                                            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                                {dur} min
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.previewText}>
                                {to12h(oneOffStart)} – {to12h(addMinutes(oneOffStart, oneOffDuration))}
                            </Text>

                            <Button
                                title="Add Slot"
                                onPress={addOneOffSlot}
                                icon="add-circle-outline"
                                loading={isSaving}
                                disabled={isSaving}
                                size="md"
                            />
                        </Card>
                    </Animated.View>

                    {/* Existing one-off slots for this date */}
                    <SectionHeader
                        title={`Slots on ${DAY_LABELS[oneOffDate.getDay()]}`}
                        actionLabel={`${oneOffSlots.length} slot${oneOffSlots.length !== 1 ? 's' : ''}`}
                    />
                    {isOneOffLoading ? (
                        <Text style={styles.subtitle}>Loading...</Text>
                    ) : oneOffSlots.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Ionicons name="time-outline" size={28} color={Colors.textTertiary} />
                            <Text style={styles.emptyText}>No slots for this day yet.</Text>
                        </Card>
                    ) : (
                        <View style={styles.slotsList}>
                            {oneOffSlots.map((slot) => {
                                const dur = slotDurationMinutes(
                                    slot.start_time.slice(0, 5),
                                    slot.end_time.slice(0, 5)
                                );
                                return (
                                    <View key={slot.id} style={styles.slotRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.slotRowTime}>
                                                {to12h(slot.start_time)} – {to12h(slot.end_time)}
                                            </Text>
                                            <Text style={styles.slotRowSub}>{dur} min</Text>
                                        </View>
                                        <Pressable
                                            onPress={() =>
                                                Alert.alert(
                                                    'Delete slot',
                                                    `Delete ${to12h(slot.start_time)} – ${to12h(slot.end_time)}?`,
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Delete',
                                                            style: 'destructive',
                                                            onPress: () => deleteOneOffSlot(slot.id),
                                                        },
                                                    ]
                                                )
                                            }
                                            style={styles.deleteBtn}
                                            accessibilityLabel="Delete slot"
                                        >
                                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    subtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.lg,
    },

    // Mode toggle
    modeToggle: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    modePill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        minHeight: 44,
    },
    modePillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    modePillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    modePillTextActive: {
        color: Colors.textInverse,
        fontWeight: FontWeight.bold,
    },

    // Duration - segmented control
    durationCard: {
        marginBottom: Spacing.xxl,
    },
    durationHeading: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: 3,
    },
    segment: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    segmentActive: {
        backgroundColor: Colors.primary,
    },
    segmentText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    segmentTextActive: {
        color: Colors.textInverse,
        fontWeight: FontWeight.bold,
    },

    // Date row
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        minHeight: 48,
    },
    dateRowText: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    iosPickerDone: {
        alignSelf: 'flex-end',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    iosPickerDoneText: {
        color: Colors.primary,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.sm,
    },
    previewText: {
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },

    // Slots list (one-off)
    slotsList: {
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
    },
    slotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    slotRowTime: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    slotRowSub: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    deleteBtn: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.surface,
    },
    emptyCard: {
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.xxl,
        marginBottom: Spacing.xxl,
    },
    emptyText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },

    // Day cards - horizontal scroll
    dayCards: {
        marginBottom: Spacing.xxl,
    },
    dayCardsContent: {
        gap: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    dayCard: {
        width: 72,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        alignItems: 'center',
        gap: Spacing.xs,
    },
    dayCardActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dayCardAbbr: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },
    dayCardAbbrActive: {
        color: Colors.textInverse,
    },
    dayCardCount: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
    },
    dayCardCountActive: {
        color: Colors.textInverse,
    },
    dayCardSlotLabel: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dayCardSlotLabelActive: {
        color: 'rgba(10, 13, 20, 0.5)',
    },

    // Slots grid - pill buttons
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
    },
    slotPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        minHeight: 44,
    },
    slotPillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    slotPillBooked: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.warningMuted,
        borderWidth: 1,
        borderColor: Colors.warning,
        minHeight: 44,
    },
    slotPillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    slotPillTextActive: {
        color: Colors.textInverse,
        fontWeight: FontWeight.bold,
    },
    slotPillBookedText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.warning,
    },

    // Summary
    summaryCard: {
        backgroundColor: Colors.primaryGlow,
        borderColor: Colors.borderActive,
        marginBottom: Spacing.xxl,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    summaryText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.primary,
        lineHeight: 20,
    },

    // Save
    saveArea: {
        marginBottom: Spacing.lg,
    },
});
