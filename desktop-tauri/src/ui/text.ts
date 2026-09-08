/**
 * The text rules the whole app shares. Ported from UiText in NumberOne.Core.
 */

/**
 * Counts a noun the way Arabic actually counts.
 *
 * Arabic has FOUR number forms where English has two, and the design's own copy
 * uses all of them: "لا توجد جلسات" for none, "جلسة واحدة" for one, "جلستان"
 * for two, the plural from three to ten — and then BACK TO THE SINGULAR from
 * eleven up: "١١ جلسة", never "١١ جلسات". The last is the one most often got
 * wrong, and it is wrong in a way an Arabic reader notices immediately.
 */
export function count(
  n: number,
  singular: string,
  dual: string,
  plural: string,
  oneWord = "واحدة",
): string {
  if (n <= 0) return `لا توجد ${plural}`;
  if (n === 1) return `${singular} ${oneWord}`;
  if (n === 2) return dual;
  if (n <= 10) return `${arabicDigits(n)} ${plural}`;
  return `${arabicDigits(n)} ${singular}`;
}

/** Content digits are Arabic-Indic. Interface chrome keeps Western digits. */
export function arabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/** yyyy/MM/dd in Arabic-Indic digits, in the machine's own time zone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const pad = (n: number) => String(n).padStart(2, "0");
  return arabicDigits(`${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`);
}

/** "٧٥٪" — a whole percent, never a decimal. */
export function percentLabel(percent: number): string {
  return `${arabicDigits(Math.round(percent))}٪`;
}

/**
 * A dash where a field was never filled in.
 *
 * Nearly everything on a student record is optional, and a value set under its
 * own label with nothing drawn around it leaves a heading above a gap — which
 * reads as the screen having failed rather than as a blank nobody filled.
 */
export function orDash(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}
