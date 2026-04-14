import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface ListItemProps {
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    title: string;
    subtitle?: string;
    rightText?: string;
    onPress?: () => void;
    showChevron?: boolean;
    toggle?: {
        value: boolean;
        onValueChange: (val: boolean) => void;
    };
    destructive?: boolean;
    badge?: string;
    isLast?: boolean;
}

export default function ListItem({
    icon,
    iconColor = Colors.textSecondary,
    title,
    subtitle,
    rightText,
    onPress,
    showChevron = true,
    toggle,
    destructive = false,
    badge,
    isLast = false,
}: ListItemProps) {
    const content = (
        <View style={[styles.container, !isLast && styles.border]}>
            {icon && (
                <View style={[styles.iconContainer, destructive && styles.iconDestructive]}>
                    <Ionicons name={icon} size={18} color={destructive ? Colors.error : iconColor} />
                </View>
            )}
            <View style={styles.textContainer}>
                <Text style={[styles.title, destructive && styles.titleDestructive]}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {rightText && <Text style={styles.rightText}>{rightText}</Text>}
            {badge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}
            {toggle && (
                <Switch
                    value={toggle.value}
                    onValueChange={toggle.onValueChange}
                    trackColor={{ false: Colors.glass, true: Colors.primaryMuted }}
                    thumbColor={toggle.value ? Colors.primary : Colors.textTertiary}
                />
            )}
            {showChevron && !toggle && (
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={title}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        minHeight: 52,
    },
    border: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    iconDestructive: {
        backgroundColor: Colors.errorMuted,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    titleDestructive: {
        color: Colors.error,
    },
    subtitle: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    rightText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginRight: Spacing.sm,
    },
    badge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginRight: Spacing.sm,
    },
    badgeText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
});
