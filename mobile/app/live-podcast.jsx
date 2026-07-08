/**
 * app/live-podcast.jsx
 * ──────────────────────────────────────────────────────────────
 * شاشة البودكاست المباشر للطالب
 * تعرض جميع جلسات Zoom / البث المباشر المتاحة وفق صلاحيات الطالب.
 * عند الضغط على بودكاست → يُفتح الرابط في المتصفح مباشرةً.
 * ──────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Animated,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/contexts/ThemeContext';
import podcastService from '../src/services/podcastService';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../src/theme/tokens.js';
import {
  Radio,
  ChevronRight,
  ExternalLink,
  Search,
  X,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader,
} from 'lucide-react-native';
import { rs, rf, hp } from '../src/utils/responsive';

// ─────────────────────────────────────────────────────────
// SkeletonCard — loading placeholder
// ─────────────────────────────────────────────────────────
function SkeletonCard({ colors }) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.podcastCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
          opacity: anim,
        },
      ]}
    >
      <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
      <View style={styles.skeletonTextBlock}>
        <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.border }]} />
        <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.border, marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────
// PodcastCard — single session row
// ─────────────────────────────────────────────────────────
function PodcastCard({ item, colors, isDark, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.podcastCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
            ...SHADOWS.md,
            shadowColor: isDark ? '#4F87FF' : '#000',
            shadowOpacity: isDark ? 0.12 : 0.06,
          },
        ]}
      >
        {/* Live icon + pulse */}
        <View style={styles.iconCol}>
          <LinearGradient
            colors={isDark ? ['#1A2A55', '#0F1629'] : ['#E8F0FF', '#F0F4FF']}
            style={styles.iconCircle}
          >
            <Radio size={20} color="#4F87FF" />
          </LinearGradient>
          {/* Live badge */}
          <View style={[styles.liveBadge, { backgroundColor: isDark ? 'rgba(34,211,168,0.12)' : 'rgba(5,150,105,0.10)' }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveBadgeText, { color: isDark ? '#22D3A8' : '#059669' }]}>مباشر</Text>
          </View>
        </View>

        {/* Text content */}
        <View style={styles.textCol}>
          <Text
            style={[styles.podcastTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.live_podcast_title || item.title}
          </Text>
          <Text
            style={[styles.podcastSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.course_name}
            {item.unit_name ? ` • ${item.unit_name}` : ''}
          </Text>
        </View>

        {/* Arrow */}
        <View style={[styles.arrowBtn, { backgroundColor: 'rgba(79,135,255,0.10)' }]}>
          <ExternalLink size={16} color="#4F87FF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────
function EmptyState({ colors, search }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: 'rgba(79,135,255,0.10)' }]}>
        <Radio size={32} color="#4F87FF" />
      </View>
      {search ? (
        <>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد نتائج</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            لا يوجد بودكاست يطابق «{search}»
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد جلسات مباشرة</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            ستظهر هنا جلسات Zoom والبث المباشر المرتبطة بكورساتك.
          </Text>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────
export default function LivePodcastScreen() {
  const { colors, isDark } = useTheme();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [podcasts, setPodcasts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');

  // ── Fetch ──────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await podcastService.getMyLivePodcasts();
      setPodcasts(data);
    } catch (e) {
      console.warn('LivePodcastScreen load error:', e);
      setError('تعذّر تحميل البودكاست. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Open URL ───────────────────────────────────────────
  const handleOpen = async (item) => {
    const url = item.live_podcast_url;
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('خطأ', 'لا يمكن فتح الرابط على هذا الجهاز.');
      }
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء فتح الرابط.');
    }
  };

  // ── Filter ─────────────────────────────────────────────
  const filtered = podcasts.filter(p =>
    !search ||
    (p.live_podcast_title || p.title || '').includes(search) ||
    (p.course_name || '').includes(search) ||
    (p.unit_name   || '').includes(search)
  );

  // ─────────────────────────────────────────────────────
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
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>البودكاست المباشر</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {loading ? 'جاري التحميل...' : `${filtered.length} جلسة`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <RefreshCw size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Hero Banner ── */}
      <LinearGradient
        colors={isDark ? ['#0D1A3A', '#080B14'] : ['#EEF2FF', '#F0F4FF']}
        style={styles.heroBanner}
      >
        <View style={styles.heroRow}>
          <LinearGradient colors={['#2D5AEB', '#6B4FFF']} style={styles.heroBadge}>
            <Radio size={22} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1, marginRight: SPACING.md }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              جلسات Zoom المباشرة
            </Text>
            <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
              اضغط على أي جلسة لفتح رابط البث مباشرةً في المتصفح
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'الجلسات المتاحة', value: podcasts.length },
            { label: 'الكورسات المشاركة', value: [...new Set(podcasts.map(p => p.course_id))].length },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[styles.statChip, { backgroundColor: isDark ? 'rgba(79,135,255,0.10)' : 'rgba(45,90,235,0.07)' }]}
            >
              <Text style={[styles.statValue, { color: colors.accent }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Search Bar ── */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث عن بودكاست أو كورس..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={15} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <AlertCircle size={28} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); load(); }}
            style={[styles.retryBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <PodcastCard
              item={item}
              colors={colors}
              isDark={isDark}
              onPress={() => handleOpen(item)}
            />
          )}
          ListEmptyComponent={<EmptyState colors={colors} search={search} />}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && { flex: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hp,
    paddingBottom: rs(SPACING.md),
    borderBottomWidth: 0.5,
    gap: rs(SPACING.md),
  },
  backBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
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

  // Hero banner
  heroBanner: {
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
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.accent,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  heroDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: 3,
    textAlign: 'right',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statChip: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
    textAlign: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: hp,
    marginTop: rs(SPACING.lg),
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    paddingHorizontal: rs(SPACING.md),
    paddingVertical: Platform.OS === 'ios' ? rs(SPACING.md) : rs(SPACING.sm),
    gap: rs(SPACING.sm),
  },
  searchInput: {
    flex: 1,
    fontSize: rf(TYPOGRAPHY.size.sm),
    padding: 0,
  },

  // List
  listContent: {
    paddingHorizontal: hp,
    paddingTop: rs(SPACING.md),
    paddingBottom: rs(SPACING.huge),
    gap: rs(SPACING.sm),
  },

  // Podcast card
  podcastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    padding: rs(SPACING.md),
    gap: rs(SPACING.md),
  },
  iconCol: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconCircle: {
    width: rs(48),
    height: rs(48),
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22D3A8',
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  textCol: {
    flex: 1,
  },
  podcastTitle: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: rf(20),
  },
  podcastSubtitle: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    marginTop: 3,
    textAlign: 'right',
  },
  arrowBtn: {
    width: rs(34),
    height: rs(34),
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skeleton
  skeletonIcon: {
    width: rs(48),
    height: rs(48),
    borderRadius: RADIUS.lg,
  },
  skeletonTextBlock: {
    flex: 1,
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
  emptyIcon: {
    width: rs(72),
    height: rs(72),
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

