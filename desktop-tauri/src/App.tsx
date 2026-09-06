import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { onSessionExpired } from "./api/client";
import { auth, DeviceIdentity, SessionRestore } from "./auth/authService";
import { RouteId } from "./shell/routes";
import { SignInHarness } from "./SignInHarness";
import { Shell } from "./shell/Shell";

/**
 * Decides between the sign-in screen and the signed-in shell, once.
 *
 * The restore runs before anything is drawn, so a student who never signed out
 * lands in the app rather than watching a login form appear and vanish.
 * "unverified" counts as signed in: the tokens are there and the server could
 * not be asked, and sending a student to a form that cannot reach the server
 * either is a dead end they can only leave by finding a network.
 */
export default function App() {
  const [restore, setRestore] = useState<SessionRestore | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  const [harnessRoute, setHarnessRoute] = useState<RouteId | undefined>(undefined);
  const [harnessCourse, setHarnessCourse] = useState<number | undefined>(undefined);

  useEffect(() => {
    invoke<DeviceIdentity>("device_identity").then(setDevice).catch(() => undefined);

    const unsubscribe = onSessionExpired(() => setSignedIn(false));

    void (async () => {
      const outcome = await auth.restoreSession().catch<SessionRestore>(() => "rejected");
      setRestore(outcome);
      setSignedIn(outcome === "restored" || outcome === "unverified");
    })();

    return unsubscribe;
  }, []);

  // A layout review aid, development only.
  //
  // The window is excluded from screen capture and WebView2 does not expose its
  // DOM to automation, so the shell cannot be looked at from outside the app.
  // It is ordinary HTML though, so `?preview=shell` in the Vite dev server
  // renders the frame in a browser where it CAN be seen. Nothing in it talks to
  // Tauri, and the whole branch is dropped from a production build.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get("preview") === "shell") {
    return <Shell deviceType="Windows" onSignOut={() => undefined} />;
  }

  // Nothing is drawn until the store has been read: showing the sign-in form
  // for the moment it takes would be a flash of the wrong screen.
  if (restore === null) return <Booting />;

  if (signedIn) {
    return (
      <Shell
        initialRoute={harnessRoute}
        initialCourseId={harnessCourse}
        deviceType={device?.device_type ?? ""}
        onSignOut={async () => {
          await auth.signOut();
          setSignedIn(false);
        }}
      />
    );
  }

  return (
    <SignInHarness
      device={device}
      restore={restore}
      onSignedIn={(route) => {
        // "course:4" lands on that course's detail; anything else is a root.
        const detail = route?.startsWith("course:") ? Number(route.slice(7)) : undefined;
        setHarnessCourse(Number.isFinite(detail) ? detail : undefined);
        setHarnessRoute(detail ? "courses" : (route as RouteId | undefined));
        setSignedIn(true);
      }}
    />
  );
}

function Booting() {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-body text-ink-muted">جارٍ التحميل…</p>
    </div>
  );
}
