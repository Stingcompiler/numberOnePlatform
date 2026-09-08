import { useEffect } from "react";

import {
  LiveRoom,
  LiveSession,
  LiveStatuses,
  canJoin,
  liveStatusLabel,
  providerLabel,
  sessionTimeLabel,
} from "../api/models";
import { studentApi } from "../api/studentApi";
import { openExternal } from "../platform/external";
import { Icon } from "../ui/Icon";
import { IconName } from "../ui/icons";
import { Panel, Skeleton, StatePanel } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { count } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * البث المباشر — rooms holding links that open OUTSIDE the app.
 *
 * Deliberately no player and no embed. Every session is a Zoom / Meet / Teams /
 * YouTube link, and the header says so up front so a student is never surprised
 * by a browser window.
 *
 * The server filters rooms by the student's system_type. There is no
 * client-side filter and none is designed — adding one would silently hide
 * rooms the server meant to show, and mask a misconfiguration rather than
 * surfacing it.
 */

interface Props {
  onCount: (label: string) => void;
}

const HeaderNote = "تُفتح الجلسات في المتصفح خارج التطبيق";

export function LiveScreen({ onCount }: Props) {
  const toast = useToast();

  const section = useSection<LiveRoom[]>(
    (signal) => studentApi.liveRooms(signal),
    (rooms) => rooms.length === 0,
  );

  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      // Sessions, not rooms: a student with three rooms and no sessions has
      // nothing to attend, and the count should say so.
      const sessions = (section.data ?? []).reduce((n, r) => n + r.sessions.length, 0);
      onCount(count(sessions, "جلسة", "جلستان", "جلسات"));
    }
  }, [section.status, section.data, onCount]);

  async function join(session: LiveSession) {
    // Ended and archived sessions render their action inert, but guard here
    // too: the list can go stale while the screen is open.
    if (session.status === LiveStatuses.Ended || session.status === LiveStatuses.Archived) {
      toast("انتهت هذه الجلسة ولم يبقَ رابط للدخول", "warning");
      return;
    }

    const failure = await openExternal(session.stream_url);
    if (failure) toast(failure, "error");
    else toast(`جارٍ فتح ${providerLabel(session)} في المتصفح…`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 font-ui text-heading font-bold text-ink">غرف البث</h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="flex shrink-0 items-center gap-2 text-label text-ink-muted">
          <Icon name="Link" size={13} />
          {HeaderNote}
        </span>
      </div>

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

      {/* Empty here usually means the server filtered every room out by
          system_type, not that the school scheduled nothing — so the message
          points at the enrolment rather than the calendar. */}
      {section.status === "empty" && (
        <Panel>
          <div className="flex flex-col items-center gap-1 p-card text-center">
            <p className="text-body text-ink-secondary">لا توجد جلسات بث متاحة</p>
            <p className="font-copy text-body text-ink-muted">
              تُعرض الغرف المطابقة لنظام دراستك فقط.
            </p>
          </div>
        </Panel>
      )}

      {section.status === "data" && (
        <div className="flex flex-col gap-3">
          {(section.data ?? []).map((room) => (
            <Room key={room.id} room={room} onJoin={join} />
          ))}
        </div>
      )}
    </div>
  );
}

function Room({ room, onJoin }: { room: LiveRoom; onJoin: (session: LiveSession) => void }) {
  return (
    <Panel>
      <div className="flex items-center gap-[10px] border-b border-border px-4 py-[10px]">
        <Icon name="ChevronDown" size={14} strokeWidth={1.75} className="text-ink" />
        <h3 className="font-ui text-heading font-bold text-ink">{room.room_name}</h3>
        <span className="text-label text-ink-muted">
          {count(room.sessions.length, "جلسة", "جلستان", "جلسات")}
        </span>
      </div>

      {/* A room with no sessions says so rather than collapsing to a bare
          heading. */}
      {room.sessions.length === 0 ? (
        <p className="px-4 py-6 text-center text-body text-ink-secondary">
          لا توجد جلسات في هذه الغرفة بعد
        </p>
      ) : (
        <ul>
          {room.sessions.map((session) => (
            <li key={session.id}>
              <Session session={session} onJoin={onJoin} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Session({
  session,
  onJoin,
}: {
  session: LiveSession;
  onJoin: (session: LiveSession) => void;
}) {
  const joinable = canJoin(session);
  const live = session.status === LiveStatuses.Live;

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
      {/* The provider's own glyph, in a bordered tile: which product opens
          matters before the click. */}
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-control border border-border bg-hover text-ink">
        <Icon name={providerIcon(session.provider)} size={13} />
      </span>

      <span className="flex min-w-0 flex-[2.6] flex-col gap-[2px]">
        <span className="truncate font-ui text-body font-bold text-ink">{session.session_name}</span>
        {session.description && (
          <span className="truncate text-label text-ink-muted">{session.description}</span>
        )}
      </span>

      <span className="flex min-w-0 flex-[1.4] flex-col gap-[2px]">
        <span className="ltr text-label text-ink-secondary">{providerLabel(session)}</span>
        <span className="ltr text-label text-ink-muted">{sessionTimeLabel(session)}</span>
      </span>

      {/* live → primary, قادمة → warning, ended and archived → grey. A finished
          session is not a failure and must not read as one. */}
      <span
        className={[
          "flex w-[96px] shrink-0 items-center justify-center gap-[6px] rounded-full px-2 py-1 text-label",
          live
            ? "bg-primary-tint text-primary"
            : session.status === LiveStatuses.Upcoming
              ? "bg-warning-tint text-warning"
              : "bg-hover text-ink-muted",
        ].join(" ")}
      >
        {live && <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-current" />}
        {liveStatusLabel(session.status)}
      </span>

      {/* Kept even when it cannot be joined: it states the state rather than
          vanishing, and drops to muted so it does not invite a click that leads
          nowhere. */}
      <button
        type="button"
        disabled={!joinable}
        onClick={() => onJoin(session)}
        className={[
          "flex h-7 w-[76px] shrink-0 items-center justify-center gap-[6px] rounded-control border px-2 text-secondary",
          joinable
            ? "border-border text-ink hover:bg-hover"
            : "border-transparent text-ink-muted",
        ].join(" ")}
      >
        {actionLabel(session)}
        {joinable && <Icon name="External" size={12} />}
      </button>
    </div>
  );
}

/**
 * What the trailing control says. An ended session keeps the control but states
 * its own state rather than offering a link that leads nowhere.
 */
function actionLabel(session: LiveSession): string {
  switch (session.status) {
    case LiveStatuses.Ended:
      return "انتهت";
    case LiveStatuses.Archived:
      return "مؤرشفة";
    default:
      return "دخول";
  }
}

function providerIcon(provider: string | null | undefined): IconName {
  switch (provider) {
    case "zoom":
      return "Zoom";
    case "google_meet":
      return "GoogleMeet";
    case "teams":
      return "Teams";
    case "youtube":
      return "YouTube";
    default:
      return "Link";
  }
}
