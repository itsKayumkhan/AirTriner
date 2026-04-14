import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    onMenu?: () => void;
    rightAction?: {
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
        badge?: number;
    };
    rightAction2?: {
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
        badge?: number;
    };
    large?: boolean;
}

function HeaderIconButton({ icon, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; badge?: number }) {
    return (
        <TouchableOpacity
            style={styles.iconButton}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
        >
            <Ionicons name={icon} size={22} color={Colors.text} />
            {badge !== undefined && badge > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function ScreenHeader({
    title,
    subtitle,
    onBack,
    onMenu,
    rightAction,
    rightAction2,
    large = false,
}: ScreenHeaderProps) {
    return (
        <View style={styles.container}>
            <View style={styles.leftSection}>
                {onBack && (
                    <HeaderIconButton icon="chevron-back" onPress={onBack} />
                )}
                {onMenu && (
                    <HeaderIconButton icon="menu-outline" onPress={onMenu} />
                )}
                <View style={[styles.titleContainer, (onBack || onMenu) && { marginLeft: Spacing.md }]}>
                    <Text
                        style={[styles.title, large && styles.titleLarge]}
                        numberOfLines={1}
                        accessibilityRole="header"
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                    )}
                </View>
            </View>
            <View style={styles.rightSection}>
                {rightAction2 && (
                    <HeaderIconButton
                        icon={rightAction2.icon}
                        onPress={rightAction2.onPress}
                        badge={rightAction2.badge}
                    />
                )}
                {rightAction && (
                    <HeaderIconButton
                        icon={rightAction.icon}
                        onPress={rightAction.onPress}
                        badge={rightAction.badge}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xxl,
        minHeight: 44,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    titleLarge: {
        fontSize: FontSize.xxl,
    },
    subtitle: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
});
