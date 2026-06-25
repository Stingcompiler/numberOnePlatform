import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import examService from '../../src/services/examService';
import courseService from '../../src/services/courseService';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import StatusView from '../../src/components/StatusView';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import { ChevronRight, Clock, Award, FileQuestion, ShieldAlert } from 'lucide-react-native';

export default function ExamIntroScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      const studentProfile = user?.student_profile || {};
      const [examData, coursesData] = await Promise.all([
        examService.getStudentExamDetails(id),
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

      const allowedCourseIds = filteredCourses.map(c => c.id);

      if (examData && !allowedCourseIds.includes(examData.course)) {
        setError('الاختبار غير موجود أو ليس لديك صلاحية الوصول إليه.');
      } else {
        setExam(examData);
      }
    } catch (e) {
      console.log('Error loading exam details:', e);
      if (e.response && e.response.status === 403) {
        setError(e.response.data?.detail || 'ليس لديك صلاحية الوصول لهذا الاختبار.');
      } else {
        setError('تعذر تحميل تفاصيل الاختبار. يرجى التحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusView loading={true} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusView error={error} onRetry={loadData} />
      </View>
    );
  }

  if (!exam) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>الاختبار غير موجود.</Text>
      </View>
    );
  }

  const handleStartExam = () => {
    router.replace({
      pathname: '/exams/attempt',
      params: { examId: id }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          تفاصيل الاختبار
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title Card */}
        <Card style={styles.introCard}>
          <Text style={[styles.examTitle, { color: colors.text }]}>{exam.title}</Text>
          <Text style={[styles.courseName, { color: colors.accent }]}>
            المادة: {exam.course_name}
          </Text>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statBox}>
            <Clock size={24} color={colors.accent} style={styles.statIcon} />
            <Text style={[styles.statValue, { color: colors.text }]}>{exam.duration_minutes} دقيقة</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>مدة الاختبار</Text>
          </Card>

          <Card style={styles.statBox}>
            <Award size={24} color={colors.success} style={styles.statIcon} />
            <Text style={[styles.statValue, { color: colors.text }]}>{exam.passing_score} / {exam.total_marks}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>درجة النجاح</Text>
          </Card>

          <Card style={styles.statBox}>
            <FileQuestion size={24} color={colors.textSecondary} style={styles.statIcon} />
            <Text style={[styles.statValue, { color: colors.text }]}>{exam.question_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>عدد الأسئلة</Text>
          </Card>
        </View>

        {/* Exam Regulations & Warn instructions */}
        <Card style={[styles.warningCard, { borderColor: colors.warning }]}>
          <View style={styles.warningHeader}>
            <ShieldAlert size={20} color={colors.warning} style={{ marginLeft: SPACING.xs }} />
            <Text style={[styles.warningTitle, { color: colors.warning }]}>توجيهات وتعليمات هامة</Text>
          </View>
          <View style={styles.warningList}>
            <Text style={[styles.warningItem, { color: colors.textSecondary }]}>
              • بمجرد النقر على "ابدأ الاختبار" سيبدأ احتساب وقت المحاولة تلقائياً.
            </Text>
            <Text style={[styles.warningItem, { color: colors.textSecondary }]}>
              • يرجى عدم إغلاق التطبيق أو الانتقال إلى تطبيقات أخرى أثناء الاختبار لعدم إلغاء المحاولة.
            </Text>
            <Text style={[styles.warningItem, { color: colors.textSecondary }]}>
              • تأكد من استقرار اتصالك بالإنترنت قبل بدء المحاولة.
            </Text>
            <Text style={[styles.warningItem, { color: colors.textSecondary }]}>
              • بمجرد انتهاء الوقت المخصص، سيتم إرسال إجاباتك الحالية تلقائياً للمصحح.
            </Text>
          </View>
        </Card>

        {/* Start Button */}
        <Button
          title="ابدأ الاختبار الآن"
          onPress={handleStartExam}
          style={styles.startBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 60,
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1.5,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  introCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  examTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  courseName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
  },
  statIcon: {
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  warningCard: {
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  warningHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  warningTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  warningList: {
    gap: SPACING.xs,
  },
  warningItem: {
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 18,
    textAlign: 'right',
  },
  startBtn: {
    marginBottom: SPACING.xxl,
  },
});
