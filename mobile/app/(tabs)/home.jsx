import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Animated, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import courseService from '../../src/services/courseService';
import examService from '../../src/services/examService';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import { StatCard, SectionHeader } from '../../src/components/ui/UIKit';
import EmptyState from '../../src/components/ui/EmptyState';
import SkeletonLoader, { CardSkeleton, StatRowSkeleton } from '../../src/components/ui/SkeletonLoader';
import ExamCard from '../../src/components/ui/ExamCard';
import NotificationCard from '../../src/components/ui/NotificationCard';
import {
  BookOpen, PenTool, Award, User,
  TrendingUp, Wallet, ChevronRight, Bell,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────
// Helper — get Arabic greeting based on time of day
// ─────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء النور';
}

// ─────────────────────────────────────────────────────────────
// Quick Action button
// ─────────────────────────────────────────────────────────────
function QuickAction({ icon, label, color, onPress }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      >
        <View style={[styles.qaIconWrap, { backgroundColor: `${color}18` }]}>
          {icon}
        </View>
        <Text style={[styles.qaLabel, { color: colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { notifications, loading: notifLoading, readIds, markAsRead, unreadCount } = useNotifications();
  const router = useRouter();

  // Slice latest 3 notifications to preview on home
  const recentNotifs = notifications.slice(0, 3);

  const [coursesCount, setCoursesCount] = useState(0);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [passedExams, setPassedExams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const profile = user?.student_profile || {};
  const greeting = getGreeting();

  // Fade-in animation for sections
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadDashboardData = async () => {
    try {
      const studentProfile = user?.student_profile || {};
      const courses = await courseService.getMyCourses(studentProfile);
      const studentSystemType = studentProfile.system_type || 'online';

      let filteredCourses = [];
      if (studentSystemType === 'online') {
        filteredCourses = (courses || []).filter(
          (course) =>
            course.system_type === 'online' &&
            course.grade === studentProfile.enrolled_grade_id
        );
      } else if (studentSystemType === 'flash') {
        filteredCourses = courses || [];
      }

      setCoursesCount(filteredCourses.length);

      const exams = await examService.getStudentExams();
      const allowedCourseIds = filteredCourses.map((c) => c.id);
      const filteredExams = (exams || []).filter((e) =>
        allowedCourseIds.includes(e.course_id)
      );

      const upcoming = filteredExams.filter((e) => (e.attempts || []).length === 0);
      setUpcomingExams(upcoming.slice(0, 3));

      const passedCount = filteredExams.reduce((acc, e) => {
        const hasPassed = (e.attempts || []).some((a) => a.is_passed);
        return hasPassed ? acc + 1 : acc;
      }, 0);
      setPassedExams(passedCount);
    } catch (e) {
      console.log('Error loading dashboard stats:', e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const balance = profile.balance
    ? `${parseFloat(profile.balance).toLocaleString('en-US')} ج.س`
    : '٠ ج.س';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Top App Bar ── */}
      <View style={[styles.appBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.appBarTitle, { color: colors.text }]}>لوحة التحكم</Text>
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
        {/* ── Hero / Welcome Card ── */}
        <View style={[styles.heroCard, {
          backgroundColor: isDark ? '#0F1A35' : '#EEF2FF',
          borderColor: isDark ? 'rgba(79,135,255,0.18)' : 'rgba(45,90,235,0.15)',
        }]}>
          {/* Decorative accent circle */}
          <View style={[styles.heroBg, { backgroundColor: `${colors.accent}08` }]} />

          <View style={styles.heroRow}>
            {/* Avatar */}
            <View style={[styles.avatarCircle, {
              backgroundColor: colors.accentMuted,
              borderColor: `${colors.accent}40`,
            }]}>
              <User size={26} color={colors.accent} />
            </View>

            {/* Text */}
            <View style={styles.heroText}>
              <Text style={[styles.greetingText, { color: colors.textMuted }]}>
                {greeting} 👋
              </Text>
              <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
                {user?.full_name || 'الطالب'}
              </Text>
              <Text style={[styles.gradeName, { color: colors.textSecondary }]}>
                {profile.enrolled_level_name && profile.enrolled_grade_name
                  ? `${profile.enrolled_level_name} • ${profile.enrolled_grade_name}`
                  : 'طالب معتمد'}
              </Text>
            </View>
          </View>

          {/* Balance pill */}
          <View style={[styles.balancePill, {
            backgroundColor: colors.successMuted,
            borderColor: `${colors.success}30`,
          }]}>
            <Wallet size={13} color={colors.success} />
            <Text style={[styles.balanceText, { color: colors.success }]}>{balance}</Text>
          </View>
        </View>

        {/* ── Stats Strip ── */}
        {loading ? (
          <StatRowSkeleton />
        ) : (
          <View style={styles.statsRow}>
            <StatCard
              icon={<BookOpen size={18} color={colors.accent} />}
              value={coursesCount}
              label="كورسات"
              iconBg={colors.accentMuted}
            />
            <StatCard
              icon={<Award size={18} color={colors.success} />}
              value={passedExams}
              label="ناجح"
              iconBg={colors.successMuted}
            />
            <StatCard
              icon={<TrendingUp size={18} color={colors.warning} />}
              value={upcomingExams.length}
              label="قادم"
              iconBg={colors.warningMuted}
            />
          </View>
        )}

        {/* ── Quick Actions ── */}
        <SectionHeader title="الوصول السريع" style={styles.sectionGap} />
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon={<BookOpen size={20} color={colors.accent} />}
            label="الكورسات"
            color={colors.accent}
            onPress={() => router.push('/(tabs)/courses')}
          />
          <QuickAction
            icon={<PenTool size={20} color={colors.warning} />}
            label="الاختبارات"
            color={colors.warning}
            onPress={() => router.push('/(tabs)/exams')}
          />
          <QuickAction
            icon={<Award size={20} color={colors.success} />}
            label="النتائج"
            color={colors.success}
            onPress={() => router.push('/(tabs)/results')}
          />
          <QuickAction
            icon={<Bell size={20} color={colors.info} />}
            label="الإشعارات"
            color={colors.info}
            onPress={() => router.push('/notifications/')}
          />
        </View>

        {/* ── Upcoming Exams ── */}
        <SectionHeader
          title="الاختبارات القادمة"
          actionLabel={upcomingExams.length > 0 ? 'عرض الكل' : undefined}
          onAction={upcomingExams.length > 0 ? () => router.push('/(tabs)/exams') : undefined}
          style={styles.sectionGap}
        />

        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : upcomingExams.length === 0 ? (
          <EmptyState
            icon={<PenTool size={28} color={colors.accent} />}
            title="لا توجد اختبارات قادمة"
            subtitle="اختباراتك القادمة ستظهر هنا عند إضافتها."
          />
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {upcomingExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isCompleted={false}
                latestAttempt={null}
                onPress={() => router.push(`/exams/${exam.id}`)}
              />
            ))}
          </Animated.View>
        )}

        {/* ── Recent Notifications ── */}
        <SectionHeader
          title="آخر الإشعارات"
          actionLabel={notifications.length > 0 ? 'عرض الكل' : undefined}
          onAction={notifications.length > 0 ? () => router.push('/notifications/') : undefined}
          style={styles.sectionGap}
        />

        {notifLoading ? (
          <>
            {[1, 2].map(i => (
              <View key={i} style={[styles.notifSkeleton, {
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
              }]}>
                <SkeletonLoader width={40} height={40} radius={20} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonLoader width="65%" height={13} />
                  <SkeletonLoader width="85%" height={10} />
                </View>
              </View>
            ))}
          </>
        ) : recentNotifs.length === 0 ? (
          <View style={[styles.notifEmptyBox, {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
          }]}>
            <Bell size={22} color={colors.textMuted} />
            <Text style={[styles.notifEmptyText, { color: colors.textMuted }]}>
              لا توجد إشعارات حالياً
            </Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {recentNotifs.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                isRead={readIds.includes(item.id)}
                onPress={() => {
                  markAsRead(item.id);
                  router.push(`/notifications/${item.id}`);
                }}
              />
            ))}
            {notifications.length > 3 && (
              <TouchableOpacity
                onPress={() => router.push('/notifications/')}
                activeOpacity={0.8}
                style={[styles.viewAllBtn, {
                  backgroundColor: colors.accentMuted,
                  borderColor: `${colors.accent}30`,
                }]}
              >
                <Text style={[styles.viewAllText, { color: colors.accent }]}>
                  عرض جميع الإشعارات ({notifications.length})
                </Text>
                <ChevronRight size={15} color={colors.accent} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // App Bar
  appBar: {
    marginTop: Platform.OS === 'ios' ? 52 : 40,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 0.5,
  },
  appBarTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  // Scroll
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },

  // Hero Card
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.md,
  },
  heroBg: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  heroRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  greetingText: {
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: 2,
  },
  studentName: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
  },
  gradeName: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
    textAlign: 'right',
  },
  balancePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },
  balanceText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  quickAction: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    minWidth: '20%',
    ...SHADOWS.sm,
  },
  qaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  qaLabel: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.weight.medium,
  },

  // Sections
  sectionGap: {
    marginBottom: SPACING.md,
  },

  bottomSpacer: {
    height: SPACING.xxl,
  },

  // Notifications section
  notifSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    marginBottom: SPACING.sm,
  },
  notifEmptyBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    marginBottom: SPACING.sm,
  },
  notifEmptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'right',
  },
  viewAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  viewAllText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
});
