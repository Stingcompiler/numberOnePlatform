/**
 * deviceCompat.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Device compatibility utilities for Number One Student App.
 *
 * This app is designed for Android phones and tablets up to 11 inches.
 * Devices with a physical screen diagonal larger than 11 inches must be blocked.
 *
 * Detection method:
 *   - `Dimensions.get('screen')` returns width/height in density-independent
 *     pixels (dp). On Android, 1 dp = 1/160 physical inch at the mdpi baseline.
 *   - diagonal_inches = sqrt(w_dp² + h_dp²) / 160
 *
 * This matches the Android SDK's DisplayMetrics approach and correctly
 * identifies screen size across all density classes (mdpi, hdpi, xhdpi …).
 *
 * Example validation:
 *   Galaxy S23 (6.1")  → ~370×800 dp → 5.6" ✅  (supported)
 *   Galaxy Tab S8 (11") → ~1495×934 dp → 11.0" ✅ (boundary, supported)
 *   Galaxy Tab S9 Ultra (14.6") → ~1800×1100 dp → ~13.5" ❌ (blocked)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Dimensions, Platform } from 'react-native';

/** The maximum supported screen diagonal in inches. */
const MAX_SUPPORTED_DIAGONAL_INCHES = 11.0;

/**
 * Compute the physical screen diagonal in inches using the dp-to-inches
 * formula: 1 dp = 1/160 inch on the Android baseline density.
 *
 * @returns {number} Screen diagonal in inches.
 */
export function getScreenDiagonalInches() {
  const { width, height } = Dimensions.get('screen');
  // Use the larger of the two axes for the diagonal regardless of orientation
  const w = Math.max(width, height);
  const h = Math.min(width, height);
  const diagonalDp = Math.sqrt(w * w + h * h);
  return diagonalDp / 160;
}

/**
 * Returns true if the current device is supported by this application.
 *
 * Supported devices:
 *   • Android phones (any screen size up to 11")
 *   • Android tablets with a screen ≤ 11 inches diagonal
 *
 * Unsupported devices:
 *   • Android devices with screen > 11 inches (large tablets, smart displays, etc.)
 *
 * iOS is not a target platform for this app; treated as supported to avoid
 * accidentally blocking iOS developer/QA devices during testing.
 */
export function isDeviceSupported() {
  // Only restrict Android. iOS is pass-through.
  if (Platform.OS !== 'android') {
    return true;
  }

  const diagonal = getScreenDiagonalInches();
  return diagonal <= MAX_SUPPORTED_DIAGONAL_INCHES;
}

export default isDeviceSupported;
