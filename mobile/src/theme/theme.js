import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from './tokens';

export const getThemeStyles = (isDark) => {
  const colors = isDark ? COLORS.dark : COLORS.light;

  return {
    colors,
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Base card — used by Card.jsx
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      padding: SPACING.lg,
      ...SHADOWS.md,
    },
    // Glass card — richer glassmorphism feel
    glassCard: {
      backgroundColor: isDark
        ? 'rgba(15, 22, 41, 0.85)'
        : 'rgba(255, 255, 255, 0.92)',
      borderRadius: RADIUS.card,
      borderWidth: 0.5,
      borderColor: isDark
        ? 'rgba(255, 255, 255, 0.07)'
        : 'rgba(0, 0, 0, 0.05)',
      padding: SPACING.lg,
      ...SHADOWS.md,
    },
    // Elevated card — for important / hero sections
    elevatedCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: RADIUS.xl,
      borderWidth: 0.5,
      borderColor: colors.borderStrong,
      padding: SPACING.xl,
      ...SHADOWS.lg,
    },
    title: {
      color: colors.text,
      fontSize: TYPOGRAPHY.size.xl,
      fontWeight: TYPOGRAPHY.weight.bold,
      textAlign: 'right',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: TYPOGRAPHY.size.md,
      fontWeight: TYPOGRAPHY.weight.medium,
      textAlign: 'right',
    },
    body: {
      color: colors.textSecondary,
      fontSize: TYPOGRAPHY.size.sm,
      fontWeight: TYPOGRAPHY.weight.regular,
      textAlign: 'right',
    },
    input: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(0, 0, 0, 0.03)',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      color: colors.text,
      textAlign: 'right',
      fontSize: TYPOGRAPHY.size.md,
    },
    // Separator line
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    // Section label style
    sectionLabel: {
      color: colors.textMuted,
      fontSize: TYPOGRAPHY.size.xs,
      fontWeight: TYPOGRAPHY.weight.bold,
      textAlign: 'right',
      letterSpacing: 0.5,
    },
    // Gradient definitions for reference
    gradients: {
      primary: colors.gradientPrimary,
      success: colors.gradientSuccess,
      warm: colors.gradientWarm,
      card: colors.gradientCard,
    },
    shadows: SHADOWS,
  };
};
