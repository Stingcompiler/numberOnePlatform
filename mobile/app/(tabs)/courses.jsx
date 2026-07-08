import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import courseService from '../../src/services/courseService';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import CourseCard from '../../src/components/ui/CourseCard';
import EmptyState from '../../src/components/ui/EmptyState';
import { CardSkeleton } from '../../src/components/ui/SkeletonLoader';
import {
  BookOpen, Calculator, PenTool, Languages, Compass,
  FlaskConical, Atom, Globe, Search,
} from 'lucide-react-native';
import { rs, rf, hp } from '../../src/utils/responsive';

// ─── Subject color/icon resolver (same logic, centralized) ───
function getSubjectMeta(courseName, fallbackColor) {
  const name = (courseName || '').toLowerCase();
  if (name.includes('رياضيات') || name.includes('math') || name.includes('حساب'))
    return { color: '#4F87FF', icon: Calculator };
  if (name.includes('عربي') || name.includes('عربية') || name.includes('arabic') || name.includes('لغة'))
    return { color: '#F59E0B', icon: PenTool };
  if (name.includes('إسلام') || name.includes('دين') || name.includes('islamic') || name.includes('قرآن') || name.includes('توحيد'))
    return { color: '#22D3A8', icon: Compass };
  if (name.includes('فيزياء') || name.includes('physics') || name.includes('علوم') || name.includes('science'))
    return { color: '#A78BFA', icon: Atom };
  if (name.includes('كيمياء') || name.includes('chemistry'))
    return { color: '#F472B6', icon: FlaskConical };
  if (name.includes('انجليزي') || name.includes('إنجليزي') || name.includes('english') || name.includes('فرنسي') || name.includes('لغات'))
    return { color: '#38BDF8', icon: Languages };
  if (name.includes('جغرافيا') || name.includes('تاريخ') || name.includes('اجتماعيات') || name.includes('geography'))
    return { color: '#34D399', icon: Globe };
  return { color: fallbackColor || '#4F87FF', icon: BookOpen };
}

export default function CoursesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');



  const loadData = async () => {
    try {
      setError(null);
      const studentProfile = user?.student_profile || {};
      const [coursesData, progressData] = await Promise.all([
        courseService.getMyCourses(studentProfile),
        courseService.getMyProgress(),
      ]);

      const studentSystemType = studentProfile.system_type || 'online';
      let filtered = [];
      if (studentSystemType === 'online') {
        filtered = (coursesData || []).filter(
          (course) =>
            course.system_type === 'online' &&
            course.grade === studentProfile.enrolled_grade_id
        );
      } else if (studentSystemType === 'flash') {
        filtered = coursesData || [];
      }

      setCourses(filtered);
      setProgress(progressData);

    } catch (e) {
      console.log('Error loading courses:', e);
      setError('تعذر تحميل الكورسات. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCourseStats = (course) => {
    const completedIds = progress.filter((p) => p.is_completed).map((p) => p.lesson);
    // Use lesson_count from the API if available (CourseListSerializer provides it)
    // Otherwise fall back to counting from nested units if present
    let totalLessons = course.lesson_count != null ? course.lesson_count : 0;
    if (totalLessons === 0 && course.units) {
      course.units.forEach((unit) => {
        if (unit.lessons) totalLessons += unit.lessons.length;
      });
    }

    let completedLessons = 0;
    if (course.units) {
      course.units.forEach((unit) => {
        if (unit.lessons) {
          unit.lessons.forEach((lesson) => {
            if (completedIds.includes(lesson.id)) completedLessons++;
          });
        }
      });
    }

    const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    return { total: totalLessons, completed: completedLessons, percentage };
  };

  const filteredCourses = courses.filter((c) =>
    searchQuery.trim() === '' ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const stats = getCourseStats(item);
    const meta = getSubjectMeta(item.name, colors.accent);
    return (
      <CourseCard
        course={item}
        stats={stats}
        meta={meta}
        onPress={() => router.push(`/courses/${item.id}`)}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>مقرراتي الدراسية</Text>
        {!loading && courses.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.accentMuted }]}>
            <Text style={[styles.countText, { color: colors.accent }]}>{courses.length}</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      {courses.length > 0 && (
        <View style={styles.searchWrapper}>
          <View style={[styles.searchBar, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }]}>
            <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="ابحث عن كورس..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />
          </View>
        </View>
      )}

      {/* Loading skeletons */}
      {loading && !refreshing && (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </View>
      )}

      {/* Error state */}
      {!loading && error && (
        <EmptyState
          icon={<BookOpen size={32} color={colors.error} />}
          title="تعذر التحميل"
          subtitle={error}
          actionLabel="إعادة المحاولة"
          onAction={loadData}
        />
      )}

      {/* Empty state */}
      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon={<BookOpen size={32} color={colors.accent} />}
          title="لا توجد كورسات"
          subtitle="لم يتم تسجيلك في أي كورس بعد. تواصل مع الإدارة للتسجيل."
        />
      )}

      {/* Search empty */}
      {!loading && !error && courses.length > 0 && filteredCourses.length === 0 && (
        <EmptyState
          icon={<Search size={32} color={colors.textMuted} />}
          title="لا نتائج"
          subtitle={`لا يوجد كورس بالاسم "${searchQuery}"`}
        />
      )}

      {/* Course list — flex:1 here so the list fills all remaining space */}
      {!loading && !error && filteredCourses.length > 0 && (
        <FlatList
          style={styles.flatList}
          data={filteredCourses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginTop: Platform.OS === 'ios' ? 52 : 40,
    height: rs(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: hp,
    borderBottomWidth: 0.5,
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: rf(TYPOGRAPHY.size.lg),
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  searchWrapper: {
    paddingHorizontal: hp,
    paddingVertical: rs(SPACING.md),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: rs(SPACING.md),
    height: rs(44),
    gap: SPACING.sm,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: rf(TYPOGRAPHY.size.sm),
    padding: 0,
  },
  skeletonList: {
    padding: hp,
    paddingTop: rs(SPACING.md),
  },
  flatList: {
    flex: 1,
  },
  list: {
    paddingHorizontal: hp,
    paddingTop: rs(SPACING.md),
    paddingBottom: 100,
  },
});

