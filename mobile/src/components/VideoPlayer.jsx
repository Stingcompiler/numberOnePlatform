import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
  PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  RotateCcw,
  AlertCircle,
  RotateCw,
} from 'lucide-react-native';

/** مقدار القفز لأزرار التقديم والإرجاع (ثوانٍ) */
const SKIP_SECONDS = 10;
import { SPACING, TYPOGRAPHY, RADIUS } from '../theme/tokens';
import { useTheme } from '../contexts/ThemeContext';

export function getYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function VideoPlayer({ 
  videoUrl, 
  isFullscreen: propIsFullscreen, 
  setIsFullscreen: propSetIsFullscreen 
}) {
  const { colors } = useTheme();
  const videoId = getYouTubeVideoId(videoUrl);

  const webViewRef = useRef(null);
  const [playerState, setPlayerState] = useState(-1); // -1: unstarted, 1: playing, 2: paused, 3: buffering
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Custom Controls State
  const [showControls, setShowControls] = useState(true);
  const [localIsFullscreen, setLocalIsFullscreen] = useState(false);
  const isFullscreen = propIsFullscreen !== undefined ? propIsFullscreen : localIsFullscreen;
  const setIsFullscreen = propSetIsFullscreen !== undefined ? propSetIsFullscreen : setLocalIsFullscreen;
  
  const controlsTimeoutRef = useRef(null);
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  // ── السحب على شريط التقدم ────────────────────────────────────────────────
  // كان الشريط TouchableOpacity بـ onPress فقط، أي أنه يدعم النقر ولا يدعم
  // السحب إطلاقاً. PanResponder (من نواة React Native، بلا مكتبة إضافية)
  // يوفّر السحب الحقيقي.
  //
  // المراجع بدل الحالة لأن دوال PanResponder تُنشأ مرة واحدة ولا ترى أحدث
  // قيم الحالة (closure قديمة):
  //   seekingRef       : أثناء السحب نتجاهل تحديثات المشغّل حتى لا يقفز المؤشر
  //   seekLockUntilRef : بعد الإفلات يُبلّغ يوتيوب الوقت القديم للحظات،
  //                      فنتجاهل التحديثات مؤقتاً لمنع ارتداد الشريط
  //   durationRef / widthRef : أحدث القيم لحساب الوقت من موضع اللمس
  const [isSeeking, setIsSeeking] = useState(false);
  const seekingRef = useRef(false);
  const seekLockUntilRef = useRef(0);
  const durationRef = useRef(0);
  const widthRef = useRef(0);
  const dragTimeRef = useRef(0);

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { widthRef.current = progressBarWidth; }, [progressBarWidth]);

  /** يحوّل موضع اللمس إلى ثوانٍ، مقيّداً بين 0 ومدة الفيديو */
  const timeFromTouch = (locationX) => {
    const w = widthRef.current;
    const d = durationRef.current;
    if (!w || !d) return 0;
    const ratio = Math.min(1, Math.max(0, locationX / w));
    return Math.min(d, Math.max(0, ratio * d));
  };

  // Auto-hide controls timer
  const triggerShowControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playerState === 1) { // Only auto-hide if playing
        setShowControls(false);
      }
    }, 3500);
  };

  useEffect(() => {
    triggerShowControls();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playerState]);

  // 1. Listen to device auto-rotation events to toggle fullscreen layout dynamically
  useEffect(() => {
    // Enable rotation on this screen
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL).catch(() => {});

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const { orientation } = event.orientationInfo;
      if (
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      ) {
        setIsFullscreen(true);
      } else if (
        orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
        orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
      ) {
        setIsFullscreen(false);
      }
    });

    return () => {
      subscription.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // 2. Lock/Unlock orientation programmatically when fullscreen is manually toggled
  useEffect(() => {
    async function handleOrientation() {
      try {
        if (isFullscreen) {
          // Force landscape orientation on button click
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          // Unlock after rotation to allow subsequent device auto-rotations
          setTimeout(async () => {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
          }, 1500);
        } else {
          // Force portrait orientation on button click
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          // Unlock after rotation to allow subsequent device auto-rotations
          setTimeout(async () => {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
          }, 1500);
        }
      } catch (e) {
        console.warn('Could not lock orientation:', e);
      }
    }
    handleOrientation();
  }, [isFullscreen]);

  if (!videoId) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.border }]}>
        <AlertCircle size={32} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          رابط الفيديو غير صالح.
        </Text>
      </View>
    );
  }

  // HTML content injected in the WebView with YouTube Iframe API
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: black; }
          #player { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              height: '100%',
              width: '100%',
              videoId: '${videoId}',
              playerVars: {
                'playsinline': 1,
                'controls': 0, // Disable YouTube standard controls
                'rel': 0,
                'modestbranding': 1,
                'fs': 0,
                'enablejsapi': 1,
                'origin': 'https://numberoneschools.com'
              },
              events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
              }
            });
          }

          function onPlayerReady(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'ready' }));
          }

          function onPlayerStateChange(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              event: 'stateChange', 
              state: event.data,
              duration: player.getDuration(),
              currentTime: player.getCurrentTime()
            }));
          }

          function onPlayerError(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'error', error: event.data }));
          }

          // Periodic progress emitter
          setInterval(function() {
            if (player && typeof player.getCurrentTime === 'function' && typeof player.getPlayerState === 'function') {
              var state = player.getPlayerState();
              if (state === 1) { // Only emit progress when playing
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event: 'progress',
                  currentTime: player.getCurrentTime(),
                  duration: player.getDuration()
                }));
              }
            }
          }, 500);

          // Command listener from React Native (both window and document for cross-platform support)
          function handleMessageEvent(e) {
            try {
              var data = JSON.parse(e.data);
              if (data.command === 'play') {
                player.playVideo();
              } else if (data.command === 'pause') {
                player.pauseVideo();
              } else if (data.command === 'seekTo') {
                player.seekTo(data.time, true);
              }
            } catch (err) {
              // Ignore invalid messages
            }
          }
          window.addEventListener('message', handleMessageEvent);
          document.addEventListener('message', handleMessageEvent);
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'ready') {
        setLoading(false);
      } else if (data.event === 'stateChange') {
        setPlayerState(data.state);
        setDuration(data.duration || 0);
        // لا نلمس الوقت أثناء السحب أو في فترة القفل بعده
        if (!seekingRef.current && Date.now() >= seekLockUntilRef.current) {
          setCurrentTime(data.currentTime || 0);
        }
      } else if (data.event === 'progress') {
        setDuration(data.duration || 0);
        // تجاهل تحديثات المشغّل أثناء السحب وبعده مباشرةً، وإلا ارتدّ المؤشر
        // إلى الموضع القديم وبدا التحكم غير مستجيب.
        if (!seekingRef.current && Date.now() >= seekLockUntilRef.current) {
          setCurrentTime(data.currentTime || 0);
        }
      } else if (data.event === 'error') {
        setError('تعذر تشغيل هذا الفيديو.');
        setLoading(false);
      }
    } catch (e) {
      console.warn('Invalid message from WebView player', e);
    }
  };

  const play = () => {
    webViewRef.current?.postMessage(JSON.stringify({ command: 'play' }));
    webViewRef.current?.injectJavaScript(`
      if (window.player && typeof window.player.playVideo === 'function') {
        window.player.playVideo();
      }
      true;
    `);
  };

  const pause = () => {
    webViewRef.current?.postMessage(JSON.stringify({ command: 'pause' }));
    webViewRef.current?.injectJavaScript(`
      if (window.player && typeof window.player.pauseVideo === 'function') {
        window.player.pauseVideo();
      }
      true;
    `);
  };

  const seekTo = (time) => {
    // تقييد ضمن حدود الفيديو قبل الإرسال
    const d = durationRef.current;
    const t = Math.min(d > 0 ? d : time, Math.max(0, time));
    // بعد الإرسال يُبلّغ المشغّل الوقت القديم للحظة، فنتجاهل تحديثاته مؤقتاً
    seekLockUntilRef.current = Date.now() + 800;
    setCurrentTime(t);
    webViewRef.current?.injectJavaScript(`
      if (window.player && typeof window.player.seekTo === 'function') {
        window.player.seekTo(${t}, true);
      }
      true;
    `);
    triggerShowControls();
  };

  /** أزرار الإرجاع/التقديم — مقيّدة بين 0 والمدة الكاملة */
  const skipBy = (seconds) => {
    const base = seekingRef.current ? dragTimeRef.current : currentTime;
    seekTo(base + seconds);
  };

  // يُنشأ مرة واحدة: كل القيم المتغيّرة تُقرأ من المراجع أعلاه
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // يمنع الأب (ScrollView/صفحة الدرس) من خطف الإيماءة أثناء السحب
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (e) => {
          seekingRef.current = true;
          setIsSeeking(true);
          const t = timeFromTouch(e.nativeEvent.locationX);
          dragTimeRef.current = t;
          setCurrentTime(t);   // تحديث فوري للواجهة أثناء السحب
          triggerShowControls();
        },
        onPanResponderMove: (e) => {
          const t = timeFromTouch(e.nativeEvent.locationX);
          dragTimeRef.current = t;
          setCurrentTime(t);   // الواجهة فقط — لا أوامر seek أثناء السحب
        },
        onPanResponderRelease: () => {
          // أمر seek واحد بالقيمة النهائية، لا عشرات الأوامر أثناء السحب
          seekingRef.current = false;
          setIsSeeking(false);
          seekTo(dragTimeRef.current);
        },
        onPanResponderTerminate: () => {
          seekingRef.current = false;
          setIsSeeking(false);
          seekTo(dragTimeRef.current);
        },
      }),
    []
  );

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === undefined) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const renderPlayer = (fullscreenMode = false) => {
    return (
      <View style={[styles.playerContainer, fullscreenMode && styles.fullscreenContainer]}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent, baseUrl: 'https://numberoneschools.com' }}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
              : 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
          }
          onMessage={handleMessage}
          scrollEnabled={false}
          style={{ flex: 1, backgroundColor: 'black' }}
        />

        {/* Overlay Tap Handler to Toggle Controls */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={triggerShowControls}
        />

        {/* Loading Spinner */}
        {(loading || playerState === 3) && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {/* Custom Controls Overlay */}
        {showControls && !loading && !error && (
          <View style={styles.controlsOverlay}>
            {/* Center: إرجاع 10 ثوانٍ — تشغيل/إيقاف — تقديم 10 ثوانٍ */}
            <View style={styles.centerControlRow}>
              <TouchableOpacity
                onPress={() => skipBy(-SKIP_SECONDS)}
                style={styles.skipButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <RotateCcw size={22} color="#ffffff" />
                <Text style={styles.skipLabel}>{SKIP_SECONDS}</Text>
              </TouchableOpacity>

              {playerState === 1 ? (
                <TouchableOpacity onPress={pause} style={styles.controlButtonCircle}>
                  <Pause size={28} color="#ffffff" fill="#ffffff" />
                </TouchableOpacity>
              ) : playerState === 0 ? (
                <TouchableOpacity onPress={() => seekTo(0)} style={styles.controlButtonCircle}>
                  <RotateCcw size={28} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={play} style={styles.controlButtonCircle}>
                  <Play size={28} color="#ffffff" fill="#ffffff" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => skipBy(SKIP_SECONDS)}
                style={styles.skipButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <RotateCw size={22} color="#ffffff" />
                <Text style={styles.skipLabel}>{SKIP_SECONDS}</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls Bar */}
            <View style={[styles.bottomControlsBar, { backgroundColor: 'rgba(3, 7, 18, 0.75)' }]}>
              <View style={styles.bottomRow}>
                {/* Time Display */}
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>

                {/* شريط التقدم — سحب حقيقي عبر PanResponder.
                    منطقة اللمس أعرض من الشريط المرئي (hitSlop رأسي) كي يسهل
                    الإمساك به بالإصبع على أندرويد. */}
                <View
                  {...panResponder.panHandlers}
                  onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  style={styles.progressBarWrapper}
                >
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: colors.accent,
                          width: `${progressPct}%`,
                        },
                      ]}
                    />
                  </View>
                  {/* مقبض يكبر أثناء السحب ليؤكد للمستخدم أن الإمساك تمّ */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.progressThumb,
                      {
                        backgroundColor: colors.accent,
                        left: `${progressPct}%`,
                        width: isSeeking ? 16 : 11,
                        height: isSeeking ? 16 : 11,
                        borderRadius: isSeeking ? 8 : 5.5,
                        marginLeft: isSeeking ? -8 : -5.5,
                        marginTop: isSeeking ? -8 : -5.5,
                      },
                    ]}
                  />
                </View>

                {/* Fullscreen Button */}
                <TouchableOpacity
                  onPress={() => setIsFullscreen(!fullscreenMode)}
                  style={styles.fullscreenButton}
                >
                  {fullscreenMode ? (
                    <Minimize2 size={18} color="#ffffff" />
                  ) : (
                    <Maximize2 size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Error Overlay */}
        {error && (
          <View style={styles.errorOverlay}>
            <AlertCircle size={28} color={colors.error} />
            <Text style={[styles.errorText, { color: '#ffffff', marginTop: SPACING.xs }]}>
              {error}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return renderPlayer(isFullscreen);
}

const styles = StyleSheet.create({
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    aspectRatio: undefined,
    borderRadius: 0,
    zIndex: 99999,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 3,
  },
  centerControlRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  skipButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLabel: {
    position: 'absolute',
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1,
  },
  controlButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bottomControlsBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  timeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: SPACING.sm,
  },
  progressBarWrapper: {
    flex: 1,
    height: 28,          // منطقة لمس أعرض ليسهل الإمساك بالإصبع
    justifyContent: 'center',
  },
  progressThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -5.5,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  fullscreenButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  errorContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
});
