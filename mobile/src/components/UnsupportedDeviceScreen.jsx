/**
 * UnsupportedDeviceScreen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen blocking page shown when the device's physical screen diagonal
 * is larger than 11 inches. The entire app is replaced by this screen.
 *
 * Design: centered layout, dark background, warning icon, clear messaging.
 * No buttons. No navigation. No way to bypass.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { Monitor, ShieldOff, Smartphone, Tablet } from 'lucide-react-native';

// ── Design tokens (inline — no dependency on ThemeContext, which isn't mounted) ──
const COLORS = {
  bg:           '#080B14',
  bgCard:       '#0F1629',
  border:       'rgba(255,255,255,0.08)',
  accent:       '#4F87FF',
  accentMuted:  'rgba(79,135,255,0.12)',
  warning:      '#F59E0B',
  warningMuted: 'rgba(245,158,11,0.10)',
  error:        '#F4506C',
  errorMuted:   'rgba(244,80,108,0.10)',
  text:         '#F0F4FF',
  textSec:      '#8B9CC8',
  textMuted:    '#4A5578',
};

export default function UnsupportedDeviceScreen() {
  // Subtle fade-in animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Background decoration blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      {/* Main content — vertically centered */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Icon container */}
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Monitor size={52} color={COLORS.warning} strokeWidth={1.5} />
          </View>
          {/* Shield badge */}
          <View style={styles.shieldBadge}>
            <ShieldOff size={18} color={COLORS.error} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Unsupported Device</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Message */}
        <Text style={styles.message}>
          This mobile application is designed only for Android phones and tablets
          with a screen size of 11 inches or smaller.{'\n\n'}
          Please use a supported device to continue.
        </Text>

        {/* Footer — supported devices list */}
        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Supported devices:</Text>

          <View style={styles.footerRow}>
            <View style={styles.dot} />
            <Smartphone size={14} color={COLORS.textSec} style={{ marginRight: 6 }} />
            <Text style={styles.footerItem}>Android phones</Text>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.dot} />
            <Tablet size={14} color={COLORS.textSec} style={{ marginRight: 6 }} />
            <Text style={styles.footerItem}>Android tablets up to 11 inches</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Background decoration
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.25,
  },
  blob1: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(79,135,255,0.12)',
    top: -60,
    right: -80,
  },
  blob2: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(244,80,108,0.08)',
    bottom: -40,
    left: -60,
  },

  // Content
  content: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },

  // Icon
  iconOuter: {
    position: 'relative',
    marginBottom: 28,
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: COLORS.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.errorMuted,
    borderWidth: 1,
    borderColor: 'rgba(244,80,108,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 16,
  },

  // Divider
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.warning,
    opacity: 0.6,
    marginBottom: 20,
  },

  // Message
  message: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSec,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Footer card
  footerCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 18,
    width: '100%',
    gap: 10,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    opacity: 0.7,
  },
  footerItem: {
    fontSize: 13,
    color: COLORS.textSec,
    fontWeight: '500',
  },
});
