// ============================================================
// DESIGN TOKENS — Number One LMS Student App (2026 Design System)
// ============================================================

export const COLORS = {
  dark: {
    // Base layers
    background: '#080B14',       // Deepest dark — true OLED black-blue
    surface: '#0F1629',          // Card surface (slightly elevated)
    surfaceElevated: '#162040',  // Modals, raised sheets
    overlay: 'rgba(8, 11, 20, 0.85)',

    // Borders
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    cardBorder: 'rgba(255, 255, 255, 0.05)',

    // Text hierarchy
    text: '#F0F4FF',
    textSecondary: '#8B9CC8',
    textMuted: '#4A5578',

    // Accent — vibrant indigo-blue
    accent: '#4F87FF',
    accentMuted: 'rgba(79, 135, 255, 0.12)',
    accentStrong: '#6B9FFF',

    // Semantic colors
    success: '#22D3A8',          // Teal-green
    successMuted: 'rgba(34, 211, 168, 0.12)',
    warning: '#F59E0B',
    warningMuted: 'rgba(245, 158, 11, 0.12)',
    error: '#F4506C',            // Vibrant coral
    errorMuted: 'rgba(244, 80, 108, 0.12)',
    info: '#38BDF8',
    infoMuted: 'rgba(56, 189, 248, 0.12)',

    // Gradients
    gradientPrimary: ['#2D5AEB', '#6B4FFF'],
    gradientSuccess: ['#059669', '#22D3A8'],
    gradientWarm: ['#F59E0B', '#EF4444'],
    gradientCard: ['rgba(15, 22, 41, 0.9)', 'rgba(22, 32, 64, 0.7)'],

    // Shimmer
    shimmerBase: '#0F1629',
    shimmerHighlight: '#1A2848',

    // Primary
    primary: '#1e2d4a',
    cardBg: 'rgba(15, 22, 41, 0.8)',
  },
  light: {
    background: '#F0F4FF',
    surface: '#FFFFFF',
    surfaceElevated: '#EEF2FF',
    overlay: 'rgba(240, 244, 255, 0.90)',

    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    cardBorder: 'rgba(0, 0, 0, 0.06)',

    text: '#0A0F1E',
    textSecondary: '#475569',
    textMuted: '#94A3B8',

    accent: '#2D5AEB',
    accentMuted: 'rgba(45, 90, 235, 0.10)',
    accentStrong: '#1E46C7',

    success: '#059669',
    successMuted: 'rgba(5, 150, 105, 0.10)',
    warning: '#D97706',
    warningMuted: 'rgba(217, 119, 6, 0.10)',
    error: '#DC2626',
    errorMuted: 'rgba(220, 38, 38, 0.10)',
    info: '#0284C7',
    infoMuted: 'rgba(2, 132, 199, 0.10)',

    gradientPrimary: ['#2D5AEB', '#6B4FFF'],
    gradientSuccess: ['#059669', '#22D3A8'],
    gradientWarm: ['#F59E0B', '#EF4444'],
    gradientCard: ['rgba(255,255,255,0.95)', 'rgba(240,244,255,0.80)'],

    shimmerBase: '#E8EEF8',
    shimmerHighlight: '#F5F8FF',

    primary: '#E8F0FE',
    cardBg: 'rgba(255, 255, 255, 0.9)',
  }
};

// Subject-specific palette (shared across themes)
export const SUBJECT_COLORS = {
  math:    { color: '#4F87FF', muted: 'rgba(79,135,255,0.12)' },
  arabic:  { color: '#F59E0B', muted: 'rgba(245,158,11,0.12)' },
  islamic: { color: '#22D3A8', muted: 'rgba(34,211,168,0.12)' },
  physics: { color: '#A78BFA', muted: 'rgba(167,139,250,0.12)' },
  chem:    { color: '#F472B6', muted: 'rgba(244,114,182,0.12)' },
  english: { color: '#38BDF8', muted: 'rgba(56,189,248,0.12)' },
  geo:     { color: '#34D399', muted: 'rgba(52,211,153,0.12)' },
  default: { color: '#4F87FF', muted: 'rgba(79,135,255,0.12)' },
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xl2:  24,
  xxl:  32,
  xxxl: 48,
  huge: 64,
};

export const RADIUS = {
  xs:     4,
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  card:   16,
  button: 12,
  chip:   8,
  round:  9999,
};

export const TYPOGRAPHY = {
  size: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   18,
    xl:   22,
    xxl:  28,
    hero: 34,
  },
  weight: {
    light:   '300',
    regular: '400',
    medium:  '500',
    bold:    '700',
    black:   '900',
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.75,
  },
};

export const SHADOWS = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 8,
  },
  accent: {
    shadowColor: '#4F87FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const ANIMATION = {
  fast:   150,
  normal: 250,
  slow:   400,
  spring: {
    tension: 100,
    friction: 8,
  },
};
