import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'];

type AvailabilitySlot = {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_recurring: boolean;
    is_blocked: boolean;
};

export default function AvailabilityScreen({ navigation }: any) {
    const { user } = useAuth();
    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(new Date().getDay());

    const fetchSlots = useCallback(async () => {
        if (!user) return;
        try {
            // Get trainer profile id first
            const { data: profile } = await supabase
                .from('trainer_profiles')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!profile) return;

            const { data, error } = await supabase
                .from('availability_slots')
                .select('*')
                .eq('trainer_id', profile.id)
                .order('day_of_week', { ascending: true })
                .order('start_time', { ascending: true });

            if (error) throw error;
            setSlots((data || []) as AvailabilitySlot[]);
        } catch (error) {
            console.error('Error fetching availability:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchSlots(); }, [fetchSlots]);
    const onRefresh = async () => { setRefreshing(true); await fetchSlots(); setRefreshing(false); };

    const daySlots = slots.filter(s => s.day_of_week === selectedDay);

    const toggleSlot = async (timeSlot: string) => {
        if (!user) return;
        const existingSlot = daySlots.find(s => s.start_time === convertTo24h(timeSlot));

        try {
            const { data: profile } = await supabase.from('trainer_profiles').select('id').eq('user_id', user.id).single();
            if (!profile) return;

            if (existingSlot) {
                // Remove slot
                await supabase.from('availability_slots').delete().eq('id', existingSlot.id);
                setSlots(prev => prev.filter(s => s.id !== existingSlot.id));
            } else {
                // Add slot
                const startTime = convertTo24h(timeSlot);
                const endIdx = TIME_SLOTS.indexOf(timeSlot);
                const endTime = endIdx < TIME_SLOTS.length - 1 ? convertTo24h(TIME_SLOTS[endIdx + 1]) : '21:00';

                const { data, error } = await supabase.from('availability_slots').insert({
                    trainer_id: profile.id,
                    day_of_week: selectedDay,
                    start_time: startTime,
                    end_time: endTime,
                    is_recurring: true,
                    is_blocked: false,
                }).select().single();

                if (error) throw error;
                if (data) setSlots(prev => [...prev, data as AvailabilitySlot]);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const convertTo24h = (time12h: string): string => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = modifier === 'AM' ? '0' : '12';
        else if (modifier === 'PM') hours = String(parseInt(hours) + 12);
        return `${hours.padStart(2, '0')}:${minutes}`;
    };

    const isSlotActive = (timeSlot: string) => {
        const time24 = convertTo24h(timeSlot);
        return daySlots.some(s => s.start_time === time24);
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
                <Text style={styles.headerTitle}>Availability</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* Day selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector} contentContainerStyle={{ gap: Spacing.sm }}>
                    {DAYS.map((day, i) => (
                        <TouchableOpacity
                            key={day}
                            style={[styles.dayButton, selectedDay === i && styles.dayButtonActive]}
                            onPress={() => setSelectedDay(i)}
                        >
                            <Text style={[styles.dayButtonText, selectedDay === i && styles.dayButtonTextActive]}>
                                {day.slice(0, 3)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.helperText}>Tap time slots to toggle your availability for {DAYS[selectedDay]}</Text>

                {/* Time slots */}
                <View style={styles.slotsGrid}>
                    {TIME_SLOTS.map((slot) => {
                        const active = isSlotActive(slot);
                        return (
                            <TouchableOpacity
                                key={slot}
                                style={[styles.slotButton, active && styles.slotButtonActive]}
                                onPress={() => toggleSlot(slot)}
                            >
                                <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                                {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.summaryCard}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.summaryText}>
                        You have {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''} set for {DAYS[selectedDay]}.
                        Total weekly slots: {slots.length}
                    </Text>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    daySelector: { marginBottom: Spacing.lg },
    dayButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    dayButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dayButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    dayButtonTextActive: { color: '#fff' },
    helperText: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.lg },
    slotsGrid: { gap: Spacing.sm },
    slotButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    slotButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    slotText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
    slotTextActive: { color: '#fff' },
    summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xxl, padding: Spacing.lg, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.md },
    summaryText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
});
