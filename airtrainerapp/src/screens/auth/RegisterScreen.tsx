import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import LocationAutocomplete, { LocationValue } from '../../components/LocationAutocomplete';

const SPORTS = [
    { name: 'Hockey', emoji: '🏒' }, { name: 'Baseball', emoji: '⚾' },
    { name: 'Basketball', emoji: '🏀' }, { name: 'Soccer', emoji: '⚽' },
    { name: 'Football', emoji: '🏈' }, { name: 'Tennis', emoji: '🎾' },
    { name: 'Golf', emoji: '⛳' }, { name: 'Swimming', emoji: '🏊' },
    { name: 'Boxing', emoji: '🥊' }, { name: 'Lacrosse', emoji: '🥍' },
    { name: 'General Fitness', emoji: '💪' }, { name: 'Personal Training', emoji: '🏋️' },
];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

const ROLE_OPTIONS = [
    {
        key: 'athlete' as const,
        icon: 'person' as const,
        title: 'Athlete',
        description: 'Find and book trainers near you',
    },
    {
        key: 'trainer' as const,
        icon: 'barbell' as const,
        title: 'Trainer',
        description: 'Offer sessions and grow your business',
    },
];

export default function RegisterScreen({ navigation }: any) {
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form data
    const [role, setRole] = useState<'athlete' | 'trainer'>('athlete');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [selectedSports, setSelectedSports] = useState<string[]>([]);
    const [skillLevel, setSkillLevel] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);

    const handleLocationChange = (loc: LocationValue) => {
        setCity(loc.city);
        setState(loc.state);
        setCountry(loc.country);
        setLat(loc.lat);
        setLng(loc.lng);
    };

    const [errors, setErrors] = useState<Record<string, string>>({});

    const toggleSport = (sport: string) => {
        setSelectedSports((prev) =>
            prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
        );
    };

    const validateStep1 = () => {
        const newErrors: Record<string, string> = {};
        if (!firstName.trim()) newErrors.firstName = 'Required';
        if (!lastName.trim()) newErrors.lastName = 'Required';
        if (!email.trim()) newErrors.email = 'Required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email';
        if (!password) newErrors.password = 'Required';
        else if (password.length < 8) newErrors.password = 'Minimum 8 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords don\'t match';
        if (!dateOfBirth.trim()) newErrors.dateOfBirth = 'Required';
        else {
            const dob = new Date(dateOfBirth);
            if (isNaN(dob.getTime())) newErrors.dateOfBirth = 'Invalid date (YYYY-MM-DD)';
            else {
                const today = new Date();
                const eighteenAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                if (dob > eighteenAgo) newErrors.dateOfBirth = 'You must be 18 or older';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        if (selectedSports.length === 0) {
            Alert.alert('Select Sports', 'Please select at least one sport');
            return false;
        }
        return true;
    };

    const validateStep3 = () => {
        if (role === 'athlete' && !skillLevel) {
            Alert.alert('Skill Level Required', 'Please select your skill level');
            return false;
        }
        if (!city.trim()) {
            Alert.alert('Location Required', 'Please select your city');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) setStep(2);
        else if (step === 2 && validateStep2()) setStep(3);
    };

    const handleRegister = async () => {
        if (!validateStep3()) return;
        setIsLoading(true);
        try {
            await register({
                email,
                password,
                firstName,
                lastName,
                role,
                dateOfBirth,
                sports: selectedSports,
                skillLevel: skillLevel ? skillLevel.toLowerCase() : 'beginner',
                city: city || undefined,
                state: state || undefined,
            });
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const STEP_LABELS = ['Account', 'Sports', 'Details'];

    return (
        <ScreenWrapper contentStyle={styles.content}>
            {/* Back Button */}
            <Pressable
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
                accessibilityLabel="Go back"
            >
                <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </Pressable>

            {/* Modern Step Indicator with dots + line connector */}
            <Animated.View entering={FadeInDown.duration(250)} style={styles.stepIndicator}>
                <View style={styles.stepsRow}>
                    {[1, 2, 3].map((s, index) => (
                        <React.Fragment key={s}>
                            {index > 0 && (
                                <View style={styles.stepLineWrapper}>
                                    <View style={[styles.stepLine, s <= step && styles.stepLineActive]} />
                                </View>
                            )}
                            <View style={styles.stepItem}>
                                <View style={[
                                    styles.stepDot,
                                    s < step && styles.stepDotCompleted,
                                    s === step && styles.stepDotCurrent,
                                ]}>
                                    {s < step ? (
                                        <Ionicons name="checkmark" size={14} color={Colors.text} />
                                    ) : (
                                        <Text style={[
                                            styles.stepDotText,
                                            s === step && styles.stepDotTextCurrent,
                                        ]}>{s}</Text>
                                    )}
                                </View>
                                <Text style={[
                                    styles.stepLabel,
                                    s <= step && styles.stepLabelActive,
                                ]}>{STEP_LABELS[s - 1]}</Text>
                            </View>
                        </React.Fragment>
                    ))}
                </View>
            </Animated.View>

            {/* Header */}
            <Animated.View entering={FadeInDown.duration(250).delay(30)}>
                <Text style={styles.title}>
                    {step === 1 ? 'Create Account' : step === 2 ? 'Choose Sports' : 'Your Details'}
                </Text>
                <Text style={styles.subtitle}>
                    {step === 1
                        ? 'Join the #1 sports training marketplace'
                        : step === 2
                            ? 'Select your sports to get matched'
                            : 'Help us personalize your experience'}
                </Text>
            </Animated.View>

            {/* Step 1: Basic Info */}
            {step === 1 && (
                <View style={styles.form}>
                    {/* Role Selection - Large Cards */}
                    <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.roleContainer}>
                        {ROLE_OPTIONS.map((r) => (
                            <Pressable
                                key={r.key}
                                style={({ pressed }) => [
                                    styles.roleCard,
                                    role === r.key && styles.roleCardActive,
                                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                ]}
                                onPress={() => setRole(r.key)}
                                accessibilityLabel={`Select ${r.title} role`}
                                accessibilityState={{ selected: role === r.key }}
                            >
                                <View style={[styles.roleIconWrap, role === r.key && styles.roleIconWrapActive]}>
                                    <Ionicons
                                        name={r.icon}
                                        size={28}
                                        color={role === r.key ? Colors.text : Colors.textSecondary}
                                    />
                                </View>
                                <Text style={[styles.roleTitle, role === r.key && styles.roleTitleActive]}>
                                    {r.title}
                                </Text>
                                <Text style={[styles.roleDescription, role === r.key && styles.roleDescriptionActive]}>
                                    {r.description}
                                </Text>
                                {role === r.key && (
                                    <View style={styles.roleCheckmark}>
                                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </Animated.View>

                    {/* Name Fields */}
                    <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Input
                                label="First Name"
                                placeholder="John"
                                value={firstName}
                                onChangeText={(t) => { setFirstName(t); setErrors((e) => ({ ...e, firstName: '' })); }}
                                error={errors.firstName}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Input
                                label="Last Name"
                                placeholder="Doe"
                                value={lastName}
                                onChangeText={(t) => { setLastName(t); setErrors((e) => ({ ...e, lastName: '' })); }}
                                error={errors.lastName}
                            />
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.duration(250).delay(120)}>
                        <Input
                            label="Email"
                            icon="mail-outline"
                            placeholder="email@example.com"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
                            error={errors.email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.duration(250).delay(50)}>
                        <Input
                            label="Password"
                            icon="lock-closed-outline"
                            placeholder="Min 8 characters"
                            value={password}
                            onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                            error={errors.password}
                            isPassword
                        />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.duration(250).delay(60)}>
                        <Input
                            label="Confirm Password"
                            icon="lock-closed-outline"
                            placeholder="Repeat password"
                            value={confirmPassword}
                            onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                            error={errors.confirmPassword}
                            isPassword
                        />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.duration(250).delay(60)}>
                        <Input
                            label="Date of Birth"
                            icon="calendar-outline"
                            placeholder="YYYY-MM-DD"
                            value={dateOfBirth}
                            onChangeText={(t) => { setDateOfBirth(t); setErrors((e) => ({ ...e, dateOfBirth: '' })); }}
                            error={errors.dateOfBirth}
                        />
                        <Text style={styles.hintText}>Must be 18+ to register</Text>
                    </Animated.View>
                </View>
            )}

            {/* Step 2: Sports Selection - Larger Grid Cards */}
            {step === 2 && (
                <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.sportsGrid}>
                    {SPORTS.map((sport, index) => {
                        const isSelected = selectedSports.includes(sport.name);
                        return (
                            <Animated.View
                                key={sport.name}
                                entering={FadeInDown.duration(200).delay(30 + index * 25)}
                            >
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.sportCard,
                                        isSelected && styles.sportCardActive,
                                        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                    ]}
                                    onPress={() => toggleSport(sport.name)}
                                    accessibilityLabel={`${sport.name}${isSelected ? ', selected' : ''}`}
                                    accessibilityState={{ selected: isSelected }}
                                >
                                    <View style={[styles.sportIconBg, isSelected && styles.sportIconBgActive]}>
                                        <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                                    </View>
                                    <Text style={[styles.sportName, isSelected && styles.sportNameActive]}>
                                        {sport.name}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.sportCheck}>
                                            <Ionicons name="checkmark" size={14} color={Colors.text} />
                                        </View>
                                    )}
                                </Pressable>
                            </Animated.View>
                        );
                    })}
                </Animated.View>
            )}

            {/* Step 3: Profile Details */}
            {step === 3 && (
                <View style={styles.form}>
                    {role === 'athlete' && (
                        <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.inputGroup}>
                            <Text style={styles.label}>Skill Level</Text>
                            <View style={styles.skillContainer}>
                                {SKILL_LEVELS.map((level) => {
                                    const isActive = skillLevel.toLowerCase() === level.toLowerCase();
                                    return (
                                        <Pressable
                                            key={level}
                                            style={({ pressed }) => [
                                                styles.skillButton,
                                                isActive && styles.skillButtonActive,
                                                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                            ]}
                                            onPress={() => setSkillLevel(level)}
                                            accessibilityLabel={`Skill level: ${level}`}
                                            accessibilityState={{ selected: isActive }}
                                        >
                                            <Text style={[styles.skillText, isActive && styles.skillTextActive]}>
                                                {level}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInDown.duration(250).delay(30)} style={{ zIndex: 100 }}>
                        <Text style={styles.label}>Location</Text>
                        <LocationAutocomplete
                            value={{ city, state, country, lat, lng }}
                            onChange={handleLocationChange}
                            placeholder="Search your city..."
                        />
                    </Animated.View>
                </View>
            )}

            {/* Action Button */}
            <Animated.View entering={FadeInDown.duration(250).delay(250)} style={styles.actionArea}>
                <Button
                    title={step < 3 ? 'Continue' : 'Create Account'}
                    onPress={step < 3 ? handleNext : handleRegister}
                    loading={isLoading}
                    disabled={isLoading}
                    size="lg"
                />
            </Animated.View>

            {/* Footer */}
            {step === 1 && (
                <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account?</Text>
                    <Pressable
                        onPress={() => navigation.navigate('Login')}
                        accessibilityLabel="Sign in"
                        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                    >
                        <Text style={styles.footerLink}> Sign In</Text>
                    </Pressable>
                </Animated.View>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.xxl,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },

    // Step indicator - modern dots + line connector
    stepIndicator: {
        marginBottom: Spacing.xxxl,
    },
    stepsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    stepItem: {
        alignItems: 'center',
        gap: Spacing.xs,
    },
    stepLineWrapper: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 4,
        paddingHorizontal: Spacing.xs,
    },
    stepLine: {
        height: 2,
        backgroundColor: Colors.border,
        borderRadius: 1,
        marginTop: 12,
    },
    stepLineActive: {
        backgroundColor: Colors.primary,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotCurrent: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    stepDotCompleted: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    stepDotText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.bold,
    },
    stepDotTextCurrent: {
        color: Colors.text,
    },
    stepLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
    },
    stepLabelActive: {
        color: Colors.text,
        fontWeight: FontWeight.semibold,
    },

    title: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.xxxl,
    },
    form: {
        gap: Spacing.xs,
    },

    // Role selector - large cards with icon + title + description
    roleContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xxl,
    },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: Colors.border,
        backgroundColor: Colors.card,
        gap: Spacing.sm,
        position: 'relative',
    },
    roleCardActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryGlow,
    },
    roleIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    roleIconWrapActive: {
        backgroundColor: Colors.primaryMuted,
    },
    roleTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },
    roleTitleActive: {
        color: Colors.text,
    },
    roleDescription: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 16,
    },
    roleDescriptionActive: {
        color: Colors.textSecondary,
    },
    roleCheckmark: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
    },

    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    hintText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: -Spacing.sm,
    },

    // Sports grid - larger cards with icon background
    sportsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    sportCard: {
        width: '100%',
        minWidth: 150,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        alignItems: 'center',
        gap: Spacing.sm,
        position: 'relative',
    },
    sportCardActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryGlow,
    },
    sportIconBg: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sportIconBgActive: {
        backgroundColor: Colors.primaryMuted,
    },
    sportEmoji: {
        fontSize: 28,
    },
    sportName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    sportNameActive: {
        color: Colors.text,
    },
    sportCheck: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    skillButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.card,
        minHeight: 44,
        justifyContent: 'center',
    },
    skillButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryGlow,
    },
    skillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    skillTextActive: {
        color: Colors.text,
    },
    actionArea: {
        marginTop: Spacing.xxl,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.xxxl,
    },
    footerText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    footerLink: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
