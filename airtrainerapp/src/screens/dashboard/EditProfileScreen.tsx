import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const ALL_SPORTS = ['Hockey', 'Baseball', 'Basketball', 'Soccer', 'Football', 'Tennis', 'Golf', 'Swimming', 'Boxing', 'Lacrosse', 'Volleyball', 'Track & Field'];
const TRAINING_TYPES = [
    { key: 'one_on_one', label: '1-on-1' },
    { key: 'group', label: 'Group' },
    { key: 'skill_specific', label: 'Skill-Specific' },
    { key: 'strength_conditioning', label: 'S&C' },
    { key: 'pre_season', label: 'Pre-Season' },
    { key: 'in_season', label: 'In-Season' },
];

export default function EditProfileScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const isTrainer = user?.role === 'trainer';
    const tp = user?.trainerProfile;

    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    // Trainer-specific
    const [headline, setHeadline] = useState(tp?.headline || '');
    const [bio, setBio] = useState(tp?.bio || '');
    const [hourlyRate, setHourlyRate] = useState(String(tp?.hourly_rate || '50'));
    const [yearsExp, setYearsExp] = useState(String(tp?.years_experience || '0'));
    const [selectedSports, setSelectedSports] = useState<string[]>(tp?.sports || []);
    const [selectedTrainingTypes, setSelectedTrainingTypes] = useState<string[]>((tp as any)?.trainingTypes || []);
    const [city, setCity] = useState(tp?.city || user?.athleteProfile?.city || '');
    const [stateVal, setStateVal] = useState(tp?.state || user?.athleteProfile?.state || '');
    const [isSaving, setIsSaving] = useState(false);

    const toggleSport = (sport: string) => {
        setSelectedSports((prev) =>
            prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
        );
    };

    const toggleTrainingType = (type: string) => {
        setSelectedTrainingTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );
    };

    const handleSave = async () => {
        if (!user || !firstName.trim()) return;
        setIsSaving(true);
        try {
            // Update users table
            const { error: userError } = await supabase
                .from('users')
                .update({ first_name: firstName.trim(), last_name: lastName.trim(), updated_at: new Date().toISOString() })
                .eq('id', user.id);
            if (userError) throw userError;

            // Update trainer profile
            if (isTrainer && tp) {
                const { error: trainerError } = await supabase
                    .from('trainer_profiles')
                    .update({
                        headline: headline.trim(),
                        bio: bio.trim(),
                        hourly_rate: parseFloat(hourlyRate) || 50,
                        years_experience: parseInt(yearsExp) || 0,
                        sports: selectedSports,
                        trainingTypes: selectedTrainingTypes,
                        city: city.trim(),
                        state: stateVal.trim(),
                    })
                    .eq('user_id', user.id);
                if (trainerError) throw trainerError;
            }

            await refreshUser();
            Alert.alert('Success', 'Profile updated successfully.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Basic Info */}
                <Text style={styles.sectionTitle}>Basic Info</Text>
                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>First Name</Text>
                        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={Colors.textTertiary} placeholder="First name" />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Last Name</Text>
                        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor={Colors.textTertiary} placeholder="Last name" />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Email</Text>
                    <View style={[styles.input, styles.inputDisabled]}>
                        <Text style={styles.disabledText}>{user?.email}</Text>
                    </View>
                </View>

                {/* Location */}
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 2 }]}>
                        <Text style={styles.label}>City</Text>
                        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={Colors.textTertiary} placeholder="City" />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>State</Text>
                        <TextInput style={styles.input} value={stateVal} onChangeText={setStateVal} placeholderTextColor={Colors.textTertiary} placeholder="State" />
                    </View>
                </View>

                {/* Trainer-only sections */}
                {isTrainer && (
                    <>
                        <Text style={styles.sectionTitle}>Professional Info</Text>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Headline</Text>
                            <TextInput style={styles.input} value={headline} onChangeText={setHeadline} placeholderTextColor={Colors.textTertiary} placeholder="e.g. Elite Hockey Coach | 15+ Years" maxLength={200} />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} placeholderTextColor={Colors.textTertiary} placeholder="Tell athletes about your coaching style, experience, and approach..." multiline numberOfLines={5} textAlignVertical="top" maxLength={1000} />
                            <Text style={styles.charCount}>{bio.length}/1000</Text>
                        </View>
                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Hourly Rate ($)</Text>
                                <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} placeholderTextColor={Colors.textTertiary} placeholder="50" keyboardType="numeric" />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Years Experience</Text>
                                <TextInput style={styles.input} value={yearsExp} onChangeText={setYearsExp} placeholderTextColor={Colors.textTertiary} placeholder="0" keyboardType="numeric" />
                            </View>
                        </View>

                        {/* Sports */}
                        <Text style={styles.sectionTitle}>Sports You Coach</Text>
                        <View style={styles.chipContainer}>
                            {ALL_SPORTS.map((sport) => (
                                <TouchableOpacity key={sport} style={[styles.chip, selectedSports.includes(sport) && styles.chipActive]} onPress={() => toggleSport(sport)}>
                                    <Text style={[styles.chipText, selectedSports.includes(sport) && styles.chipTextActive]}>{sport}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Training Types */}
                        <Text style={styles.sectionTitle}>Training Types</Text>
                        <View style={styles.chipContainer}>
                            {TRAINING_TYPES.map((tt) => (
                                <TouchableOpacity key={tt.key} style={[styles.chip, selectedTrainingTypes.includes(tt.key) && styles.chipActive]} onPress={() => toggleTrainingType(tt.key)}>
                                    <Text style={[styles.chipText, selectedTrainingTypes.includes(tt.key) && styles.chipTextActive]}>{tt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                <TouchableOpacity
                    style={[styles.saveButton, (!firstName.trim() || isSaving) && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={!firstName.trim() || isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    row: { flexDirection: 'row', gap: Spacing.md },
    formGroup: { marginBottom: Spacing.lg },
    label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md },
    inputDisabled: { opacity: 0.6 },
    disabledText: { color: Colors.textSecondary, fontSize: FontSize.md },
    textArea: { minHeight: 120 },
    charCount: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    chipTextActive: { color: '#fff' },
    saveButton: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.xxl },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
