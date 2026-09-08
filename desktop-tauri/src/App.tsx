import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  auth,
  BoundDeviceInfo,
  DeviceIdentity,
  SessionRestore,
} from "./auth/authService";
import {
  harnessCredentials,
  harnessLog,
  probeLesson,
  reportRendered,
} from "./harness";
import { BlockedKind, BlockedScreen } from "./screens/BlockedScreen";
import { VirtualMachineScreen } from "./screens/VirtualMachineScreen";
import { RouteId } from "./shell/routes";
import { LoginScreen } from "./screens/LoginScreen";
import { Detail, Shell } from "./shell/Shell";

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
  const [harnessRoute, setHarnessRoute] = useState<RouteId | undefined>(
    undefined,
  );
  const [harnessDetail, setHarnessDetail] = useState<Detail | undefined>(
    undefined,
  );
  const [blocked, setBlocked] = useState<Blocked | null>(null);

  /**
   * Detected in Rust at startup, before anything is drawn. `undefined` means
   * the answer has not arrived yet; `null` means real hardware.
   */
  const [virtualized, setVirtualized] = useState<string | null | undefined>(
    undefined,
  );

  /**
   * Resolves NUMBERONE_HARNESS_ROUTE.
   *
   * A bare route id is a root. "kind:id" opens a detail — "course:4",
   * "exam:12", "attempt:7", "blocked:device" — which is the only way to reach a
   * screen that has no route of its own, and so the only way to verify one at
   * all. A lecture takes two, "lesson:12:4", because its unit rail cannot be
   * built without knowing the course.
   */
  function land(route?: string) {
    const [kind, first, second] = route?.split(":") ?? [];

    // A measurement run rather than a screen: it reports what the server
    // actually returns for a lecture, and then stops. Reached from both the
    // restore path and a fresh sign-in, which is why it lives here.
    if (kind === "probe") {
      void probeLesson();
      return;
    }

    // The two chrome states that cannot be reached by clicking: one needs the
    // machine's network to drop, the other needs a refresh token to be refused.
    // Both are raised as the REAL signal rather than through a test-only path,
    // so what gets verified is the code that actually runs.
    if (kind === "chrome") {
      window.setTimeout(() => {
        if (first === "offline") window.dispatchEvent(new Event("offline"));
        if (first === "expired")
          void import("./api/client").then((m) => m.raiseSessionExpired());
      }, 2500);
      return;
    }

    // The blocked screens cannot be reached without an account that is
    // genuinely bound elsewhere, so this is the only way to look at them.
    // Unreachable in a release build: the route comes from harness_credentials,
    // which is compiled out.
    if (kind === "blocked") {
      setBlocked({
        kind:
          first === "device"
            ? "device-bound-to-another-student"
            : "account-bound-elsewhere",
        boundDevice: null,
      });
      return;
    }

    const id = Number(first);

    if (Number.isFinite(id)) {
      const detail = toDetail(kind, id);

      if (detail?.kind === "lesson" && Number.isFinite(Number(second))) {
        detail.courseId = Number(second);
      }

      if (detail) {
        setHarnessDetail(detail);
        setHarnessRoute(rootOf(detail));
        return;
      }
    }

    setHarnessDetail(undefined);
    setHarnessRoute(route as RouteId | undefined);
  }

  useEffect(() => {
    invoke<string | null>("virtualization_finding")
      .then((finding) => setVirtualized(finding ?? null))
      // A refusal that cannot be read is not a pass. If the command is
      // unreachable the app is not the app we built, so it does not start.
      .catch(() => setVirtualized("تعذّر التحقّق من نوع الجهاز"));

    invoke<DeviceIdentity>("device_identity")
      .then(setDevice)
      .catch(() => undefined);

    void (async () => {
      const outcome = await auth
        .restoreSession()
        .catch<SessionRestore>(() => "rejected");
      const restored = outcome === "restored" || outcome === "unverified";

      // A restored session never reaches the sign-in screen, so the harness is
      // honoured here too — otherwise the second run of any verification lands
      // on the default route and reports nothing. Read BEFORE the shell is
      // shown: it takes its route once, when it mounts.
      const creds = await harnessCredentials();
      if (creds) await harnessLog(`restore=${outcome}`);

      setRestore(outcome);
      setSignedIn(restored);

      if (!creds) return;

      // The harness drives the REAL screen rather than replacing it.
      //
      // The sign-in used to live in a stand-in screen, which meant the thing
      // being verified was never the thing that ships. Now it signs in through
      // the same authService call the form submits, and the form is what is on
      // screen throughout — so a verification run exercises the shipped path.
      if (!restored) {
        const result = await auth.signIn(creds.username, creds.password);
        await harnessLog(
          `signIn=${result.kind}` +
            ("reason" in result ? ` reason=${result.reason}` : ""),
        );

        if (result.kind !== "success") return;
        setSignedIn(true);
      }

      land(creds.route ?? undefined);
      reportRendered();
    })();
  }, []);

  // A layout review aid, development only.
  //
  // The window is excluded from screen capture and WebView2 does not expose its
  // DOM to automation, so the shell cannot be looked at from outside the app.
  // It is ordinary HTML though, so `?preview=shell` in the Vite dev server
  // renders the frame in a browser where it CAN be seen. Nothing in it talks to
  // Tauri, and the whole branch is dropped from a production build.
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("preview") === "shell"
  ) {
    return <Shell deviceType="Windows" onSignOut={() => undefined} />;
  }

  // Ahead of EVERYTHING — before the session is even considered.
  //
  // On a guest, capture protection reports success while the host records the
  // window, so the app would promise something it cannot deliver. Nothing is
  // shown until this answers, because a lecture flashing up and then being
  // withdrawn is worse than a moment's wait.
  if (virtualized === undefined) return null;
  if (virtualized !== null)
    return <VirtualMachineScreen finding={virtualized} />;

  // Ahead of the shell: a student whose account is bound elsewhere has no
  // session to show, and the screen has no sidebar for the same reason.
  if (blocked) {
    return (
      <BlockedScreen
        kind={blocked.kind}
        deviceId={device?.id ?? ""}
        boundDevice={blocked.boundDevice}
        onBackToLogin={() => setBlocked(null)}
      />
    );
  }

  if (signedIn) {
    return (
      <Shell
        initialRoute={harnessRoute}
        initialDetail={harnessDetail}
        deviceType={device?.device_type ?? ""}
        onSignOut={async () => {
          await auth.signOut();
          setSignedIn(false);
        }}
      />
    );
  }

  // `restore === null` reaches the screen rather than being intercepted here:
  // the login page owns that moment, showing the mark and a line while the
  // stored session is checked, so nothing flashes and nothing is drawn twice.
  return (
    <LoginScreen
      device={device}
      restore={restore}
      onSignedIn={() => setSignedIn(true)}
      onBlocked={setBlocked}
    />
  );
}

/** Which blocked screen to show, and what its detail card can carry. */
interface Blocked {
  kind: BlockedKind;
  boundDevice: BoundDeviceInfo | null;
}

/** The detail a "kind:id" harness route names, or nothing for an unknown kind. */
function toDetail(kind: string | undefined, id: number): Detail | undefined {
  switch (kind) {
    case "course":
      return { kind: "course", courseId: id };
    case "exam":
      return { kind: "exam", examId: id };
    case "attempt":
      return { kind: "attempt", attemptId: id };
    // The course id arrives separately; the rail cannot be built without it.
    case "lesson":
      return { kind: "lesson", lessonId: id, courseId: 0 };
    default:
      return undefined;
  }
}

/** The root a detail belongs under, so leaving it lands somewhere real. */
function rootOf(detail: Detail): RouteId {
  switch (detail.kind) {
    case "attempt":
      return "results";
    case "exam":
      return "exams";
    default:
      return "courses";
  }
}
