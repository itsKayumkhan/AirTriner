import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function LoginScreen({ navigation }: any) {
    const { login } = useAuth();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [loginError, setLoginError] = useState<string | null>(null);

    const validate = () => {
        const newErrors: { email?: string; password?: string } = {};
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
        if (!password) newErrors.password = 'Password is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;
        setLoginError(null);
        setIsLoading(true);
        try {
            console.log('[Login] Attempting login for:', email.trim().toLowerCase());
            await login(email, password);
            console.log('[Login] Success');
        } catch (error: any) {
            console.error('[Login] Error:', error?.message, error);
            setLoginError(error?.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#45D0FF', '#0047AB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoContainer}
                        >
                            <Ionicons name="fitness" size={36} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.brandTitle}>AIRTRAINR</Text>
                        <Text style={styles.brandTagline}>TRAIN. CONNECT. DOMINATE.</Text>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue your training journey</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
                                <Ionicons name="mail-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={email}
                                    onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                                <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={password}
                                    onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity
                            style={styles.forgotContainer}
                            onPress={() => navigation.navigate('ForgotPassword')}
                        >
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Login Error */}
                        {loginError && (
                            <View style={styles.loginErrorBox}>
                                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                                <Text style={styles.loginErrorText}>{loginError}</Text>
                            </View>
                        )}

                        {/* Login Button */}
                        <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#45D0FF', '#0090d4']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={Colors.background} size="small" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Login */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available soon.')}
                        >
                            <Ionicons name="logo-google" size={20} color={Colors.text} />
                            <Text style={styles.socialButtonText}>Continue with Google</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => Alert.alert('Coming Soon', 'Apple sign-in will be available soon.')}
                        >
                            <Ionicons name="logo-apple" size={20} color={Colors.text} />
                            <Text style={styles.socialButtonText}>Continue with Apple</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.footerLink}> Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0D14',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.xxl,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        ...Shadows.glow,
    },
    brandTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.heavy,
        color: '#45D0FF',
        letterSpacing: 4,
        marginBottom: Spacing.xs,
    },
    brandTagline: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    form: {
        gap: Spacing.lg,
    },
    inputGroup: {
        gap: Spacing.sm,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161B22',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        height: 52,
    },
    inputError: {
        borderColor: Colors.error,
    },
    loginErrorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: 'rgba(255,23,68,0.3)',
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    loginErrorText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.error,
    },
    inputIcon: {
        marginRight: Spacing.md,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    eyeIcon: {
        padding: Spacing.xs,
    },
    errorText: {
        fontSize: FontSize.xs,
        color: Colors.error,
    },
    forgotContainer: {
        alignSelf: 'flex-end',
        marginTop: -Spacing.sm,
    },
    forgotText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
    loginButton: {
        height: 52,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.glow,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#0A0D14',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginHorizontal: Spacing.lg,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: 'transparent',
        gap: Spacing.md,
    },
    socialButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
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
