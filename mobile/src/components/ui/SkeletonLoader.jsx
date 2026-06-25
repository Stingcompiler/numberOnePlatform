import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS } from '../../theme/tokens';

/**
 * SkeletonLoader — animated shimmer placeholder for loading states.
 * Usage: <SkeletonLoader width="100%" height={20} radius={8} />
 */
export default function SkeletonLoader({ width = '100%', height = 16, radius, style }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.shimmerBase, colors.shimmerHighlight],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius !== undefined ? radius : RADIUS.sm,
          backgroundColor: bgColor,
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton layouts for common patterns */
export function CardSkeleton({ style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.cardSkeleton, { backgroundColor: colors.surface, borderColor: colors.cardBorder }, style]}>
      <View style={styles.cardSkeletonRow}>
        <SkeletonLoader width={56} height={56} radius={12} style={{ marginLeft: 12 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonLoader width="70%" height={14} />
          <SkeletonLoader width="45%" height={11} />
          <SkeletonLoader width="90%" height={6} radius={3} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

export function StatRowSkeleton() {
  return (
    <View style={styles.statRow}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.statSkeletonItem}>
          <SkeletonLoader width={36} height={36} radius={18} style={{ alignSelf: 'center' }} />
          <SkeletonLoader width="60%" height={18} radius={4} style={{ marginTop: 8, alignSelf: 'center' }} />
          <SkeletonLoader width="40%" height={10} radius={4} style={{ marginTop: 4, alignSelf: 'center' }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardSkeleton: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 12,
  },
  cardSkeletonRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statSkeletonItem: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
});
