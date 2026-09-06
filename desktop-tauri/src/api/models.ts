/**
 * The shapes the API returns, named as the server names them.
 *
 * Snake case is kept deliberately: renaming at the boundary means a field the
 * server adds or moves shows up as a TypeScript error here rather than as an
 * undefined two screens away.
 */

export interface Lesson {
  id: number;
  unit?: number | null;
  title: string;
  description?: string | null;
  youtube_embed_url?: string | null;
  pdf_file?: string | null;
  display_order: number;
  duration_minutes?: number | null;
  is_active: boolean;
}

export interface Unit {
  id: number;
  course: number;
  name: string;
  display_order: number;
  is_active: boolean;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  name: string;
  description?: string | null;
  grade?: number | null;
  grade_name?: string | null;
  teacher?: number | null;
  teacher_name?: string | null;
  thumbnail?: string | null;
  display_order: number;
  is_active: boolean;
  system_type?: string | null;
  units: Unit[];
  lesson_count?: number | null;
}

export interface LessonProgress {
  lesson: number;
  is_completed: boolean;
  completed_at?: string | null;
}

/** How many lessons a course holds, counting its units when the server is quiet. */
export function lessonCount(course: Course): number {
  if (typeof course.lesson_count === "number") return course.lesson_count;
  return course.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

export function unitCount(course: Course): number {
  return course.units.length;
}
