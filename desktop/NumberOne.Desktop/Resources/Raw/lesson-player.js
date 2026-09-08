/*
 * ============================================================================
 * lesson-player.js — the desktop lecture player, injected into the web view
 * ============================================================================
 *
 * Injected at document creation by SecurePlayerWebView, before any of the
 * page's own script runs. It replaces whatever the page rendered with a player
 * this app controls end to end.
 *
 * Why injected rather than served: the page only has to exist to give the frame
 * a real origin — YouTube answers a top-level navigation to /embed/ with
 * "Error 153" and needs a genuine referer. Everything visible is decided here,
 * in the desktop layer, so the player can change without a deploy.
 *
 * TWO CONCERNS LIVE HERE, and they are not equal.
 *
 * Protection — the shield, the disabled shortcuts, the neutered window.open.
 * This is a SECOND layer. The web view refuses navigation itself, through
 * PlayerNavigationPolicy, and that is the layer that actually holds; script in
 * a page can be bypassed. Do not weaken the C# side on the strength of this
 * file.
 *
 * Controls — everything below the protection block. These are built here rather
 * than taken from YouTube because YouTube's bar carries its logo, its share
 * button and a route out of the app. Ours carries what a student watching a
 * 40-minute lecture needs and nothing else.
 * ============================================================================
 */

