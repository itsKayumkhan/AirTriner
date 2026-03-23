import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  size?: 'small' | 'medium' | 'large';
}

export default function Founding50Badge({ size = 'medium' }: Props) {
  if (size === 'small') {
    return (
      <View style={styles.smallContainer}>
        <Ionicons name="star" size={10} color="#FFD700" />
        <Text style={styles.smallText}>F·50</Text>
      </View>
    );
  }

  if (size === 'large') {
    return (
      <View style={styles.largeContainer}>
        <Ionicons name="star" size={20} color="#FFD700" />
        <Text style={styles.largeText}>FOUNDING 50</Text>
      </View>
    );
  }

  // medium (default)
  return (
    <View style={styles.mediumContainer}>
      <Ionicons name="star" size={13} color="#FFD700" />
      <Text style={styles.mediumText}>FOUNDING 50</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  smallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  smallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 0.3,
  },
  mediumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  mediumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  largeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  largeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
});
