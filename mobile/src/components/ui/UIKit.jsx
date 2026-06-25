import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../theme/tokens';

/**
 * Badge — color-coded status pill.
 * variants: 'success' | 'warning' | 'error' | 'info' | 'accent' | 'muted'
 */
export function Badge({ label, variant = 'accent', size = 'sm', style }) {
  const { colors } = useTheme();

  const variantMap = {
    success: { bg: colors.successMuted, text: colors.success },
    warning: { bg: colors.warningMuted, text: colors.warning },
    error:   { bg: colors.errorMuted,   text: colors.error },
    info:    { bg: colors.infoMuted,    text: colors.info },
    accent:  { bg: colors.accentMuted,  text: colors.accent },
    muted:   { bg: 'rgba(255,255,255,0.06)', text: colors.textMuted },
  };

  const v = variantMap[variant] || variantMap.accent;
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: v.bg },
      isSmall ? styles.badgeSm : styles.badgeMd,
      style,
    ]}>
      <Text style={[
        styles.label,
        { color: v.text },
        isSmall ? styles.labelSm : styles.labelMd,
      ]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * StatCard — compact stat tile with icon and value.
 */
export function StatCard({ icon, value, label, iconBg, iconColor, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }, style]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg || colors.accentMuted }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/**
 * SectionHeader — titled section divider with optional "see all" link.
 */
export function SectionHeader({ title, actionLabel, onAction, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      {onAction && actionLabel ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.sectionAction, { color: colors.accent }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : <View />}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

/**
 * ProgressBar — horizontal progress indicator.
 */
export function ProgressBar({ percentage, color, height = 6, style }) {
  const { colors } = useTheme();
  const pct = Math.min(Math.max(percentage || 0, 0), 100);

  return (
    <View style={[styles.progressBg, { backgroundColor: colors.border, height }, style]}>
      <View style={[
        styles.progressFill,
        {
          backgroundColor: color || colors.accent,
          width: `${pct}%`,
          height,
        }
      ]} />
    </View>
  );
}

export default Badge;

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.round,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
  },
  badgeMd: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  label: {
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  labelSm: {
    fontSize: 10,
  },
  labelMd: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  // StatCard
  statCard: {
    flex: 1,
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  // SectionHeader
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  sectionAction: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  // ProgressBar
  progressBg: {
    borderRadius: RADIUS.round,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: RADIUS.round,
  },
});
