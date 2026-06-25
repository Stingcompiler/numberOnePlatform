import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../theme/tokens';
import { Badge } from './UIKit';
import { PenTool, CheckCircle, Clock, Hash, ChevronLeft } from 'lucide-react-native';

/**
 * ExamCard — status-aware exam card.
 * @param {Object} exam          — exam data
 * @param {boolean} isCompleted  — whether attempts exist
 * @param {Object} latestAttempt — last attempt data
 * @param {Function} onPress
 */
export default function ExamCard({ exam, isCompleted, latestAttempt, onPress }) {
  const { colors } = useTheme();
  const isPassed = latestAttempt?.is_passed;

  let statusVariant = 'accent';
  let statusLabel = 'ابدأ الآن';
  if (isCompleted) {
    statusVariant = isPassed ? 'success' : 'error';
    statusLabel = isPassed ? 'ناجح' : 'راسب';
  }

  const accentColor = isCompleted
    ? (isPassed ? colors.success : colors.error)
    : colors.accent;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        {/* Left accent strip */}
        <View style={[styles.strip, { backgroundColor: accentColor }]} />

        <View style={styles.inner}>
          {/* Score / Icon column */}
          <View style={styles.scoreColumn}>
            {isCompleted && latestAttempt ? (
              <View style={[styles.scoreCircle, {
                backgroundColor: isPassed ? colors.successMuted : colors.errorMuted,
                borderColor: isPassed ? colors.success : colors.error,
              }]}>
                <Text style={[styles.scoreValue, { color: isPassed ? colors.success : colors.error }]}>
                  {latestAttempt.percentage?.toFixed(0)}%
                </Text>
                <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
                  {latestAttempt.score}/{exam.total_marks}
                </Text>
              </View>
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
                <PenTool size={20} color={colors.accent} />
              </View>
            )}
          </View>

          {/* Details column */}
          <View style={styles.details}>
            <View style={styles.titleRow}>
              <Badge label={statusLabel} variant={statusVariant} size="sm" />
              <Text style={[styles.examTitle, { color: colors.text }]} numberOfLines={2}>
                {exam.title}
              </Text>
            </View>

            <Text style={[styles.courseName, { color: colors.textSecondary }]} numberOfLines={1}>
              {exam.course_name}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={11} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {exam.duration_minutes} د
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Hash size={11} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {exam.total_marks} درجة
                </Text>
              </View>
            </View>
          </View>

          <ChevronLeft size={18} color={colors.textMuted} />
        </View>
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
    ...SHADOWS.sm,
  },
  strip: {
    width: 4,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  scoreColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  scoreSub: {
    fontSize: 9,
    marginTop: 1,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  examTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    flex: 1,
    lineHeight: 19,
  },
  courseName: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 10,
  },
});
