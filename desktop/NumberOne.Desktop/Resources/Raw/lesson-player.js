/*
 * ============================================================================
 * lesson-player.js — the desktop lecture player, injected into the web view
 * ============================================================================
 *
 * Injected at document creation by SecurePlayerWebView, before any of the
 * page's own script runs. It replaces whatever the page rendered with a player
 * this app controls end to end.
 *
 * Why injected rather than served: the page only has to exist to give the
 * frame a real origin — YouTube answers a top-level navigation to /embed/ with
 * "Error 153" and needs a genuine referer. Everything visible is decided here,
 * in the desktop layer, so the player can change without a deploy and cannot
 * drift from what the app enforces around it.
 *
 * What this file is responsible for:
 *
 *   - Rebuilding the frame with controls=0 and the JS API on, so YouTube draws
 *     no chrome of its own.
 *   - Covering the frame with a shield that swallows every click, because
 *     YouTube still paints a logo and a title in some states and neither can be
 *     restyled across origins.
 *   - Driving playback over postMessage, which the shield does not block.
 *   - Drawing the only controls the student gets: play, seek, mute, speed.
 *
 * What it is NOT responsible for: stopping navigation. Script in a page is the
 * wrong place for that — it can be bypassed and it cannot see a middle-click
 * that the host turns into a new window. The web view refuses navigation
 * itself, through PlayerNavigationPolicy. This file is the second layer, not
 * the only one.
 * ============================================================================
 */

