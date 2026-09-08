/**
 * Why a login was refused.
 *
 * The server distinguishes these cases only by the Arabic message text: it
 * raises ValidationError(..., code="device_mismatch"), but DRF's default
 * renderer discards the code, so nothing machine-readable reaches the wire.
 * Matching on text is brittle and is the only option; pinning it in one place
 * means a server-side rewording fails here loudly rather than quietly
 * degrading two screens to a generic error.
 */
export type LoginFailureReason =
  | "bad-credentials"
  | "account-suspended"
  | "account-bound-elsewhere"
  | "device-bound-to-another-student"
  | "unknown"
  | "network";

/** The exact literals the server sends — accounts/models.py and serializers.py. */
export const ServerMessages = {
  accountBoundElsewhere: "هذا الحساب مرتبط بجهاز آخر. يرجى التواصل مع الإدارة لفك الارتباط.",
  deviceBoundToAnotherStudent: "هذا الجهاز مرتبط بحساب طالب آخر. يرجى التواصل مع الإدارة.",
  badCredentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  accountSuspended: "الحساب موقوف. يرجى التواصل مع الإدارة.",
} as const;

// Discriminating fragments. Short enough to survive punctuation edits, long
// enough that the two device messages cannot be confused: both open with
// "هذا الـ…" and diverge only at the noun.
const Fragments = {
  accountBoundElsewhere: "مرتبط بجهاز آخر",
  deviceBoundToOther: "مرتبط بحساب طالب آخر",
  badCredentials: "اسم المستخدم أو كلمة المرور",
  accountSuspended: "الحساب موقوف",
} as const;

/**
 * Maps a server message to a reason.
 *
 * Order matters: the two device fragments are tested before the generic ones,
 * because a future server message could plausibly contain both.
 */
export function classifyLoginFailure(message: string | null | undefined): LoginFailureReason {
  if (!message?.trim()) return "unknown";

  if (message.includes(Fragments.deviceBoundToOther)) return "device-bound-to-another-student";
  if (message.includes(Fragments.accountBoundElsewhere)) return "account-bound-elsewhere";
  if (message.includes(Fragments.accountSuspended)) return "account-suspended";
  if (message.includes(Fragments.badCredentials)) return "bad-credentials";

  return "unknown";
}
