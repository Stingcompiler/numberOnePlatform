import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../theme/tokens';
import Button from './Button';
import { AlertCircle, Inbox } from 'lucide-react-native';

export const StatusView = ({
  loading = false,
  empty = false,
  error = null,
  emptyMessage = 'لا توجد بيانات متاحة حالياً.',
  errorMessage = 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.',
  onRetry,
}) => {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.text, { color: colors.textSecondary, marginTop: SPACING.md }]}>
          جاري التحميل...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <AlertCircle size={48} color={colors.error} style={styles.icon} />
        <Text style={[styles.title, { color: colors.text }]}>خطأ في الاتصال</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {typeof error === 'string' ? error : errorMessage}
        </Text>
        {onRetry && (
          <Button
            title="إعادة المحاولة"
            onPress={onRetry}
            style={styles.button}
            variant="outline"
          />
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.center}>
        <Inbox size={48} color={colors.textMuted} style={styles.icon} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  icon: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  text: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  button: {
    minWidth: 150,
  },
});

export default StatusView;
