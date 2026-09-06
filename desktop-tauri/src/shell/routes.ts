import { IconName } from "../ui/icons";

/**
 * The screens, in the order the sidebar lists them.
 *
 * The MAUI shell hard-codes eight nav rows, each with its own name, icon and
 * click handler — around 160 lines of XAML that differ only in three values.
 * One table drives the sidebar, the titles and the router here, so a screen
 * cannot appear in the nav and be missing from the router, which is the way
 * that kind of duplication actually fails.
 */

export type RouteId =
  | "home"
  | "courses"
  | "lectures"
  | "live"
  | "exams"
  | "results"
  | "notifications"
  | "profile";

export interface RouteDefinition {
  id: RouteId;
  /** The sidebar label and the top-bar title — the same word in both. */
  title: string;
  icon: IconName;
  /** Rows on this screen can be filtered; the top bar shows a search field. */
  searchPlaceholder?: string;
}

export const Routes: readonly RouteDefinition[] = [
  { id: "home", title: "الرئيسية", icon: "Home" },
  { id: "courses", title: "الكورسات", icon: "Courses", searchPlaceholder: "ابحث في الكورسات" },
  { id: "lectures", title: "المحاضرات", icon: "Lecture", searchPlaceholder: "ابحث في المحاضرات" },
  { id: "live", title: "البث المباشر", icon: "Live" },
  {
    id: "exams",
    title: "الإختبارات والإمتحانات",
    icon: "Exams",
    searchPlaceholder: "ابحث في الاختبارات",
  },
  { id: "results", title: "النتائج", icon: "Results", searchPlaceholder: "ابحث في النتائج" },
  { id: "notifications", title: "الإشعارات", icon: "Bell" },
  { id: "profile", title: "حسابي", icon: "User" },
] as const;

export function routeById(id: RouteId): RouteDefinition {
  const found = Routes.find((r) => r.id === id);
  if (!found) throw new Error(`unknown route: ${id}`);
  return found;
}
