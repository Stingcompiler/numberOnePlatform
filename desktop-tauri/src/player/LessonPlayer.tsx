import { useEffect, useRef, useState } from "react";

import { harnessLog } from "../harness";
import { Icon } from "../ui/Icon";
import { PlayerState, clock, embedUrl, useYouTube } from "./youtube";

/**
 * The lecture surface: the picture, the watermark, and our own controls.
 *
 * THE SIZE IS FIXED AT 920 × 518 — an 11in 16:9 diagonal at 96 DPI. It is both
 * a size and a maximum: the picture never renders larger however wide the
 * window, and where the column is narrower it scales down about its centre
 * rather than cropping. Fullscreen is not an exception to it either; what
 * fullscreen removes is everything AROUND the picture.
 *
 * The controls are ours, not YouTube's. YouTube's bar carries its logo, its
 * share button and a route out of the app; this one carries what a student
 * watching a forty-minute lecture needs and nothing else.
 */

export const VideoWidth = 920;
export const VideoHeight = 518;

/** The skip buttons, and the finer step the arrow keys take. */
const SkipSeconds = 10;
const ArrowSeconds = 5;
const Rates = [0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Seconds between watermark repositions. The design says 15–20; a fixed 17 sits
 * inside that and keeps the movement from syncing with anything a student could
 * time.
 */
const MoveEverySeconds = 17;

/** How long the bar stays after the pointer stops. */
const IdleMs = 2500;

interface Props {
  videoId: string;
  /** Name and phone for the overlay. */
  watermarkName: string;
  watermarkPhone: string;
  fullscreen: boolean;
  onFullscreen: (on: boolean) => void;
}

export function LessonPlayer({
  videoId,
  watermarkName,
  watermarkPhone,
  fullscreen,
  onFullscreen,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useYouTube(frame);

  // The frame's src comes from Rust, so the allowlist that judges it is the
  // thing that produced it. Null means the id was not one — an empty frame
  // rather than a frame pointed at a guess.
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void embedUrl(videoId).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [videoId]);

  const playing = player.state === PlayerState.Playing;

  // Whether the embed ever answered. There is no other way to know: the window
  // is excluded from screen capture, the picture is drawn by a cross-origin
  // frame, and "the video plays" would otherwise be a claim rather than a
  // measurement. Debug only — harnessLog is compiled out of a release build.
  useEffect(() => {
    if (!player.ready) return;
    void harnessLog(`player ready duration=${Math.round(player.duration)}s state=${player.state}`);
  }, [player.ready, player.duration, player.state]);

  // ── The bar ────────────────────────────────────────────────────────────
  // Never hidden while paused: a paused video with no controls looks broken
  // rather than tidy.
  const [barVisible, setBarVisible] = useState(true);
  const idleTimer = useRef<number>();

  function wake() {
    setBarVisible(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setBarVisible(false), IdleMs);
  }

  useEffect(() => {
    if (!playing) {
      window.clearTimeout(idleTimer.current);
      setBarVisible(true);
    }
    return () => window.clearTimeout(idleTimer.current);
  }, [playing]);

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never steal a key from a field: the exercise sits on the same screen.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          playing ? player.pause() : player.play();
          break;
        // In an RTL interface the arrows still mean forward and back along the
        // TIMELINE, which runs left to right inside the picture.
        case "ArrowLeft":
          event.preventDefault();
          player.seekTo(player.currentTime - ArrowSeconds);
          break;
        case "ArrowRight":
          event.preventDefault();
          player.seekTo(player.currentTime + ArrowSeconds);
          break;
        case "f":
          onFullscreen(!fullscreen);
          break;
        case "Escape":
          if (fullscreen) onFullscreen(false);
          break;
        case "m":
          player.muted ? player.unMute() : player.mute();
          break;
        default:
          return;
      }

      wake();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Watermark ──────────────────────────────────────────────────────────
  const [corner, setCorner] = useState(0);
  const [stamp, setStamp] = useState(() => timestamp());

  useEffect(() => {
    let ticks = 0;

    const id = window.setInterval(() => {
      setStamp(timestamp());

      ticks += 1;
      if (ticks >= MoveEverySeconds) {
        ticks = 0;
        setCorner((c) => (c + 1) % 4);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const progress =
    player.duration > 0 ? player.currentTime / player.duration : 0;

  return (
    <div
      onMouseMove={wake}
      onMouseLeave={() => playing && setBarVisible(false)}
      className="relative shrink-0 overflow-hidden rounded-panel bg-black"
      style={{
        width: VideoWidth,
        height: VideoHeight,
        maxWidth: "100%",
        aspectRatio: `${VideoWidth} / ${VideoHeight}`,
      }}
    >
      {/*
        The sandbox IS the protection, not a hint.

        Without `allow-top-navigation` the frame cannot move this window, and
        without `allow-popups` its window.open returns null — so "Watch on
        YouTube", the share sheet and a middle-click all do nothing, enforced by
        the browser rather than by a handler that could throw.

        allow-same-origin is required for the postMessage bridge and grants the
        frame nothing here: it is cross-origin either way.
      */}
      {src && (
        <iframe
          ref={frame}
          src={src}
          title="محاضرة"
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {/*
        Swallows every click that lands on the picture.

        YouTube still draws its title bar and its logo over a controls=0 player
        on hover, and both are links. The frame cannot navigate this window and
        cannot open one, so a click was already inert — this stops it being
        offered at all, and gives the surface its own play/pause.
      */}
      <button
        type="button"
        aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
        onClick={() => (playing ? player.pause() : player.play())}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
      />

      <Watermark
        corner={corner}
        name={watermarkName}
        phone={watermarkPhone}
        stamp={stamp}
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 transition-opacity",
          barVisible ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        // The bar is chrome over a left-to-right timeline; it does not mirror.
        dir="ltr"
      >
        <Scrubber
          fraction={progress}
          onSeek={(f) => player.seekTo(f * player.duration)}
          disabled={player.duration <= 0}
        />

        <div className="flex items-center gap-1 text-white">
          <Control
            label={playing ? "إيقاف مؤقت" : "تشغيل"}
            icon={playing ? "Pause" : "Play"}
            onClick={() => (playing ? player.pause() : player.play())}
          />
          <Control
            label="للخلف عشر ثوانٍ"
            icon="Rewind"
            onClick={() => player.seekTo(player.currentTime - SkipSeconds)}
          />
          <Control
            label="للأمام عشر ثوانٍ"
            icon="Forward"
            onClick={() => player.seekTo(player.currentTime + SkipSeconds)}
          />

          <Control
            label={player.muted ? "إلغاء الكتم" : "كتم"}
            icon={player.muted || player.volume === 0 ? "VolumeOff" : "Volume"}
            onClick={() => (player.muted ? player.unMute() : player.mute())}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={player.muted ? 0 : player.volume}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (player.muted && value > 0) player.unMute();
              player.setVolume(value);
            }}
            aria-label="مستوى الصوت"
            className="h-1 w-20 cursor-pointer accent-white"
          />

          <span className="ms-2 font-mono text-label tabular-nums text-white/90">
            {clock(player.currentTime)} / {clock(player.duration)}
          </span>

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => player.setRate(nextRate(player.rate))}
            aria-label="سرعة التشغيل"
            className="rounded px-2 py-1 font-mono text-label text-white/90 hover:bg-white/15"
          >
            {player.rate}x
          </button>

          <Control
            label={fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
            icon={fullscreen ? "Shrink" : "Expand"}
            onClick={() => onFullscreen(!fullscreen)}
          />
        </div>
      </div>
    </div>
  );
}

function nextRate(current: number): number {
  const at = Rates.indexOf(current);
  return Rates[(at < 0 ? 1 : at + 1) % Rates.length];
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/**
 * The overlay that makes a leak traceable.
 *
 * This is the layer that actually works everywhere: it does not stop a
 * recording, it makes one attributable — which in a school is the stronger
 * deterrent. It moves between the corners so it cannot be cropped out by
 * trimming one edge.
 */
function Watermark({
  corner,
  name,
  phone,
  stamp,
}: {
  corner: number;
  name: string;
  phone: string;
  stamp: string;
}) {
  const place = [
    "top-3 start-3",
    "top-3 end-3",
    "bottom-14 end-3",
    "bottom-14 start-3",
  ][corner];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute ${place} select-none rounded bg-black/25 px-2 py-1 text-white/45 transition-all duration-700`}
    >
      <div className="text-label leading-tight">{name}</div>
      <div className="ltr font-mono text-[10px] leading-tight">{phone}</div>
      <div className="ltr font-mono text-[10px] leading-tight">{stamp}</div>
    </div>
  );
}

function Scrubber({
  fraction,
  onSeek,
  disabled,
}: {
  fraction: number;
  onSeek: (fraction: number) => void;
  disabled: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);

  function seekFromEvent(clientX: number) {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    onSeek(Math.min(1, Math.max(0, (clientX - box.left) / box.width)));
  }

  return (
    <div
      ref={track}
      role="slider"
      aria-label="موضع التشغيل"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      tabIndex={0}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (disabled || e.buttons !== 1) return;
        seekFromEvent(e.clientX);
      }}
      className={`group h-3 ${disabled ? "cursor-default" : "cursor-pointer"} flex items-center`}
    >
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-200"
          style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Control({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded text-white/90 hover:bg-white/15"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
