import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Home, BookOpen, PenTool, Award, User } from 'lucide-react-native';
import { isTablet, rf } from '../../src/utils/responsive';

// Tab bar content height scales slightly for tablets.
const TAB_CONTENT_HEIGHT = isTablet ? 62 : 56;
// Minimum extra breathing room above the system navigation area.
const TAB_EXTRA_PADDING = 6;

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Real bottom inset reported by the OS (home indicator / gesture bar /
  // on-screen nav buttons). Always at least TAB_EXTRA_PADDING so there is
  // comfortable spacing even on devices with no system UI at the bottom.
  const bottomInset = Math.max(insets.bottom, TAB_EXTRA_PADDING);

  // Total bar height = visible content area + safe-area inset.
  const tabBarHeight = TAB_CONTENT_HEIGHT + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark
            ? 'rgba(10, 14, 26, 0.97)'
            : 'rgba(255, 255, 255, 0.97)',
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          // Dynamic height that adapts to every device's bottom safe area.
          height: tabBarHeight,
          // Push tab items up so they sit in the visible content area,
          // leaving the safe-area inset as transparent padding below them.
          paddingBottom: bottomInset,
          paddingTop: 8,
          // Shadow above tab bar
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: rf(10),
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <Home size={rf(22)} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'الكورسات',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <BookOpen size={rf(22)} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'الاختبارات',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <PenTool size={rf(22)} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'النتائج',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <Award size={rf(22)} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <User size={rf(22)} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 34 : 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
