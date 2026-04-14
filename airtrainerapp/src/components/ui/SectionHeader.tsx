import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../theme';

interface SectionHeaderProps {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            {actionLabel && onAction && (
                <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.7}>
                    <Text style={styles.actionText}>{actionLabel}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    actionText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
});
