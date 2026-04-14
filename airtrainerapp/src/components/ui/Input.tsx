import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    isPassword?: boolean;
    containerStyle?: ViewStyle;
}

export default function Input({
    label,
    error,
    icon,
    isPassword = false,
    containerStyle,
    ...props
}: InputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text style={styles.label}>{label}</Text>
            )}
            <View style={[
                styles.inputContainer,
                isFocused && styles.inputFocused,
                error && styles.inputError,
            ]}>
                {icon && (
                    <Ionicons
                        name={icon}
                        size={18}
                        color={isFocused ? Colors.primary : Colors.textTertiary}
                        style={styles.icon}
                    />
                )}
                <TextInput
                    style={styles.input}
                    placeholderTextColor={Colors.textMuted}
                    selectionColor={Colors.primary}
                    secureTextEntry={isPassword && !showPassword}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    accessibilityLabel={label}
                    {...props}
                />
                {isPassword && (
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={Colors.textTertiary}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        height: 50,
        paddingHorizontal: Spacing.lg,
    },
    inputFocused: {
        borderColor: Colors.borderActive,
        backgroundColor: Colors.surfaceElevated,
    },
    inputError: {
        borderColor: Colors.error,
    },
    icon: {
        marginRight: Spacing.md,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    eyeButton: {
        padding: Spacing.xs,
        marginLeft: Spacing.sm,
    },
    errorText: {
        fontSize: FontSize.xs,
        color: Colors.error,
        marginTop: Spacing.xs,
    },
});
