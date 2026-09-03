# player-check

Drives `NumberOne.Desktop/Resources/Raw/lesson-player.js` under a real DOM with
a stubbed YouTube API, so the lecture controls are exercised rather than
eyeballed.

The player is injected JavaScript, so the xUnit suite cannot reach it — but it
is also the screen a student spends the most time in, and the place the
content-protection rules are visible. This covers what those tests cannot:
that the bar builds, that every button carries a tooltip, that the keyboard
does what the tooltips claim, that the bar hides while playing and stays while
paused, that YouTube's own chrome is switched off, and that the escape
hatches — `window.open`, the context menu, Ctrl+N, stray anchors — stay shut.

Run it from this directory:

    npm install jsdom
    node check.js

It exits non-zero on the first failing assertion, so it can be wired into CI
as-is. It needs no network and no server: the YouTube API is stubbed, which is
also why it can assert on playerVars the real API would have swallowed.
