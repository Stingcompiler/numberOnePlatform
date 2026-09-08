import { fetch } from "@tauri-apps/plugin-http";

import { API_BASE, Endpoints, isAuthExempt } from "./endpoints";
import { extractMessage, isTransportFailure } from "./errors";
import { tokens } from "../auth/tokens";

/**
 * The HTTP client, with the refresh discipline the MAUI handler established.
 *
 * Two rules carried over verbatim, both of which cost a session when broken:
 *
 * ONE REFRESH FOR ANY NUMBER OF 401s. SimpleJWT rotates refresh tokens and
 * blacklists the old one, so two concurrent refreshes invalidate each other and
 * the student is signed out mid-screen. Every screen loads several sections at
 * once, so concurrent 401s are the normal case, not the rare one. Callers that
 * arrive while a refresh is running await that same promise.
 *
 * A REFUSED REFRESH IS NOT THE SAME AS AN UNREACHABLE ONE. The first ends the
 * session and clears the tokens; the second leaves them alone, because the
 * student is merely offline and their tokens are probably fine.
 */

/** Raised for a response the server refused, carrying its own message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Raised when the request never reached the server. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

type SessionListener = () => void;

const sessionExpiredListeners = new Set<SessionListener>();

/** Fires when the refresh token itself was refused: the session is over. */
export function onSessionExpired(listener: SessionListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/**
 * Raises the expiry as if the server had refused the refresh.
 *
 * The only way to reach that screen otherwise is to wait for a real refresh
 * token to be rejected, which is not something a verification run can arrange —
 * and a dialog nobody has ever seen is a dialog nobody knows is broken. Used by
 * the harness; there is no other caller.
 */
export function raiseSessionExpired(): void {
  sessionExpiredListeners.forEach((listener) => listener());
}

type RefreshOutcome = "succeeded" | "expired" | "unreachable";

/** The single in-flight refresh, shared by every caller that needs one. */
let inFlight: Promise<RefreshOutcome> | null = null;

async function runRefresh(): Promise<RefreshOutcome> {
  const refresh = (await tokens.get()).refresh;
  if (!refresh) return "expired";

  let response: Response;
  try {
    response = await fetch(new URL(Endpoints.refresh, API_BASE), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch (error) {
    // Offline. The tokens stay: they are probably fine, and clearing them
    // would sign a student out for losing their wifi.
    return isTransportFailure(error) ? "unreachable" : "expired";
  }

  if (!response.ok) return "expired";

  const pair = (await response.json()) as { access?: string; refresh?: string };
  if (!pair.access) return "expired";

  // The server rotates the refresh token, so the new one must be stored. Keeping
  // the old one would work exactly once more and then fail as blacklisted.
  await tokens.save(pair.access, pair.refresh ?? refresh);
  return "succeeded";
}

async function ensureRefreshed(staleToken: string | null): Promise<RefreshOutcome> {
  if (inFlight) return inFlight;

  // Another request may have refreshed between our 401 and this line. If the
  // stored token has moved on, our attempt was simply stale — replay with the
  // new one rather than spending a second refresh token.
  const current = (await tokens.get()).access;
  if (current && current !== staleToken) return "succeeded";

  inFlight = runRefresh().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * One request, with a bearer, a single refresh on 401, and one replay.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, API_BASE).toString();
  const exempt = isAuthExempt(url);

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      return await fetch(url, {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (error) {
      if (isTransportFailure(error)) throw new NetworkError(Messages.noConnection);
      throw error;
    }
  };

  const accessToken = exempt ? null : (await tokens.get()).access;
  let response = await send(accessToken);

  if (!exempt && response.status === 401) {
    const outcome = await ensureRefreshed(accessToken);

    if (outcome === "expired") {
      await tokens.clear();
      sessionExpiredListeners.forEach((listener) => listener());
    } else if (outcome === "succeeded") {
      const refreshed = (await tokens.get()).access;
      if (refreshed) response = await send(refreshed);
    }
    // "unreachable" falls through with the original 401: the app is offline,
    // the caller shows its own retry, and nothing is cleared.
  }

  return readBody<T>(response);
}

async function readBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiError(
      extractMessage(parsed) ?? Messages.serverFault,
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page from a proxy, most likely.
    return text;
  }
}

/**
 * Strings the client owns, for conditions the server has no message for.
 * Anything the server does have a message for is shown verbatim.
 */
export const Messages = {
  noConnection: "لا يوجد اتصال بالإنترنت. تحقّق من الشبكة ثم أعد المحاولة.",
  serverFault: "تعذّر الاتصال بالخادم. يرجى المحاولة لاحقاً.",
  unexpectedResponse: "استجابة غير متوقعة من الخادم. يرجى المحاولة لاحقاً.",
  sectionFailed: "تعذّر عرض هذا القسم. إن تكرر الأمر فأبلغ إدارة المدرسة.",
  studentsOnly: "هذا التطبيق مخصص للطلاب فقط. يرجى استخدام لوحة التحكم عبر المتصفح.",
  deviceIdUnavailable: "تعذّر تحديد معرّف هذا الجهاز. يرجى التواصل مع الإدارة.",
} as const;
