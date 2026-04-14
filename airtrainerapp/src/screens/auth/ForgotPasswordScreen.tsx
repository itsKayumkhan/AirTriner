import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPasswordScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendReset = async () => {
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
            if (resetError) throw resetError;
            setSent(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to send reset email');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper contentStyle={styles.content}>
            {/* Back Button */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <Pressable
                    style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Back to login"
                >
                    <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
                    <Text style={styles.backText}>Back to login</Text>
                </Pressable>
            </Animated.View>

            {/* Centered content wrapper */}
            <View style={styles.centerWrapper}>
                {/* Header */}
                <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-open-outline" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your email and we'll send you a link to reset your password.
                    </Text>
                </Animated.View>

                {sent ? (
                    /* Success State with animated checkmark */
                    <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.successContainer}>
                        <View style={styles.successIconOuter}>
                            <View style={styles.successIconInner}>
                                <Ionicons name="checkmark" size={36} color={Colors.background} />
                            </View>
                        </View>
                        <Text style={styles.successTitle}>Check your email</Text>
                        <Text style={styles.successMessage}>
                            We've sent a password reset link to{'\n'}
                            <Text style={styles.successEmail}>{email}</Text>
                            {'\n\n'}It may take a few minutes to arrive.
                        </Text>
                        <View style={styles.successAction}>
                            <Button
                                title="Back to Sign In"
                                onPress={() => navigation.goBack()}
                                variant="outline"
                            />
                        </View>
                    </Animated.View>
                ) : (
                    /* Form */
                    <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.form}>
                        {/* Error */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Input
                            label="Email Address"
                            icon="mail-outline"
                            placeholder="name@domain.com"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setError(null); }}
                            error={error ? undefined : undefined}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />

                        <Button
                            title="Send Reset Link"
                            onPress={handleSendReset}
                            loading={isLoading}
                            disabled={isLoading}
                            size="lg"
                        />
                    </Animated.View>
                )}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.xxl,
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
        minHeight: 44,
    },
    backText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },

    // Center content vertically
    centerWrapper: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: Spacing.huge,
    },

    header: {
        alignItems: 'center',
        marginBottom: Spacing.huge,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        ...Shadows.glow,
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
        lineHeight: 22,
    },
    form: {
        gap: Spacing.lg,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.errorMuted,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    errorText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.error,
    },

    // Success state with animated checkmark
    successContainer: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
    },
    successIconOuter: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.successMuted,
        borderWidth: 2,
        borderColor: Colors.success + '44',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    successIconInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    successMessage: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    successEmail: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    successAction: {
        marginTop: Spacing.xxxl,
        width: '100%',
    },
});
