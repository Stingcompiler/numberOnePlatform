import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import examService from '../../src/services/examService';
import courseService from '../../src/services/courseService';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import ExamCard from '../../src/components/ui/ExamCard';
import EmptyState from '../../src/components/ui/EmptyState';
import { CardSkeleton } from '../../src/components/ui/SkeletonLoader';
import { PenTool, CheckCircle } from 'lucide-react-native';
import { rs, rf, hp } from '../../src/utils/responsive';

export default function ExamsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Animated underline position
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    try {
      setError(null);
      const studentProfile = user?.student_profile || {};
      const [examsData, coursesData] = await Promise.all([
        examService.getStudentExams(),
        courseService.getMyCourses(studentProfile),
      ]);

      const studentSystemType = studentProfile.system_type || 'online';
      let filteredCourses = [];
      if (studentSystemType === 'online') {
        filteredCourses = (coursesData || []).filter(
          (course) =>
            course.system_type === 'online' &&
            course.grade === studentProfile.enrolled_grade_id
        );
      } else if (studentSystemType === 'flash') {
        filteredCourses = coursesData || [];
      }

      const allowedCourseIds = filteredCourses.map((c) => c.id);
      const filteredExams = (examsData || []).filter((exam) =>
        allowedCourseIds.includes(exam.course_id)
      );

      // --- Debugging Requirements Logging ---
      console.log('====================================');
      console.log('[DEBUG] Student ID:', studentProfile.id);
      console.log('[DEBUG] Student Type:', studentSystemType);
      console.log('[DEBUG] Course IDs assigned to student:', allowedCourseIds);
      console.log('[DEBUG] Exam IDs returned by API:', (examsData || []).map((e) => e.id));
      console.log('[DEBUG] Exam IDs after filtering:', filteredExams.map((e) => e.id));
      console.log('[DEBUG] Final exams count to render:', filteredExams.length);
      console.log('====================================');

      setExams(filteredExams);
    } catch (e) {
      console.log('Error loading exams:', e);
      setError('تعذر تحميل الاختبارات. يرجى التحقق من اتصالك بالإنترنت.');
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

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(tabIndicator, {
      toValue: tab === 'available' ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  };

  const getFilteredExams = () => {
    if (activeTab === 'available') return exams.filter((e) => (e.attempts || []).length === 0);
    return exams.filter((e) => (e.attempts || []).length > 0);
  };

  const availableCount = exams.filter((e) => (e.attempts || []).length === 0).length;
  const completedCount = exams.filter((e) => (e.attempts || []).length > 0).length;

  const renderItem = ({ item }) => {
    const isCompleted = (item.attempts || []).length > 0;
    const latestAttempt = isCompleted ? item.attempts[item.attempts.length - 1] : null;
    return (
      <ExamCard
        exam={item}
        isCompleted={isCompleted}
        latestAttempt={latestAttempt}
        onPress={() => {
          if (isCompleted && latestAttempt) {
            router.push(`/results/${latestAttempt.id}`);
          } else {
            router.push(`/exams/${item.id}`);
          }
        }}
      />
    );
  };

  // Tab indicator width interpolation
  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الاختبارات الأكاديمية</Text>
      </View>

      {/* Segmented Tab Control */}
      <View style={styles.tabWrap}>
        <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Active indicator */}
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                backgroundColor: colors.accent,
                left: indicatorLeft,
              },
            ]}
          />

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => switchTab('completed')}
            activeOpacity={0.8}
          >
            <CheckCircle
              size={14}
              color={activeTab === 'completed' ? '#fff' : colors.textMuted}
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === 'completed' ? '#fff' : colors.textMuted },
            ]}>
              المكتملة {completedCount > 0 ? `(${completedCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => switchTab('available')}
            activeOpacity={0.8}
          >
            <PenTool
              size={14}
              color={activeTab === 'available' ? '#fff' : colors.textMuted}
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === 'available' ? '#fff' : colors.textMuted },
            ]}>
              المتاحة {availableCount > 0 ? `(${availableCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading skeletons */}
      {loading && !refreshing && (
        <View style={styles.skeletonList}>
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </View>
      )}

      {/* Error */}
      {!loading && error && (
        <EmptyState
          icon={<PenTool size={32} color={colors.error} />}
          title="تعذر التحميل"
          subtitle={error}
          actionLabel="إعادة المحاولة"
          onAction={loadData}
        />
      )}

      {/* Exam list */}
      {!loading && !error && (
        <FlatList
          data={getFilteredExams()}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                activeTab === 'available'
                  ? <PenTool size={32} color={colors.accent} />
                  : <CheckCircle size={32} color={colors.success} />
              }
              title={activeTab === 'available' ? 'لا توجد اختبارات متاحة' : 'لا توجد اختبارات مكتملة'}
              subtitle={
                activeTab === 'available'
                  ? 'ستظهر الاختبارات المتاحة هنا عند إضافتها.'
                  : 'لم تُكمل أي اختبار حتى الآن.'
              }
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
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: hp,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: rf(TYPOGRAPHY.size.lg),
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  tabWrap: {
    paddingHorizontal: hp,
    paddingTop: rs(SPACING.md),
    paddingBottom: rs(SPACING.sm),
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 0.5,
    height: rs(44),
    overflow: 'hidden',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    borderRadius: RADIUS.md,
    zIndex: 0,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  skeletonList: {
    padding: hp,
    paddingTop: rs(SPACING.md),
  },
  list: {
    paddingHorizontal: hp,
    paddingTop: rs(SPACING.md),
    paddingBottom: rs(SPACING.xxxl),
  },
});

