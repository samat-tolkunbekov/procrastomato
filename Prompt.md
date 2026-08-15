# Prompt for Claude Code

Paste everything below into Claude Code (terminal) in an empty project directory.

---

Scaffold a browser extension called **Pomodoro Metrics** — a Pomodoro timer that logs every session and shows productivity metrics. Manifest V3, targeting Chrome and Firefox.

## Stack

- **WXT** as the build framework (https://wxt.dev) — handles MV3 manifest generation, file-based entrypoints, and cross-browser builds. Use `pnpm create wxt@latest` conventions if scaffolding fresh, or configure `wxt.config.ts` directly.
- **Vue 3** with `<script setup>` and the Composition API — do not use the Options API anywhere.
- **TypeScript**, strict mode on.
- **Pinia** for state management in the popup and dashboard (not Vuex).
- **Tailwind CSS** for styling.
- **Chart.js** with `vue-chartjs` for the metrics dashboard.
- **Vitest** for unit tests on the storage and timer logic (this is the part most worth testing — UI can stay untested initially).

## Architecture (must follow this — do not put timer logic in the popup)

The background service worker is the single source of truth for timer state. The popup and dashboard are dumb views that read state and send commands; they never run their own countdown.

- **Timer engine**: driven by `chrome.alarms`, not `setInterval`/`setTimeout` — MV3 service workers are killed after ~30s idle and any in-memory timer would die with them. Persist `{ phase, phaseStartedAt, phaseDuration, isPaused, pausedElapsed }` to `chrome.storage.local` on every state change so it survives worker restarts.
- **Messaging**: typed message contract between background and UI contexts (start/pause/resume/skip commands one way, state broadcasts the other way). Use `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`, wrapped in a typed helper — no raw untyped message objects anywhere.
- **Notifications**: use `chrome.notifications` for phase-transition alerts (focus session ends, break ends), fired from the background worker so they work even when the popup is closed.
- **Storage split**:
  - `state:timer` — current/live timer state (small, frequently written)
  - `logs:<YYYY-MM-DD>` — completed session log entries, one key per day, so reads for "today" or "this week" don't require scanning the whole history
  - `settings` — durations, sound on/off, daily goal, etc.
- **Session log shape**:
  ```ts
  interface Session {
    id: string
    type: 'focus' | 'short-break' | 'long-break'
    startedAt: number   // epoch ms
    endedAt: number
    completed: boolean  // true if it ran to completion, false if skipped/cancelled
    tag?: string         // optional project/task label
  }
  ```

## File structure

Set this up so new entrypoints (e.g. a side panel later) or new metrics can be added without restructuring:

```
pomodoro-metrics/
  wxt.config.ts
  package.json
  tsconfig.json
  tailwind.config.ts

  entrypoints/
    background.ts              # service worker: alarm handling, message router
    popup/
      index.html
      App.vue
      main.ts
    dashboard/                  # options page, doubles as the metrics view
      index.html
      App.vue
      main.ts

  components/
    timer/
      TimerRing.vue
      PhaseControls.vue
    dashboard/
      FocusChart.vue
      StreakCard.vue
      SessionHistoryTable.vue
    shared/
      AppButton.vue

  stores/
    timer.ts                    # Pinia store — mirrors background state, dispatches commands
    metrics.ts                  # Pinia store — derived stats over session logs

  lib/
    storage/
      keys.ts                   # typed storage key builders, e.g. logKey(date)
      timer-state.ts            # get/set helpers for state:timer
      logs.ts                   # get/append/query helpers for logs:*
      settings.ts
    messaging/
      types.ts                  # discriminated union of all message types
      client.ts                 # UI-side: send commands, subscribe to broadcasts
      router.ts                 # background-side: handle incoming messages
    timer/
      engine.ts                 # pure functions: phase transitions, duration calc — no chrome.* calls, so it's unit-testable
      alarms.ts                 # chrome.alarms wiring, calls into engine.ts
    metrics/
      aggregate.ts              # pure functions: daily/weekly totals, streaks, completion rate

  types/
    session.ts
    settings.ts

  tests/
    timer-engine.test.ts
    metrics-aggregate.test.ts
    storage-logs.test.ts
```

Key rule for this layout: anything under `lib/timer/engine.ts` and `lib/metrics/aggregate.ts` must be pure functions with no `chrome.*` API calls, so they're testable with plain Vitest and reusable if a dashboard page or a future mobile companion needs the same math.

## Build steps, in order

1. Scaffold the WXT + Vue + TS project structure above.
2. Implement `lib/timer/engine.ts` first, with unit tests — this is the core logic everything else depends on.
3. Wire `entrypoints/background.ts` to use the engine via `chrome.alarms`, persisting state to `chrome.storage.local`.
4. Implement the messaging layer (`lib/messaging/`).
5. Build the popup: countdown ring, start/pause/skip, current phase.
6. Implement `lib/storage/logs.ts` and append a `Session` entry whenever a phase completes or is cancelled.
7. Build the dashboard: today/week totals, a focus-time bar chart (Chart.js), streak counter, and a raw session history table.
8. Add a settings section (durations, notification sound) backed by `lib/storage/settings.ts`.
9. Write a short README explaining the architecture and how to add a new entrypoint or metric.

Ask me before adding any dependency not listed above.
