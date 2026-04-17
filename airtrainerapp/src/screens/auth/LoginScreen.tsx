import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Divider from '../../components/ui/Divider';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LoginScreen({ navigation }: any) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        <ScreenWrapper contentStyle={styles.content}>
            {/* ── Top Branding Area ── */}
            <Animated.View
                entering={FadeIn.duration(250).delay(30)}
                style={styles.brandArea}
            >
                <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.logoCircle}
                >
                    <Ionicons name="fitness" size={40} color={Colors.text} />
                </LinearGradient>

                <Text style={styles.brandName}>AIRTRAINR</Text>
                <Text style={styles.brandTagline}>TRAIN . CONNECT . DOMINATE</Text>
            </Animated.View>

            {/* ── Form Area ── */}
            <Animated.View
                entering={FadeInDown.duration(250).delay(30)}
                style={styles.formArea}
            >
                <Text style={styles.welcomeHeading}>Welcome Back</Text>
                <Text style={styles.welcomeSubtitle}>Sign in to continue</Text>

                <View style={styles.fieldsWrapper}>
                    <Input
                        label="Email"
                        icon="mail-outline"
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            setErrors((e) => ({ ...e, email: undefined }));
                        }}
                        error={errors.email}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Input
                        label="Password"
                        icon="lock-closed-outline"
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={(t) => {
                            setPassword(t);
                            setErrors((e) => ({ ...e, password: undefined }));
                        }}
                        error={errors.password}
                        isPassword
                    />

                    {/* Forgot Password */}
                    <Pressable
                        style={styles.forgotRow}
                        onPress={() => navigation.navigate('ForgotPassword')}
                        accessibilityLabel="Forgot password"
                    >
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </Pressable>

                    {/* Login Error */}
                    {loginError && (
                        <Animated.View
                            entering={FadeInDown.duration(250)}
                            style={styles.errorBox}
                        >
                            <Ionicons name="alert-circle" size={18} color={Colors.error} />
                            <Text style={styles.errorText}>{loginError}</Text>
                        </Animated.View>
                    )}

                    {/* Sign In Button */}
                    <View style={styles.signInButtonWrapper}>
                        <Button
                            title="Sign In"
                            onPress={handleLogin}
                            loading={isLoading}
                            disabled={isLoading}
                            size="lg"
                        />
                    </View>

                    <Divider text="or" />

                    {/* Social Buttons */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.socialButton,
                            pressed && styles.socialButtonPressed,
                        ]}
                        onPress={() =>
                            Alert.alert('Coming Soon', 'Google sign-in will be available soon.')
                        }
                        accessibilityLabel="Continue with Google"
                    >
                        <Ionicons name="logo-google" size={20} color={Colors.primary} />
                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </Pressable>

                </View>
            </Animated.View>

            {/* ── Footer ── */}
            <Animated.View
                entering={FadeInUp.duration(250).delay(60)}
                style={styles.footer}
            >
                <Text style={styles.footerLabel}>Don't have an account?</Text>
                <Pressable
                    onPress={() => navigation.navigate('Register')}
                    accessibilityLabel="Sign up"
                >
                    <Text style={styles.footerLink}> Sign Up</Text>
                </Pressable>
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.xxl,
    },

    /* ── Brand / Top Area ── */
    brandArea: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: SCREEN_HEIGHT * 0.3,
        paddingTop: Spacing.huge,
        paddingBottom: Spacing.xl,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        ...Shadows.glow,
    },
    brandName: {
        fontSize: 32,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
        letterSpacing: 6,
        marginBottom: Spacing.xs,
    },
    brandTagline: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.semibold,
        color: Colors.textMuted,
        letterSpacing: 3,
        textTransform: 'uppercase',
    },

    /* ── Form Area ── */
    formArea: {
        flex: 1,
    },
    welcomeHeading: {
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    welcomeSubtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.xxl,
    },
    fieldsWrapper: {
        gap: Spacing.xs,
    },

    /* Forgot */
    forgotRow: {
        alignSelf: 'flex-end',
        marginBottom: Spacing.sm,
    },
    forgotText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },

    /* Error */
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.errorMuted,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    errorText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.error,
    },

    /* Sign-In button wrapper (glow shadow) */
    signInButtonWrapper: {
        ...Shadows.glow,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },

    /* Social buttons */
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.borderLight,
        backgroundColor: 'transparent',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    socialButtonPressed: {
        backgroundColor: Colors.glass,
        borderColor: Colors.primary,
    },
    socialButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },

    /* ── Footer ── */
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.huge,
        paddingBottom: Spacing.lg,
    },
    footerLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    footerLink: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
