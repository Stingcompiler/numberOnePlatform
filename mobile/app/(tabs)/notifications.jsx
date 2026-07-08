import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import { Bell, Check, Clock, Info, BookOpen, PenTool, Radio } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const { notifications, loading, loadNotifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handlePress = (item) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }
    
    // Navigate based on type
    if (item.notification_type === 'lecture') {
      router.push(`/courses/lesson/${item.related_object_id}`);
    } else if (item.notification_type === 'exam' || item.notification_type === 'result') {
      router.push(`/exams/${item.related_object_id}`);
    } else if (item.notification_type === 'live_podcast') {
      router.push(`/courses/${item.related_object_id}`);
    }
  };

  const getIcon = (type, color) => {
    switch(type) {
      case 'lecture': return <BookOpen size={20} color={color} />;
      case 'exam': 
      case 'result': return <PenTool size={20} color={color} />;
      case 'live_podcast': return <Radio size={20} color={color} />;
      default: return <Info size={20} color={color} />;
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = !item.is_read;
    const itemColor = isUnread ? colors.primary : colors.textMuted;
    const bg = isUnread ? (isDark ? '#1a233a' : '#f0f4ff') : colors.surface;
    
    // Format relative date (naive format)
    const date = new Date(item.created_at);
    const dateString = date.toLocaleDateString('ar-SA') + ' ' + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: bg, borderColor: isUnread ? `${colors.primary}30` : colors.border }]} 
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: `${itemColor}15` }]}>
          {getIcon(item.notification_type, itemColor)}
        </View>
        <View style={styles.contentBox}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: isUnread ? colors.text : colors.textSecondary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
          <View style={styles.timeRow}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{dateString}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الإشعارات</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Check size={16} color={colors.primary} />
            <Text style={[styles.markAllText, { color: colors.primary }]}>تحديد كـ مقروء</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={notifications}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Bell size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>لا توجد إشعارات</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                ستظهر التنبيهات والإعلانات الهامة هنا.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.bold,
    fontSize: 22,
  },
  markAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    padding: SPACING.xs,
  },
  markAllText: {
    fontFamily: TYPOGRAPHY.medium,
    fontSize: 12,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row-reverse',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBox: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontFamily: TYPOGRAPHY.bold,
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: SPACING.sm,
  },
  message: {
    fontFamily: TYPOGRAPHY.regular,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: TYPOGRAPHY.medium,
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.bold,
    fontSize: 18,
  },
  emptySub: {
    fontFamily: TYPOGRAPHY.regular,
    fontSize: 14,
    textAlign: 'center',
  },
});
