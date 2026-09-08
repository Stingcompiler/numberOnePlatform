/*
 * Drives lesson-player.js under a real DOM with a stubbed YouTube API, so the
 * controls are exercised rather than eyeballed: does the bar build, do the
 * keys do what they claim, does the bar hide while playing and stay while
 * paused, does scrubbing seek.
 */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const script = fs.readFileSync(
  require("path").join(__dirname, "../../NumberOne.Desktop/Resources/Raw/lesson-player.js"),
  "utf8"
);

const dom = new JSDOM(
  `<!doctype html><html><head></head><body></body></html>`,
  {
    url: "https://numberoneschools.com/api/academic/player/?v=dQw4w9WgXcQ",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  }
);

const { window } = dom;

// ── Stub the player ────────────────────────────────────────────────────────
let state = 2, at = 12, dur = 754, vol = 100, muted = false, rate = 1;
const seeks = [];

window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 },
  Player: function (id, opts) {
    window.__events = opts.events;
    window.__vars = opts.playerVars;

    this.getPlayerState = () => state;
    this.playVideo = () => { state = 1; opts.events.onStateChange({ data: 1 }); };
    this.pauseVideo = () => { state = 2; opts.events.onStateChange({ data: 2 }); };
    this.getCurrentTime = () => at;
    this.getDuration = () => dur;
    this.getVideoLoadedFraction = () => 0.42;
    this.seekTo = (t) => { at = t; seeks.push(t); };
    this.getVolume = () => vol;
    this.setVolume = (v) => { vol = v; };
    this.isMuted = () => muted;
    this.mute = () => { muted = true; };
    this.unMute = () => { muted = false; };
    this.setPlaybackRate = (r) => { rate = r; };

    // The real API calls these; without them `ready` never flips and every
    // control looks dead.
    setTimeout(() => {
      opts.events.onReady();
      opts.events.onStateChange({ data: state });
    }, 0);
  },
};

// The script appends the real API tag; intercept it and fire the callback.
const realCreate = window.document.createElement.bind(window.document);
window.document.createElement = function (tag) {
  const node = realCreate(tag);
  if (tag === "script") {
    Object.defineProperty(node, "src", {
      set() { setTimeout(() => window.onYouTubeIframeAPIReady(), 0); },
      get() { return ""; },
    });
  }
  return node;
};

// Pretend to be WebView2 so the fullscreen control is present.
const posted = [];
window.chrome = { webview: { postMessage: (m) => posted.push(m) } };

window.eval(script);

const $ = (id) => window.document.getElementById(id);
const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass, detail: pass ? "" : detail });

const key = (k, opts = {}) =>
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts })
  );

setTimeout(() => {
  // ── Built ──
  check("bar is built", !!$("bar"));
  check("shield sits above the frame",
    !!$("shield") && $("shield").compareDocumentPosition($("frame")) & 2);

  const ids = [...window.document.querySelectorAll(".btn")].map((b) => b.id);
  check("all controls present",
    ["play", "back", "fwd", "mute", "rate", "full"].every((i) => ids.includes(i)),
    ids.join(","));

  const tips = [...window.document.querySelectorAll(".btn")].map((b) => b.dataset.tip);
  check("every button has a tooltip", tips.every((t) => t && t.length > 0), JSON.stringify(tips));

  // ── YouTube chrome stays off ──
  const v = window.__vars || {};
  check("youtube controls disabled",
    v.controls === 0 && v.disablekb === 1 && v.fs === 0 && v.rel === 0,
    JSON.stringify(v));

  // ── Time ──
  check("duration formatted", $("of").textContent === "12:34", $("of").textContent);
  check("elapsed formatted", $("at").textContent === "0:12", $("at").textContent);
  check("buffered painted", $("buffer").style.width === "42%", $("buffer").style.width);

  // ── Paused shows, playing hides ──
  check("centre button shows while paused", $("big").classList.contains("on"));
  check("bar visible while paused", $("bar").classList.contains("on"));

  // ── Space toggles ──
  key(" ");
  check("space starts playback", state === 1, "state=" + state);
  check("centre button hides on play", !$("big").classList.contains("on"));
  check("play icon becomes pause", $("play").dataset.tip.includes("إيقاف"), $("play").dataset.tip);

  // ── Arrows seek ──
  const before = at;
  key("ArrowRight");
  check("right arrow seeks forward", at > before, `${before} -> ${at}`);
  const mid = at;
  key("ArrowLeft");
  check("left arrow seeks back", at < mid, `${mid} -> ${at}`);

  // ── Volume ──
  key("ArrowDown");
  check("down arrow lowers volume", vol === 95, "vol=" + vol);
  key("ArrowUp");
  check("up arrow raises volume", vol === 100, "vol=" + vol);

  key("m");
  check("m mutes", Number($("vol").value) === 0, $("vol").value);
  check("mute icon swaps", $("mute").dataset.tip.includes("إلغاء"), $("mute").dataset.tip);
  key("m");
  check("m restores the previous level", Number($("vol").value) === 100, $("vol").value);

  // ── Speed ──
  $("rate").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  check("speed advances", rate === 1.25 && $("rate").textContent === "1.25x",
    `${rate} / ${$("rate").textContent}`);

  // ── Fullscreen talks to the host ──
  $("full").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  check("fullscreen posts to the host",
    posted.length === 1 && posted[0].includes('"fullscreen"') && posted[0].includes('"on":true'),
    JSON.stringify(posted));
  check("fullscreen icon swaps", $("full").dataset.tip.includes("إنهاء"), $("full").dataset.tip);
  $("full").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  check("fullscreen toggles back", posted[1].includes('"on":false'), posted[1]);

  // ── Skip buttons ──
  const beforeSkip = at;
  $("fwd").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  check("skip forward is 10s", Math.round(at - beforeSkip) === 10, `${beforeSkip} -> ${at}`);

  // ── Escape hatches stay shut ──
  check("window.open neutered", window.open() === null);

  const ctrlN = new window.KeyboardEvent("keydown", {
    key: "n", ctrlKey: true, bubbles: true, cancelable: true,
  });
  window.document.dispatchEvent(ctrlN);
  check("ctrl+N swallowed", ctrlN.defaultPrevented);

  const menu = new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  window.document.dispatchEvent(menu);
  check("context menu blocked", menu.defaultPrevented);

  check("no anchors anywhere", window.document.querySelectorAll("a").length === 0);

  // ── Auto-hide ──
  // Playing, no pointer, nothing focused: the bar should go.
  state = 1;
  $("stage").dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true }));
  check("movement shows the bar", $("bar").classList.contains("on"));

  setTimeout(() => {
    check("bar hides while playing", !$("bar").classList.contains("on"));
    check("cursor hides with it", $("stage").classList.contains("idle"));

    // Paused it must stay.
    state = 2;
    $("stage").dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true }));

    setTimeout(() => {
      check("bar stays while paused", $("bar").classList.contains("on"));

      const failed = results.filter((r) => !r.pass);
      for (const r of results) {
        console.log(`${r.pass ? "  ok  " : "  FAIL"}  ${r.name}${r.detail ? "  << " + r.detail : ""}`);
      }
      console.log(`\n${results.length - failed.length}/${results.length} passed`);
      process.exit(failed.length ? 1 : 0);
    }, 3000);
  }, 3000);
}, 1200);
