import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: keyof typeof Ionicons.glyphMap;
    iconRight?: keyof typeof Ionicons.glyphMap;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
}

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    fullWidth = true,
    style,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const heights = { sm: 40, md: 48, lg: 54 };
    const fontSizes = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.md };
    const iconSizes = { sm: 16, md: 18, lg: 20 };

    const buttonContent = (
        <View style={styles.content}>
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' ? Colors.textInverse : Colors.primary}
                    size="small"
                />
            ) : (
                <>
                    {icon && <Ionicons name={icon} size={iconSizes[size]} color={getTextColor(variant)} style={{ marginRight: Spacing.sm }} />}
                    <Text style={[styles.text, { fontSize: fontSizes[size], color: getTextColor(variant) }]}>
                        {title}
                    </Text>
                    {iconRight && <Ionicons name={iconRight} size={iconSizes[size]} color={getTextColor(variant)} style={{ marginLeft: Spacing.sm }} />}
                </>
            )}
        </View>
    );

    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={isDisabled}
                activeOpacity={0.8}
                style={[fullWidth && styles.fullWidth, style]}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ disabled: isDisabled }}
            >
                <LinearGradient
                    colors={isDisabled ? ['#2a3a4a', '#1e2e3e'] : [Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                        styles.base,
                        { height: heights[size] },
                        !isDisabled && Shadows.glow,
                        isDisabled && styles.disabled,
                    ]}
                >
                    {buttonContent}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
            style={[
                styles.base,
                { height: heights[size] },
                variant === 'secondary' && styles.secondary,
                variant === 'outline' && styles.outline,
                variant === 'ghost' && styles.ghost,
                variant === 'danger' && styles.danger,
                isDisabled && styles.disabled,
                fullWidth && styles.fullWidth,
                style,
            ]}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: isDisabled }}
        >
            {buttonContent}
        </TouchableOpacity>
    );
}

function getTextColor(variant: string) {
    switch (variant) {
        case 'primary': return Colors.textInverse;
        case 'secondary': return Colors.text;
        case 'outline': return Colors.primary;
        case 'ghost': return Colors.textSecondary;
        case 'danger': return Colors.error;
        default: return Colors.text;
    }
}

const styles = StyleSheet.create({
    base: {
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontWeight: FontWeight.semibold,
    },
    secondary: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    danger: {
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.errorMuted,
    },
    disabled: {
        opacity: 0.5,
    },
    fullWidth: {
        width: '100%',
    },
});
