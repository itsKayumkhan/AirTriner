import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

interface Tab {
    key: string;
    label: string;
    count?: number;
}

interface TabFilterProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (key: string) => void;
}

export default function TabFilter({ tabs, activeTab, onTabChange }: TabFilterProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, isActive && styles.tabActive]}
                        onPress={() => onTabChange(tab.key)}
                        activeOpacity={0.7}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                    >
                        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                        {tab.count !== undefined && (
                            <View style={[styles.count, isActive && styles.countActive]}>
                                <Text style={[styles.countText, isActive && styles.countTextActive]}>
                                    {tab.count}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
        paddingVertical: 2,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    tabActive: {
        backgroundColor: Colors.primaryMuted,
        borderColor: Colors.borderActive,
    },
    tabText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
    },
    tabTextActive: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    count: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    countActive: {
        backgroundColor: Colors.primary + '25',
    },
    countText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },
    countTextActive: {
        color: Colors.primary,
    },
});
