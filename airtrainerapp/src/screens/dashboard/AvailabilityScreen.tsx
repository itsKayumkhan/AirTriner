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
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Hourly slots 06:00–20:00
const TIME_SLOTS: { label: string; start: string; end: string }[] = [];
for (let h = 6; h <= 20; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const end = `${String(h + 1).padStart(2, '0')}:00`;
    const period = h < 12 ? 'AM' : 'PM';
    const display12 = h === 12 ? 12 : h > 12 ? h - 12 : h;
    TIME_SLOTS.push({ label: `${display12}:00 ${period}`, start, end });
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

    const fetchAvailability = useCallback(async () => {
        if (!user) return;
        try {
            // Resolve trainer profile id – prefer trainerProfile from context, fallback to query
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
                .select('day_of_week, start_time')
                .eq('trainer_id', profileId);

            if (error) throw error;

            const built: SelectedSlots = {};
            for (const slot of data || []) {
                const d = slot.day_of_week as number;
                if (!built[d]) built[d] = new Set();
                built[d].add(slot.start_time as string);
            }
            setSelectedSlots(built);
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

            // 2. Build insert array from selectedSlots
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
                    const slot = TIME_SLOTS.find((s) => s.start === startTime);
                    const endTime = slot ? slot.end : '21:00';
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
        paddingTop: 60,
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
        marginBottom: Spacing.xl,
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
    slotText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    slotTextActive: {
        color: Colors.background,
        fontWeight: FontWeight.bold,
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
