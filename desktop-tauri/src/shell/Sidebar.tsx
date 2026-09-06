import { Icon } from "../ui/Icon";
import { RouteId, Routes } from "./routes";
import { Theme } from "./theme";

/**
 * The sidebar: brand, the eight routes, sign-out, and the student's identity
 * with the theme switch.
 *
 * 240 wide, as in MAUI. The selected row carries a tinted background and a 2px
 * bar on the LEADING edge — which in a right-to-left layout is the right, and
 * is left to the layout rather than hard-coded, so the same markup is correct
 * if the app is ever shown left-to-right.
 */

interface SidebarProps {
  current: RouteId;
  onNavigate: (id: RouteId) => void;
  onSignOut: () => void;
  studentName: string;
  studentGrade: string;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}

export function Sidebar({
  current,
  onNavigate,
  onSignOut,
  studentName,
  studentGrade,
  theme,
  onTheme,
}: SidebarProps) {
  return (
    <nav className="flex w-[240px] shrink-0 flex-col border-e border-border bg-sidebar px-2 py-3">
      <Brand />

      <p className="px-[10px] pb-1 pt-4 text-label text-ink-muted">التعلّم</p>

      <ul className="flex flex-col gap-[2px]">
        {Routes.map((route) => (
          <li key={route.id}>
            <NavRow
              label={route.title}
              icon={route.icon}
              selected={route.id === current}
              onClick={() => onNavigate(route.id)}
            />
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2 pt-3">
        <NavRow label="تسجيل الخروج" icon="SignOut" selected={false} onClick={onSignOut} />
        <Identity
          name={studentName}
          grade={studentGrade}
          theme={theme}
          onTheme={onTheme}
        />
      </div>
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-[10px] px-[10px] py-1">
      <span className="grid h-7 w-7 place-items-center rounded-control bg-primary font-ui text-body font-bold text-white">
        ١
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-ui text-body font-bold text-ink">نمبر ون</span>
        <span className="text-label text-ink-muted">منصة الطالب</span>
      </span>
    </div>
  );
}

function NavRow({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      className={[
        "relative flex h-9 w-full items-center gap-[10px] rounded-control px-[10px] text-start",
        "font-ui text-body transition-colors",
        selected ? "bg-hover text-ink" : "text-ink-secondary hover:bg-hover",
      ].join(" ")}
    >
      {/* The 2px marker on the leading edge. inset-inline-start follows the
          document direction, so nothing here needs to know it is RTL. */}
      {selected && (
        <span className="absolute inset-y-1 start-0 w-[2px] rounded-full bg-accent" aria-hidden="true" />
      )}
      <Icon name={icon} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Identity({
  name,
  grade,
  theme,
  onTheme,
}: {
  name: string;
  grade: string;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border px-[10px] pt-3">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-hover font-ui text-secondary font-bold text-ink-secondary">
        {firstLetter(name)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-ui text-secondary text-ink">{name}</span>
        <span className="truncate text-label text-ink-muted">{grade}</span>
      </span>

      {/* Two cells rather than a switch: the design shows both states at once,
          and which one is active is read at a glance instead of inferred. */}
      <div className="flex shrink-0 rounded-control border border-border p-[2px]">
        <ThemeCell icon="Moon" active={theme === "dark"} onClick={() => onTheme("dark")} label="داكن" />
        <ThemeCell icon="Sun" active={theme === "light"} onClick={() => onTheme("light")} label="فاتح" />
      </div>
    </div>
  );
}

function ThemeCell({
  icon,
  active,
  onClick,
  label,
}: {
  icon: "Sun" | "Moon";
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "grid h-[22px] w-6 place-items-center rounded-[4px] transition-colors",
        active ? "bg-hover text-ink" : "text-ink-muted hover:text-ink-secondary",
      ].join(" ")}
    >
      <Icon name={icon} size={13} />
    </button>
  );
}

function firstLetter(name: string): string {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0] : "؟";
}
