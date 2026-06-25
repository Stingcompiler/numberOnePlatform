import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../theme/tokens';
import { ProgressBar, Badge } from './UIKit';
import { PlayCircle } from 'lucide-react-native';

/**
 * CourseCard — rich course display card.
 */
export default function CourseCard({ course, stats, meta, onPress }) {
  const { colors } = useTheme();
  const SubjectIcon = meta?.icon;
  const accentColor = meta?.color || colors.accent;
  const pct = stats?.percentage || 0;
  const isComplete = pct >= 100;

  const teacherText =
    !course.teacher_name || course.teacher_name.trim() === 'غير محدد'
      ? 'لم يتم التعيين بعد'
      : course.teacher_name;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        {/* Accent left strip — rendered as an absolute overlay so it never collapses */}
        <View
          style={[
            styles.accentStrip,
            { backgroundColor: accentColor },
          ]}
        />

        {/* Card body — pushed right of the strip via paddingLeft */}
        <View style={styles.inner}>
          {/* Thumbnail / Subject icon */}
          <View
            style={[
              styles.thumbnail,
              { backgroundColor: `${accentColor}18` },
            ]}
          >
            {course.thumbnail ? (
              <Image
                source={{ uri: course.thumbnail }}
                style={styles.thumbnailImg}
                resizeMode="cover"
              />
            ) : SubjectIcon ? (
              <SubjectIcon size={26} color={accentColor} />
            ) : null}
          </View>

          {/* Text details */}
          <View style={styles.details}>
            {/* Title + badge row */}
            <View style={styles.topRow}>
              <Badge
                label={isComplete ? 'مكتمل' : `${Math.round(pct)}%`}
                variant={isComplete ? 'success' : 'accent'}
                size="sm"
              />
              <Text
                style={[styles.courseName, { color: colors.text }]}
                numberOfLines={2}
              >
                {course.name}
              </Text>
            </View>

            {/* Teacher */}
            {/* <Text
              style={[styles.teacherName, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              الأستاذ: {teacherText}
            </Text> */}

            {/* Progress */}
            <View style={styles.progressArea}>
              <ProgressBar
                percentage={pct}
                color={accentColor}
                height={5}
              />
              <View style={styles.statsRow}>
                <View style={styles.lecturesBadge}>
                  <PlayCircle size={11} color={colors.textMuted} />
                  <Text style={[styles.lecturesText, { color: colors.textMuted }]}>
                    {stats?.completed || 0}/{stats?.total || 0} محاضرة
                  </Text>
                </View>
                <Text style={[styles.pctText, { color: accentColor }]}>
                  {Math.round(pct)}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
    // Ensures the card never clips on the sides
    width: '100%',
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    overflow: 'hidden',
    // Use relative positioning so the strip absolute overlay works
    position: 'relative',
    ...SHADOWS.sm,
  },
  // Full-height left strip via absolute positioning
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 1,
  },
  // Inner row: padded left so content doesn't overlap the strip
  inner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    paddingLeft: SPACING.md + 4, // 4 = strip width
    gap: SPACING.md,
    // Explicitly set a minimum height so the strip always shows
    minHeight: 90,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Never shrink below its natural size
    flexShrink: 0,
    flexGrow: 0,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  details: {
    flex: 1,
    gap: SPACING.xs,
    // Prevent details from overflowing into the thumbnail
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  courseName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    flex: 1,
    lineHeight: 19,
  },
  teacherName: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
  },
  progressArea: {
    gap: 5,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lecturesBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  lecturesText: {
    fontSize: 10,
  },
  pctText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
});
