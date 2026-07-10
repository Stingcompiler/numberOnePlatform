/**
 * app/live-podcast.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * شاشة البث المباشر للطالب — نظام الغرف والجلسات الجديد
 *
 * الهيكل:
 *   الشاشة تعرض الغرف المتاحة للطالب
 *   كل غرفة تُوسَّع لعرض جلساتها
 *   كل جلسة تحتوي زر "دخول" يفتح الرابط خارج التطبيق
 *
 * الأمان:
 *   الـ API تُفلتر تلقائياً بناءً على system_type الطالب
 *   الطالب لا يرى غرفاً غير مخصصة له
 *
 * الإشعارات:
 *   تستمع لأحداث live_session من NotificationContext
 *   تحدّث القائمة تلقائياً عند وصول إشعار جديد
 * ──────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../src/contexts/ThemeContext';
import liveService from '../src/services/liveService';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../src/theme/tokens.js';
import {
  Radio,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Video,
  Monitor,
  Youtube,
  Wifi,
  Clock,
  Calendar,
  Play,
} from 'lucide-react-native';
import { rs, rf, hp } from '../src/utils/responsive';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = {
  zoom:        { label: 'Zoom',            Icon: Video   },
  google_meet: { label: 'Google Meet',     Icon: Monitor },
  teams:       { label: 'Microsoft Teams', Icon: Monitor },
  youtube:     { label: 'YouTube Live',    Icon: Youtube },
  other:       { label: 'أخرى',            Icon: Wifi    },
};

const STATUS_CONFIG = {
  upcoming: { label: 'قادمة',       color: '#4F87FF', pulse: false },
  live:     { label: 'مباشر الآن', color: '#22D3A8', pulse: true  },
  ended:    { label: 'انتهت',       color: '#4A5578', pulse: false },
  archived: { label: 'مؤرشفة',     color: '#4A5578', pulse: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonCard — بطاقة تحميل وهمية
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonCard({ colors }) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.skeletonCard, { backgroundColor: colors.surface, opacity: anim }]}>
      <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonLine, { width: '65%', backgroundColor: colors.border }]} />
        <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.border, height: 10 }]} />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — شارة حالة الجلسة
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, isDark }) {
  const cfg   = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!cfg.pulse) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [cfg.pulse]);

  return (
    <View style={[styles.badge, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}30` }]}>
      {cfg.pulse && (
        <Animated.View style={[styles.dot, { backgroundColor: cfg.color, opacity: pulse }]} />
      )}
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionCard — بطاقة جلسة واحدة
// ─────────────────────────────────────────────────────────────────────────────
function SessionCard({ session, colors, isDark }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prov  = PROVIDERS[session.provider] || PROVIDERS.other;
  const ProvIcon = prov.Icon;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ar-EG', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const handleOpen = async () => {
    const url = session.stream_url;
    if (!url) {
      Alert.alert('خطأ', 'لا يوجد رابط لهذه الجلسة.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('خطأ', 'لا يمكن فتح الرابط على هذا الجهاز.');
      }
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء فتح الرابط.');
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleOpen}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.sessionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
            ...SHADOWS.sm,
          },
        ]}
      >
        {/* Provider icon */}
        <LinearGradient
          colors={isDark ? ['#1A2A55', '#0F1629'] : ['#E8F0FF', '#F0F4FF']}
          style={styles.sessionIcon}
        >
          <ProvIcon size={rs(18)} color="#4F87FF" />
        </LinearGradient>

        {/* Session info */}
        <View style={styles.sessionInfo}>
          <Text style={[styles.sessionName, { color: colors.text }]} numberOfLines={2}>
            {session.session_name}
          </Text>
          <Text style={[styles.sessionProvider, { color: colors.textSecondary }]}>
            {prov.label}
          </Text>
          <View style={styles.sessionDates}>
            <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
              {formatDate(session.scheduled_start)}
            </Text>
            <Text style={[styles.sessionDate, { color: colors.textMuted }]}> — </Text>
            <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
              {formatDate(session.scheduled_end)}
            </Text>
          </View>
        </View>

        {/* Status + enter button */}
        <View style={styles.sessionRight}>
          <StatusBadge status={session.status} isDark={isDark} />
          <View style={[styles.enterBtn, { backgroundColor: 'rgba(79,135,255,0.12)' }]}>
            <ExternalLink size={rs(14)} color="#4F87FF" />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomCard — بطاقة الغرفة مع جلساتها (قابلة للطي)
