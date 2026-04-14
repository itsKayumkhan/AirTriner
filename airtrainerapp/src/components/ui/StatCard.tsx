import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface StatCardProps {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    color?: string;
}

export default function StatCard({ label, value, icon, color = Colors.primary }: StatCardProps) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={[styles.iconBg, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon} size={16} color={color} />
                </View>
            </View>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        flex: 1,
        minWidth: '45%',
    },
    header: {
        marginBottom: Spacing.md,
    },
    iconBg: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    value: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 2,
    },
    label: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
});
