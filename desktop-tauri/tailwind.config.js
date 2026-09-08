/**
 * The tokens from PORT-AUDIT section 7, taken from the MAUI app's Tokens.xaml.
 * NOT from frontend/ — that is the admin console and its palette is not this
 * app's. Each colour is named for its role, not its hue, so a later change to
 * the palette does not need every screen edited.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        sidebar: "var(--sidebar)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-muted": "var(--ink-muted)",
        hover: "var(--hover)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        success: "var(--success)",
        warning: "var(--warning)",
        // Named tints rather than an opacity modifier: these colours are CSS
        // variables, and Tailwind cannot split a var() into channels to apply
        // one to.
        "primary-tint": "var(--primary-tint)",
        "accent-tint": "var(--accent-tint)",
        "success-tint": "var(--success-tint)",
        "warning-tint": "var(--warning-tint)",
      },
      fontFamily: {
        // Bundled, never fetched: these run on school machines behind filters,
        // and a webfont that fails falls back to a face that cannot shape Arabic.
        ui: ["Cairo", "Segoe UI", "system-ui", "sans-serif"],
        copy: ["Tajawal", "Segoe UI", "system-ui", "sans-serif"],
      },
      fontSize: {
        label: "11px",
        secondary: "12px",
        body: "13px",
        heading: "15px",
        title: "20px",
      },
      borderRadius: { control: "6px", panel: "8px" },
      spacing: { card: "16px", sidebar: "200px" },
    },
  },
  plugins: [],
};
