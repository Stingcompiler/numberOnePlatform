/**
 * Pulls the human-readable message out of a DRF error body.
 *
 * The shape depends on where the error was raised, and the login path uses the
 * least obvious one:
 *
 *   ValidationError inside a serializer's validate()  →  { non_field_errors: [...] }
 *   APIException / PermissionDenied / a Response      →  { detail: "..." }
 *   ValidationError on one field                      →  { username: [...] }
 *
 * Every login refusal in LoginSerializer.validate() lands in the first shape,
 * so a parser that reads only `detail` shows a blank error on the one screen
 * where the message carries all of the meaning.
 */
export function extractMessage(body: unknown): string | null {
  if (typeof body === "string") return body.trim() || null;
  if (Array.isArray(body)) return firstString(body);
  if (typeof body !== "object" || body === null) return null;

  const record = body as Record<string, unknown>;

  // Preferred keys, in the order that carries the most meaning.
  for (const key of ["non_field_errors", "detail", "error"]) {
    if (key in record) {
      const found = flatten(record[key]);
      if (found) return found;
    }
  }

  // Otherwise the first field error, with no field name: a student gains
  // nothing from seeing a Latin field name in front of an Arabic sentence.
  for (const value of Object.values(record)) {
    const found = flatten(value);
    if (found) return found;
  }

  return null;
}

function flatten(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return firstString(value);
  return null;
}

function firstString(values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Could not reach the server, as opposed to being refused by it. */
export function isTransportFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
}
