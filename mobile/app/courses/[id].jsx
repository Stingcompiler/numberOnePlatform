import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import courseService from '../../src/services/courseService';
import StatusView from '../../src/components/StatusView';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import { ProgressBar } from '../../src/components/ui/UIKit';
import { CardSkeleton } from '../../src/components/ui/SkeletonLoader';
import EmptyState from '../../src/components/ui/EmptyState';
import {
  ChevronRight, PlayCircle, Check, ChevronDown, ChevronLeft,
  BookOpen, User, Clock, Layers,
} from 'lucide-react-native';

// ─── Subject color resolver ───────────────────────────────────
function getSubjectColor(courseName) {
  const name = (courseName || '').toLowerCase();
  if (name.includes('رياضيات') || name.includes('math')) return '#4F87FF';
  if (name.includes('عربي') || name.includes('عربية') || name.includes('arabic')) return '#F59E0B';
  if (name.includes('إسلام') || name.includes('دين') || name.includes('قرآن')) return '#22D3A8';
  if (name.includes('فيزياء') || name.includes('physics') || name.includes('علوم')) return '#A78BFA';
  if (name.includes('كيمياء') || name.includes('chemistry')) return '#F472B6';
  if (name.includes('انجليزي') || name.includes('إنجليزي') || name.includes('english')) return '#38BDF8';
  if (name.includes('جغرافيا') || name.includes('تاريخ') || name.includes('اجتماعيات')) return '#34D399';
  return '#4F87FF';
}

function sanitizeTitle(title, index) {
  if (!title || title.trim().length <= 1 || title.toLowerCase() === 'null') {
    return `المحاضرة ${index + 1}`;
  }
  return title.trim();
}