(function () {
  "use strict";

  // ══ Protection ════════════════════════════════════════════════════════════

  window.open = function () { return null; };

  document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);
  document.addEventListener("dragstart", function (e) { e.preventDefault(); }, true);
  document.addEventListener("auxclick", function (e) { e.preventDefault(); }, true);

  // ══ Tuning ════════════════════════════════════════════════════════════════

  /**
   * How long the bar stays after the pointer stops.
   *
   * 2.5s: long enough to cross the bar and land on a button without it going
   * out from under the pointer, short enough that it is gone during actual
   * watching. The bar never hides while paused — a paused video with no
   * controls looks broken rather than tidy.
   */
  var IDLE_MS = 2500;

  var SKIP_SECONDS = 10;   // the skip buttons
  var ARROW_SECONDS = 5;   // finer, because arrows are held down
  var RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

  var VIDEO_ID = (function () {
    var m = /[?&]v=([A-Za-z0-9_-]{6,20})(?:&|$)/.exec(window.location.search);
    return m ? m[1] : "";
  })();

  var player = null;
  var ready = false;
  var ticker = null;
  var idleTimer = null;
  var scrubbing = false;
  var wasPlayingBeforeScrub = false;
  var rateIndex = 1;              // 1x
  var lastVolume = 100;
  var isFullscreen = false;

  function el(id) { return document.getElementById(id); }

  // ══ Icons ═════════════════════════════════════════════════════════════════
  //
  // Lucide (ISC), the same set the rest of the app uses — see
  // Resources/Styles/Icons.xaml. Kept as literal SVG here rather than shared
  // with the XAML dictionary because this file is injected into a web view and
  // cannot reach a MAUI resource.

  var ICON = {
    play   : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
    pause  : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M15 3H18a1 1 0 0 1 1 1V20a1 1 0 0 1 -1 1H15a1 1 0 0 1 -1 -1V4a1 1 0 0 1 1 -1Z M6 3H9a1 1 0 0 1 1 1V20a1 1 0 0 1 -1 1H6a1 1 0 0 1 -1 -1V4a1 1 0 0 1 1 -1Z"/></svg>',
    back   : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17 l-5-5 5-5 M18 17 l-5-5 5-5"/></svg>',
    fwd    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17 l5-5-5-5 M13 17 l5-5-5-5"/></svg>',
    vol    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z M16 9a5 5 0 0 1 0 6 M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>',
    mute   : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z M16.5 14.5 l5-5 M16.5 9.5 l5 5"/></svg>',
    expand : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    shrink : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3 M21 8h-3a2 2 0 0 1-2-2V3 M3 16h3a2 2 0 0 1 2 2v3 M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
  };

  // ══ Surface ═══════════════════════════════════════════════════════════════

  function build() {
    document.documentElement.setAttribute("dir", "ltr");

    document.head.innerHTML =
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">';

    var css = document.createElement("style");
    css.textContent = STYLE;
    document.head.appendChild(css);

    document.body.innerHTML =
      '<div id="stage">' +
        '<div id="frame"></div>' +

        // Hides YouTube's own chrome until the video is actually running.
        '<div id="cover"></div>' +

        '<div id="shield"></div>' +

        // A single large target while paused. The bar is small and at the
        // bottom; resuming should not require aiming.
        '<button id="big" type="button" aria-label="تشغيل">' + ICON.play + '</button>' +

        '<div id="note"><span>تعذّر تشغيل المحاضرة. تحقّق من الاتصال ثم أعد المحاولة.</span></div>' +

        '<div id="bar" role="group" aria-label="عناصر التحكّم">' +
          '<div id="seek" role="slider" tabindex="0" aria-label="موضع التشغيل"' +
               ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
            '<div id="rail">' +
              '<div id="buffer"></div>' +
              '<div id="played"><span id="knob"></span></div>' +
            '</div>' +
            '<div id="hoverTime"></div>' +
          '</div>' +

          '<div id="row">' +
            '<button class="btn" id="play" type="button" data-tip="تشغيل ‏(مسافة)">' + ICON.play + '</button>' +
            '<button class="btn skip" id="back" type="button" data-tip="ترجيع ١٠ ثوانٍ">' + ICON.back + '</button>' +
            '<button class="btn skip" id="fwd" type="button" data-tip="تقديم ١٠ ثوانٍ">' + ICON.fwd + '</button>' +

            // The slider is collapsed until the group is hovered or focused, so
            // the bar stays uncluttered at rest.
            '<div id="volGroup">' +
              '<button class="btn" id="mute" type="button" data-tip="كتم ‏(M)">' + ICON.vol + '</button>' +
              '<div id="volWrap">' +
                '<input id="vol" type="range" min="0" max="100" value="100" aria-label="مستوى الصوت">' +
              '</div>' +
            '</div>' +

            '<span id="time"><span id="at">0:00</span><span id="sep"> / </span><span id="of">0:00</span></span>' +

            '<span id="spacer"></span>' +

            '<button class="btn wide" id="rate" type="button" data-tip="سرعة التشغيل">1x</button>' +
            '<button class="btn" id="full" type="button" data-tip="ملء الشاشة ‏(F)">' + ICON.expand + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var STYLE = [
    "html,body{margin:0;height:100%;background:#0B0F16;overflow:hidden;direction:ltr}",
    "*{user-select:none;-webkit-user-select:none;-webkit-user-drag:none;box-sizing:border-box}",
    "#stage{position:absolute;inset:0;font-family:system-ui,'Segoe UI',sans-serif}",
    "#stage.idle{cursor:none}",
    "#frame{position:absolute;inset:0;border:0;width:100%;height:100%}",

    // Above the frame so YouTube is unreachable, below everything of ours.
    "#shield{position:absolute;inset:0;z-index:2;background:transparent}",

    // The shield stops YouTube being CLICKED; it is transparent, so it does
    // not stop YouTube being SEEN. Before playback starts the embed paints its
    // own title bar, channel avatar and "Watch on YouTube" link, and those were
    // showing through — the branding this player exists to remove, sitting in
    // plain view every time a lecture opened.
    //
    // The frame is cross-origin, so none of it can be restyled from here. It
    // can only be covered. Opaque in the player's own background, it reads as a
    // poster rather than a patch, and it is dropped for good the moment the
    // first frame plays so nothing is hidden from the student afterwards.
    "#cover{position:absolute;inset:0;z-index:2;background:#0B0F16;",
    "transition:opacity 260ms ease}",
    "#cover.off{opacity:0;pointer-events:none}",

    // ── Centre button ──
    "#big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);",
    "z-index:3;width:72px;height:72px;border-radius:50%;border:1px solid rgba(255,255,255,.24);",
    "background:rgba(11,15,22,.55);backdrop-filter:blur(4px);color:#fff;cursor:pointer;",
    "display:none;align-items:center;justify-content:center;padding:0;",
    "opacity:0;transition:opacity 180ms ease,transform 180ms ease}",
    "#big.on{display:flex;opacity:1;transform:translate(-50%,-50%) scale(1)}",
    "#big:hover{background:rgba(11,15,22,.75);border-color:rgba(255,255,255,.4)}",
    "#big svg{width:30px;height:30px;margin-left:3px}",   // optical centring
    "#big:focus-visible{outline:2px solid #fff;outline-offset:3px}",

    // ── Bar ──
    "#bar{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:6px 12px 10px;",
    "background:linear-gradient(to top,rgba(11,15,22,.92) 0%,rgba(11,15,22,.72) 55%,rgba(11,15,22,0) 100%);",
    "opacity:0;transform:translateY(8px);pointer-events:none;",
    "transition:opacity 200ms ease,transform 200ms ease}",
    "#bar.on{opacity:1;transform:translateY(0);pointer-events:auto}",

    // ── Seek ──
    // The hit area is 16px tall while the rail is 4px: a 4px drag target is a
    // fiddly one, and scrubbing is the control used most.
    "#seek{position:relative;height:16px;display:flex;align-items:center;cursor:pointer;",
    "touch-action:none}",
    "#rail{position:relative;width:100%;height:4px;border-radius:3px;",
    "background:rgba(255,255,255,.24);transition:height 120ms ease}",
    "#seek:hover #rail,#seek.dragging #rail,#seek:focus-visible #rail{height:6px}",
    "#buffer{position:absolute;left:0;top:0;height:100%;width:0;border-radius:3px;",
    "background:rgba(255,255,255,.32)}",
    "#played{position:absolute;left:0;top:0;height:100%;width:0;border-radius:3px;",
    "background:#E74C3C}",
    "#knob{position:absolute;right:-6px;top:50%;width:12px;height:12px;border-radius:50%;",
    "background:#fff;transform:translateY(-50%) scale(0);transition:transform 120ms ease;",
    "box-shadow:0 1px 4px rgba(0,0,0,.5)}",
    "#seek:hover #knob,#seek.dragging #knob,#seek:focus-visible #knob{transform:translateY(-50%) scale(1)}",
    "#seek:focus-visible{outline:none}",
    "#seek:focus-visible #rail{box-shadow:0 0 0 2px rgba(255,255,255,.75)}",

    // Time preview above the cursor while scrubbing.
    "#hoverTime{position:absolute;bottom:18px;transform:translateX(-50%);padding:2px 6px;",
    "border-radius:4px;background:rgba(11,15,22,.92);border:1px solid rgba(255,255,255,.18);",
    "color:#fff;font-size:11px;font-variant-numeric:tabular-nums;pointer-events:none;",
    "opacity:0;transition:opacity 120ms ease;white-space:nowrap}",
    "#hoverTime.on{opacity:1}",

    // ── Row ──
    "#row{display:flex;align-items:center;gap:4px;margin-top:2px}",
    "#spacer{flex:1}",

    ".btn{height:34px;min-width:34px;padding:0 6px;border:0;border-radius:6px;background:none;",
    "color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;",
    "position:relative;transition:background 140ms ease,color 140ms ease}",
    ".btn svg{width:19px;height:19px;display:block}",
    ".btn:hover{background:rgba(255,255,255,.16)}",
    ".btn:active{background:rgba(255,255,255,.24)}",
    ".btn:focus-visible{outline:2px solid #fff;outline-offset:-2px}",
    ".btn.wide{min-width:42px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;",
    "letter-spacing:.01em}",

    // ── Tooltips ──
    // Own element rather than title=, which waits about a second and then
    // draws an OS tooltip that does not match anything else here.
    ".btn::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;",
    "transform:translateX(-50%) translateY(4px);padding:3px 8px;border-radius:5px;",
    "background:rgba(11,15,22,.95);border:1px solid rgba(255,255,255,.16);color:#fff;",
    "font-size:11px;line-height:1.5;white-space:nowrap;opacity:0;pointer-events:none;",
    "transition:opacity 120ms ease,transform 120ms ease;direction:rtl}",
    ".btn:hover::after,.btn:focus-visible::after{opacity:1;transform:translateX(-50%) translateY(0)}",

    // ── Volume ──
    // Collapsed to zero width at rest; opens on hover or keyboard focus, so it
    // is reachable without a pointer.
    "#volGroup{display:flex;align-items:center}",
    "#volWrap{width:0;overflow:hidden;transition:width 180ms ease,margin 180ms ease}",
    "#volGroup:hover #volWrap,#volGroup:focus-within #volWrap{width:76px;margin:0 6px 0 2px}",
    "#vol{width:76px;height:14px;-webkit-appearance:none;appearance:none;background:none;",
    "cursor:pointer;display:block}",
    "#vol::-webkit-slider-runnable-track{height:4px;border-radius:3px;",
    "background:linear-gradient(to right,#fff var(--v,100%),rgba(255,255,255,.28) var(--v,100%))}",
    "#vol::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;",
    "background:#fff;margin-top:-4px;box-shadow:0 1px 4px rgba(0,0,0,.5)}",
    "#vol:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:4px}",

    // ── Time ──
    "#time{color:#fff;font-size:12px;font-variant-numeric:tabular-nums;padding:0 8px;",
    "white-space:nowrap;letter-spacing:.01em}",
    "#sep,#of{color:rgba(255,255,255,.62)}",

    // ── Narrow windows ──
    // The app window can go to 1024, and the player scales with it. Order of
    // sacrifice: skip buttons, then the speed control. Play, seek, volume,
    // time and fullscreen always survive.
    "@media (max-width:560px){.skip{display:none}}",
    "@media (max-width:420px){#rate{display:none}#time{padding:0 4px;font-size:11px}}",
    "@media (max-width:360px){#volGroup:hover #volWrap,#volGroup:focus-within #volWrap{width:52px}}",

    // ── Error ──
    "#note{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;",
    "align-items:center;justify-content:center;gap:12px;padding:0 40px;text-align:center;",
    "direction:rtl;color:rgba(255,255,255,.86);font-size:13px;background:#0B0F16}",
    "#note.on{display:flex}",

    // Anyone who prefers less motion gets none of the transitions.
    "@media (prefers-reduced-motion:reduce){*{transition:none!important}}"
  ].join("");

  // ══ Playback ══════════════════════════════════════════════════════════════

  function start() {
    var api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);

    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player("frame", {
        videoId: VIDEO_ID,
        playerVars: {
          controls: 0,        // no YouTube bar, so no logo and no share
          disablekb: 1,       // its shortcuts open menus; ours are below
          modestbranding: 1,
          rel: 0,
          fs: 0,              // its fullscreen button; ours talks to the host
          iv_load_policy: 3,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: onReady,
          onStateChange: onStateChange,
          onError: function () { el("note").classList.add("on"); }
        }
      });
    };
  }

  function onReady() {
    ready = true;

    setVolume(player.getVolume());

    // Over the poster, so the lecture opens on a play button rather than a
    // blank rectangle.
    el("big").classList.add("on");

    show();
    ticker = setInterval(tick, 200);
  }

  function onStateChange(e) {
    var playing = e.data === YT.PlayerState.PLAYING;

    // Once only. Pausing keeps the frame the student stopped on — blanking a
    // slide someone paused to read would defeat the reason they paused.
    if (playing) el("cover").classList.add("off");

    el("play").innerHTML = playing ? ICON.pause : ICON.play;
    el("play").setAttribute("data-tip", playing ? "إيقاف مؤقّت ‏(مسافة)" : "تشغيل ‏(مسافة)");

    // The centre button is a resume affordance, so it belongs to paused and
    // ended — never to buffering, which would make it flicker mid-stream.
    var paused = e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED;
    el("big").classList.toggle("on", paused);

    if (playing) idle(); else show();
  }

  function toggle() {
    if (!ready) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }

  function seekBy(seconds) {
    if (!ready) return;
    var to = Math.max(0, Math.min(player.getDuration() || 0, player.getCurrentTime() + seconds));
    player.seekTo(to, true);
    paint(to, player.getDuration());
    show();
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));

    if (ready) { player.setVolume(v); if (v > 0) player.unMute(); }
    if (v > 0) lastVolume = v;

    var input = el("vol");
    input.value = v;
    input.style.setProperty("--v", v + "%");

    var muted = v === 0;
    el("mute").innerHTML = muted ? ICON.mute : ICON.vol;
    el("mute").setAttribute("data-tip", muted ? "إلغاء الكتم ‏(M)" : "كتم ‏(M)");

    // Two arcs, so the icon shows roughly how loud it is rather than only
    // whether it is on.
    var w1 = document.querySelector("#mute .w1");
    if (w1) w1.style.opacity = v >= 60 ? "1" : "0";
  }

  function toggleMute() {
    setVolume(Number(el("vol").value) === 0 ? lastVolume : 0);
    show();
  }

  function clock(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.floor(s % 60);

    // Hours only when there are hours: "1:04:20" for a long lecture, "4:20"
    // for a short one, rather than a permanent "0:" nobody reads.
    return h > 0
      ? h + ":" + (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r
      : m + ":" + (r < 10 ? "0" : "") + r;
  }

  function paint(at, of) {
    var ratio = of ? Math.max(0, Math.min(1, at / of)) : 0;

    el("played").style.width = (ratio * 100) + "%";
    el("at").textContent = clock(at);
    el("of").textContent = clock(of);
    el("seek").setAttribute("aria-valuenow", Math.round(ratio * 100));
    el("seek").setAttribute("aria-valuetext", clock(at) + " من " + clock(of));
  }

  function tick() {
    if (!ready || scrubbing) return;

    paint(player.getCurrentTime() || 0, player.getDuration() || 0);
    el("buffer").style.width = ((player.getVideoLoadedFraction() || 0) * 100) + "%";
  }

  // ══ Showing and hiding ════════════════════════════════════════════════════

  function show() {
    el("bar").classList.add("on");
    el("stage").classList.remove("idle");

    clearTimeout(idleTimer);
    idle();
  }

  function idle() {
    clearTimeout(idleTimer);

    idleTimer = setTimeout(function () {
      // Never while paused, mid-scrub, or while a control has keyboard focus —
      // hiding the thing someone is using is the classic version of this bug.
      if (!ready || scrubbing) return;
      if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;
      if (el("bar").contains(document.activeElement)) return;

      el("bar").classList.remove("on");
      el("stage").classList.add("idle");
    }, IDLE_MS);
  }

  // ══ Wiring ════════════════════════════════════════════════════════════════

  function ratioFromEvent(e) {
    var box = el("seek").getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  }

  function wire() {
    var stage = el("stage");

    stage.addEventListener("mousemove", show);
    stage.addEventListener("mouseleave", function () { if (ready) idle(); });

    el("shield").addEventListener("click", toggle);
    el("big").addEventListener("click", toggle);
    el("play").addEventListener("click", toggle);
    el("back").addEventListener("click", function () { seekBy(-SKIP_SECONDS); });
    el("fwd").addEventListener("click", function () { seekBy(SKIP_SECONDS); });
    el("mute").addEventListener("click", toggleMute);

    el("vol").addEventListener("input", function () { setVolume(Number(this.value)); });

    el("rate").addEventListener("click", function () {
      if (!ready) return;
      rateIndex = (rateIndex + 1) % RATES.length;
      player.setPlaybackRate(RATES[rateIndex]);
      this.textContent = RATES[rateIndex] + "x";
      show();
    });

    el("full").addEventListener("click", requestFullscreen);

    // ── Scrubbing ──
    // Pointer events, captured, so a drag that leaves the bar keeps working —
    // people overshoot, and a scrub that dies mid-gesture feels broken.
    var seek = el("seek");

    seek.addEventListener("pointerdown", function (e) {
      if (!ready) return;

      scrubbing = true;
      wasPlayingBeforeScrub = player.getPlayerState() === YT.PlayerState.PLAYING;

      seek.classList.add("dragging");
      seek.setPointerCapture(e.pointerId);
      scrubTo(e);
    });

    seek.addEventListener("pointermove", function (e) {
      if (!ready) return;

      preview(e);
      if (scrubbing) scrubTo(e);
    });

    seek.addEventListener("pointerup", function (e) {
      if (!scrubbing) return;

      scrubbing = false;
      seek.classList.remove("dragging");

      player.seekTo((player.getDuration() || 0) * ratioFromEvent(e), true);
      if (wasPlayingBeforeScrub) player.playVideo();

      show();
    });

    seek.addEventListener("pointerleave", function () {
      el("hoverTime").classList.remove("on");
    });

    // The seek bar is focusable, so it answers to arrows on its own too.
    seek.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); seekBy(ARROW_SECONDS); }
      if (e.key === "ArrowLeft") { e.preventDefault(); seekBy(-ARROW_SECONDS); }
    });

    function scrubTo(e) {
      var of = player.getDuration() || 0;
      var to = of * ratioFromEvent(e);

      // Seek live while dragging: the picture follows the thumb, which is what
      // makes finding a moment possible at all.
      player.seekTo(to, true);
      paint(to, of);
      preview(e);
    }

    function preview(e) {
      var of = player.getDuration() || 0;
      if (!of) return;

      var tip = el("hoverTime");
      var box = seek.getBoundingClientRect();

      tip.textContent = clock(of * ratioFromEvent(e));
      tip.style.left = Math.max(24, Math.min(box.width - 24, e.clientX - box.left)) + "px";
      tip.classList.add("on");
    }
  }

  // ── Keyboard ──
  // Only the handful a viewer reaches for. Everything that opens a window,
  // saves, prints or reveals source stays blocked.
  function keys() {
    document.addEventListener("keydown", function (e) {
      var k = (e.key || "").toLowerCase();

      if ((e.ctrlKey || e.metaKey) && ["n", "t", "p", "s", "u", "o", "w"].indexOf(k) >= 0) {
        e.preventDefault();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Let the focused control handle its own keys rather than acting twice.
      var onControl = el("bar").contains(document.activeElement) &&
                      document.activeElement !== document.body;

      switch (k) {
        case " ":
        case "spacebar":
        case "k":
          if (onControl && document.activeElement.tagName === "BUTTON") return;
          e.preventDefault(); toggle(); show();
          break;

        case "arrowright": if (onControl) return; e.preventDefault(); seekBy(ARROW_SECONDS); break;
        case "arrowleft":  if (onControl) return; e.preventDefault(); seekBy(-ARROW_SECONDS); break;

        case "arrowup":
          if (onControl) return;
          e.preventDefault(); setVolume(Number(el("vol").value) + 5); show();
          break;

        case "arrowdown":
          if (onControl) return;
          e.preventDefault(); setVolume(Number(el("vol").value) - 5); show();
          break;

        case "m": e.preventDefault(); toggleMute(); break;
        case "f": e.preventDefault(); requestFullscreen(); break;
        case "escape": if (isFullscreen) { e.preventDefault(); requestFullscreen(); } break;
      }
    }, true);
  }

  // ══ Fullscreen ════════════════════════════════════════════════════════════

  /**
   * Asks the app to expand, rather than calling the Fullscreen API.
   *
   * requestFullscreen() inside this view fills the WEB VIEW, and the web view
   * is a fixed 920x518 box inside the lecture screen — so the page would go
   * "fullscreen" and nothing would visibly change. The host owns the layout, so
   * the host is asked. When it cannot be reached the button hides itself rather
   * than sitting there doing nothing.
   */
  function requestFullscreen() {
    if (!host()) return;

    isFullscreen = !isFullscreen;
    host().postMessage(JSON.stringify({ type: "fullscreen", on: isFullscreen }));

    el("full").innerHTML = isFullscreen ? ICON.shrink : ICON.expand;
    el("full").setAttribute("data-tip", isFullscreen ? "إنهاء ملء الشاشة ‏(F)" : "ملء الشاشة ‏(F)");
    show();
  }

  function host() {
    return (window.chrome && window.chrome.webview) ? window.chrome.webview : null;
  }

  // ══ Boot ══════════════════════════════════════════════════════════════════

  function boot() {
    if (!VIDEO_ID) return;

    build();
    wire();
    keys();

    // Mac Catalyst has no host channel, so there is nothing to expand into.
    if (!host()) el("full").style.display = "none";

    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("pagehide", function () {
    if (ticker) { clearInterval(ticker); ticker = null; }
    clearTimeout(idleTimer);
  });
})();
