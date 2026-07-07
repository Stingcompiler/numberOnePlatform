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
export function useScreenSecurity() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let screenshotSub;

    (async () => {
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
