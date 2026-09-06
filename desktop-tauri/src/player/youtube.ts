import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Talking to a YouTube embed, over postMessage, with no Google script loaded.
 *
 * The official iframe_api.js is a thin wrapper over exactly this protocol. Using
 * the protocol directly means the CSP needs NO script-src exception for
 * youtube.com — the app loads no third-party code at all, and the only thing
 * that crosses the boundary is JSON.
 *
 * The frame is sandboxed WITHOUT `allow-top-navigation` and WITHOUT
 * `allow-popups`, which is what actually keeps a student inside the app: the
 * browser refuses those, so there is no handler to fail and no YouTube markup
 * change that can reopen the door. See src-tauri/src/player_policy.rs for how
 * the three layers fit together.
 */

/** YT.PlayerState. */
export const PlayerState = {
  Unstarted: -1,
  Ended: 0,
  Playing: 1,
  Paused: 2,
  Buffering: 3,
  Cued: 5,
} as const;

export interface PlayerStatus {
  /** True once the embed has answered at least once. */
  ready: boolean;
  state: number;
  currentTime: number;
  duration: number;
  /** 0–100, as YouTube reports it. */
  volume: number;
  muted: boolean;
  rate: number;
}

const Initial: PlayerStatus = {
  ready: false,
  state: PlayerState.Unstarted,
  currentTime: 0,
  duration: 0,
  volume: 100,
  muted: false,
  rate: 1,
};

/** The origins an embed is served from, and the only ones we will talk to. */
const EmbedOrigins = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

/**
 * Asks Rust for the URL to frame. Null when the id is not one.
 *
 * NOT BUILT HERE, deliberately. The string that ends up in the frame and the
 * allowlist that judges it belong in the same file, and that file is
 * src-tauri/src/player_policy.rs — where it is checked against its own output
 * and covered by tests. A URL assembled here would be a URL the policy merely
 * agrees with rather than one it governs.
 */
export async function embedUrl(videoId: string): Promise<string | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string | null>("player_frame_url", {
      videoId,
      origin: window.location.origin,
    });
  } catch {
    return null;
  }
}

interface Commands {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  setRate: (rate: number) => void;
}

/**
 * Drives one embed. Returns the status it reports and the commands it accepts.
 *
 * Every message is checked against the embed origins before it is read: a page
 * receives postMessage from anything that has a handle on it, and this window
 * frames third-party content.
 */
export function useYouTube(frame: React.RefObject<HTMLIFrameElement>): PlayerStatus & Commands {
  const [status, setStatus] = useState<PlayerStatus>(Initial);

  // The rate has to be remembered here: YouTube reports playbackRate only in
  // some deliveries, and reading it back as undefined would reset the control
  // to 1x under a student who had chosen 1.5x.
  const rateRef = useRef(1);

  const post = useCallback(
    (message: Record<string, unknown>) => {
      const target = frame.current?.contentWindow;
      if (!target) return;

      // Posting to a specific origin rather than "*": the message names a
      // video and a position, and "*" would deliver it to whatever happens to
      // occupy the frame.
      for (const origin of EmbedOrigins) {
        try {
          target.postMessage(JSON.stringify({ ...message, id: 1, channel: "widget" }), origin);
        } catch {
          // A frame mid-navigation. The next tick posts again.
        }
      }
    },
    [frame],
  );

  const command = useCallback(
    (func: string, args: unknown[] = []) => post({ event: "command", func, args }),
    [post],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!EmbedOrigins.includes(event.origin)) return;
      if (typeof event.data !== "string") return;

      let payload: { event?: string; info?: Record<string, unknown> };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      const info = payload.info;
      if (!info) return;

      setStatus((current) => {
        const next: PlayerStatus = { ...current, ready: true };

        if (typeof info.currentTime === "number") next.currentTime = info.currentTime;
        if (typeof info.duration === "number") next.duration = info.duration;
        if (typeof info.playerState === "number") next.state = info.playerState;
        if (typeof info.volume === "number") next.volume = info.volume;
        if (typeof info.muted === "boolean") next.muted = info.muted;

        if (typeof info.playbackRate === "number") rateRef.current = info.playbackRate;
        next.rate = rateRef.current;

        return next;
      });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The handshake. The embed only starts delivering once it has been told
  // somebody is listening, and it can miss the first attempt while it is still
  // loading — so it is repeated until an answer arrives.
  useEffect(() => {
    if (status.ready) return;

    post({ event: "listening" });
    const id = window.setInterval(() => post({ event: "listening" }), 500);

    return () => window.clearInterval(id);
  }, [status.ready, post]);

  return {
    ...status,
    play: useCallback(() => command("playVideo"), [command]),
    pause: useCallback(() => command("pauseVideo"), [command]),
    seekTo: useCallback((seconds: number) => command("seekTo", [Math.max(0, seconds), true]), [command]),
    setVolume: useCallback((volume: number) => command("setVolume", [volume]), [command]),
    mute: useCallback(() => command("mute"), [command]),
    unMute: useCallback(() => command("unMute"), [command]),
    setRate: useCallback(
      (rate: number) => {
        rateRef.current = rate;
        command("setPlaybackRate", [rate]);
      },
      [command],
    ),
  };
}

/** "12:04", or "1:02:33" once the hour matters. Always LTR. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
