import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, LayoutAnimation,
    Switch, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import LocationAutocomplete, { LocationValue } from '../../components/LocationAutocomplete';
import { detectCountry, radiusUnit, miToKm, kmToMi } from '../../lib/units';
import { PLATFORM_CURRENCY_SYMBOL } from '../../lib/currency';
import {
    ALLOWED_SESSION_DURATIONS,
    normalizeSessionPricing,
    type AllowedDuration,
} from '../../lib/session-pricing';
import {
    ScreenWrapper, Card, Button, Input, Avatar, Divider,
} from '../../components/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Constants ── */
const FALLBACK_SPORTS = ['Hockey', 'Baseball', 'Basketball', 'Soccer', 'Football', 'Tennis', 'Golf', 'Swimming', 'Boxing', 'Lacrosse', 'Volleyball', 'Track & Field'];
const TRAINING_TYPES = [
    { key: 'one_on_one', label: '1-on-1' },
    { key: 'group', label: 'Group' },
    { key: 'skill_specific', label: 'Skill-Specific' },
    { key: 'strength_conditioning', label: 'S&C' },
    { key: 'pre_season', label: 'Pre-Season' },
    { key: 'in_season', label: 'In-Season' },
];
const TRAINING_TIMES = ['Morning', 'Afternoon', 'Evening'];
const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

type SessionPricingState = Record<`${AllowedDuration}`, { price: string; enabled: boolean }>;

const DEFAULT_SESSION_PRICING_STATE: SessionPricingState = {
    '30': { price: '25', enabled: false },
    '45': { price: '37.5', enabled: false },
    '60': { price: '50', enabled: true },
};
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const;

/** Returns true if the user is likely in Canada based on postal code or country */
function isCanada(zip: string, countryVal: string): boolean {
    return detectCountry(zip) === 'CA' || countryVal.toLowerCase().includes('canada');
}

/* ── Chip Component ── */
function Chip({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
        >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
            </Text>
        </Pressable>
    );
}

