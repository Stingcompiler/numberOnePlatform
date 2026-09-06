import { invoke } from "@tauri-apps/api/core";

import { ApiError, Messages, NetworkError, request } from "../api/client";
import { Endpoints } from "../api/endpoints";
import { classifyLoginFailure, LoginFailureReason, ServerMessages } from "./messages";
import { tokens } from "./tokens";

/**
 * Sign-in, device binding and session restore.
 *
 * THE BINDING FLOW IS TWO-PHASE, and the reason is worth stating: the server
 * binds inside LoginSerializer.validate(), so a login carrying a device_id
 * binds atomically with no chance to ask first. Binding is a one-way door for
 * the student — only an administrator can undo it — and the design requires
 * confirmation before it happens.
 *
 * device_id is optional server-side and binding is skipped when it is absent.
 * So the first call omits it and reads StudentProfile.device_id off the reply:
 *
 *   null           → never bound. Hold the session, show the dialog, and on
 *                    confirmation log in again WITH the id.
 *   ours           → already bound to this machine. Proceed, no dialog.
 *   something else → bound elsewhere. Show the blocked screen — and unlike the
 *                    failed-login path, we learn which device and when.
 *
 * The shared-PC case (this machine already belongs to another student) cannot
 * be detected in advance and surfaces as a 400 on the confirming call.
 *
 * Cost is one extra round trip, on first bind only. The probe issues a token
 * pair that is then discarded; SimpleJWT blacklists refresh tokens on rotation
 * rather than on issue, so the unused pair simply expires.
 */

export interface StudentProfile {
  device_id?: string | null;
  device_type?: string | null;
  device_bound_at?: string | null;
  is_device_bound?: boolean;
  [key: string]: unknown;
}

export interface User {
  id: number;
  username: string;
  role?: string | null;
  student_profile?: StudentProfile | null;
  [key: string]: unknown;
}

export interface DeviceIdentity {
  id: string;
  device_type: string;
  machine_name: string;
}

export interface BoundDeviceInfo {
  deviceId: string | null;
  deviceType: string | null;
  boundAt: string | null;
}

/** A verified sign-in held back until the student confirms the bind. */
export interface PendingBind {
  username: string;
  /** Carried because binding needs a second login call; the server binds during login. */
  password: string;
  deviceId: string;
  deviceType: string;
  machineName: string;
  user: User;
}

export type LoginOutcome =
  | { kind: "success"; user: User }
  | { kind: "needs-device-binding"; pending: PendingBind }
  | { kind: "failed"; reason: LoginFailureReason; message: string; boundDevice?: BoundDeviceInfo };

/**
 * What a launch found in the token store.
 *
 * Four cases rather than a boolean, because two of them look like failure and
 * must not be treated alike. "rejected" means the session is over; "unverified"
 * means the app could not ask, which is not the student's problem and must not
 * cost them their session.
 */
export type SessionRestore = "none" | "restored" | "rejected" | "unverified";

function isStudent(user: User): boolean {
  return user.role === "student" || user.student_profile != null;
}

async function deviceIdentity(): Promise<DeviceIdentity | null> {
  try {
    return await invoke<DeviceIdentity>("device_identity");
  } catch {
    // A machine whose hardware id cannot be read must not be locked out of its
    // own session over a comparison that could not be made. The sign-in path
    // refuses to bind without an id, so nothing is weakened by being permissive.
    return null;
  }
}

class AuthService {
  private user: User | null = null;

  get currentUser(): User | null {
    return this.user;
  }

  /** Phase one. Verifies the credentials without binding anything. */
  async signIn(username: string, password: string): Promise<LoginOutcome> {
    let probe: { access: string; refresh: string; user?: User };

    try {
      probe = await request(Endpoints.login, { body: { username, password } });
    } catch (error) {
      return this.refusal(error);
    }

    const user = probe.user;
    if (!user) {
      return { kind: "failed", reason: "unknown", message: Messages.unexpectedResponse };
    }

    // This client is the student client. Staff have the web dashboard.
    if (!isStudent(user)) {
      return { kind: "failed", reason: "unknown", message: Messages.studentsOnly };
    }

    const device = await deviceIdentity();
    if (!device) {
      return { kind: "failed", reason: "unknown", message: Messages.deviceIdUnavailable };
    }

    const profile = user.student_profile ?? null;

    // Already bound to this machine — the ordinary case after first launch.
    if (profile && profile.device_id === device.id) {
      await this.commit(probe.access, probe.refresh, user);
      return { kind: "success", user };
    }

    // Bound to a different machine.
    if (profile && profile.is_device_bound) {
      return {
        kind: "failed",
        reason: "account-bound-elsewhere",
        message: ServerMessages.accountBoundElsewhere,
        boundDevice: {
          deviceId: profile.device_id ?? null,
          deviceType: profile.device_type ?? null,
          boundAt: profile.device_bound_at ?? null,
        },
      };
    }

    // Never bound. Nothing is persisted until the student confirms.
    return {
      kind: "needs-device-binding",
      pending: {
        username,
        password,
        deviceId: device.id,
        deviceType: device.device_type,
        machineName: device.machine_name,
        user,
      },
    };
  }

