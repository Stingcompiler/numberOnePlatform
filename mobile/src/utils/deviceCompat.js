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
 * يُفعَّل في بناء الإنتاج (متجر Google Play) فقط عبر eas.json.
 *
 * السبب: مراجعو Google يختبرون التطبيقات على محاكيات في كثير من الأحيان. إبقاء
 * الحجب في نسخة المتجر يجعل المراجع يرى شاشة "جهاز غير مدعوم" فيستنتج أن
 * التطبيق معطّل ⇒ رفض بموجب سياسة Broken Functionality.
 *
 * نسخة التوزيع المباشر (profile الـ preview) تُبنى بدون هذا المتغيّر، فيبقى
 * الحجب فعّالاً للطلاب. وفي الحالتين يظل ربط الحساب بجهاز واحد قائماً وهو
 * خط الدفاع الأقوى.
 */
const ALLOW_EMULATOR = process.env.EXPO_PUBLIC_ALLOW_EMULATOR === '1';

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
  // Deep emulator heuristics are only necessary for Android, which has 
  // third-party desktop emulators like BlueStacks. iOS only has official 
  // simulators, which are already reliably caught by `!Device.isDevice`.
  if (Platform.OS !== 'android') {
    return false;
  }

  const brand = (Device.brand || '').toLowerCase();
  const manufacturer = (Device.manufacturer || '').toLowerCase();
  const modelName = (Device.modelName || '').toLowerCase();
  const designName = (Device.designName || '').toLowerCase();
  const productName = (Device.productName || '').toLowerCase();

  // 1. Check CPU Architectures
  // PC Emulators (BlueStacks, Nox, etc.) often support or run natively on x86/x64.
  // Physical Android devices are overwhelmingly ARM-based.
  const cpuArchitectures = Device.supportedCpuArchitectures || [];
  const hasX86 = cpuArchitectures.some(arch => 
    arch.toLowerCase().includes('x86') || 
    arch.toLowerCase().includes('i686') || 
    arch.toLowerCase().includes('amd64')
  );

  if (hasX86) {
    return true;
  }

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

  // في بناء المتجر نكتفي بحجب الويب وسطح المكتب أعلاه، ونسمح بالمحاكيات
  // والشاشات الكبيرة كي يتمكن مراجع Google من تشغيل التطبيق واختباره.
  if (ALLOW_EMULATOR) {
    return true;
  }

  // 2. Block Simulators and Emulators using Expo's native check
  // `isDevice` is true for physical devices, false for emulators/simulators.
  if (!Device.isDevice) {
    return false;
  }

  // 2.5 Block Apple Silicon Macs running the iOS app natively ("Designed for iPad")
  if (Platform.OS === 'ios' && Device.modelName && Device.modelName.toLowerCase().includes('mac')) {
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
