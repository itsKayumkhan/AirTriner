import React from 'react';
import {
    View,
    ScrollView,
    StyleSheet,
    StatusBar,
    RefreshControl,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Spacing } from '../../theme';

interface ScreenWrapperProps {
    children: React.ReactNode;
    scrollable?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
    noPadding?: boolean;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
}

export default function ScreenWrapper({
    children,
    scrollable = true,
    refreshing = false,
    onRefresh,
    noPadding = false,
    style,
    contentStyle,
}: ScreenWrapperProps) {
    const insets = useSafeAreaInsets();

    const containerPadding = noPadding ? 0 : Layout.screenPadding;

    if (!scrollable) {
        return (
            <View style={[styles.container, style]}>
                <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
                <View style={[
                    styles.content,
                    {
                        paddingTop: insets.top + Spacing.md,
                        paddingHorizontal: containerPadding,
                        paddingBottom: insets.bottom,
                    },
                    contentStyle,
                ]}>
                    {children}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, style]}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + Spacing.md,
                        paddingHorizontal: containerPadding,
                        paddingBottom: insets.bottom + 100,
                    },
                    contentStyle,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    onRefresh ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                            colors={[Colors.primary]}
                        />
                    ) : undefined
                }
            >
                {children}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
});
