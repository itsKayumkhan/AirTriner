import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../theme';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'outlined';
    onPress?: () => void;
    style?: ViewStyle;
    noPadding?: boolean;
}

export default function Card({ children, variant = 'default', onPress, style, noPadding = false }: CardProps) {
    const cardStyle = [
        styles.base,
        !noPadding && styles.padded,
        variant === 'default' && styles.default,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        style,
    ];

    if (onPress) {
        return (
            <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
    base: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    padded: {
        padding: Spacing.lg,
    },
    default: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    elevated: {
        backgroundColor: Colors.surfaceElevated,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
});
