/**
 * responsive.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsive layout utilities for Number One Student App.
 *
 * Supports Android phones and tablets up to 11 inches.
 * Design base width: 375 dp (typical mid-range phone).
 *
 * Usage:
 *   import { rs, rf, isTablet, hp, COLS } from '../../src/utils/responsive';
 *
 *   // Scale a size proportionally to screen width
 *   width: rs(120)
 *
 *   // Scale a font size (moderate — avoids excessive growth on tablets)
 *   fontSize: rf(14)
 *
 *   // Horizontal padding that adjusts per device class
 *   paddingHorizontal: hp
 *
 *   // Number of columns for a quick-action grid
 *   numCols: COLS.quickActions
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** The shorter side, used to classify device type. */
const SHORT_SIDE = Math.min(SCREEN_W, SCREEN_H);

/** True when the device's shortest side is ≥ 600 dp (standard Android tablet breakpoint). */
export const isTablet = SHORT_SIDE >= 600;

/** True when the device's shortest side is ≥ 840 dp (large tablet, ~10"). */
export const isLargeTablet = SHORT_SIDE >= 840;

/** Base design width — all scale values are relative to this. */
const BASE_WIDTH = 375;

/**
 * Proportional scale based on screen width.
 * Returns sizes that grow/shrink linearly with the device width.
 * Clamped between 0.75× and 1.6× to avoid extreme values.
 *
 * @param {number} size - Size in the 375 dp design space.
 * @returns {number}
 */
export function rs(size) {
  const factor = Math.min(Math.max(SCREEN_W / BASE_WIDTH, 0.75), 1.6);
  return Math.round(size * factor);
}

/**
 * Moderate (font) scale — grows less aggressively than rs().
 * factor=0.25 means 25% of the full linear scale is applied.
 *
 * @param {number} size - Base size.
 * @param {number} [factor=0.25] - Growth dampener (0 = no growth, 1 = full linear).
 * @returns {number}
 */
export function rf(size, factor = 0.25) {
  return Math.round(size + (rs(size) - size) * factor);
}

/**
 * Horizontal padding/margin that is comfortable on all device classes.
 * Phone: 16 | Tablet: 24 | Large tablet: 32
 */
export const hp = isLargeTablet ? 32 : isTablet ? 24 : 16;

/**
 * Vertical padding for screen-level spacing.
 */
export const vp = isTablet ? 20 : 16;

/**
 * Column counts for various grid layouts.
 */
export const COLS = {
  /** Quick-action buttons on the Home screen. */
  quickActions: isLargeTablet ? 8 : isTablet ? 6 : 4,
  /** Course cards grid. */
  courses: isLargeTablet ? 3 : isTablet ? 2 : 1,
  /** Exam / result cards grid. */
  cards: isTablet ? 2 : 1,
};

/**
 * Icon sizes scaled to device class.
 */
export const ICON = {
  sm: rf(16),
  md: rf(20),
  lg: rf(24),
  xl: rf(28),
  xxl: rf(36),
};

/**
 * Tab bar heights adjusted for device class.
 */
export const TAB_BAR = {
  contentHeight: isTablet ? 60 : 56,
};

/** Screen width export for convenience. */
export const SCREEN_WIDTH = SCREEN_W;

/** Screen height export for convenience. */
export const SCREEN_HEIGHT = SCREEN_H;
