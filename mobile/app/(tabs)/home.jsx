/**
 * app/(tabs)/home.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Home Screen — Number One Student App
 *
 * Changes:
 *  • Responsive layout via `responsive.js` utilities (rs, rf, hp, isTablet, COLS)
 *  • Quick actions grid: 4 columns on phone, 6 on tablet — every action wired
 *  • Added: Profile, Lectures quick actions
 *  • Stat cards are tappable (navigate to correct tab)
 *  • SectionHeader "عرض الكل" actions all wired
 *  • Live Podcast banner only shown when sessions exist
 *  • All navigation uses correct Expo Router paths
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
import liveService from '../../src/services/liveService';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import { StatCard, SectionHeader } from '../../src/components/ui/UIKit';
import EmptyState from '../../src/components/ui/EmptyState';
import SkeletonLoader, { CardSkeleton, StatRowSkeleton } from '../../src/components/ui/SkeletonLoader';
import ExamCard from '../../src/components/ui/ExamCard';
import NotificationCard from '../../src/components/ui/NotificationCard';
import {
  BookOpen, PenTool, Award, User,
  TrendingUp, Wallet, ChevronRight, Bell, Radio,
  Play,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  rs, rf, hp, isTablet, COLS, SCREEN_WIDTH,
} from '../../src/utils/responsive';

// ─── Greeting helper ──────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء النور';
}

// ─── Quick Action button ──────────────────────────────────────
// Each item in a flex-wrap row takes (100% - gaps) / numCols width.
function QuickAction({ icon, label, color, onPress, itemWidth }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], width: itemWidth }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[
          styles.quickAction,
          { backgroundColor: colors.surface, borderColor: colors.cardBorder },
        ]}
      >
        <View style={[styles.qaIconWrap, { backgroundColor: `${color}18` }]}>
          {icon}
        </View>
        <Text style={[styles.qaLabel, { color: colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Tappable StatCard wrapper ────────────────────────────────
function TapStatCard({ icon, value, label, iconBg, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{ flex: 1 }}>
      <StatCard icon={icon} value={value} label={label} iconBg={iconBg} style={{ flex: 1 }} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function HomeScreen() {
  const { user }    = useAuth();
  const { colors, isDark } = useTheme();
  const { notifications, loading: notifLoading, readIds, markAsRead } = useNotifications();
  const router      = useRouter();

  const recentNotifs = notifications.slice(0, 3);

  const [coursesCount, setCoursesCount]   = useState(0);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [passedExams, setPassedExams]     = useState(0);
  const [livePodcasts, setLivePodcasts]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const profile  = user?.student_profile || {};
  const greeting = getGreeting();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadDashboardData = async () => {
    try {
      const studentProfile   = user?.student_profile || {};
      const courses          = await courseService.getMyCourses(studentProfile);
      const studentSystemType = studentProfile.system_type || 'online';

      let filteredCourses = [];
      if (studentSystemType === 'online') {
        filteredCourses = (courses || []).filter(
          (c) => c.system_type === 'online' && c.grade === studentProfile.enrolled_grade_id
        );
      } else if (studentSystemType === 'flash') {
        filteredCourses = courses || [];
      }

      setCoursesCount(filteredCourses.length);

      const exams            = await examService.getStudentExams();
      const allowedCourseIds = filteredCourses.map((c) => c.id);
      const filteredExams    = (exams || []).filter((e) => allowedCourseIds.includes(e.course_id));

      setUpcomingExams(filteredExams.filter((e) => (e.attempts || []).length === 0).slice(0, 3));

      const passedCount = filteredExams.reduce((acc, e) => {
        return (e.attempts || []).some((a) => a.is_passed) ? acc + 1 : acc;
      }, 0);
      setPassedExams(passedCount);

      // ── Live Sessions (non-critical) ──
      try {
        const rooms = await liveService.getMyLiveSessions();
        // تجميع جميع الجلسات من جميع الغرف
        const allSessions = rooms.flatMap(r => r.sessions || []);
        setLivePodcasts(allSessions);
      } catch { /* silently ignore */ }

    } catch (e) {
      console.log('Home: error loading dashboard stats', e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  useEffect(() => { loadDashboardData(); }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const balance = profile.balance
    ? `${parseFloat(profile.balance).toLocaleString('en-US')} ج.س`
    : '٠ ج.س';

  // ── Quick actions definition ──────────────────────────────
  const NUM_COLS    = COLS.quickActions; // 4 phone / 6 tablet
  const GAP         = rs(SPACING.sm);
  const gridPadding = hp;
  // Width of each action cell = (available width - all gaps) / cols
  const ITEM_W = (SCREEN_WIDTH - gridPadding * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

  const quickActions = [
    {
      label: 'الكورسات',
      icon:  <BookOpen size={rf(20)} color={colors.accent} />,
      color: colors.accent,
      route: '/(tabs)/courses',
    },
    {
      label: 'المحاضرات',
      icon:  <Play size={rf(20)} color="#A78BFA" />,
      color: '#A78BFA',
      route: '/(tabs)/courses',  // Lessons are nested inside courses
    },
    {
      label: 'الاختبارات',
      icon:  <PenTool size={rf(20)} color={colors.warning} />,
      color: colors.warning,
      route: '/(tabs)/exams',
    },
    {
      label: 'النتائج',
      icon:  <Award size={rf(20)} color={colors.success} />,
      color: colors.success,
      route: '/(tabs)/results',
    },
    {
      label: 'الإشعارات',
      icon:  <Bell size={rf(20)} color={colors.info} />,
      color: colors.info,
      route: '/notifications/',
    },
    {
      label: 'مباشر',
      icon:  <Radio size={rf(20)} color="#22D3A8" />,
      color: '#22D3A8',
      route: '/live-podcast',
    },
    {
      label: 'حسابي',
      icon:  <User size={rf(20)} color="#F59E0B" />,
      color: '#F59E0B',
      route: '/(tabs)/profile',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Top App Bar ── */}
      <View style={[styles.appBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.appBarAvatar, { backgroundColor: colors.accentMuted, borderColor: `${colors.accent}40` }]}
        >
          <User size={rf(18)} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { color: colors.text }]}>لوحة التحكم</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: hp }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* ── Hero / Welcome Card ── */}
        <View style={[styles.heroCard, {
          backgroundColor: isDark ? '#0F1A35' : '#EEF2FF',
          borderColor: isDark ? 'rgba(79,135,255,0.18)' : 'rgba(45,90,235,0.15)',
        }]}>
          <View style={[styles.heroBg, { backgroundColor: `${colors.accent}08` }]} />

          <View style={styles.heroRow}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={[styles.avatarCircle, {
                backgroundColor: colors.accentMuted,
                borderColor: `${colors.accent}40`,
              }]}
            >
              <User size={rs(26)} color={colors.accent} />
            </TouchableOpacity>

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

          <View style={[styles.balancePill, {
            backgroundColor: colors.successMuted,
            borderColor: `${colors.success}30`,
          }]}>
            <Wallet size={rf(13)} color={colors.success} />
            <Text style={[styles.balanceText, { color: colors.success }]}>{balance}</Text>
          </View>
        </View>

        {/* ── Stats Strip (tappable) ── */}
        {loading ? (
          <StatRowSkeleton />
        ) : (
          <View style={styles.statsRow}>
            <TapStatCard
              icon={<BookOpen size={rf(18)} color={colors.accent} />}
              value={coursesCount}
              label="كورسات"
              iconBg={colors.accentMuted}
              onPress={() => router.push('/(tabs)/courses')}
            />
            <TapStatCard
              icon={<Award size={rf(18)} color={colors.success} />}
              value={passedExams}
              label="ناجح"
              iconBg={colors.successMuted}
              onPress={() => router.push('/(tabs)/results')}
            />
            <TapStatCard
              icon={<TrendingUp size={rf(18)} color={colors.warning} />}
              value={upcomingExams.length}
              label="قادم"
              iconBg={colors.warningMuted}
              onPress={() => router.push('/(tabs)/exams')}
            />
          </View>
        )}

        {/* ── Quick Actions ── */}
        <SectionHeader title="الوصول السريع" style={styles.sectionGap} />
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickAction
              key={action.label}
              icon={action.icon}
              label={action.label}
              color={action.color}
              itemWidth={ITEM_W}
              onPress={() => router.push(action.route)}
            />
          ))}
        </View>

        {/* ── Live Podcast Banner — only when sessions exist ── */}
        {!loading && livePodcasts.length > 0 && (
          <>
            <SectionHeader title="البث المباشر" style={styles.sectionGap} />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/live-podcast')}
              style={{ marginBottom: rs(SPACING.lg) }}
            >
              <LinearGradient
                colors={isDark ? ['#0D1E45', '#0A1228'] : ['#EEF4FF', '#E8F0FF']}
                style={[
                  styles.podcastBanner,
                  { borderColor: isDark ? 'rgba(79,135,255,0.18)' : 'rgba(45,90,235,0.15)' },
                ]}
              >
                <LinearGradient colors={['#2D5AEB', '#6B4FFF']} style={styles.podcastBannerIcon}>
                  <Radio size={rf(22)} color="#fff" />
                </LinearGradient>
                <View style={styles.podcastBannerText}>
                  <Text style={[styles.podcastBannerTitle, { color: colors.text }]}>
                    {livePodcasts.length} جلسة مباشرة متاحة
                  </Text>
                  <Text style={[styles.podcastBannerSub, { color: colors.textSecondary }]}>
                    اضغط لعرض جلسات Zoom والبث المباشر
                  </Text>
                </View>
                <View style={[styles.podcastBannerArrow, { backgroundColor: 'rgba(79,135,255,0.12)' }]}>
                  <ChevronRight size={rf(18)} color="#4F87FF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

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
            icon={<PenTool size={rf(28)} color={colors.accent} />}
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
            {[1, 2].map((i) => (
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
            <Bell size={rf(22)} color={colors.textMuted} />
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
                <ChevronRight size={rf(15)} color={colors.accent} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

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
    height: rs(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hp,
    borderBottomWidth: 0.5,
  },
  appBarTitle: {
    fontSize: rf(18),
    fontWeight: '700',
  },
  appBarAvatar: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: {
    paddingTop: rs(SPACING.xl),
    paddingBottom: rs(SPACING.huge),
  },

  // Hero Card
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: rs(SPACING.lg),
    marginBottom: rs(SPACING.lg),
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.md,
  },
  heroBg: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: rs(140),
    height: rs(140),
    borderRadius: rs(70),
  },
  heroRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: rs(SPACING.md),
    marginBottom: rs(SPACING.md),
  },
  avatarCircle: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
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
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginBottom: 2,
  },
  studentName: {
    fontSize: rf(TYPOGRAPHY.size.md),
    fontWeight: '700',
    textAlign: 'right',
  },
  gradeName: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 2,
    textAlign: 'right',
  },
  balancePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: rs(SPACING.md),
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },
  balanceText: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    fontWeight: '700',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: rs(SPACING.md),
    marginBottom: rs(SPACING.lg),
  },

  // Quick actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(SPACING.sm),
    marginBottom: rs(SPACING.lg),
  },
  quickAction: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    paddingVertical: rs(SPACING.md),
    paddingHorizontal: rs(SPACING.xs),
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  qaIconWrap: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  qaLabel: {
    fontSize: rf(10),
    textAlign: 'center',
    fontWeight: '500',
  },

  // Sections
  sectionGap: {
    marginBottom: rs(SPACING.md),
  },

  bottomSpacer: {
    height: rs(SPACING.xxl),
  },

  // Live Podcast Banner
  podcastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(SPACING.md),
    padding: rs(SPACING.md),
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...SHADOWS.md,
  },
  podcastBannerIcon: {
    width: rs(50),
    height: rs(50),
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  podcastBannerText: {
    flex: 1,
  },
  podcastBannerTitle: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
    textAlign: 'right',
  },
  podcastBannerSub: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 3,
    textAlign: 'right',
  },
  podcastBannerArrow: {
    width: rs(34),
    height: rs(34),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notifications
  notifSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(SPACING.md),
    padding: rs(SPACING.md),
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    marginBottom: rs(SPACING.sm),
  },
  notifEmptyBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: rs(SPACING.md),
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    marginBottom: rs(SPACING.sm),
  },
  notifEmptyText: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    textAlign: 'right',
  },
  viewAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: rs(SPACING.sm),
    paddingHorizontal: rs(SPACING.md),
    borderRadius: RADIUS.card,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  viewAllText: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
  },
});