(function () {
  "use strict";

  // ── Close the exits this layer can close ─────────────────────────────────
  //
  // The view refuses navigation regardless, so these are belt to that braces.
  // They matter because a blocked navigation still costs a flash of intent,
  // and because a script that opens a window and gets nothing may retry.

  window.open = function () { return null; };

  document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);
  document.addEventListener("dragstart", function (e) { e.preventDefault(); }, true);
  document.addEventListener("auxclick", function (e) { e.preventDefault(); }, true);

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();

    // Ctrl/Cmd shortcuts that open windows, print, save or view source.
    if ((e.ctrlKey || e.metaKey) && ["n", "t", "p", "s", "u", "o", "w"].indexOf(k) >= 0) {
      e.preventDefault();
      return;
    }

    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    if (k === "f") { e.preventDefault(); }          // no fullscreen: the surface is fixed
  }, true);

  var VIDEO_ID = readVideoId();

  /**
   * The id from the page's own query string.
   *
   * Read here rather than passed in, so injection needs no per-lecture
   * templating and the script is a static asset.
   */
  function readVideoId() {
    var match = /[?&]v=([A-Za-z0-9_-]{6,20})(?:&|$)/.exec(window.location.search);
    return match ? match[1] : "";
  }

  // ── The surface ──────────────────────────────────────────────────────────

  function build() {
    document.documentElement.setAttribute("dir", "ltr");

    document.head.innerHTML =
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">';

    var style = document.createElement("style");
    style.textContent = [
      "html,body{margin:0;height:100%;background:#0B0F16;overflow:hidden;direction:ltr}",
      "*{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}",
      "#stage{position:absolute;inset:0}",
      "#frame{position:absolute;inset:0;border:0;width:100%;height:100%}",
      // The shield. Above the frame, below the controls.
      "#shield{position:absolute;inset:0;background:transparent;z-index:2;cursor:pointer}",
      "#bar{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:10px 12px;",
      "background:rgba(11,15,22,.82);display:flex;flex-direction:column;gap:8px;",
      "font-family:system-ui,sans-serif;opacity:0;transition:opacity 160ms ease-out}",
      "#stage:hover #bar,#bar.on{opacity:1}",
      "#track{height:3px;border-radius:2px;background:rgba(255,255,255,.22);cursor:pointer}",
      "#fill{height:100%;width:0;border-radius:2px;background:#FFF}",
      "#row{display:flex;align-items:center;gap:12px}",
      ".btn{width:24px;height:24px;flex:none;display:flex;align-items:center;",
      "justify-content:center;cursor:pointer;background:none;border:0;padding:0;color:#FFF}",
      "#time{font-size:11px;color:#FFF;direction:ltr;font-variant-numeric:tabular-nums}",
      "#rate{margin-left:auto;font-size:11px;font-weight:500;color:#FFF;background:none;",
      "border:1px solid rgba(255,255,255,.28);border-radius:4px;padding:1px 6px;",
      "direction:ltr;cursor:pointer}",
      "#note{position:absolute;inset:0;z-index:4;display:none;flex-direction:column;",
      "align-items:center;justify-content:center;gap:12px;padding:0 40px;text-align:center;",
      "font-family:system-ui,sans-serif;direction:rtl;color:rgba(255,255,255,.86);",
      "font-size:13px;background:#0B0F16}",
      "#note.on{display:flex}"
    ].join("");
    document.head.appendChild(style);

    document.body.innerHTML =
      '<div id="stage">' +
        '<div id="frame"></div>' +
        '<div id="shield"></div>' +
        '<div id="note"><span>تعذّر تشغيل المحاضرة. تحقّق من الاتصال ثم أعد المحاولة.</span></div>' +
        '<div id="bar">' +
          '<div id="track"><div id="fill"></div></div>' +
          '<div id="row">' +
            '<button class="btn" id="play" title="تشغيل / إيقاف">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFF">' +
              '<path id="playIcon" d="M8 5v14l11-7z"></path></svg></button>' +
            '<button class="btn" id="mute" title="كتم الصوت">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" ' +
              'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M11 5 6 9H3v6h3l5 4V5Z"></path>' +
              '<path id="waves" d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8"></path></svg></button>' +
            '<span id="time">0:00 / 0:00</span>' +
            '<button id="rate" title="سرعة التشغيل">1x</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── YouTube, driven over the API ─────────────────────────────────────────

  var player = null;
  var ready = false;
  var ticker = null;

  function el(id) { return document.getElementById(id); }

  function start() {
    var api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);

    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player("frame", {
        videoId: VIDEO_ID,
        playerVars: {
          controls: 0,        // no YouTube control bar, so no logo and no share
          disablekb: 1,       // no YouTube keyboard shortcuts
          modestbranding: 1,
          rel: 0,             // no grid of other channels' videos on pause
          fs: 0,              // no fullscreen button
          iv_load_policy: 3,  // no annotation cards
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: function () {
            ready = true;
            el("bar").classList.add("on");
            setTimeout(function () { el("bar").classList.remove("on"); }, 2000);
            ticker = setInterval(tick, 250);
          },
          onStateChange: function (e) {
            var playing = e.data === YT.PlayerState.PLAYING;
            el("playIcon").setAttribute(
              "d", playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
          },
          onError: function () { el("note").classList.add("on"); }
        }
      });
    };
  }

  function toggle() {
    if (!ready) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }

  function clock(s) {
    if (!isFinite(s)) return "0:00";
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function tick() {
    if (!ready) return;
    var at = player.getCurrentTime() || 0, of = player.getDuration() || 0;
    el("fill").style.width = (of ? (at / of) * 100 : 0) + "%";
    el("time").textContent = clock(at) + " / " + clock(of);
  }

  function wire() {
    el("play").addEventListener("click", toggle);
    el("shield").addEventListener("click", toggle);

    el("mute").addEventListener("click", function () {
      if (!ready) return;
      if (player.isMuted()) { player.unMute(); el("waves").style.display = ""; }
      else { player.mute(); el("waves").style.display = "none"; }
    });

    var rates = [1, 1.25, 1.5, 0.75], i = 0;
    el("rate").addEventListener("click", function () {
      if (!ready) return;
      i = (i + 1) % rates.length;
      player.setPlaybackRate(rates[i]);
      el("rate").textContent = rates[i] + "x";
    });

    el("track").addEventListener("click", function (e) {
      if (!ready) return;
      var box = el("track").getBoundingClientRect();
      var ratio = (e.clientX - box.left) / box.width;
      player.seekTo(player.getDuration() * Math.max(0, Math.min(1, ratio)), true);
    });
  }

  function boot() {
    if (!VIDEO_ID) return;
    build();
    wire();
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("pagehide", function () {
    if (ticker) { clearInterval(ticker); ticker = null; }
  });
})();
