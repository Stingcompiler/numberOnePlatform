import 'react-native-gesture-handler';
import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useScreenSecurity } from '../src/hooks/useScreenSecurity';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { SessionProvider } from '../src/contexts/SessionContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import ThemeToggle from '../src/components/ThemeToggle';
import { isDeviceSupported } from '../src/utils/deviceCompat';
import UnsupportedDeviceScreen from '../src/components/UnsupportedDeviceScreen';
import { useTheme } from '../src/contexts/ThemeContext';

// Check device compatibility ONCE at module load time (Dimensions is sync).
// This constant never changes during the app session.
const DEVICE_SUPPORTED = isDeviceSupported();
import { 
  Cairo_300Light, 
  Cairo_400Regular, 
  Cairo_500Medium, 
  Cairo_700Bold, 
  Cairo_900Black 
} from '@expo-google-fonts/cairo';
import {
  Tajawal_300Light,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_900Black
} from '@expo-google-fonts/tajawal';

// Intercept Text render to inject custom font family and automatically select the correct weight
// Wrapped in try-catch: on RN 0.81+ New Architecture, Text.render may not be a plain function
try {
  if (Text && !Text.__patched && typeof Text.render === 'function') {
    Text.__patched = true;
    const originalRender = Text.render;
    Text.render = function (props, ref) {
      try {
        const origin = originalRender.apply(this, [props, ref]);
        const flattenedStyle = StyleSheet.flatten(props.style);
        
        const useCairo = flattenedStyle && flattenedStyle.fontFamily && String(flattenedStyle.fontFamily).toLowerCase().includes('cairo');
        const prefix = useCairo ? 'Cairo-' : 'Tajawal-';
        
        let resolvedFont = prefix + 'Regular';
        if (flattenedStyle) {
          const weight = String(flattenedStyle.fontWeight || '400');
          if (weight === 'bold' || weight === '700') {
            resolvedFont = prefix + 'Bold';
          } else if (weight === '900' || weight === 'black') {
            resolvedFont = prefix + 'Black';
          } else if (weight === '500' || weight === 'medium') {
            resolvedFont = prefix + 'Medium';
          } else if (weight === '300' || weight === 'light') {
            resolvedFont = prefix + 'Light';
          }
        }
        
        return React.cloneElement(origin, {
          style: [
            props.style, 
            { 
              fontFamily: resolvedFont,
              fontWeight: 'normal' 
            }
          ]
        });
      } catch (e) {
        // Fallback: render without font patching rather than crash
        return originalRender.apply(this, [props, ref]);
      }
    };
  }
} catch (e) {
  console.warn('[FontPatch] Text.render patching skipped:', e.message);
}

try {
  if (TextInput && !TextInput.__patched && typeof TextInput.render === 'function') {
    TextInput.__patched = true;
    const originalInputRender = TextInput.render;
    TextInput.render = function (props, ref) {
      try {
        const origin = originalInputRender.apply(this, [props, ref]);
        return React.cloneElement(origin, {
          style: [
            props.style,
            { fontFamily: 'Tajawal-Regular' }
          ]
        });
      } catch (e) {
        return originalInputRender.apply(this, [props, ref]);
      }
    };
  }
} catch (e) {
  console.warn('[FontPatch] TextInput.render patching skipped:', e.message);
}

// Inner layout that has access to ThemeProvider context
function AppShell() {
  const { isDark } = useTheme();
  const { isRecording } = useScreenSecurity();

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
      <ThemeToggle />
      {/* iOS: overlay when screen recording is active */}
      {Platform.OS === 'ios' && isRecording && (
        <View style={styles.recordingShield}>
          <View style={styles.recordingMessage}>
            <Text style={styles.recordingIcon}>🔒</Text>
            <Text style={styles.recordingTitle}>تسجيل الشاشة محظور</Text>
            <Text style={styles.recordingSubtitle}>
              أوقف تسجيل الشاشة للمتابعة.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Light': Cairo_300Light,
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-Medium': Cairo_500Medium,
    'Cairo-Bold': Cairo_700Bold,
    'Cairo-Black': Cairo_900Black,
    'Tajawal-Light': Tajawal_300Light,
    'Tajawal-Regular': Tajawal_400Regular,
    'Tajawal-Medium': Tajawal_500Medium,
    'Tajawal-Bold': Tajawal_700Bold,
    'Tajawal-Black': Tajawal_900Black,
  });

  // ننتظر تحميل الخطوط، لكن لا نعلّق التطبيق إن فشل التحميل:
  // بدون فحص fontError كان التطبيق يبقى على شاشة فارغة إلى الأبد عند أي
  // فشل في تحميل الخطوط. الآن نتابع بخط النظام بدل تعطيل التطبيق كلياً.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (fontError) {
    console.warn('[Fonts] تعذّر تحميل الخطوط، سيُستخدم خط النظام:', fontError?.message);
  }

  // ── Device compatibility gate ──────────────────────────────────────────
  // If the physical screen is larger than 11 inches on Android, block the
  // entire app. This check runs before ANY provider, route, or component
  // is rendered, making it impossible to bypass via deep links or navigation.
  if (!DEVICE_SUPPORTED) {
    return (
      <SafeAreaProvider>
        <UnsupportedDeviceScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppShell />
            </NotificationProvider>
          </AuthProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  recordingShield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingMessage: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  recordingIcon: {
    fontSize: 48,
  },
  recordingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  recordingSubtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 22,
  },
});
