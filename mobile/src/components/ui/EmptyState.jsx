import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../theme/tokens';

/**
 * EmptyState — full-screen or inline empty placeholder.
 * @param {React.Component} icon  — lucide icon component (already rendered)
 * @param {string} title          — primary headline
 * @param {string} subtitle       — supporting description
 * @param {string} actionLabel    — optional CTA button label
 * @param {Function} onAction     — optional CTA handler
 */
export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={[styles.iconWrapper, { backgroundColor: colors.accentMuted }]}>
          {icon}
        </View>
      )}
      {title && (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      )}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          style={[styles.actionButton, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
        >
          <Text style={[styles.actionText, { color: colors.accent }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl2,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl2,
    borderRadius: RADIUS.button,
    borderWidth: 1,
  },
  actionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
});
