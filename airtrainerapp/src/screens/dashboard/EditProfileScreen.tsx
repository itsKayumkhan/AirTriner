import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
const TRAINING_TIMES = ['Morning', 'Afternoon', 'Evening'];
const SESSION_LENGTH_OPTIONS = [30, 45, 60, 90];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function EditProfileScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const isTrainer = user?.role === 'trainer';
    const tp = user?.trainerProfile;

    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    // Avatar
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [avatarLoading, setAvatarLoading] = useState(false);
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
    // Training Locations (trainer)
    const [trainingLocations, setTrainingLocations] = useState<string[]>((tp as any)?.training_locations || []);
    const [locationInput, setLocationInput] = useState('');
    // Session Lengths (trainer)
    const [sessionLengths, setSessionLengths] = useState<number[]>((tp as any)?.session_lengths || [60]);
    // Location (athlete)
    const [locationLoading, setLocationLoading] = useState(false);
    // Preferred training times (athlete)
    const [selectedTrainingTimes, setSelectedTrainingTimes] = useState<string[]>(
        user?.athleteProfile?.preferredTrainingTimes || []
    );
    const [phone, setPhone] = useState((user as any)?.phone || (user as any)?.athleteProfile?.phone || '');
    const [gender, setGender] = useState((user as any)?.athleteProfile?.gender || '');
    const [athleteBio, setAthleteBio] = useState((user as any)?.athleteProfile?.bio || '');

    const getInitials = () => {
        const f = (firstName || user?.firstName || '').charAt(0).toUpperCase();
        const l = (lastName || user?.lastName || '').charAt(0).toUpperCase();
        return `${f}${l}` || '?';
    };

    const handlePickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow photo access to upload an avatar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            setAvatarLoading(true);
            try {
                const asset = result.assets[0];
                const fileName = `avatars/${user!.id}_${Date.now()}.jpg`;

                // Read file and upload to Supabase storage
                const response = await fetch(asset.uri);
                const blob = await response.blob();

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                if (uploadError) {
                    Alert.alert('Upload Failed', uploadError.message);
                    setAvatarLoading(false);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

                await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id);
                setAvatarUrl(publicUrl);
            } catch (error: any) {
                Alert.alert('Upload Failed', error.message || 'Could not upload avatar.');
            } finally {
                setAvatarLoading(false);
            }
        }
    };

    const handleSetLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Location access is needed for trainer matching.');
            return;
        }

        setLocationLoading(true);
        try {
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Reverse geocode to get city
            const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });

            await supabase.from('athlete_profiles').update({
                latitude, longitude,
                city: geocode?.city || city,
                state: geocode?.region || stateVal,
            }).eq('user_id', user!.id);

            setCity(geocode?.city || city);
            setStateVal(geocode?.region || stateVal);
            Alert.alert('Location Updated', `Set to ${geocode?.city}, ${geocode?.region}`);
        } catch (error: any) {
            Alert.alert('Location Error', error.message || 'Could not fetch location.');
        } finally {
            setLocationLoading(false);
        }
    };

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

    const toggleTrainingTime = (time: string) => {
        setSelectedTrainingTimes((prev) =>
            prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
        );
    };

    const toggleSessionLength = (len: number) => {
        setSessionLengths((prev) =>
            prev.includes(len) ? prev.filter((l) => l !== len) : [...prev, len]
        );
    };

    const addTrainingLocation = () => {
        const trimmed = locationInput.trim();
        if (trimmed && !trainingLocations.includes(trimmed)) {
            setTrainingLocations((prev) => [...prev, trimmed]);
        }
        setLocationInput('');
    };

    const removeTrainingLocation = (loc: string) => {
        setTrainingLocations((prev) => prev.filter((l) => l !== loc));
    };

    const handleSave = async () => {
        if (!user || !firstName.trim()) return;
        setIsSaving(true);
        try {
            // Update users table
            const { error: userError } = await supabase
                .from('users')
                .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(), updated_at: new Date().toISOString() })
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
                        training_locations: trainingLocations,
                        session_lengths: sessionLengths,
                    })
                    .eq('user_id', user.id);
                if (trainerError) throw trainerError;
            }

            // Update athlete profile (training times + location)
            if (!isTrainer) {
                const { error: athleteError } = await supabase
                    .from('athlete_profiles')
                    .update({
                        preferred_training_times: selectedTrainingTimes,
                        city: city.trim(),
                        state: stateVal.trim(),
                        phone: phone.trim(),
                        gender,
                        bio: athleteBio.trim(),
                    })
                    .eq('user_id', user.id);
                if (athleteError) throw athleteError;
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
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarWrapper}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>{getInitials()}</Text>
                            </View>
                        )}
                        <View style={styles.cameraIconOverlay}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                        {avatarLoading && (
                            <View style={styles.avatarLoadingOverlay}>
                                <ActivityIndicator color="#fff" size="small" />
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={styles.changePhotoButton} onPress={handlePickAvatar} disabled={avatarLoading}>
                        <Ionicons name="image-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                </View>

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

                {/* Training Locations (trainer only) */}
                {isTrainer && (
                    <>
                        <Text style={styles.sectionTitle}>Training Locations</Text>
                        <View style={styles.tagInputRow}>
                            <TextInput
                                style={[styles.input, styles.tagInput]}
                                value={locationInput}
                                onChangeText={setLocationInput}
                                placeholderTextColor={Colors.textTertiary}
                                placeholder="e.g. Downtown Rink, City Gym"
                                onSubmitEditing={addTrainingLocation}
                                returnKeyType="done"
                            />
                            <TouchableOpacity style={styles.addTagButton} onPress={addTrainingLocation}>
                                <Ionicons name="add" size={20} color="#fff" />
                                <Text style={styles.addTagButtonText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                        {trainingLocations.length > 0 && (
                            <View style={styles.chipContainer}>
                                {trainingLocations.map((loc) => (
                                    <View key={loc} style={styles.tagChip}>
                                        <Text style={styles.tagChipText}>{loc}</Text>
                                        <TouchableOpacity style={styles.removeTagButton} onPress={() => removeTrainingLocation(loc)}>
                                            <Ionicons name="close" size={14} color={Colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}

                {/* GPS Location Button (athlete only) */}
                {!isTrainer && (
                    <TouchableOpacity style={styles.locationButton} onPress={handleSetLocation} disabled={locationLoading}>
                        {locationLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name="map-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.locationButtonText}>Set My Location via GPS</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

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

                        {/* Session Lengths */}
                        <Text style={styles.sectionTitle}>Session Lengths</Text>
                        <View style={styles.chipContainer}>
                            {SESSION_LENGTH_OPTIONS.map((len) => (
                                <TouchableOpacity key={len} style={[styles.chip, sessionLengths.includes(len) && styles.chipActive]} onPress={() => toggleSessionLength(len)}>
                                    <Text style={[styles.chipText, sessionLengths.includes(len) && styles.chipTextActive]}>{len}m</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* Athlete-only: Phone, Gender, Bio */}
                {!isTrainer && (
                    <>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholderTextColor={Colors.textTertiary}
                                placeholder="Your phone number"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <Text style={styles.sectionTitle}>Gender</Text>
                        <View style={styles.chipContainer}>
                            {GENDER_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.chip, gender === option && styles.chipActive]}
                                    onPress={() => setGender(gender === option ? '' : option)}
                                >
                                    <Text style={[styles.chipText, gender === option && styles.chipTextActive]}>{option}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={athleteBio}
                                onChangeText={setAthleteBio}
                                placeholderTextColor={Colors.textTertiary}
                                placeholder="Tell trainers about yourself, your goals, and experience..."
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                maxLength={1000}
                            />
                            <Text style={styles.charCount}>{athleteBio.length}/1000</Text>
                        </View>
                    </>
                )}

                {/* Athlete-only: Preferred Training Times */}
                {!isTrainer && (
                    <>
                        <Text style={styles.sectionTitle}>Preferred Training Times</Text>
                        <View style={styles.chipContainer}>
                            {TRAINING_TIMES.map((time) => (
                                <TouchableOpacity key={time} style={[styles.chip, selectedTrainingTimes.includes(time) && styles.chipActive]} onPress={() => toggleTrainingTime(time)}>
                                    <Text style={[styles.chipText, selectedTrainingTimes.includes(time) && styles.chipTextActive]}>{time}</Text>
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
    // Avatar
    avatarSection: { alignItems: 'center', marginBottom: Spacing.lg },
    avatarWrapper: { position: 'relative', marginBottom: Spacing.sm },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
    avatarPlaceholder: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { fontSize: 36, fontWeight: FontWeight.bold, color: Colors.primary },
    cameraIconOverlay: {
        position: 'absolute', bottom: 0, right: 0,
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: Colors.background,
    },
    avatarLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    changePhotoButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        borderWidth: 1, borderColor: Colors.primary,
    },
    changePhotoText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primary },
    // Location button
    locationButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.info,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.lg,
    },
    locationButtonText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    // Existing styles
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
    // Training Locations tag input
    tagInputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    tagInput: { flex: 1 },
    addTagButton: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    addTagButtonText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    tagChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingLeft: Spacing.lg, paddingRight: Spacing.sm, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    },
    tagChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
    removeTagButton: {
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: Colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    saveButton: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.xxl },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
