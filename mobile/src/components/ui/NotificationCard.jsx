import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../theme/tokens';
import { Bell, ChevronLeft } from 'lucide-react-native';

/**
 * NotificationCard — notification list item.
 */
export default function NotificationCard({ item, isRead, onPress }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.wrapper}>
      <View style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isRead ? colors.cardBorder : colors.accent,
          borderLeftWidth: isRead ? 0.5 : 2,
        }
      ]}>
        {/* Bell icon */}
        <View style={[styles.iconWrap, {
          backgroundColor: isRead ? 'rgba(255,255,255,0.04)' : colors.accentMuted,
        }]}>
          <Bell size={18} color={isRead ? colors.textMuted : colors.accent} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            {!isRead && (
              <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
            )}
            <Text
              style={[
                styles.title,
                { color: colors.text, fontWeight: isRead ? '400' : '700' }
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
          </View>
          <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.content}
          </Text>
        </View>

        <ChevronLeft size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'right',
    flex: 1,
  },
  preview: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
    lineHeight: 17,
  },
});
