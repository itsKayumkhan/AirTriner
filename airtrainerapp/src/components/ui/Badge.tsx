import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface BadgeProps {
    label: string;
    color?: string;
    bgColor?: string;
    size?: 'sm' | 'md';
    dot?: boolean;
    style?: ViewStyle;
}

export default function Badge({
    label,
    color = Colors.primary,
    bgColor,
    size = 'sm',
    dot = false,
    style,
}: BadgeProps) {
    const bg = bgColor || color + '18';

    return (
        <View style={[styles.container, size === 'md' && styles.containerMd, { backgroundColor: bg }, style]}>
            {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
            <Text style={[
                styles.text,
                size === 'md' && styles.textMd,
                { color },
            ]}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        alignSelf: 'flex-start',
        gap: Spacing.xs,
    },
    containerMd: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    text: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    textMd: {
        fontSize: FontSize.xs,
    },
});