// ─── Collapsible Unit ─────────────────────────────────────────
function UnitSection({ unit, completedIds, metaColor, onLessonPress }) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const heightAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const toggle = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.parallel([
      Animated.spring(rotateAnim, { toValue, useNativeDriver: true }),
      Animated.timing(heightAnim, { toValue, duration: 250, useNativeDriver: false }),
    ]).start();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const completedInUnit = (unit.lessons || []).filter(l => completedIds.includes(l.id)).length;
  const totalInUnit = (unit.lessons || []).length;
  const unitPct = totalInUnit > 0 ? (completedInUnit / totalInUnit) * 100 : 0;

  return (
    <View style={styles.unitBlock}>
      {/* Unit header */}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        style={[styles.unitHeader, {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        }]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronLeft size={18} color={colors.textMuted} />
        </Animated.View>

        <View style={styles.unitHeaderContent}>
          <View style={styles.unitTitleRow}>
            <Text style={[styles.unitLessonCount, { color: colors.textMuted }]}>
              {completedInUnit}/{totalInUnit}
            </Text>
            <Text style={[styles.unitName, { color: colors.text }]} numberOfLines={2}>
              {unit.name}
            </Text>
          </View>
          <ProgressBar percentage={unitPct} color={metaColor} height={4} />
        </View>

        <View style={[styles.unitIconWrap, { backgroundColor: `${metaColor}18` }]}>
          <Layers size={16} color={metaColor} />
        </View>
      </TouchableOpacity>

      {/* Lessons list */}
      {isExpanded && (
        <View style={styles.lessonsContainer}>
          {totalInUnit === 0 ? (
            <Text style={[styles.noLessons, { color: colors.textMuted }]}>
              لا توجد محاضرات في هذه الوحدة بعد.
            </Text>
          ) : (
            unit.lessons.map((lesson, idx) => {
              const isCompleted = completedIds.includes(lesson.id);
              const displayTitle = sanitizeTitle(lesson.title, idx);
              const duration = lesson.duration_minutes || 15;

              return (
                <TouchableOpacity
                  key={lesson.id}
                  onPress={() => onLessonPress(lesson)}
                  activeOpacity={0.8}
                  style={styles.lessonItem}
                >
                  <View style={[styles.lessonCard, {
                    backgroundColor: colors.surface,
                    borderColor: isCompleted ? `${colors.success}30` : colors.cardBorder,
                    borderRightWidth: 3,
                    borderRightColor: isCompleted ? colors.success : metaColor,
                  }]}>
                    {/* Completion indicator */}
                    <View style={styles.lessonLeft}>
                      {isCompleted ? (
                        <View style={[styles.checkCircle, { backgroundColor: colors.success }]}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </View>
                      ) : (
                        <View style={[styles.emptyCircle, {
                          borderColor: metaColor,
                        }]} />
                      )}
                    </View>

                    {/* Info */}
                    <View style={styles.lessonInfo}>
                      <Text style={[styles.lessonTitle, { color: colors.text }]}>
                        {displayTitle}
                      </Text>
                      <View style={styles.lessonMeta}>
                        <Clock size={11} color={colors.textMuted} />
                        <Text style={[styles.lessonMetaText, { color: colors.textMuted }]}>
                          {duration} دقيقة
                        </Text>
                      </View>
                    </View>

                    {/* Play button */}
                    <PlayCircle size={24} color={isCompleted ? colors.success : metaColor} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function CourseDetailsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const studentProfile = user?.student_profile || {};
      const [courseData, progressData] = await Promise.all([
        courseService.getCourseDetails(id, studentProfile),
        courseService.getMyProgress(),
      ]);

      const studentSystemType = studentProfile.system_type || 'online';
      let isAllowed = false;
      if (courseData) {
        if (studentSystemType === 'online') {
          isAllowed =
            courseData.system_type === 'online' &&
            courseData.grade === studentProfile.enrolled_grade_id;
        } else if (studentSystemType === 'flash') {
          const assignedCourses = await courseService.getMyCourses();
          isAllowed = (assignedCourses || []).some((c) => c.id === courseData.id);
        }
      }

      if (courseData && !isAllowed) {
        setError('مقرر دراسي غير موجود أو ليس لديك صلاحية الوصول إليه.');
      } else {
        setCourse(courseData);
        setProgress(progressData);
      }
    } catch (e) {
      console.log('Error loading course details:', e);
      if (e.response && e.response.status === 403) {
        setError(e.response.data?.detail || 'ليس لديك صلاحية الوصول لهذا المقرر الدراسي.');
      } else {
        setError('تعذر تحميل تفاصيل المقرر الدراسي. يرجى التحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCompletedIds = () =>
    progress.filter((p) => p.is_completed).map((p) => p.lesson);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronRight size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.skeletonPad}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronRight size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState
          icon={<BookOpen size={32} color={colors.error} />}
          title="تعذر التحميل"
          subtitle={error || 'مقرر دراسي غير موجود.'}
          actionLabel="إعادة المحاولة"
          onAction={loadData}
        />
      </View>
    );
  }

  const completedIds = getCompletedIds();
  const metaColor = getSubjectColor(course.name);

  // Overall stats
  let totalLessons = 0;
  let completedLessons = 0;
  (course.units || []).forEach((unit) => {
    (unit.lessons || []).forEach((lesson) => {
      totalLessons++;
      if (completedIds.includes(lesson.id)) completedLessons++;
    });
  });
  const overallPct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  const teacherText =
    course.teacher_name && course.teacher_name.trim() !== 'غير محدد'
      ? course.teacher_name
      : 'لم يتم التعيين بعد';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {course.name}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* ── Course Hero Card ── */}
        <View style={[styles.courseHero, {
          backgroundColor: isDark ? '#0F1A35' : '#EEF2FF',
          borderColor: `${metaColor}25`,
        }]}>
          {/* Color accent dot decoration */}
          <View style={[styles.heroAccentDot, { backgroundColor: `${metaColor}20` }]} />

          <View style={styles.heroContent}>
            {/* Icon badge */}
            <View style={[styles.heroIconBadge, { backgroundColor: `${metaColor}18` }]}>
              <BookOpen size={28} color={metaColor} />
            </View>

            <View style={styles.heroInfo}>
              <Text style={[styles.heroCourseName, { color: colors.text }]}>
                {course.name}
              </Text>
              <View style={styles.heroMeta}>
                <User size={13} color={colors.textMuted} />
                <Text style={[styles.heroMetaText, { color: colors.textMuted }]}>
                  {teacherText}
                </Text>
              </View>

              {course.description ? (
                <Text style={[styles.heroDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {course.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Progress section */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressPct, { color: metaColor }]}>
                {Math.round(overallPct)}%
              </Text>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                {completedLessons}/{totalLessons} محاضرة مكتملة
              </Text>
            </View>
            <ProgressBar percentage={overallPct} color={metaColor} height={7} />
          </View>
        </View>

        {/* ── Section label ── */}
        <Text style={[styles.syllabusLabel, { color: colors.textMuted }]}>
          المنهج الدراسي
        </Text>

        {/* ── Units ── */}
        {!course.units || course.units.length === 0 ? (
          <EmptyState
            icon={<Layers size={28} color={colors.textMuted} />}
            title="لا توجد وحدات"
            subtitle="لا توجد وحدات دراسية مضافة لهذا المقرر حالياً."
          />
        ) : (
          course.units.map((unit) => (
            <UnitSection
              key={unit.id}
              unit={unit}
              completedIds={completedIds}
              metaColor={metaColor}
              onLessonPress={(lesson) =>
                router.push({
                  pathname: `/courses/lesson/${lesson.id}`,
                  params: { courseId: course.id },
                })
              }
            />
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginTop: Platform.OS === 'ios' ? 52 : 40,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },
  skeletonPad: {
    padding: SPACING.lg,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },

  // Course Hero
  courseHero: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.md,
  },
  heroAccentDot: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  heroContent: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  heroIconBadge: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  heroCourseName: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
  },
  heroMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  heroDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
    lineHeight: 18,
    marginTop: 2,
  },
  progressSection: {
    gap: SPACING.sm,
  },
  progressLabelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPct: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.size.xs,
  },

  // Syllabus label
  syllabusLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
    paddingRight: SPACING.xs,
  },

  // Unit
  unitBlock: {
    marginBottom: SPACING.md,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    ...SHADOWS.sm,
  },
  unitHeaderContent: {
    flex: 1,
    gap: SPACING.sm,
  },
  unitTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    flex: 1,
  },
  unitLessonCount: {
    fontSize: 10,
    flexShrink: 0,
    marginLeft: SPACING.sm,
  },
  unitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Lessons
  lessonsContainer: {
    paddingTop: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  noLessons: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  lessonItem: {
    marginBottom: SPACING.xs,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 0.5,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  lessonLeft: {
    flexShrink: 0,
    marginRight: SPACING.xs,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  lessonInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  lessonTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    textAlign: 'right',
  },
  lessonMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  lessonMetaText: {
    fontSize: 10,
  },

  bottomSpacer: { height: SPACING.xxxl },
});