/* ── Segmented Control for Skill Level ── */
function SegmentedControl({
    options,
    selected,
    onChange,
}: {
    options: readonly string[];
    selected: string;
    onChange: (v: string) => void;
}) {
    const selectedIdx = options.indexOf(selected);
    const translateX = useSharedValue(selectedIdx * (100 / options.length));

    useEffect(() => {
        const idx = options.indexOf(selected);
        translateX.value = withSpring(idx * (100 / options.length), {
            damping: 20,
            stiffness: 180,
        });
    }, [selected, options, translateX]);

    const indicatorStyle = useAnimatedStyle(() => ({
        left: `${translateX.value}%`,
        width: `${100 / options.length}%`,
    }));

    return (
        <View style={styles.segmentedContainer}>
            <Animated.View style={[styles.segmentedIndicator, indicatorStyle]} />
            {options.map((opt) => (
                <Pressable
                    key={opt}
                    style={styles.segmentedOption}
                    onPress={() => onChange(opt)}
                >
                    <Text
                        style={[
                            styles.segmentedText,
                            selected === opt && styles.segmentedTextActive,
                        ]}
                    >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

/* ── Section Card wrapper ── */
function SectionCard({
    title,
    children,
    delay = 0,
}: {
    title: string;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <Animated.View entering={FadeInDown.duration(250).delay(delay)}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Card style={styles.sectionCard}>{children}</Card>
        </Animated.View>
    );
}

/* ══════════════════════════════════════════════ */
/*  Main Screen                                   */
/* ══════════════════════════════════════════════ */

export default function EditProfileScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const isTrainer = user?.role === 'trainer';
    const tp = user?.trainerProfile;

    /* ── state ── */
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarPendingApproval, setAvatarPendingApproval] = useState(false);
    const [bannerUrl, setBannerUrl] = useState((tp as any)?.banner_url || '');
    const [bannerLoading, setBannerLoading] = useState(false);
    const [headline, setHeadline] = useState(tp?.headline || '');
    const [bio, setBio] = useState(tp?.bio || '');
    const [yearsExp, setYearsExp] = useState(String(tp?.years_experience || '0'));
    const [selectedSports, setSelectedSports] = useState<string[]>(tp?.sports || []);
    const [selectedTrainingTypes, setSelectedTrainingTypes] = useState<string[]>((tp as any)?.trainingTypes || []);
    const [city, setCity] = useState(tp?.city || user?.athleteProfile?.city || '');
    const [stateVal, setStateVal] = useState(tp?.state || user?.athleteProfile?.state || '');
    const [country, setCountry] = useState(
        (tp as any)?.country || user?.athleteProfile?.country || ''
    );
    const [isSaving, setIsSaving] = useState(false);
    const [trainingLocations, setTrainingLocations] = useState<string[]>((tp as any)?.training_locations || []);
    const [locationInput, setLocationInput] = useState('');
    const [sessionPricing, setSessionPricing] = useState<SessionPricingState>(() => {
        if (!isTrainer) return DEFAULT_SESSION_PRICING_STATE;
        const normalized = normalizeSessionPricing(
            (tp as any)?.session_pricing,
            tp?.hourly_rate ?? 50
        );
        const out = { ...DEFAULT_SESSION_PRICING_STATE };
        for (const d of ALLOWED_SESSION_DURATIONS) {
            const key = String(d) as `${AllowedDuration}`;
            const e = normalized[key];
            if (e) out[key] = { price: String(e.price), enabled: !!e.enabled };
        }
        return out;
    });
    const [locationLoading, setLocationLoading] = useState(false);
    const [selectedTrainingTimes, setSelectedTrainingTimes] = useState<string[]>(
        user?.athleteProfile?.preferredTrainingTimes || []
    );
    const [phone, setPhone] = useState((user as any)?.phone || '');
    const [dateOfBirth, setDateOfBirth] = useState((user as any)?.dateOfBirth || '');
    const [sex, setSex] = useState((user as any)?.sex || '');
    const [skillLevel, setSkillLevel] = useState(user?.athleteProfile?.skill_level || '');
    const [addressLine1, setAddressLine1] = useState(user?.athleteProfile?.address_line1 || '');
    const [zipCode, setZipCode] = useState(user?.athleteProfile?.zip_code || '');
    const storedRadiusMiles = tp?.travel_radius_miles || user?.athleteProfile?.travel_radius_miles || 25;
    const initialZip = user?.athleteProfile?.zip_code || '';
    const initialCountry = (tp as any)?.country || user?.athleteProfile?.country || '';
    const [travelRadius, setTravelRadius] = useState(() => {
        // Display in km when the stored postal code looks Canadian
        if (isCanada(initialZip, initialCountry)) {
            return String(Math.round(miToKm(storedRadiusMiles)));
        }
        return String(storedRadiusMiles);
    });
    const [sportsList, setSportsList] = useState<string[]>(FALLBACK_SPORTS);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    /* ── data fetch ── */
    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('sports').select('name').eq('is_active', true).order('name');
            if (data && data.length > 0) {
                setSportsList(data.map((s: any) => s.name));
            }
        })();
        (async () => {
            if (!user) return;
            const { data: userData } = await supabase.from('users').select('phone, date_of_birth, sex').eq('id', user.id).single();
            if (userData) {
                setPhone(userData.phone || '');
                setDateOfBirth(userData.date_of_birth || '');
                setSex(userData.sex || '');
            }
        })();
    }, [user]);

    const fullName = `${firstName || user?.firstName || ''} ${lastName || user?.lastName || ''}`.trim();
    const getInitials = () => {
        const f = (firstName || user?.firstName || '').charAt(0).toUpperCase();
        const l = (lastName || user?.lastName || '').charAt(0).toUpperCase();
        return `${f}${l}` || '?';
    };

    /* ── avatar picker ── */
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

                if (isTrainer) {
                    // Trainers: a new profile photo re-triggers admin verification.
                    // Mirrors the web `dashboard/trainer/setup` flow.
                    const { error: tpError } = await supabase
                        .from('trainer_profiles')
                        .update({
                            profile_image_url: publicUrl,
                            profile_image_status: 'pending',
                            profile_image_rejection_reason: null,
                            verification_status: 'pending',
                            is_verified: false,
                        })
                        .eq('user_id', user!.id);
                    if (tpError) {
                        // Some columns may not exist on older schemas — fall back so
                        // the user still sees their avatar update.
                        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id);
                        setAvatarUrl(publicUrl);
                    } else {
                        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id);
                        setAvatarUrl(publicUrl);
                        setAvatarPendingApproval(true);
                        Alert.alert(
                            'Re-verification needed',
                            'Your new profile photo will be reviewed by an admin. Your profile is hidden from search results until approved.'
                        );
                    }
                } else {
                    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id);
                    setAvatarUrl(publicUrl);
                }
            } catch (error: any) {
                Alert.alert('Upload Failed', error.message || 'Could not upload avatar.');
            } finally {
                setAvatarLoading(false);
            }
        }
    };

    /* ── banner picker (trainer-only) ── */
    const handlePickBanner = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow photo access to upload a banner.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            setBannerLoading(true);
            try {
                const asset = result.assets[0];
                // ~2MB cap
                if ((asset as any).fileSize && (asset as any).fileSize > 2 * 1024 * 1024) {
                    Alert.alert('File too large', 'Please choose a banner under 2MB.');
                    setBannerLoading(false);
                    return;
                }
                const fileName = `banners/${user!.id}_${Date.now()}.jpg`;

                const response = await fetch(asset.uri);
                const blob = await response.blob();

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                if (uploadError) {
                    Alert.alert('Upload Failed', uploadError.message);
                    setBannerLoading(false);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

                const { error: updateError } = await supabase
                    .from('trainer_profiles')
                    .update({ banner_url: publicUrl })
                    .eq('user_id', user!.id);
                if (updateError) {
                    Alert.alert('Save Failed', updateError.message);
                    setBannerLoading(false);
                    return;
                }
                setBannerUrl(publicUrl);
            } catch (error: any) {
                Alert.alert('Upload Failed', error.message || 'Could not upload banner.');
            } finally {
                setBannerLoading(false);
            }
        }
    };

    const handleRemoveBanner = async () => {
        if (!user) return;
        try {
            setBannerLoading(true);
            const { error: updateError } = await supabase
                .from('trainer_profiles')
                .update({ banner_url: null })
                .eq('user_id', user.id);
            if (updateError) {
                Alert.alert('Remove Failed', updateError.message);
                return;
            }
            setBannerUrl('');
        } catch (error: any) {
            Alert.alert('Remove Failed', error.message || 'Could not remove banner.');
        } finally {
            setBannerLoading(false);
        }
    };

    /* ── location ── */
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

    /* ── toggles ── */
    const toggleSport = (sport: string) =>
        setSelectedSports((prev) =>
            prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
        );

    const toggleTrainingType = (type: string) =>
        setSelectedTrainingTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );

    const toggleTrainingTime = (time: string) =>
        setSelectedTrainingTimes((prev) =>
            prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
        );

    const toggleDurationEnabled = (d: AllowedDuration) => {
        setSessionPricing((prev) => {
            const key = String(d) as `${AllowedDuration}`;
            return { ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } };
        });
        setFieldErrors((p) => { const n = { ...p }; delete n.sessionPricing; return n; });
    };

    const setDurationPrice = (d: AllowedDuration, price: string) => {
        setSessionPricing((prev) => {
            const key = String(d) as `${AllowedDuration}`;
            return { ...prev, [key]: { ...prev[key], price } };
        });
        setFieldErrors((p) => { const n = { ...p }; delete n.sessionPricing; return n; });
    };

    const addTrainingLocation = () => {
        const trimmed = locationInput.trim();
        if (trimmed && !trainingLocations.includes(trimmed)) {
            setTrainingLocations((prev) => [...prev, trimmed]);
        }
        setLocationInput('');
    };

    const removeTrainingLocation = (loc: string) =>
        setTrainingLocations((prev) => prev.filter((l) => l !== loc));

    /* ── validation ── */
    const validate = (): boolean => {
        const errors: Record<string, string> = {};
        if (!firstName.trim()) errors.firstName = 'First name is required';
        else if (firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters';
        if (!lastName.trim()) errors.lastName = 'Last name is required';
        else if (lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters';
        if (!phone || !phone.trim()) errors.phone = 'Phone number is required';
        else if (!/^\+?[\d\s\-()]{10,}$/.test(phone)) errors.phone = 'Phone must be at least 10 digits';
        if (!sex) errors.sex = 'Please select your gender';
        if (!avatarUrl) errors.avatar = 'Profile photo is required';
        if (!city.trim()) errors.city = 'City is required';
        if (zipCode.trim()) {
            const zipCountry = detectCountry(zipCode);
            if (zipCountry === 'OTHER') {
                errors.zipCode = 'Enter a valid US ZIP or Canadian postal code';
            } else if (country && country.toUpperCase() !== zipCountry) {
                const countryName = country.toUpperCase() === 'CA' ? 'Canada' : country.toUpperCase() === 'US' ? 'the US' : country;
                errors.zipCode = `Your city is in ${countryName} — postal code doesn't match`;
            }
        }
        if (isTrainer) {
            if (!headline.trim()) errors.headline = 'Headline is required';
            if (!bio?.trim()) errors.bio = 'Bio is required';
            else if (bio.trim().length < 50) errors.bio = 'Bio must be at least 50 characters';
            if (selectedSports.length === 0) errors.sports = 'Select at least one sport';
            const enabledKeys = ALLOWED_SESSION_DURATIONS.filter(
                (d) => sessionPricing[String(d) as `${AllowedDuration}`].enabled
            );
            if (enabledKeys.length === 0) {
                errors.sessionPricing = 'Enable at least one session length';
            } else {
                for (const d of enabledKeys) {
                    const key = String(d) as `${AllowedDuration}`;
                    const n = parseFloat(sessionPricing[key].price);
                    if (!Number.isFinite(n) || n <= 0) {
                        errors.sessionPricing = `Enter a valid price for ${d} min sessions`;
                        break;
                    }
                }
            }
        } else {
            if (selectedSports.length === 0) errors.sports = 'Select at least one sport';
            if (!skillLevel) errors.skillLevel = 'Please select your skill level';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    /* ── save ── */
    const handleSave = async () => {
        if (!user) return;
        setSaveError(null);
        setSaveSuccess(false);
        if (!validate()) {
            setSaveError('Please fix the highlighted fields.');
            return;
        }
        setIsSaving(true);
        try {
            const { error: userError } = await supabase
                .from('users')
                .update({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    phone: phone.trim() || null,
                    date_of_birth: dateOfBirth || null,
                    sex: sex || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);
            if (userError) throw userError;

            // Convert display radius back to miles for storage when user is in Canada
            const displayRadius = parseInt(travelRadius) || 25;
            const radiusMiles = isCanada(zipCode, country)
                ? Math.round(kmToMi(displayRadius))
                : displayRadius;

            if (isTrainer) {
                // Build session pricing payload: numeric prices, only includes all 3 durations.
                const sessionPricingPayload: Record<string, { price: number; enabled: boolean }> = {};
                const enabledLengths: number[] = [];
                for (const d of ALLOWED_SESSION_DURATIONS) {
                    const key = String(d) as `${AllowedDuration}`;
                    const entry = sessionPricing[key];
                    const priceNum = parseFloat(entry.price);
                    sessionPricingPayload[key] = {
                        price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : 0,
                        enabled: !!entry.enabled,
                    };
                    if (entry.enabled) enabledLengths.push(d);
                }
                // Always include at least one — fall back to [60] if none enabled.
                const sessionLengthsPayload = enabledLengths.length > 0 ? enabledLengths : [60];
                // Keep hourly_rate in sync with 60-min price for legacy consumers.
                const sixtyPrice = parseFloat(sessionPricing['60'].price);
                const hourlyRatePayload = Number.isFinite(sixtyPrice) && sixtyPrice > 0 ? sixtyPrice : 50;

                const { error: trainerError } = await supabase
                    .from('trainer_profiles')
                    .upsert({
                        user_id: user.id,
                        headline: headline.trim() || null,
                        bio: bio.trim() || null,
                        hourly_rate: hourlyRatePayload,
                        session_pricing: sessionPricingPayload,
                        session_lengths: sessionLengthsPayload,
                        years_experience: parseInt(yearsExp) || 0,
                        sports: selectedSports,
                        trainingTypes: selectedTrainingTypes,
                        preferredTrainingTimes: selectedTrainingTimes,
                        city: city.trim(),
                        state: stateVal.trim(),
                        travel_radius_miles: radiusMiles,
                        training_locations: trainingLocations,
                        banner_url: bannerUrl || null,
                    }, { onConflict: 'user_id' });
                if (trainerError) throw trainerError;
            }

            if (!isTrainer) {
                const { error: athleteError } = await supabase
                    .from('athlete_profiles')
                    .upsert({
                        user_id: user.id,
                        sports: selectedSports,
                        skill_level: skillLevel,
                        bio: bio.trim() || null,
                        address_line1: addressLine1.trim() || null,
                        city: city.trim() || null,
                        state: stateVal.trim() || null,
                        zip_code: zipCode.trim() || null,
                        travel_radius_miles: radiusMiles,
                        preferredTrainingTimes: selectedTrainingTimes,
                    }, { onConflict: 'user_id' });
                if (athleteError) throw athleteError;
            }

            await refreshUser();
            setSaveSuccess(true);
            setTimeout(() => navigation.goBack(), 1000);
        } catch (error: any) {
            console.error('[EditProfile] Save error:', error);
            setSaveError(error?.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    /* ══════════════════════════════════════ */
    /*  RENDER                                */
    /* ══════════════════════════════════════ */

    return (
        <ScreenWrapper>
            {/* ── Header Bar ── */}
            <Animated.View
                entering={FadeInDown.duration(250)}
                style={styles.headerBar}
            >
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </Pressable>

                <Text style={styles.headerTitle}>Edit Profile</Text>

                <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    style={({ pressed }) => [
                        styles.saveHeaderButton,
                        pressed && { opacity: 0.7 },
                    ]}
                    accessibilityLabel="Save profile"
                >
                    <Text style={styles.saveHeaderText}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Text>
                </Pressable>
            </Animated.View>

            {/* ── Avatar Section ── */}
            <Animated.View
                entering={FadeInDown.duration(250).delay(30)}
                style={styles.avatarSection}
            >
                <Pressable
                    style={styles.avatarWrapper}
                    onPress={handlePickAvatar}
                    disabled={avatarLoading}
                >
                    <Avatar
                        uri={avatarUrl || undefined}
                        name={fullName}
                        size={100}
                        borderColor={Colors.primary}
                    />
                    {/* Camera overlay */}
                    <View style={styles.cameraOverlay}>
                        <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                    {/* Loading overlay */}
                    {avatarLoading && (
                        <View style={styles.avatarLoadingOverlay}>
                            <ActivityIndicator color="#fff" size="small" />
                        </View>
                    )}
                </Pressable>
                {avatarPendingApproval && (
                    <View style={styles.pendingApprovalBadge}>
                        <Ionicons name="time-outline" size={12} color="#ffab00" />
                        <Text style={styles.pendingApprovalText}>Pending admin approval</Text>
                    </View>
                )}
                {fieldErrors.avatar && (
                    <Text style={[styles.fieldError, { textAlign: 'center', marginTop: 8 }]}>{fieldErrors.avatar} — Tap your photo to upload</Text>
                )}
            </Animated.View>

            {/* ── Personal Info Card ── */}
            <SectionCard title="Personal Info" delay={150}>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="First Name"
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First name"
                            error={fieldErrors.firstName}
                            icon="person-outline"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="Last Name"
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last name"
                            error={fieldErrors.lastName}
                        />
                    </View>
                </View>
                <Input
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 (555) 000-0000"
                    keyboardType="phone-pad"
                    error={fieldErrors.phone}
                    icon="call-outline"
                />
                <Input
                    label="Email"
                    value={user?.email || ''}
                    editable={false}
                    icon="mail-outline"
                    containerStyle={{ opacity: 0.6 }}
                />
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="Date of Birth"
                            value={dateOfBirth}
                            onChangeText={setDateOfBirth}
                            placeholder="YYYY-MM-DD"
                            icon="calendar-outline"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.chipLabel}>Sex *</Text>
                        <View style={styles.chipContainer}>
                            {SEX_OPTIONS.map((option) => (
                                <Chip
                                    key={option}
                                    label={option}
                                    active={sex === option}
                                    onPress={() => { setSex(sex === option ? '' : option); setFieldErrors((p) => { const n = { ...p }; delete n.sex; return n; }); }}
                                />
                            ))}
                        </View>
                        {fieldErrors.sex && <Text style={styles.fieldError}>{fieldErrors.sex}</Text>}
                    </View>
                </View>
            </SectionCard>

            {/* ── Location Card ── */}
            <SectionCard title="Location *" delay={250}>
                <View style={{ zIndex: 100 }}>
                    <LocationAutocomplete
                        value={{ city, state: stateVal, country, lat: null, lng: null }}
                        onChange={(loc: LocationValue) => {
                            setCity(loc.city);
                            setStateVal(loc.state);
                            setCountry(loc.country);
                            setFieldErrors((p) => { const n = { ...p }; delete n.city; return n; });
                            if (loc.lat && loc.lng && user) {
                                const table = isTrainer ? 'trainer_profiles' : 'athlete_profiles';
                                supabase.from(table).update({
                                    latitude: loc.lat,
                                    longitude: loc.lng,
                                    city: loc.city,
                                    state: loc.state,
                                    country: loc.country,
                                }).eq('user_id', user.id).then(() => {});
                            }
                        }}
                        placeholder="Search city or use GPS..."
                    />
                </View>
                {fieldErrors.city && <Text style={styles.fieldError}>{fieldErrors.city}</Text>}
                {!isTrainer && (
                    <>
                        <Input
                            label="Street Address"
                            value={addressLine1}
                            onChangeText={setAddressLine1}
                            placeholder="Street address"
                            icon="location-outline"
                        />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Input
                                    label="ZIP / Postal Code"
                                    value={zipCode}
                                    onChangeText={setZipCode}
                                    placeholder="12345 or A1A 1A1"
                                    autoCapitalize="characters"
                                    error={fieldErrors.zipCode}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Input
                                    label={`Travel Radius (${isCanada(zipCode, country) ? 'km' : 'mi'})`}
                                    value={travelRadius}
                                    onChangeText={setTravelRadius}
                                    placeholder="25"
                                    keyboardType="numeric"
                                    icon="navigate-outline"
                                />
                            </View>
                        </View>
                    </>
                )}
            </SectionCard>

            {/* ── Training Locations (trainer) ── */}
            {isTrainer && (
                <SectionCard title="Training Locations" delay={300}>
                    <View style={styles.tagInputRow}>
                        <View style={{ flex: 1 }}>
                            <Input
                                value={locationInput}
                                onChangeText={setLocationInput}
                                placeholder="e.g. Downtown Rink, City Gym"
                                onSubmitEditing={addTrainingLocation}
                                returnKeyType="done"
                                containerStyle={{ marginBottom: 0 }}
                            />
                        </View>
                        <Pressable style={styles.addTagButton} onPress={addTrainingLocation}>
                            <Ionicons name="add" size={20} color="#fff" />
                        </Pressable>
                    </View>
                    {trainingLocations.length > 0 && (
                        <View style={[styles.chipContainer, { marginTop: Spacing.md }]}>
                            {trainingLocations.map((loc) => (
                                <View key={loc} style={styles.tagChip}>
                                    <Text style={styles.tagChipText}>{loc}</Text>
                                    <Pressable style={styles.removeTagButton} onPress={() => removeTrainingLocation(loc)}>
                                        <Ionicons name="close" size={14} color={Colors.textSecondary} />
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}
                </SectionCard>
            )}

            {/* ── Professional Info (trainer) ── */}
            {/* ── Cover Banner (trainer) ── */}
            {isTrainer && (
                <SectionCard title="Cover Banner" delay={325}>
                    <Text style={styles.bannerHelp}>
                        A wide image shown at the top of your public profile. If you skip this, a default sport image is used.
                    </Text>
                    <View style={styles.bannerPreviewWrap}>
                        {bannerUrl ? (
                            <View style={styles.bannerPreview}>
                                <Image
                                    source={{ uri: bannerUrl }}
                                    style={styles.bannerImage}
                                    resizeMode="cover"
                                />
                                {bannerLoading && (
                                    <View style={styles.bannerLoadingOverlay}>
                                        <ActivityIndicator color="#fff" size="small" />
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={[styles.bannerPreview, styles.bannerPlaceholder]}>
                                <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                                <Text style={styles.bannerPlaceholderText}>
                                    No banner — sport default will be used
                                </Text>
                                {bannerLoading && (
                                    <View style={styles.bannerLoadingOverlay}>
                                        <ActivityIndicator color="#fff" size="small" />
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                    <View style={styles.bannerActionsRow}>
                        <Button
                            title={bannerUrl ? 'Replace' : 'Upload'}
                            onPress={handlePickBanner}
                            disabled={bannerLoading}
                            variant="primary"
                            size="sm"
                            icon="cloud-upload-outline"
                            style={{ flex: 1 }}
                        />
                        {bannerUrl ? (
                            <Button
                                title="Remove"
                                onPress={handleRemoveBanner}
                                disabled={bannerLoading}
                                variant="secondary"
                                size="sm"
                                icon="trash-outline"
                                style={{ flex: 1 }}
                            />
                        ) : null}
                    </View>
                </SectionCard>
            )}

            {isTrainer && (
                <SectionCard title="Professional Info" delay={350}>
                    <Input
                        label="Headline"
                        value={headline}
                        onChangeText={setHeadline}
                        placeholder="e.g. Elite Hockey Coach | 15+ Years"
                        maxLength={200}
                        error={fieldErrors.headline}
                    />
                    <Input
                        label="Bio *"
                        value={bio}
                        onChangeText={(t) => { setBio(t); setFieldErrors((p) => { const n = { ...p }; delete n.bio; return n; }); }}
                        placeholder="Tell athletes about your coaching style (min 50 chars)..."
                        multiline
                        numberOfLines={5}
                        maxLength={1000}
                        style={{ minHeight: 120, textAlignVertical: 'top' }}
                        error={fieldErrors.bio}
                    />
                    <Text style={styles.charCount}>{bio.length}/1000</Text>
                    <Input
                        label="Years Experience"
                        value={yearsExp}
                        onChangeText={setYearsExp}
                        placeholder="0"
                        keyboardType="numeric"
                        icon="time-outline"
                    />
                </SectionCard>
            )}

            {/* ── Session Pricing (trainer) ── */}
            {isTrainer && (
                <SectionCard title="Session Pricing" delay={375}>
                    <Text style={styles.pricingHelp}>
                        Enable the session lengths you offer and set a price for each.
                    </Text>
                    {ALLOWED_SESSION_DURATIONS.map((d) => {
                        const key = String(d) as `${AllowedDuration}`;
                        const entry = sessionPricing[key];
                        const enabled = entry.enabled;
                        return (
                            <View key={d} style={[styles.pricingRow, !enabled && styles.pricingRowDisabled]}>
                                <View style={styles.pricingHeader}>
                                    <Text style={[styles.pricingDuration, !enabled && styles.pricingDurationDisabled]}>
                                        {d} min
                                    </Text>
                                    <Switch
                                        value={enabled}
                                        onValueChange={() => toggleDurationEnabled(d)}
                                        trackColor={{ false: Colors.border, true: Colors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>
                                <View style={[styles.priceInputWrap, !enabled && styles.priceInputWrapDisabled]}>
                                    <Text style={[styles.priceSymbol, !enabled && styles.priceSymbolDisabled]}>
                                        {PLATFORM_CURRENCY_SYMBOL}
                                    </Text>
                                    <TextInput
                                        style={[styles.priceInput, !enabled && styles.priceInputDisabled]}
                                        value={entry.price}
                                        onChangeText={(t) => setDurationPrice(d, t)}
                                        placeholder="0"
                                        placeholderTextColor={Colors.textTertiary}
                                        keyboardType="decimal-pad"
                                        editable={enabled}
                                    />
                                    <Text style={[styles.priceSuffix, !enabled && styles.priceSymbolDisabled]}>
                                        / session
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                    {fieldErrors.sessionPricing && (
                        <Text style={styles.fieldError}>{fieldErrors.sessionPricing}</Text>
                    )}
                </SectionCard>
            )}

            {/* ── Sports & Training Card ── */}
            <SectionCard title="Sports & Training" delay={400}>
                {fieldErrors.sports && (
                    <Text style={styles.fieldError}>{fieldErrors.sports}</Text>
                )}
                <Text style={styles.chipLabel}>
                    {isTrainer ? 'Sports You Coach' : 'Your Sports'}
                </Text>
                <View style={styles.chipContainer}>
                    {sportsList.map((sport) => (
                        <Chip
                            key={sport}
                            label={sport}
                            active={selectedSports.includes(sport)}
                            onPress={() => toggleSport(sport)}
                        />
                    ))}
                </View>

                {isTrainer && (
                    <>
                        <Divider />
                        <Text style={[styles.chipLabel, { marginTop: Spacing.md }]}>Training Types</Text>
                        <View style={styles.chipContainer}>
                            {TRAINING_TYPES.map((tt) => (
                                <Chip
                                    key={tt.key}
                                    label={tt.label}
                                    active={selectedTrainingTypes.includes(tt.key)}
                                    onPress={() => toggleTrainingType(tt.key)}
                                />
                            ))}
                        </View>
                    </>
                )}

                {!isTrainer && (
                    <>
                        <Divider />
                        <Text style={[styles.chipLabel, { marginTop: Spacing.md }]}>Skill Level *</Text>
                        <SegmentedControl
                            options={SKILL_LEVELS}
                            selected={skillLevel}
                            onChange={(v) => { setSkillLevel(v as typeof SKILL_LEVELS[number]); setFieldErrors((p) => { const n = { ...p }; delete n.skillLevel; return n; }); }}
                        />
                        {fieldErrors.skillLevel && <Text style={styles.fieldError}>{fieldErrors.skillLevel}</Text>}
                    </>
                )}
            </SectionCard>

            {/* ── Preferences Card ── */}
            <SectionCard title="Preferences" delay={500}>
                <Text style={styles.chipLabel}>
                    Preferred Times
                </Text>
                <View style={styles.chipContainer}>
                    {TRAINING_TIMES.map((time) => (
                        <Chip
                            key={time}
                            label={time}
                            active={selectedTrainingTimes.includes(time)}
                            onPress={() => toggleTrainingTime(time)}
                        />
                    ))}
                </View>

                {isTrainer && (
                    <>
                        <Divider />
                        <Input
                            label={`Travel Radius (${isCanada(zipCode, country) ? 'km' : 'mi'})`}
                            value={travelRadius}
                            onChangeText={setTravelRadius}
                            placeholder="25"
                            keyboardType="numeric"
                            icon="navigate-outline"
                            containerStyle={{ marginTop: Spacing.md }}
                        />
                    </>
                )}
            </SectionCard>

            {/* ── Status Messages ── */}
            {saveError && (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.statusBox}>
                    <Ionicons name="alert-circle" size={18} color={Colors.error} />
                    <Text style={[styles.statusText, { color: Colors.error }]}>{saveError}</Text>
                </Animated.View>
            )}
            {saveSuccess && (
                <Animated.View
                    entering={FadeInDown.duration(250)}
                    style={[styles.statusBox, styles.statusBoxSuccess]}
                >
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={[styles.statusText, { color: Colors.success }]}>Profile saved successfully!</Text>
                </Animated.View>
            )}

            {/* ── Save Button (bottom) ── */}
            <Animated.View
                entering={FadeInDown.duration(250).delay(60)}
                style={styles.saveButtonSection}
            >
                <Button
                    title="Save Changes"
                    onPress={handleSave}
                    loading={isSaving}
                    disabled={!firstName.trim() || isSaving}
                    size="lg"
                    icon="checkmark-outline"
                />
            </Animated.View>
        </ScreenWrapper>
    );
}

/* ══════════════════════════════════════════════ */
/*  STYLES                                        */
/* ══════════════════════════════════════════════ */

const styles = StyleSheet.create({
    /* Header bar */
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xl,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    saveHeaderButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    saveHeaderText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },

    /* Avatar */
    avatarSection: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    avatarWrapper: {
        position: 'relative',
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.background,
        ...Shadows.small,
    },
    avatarLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingApprovalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,171,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,171,0,0.35)',
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        marginTop: Spacing.sm,
    },
    pendingApprovalText: {
        fontSize: FontSize.xs,
        color: '#ffab00',
        fontWeight: FontWeight.medium,
    },

    /* Section cards */
    sectionTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
        marginLeft: Spacing.xs,
    },
    sectionCard: {
        marginBottom: Spacing.xxl,
    },

    /* Banner */
    bannerHelp: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
    },
    bannerPreviewWrap: {
        marginBottom: Spacing.md,
    },
    bannerPreview: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    bannerPlaceholderText: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    bannerLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bannerActionsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },

    /* Rows */
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },

    /* Chips */
    chipLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textMuted,
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: FontWeight.semibold,
    },

    /* Segmented control */
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        position: 'relative',
        height: 44,
        marginBottom: Spacing.lg,
    },
    segmentedIndicator: {
        position: 'absolute',
        top: 2,
        bottom: 2,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primary,
    },
    segmentedOption: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    segmentedText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    segmentedTextActive: {
        color: '#fff',
        fontWeight: FontWeight.bold,
    },

    /* Tag input / location chips */
    tagInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
    },
    addTagButton: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tagChipText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    removeTagButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* Misc */
    charCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'right',
        marginTop: -Spacing.md,
        marginBottom: Spacing.md,
    },
    fieldError: {
        fontSize: FontSize.xs,
        color: Colors.error,
        marginBottom: Spacing.sm,
    },

    /* Status messages */
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: 'rgba(255,23,68,0.3)',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginTop: Spacing.md,
    },
    statusBoxSuccess: {
        backgroundColor: Colors.successLight,
        borderColor: 'rgba(0,200,83,0.3)',
    },
    statusText: {
        flex: 1,
        fontSize: FontSize.sm,
    },

    /* Save button */
    saveButtonSection: {
        marginTop: Spacing.xxl,
        marginBottom: Spacing.xxxl,
        ...Shadows.glow,
        borderRadius: BorderRadius.md,
    },

    /* Session pricing */
    pricingHelp: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
    },
    pricingRow: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    pricingRowDisabled: {
        opacity: 0.55,
    },
    pricingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    pricingDuration: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    pricingDurationDisabled: {
        color: Colors.textSecondary,
    },
    priceInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.md,
        height: 44,
    },
    priceInputWrapDisabled: {
        backgroundColor: Colors.glass,
    },
    priceSymbol: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginRight: Spacing.xs,
    },
    priceSymbolDisabled: {
        color: Colors.textTertiary,
    },
    priceInput: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
        paddingVertical: 0,
    },
    priceInputDisabled: {
        color: Colors.textTertiary,
    },
    priceSuffix: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginLeft: Spacing.xs,
    },
});
