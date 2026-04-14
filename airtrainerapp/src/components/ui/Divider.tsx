import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '../../theme';

interface DividerProps {
    text?: string;
}

export default function Divider({ text }: DividerProps) {
    if (text) {
        return (
            <View style={styles.container}>
                <View style={styles.line} />
                <Text style={styles.text}>{text}</Text>
                <View style={styles.line} />
            </View>
        );
    }

    return <View style={styles.simpleLine} />;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    text: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        marginHorizontal: Spacing.lg,
    },
    simpleLine: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.md,
    },
});
