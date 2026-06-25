import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RADIUS, SHADOWS } from '../theme/tokens';

/**
 * Base Card — glassmorphic surface card.
 * Accepts `elevated` prop for stronger shadow/border.
 */
export const Card = ({ children, style, elevated = false, ...props }) => {
  const { theme, colors, isDark } = useTheme();

  const base = {
    backgroundColor: isDark
      ? 'rgba(15, 22, 41, 0.85)'
      : 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    borderColor: isDark
      ? 'rgba(255, 255, 255, 0.07)'
      : 'rgba(0, 0, 0, 0.06)',
    padding: 16,
    ...(elevated ? SHADOWS.md : SHADOWS.sm),
  };

  return (
    <View style={[base, style]} {...props}>
      {children}
    </View>
  );
};

export default Card;
