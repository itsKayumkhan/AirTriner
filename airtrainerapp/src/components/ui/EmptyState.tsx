import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../theme';
import Button from './Button';

interface EmptyStateProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View style={styles.container} accessibilityRole="text">
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={36} color={Colors.textTertiary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {description && (
                <Text style={styles.description}>{description}</Text>
            )}
            {actionLabel && onAction && (
                <View style={styles.action}>
                    <Button
                        title={actionLabel}
                        onPress={onAction}
                        variant="primary"
                        size="sm"
                        fullWidth={false}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.xxl,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    description: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 20,
    },
    action: {
        marginTop: Spacing.xl,
    },
});