  /**
   * Phase two. Logs in again carrying the device id, which is what binds.
   * Call only after the student confirmed.
   */
  async confirmBind(pending: PendingBind): Promise<LoginOutcome> {
    let bound: { access: string; refresh: string; user?: User };

    try {
      bound = await request(Endpoints.login, {
        body: {
          username: pending.username,
          password: pending.password,
          device_id: pending.deviceId,
          device_type: pending.deviceType,
        },
      });
    } catch (error) {
      // The expected refusal here is device-bound-to-another-student: between
      // the probe and now we asked the server to bind, and it found this
      // machine already held by someone else. Common on a family or lab PC.
      return this.refusal(error);
    }

    if (!bound.user) {
      return { kind: "failed", reason: "unknown", message: Messages.unexpectedResponse };
    }

    await this.commit(bound.access, bound.refresh, bound.user);
    return { kind: "success", user: bound.user };
  }

  /**
   * Restores a session at launch, so a student who never signed out lands in
   * the app rather than at a login form.
   *
   * A 401 here has already been through one refresh in the client, so a
   * rejection at this point means the refresh token is dead too — not merely
   * that the access token expired overnight.
   */
  async restoreSession(): Promise<SessionRestore> {
    const stored = await tokens.get();
    if (!stored.access) return "none";

    let user: User;
    try {
      user = await request<User>(Endpoints.me);
    } catch (error) {
      if (error instanceof NetworkError) {
        // Offline at launch. The tokens are probably fine, so they stay: the
        // caller opens the app and every section shows its own retry. If they
        // do turn out to be dead, the first request that gets through raises
        // session-expired and the student goes to login then.
        return "unverified";
      }
      return this.reject();
    }

    if (!isStudent(user)) return this.reject();

    // The binding is checked on every launch, not only at sign-in.
    //
    // An administrator can unbind an account, and it can then be bound to
    // another machine. The tokens on THIS machine stay valid through all of
    // that — so without this check a student who had been moved to a new
    // computer would keep a working session on the old one, which is the whole
    // thing the one-device rule exists to prevent.
    const bound = user.student_profile?.device_id;
    const here = (await deviceIdentity())?.id;

    // Compared only when BOTH are known, for the reason in deviceIdentity().
    if (bound && here && bound !== here) return this.reject();

    this.user = user;
    return "restored";
  }

  /**
   * Blacklists the refresh token server-side when reachable, and clears local
   * storage either way — a failed logout call must never leave tokens behind.
   */
  async signOut(): Promise<void> {
    const refresh = (await tokens.get()).refresh;

    if (refresh) {
      try {
        await request(Endpoints.logout, { body: { refresh } });
      } catch {
        // Offline, or already blacklisted. Clearing locally is the part that
        // matters on a shared machine.
      }
    }

    this.user = null;
    await tokens.clear();
  }

  private async commit(access: string, refresh: string, user: User): Promise<void> {
    await tokens.save(access, refresh);
    this.user = user;
  }

  private async reject(): Promise<SessionRestore> {
    this.user = null;
    await tokens.clear();
    return "rejected";
  }

  private refusal(error: unknown): LoginOutcome {
    if (error instanceof NetworkError) {
      return { kind: "failed", reason: "network", message: Messages.noConnection };
    }

    if (error instanceof ApiError) {
      // 400 is the only refusal LoginSerializer produces. Anything else is a
      // server or proxy fault and should not be dressed up as a credential
      // problem.
      if (error.status !== 400) {
        return { kind: "failed", reason: "unknown", message: error.message };
      }
      return { kind: "failed", reason: classifyLoginFailure(error.message), message: error.message };
    }

    return { kind: "failed", reason: "unknown", message: Messages.unexpectedResponse };
  }
}

export const auth = new AuthService();
