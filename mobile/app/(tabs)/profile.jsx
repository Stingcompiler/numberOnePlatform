import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Alert, Platform, Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import Card from '../../src/components/Card';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../../src/theme/tokens';
import {
  User, Phone, MapPin, Shield, CheckCircle, Wallet,
  Smartphone, Calendar, FileText, Copy, LogOut,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────
// ProfileRow — RTL: [value (left, truncated)] ... [label | ICON (right)]
// ─────────────────────────────────────────────────────────────
function ProfileRow({ icon, label, value, onPress, isLast }) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: isLast ? 'transparent' : colors.border,
          borderBottomWidth: isLast ? 0 : 0.5,
        },
      ]}
    >
      {/* LEFT side — value, truncated */}
      <Text
        style={[styles.rowValue, { color: colors.textSecondary }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value || '—'}
      </Text>

      {/* RIGHT side — label + icon (icon is the absolute rightmost) */}
      <View style={styles.rowRight}>
        <Text
          style={[styles.rowLabel, { color: colors.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View style={[styles.iconBox, { backgroundColor: colors.accentMuted }]}>
          {icon}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ─────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, {
        backgroundColor: colors.surface,
        borderColor: colors.cardBorder,
      }]}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const profile = user?.student_profile || {};

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleCopyDeviceId = () => {
    if (profile.device_id) {
      try { Clipboard.setString(profile.device_id); } catch { }
      Alert.alert('تم النسخ', 'تم نسخ معرّف الجهاز إلى الحافظة.');
    }
  };

  const getSystemTypeText = (type) => {
    if (type === 'online') return 'عبر الإنترنت';
    if (type === 'flash') return 'بدون إنترنت (فلاش)';
    return type || 'غير محدد';
  };

  const truncateDeviceId = (id) => {
    if (!id) return 'غير مربوط';
    if (id.length <= 18) return id;
    return `${id.substring(0, 9)}...${id.substring(id.length - 9)}`;
  };

  const supervisorText =
    !profile.supervisor_name || profile.supervisor_name.trim() === 'غير محدد'
      ? 'توزيع إداري تلقائي'
      : profile.supervisor_name;

  const balanceText = profile.balance
    ? `${parseFloat(profile.balance).toLocaleString('en-US')} ج.س`
    : '٠.٠٠ ج.س';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Bar */}
      <View style={[styles.appBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.appBarTitle, { color: colors.text }]}>حسابي الشخصي</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar Hero ── */}
        <View style={[styles.heroCard, {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        }]}>
          <View style={[styles.avatarRing, {
            backgroundColor: colors.accentMuted,
            borderColor: `${colors.accent}40`,
          }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <User size={40} color={colors.accent} />
            )}
          </View>
          <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
            {user?.full_name || '—'}
          </Text>
          <View style={[styles.rolePill, { backgroundColor: colors.accentMuted }]}>
            <Text style={[styles.roleText, { color: colors.accent }]}>طالب معتمد</Text>
          </View>
          <View style={[styles.balancePill, { backgroundColor: colors.successMuted }]}>
            <Wallet size={12} color={colors.success} />
            <Text style={[styles.balanceText, { color: colors.success }]}>{balanceText}</Text>
          </View>
        </View>

        {/* ── Academic Info ── */}
        <Section title="البيانات الأكاديمية">
          <ProfileRow
            icon={<Shield size={16} color={colors.accent} />}
            label="المرحلة الدراسية"
            value={profile.enrolled_level_name}
          />
          <ProfileRow
            icon={<CheckCircle size={16} color={colors.accent} />}
            label="الصف الدراسي"
            value={profile.enrolled_grade_name}
          />
          <ProfileRow
            icon={<User size={16} color={colors.accent} />}
            label="المشرفة المسؤولة"
            value={supervisorText}
          />
          <ProfileRow
            icon={<CheckCircle size={16} color={colors.accent} />}
            label="نوع الاشتراك"
            value={getSystemTypeText(profile.system_type)}
            isLast
          />
        </Section>

        {/* ── Contact Info ── */}
        <Section title="بيانات الاتصال وولي الأمر">
          <ProfileRow
            icon={<Phone size={16} color={colors.accent} />}
            label="هاتف الطالب"
            value={user?.phone}
          />
          <ProfileRow
            icon={<User size={16} color={colors.accent} />}
            label="ولي الأمر"
            value={profile.guardian_name}
          />
          <ProfileRow
            icon={<Phone size={16} color={colors.accent} />}
            label="هاتف ولي الأمر"
            value={profile.guardian_phone}
          />
          <ProfileRow
            icon={<MapPin size={16} color={colors.accent} />}
            label="عنوان السكن"
            value={profile.address}
            isLast
          />
        </Section>

        {/* ── Financial & Technical ── */}
        <Section title="البيانات المالية والتقنية">
          <ProfileRow
            icon={<Wallet size={16} color={colors.accent} />}
            label="الرصيد المتبقي"
            value={balanceText}
          />
          {/* Device ID — special row with copy button */}
          <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: 0.5 }]}>
            <View style={styles.deviceValueRow}>
              <Text
                style={[styles.rowValue, { color: colors.textSecondary, flex: 0 }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {truncateDeviceId(profile.device_id)}
              </Text>
              {profile.device_id && (
                <TouchableOpacity
                  onPress={handleCopyDeviceId}
                  activeOpacity={0.7}
                  style={[styles.copyBtn, { backgroundColor: colors.accentMuted }]}
                >
                  <Copy size={13} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>معرّف الجهاز</Text>
              <View style={[styles.iconBox, { backgroundColor: colors.accentMuted }]}>
                <Smartphone size={16} color={colors.accent} />
              </View>
            </View>
          </View>
          {profile.device_type && (
            <ProfileRow
              icon={<Smartphone size={16} color={colors.accent} />}
              label="نوع الجهاز"
              value={profile.device_type}
            />
          )}
          <ProfileRow
            icon={<Calendar size={16} color={colors.accent} />}
            label="تاريخ التسجيل"
            value={
              profile.registered_at
                ? new Date(profile.registered_at).toLocaleDateString('ar-EG')
                : '—'
            }
          />
          {profile.notes && (
            <ProfileRow
              icon={<FileText size={16} color={colors.accent} />}
              label="ملاحظات الإدارة"
              value={profile.notes}
              isLast
            />
          )}
        </Section>

        {/* ── Logout ── */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={[styles.logoutBtn, {
            borderColor: colors.error,
            backgroundColor: colors.errorMuted,
          }]}
        >
          <LogOut size={18} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>
            تسجيل الخروج من الحساب
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // App bar
  appBar: {
    marginTop: Platform.OS === 'ios' ? 52 : 40,
    height: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 0.5,
  },
  appBarTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },

  // ── Hero card
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  avatarImg: { width: '100%', height: '100%' },
  heroName: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  rolePill: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    marginBottom: SPACING.sm,
  },
  roleText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
  },
  balanceText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  // ── Section
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    borderRadius: RADIUS.card,
    borderWidth: 0.5,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },

  // ── Profile Row
  row: {
    flexDirection: 'row',          // LTR base: value LEFT, label+icon RIGHT
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  // Left: value (flex so it can shrink and ellipsize)
  rowValue: {
    fontSize: TYPOGRAPHY.size.sm,
    flex: 1,                       // takes remaining space
    textAlign: 'left',
    flexShrink: 1,
  },
  // Right: label + icon box (fixed, won't shrink)
  rowRight: {
    flexDirection: 'row',          // label then icon (icon is rightmost)
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    textAlign: 'right',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Device ID row
  deviceValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 1,
  },
  copyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.button,
    paddingVertical: SPACING.md,
    width: '80%',
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  logoutText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  bottomSpacer: { height: SPACING.xxxl },
});
