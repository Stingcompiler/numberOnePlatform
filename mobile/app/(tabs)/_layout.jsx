import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Home, BookOpen, PenTool, Award, User } from 'lucide-react-native';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();

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
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          // Shadow above tab bar
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        // Smooth tab press animation
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: `${color}18` }]}>
              <Home size={22} color={color} />
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
              <BookOpen size={22} color={color} />
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
              <PenTool size={22} color={color} />
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
              <Award size={22} color={color} />
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
              <User size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
