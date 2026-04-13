import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

const SPORTS = [
    { name: 'Hockey', emoji: '🏒' }, { name: 'Baseball', emoji: '⚾' },
    { name: 'Basketball', emoji: '🏀' }, { name: 'Soccer', emoji: '⚽' },
    { name: 'Football', emoji: '🏈' }, { name: 'Tennis', emoji: '🎾' },
    { name: 'Golf', emoji: '⛳' }, { name: 'Swimming', emoji: '🏊' },
    { name: 'Boxing', emoji: '🥊' }, { name: 'Lacrosse', emoji: '🥍' },
    { name: 'General Fitness', emoji: '💪' }, { name: 'Personal Training', emoji: '🏋️' },
];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

export default function RegisterScreen({ navigation }: any) {
    const { register } = useAuth();
    const insets = useSafeAreaInsets();
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
    const [skillLevel, setSkillLevel] = useState('beginner');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');

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

    const handleNext = () => {
        if (step === 1 && validateStep1()) setStep(2);
        else if (step === 2 && validateStep2()) setStep(3);
    };

    const handleRegister = async () => {
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
                skillLevel: skillLevel.toLowerCase(),
                city: city || undefined,
                state: state || undefined,
            });
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Back Button */}
                    {step > 1 ? (
                        <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
                            <Ionicons name="arrow-back" size={24} color={Colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={Colors.text} />
                        </TouchableOpacity>
                    )}

                    {/* Progress Indicator */}
                    <View style={styles.progressContainer}>
                        {[1, 2, 3].map((s) => (
                            <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]}>
                                {s < step ? (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                ) : (
                                    <Text style={[styles.progressDotText, s <= step && styles.progressDotTextActive]}>{s}</Text>
                                )}
                            </View>
                        ))}
                        <View style={styles.progressLine}>
                            <View style={[styles.progressLineFill, { width: `${((step - 1) / 2) * 100}%` }]} />
                        </View>
                    </View>

                    {/* Header */}
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

                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <View style={styles.form}>
                            {/* Role Selection */}
                            <View style={styles.roleContainer}>
                                <TouchableOpacity
                                    style={[styles.roleButton, role === 'athlete' && styles.roleButtonActive]}
                                    onPress={() => setRole('athlete')}
                                >
                                    <Ionicons name="person" size={22} color={role === 'athlete' ? '#fff' : Colors.textSecondary} />
                                    <Text style={[styles.roleText, role === 'athlete' && styles.roleTextActive]}>Athlete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleButton, role === 'trainer' && styles.roleButtonActive]}
                                    onPress={() => setRole('trainer')}
                                >
                                    <Ionicons name="barbell" size={22} color={role === 'trainer' ? '#fff' : Colors.textSecondary} />
                                    <Text style={[styles.roleText, role === 'trainer' && styles.roleTextActive]}>Trainer</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Name Fields */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>First Name</Text>
                                    <View style={[styles.inputContainer, errors.firstName ? styles.inputError : null]}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="John"
                                            placeholderTextColor={Colors.textTertiary}
                                            value={firstName}
                                            onChangeText={(t) => { setFirstName(t); setErrors((e) => ({ ...e, firstName: '' })); }}
                                        />
                                    </View>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>Last Name</Text>
                                    <View style={[styles.inputContainer, errors.lastName ? styles.inputError : null]}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Doe"
                                            placeholderTextColor={Colors.textTertiary}
                                            value={lastName}
                                            onChangeText={(t) => { setLastName(t); setErrors((e) => ({ ...e, lastName: '' })); }}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Email */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
                                    <Ionicons name="mail-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="email@example.com"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={email}
                                        onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                            </View>

                            {/* Password */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                                    <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Min 8 characters"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={password}
                                        onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                                        secureTextEntry
                                    />
                                </View>
                                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                            </View>

                            {/* Confirm Password */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Confirm Password</Text>
                                <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                                    <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Repeat password"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={confirmPassword}
                                        onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                                        secureTextEntry
                                    />
                                </View>
                                {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                            </View>

                            {/* Date of Birth */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Date of Birth</Text>
                                <View style={[styles.inputContainer, errors.dateOfBirth ? styles.inputError : null]}>
                                    <Ionicons name="calendar-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={dateOfBirth}
                                        onChangeText={(t) => { setDateOfBirth(t); setErrors((e) => ({ ...e, dateOfBirth: '' })); }}
                                    />
                                </View>
                                {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
                                <Text style={styles.hintText}>Must be 18+ to register</Text>
                            </View>
                        </View>
                    )}

                    {/* Step 2: Sports Selection */}
                    {step === 2 && (
                        <View style={styles.sportsGrid}>
                            {SPORTS.map((sport) => (
                                <TouchableOpacity
                                    key={sport.name}
                                    style={[
                                        styles.sportCard,
                                        selectedSports.includes(sport.name) && styles.sportCardActive,
                                    ]}
                                    onPress={() => toggleSport(sport.name)}
                                >
                                    <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                                    <Text style={[styles.sportName, selectedSports.includes(sport.name) && styles.sportNameActive]}>
                                        {sport.name}
                                    </Text>
                                    {selectedSports.includes(sport.name) && (
                                        <View style={styles.sportCheck}>
                                            <Ionicons name="checkmark" size={14} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Step 3: Profile Details */}
                    {step === 3 && (
                        <View style={styles.form}>
                            {role === 'athlete' && (
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Skill Level</Text>
                                        <View style={styles.skillContainer}>
                                            {SKILL_LEVELS.map((level) => (
                                                <TouchableOpacity
                                                    key={level}
                                                    style={[styles.skillButton, skillLevel.toLowerCase() === level.toLowerCase() && styles.skillButtonActive]}
                                                    onPress={() => setSkillLevel(level)}
                                                >
                                                    <Text style={[styles.skillText, skillLevel.toLowerCase() === level.toLowerCase() && styles.skillTextActive]}>
                                                        {level}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>City</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="location-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Your city"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={city}
                                        onChangeText={setCity}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>State/Province</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="map-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="State or Province"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={state}
                                        onChangeText={setState}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Action Button */}
                    <TouchableOpacity
                        onPress={step < 3 ? handleNext : handleRegister}
                        disabled={isLoading}
                        activeOpacity={0.8}
                        style={{ marginTop: Spacing.xxl }}
                    >
                        <LinearGradient
                            colors={['#45D0FF', '#0090d4']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.actionButton, isLoading && { opacity: 0.7 }]}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#0A0D14" size="small" />
                            ) : (
                                <Text style={styles.actionButtonText}>
                                    {step < 3 ? 'Continue' : 'Create Account'}
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Footer */}
                    {step === 1 && (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.footerLink}> Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingBottom: 40 },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#161B22', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxxl, gap: 40, position: 'relative' },
    progressLine: { position: 'absolute', left: '20%', right: '20%', height: 2, backgroundColor: Colors.border, zIndex: -1 },
    progressLineFill: { height: 2, backgroundColor: Colors.primary },
    progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    progressDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    progressDotText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.bold },
    progressDotTextActive: { color: '#fff' },
    title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
    subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
    form: { gap: Spacing.lg },
    roleContainer: { flexDirection: 'row', gap: Spacing.md },
    roleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#161B22', gap: Spacing.sm },
    roleButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    roleText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
    roleTextActive: { color: '#fff' },
    row: { flexDirection: 'row', gap: Spacing.md },
    inputGroup: { gap: Spacing.sm },
    label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.lg, height: 48 },
    inputError: { borderColor: Colors.error },
    inputIcon: { marginRight: Spacing.md },
    input: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    errorText: { fontSize: FontSize.xs, color: Colors.error },
    hintText: { fontSize: FontSize.xs, color: Colors.textTertiary },
    sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    sportCard: { width: '47%', padding: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: '#161B22', borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', gap: Spacing.sm, position: 'relative' },
    sportCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    sportEmoji: { fontSize: 32 },
    sportName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
    sportNameActive: { color: '#fff' },
    sportCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    skillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    skillButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#161B22' },
    skillButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
    skillText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    skillTextActive: { color: '#fff' },
    actionButton: { height: 52, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', ...Shadows.glow },
    actionButtonText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#0A0D14' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30 },
    footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
    footerLink: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
});
