import { useCallback, useEffect, useState } from "react";

/**
 * Light or dark, remembered between launches.
 *
 * LIGHT IS THE DEFAULT, and not by accident. School and lab machines are often
 * left on the Windows dark default, so a student who has never touched the
 * setting would otherwise meet a dark sign-in page while the design, the
 * dashboard and the printed handouts are all light. The OS preference is
 * deliberately not consulted; only an explicit choice changes it.
 *
 * Stored in localStorage rather than the credential store: it is a preference,
 * not a secret, and losing it costs one click.
 */

const KEY = "app_theme";

export type Theme = "light" | "dark";

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    // Private mode, or storage blocked. Light, as if nothing was chosen.
    return "light";
  }
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(stored);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // The choice still applies for this session.
    }
  }, [theme]);

  const choose = useCallback((next: Theme) => setTheme(next), []);

  return [theme, choose];
}
