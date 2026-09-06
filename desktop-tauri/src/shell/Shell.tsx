import { useState } from "react";

import { auth, User } from "../auth/authService";
import { RouteId, routeById } from "./routes";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useTheme } from "./theme";

/**
 * The signed-in frame: sidebar, top bar, and whichever screen is current.
 *
 * The screens themselves are batch 4. Each route renders a placeholder that
 * says so, rather than a blank area that could be mistaken for a screen that
 * failed to load.
 *
 * The search box and the row count live here because they belong to the bar,
 * but they are OWNED BY THE CURRENT SCREEN: switching route clears both, since
 * a count left over from the previous screen is worse than no count.
 */

interface ShellProps {
  onSignOut: () => void;
  deviceType: string;
}

export function Shell({ onSignOut, deviceType }: ShellProps) {
  const [current, setCurrent] = useState<RouteId>("home");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useTheme();

  const route = routeById(current);
  const user = auth.currentUser;

  function navigate(id: RouteId) {
    setCurrent(id);
    setSearch("");
  }

  return (
    <div className="flex h-full">
      <Sidebar
        current={current}
        onNavigate={navigate}
        onSignOut={onSignOut}
        studentName={studentName(user)}
        studentGrade={studentGrade(user)}
        theme={theme}
        onTheme={setTheme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          route={route}
          count=""
          search={search}
          onSearch={setSearch}
          unread={0}
          onNotifications={() => navigate("notifications")}
          deviceType={deviceType}
        />

        <main className="min-h-0 flex-1 overflow-auto bg-bg p-6">
          <Placeholder title={route.title} />
        </main>
      </div>
    </div>
  );
}

/**
 * Says what is not built yet, in place of the screen.
 *
 * Deliberately not an empty area: a blank region is indistinguishable from a
 * screen whose data failed to load, and that ambiguity has already cost this
 * project a debugging session.
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-panel border border-dashed border-border p-8 text-center">
        <p className="font-ui text-heading font-bold text-ink">{title}</p>
        <p className="text-body text-ink-muted">
          هذه الشاشة تُبنى في الدفعة ٤. التخطيط والتنقّل جاهزان.
        </p>
      </div>
    </div>
  );
}

function studentName(user: User | null): string {
  if (!user) return "";
  const profile = user.student_profile as { full_name?: string } | null | undefined;
  return profile?.full_name ?? String(user.username ?? "");
}

function studentGrade(user: User | null): string {
  if (!user) return "";
  const profile = user.student_profile as
    | { enrolled_grade_name?: string; system_type?: string }
    | null
    | undefined;
  return profile?.enrolled_grade_name ?? profile?.system_type ?? "";
}
