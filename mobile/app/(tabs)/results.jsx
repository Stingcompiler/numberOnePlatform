import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import examService from '../../src/services/examService';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import ResultCard from '../../src/components/ui/ResultCard';
import EmptyState from '../../src/components/ui/EmptyState';
import { CardSkeleton } from '../../src/components/ui/SkeletonLoader';
import { Award, TrendingUp, CheckCircle } from 'lucide-react-native';

// ─── Summary stat cell ───────────────────────────────────────
function SummaryStat({ value, label, color }) {
  const { colors } = useTheme();
  return (
    <View style={summaryStyles.cell}>
      <Text style={[summaryStyles.value, { color: color || colors.accent }]}>{value}</Text>
      <Text style={[summaryStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 10, marginTop: 3, textAlign: 'center' },
});

export default function ResultsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    try {
      setError(null);
      const exams = await examService.getStudentExams();
      let allAttempts = [];
      (exams || []).forEach((exam) => {
        if (exam.attempts) {
          exam.attempts.forEach((att) => {
            allAttempts.push({
              ...att,
              exam_id: exam.id,
              exam_title: exam.title,
              exam_course: exam.course_name,
              exam_total_marks: exam.total_marks,
            });
          });
        }
      });
      allAttempts.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      setAttempts(allAttempts);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.log('Error loading results:', e);
      setError('تعذر تحميل النتائج. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalTaken = attempts.length;
  const passedCount = attempts.filter((a) => a.is_passed).length;
  const averagePercentage =
    totalTaken > 0
      ? attempts.reduce((acc, a) => acc + a.percentage, 0) / totalTaken
      : 0;
  const passRate = totalTaken > 0 ? (passedCount / totalTaken) * 100 : 0;

  const renderItem = ({ item }) => (
    <ResultCard
      attempt={item}
      onPress={() => router.push(`/results/${item.id}`)}
    />
  );

  const SummaryCard = () => (
    <View style={[styles.summaryCard, {
      backgroundColor: isDark ? '#0F1A35' : '#EEF2FF',
      borderColor: isDark ? 'rgba(79,135,255,0.15)' : 'rgba(45,90,235,0.12)',
    }]}>
      <View style={styles.summaryRow}>
        <SummaryStat
          value={`${averagePercentage.toFixed(1)}%`}
          label="متوسط الدرجات"
          color={colors.accent}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SummaryStat
          value={`${passedCount}/${totalTaken}`}
          label="ناجح / الكل"
          color={colors.success}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SummaryStat
          value={`${passRate.toFixed(0)}%`}
          label="نسبة النجاح"
          color={colors.warning}
        />
      </View>

      {/* Pass rate bar */}
      <View style={styles.passRateRow}>
        <View style={[styles.passRateBg, { backgroundColor: colors.border }]}>
          <View style={[styles.passRateFill, {
            backgroundColor: passRate >= 50 ? colors.success : colors.error,
            width: `${passRate}%`,
          }]} />
        </View>
        <Text style={[styles.passRateLabel, { color: colors.textMuted }]}>
          نسبة النجاح الإجمالية
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>نتائج الاختبارات</Text>
      </View>

      {/* Loading */}
      {loading && !refreshing && (
        <View style={styles.skeletonList}>
          <CardSkeleton />
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </View>
      )}

      {/* Error */}
      {!loading && error && (
        <EmptyState
          icon={<Award size={32} color={colors.error} />}
          title="تعذر التحميل"
          subtitle={error}
          actionLabel="إعادة المحاولة"
          onAction={loadData}
        />
      )}

      {/* Results list */}
      {!loading && !error && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={attempts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={totalTaken > 0 ? <SummaryCard /> : null}
            ListEmptyComponent={
              <EmptyState
                icon={<Award size={32} color={colors.accent} />}
                title="لا توجد نتائج بعد"
                subtitle="نتائج اختباراتك ستظهر هنا بعد إتمامها."
              />
            }
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginTop: Platform.OS === 'ios' ? 52 : 40,
    height: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  skeletonList: {
    padding: SPACING.lg,
  },
  list: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  // Summary Card
  summaryCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: SPACING.lg,
  },
  divider: {
    width: 1,
    height: 40,
  },
  passRateRow: {
    gap: SPACING.sm,
  },
  passRateBg: {
    height: 8,
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  passRateFill: {
    height: '100%',
    borderRadius: RADIUS.round,
  },
  passRateLabel: {
    fontSize: 10,
    textAlign: 'right',
  },
});
