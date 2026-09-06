import { invoke } from "@tauri-apps/api/core";

/**
 * The development self-report.
 *
 * The window is excluded from screen capture and WebView2 does not expose its
 * DOM to UI Automation, so no screen in this app can be looked at from outside
 * it. It can report itself from inside, which is the difference between "the
 * dashboard renders" as a claim and as a measurement.
 *
 * Every command behind this is `#![cfg(debug_assertions)]` on the Rust side, so
 * a release build has nothing to call and each of these quietly does nothing.
 */

export interface HarnessCredentials {
  username: string;
  password: string;
  /** NUMBERONE_HARNESS_ROUTE — a route id, or "course:4" for a detail. */
  route: string | null;
}

export async function harnessCredentials(): Promise<HarnessCredentials | null> {
  return invoke<HarnessCredentials | null>("harness_credentials").catch(() => null);
}

export async function harnessLog(line: string): Promise<void> {
  await invoke("harness_log", { line }).catch(() => undefined);
}

/**
 * Writes out what the WebView actually drew, once the sections have landed.
 *
 * Called from wherever a session becomes usable — after a sign-in AND after a
 * restore. A restored session skips the sign-in screen entirely, and reporting
 * only from there meant the second run of any verification silently measured
 * nothing at all.
 */
export function reportRendered(delayMs = 4000): void {
  window.setTimeout(() => {
    void harnessLog("--- rendered ---\n" + document.body.innerText.trim());
  }, delayMs);
}

/**
 * Reports what the server actually returns for a lecture.
 *
 * Batch 5 turns on two things this repository currently only guesses at: the
 * shape of `youtube_embed_url`, and whether `academic/player/` exists at all.
 * Both are recorded in BLOCKERS as unverified, and both decide the player's
 * architecture — so they are measured through the app's own authenticated
 * client rather than assumed.
 *
 * Debug only, like everything else here.
 */
export async function probeLesson(): Promise<void> {
  const { request } = await import("./api/client");
  const { API_BASE, Endpoints } = await import("./api/endpoints");
  const { studentApi } = await import("./api/studentApi");

  const say = (line: string) => harnessLog(line);

  try {
    const courses = await studentApi.courses();
    const rows = courses.flatMap((c) =>
      c.units.flatMap((u) =>
        u.lessons.map((l) => ({ courseId: c.id, course: c.name, unit: u.name, lesson: l })),
      ),
    );

    await say(`courses=${courses.length} lessons=${rows.length}`);

    for (const row of rows) {
      await say(
        `lesson ${row.lesson.id} course ${row.courseId} "${row.lesson.title}" (${row.course} / ${row.unit})`,
      );
    }

    if (rows.length > 0) {
      const id = rows[0].lesson.id;
      const detail = await request<Record<string, unknown>>(`academic/my-lessons/${id}/`);
      await say("lesson payload:\n" + JSON.stringify(detail, null, 1));
    }
  } catch (cause) {
    await say("lesson probe failed: " + String(cause));
  }

  // Does the server serve the player page this client would point at?
  try {
    const { fetch } = await import("@tauri-apps/plugin-http");
    // Under /api/, which is where MAUI asks for it: ApiEndpoints.LessonPlayer
    // is resolved against the API base, not the site root. The site root
    // answers any path with the dashboard SPA, so testing there proves nothing.
    const url = new URL(Endpoints.lessonPlayer("XNHKgtNytXw"), API_BASE).toString();
    const response = await fetch(url, { method: "GET" });
    const body = await response.text();

    await say(`player page ${url} -> ${response.status} ${response.headers.get("content-type") ?? ""}`);
    await say("player page body (first 1500):\n" + body.slice(0, 1500));
  } catch (cause) {
    await say("player page probe failed: " + String(cause));
  }

  await say("probe done");
}
