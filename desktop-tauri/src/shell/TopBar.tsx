import { Icon } from "../ui/Icon";
import { RouteDefinition } from "./routes";

/**
 * The bar above the content: title, row count, search, notifications, and
 * which machine this is.
 *
 * 48 tall. The search field appears only on screens whose rows can be
 * filtered, and the count only once a screen's rows have landed — a count
 * printed before the data arrives reads as zero.
 */

interface TopBarProps {
  route: RouteDefinition;
  /** e.g. "٦ كورسات". Empty until the screen has something to count. */
  count: string;
  search: string;
  onSearch: (value: string) => void;
  unread: number;
  onNotifications: () => void;
  deviceType: string;
  onBack?: () => void;
}

export function TopBar({
  route,
  count,
  search,
  onSearch,
  unread,
  onNotifications,
  deviceType,
  onBack,
}: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      {/* Shown only where there is somewhere to go back to. In MAUI this was
          toggled with IsVisible and the title moved under it; reserving the
          space keeps the title still between screens. */}
      <div className="w-7 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="grid h-7 w-7 place-items-center rounded-control border border-border text-ink-secondary hover:bg-hover"
          >
            <Icon name="ChevronRight" size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <h1 className="font-ui text-title font-bold text-ink">{route.title}</h1>
      {count && <span className="text-secondary text-ink-muted">{count}</span>}

      <div className="ms-auto flex items-center gap-2">
        {route.searchPlaceholder && (
          <label className="flex h-8 w-[220px] items-center gap-2 rounded-control border border-border bg-surface px-[10px]">
            <Icon name="Search" size={14} className="text-ink-muted" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={route.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
            />
          </label>
        )}

        <button
          type="button"
          onClick={onNotifications}
          aria-label="الإشعارات"
          className="relative grid h-8 w-8 place-items-center rounded-control text-ink-secondary hover:bg-hover"
        >
          <Icon name="Bell" />
          {unread > 0 && (
            // Overlaps the bell's leading corner, as the design shows.
            <span className="absolute -top-[2px] start-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {arabicDigits(unread)}
            </span>
          )}
        </button>

        {/* Which machine this is. The student needs it verbatim when calling
            the school about a device binding. */}
        <span className="flex items-center gap-[6px] rounded-control border border-border px-2 py-1 text-secondary text-ink-muted">
          <Icon name="Monitor" size={14} />
          <span className="ltr">{deviceType}</span>
        </span>
      </div>
    </header>
  );
}

/**
 * Content digits are Arabic-Indic, as everywhere else in the app.
 */
function arabicDigits(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}
