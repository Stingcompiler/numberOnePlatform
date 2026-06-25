import React, { useRef } from 'react';
import {
  TouchableOpacity, StyleSheet, Animated, Platform, View,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Sun, Moon, Bell } from 'lucide-react-native';

/**
 * ThemeToggle — global floating overlay, always on top.
 * On the home screen, a notification bell button appears right beside it.
 */
export default function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bellScaleAnim = useRef(new Animated.Value(1)).current;

  // Show the bell only on the home tab
  const isHome = pathname === '/' || pathname === '/home' || pathname === '/(tabs)/home';

  const handleThemePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 0.82, useNativeDriver: true, speed: 60 }),
        Animated.timing(rotateAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start(() => rotateAnim.setValue(0));
    toggleTheme();
  };

  const handleBellPress = () => {
    Animated.sequence([
      Animated.spring(bellScaleAnim, { toValue: 0.82, useNativeDriver: true, speed: 60 }),
      Animated.spring(bellScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    router.push('/notifications/');
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const btnStyle = {
    backgroundColor: isDark ? 'rgba(20, 28, 58, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    borderColor: isDark ? 'rgba(79, 135, 255, 0.35)' : 'rgba(45, 90, 235, 0.2)',
    shadowColor: colors.accent,
  };

  return (
    <View style={styles.container}>
      {/* ── Bell button — home only ── */}
      {isHome && (
        <Animated.View
          style={[
            styles.btn,
            btnStyle,
            { transform: [{ scale: bellScaleAnim }] },
          ]}
        >
          <TouchableOpacity
            onPress={handleBellPress}
            activeOpacity={0.8}
            style={styles.touchable}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Bell size={20} color={isDark ? '#A8C1FF' : '#4F87FF'} strokeWidth={2.2} />
            {/* Unread badge */}
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Theme toggle ── */}
      <Animated.View
        style={[
          styles.btn,
          btnStyle,
          { transform: [{ scale: scaleAnim }, { rotate }] },
        ]}
      >
        <TouchableOpacity
          onPress={handleThemePress}
          activeOpacity={0.8}
          style={styles.touchable}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isDark
            ? <Sun size={20} color="#FFD166" strokeWidth={2.2} />
            : <Moon size={20} color="#4F87FF" strokeWidth={2.2} />}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 44,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 9999,
    elevation: 20,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  touchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
