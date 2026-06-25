import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import NotificationCard from '../../src/components/ui/NotificationCard';
import EmptyState from '../../src/components/ui/EmptyState';
import SkeletonLoader from '../../src/components/ui/SkeletonLoader';
import { Bell, ChevronRight, CheckCheck } from 'lucide-react-native';

export default function NotificationsIndex() {
  const { colors } = useTheme();
  const { notifications, loading, readIds, markAsRead, loadNotifications } = useNotifications();
  const router = useRouter();

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const handlePress = (item) => {
    markAsRead(item.id);
    router.push(`/notifications/${item.id}`);
  };

  const markAllRead = () => {
    notifications.forEach(n => markAsRead(n.id));
  };

  const renderItem = ({ item }) => {
    const isRead = readIds.includes(item.id);
    return (
      <NotificationCard
        item={item}
        isRead={isRead}
        onPress={() => handlePress(item)}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Unread count + mark all */}
        <View style={styles.headerCenter}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={[styles.markAllBtn, { backgroundColor: colors.accentMuted }]}
            >
              <CheckCheck size={14} color={colors.accent} />
              <Text style={[styles.markAllText, { color: colors.accent }]}>
                قراءة الكل
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>الإشعارات</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Loading skeletons */}
      {loading && (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[styles.notifSkeleton, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <SkeletonLoader width={40} height={40} radius={20} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonLoader width="65%" height={13} />
                <SkeletonLoader width="90%" height={10} />
                <SkeletonLoader width="45%" height={10} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty */}
      {!loading && notifications.length === 0 && (
        <EmptyState
          icon={<Bell size={32} color={colors.accent} />}
          title="لا توجد إشعارات"
          subtitle="لا توجد أي إشعارات أو تنبيهات حالياً."
        />
      )}

      {/* List */}
      {!loading && notifications.length > 0 && (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
  },
  markAllText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  skeletonList: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  notifSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    marginBottom: SPACING.sm,
  },
  list: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
});
