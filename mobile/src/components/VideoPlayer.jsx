import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
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
} from 'lucide-react-native';
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
        setCurrentTime(data.currentTime || 0);
      } else if (data.event === 'progress') {
        setCurrentTime(data.currentTime || 0);
        setDuration(data.duration || 0);
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
    webViewRef.current?.postMessage(JSON.stringify({ command: 'seekTo', time }));
    webViewRef.current?.injectJavaScript(`
      if (window.player && typeof window.player.seekTo === 'function') {
        window.player.seekTo(${time}, true);
      }
      true;
    `);
  };

  const handleSeekPress = (e) => {
    if (progressBarWidth > 0 && duration > 0) {
      const { locationX } = e.nativeEvent;
      const ratio = locationX / progressBarWidth;
      const seekTime = ratio * duration;
      setCurrentTime(seekTime);
      seekTo(seekTime);
      triggerShowControls();
    }
  };

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
            {/* Center Play/Pause button */}
            <View style={styles.centerControlRow}>
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
            </View>

            {/* Bottom Controls Bar */}
            <View style={[styles.bottomControlsBar, { backgroundColor: 'rgba(3, 7, 18, 0.75)' }]}>
              <View style={styles.bottomRow}>
                {/* Time Display */}
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>

                {/* Progress Bar Container */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={handleSeekPress}
                  onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
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
                </TouchableOpacity>

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
    justifyContent: 'center',
    alignItems: 'center',
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
    height: 20,
    justifyContent: 'center',
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
