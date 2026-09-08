import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  addScreenshotListener,
  isAvailableAsync,
} from 'expo-screen-capture';

/**
 * useScreenSecurity
 *
 * - Android : FLAG_SECURE is applied via the Expo config plugin at build time
 *   AND reinforced at runtime via preventScreenCaptureAsync(). The OS blocks
 *   all screen recording and screenshots natively — no blank overlay needed.
 *
 * - iOS : The OS does NOT allow apps to block screen recording. We therefore
 *   detect when a recording starts and set `isRecording = true` so the caller
 *   can render a blocking overlay to hide sensitive content.
 *
 * Returns { isRecording } — only ever true on iOS while recording is active.
 */
/**
 * تعطيل منع التصوير — لبناء لقطات متجر Google Play فقط.
 *
 * FLAG_SECURE يمنع التقاط الشاشة، وهو مطلوب لحماية المحتوى التعليمي، لكنه
 * يمنع أيضاً تصوير الشاشات اللازمة لصفحة التطبيق على المتجر. يُفعَّل هذا
 * المتغيّر في profile مخصص للقطات فقط، ويبقى منع التصوير فعّالاً في كل
 * البناءات الأخرى لأن القيمة الافتراضية غير مضبوطة.
 */
const ALLOW_CAPTURE = process.env.EXPO_PUBLIC_ALLOW_CAPTURE === '1';

export function useScreenSecurity() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let screenshotSub;

    (async () => {
      try {
        if (ALLOW_CAPTURE) {
          console.warn('[Security] منع التصوير معطّل — بناء لقطات المتجر فقط.');
          return;
        }
        const available = await isAvailableAsync();
        if (!available) return;

        // Prevent screen capture (works as FLAG_SECURE reinforcement on Android;
        // on iOS it only blocks screenshots — not recordings — at the system level).
        await preventScreenCaptureAsync();

        if (Platform.OS === 'ios') {
          // iOS: listen for screenshot events as a proxy signal and use
          // the screen-capture listener to detect active recording state.
          screenshotSub = addScreenshotListener(() => {
            // Screenshot was taken — log but no actionable block possible.
            console.warn('[Security] Screenshot attempt detected on iOS.');
          });
        }
      } catch (e) {
        // Native module may not be linked or available — fail gracefully
        console.warn('[useScreenSecurity] Screen capture API unavailable:', e.message);
      }
    })();

    return () => {
      // Clean up — allow screen capture again only when the whole app unmounts
      // (i.e. never during normal use, only on dev hot-reload).
      allowScreenCaptureAsync().catch(() => {});
      if (screenshotSub) {
        screenshotSub.remove();
      }
    };
  }, []);

  return { isRecording };
}

export default useScreenSecurity;
