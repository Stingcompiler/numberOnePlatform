import { Icons, IconName } from "./icons";

/**
 * One icon, drawn on the 24×24 grid Lucide is designed on.
 *
 * `viewBox` is fixed at 0 0 24 24 rather than fitted to each glyph's own
 * bounds. Fitting is what MAUI did through Aspect="Uniform", and because these
 * icons deliberately fill the grid unequally — a bell is 13 units tall, a
 * graduation cap 19 — every icon came out at a different scale and stroke
 * weight, a 138% spread across one row. A shared grid is the whole reason a
 * drawn set reads as a set.
 *
 * No fill, ever. See icons.ts.
 */
export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      // Icons are drawn left-to-right whatever the page direction. Mirroring a
      // bell or a clock produces a bell drawn backwards; only the directional
      // ones are flipped, and they are flipped by choosing the other glyph.
      style={{ direction: "ltr", flexShrink: 0 }}
    >
      <path d={Icons[name]} />
    </svg>
  );
}
