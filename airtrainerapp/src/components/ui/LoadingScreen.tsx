import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../theme';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message }: LoadingScreenProps) {
    return (
        <View style={styles.container} accessibilityRole="progressbar">
            <ActivityIndicator size="large" color={Colors.primary} />
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        gap: Spacing.lg,
    },
    message: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
});
