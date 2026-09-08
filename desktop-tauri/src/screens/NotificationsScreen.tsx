import { useEffect, useMemo } from "react";

import { Notification, notificationTimeLabel } from "../api/models";
import { studentApi } from "../api/studentApi";
import { Panel, Skeleton, StatePanel } from "../ui/primitives";
import { count, formatDate } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * الإشعارات — grouped by day, newest first.
 *
 * The mobile app receives these by Expo push. There is no desktop equivalent
 * and /notifications/register-token/ stores Expo tokens only, so this client
 * polls the unread count instead. No backend change is needed for that.
 *
 * "تعليم الكل كمقروء" sits on the first group's header rather than in the top
 * bar: it acts on this list, not on the app.
 */

interface Props {
  onCount: (label: string) => void;
  /** The badge lives in the chrome and has no other way to know it moved. */
  onReadStateChanged: () => void;
}

interface Group {
  label: string;
  items: Notification[];
}

export function NotificationsScreen({ onCount, onReadStateChanged }: Props) {
  const section = useSection<Notification[]>(
    async (signal) => (await studentApi.notifications(1, signal)).results,
    (list) => list.length === 0,
  );

  const groups = useMemo(() => group(section.data ?? []), [section.data]);

  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      onCount(count(section.data?.length ?? 0, "إشعار", "إشعاران", "إشعارات", "واحد"));
    }
  }, [section.status, section.data, onCount]);

  async function markRead(notification: Notification) {
    if (notification.is_read) return;
    if (!(await studentApi.markNotificationRead(notification.id))) return;

    // Refetch rather than mutating in place: the row is an immutable DTO and
    // the badge has to come from the server anyway.
    section.reload();
    onReadStateChanged();
  }

  async function markAllRead() {
    if (!(await studentApi.markAllNotificationsRead())) return;
    section.reload();
    onReadStateChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, i) => (
        <section key={g.label} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 font-ui text-heading font-bold text-ink">{g.label}</h2>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />

            {/* On the first group only: one control for the whole list. */}
            {i === 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="shrink-0 rounded-control px-2 py-1 text-secondary text-ink-secondary hover:bg-hover"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          <Panel>
            <ul>
              {g.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void markRead(item)}
                    className="flex w-full items-start gap-[10px] border-b border-border px-4 py-3 text-start last:border-b-0 hover:bg-hover"
                  >
                    {/* Unread carries the dot and the weight; opening the row
                        is what clears both. */}
                    <span
                      aria-hidden="true"
                      className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${
                        item.is_read ? "bg-transparent" : "bg-primary"
                      }`}
                    />

                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className={`text-body text-ink ${item.is_read ? "" : "font-bold"}`}>
                        {item.title}
                      </span>
                      <span className="font-copy text-body text-ink-secondary">{item.message}</span>
                    </span>

                    <span className="shrink-0 text-label text-ink-muted">
                      {notificationTimeLabel(item)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ))}

      {section.status === "loading" && (
        <Panel>
          <Skeleton rows={3} />
        </Panel>
      )}

      {section.status === "error" && (
        <Panel>
          <StatePanel message={section.error ?? ""} onAction={section.reload} />
        </Panel>
      )}

      {section.status === "empty" && (
        <Panel>
          <p className="p-card text-body text-ink-muted">لا توجد إشعارات جديدة.</p>
        </Panel>
      )}
    </div>
  );
}

/**
 * اليوم / أمس / then by date.
 *
 * Grouping is on LOCAL dates: a notification stamped 23:50 UTC must not fall
 * into "أمس" for a student reading it at 02:50 their own time.
 */
function group(items: Notification[]): Group[] {
  const byDay = new Map<string, Notification[]>();

  for (const item of items) {
    const at = new Date(item.created_at);
    if (Number.isNaN(at.getTime())) continue;

    const key = at.toDateString();
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  return [...byDay.entries()]
    .sort((a, b) => Date.parse(b[0]) - Date.parse(a[0]))
    .map(([key, group]) => ({
      label: key === today ? "اليوم" : key === yesterday ? "أمس" : formatDate(key),
      items: [...group].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    }));
}
