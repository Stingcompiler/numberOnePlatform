/**
 * deviceCompat.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Device compatibility utilities for Number One Student App.
 *
 * Security Requirements:
 *   - Only physical iOS and Android devices are permitted.
 *   - Emulators, simulators, Web, Windows, macOS, and Linux are strictly BLOCKED.
 *   - Screen size on Android must be 11 inches or smaller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Dimensions, Platform } from 'react-native';
import * as Device from 'expo-device';

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
  const w = Math.max(width, height);
  const h = Math.min(width, height);
  const diagonalDp = Math.sqrt(w * w + h * h);
  return diagonalDp / 160;
}

/**
 * Advanced emulator detection heuristics.
 * Checks known emulator signatures in device metadata.
 * 
 * @returns {boolean} True if the device exhibits emulator signatures.
 */
function isEmulatorHeuristic() {
  const brand = (Device.brand || '').toLowerCase();
  const manufacturer = (Device.manufacturer || '').toLowerCase();
  const modelName = (Device.modelName || '').toLowerCase();
  const designName = (Device.designName || '').toLowerCase();
  const productName = (Device.productName || '').toLowerCase();

  const emulatorKeywords = [
    'bluestacks', 'genymotion', 'nox', 'memu', 'ldplayer', 'mumu', 
    'wsa', 'vbox', 'qemu', 'emulator', 'simulator', 'sdk_gphone', 
    'vmos', 'microvirt', 'bignox'
  ];

  const checkStrings = [brand, manufacturer, modelName, designName, productName];

  return checkStrings.some(str => 
    emulatorKeywords.some(keyword => str.includes(keyword))
  );
}

/**
 * Returns true if the current device is supported by this application.
 *
 * Supported devices:
 *   • Physical Android phones and tablets up to 11 inches.
 *   • Physical iPhones and iPads.
 *
 * Unsupported devices:
 *   • Android devices > 11 inches.
 *   • iOS/Android Emulators & Simulators.
 *   • Desktop (Windows, macOS, Linux).
 *   • Web / Browsers.
 */
export function isDeviceSupported() {
  // 1. Block Desktop and Web strictly by Platform.OS
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false; // Blocks web, windows, macos, etc.
  }

  // 2. Block Simulators and Emulators using Expo's native check
  // `isDevice` is true for physical devices, false for emulators/simulators.
  if (!Device.isDevice) {
    return false; 
  }

  // 3. Block sneaky emulators that might bypass `isDevice` (like some Android desktop players)
  if (isEmulatorHeuristic()) {
    return false;
  }

  // 4. Enforce screen size limits for Android (prevent giant smart screens/desktop window resizing)
  if (Platform.OS === 'android') {
    const diagonal = getScreenDiagonalInches();
    if (diagonal > MAX_SUPPORTED_DIAGONAL_INCHES) {
      return false;
    }
  }

  return true;
}

export default isDeviceSupported;
