import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight } from '../../theme';

interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: number;
    borderColor?: string;
}

export default function Avatar({ uri, name, size = 44, borderColor }: AvatarProps) {
    const initials = name
        ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
        : '?';

    const fontSize = size < 32 ? FontSize.xxs : size < 48 ? FontSize.sm : FontSize.lg;
    const borderWidth = size < 32 ? 1 : 2;

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={[
                    styles.image,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth,
                        borderColor: borderColor || Colors.border,
                    },
                ]}
                accessibilityLabel={name ? `${name}'s avatar` : 'User avatar'}
            />
        );
    }

    return (
        <View
            style={[
                styles.placeholder,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth,
                    borderColor: borderColor || Colors.border,
                },
            ]}
            accessibilityLabel={name ? `${name}'s avatar` : 'User avatar'}
        >
            <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: Colors.card,
    },
    placeholder: {
        backgroundColor: Colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initials: {
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
});
