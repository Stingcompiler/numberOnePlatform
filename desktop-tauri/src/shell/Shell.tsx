import { useCallback, useEffect, useState } from "react";

import { studentApi } from "../api/studentApi";
import { auth, User, watermarkName } from "../auth/authService";
import { AttemptDetailScreen } from "../screens/AttemptDetailScreen";
import { CourseDetailScreen } from "../screens/CourseDetailScreen";
import { CoursesScreen } from "../screens/CoursesScreen";
import { ExamRunnerScreen } from "../screens/ExamRunnerScreen";
import { ExamsScreen } from "../screens/ExamsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LiveScreen } from "../screens/LiveScreen";
import { LecturesScreen } from "../screens/LecturesScreen";
import { LessonScreen } from "../screens/LessonScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ResultsScreen } from "../screens/ResultsScreen";
import { RouteDefinition, RouteId, routeById } from "./routes";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ToastHost } from "../ui/Toast";
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
  /** A detail to open straight away, for the same reason. */
  initialDetail?: Detail;
}

export type Detail =
  | { kind: "course"; courseId: number }
  | { kind: "lesson"; lessonId: number; courseId: number }
  | { kind: "exam"; examId: number }
  | { kind: "attempt"; attemptId: number };

export function Shell({
  onSignOut,
  deviceType,
  initialRoute = "home",
  initialDetail,
}: ShellProps) {
  const [current, setCurrent] = useState<RouteId>(initialRoute);
  const [detail, setDetail] = useState<Detail | null>(initialDetail ?? null);
  const [search, setSearch] = useState("");
  const [countLabel, setCountLabel] = useState("");
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useTheme();

  /**
   * The lecture asked for the picture to fill the screen.
   *
   * Not the platform's fullscreen, deliberately. The window carries capture
   * protection, and a genuinely fullscreen surface on another monitor or in a
   * detached window is exactly the kind of thing that slips outside it. Putting
   * the shell's own chrome away instead keeps the protected window the only
   * place a lecture is ever drawn.
   */
  const [fullscreen, setFullscreen] = useState(false);

  const route = routeById(current);
  const user = auth.currentUser;

  /**
   * The badge is the shell's, not a screen's: it is visible from every screen,
   * so it cannot belong to one of them.
   *
   * Failures leave the previous count showing rather than flashing to zero — a
   * badge that cannot refresh is not worth an error on a screen the student may
   * not even be looking at.
   */
  const refreshBadge = useCallback(() => {
    studentApi
      .unreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  useEffect(refreshBadge, [refreshBadge]);

  function navigate(id: RouteId) {
    setCurrent(id);
    setDetail(null);
    setSearch("");
    setCountLabel("");
    setFullscreen(false);
  }

  function open(next: Detail) {
    setDetail(next);
    setSearch("");
    setCountLabel("");
  }

  function back() {
    setDetail(null);
    setCountLabel("");
    setFullscreen(false);
  }

  return (
    <ToastHost>
      <div className="flex h-full">
        {!fullscreen && (
          <Sidebar
            current={current}
            onNavigate={navigate}
            onSignOut={onSignOut}
            studentName={studentName(user)}
            studentGrade={studentGrade(user)}
            theme={theme}
            onTheme={setTheme}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {!fullscreen && (
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
          )}

          <main
            className={`min-h-0 flex-1 overflow-auto bg-bg ${fullscreen ? "p-0" : "p-6"}`}
          >
            {detail ? (
              <DetailView
                detail={detail}
                onOpenLesson={(lessonId, courseId) =>
                  open({ kind: "lesson", lessonId, courseId })
                }
                onLeaveExam={() => navigate("exams")}
                onFullscreen={setFullscreen}
              />
            ) : (
              <RootView
                route={current}
                search={search}
                onCount={setCountLabel}
                onNavigate={navigate}
                onOpenCourse={(courseId) => open({ kind: "course", courseId })}
                onOpenLesson={(lessonId, courseId) =>
                  open({ kind: "lesson", lessonId, courseId })
                }
                onStartExam={(examId) => open({ kind: "exam", examId })}
                onOpenAttempt={(attemptId) =>
                  open({ kind: "attempt", attemptId })
                }
                onUnreadChanged={refreshBadge}
              />
            )}
          </main>
        </div>
      </div>
    </ToastHost>
  );
}

function RootView({
  route,
  search,
  onCount,
  onNavigate,
  onOpenCourse,
  onOpenLesson,
  onStartExam,
  onOpenAttempt,
  onUnreadChanged,
}: {
  route: RouteId;
  search: string;
  onCount: (label: string) => void;
  onNavigate: (route: RouteId) => void;
  onOpenCourse: (courseId: number) => void;
  onOpenLesson: (lessonId: number, courseId: number) => void;
  onStartExam: (examId: number) => void;
  onOpenAttempt: (attemptId: number) => void;
  onUnreadChanged: () => void;
}) {
  if (route === "home") {
    return (
      <HomeScreen
        onNavigate={onNavigate}
        onOpenCourse={onOpenCourse}
        onStartExam={onStartExam}
      />
    );
  }

  if (route === "courses") {
    return (
      <CoursesScreen search={search} onCount={onCount} onOpen={onOpenCourse} />
    );
  }

  if (route === "lectures") {
    return (
      <LecturesScreen search={search} onCount={onCount} onOpen={onOpenLesson} />
    );
  }

  if (route === "exams") {
    return (
      <ExamsScreen
        search={search}
        onCount={onCount}
        onStartExam={onStartExam}
      />
    );
  }

  if (route === "results") {
    return (
      <ResultsScreen
        search={search}
        onCount={onCount}
        onOpenAttempt={onOpenAttempt}
      />
    );
  }

  if (route === "live") {
    return <LiveScreen onCount={onCount} />;
  }

  if (route === "notifications") {
    return (
      <NotificationsScreen
        onCount={onCount}
        onReadStateChanged={onUnreadChanged}
      />
    );
  }

  if (route === "profile") {
    return <ProfileScreen />;
  }

  // Every sidebar route is built. This stays as the honest answer to a route
  // id that somehow has no screen, rather than a blank main area.
  return (
    <NotBuiltYet
      title={routeById(route).title}
      note="هذه الشاشة غير متاحة في هذه النسخة."
    />
  );
}

function DetailView({
  detail,
  onOpenLesson,
  onLeaveExam,
  onFullscreen,
}: {
  detail: Detail;
  onOpenLesson: (lessonId: number, courseId: number) => void;
  onLeaveExam: () => void;
  onFullscreen: (on: boolean) => void;
}) {
  if (detail.kind === "course") {
    return (
      <CourseDetailScreen
        courseId={detail.courseId}
        onOpenLesson={onOpenLesson}
      />
    );
  }

  if (detail.kind === "exam") {
    // A finished paper returns to the exams list, where the attempt now shows
    // under المكتملة — not back to the runner it just left.
    return <ExamRunnerScreen examId={detail.examId} onFinish={onLeaveExam} />;
  }

  if (detail.kind === "attempt") {
    return <AttemptDetailScreen attemptId={detail.attemptId} />;
  }

  // The player is batch 5: the video surface, the watermark, and the WebView2
  // lockdown are one piece of work and none of it is half-shippable.
  return (
    <LessonScreen
      lessonId={detail.lessonId}
      courseId={detail.courseId}
      onOpenLesson={onOpenLesson}
      onFullscreen={onFullscreen}
    />
  );
}

function detailRoute(detail: Detail): RouteDefinition {
  switch (detail.kind) {
    case "course":
      return { id: "courses", title: "الكورس", icon: "Courses" };
    case "lesson":
      return { id: "courses", title: "المحاضرة", icon: "Lecture" };
    case "exam":
      return { id: "exams", title: "خوض الاختبار", icon: "Exams" };
    case "attempt":
      return { id: "results", title: "تفاصيل المحاولة", icon: "Results" };
  }
}

/**
 * Says what is not built yet, in place of the screen.
 *
 * Deliberately not an empty area: a blank region is indistinguishable from a
 * screen whose data failed to load, and that ambiguity has already cost this
 * project a debugging session.
 */
function NotBuiltYet({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-panel border border-dashed border-border p-8 text-center">
        <p className="font-ui text-heading font-bold text-ink">{title}</p>
        <p className="font-copy text-body text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

function studentName(user: User | null): string {
  return watermarkName(user);
}

function studentGrade(user: User | null): string {
  const profile = user?.student_profile;
  return profile?.enrolled_grade_name ?? profile?.system_type ?? "";
}
