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
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';

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
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Back Button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
                        <Text style={styles.backText}>Back to login</Text>
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#45D0FF', '#0047AB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.iconContainer}
                        >
                            <Ionicons name="lock-open-outline" size={32} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.title}>Reset Password</Text>
                        <Text style={styles.subtitle}>
                            Enter your email and we'll send you a link to reset your password.
                        </Text>
                    </View>

                    {sent ? (
                        /* Success State */
                        <View style={styles.successContainer}>
                            <View style={styles.successIconWrapper}>
                                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                            </View>
                            <Text style={styles.successTitle}>Check your email</Text>
                            <Text style={styles.successMessage}>
                                We've sent a password reset link to{'\n'}
                                <Text style={styles.successEmail}>{email}</Text>
                                {'\n\n'}It may take a few minutes to arrive.
                            </Text>
                            <TouchableOpacity
                                style={styles.backToLoginButton}
                                onPress={() => navigation.goBack()}
                            >
                                <Text style={styles.backToLoginText}>Back to Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* Form */
                        <View style={styles.form}>
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={18} color={Colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            {/* Email Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email Address</Text>
                                <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                                    <Ionicons
                                        name="mail-outline"
                                        size={20}
                                        color={Colors.textTertiary}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="name@domain.com"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={email}
                                        onChangeText={(t) => {
                                            setEmail(t);
                                            setError(null);
                                        }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoFocus
                                    />
                                </View>
                            </View>

                            {/* Send Reset Link Button */}
                            <TouchableOpacity
                                onPress={handleSendReset}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#45D0FF', '#0090d4']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={Colors.background} size="small" />
                                    ) : (
                                        <Text style={styles.sendButtonText}>Send Reset Link</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
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
        paddingTop: Layout.headerTopPadding,
        paddingBottom: 40,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xxxl,
    },
    backText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 18,
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
    inputIcon: {
        marginRight: Spacing.md,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: 'rgba(255, 23, 68, 0.3)',
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
    sendButton: {
        height: 52,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.glow,
    },
    sendButtonDisabled: {
        opacity: 0.7,
    },
    sendButtonText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#0A0D14',
    },
    successContainer: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
    },
    successIconWrapper: {
        marginBottom: Spacing.xl,
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
    backToLoginButton: {
        marginTop: Spacing.xxxl,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xxl,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
    },
    backToLoginText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
});
