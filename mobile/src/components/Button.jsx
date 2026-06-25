import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme/tokens';

export const Button = ({
  onPress,
  title,
  loading = false,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  ...props
}) => {
  const { colors } = useTheme();

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface }];
      case 'outline':
        return [styles.outline, { borderColor: colors.accent }];
      case 'danger':
        return [styles.danger, { backgroundColor: colors.error }];
      default:
        return [styles.primary, { backgroundColor: colors.accent }];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return { color: colors.textSecondary };
      case 'outline':
        return { color: colors.accent };
      default:
        return { color: '#030712' }; // Dark color for light texts
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        getButtonStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.text : '#030712'} size="small" />
      ) : (
        <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    flexDirection: 'row',
  },
  primary: {
    shadowColor: '#00D8D6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  secondary: {
    borderWidth: 1,
  },
  outline: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  danger: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
});

export default Button;
