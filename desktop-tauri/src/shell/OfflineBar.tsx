import { useEffect, useState } from "react";

import { Icon } from "../ui/Icon";

/**
 * لا يوجد اتصال بالإنترنت.
 *
 * DRIVEN BY THE PLATFORM, NOT BY A FAILED REQUEST. A single 500 is not the same
 * as being offline, and treating it that way would hide real server errors
 * behind a network bar — the student would be told to check their connection
 * while the school's server was down. `navigator.onLine` reflects the OS
 * network stack, which is the same thing MAUI reads through Connectivity.
 *
 * It is also NOT the session-expiry dialog's job: an offline student still has
 * a valid session. The two states are separate and both are reachable.
 */

const Message = "لا يوجد اتصال بالإنترنت — البيانات المعروضة قد تكون قديمة والفيديو متوقف.";
const Reconnect = "إعادة الاتصال";

export function OfflineBar({ onReconnect }: { onReconnect: () => void }) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);

    window.addEventListener("online", up);
    window.addEventListener("offline", down);

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-primary bg-primary-tint px-6">
      <Icon name="WifiOff" size={14} className="shrink-0 text-primary" />

      <span className="flex-1 truncate text-secondary text-primary">{Message}</span>

      {/* There is nothing to dial — the useful half of "reconnect" is retrying
          the work, which is what this does. */}
      <button
        type="button"
        onClick={onReconnect}
        className="shrink-0 rounded-[4px] border border-primary px-2 py-[2px] text-label text-primary hover:bg-primary/10"
      >
        {Reconnect}
      </button>
    </div>
  );
}
