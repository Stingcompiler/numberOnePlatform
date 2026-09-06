import { useEffect, useState } from "react";

import { studentApi } from "../api/studentApi";
import { auth, User } from "../auth/authService";
import { CourseDetailScreen } from "../screens/CourseDetailScreen";
import { CoursesScreen } from "../screens/CoursesScreen";
import { RouteId, routeById } from "./routes";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useTheme } from "./theme";

/**
 * The signed-in frame: sidebar, top bar, and whichever screen is current.
 *
 * NAVIGATION IS A ROOT PLUS AN OPTIONAL DETAIL, not a stack. Every detail
 * screen in this app is reached from exactly one root and returns to it, so a
 * general history would model a freedom the app does not have — and the back
 * arrow the framework offers for a stack is the one that sent a signed-in
 * student to the login form in MAUI.
 *
 * Search and the row count belong to the bar but are OWNED BY THE SCREEN.
 * Both are cleared on navigation: a count left over from the previous screen
 * is worse than no count.
 */

interface ShellProps {
  onSignOut: () => void;
  deviceType: string;
  /** Where to land. Used by the harness to reach a screen without clicking. */
  initialRoute?: RouteId;
  /** A course detail to open straight away, for the same reason. */
  initialCourseId?: number;
}

type Detail = { kind: "course"; courseId: number } | { kind: "lesson"; lessonId: number; courseId: number };

export function Shell({
  onSignOut,
  deviceType,
  initialRoute = "home",
  initialCourseId,
}: ShellProps) {
  const [current, setCurrent] = useState<RouteId>(initialRoute);
  const [detail, setDetail] = useState<Detail | null>(
    initialCourseId ? { kind: "course", courseId: initialCourseId } : null,
  );
  const [search, setSearch] = useState("");
  const [countLabel, setCountLabel] = useState("");
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useTheme();

  const route = routeById(current);
  const user = auth.currentUser;

  useEffect(() => {
    // The badge is the shell's, not a screen's: it is visible from every
    // screen, so it cannot belong to one of them.
    studentApi.unreadCount().then(setUnread).catch(() => undefined);
  }, []);

  function navigate(id: RouteId) {
    setCurrent(id);
    setDetail(null);
    setSearch("");
    setCountLabel("");
  }

  function open(next: Detail) {
    setDetail(next);
    setSearch("");
    setCountLabel("");
  }

  function back() {
    setDetail(null);
    setCountLabel("");
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
          route={detail ? detailRoute(detail) : route}
          count={countLabel}
          search={search}
          onSearch={setSearch}
          unread={unread}
          onNotifications={() => navigate("notifications")}
          deviceType={deviceType}
          onBack={detail ? back : undefined}
        />

        <main className="min-h-0 flex-1 overflow-auto bg-bg p-6">
          {detail ? (
            <DetailView detail={detail} onOpenLesson={(lessonId, courseId) => open({ kind: "lesson", lessonId, courseId })} />
          ) : (
            <RootView
              route={current}
              search={search}
              onCount={setCountLabel}
              onOpenCourse={(courseId) => open({ kind: "course", courseId })}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function RootView({
  route,
  search,
  onCount,
  onOpenCourse,
}: {
  route: RouteId;
  search: string;
  onCount: (label: string) => void;
  onOpenCourse: (courseId: number) => void;
}) {
  if (route === "courses") {
    return <CoursesScreen search={search} onCount={onCount} onOpen={onOpenCourse} />;
  }

  return <NotBuiltYet title={routeById(route).title} />;
}

function DetailView({
  detail,
  onOpenLesson,
}: {
  detail: Detail;
  onOpenLesson: (lessonId: number, courseId: number) => void;
}) {
  if (detail.kind === "course") {
    return <CourseDetailScreen courseId={detail.courseId} onOpenLesson={onOpenLesson} />;
  }

  return <NotBuiltYet title="المحاضرة" />;
}

function detailRoute(detail: Detail) {
  return {
    id: "courses" as RouteId,
    title: detail.kind === "course" ? "الكورس" : "المحاضرة",
    icon: "Courses" as const,
  };
}

/**
 * Says what is not built yet, in place of the screen.
 *
 * Deliberately not an empty area: a blank region is indistinguishable from a
 * screen whose data failed to load, and that ambiguity has already cost this
 * project a debugging session.
 */
function NotBuiltYet({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-panel border border-dashed border-border p-8 text-center">
        <p className="font-ui text-heading font-bold text-ink">{title}</p>
        <p className="text-body text-ink-muted">هذه الشاشة تُبنى في مجموعة لاحقة من الدفعة ٤.</p>
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
