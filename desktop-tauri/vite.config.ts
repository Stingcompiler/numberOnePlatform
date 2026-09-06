import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite 5 and React 18, the same pair the web app already builds with.
//
// The port is fixed and strictPort is on: Tauri's devUrl points at it, and a
// silent fallback to another port would leave the window pointing at nothing.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // Matches the WebView2 Evergreen and WKWebView versions this app targets.
    target: "es2021",
    sourcemap: false,
  },
});
