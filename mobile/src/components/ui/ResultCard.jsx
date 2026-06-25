import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../theme/tokens';
import { Badge } from './UIKit';
import { CheckCircle, XCircle, ChevronLeft, Calendar, BookOpen } from 'lucide-react-native';

/**
 * ResultCard — exam attempt result card.
 */
export default function ResultCard({ attempt, onPress }) {
  const { colors } = useTheme();
  const isPassed = attempt.is_passed;
  const accentColor = isPassed ? colors.success : colors.error;
  const bgColor = isPassed ? colors.successMuted : colors.errorMuted;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        {/* Score ring area */}
        <View style={[styles.scoreArea, { backgroundColor: bgColor }]}>
          <Text style={[styles.scoreNum, { color: accentColor }]}>
            {attempt.percentage?.toFixed(0)}%
          </Text>
          <Text style={[styles.scoreFraction, { color: accentColor }]}>
            {attempt.score}/{attempt.exam_total_marks}
          </Text>
          {isPassed
            ? <CheckCircle size={16} color={accentColor} style={{ marginTop: 4 }} />
            : <XCircle size={16} color={accentColor} style={{ marginTop: 4 }} />
          }
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Badge label={isPassed ? 'ناجح' : 'راسب'} variant={isPassed ? 'success' : 'error'} size="sm" />
          </View>
          <Text style={[styles.examTitle, { color: colors.text }]} numberOfLines={2}>
            {attempt.exam_title}
          </Text>
          <View style={styles.metaRow}>
            <BookOpen size={11} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {attempt.exam_course}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Calendar size={11} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {new Date(attempt.submitted_at).toLocaleDateString('ar-SA')}
            </Text>
          </View>
        </View>

        <ChevronLeft size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  scoreArea: {
    width: 80,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  scoreNum: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  scoreFraction: {
    fontSize: 10,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  header: {
    flexDirection: 'row-reverse',
  },
  examTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    textAlign: 'right',
    flex: 1,
  },
});
