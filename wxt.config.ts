import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  srcDir: ".",
  manifest: {
    name: "Procrastomato",
    description:
      "A simple Pomodoro timer with task tracking, stored locally in your browser.",
    permissions: ["storage", "alarms", "notifications"],
    // entrypoints/dashboard builds to dashboard.html (WXT names unlisted
    // pages after their folder) — wired up as the options page manually
    // since "dashboard" isn't one of WXT's auto-detected entrypoint names
    // (only entrypoints/options/ is).
    options_ui: {
      page: "dashboard.html",
      open_in_tab: true,
    },
    icons: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
});
