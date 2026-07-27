import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity, Animated,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useSession } from '../src/contexts/SessionContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '../src/theme/tokens';
import { ShieldCheck, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import { rs, rf, hp, isTablet } from '../src/utils/responsive';

const logo = require('../src/assets/numberOneLogo.png');


// ─── Animated input field ─────────────────────────────────────
function FloatingInput({
  label, value, onChangeText, secureTextEntry, keyboardType,
  autoCapitalize, placeholder,
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent],
  });

  const isPassword = secureTextEntry !== undefined;

  return (
    <Animated.View style={[
      styles.inputWrapper,
      {
        backgroundColor: colors.surface,
        borderColor: borderColor,
      },
    ]}>
      {isPassword && (
        <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.inputIcon}>
          {showPw
            ? <EyeOff size={18} color={colors.textMuted} />
            : <Eye size={18} color={colors.textMuted} />
          }
        </TouchableOpacity>
      )}
      <TextInput
        style={[styles.inputField, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword && !showPw}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={onFocus}
        onBlur={onBlur}
        textAlign="right"
      />
      <Text style={[styles.inputLabel, { color: focused ? colors.accent : colors.textMuted }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();
  const { deviceId } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)/home');
    } catch (e) {
      console.log('Login error details:', e);
      let errMsg = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
      if (e.response && e.response.data) {
        if (e.response.data.detail) errMsg = e.response.data.detail;
        else if (e.response.data.non_field_errors) errMsg = e.response.data.non_field_errors[0];
      } else if (e.message) {
        errMsg = e.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand Hero ── */}
        <View style={[styles.brandHero, {
          backgroundColor: isDark ? '#0F1A35' : '#EEF2FF',
          borderColor: isDark ? 'rgba(79,135,255,0.2)' : 'rgba(45,90,235,0.15)',
        }]}>
          {/* Decorative circle */}
          <View style={[styles.heroBlob, { backgroundColor: `${colors.accent}12` }]} />

          <View style={[styles.iconRing, {
            backgroundColor: colors.accentMuted,
            borderColor: `${colors.accent}40`,
          }]}>
            <Image source={logo} style={styles.logo} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>بوابة الطالب</Text>
          <Text style={[styles.brandSub, { color: colors.textSecondary }]}>
            مدارس ومعاهد نمبر ون
          </Text>
        </View>

        {/* ── Login Card ── */}
        <View style={[styles.loginCard, {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>تسجيل الدخول</Text>

          {/* Error box */}
          {error ? (
            <View style={[styles.errorBox, {
              backgroundColor: colors.errorMuted,
              borderColor: `${colors.error}40`,
            }]}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <FloatingInput
            label="اسم المستخدم"
            placeholder="أدخل اسم المستخدم"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <FloatingInput
            label="كلمة المرور"
            placeholder="أدخل كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Submit button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPress={handleLogin}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={1}
              disabled={loading}
              style={[styles.submitBtn, {
                backgroundColor: loading ? colors.accentMuted : colors.accent,
                opacity: loading ? 0.8 : 1,
              }]}
            >
              {loading ? (
                <Text style={styles.submitBtnText}>جارٍ التحقق...</Text>
              ) : (
                <>
                  <ShieldCheck size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>تسجيل الدخول الآمن</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Device ID hint */}
        {deviceId ? (
          <Text style={[styles.deviceHint, { color: colors.textMuted }]}>
            الجهاز: {deviceId.substring(0, 8)}...
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: hp,
    paddingVertical: rs(SPACING.xl),
    gap: rs(SPACING.xl),
  },

  // Brand Hero
  brandHero: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: rs(SPACING.xl2),
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    // Tablet: cap width and center
    maxWidth: isTablet ? 520 : undefined,
    alignSelf: isTablet ? 'center' : undefined,
    width: isTablet ? '100%' : undefined,
    ...SHADOWS.md,
  },
  heroBlob: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: rs(120),
    height: rs(120),
    borderRadius: rs(60),
  },
  iconRing: {
    width: rs(80),
    height: rs(80),
    borderRadius: rs(40),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(SPACING.md),
    overflow: 'hidden',
  },
  logo: {
    width: rs(64),
    height: rs(64),
    resizeMode: 'contain',
  },
  brandTitle: {
    fontSize: rf(TYPOGRAPHY.size.xxl),
    fontWeight: TYPOGRAPHY.weight.black,
    textAlign: 'center',
  },
  brandSub: {
    fontSize: rf(TYPOGRAPHY.size.sm),
    fontWeight: TYPOGRAPHY.weight.medium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Login Card
  loginCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    padding: rs(SPACING.xl),
    gap: rs(SPACING.md),
    // Tablet: cap width
    maxWidth: isTablet ? 520 : undefined,
    alignSelf: isTablet ? 'center' : undefined,
    width: isTablet ? '100%' : undefined,
    ...SHADOWS.md,
  },
  formTitle: {
    fontSize: rf(TYPOGRAPHY.size.lg),
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    marginBottom: SPACING.xs,
  },

  // Error
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Floating Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: rs(SPACING.md),
    height: rs(54),
    gap: SPACING.sm,
  },
  inputLabel: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    fontWeight: TYPOGRAPHY.weight.medium,
    flexShrink: 0,
  },
  inputField: {
    flex: 1,
    fontSize: rf(TYPOGRAPHY.size.md),
    height: '100%',
    padding: 0,
  },
  inputIcon: {
    padding: SPACING.xs,
    flexShrink: 0,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: rs(52),
    borderRadius: RADIUS.button,
    marginTop: SPACING.xs,
    ...SHADOWS.accent,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: rf(TYPOGRAPHY.size.md),
    fontWeight: TYPOGRAPHY.weight.bold,
  },

  // Device hint
  deviceHint: {
    fontSize: rf(TYPOGRAPHY.size.xs),
    textAlign: 'center',
  },
});

