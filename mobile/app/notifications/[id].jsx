import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import Card from '../../src/components/Card';
import { SPACING, TYPOGRAPHY } from '../../src/theme/tokens';
import { ChevronRight, Bell } from 'lucide-react-native';

export default function NotificationDetails() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams();
  const { notifications } = useNotifications();
  const router = useRouter();

  const item = notifications.find(n => n.id.toString() === id);

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>تنبيه غير موجود.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تفاصيل التنبيه</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.notiCard}>
          <View style={styles.titleRow}>
            <Text style={[styles.notiTitle, { color: colors.text }]}>{item.title}</Text>
          </View>
          
          <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                إشعار عام
              </Text>
              <Bell size={12} color={colors.accent} style={styles.metaIcon} />
            </View>
          </View>

          <Text style={[styles.notiBody, { color: colors.textSecondary }]}>
            {item.content}
          </Text>
        </Card>
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
  notiCard: {
    padding: SPACING.lg,
  },
  titleRow: {
    marginBottom: SPACING.md,
  },
  notiTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: SPACING.md,
    marginBottom: SPACING.lg,
    borderBottomWidth: 1,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginLeft: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  notiBody: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#9ca3af',
    textAlign: 'right',
    lineHeight: 22,
  },
});
