import { API_BASE, Endpoints } from "./endpoints";

/**
 * The school's public phone number, for "التواصل مع الإدارة".
 *
 * Read from /api/public/site-data/, which is AllowAny. That matters: the two
 * blocked screens are exactly where a student needs this number, and in both
 * cases there is NO SESSION — an authenticated endpoint would be useless there.
 *
 * Fetched through Rust like every other call, because the API sends no CORS
 * headers, but deliberately without the bearer: attaching a stale token to an
 * anonymous call could trip a pointless refresh on a screen with no session to
 * refresh.
 */

let cached: string | null = null;
let inFlight: Promise<string | null> | null = null;

interface SiteData {
  settings?: {
    institution_name?: string | null;
    primary_phone?: string | null;
    primary_email?: string | null;
  } | null;
}

/**
 * The number, or null when the server has none set or could not be reached.
 *
 * Callers must handle null by hiding the number rather than showing a
 * placeholder: a wrong number on a blocked screen is worse than no number.
 */
export async function administrationPhone(): Promise<string | null> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = fetchPhone().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function fetchPhone(): Promise<string | null> {
  try {
    // Imported lazily so this module does not pull the authenticated client's
    // refresh machinery onto a screen that has no session.
    const { fetch } = await import("@tauri-apps/plugin-http");

    const response = await fetch(API_BASE + Endpoints.siteData, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as SiteData;
    const phone = data?.settings?.primary_phone?.trim();

    // Not cached when absent, so a later attempt can still succeed.
    cached = phone ? phone : null;
    return cached;
  } catch {
    return null;
  }
}