// ─────────────────────────────────────────────────────────────────────────────
function RoomCard({ room, colors, isDark }) {
  const [expanded, setExpanded] = useState(true);
  const hasSession = room.sessions && room.sessions.length > 0;

  return (
    <View style={[styles.roomCard, { backgroundColor: colors.surfaceElevated || colors.surface, borderColor: colors.border }]}>
      {/* Room Header */}
      <TouchableOpacity
        style={styles.roomHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isDark ? ['#2D5AEB', '#6B4FFF'] : ['#4F87FF', '#6B9FFF']}
          style={styles.roomIconBg}
        >
          <Radio size={rs(16)} color="#fff" />
        </LinearGradient>

        <View style={styles.roomTitleBlock}>
          <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
            {room.room_name}
          </Text>
          <Text style={[styles.roomMeta, { color: colors.textSecondary }]}>
            {room.sessions?.length || 0} جلسة
            {room.room_type === 'online' ? ' · أونلاين' : ' · فلاش'}
          </Text>
        </View>

        {expanded
          ? <ChevronUp size={rs(16)} color={colors.textMuted} />
          : <ChevronDown size={rs(16)} color={colors.textMuted} />
        }
      </TouchableOpacity>

      {/* Sessions list */}
      {expanded && (
        <View style={styles.sessionsBlock}>
          {hasSession ? (
            room.sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                colors={colors}
                isDark={isDark}
              />
            ))
          ) : (
            <View style={styles.noSessions}>
              <Play size={rs(20)} color={colors.textMuted} />
              <Text style={[styles.noSessionsText, { color: colors.textMuted }]}>
                لا توجد جلسات في هذه الغرفة بعد
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ colors }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(79,135,255,0.10)' }]}>
        <Radio size={rs(32)} color="#4F87FF" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد جلسات بث متاحة</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        ستظهر هنا جلسات البث المباشر المخصصة لنظامك الدراسي عند إضافتها.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function LivePodcastScreen() {
  const { colors, isDark } = useTheme();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [rooms,      setRooms]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  // مستمع الإشعارات — لتحديث القائمة عند وصول إشعار live_session
  const notifListener = useRef(null);

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const data = await liveService.getMyLiveSessions();
      setRooms(data);
    } catch (e) {
      console.warn('[LivePodcastScreen] load error:', e);
      if (!silent) setError('تعذّر تحميل البث المباشر. يرجى التحقق من اتصالك.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // ── استماع لإشعارات live_session ─────────────────────────────────────
    // عند وصول إشعار جلسة جديدة → تحديث القائمة تلقائياً + إظهار Alert
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'live_session') {
        // تحديث صامت في الخلفية
        load(true);

        // إظهار تنبيه داخل التطبيق
        Alert.alert(
          '🔴 جلسة بث مباشر جديدة',
          notification.request.content.body || 'تم إضافة جلسة بث مباشر جديدة.',
          [{ text: 'حسناً', style: 'default' }]
        );
      }
    });

    return () => {
      if (notifListener.current) {
        Notifications.removeNotificationSubscription(notifListener.current);
      }
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalSessions = rooms.reduce((acc, r) => acc + (r.sessions?.length || 0), 0);
  const liveSessions  = rooms.reduce(
    (acc, r) => acc + (r.sessions?.filter(s => s.status === 'live').length || 0),
    0
  );

  // ─────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={rs(18)} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>البث المباشر</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {loading ? 'جاري التحميل...' : `${totalSessions} جلسة`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <RefreshCw size={rs(16)} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Hero Banner ── */}
      <LinearGradient
        colors={isDark ? ['#0D1A3A', '#080B14'] : ['#EEF2FF', '#F0F4FF']}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <LinearGradient colors={['#2D5AEB', '#6B4FFF']} style={styles.heroBadge}>
            <Radio size={rs(22)} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1, marginRight: SPACING.md }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>جلسات البث المباشر</Text>
            <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
              اضغط على زر «دخول» لفتح رابط البث في المتصفح
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'الغرف المتاحة',   value: rooms.length   },
            { label: 'إجمالي الجلسات', value: totalSessions   },
            { label: 'مباشرة الآن',    value: liveSessions    },
          ].map(stat => (
            <View
              key={stat.label}
              style={[styles.statChip, {
                backgroundColor: isDark ? 'rgba(79,135,255,0.10)' : 'rgba(45,90,235,0.07)'
              }]}
            >
              <Text style={[styles.statValue, { color: colors.accent }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.listPad}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <AlertCircle size={rs(28)} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); load(); }}
            style={[styles.retryBtn, { borderColor: colors.accent, backgroundColor: colors.accentMuted }]}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : rooms.length === 0 ? (
        <EmptyState colors={colors} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listPad}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {rooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hp,
    paddingBottom: rs(SPACING.md),
    borderBottomWidth: 0.5,
    gap: rs(SPACING.md),
  },
  iconBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: rf(TYPOGRAPHY.size.md),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 2,
    textAlign: 'center',
  },

  // Hero
  hero: {
    marginHorizontal: hp,
    marginTop: rs(SPACING.lg),
    borderRadius: RADIUS.xl,
    padding: rs(SPACING.lg),
    gap: rs(SPACING.md),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroBadge: {
    width: rs(48),
    height: rs(48),
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.accent,
  },
  heroTitle: {
    fontSize: rf(TYPOGRAPHY.size.md),
    fontWeight: '700',
    textAlign: 'right',
  },
  heroDesc: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    marginTop: 3,
    textAlign: 'right',
    lineHeight: rf(20),
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statChip: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: rf(TYPOGRAPHY.size.lg),
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },

  // List
  listPad: {
    paddingHorizontal: hp,
    paddingTop: rs(SPACING.lg),
    paddingBottom: rs(SPACING.huge),
    gap: rs(SPACING.md),
  },

  // Room Card
  roomCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(SPACING.md),
    gap: rs(SPACING.md),
  },
  roomIconBg: {
    width: rs(36),
    height: rs(36),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitleBlock: { flex: 1 },
  roomName: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
    textAlign: 'right',
  },
  roomMeta: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 2,
    textAlign: 'right',
  },
  sessionsBlock: {
    paddingHorizontal: rs(SPACING.md),
    paddingBottom: rs(SPACING.md),
    gap: rs(SPACING.sm),
  },

  // Session Card
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    padding: rs(SPACING.sm),
    gap: rs(SPACING.sm),
  },
  sessionIcon: {
    width: rs(42),
    height: rs(42),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: rf(18),
  },
  sessionProvider: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 2,
    textAlign: 'right',
  },
  sessionDates: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    marginTop: 3,
  },
  sessionDate: {
    fontSize: 9,
  },
  sessionRight: {
    alignItems: 'center',
    gap: rs(SPACING.xs),
    flexShrink: 0,
  },
  enterBtn: {
    width: rs(32),
    height: rs(32),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    borderWidth: 0.5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // No sessions
  noSessions: {
    alignItems: 'center',
    paddingVertical: rs(SPACING.lg),
    gap: rs(SPACING.sm),
  },
  noSessionsText: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    textAlign: 'center',
  },

  // Skeleton
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: rs(SPACING.md),
    gap: rs(SPACING.md),
    marginBottom: rs(SPACING.sm),
  },
  skeletonIcon: {
    width: rs(42),
    height: rs(42),
    borderRadius: RADIUS.md,
  },
  skeletonLine: {
    height: 12,
    borderRadius: RADIUS.xs,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(SPACING.xxl),
    gap: rs(SPACING.md),
  },
  emptyIconWrap: {
    width: rs(80),
    height: rs(80),
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(SPACING.sm),
  },
  emptyTitle: {
    fontSize: rf(TYPOGRAPHY.size.lg),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    textAlign: 'center',
    lineHeight: rf(22),
  },

  // Error
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(SPACING.md),
    paddingHorizontal: rs(SPACING.xxl),
  },
  errorText: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    textAlign: 'center',
    lineHeight: rf(22),
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: rs(SPACING.xl),
    paddingVertical: rs(SPACING.sm),
    marginTop: rs(SPACING.sm),
  },
  retryText: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
  },
});
