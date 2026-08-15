# Procrastomato

A Pomodoro timer that logs every session and shows productivity metrics —
a browser extension (Manifest V3, targeting Chrome and Firefox) built with
[WXT](https://wxt.dev), Vue 3, TypeScript, and Pinia.

## Features

- Auto-cycling focus / short-break / long-break phases (a long break every
  N focus sessions, configurable)
- Pause/resume and on-the-fly duration adjustment for the running phase
- Optional title/tag/note per focus session
- Manual logging of past sessions, with edit/delete history
- Toolbar badge showing remaining minutes / pause status, and a completion
  notification for each phase transition
- Dashboard (the extension's options page): today/week focus totals, a
  streak counter, a focus-time bar chart, full session history, and settings
  (durations, long-break interval, daily goal)

## Architecture

The background service worker is the single source of truth for timer
state — the popup and dashboard are dumb views that read state and send
typed commands; neither runs its own countdown. See `CLAUDE.md` for the
full rationale (why timestamps, not a ticking counter) and data model, and
`PROGRESS.md` for current status and next steps.

```
wxt.config.ts           WXT config — manifest, modules (Vue, Tailwind)

entrypoints/
  background.ts          service worker: alarm handling, message router
  popup/                  toolbar popup: countdown ring, phase controls
  dashboard/               options page — metrics dashboard + settings

components/
  timer/                  TimerRing, PhaseControls, ManualLogForm
  dashboard/              FocusChart, StreakCard, SessionHistoryTable, SettingsPanel
  shared/                 AppButton

stores/
  timer.ts                Pinia store mirroring background state, dispatches commands
  metrics.ts               Pinia store — derived stats over session logs

lib/
  storage/                 typed chrome.storage.local helpers (keys, timer-state, logs, settings)
  messaging/                typed background<->UI message contract (types, router, client, broadcast)
  timer/                    engine.ts (pure phase-cycling math) + alarms.ts (chrome.alarms wiring)
  metrics/                  aggregate.ts — pure daily/weekly totals, streaks, completion rate
  date.ts                   pure local-calendar-day helpers shared by storage/logs and metrics/aggregate
  id.ts                     generateId()

types/
  session.ts, settings.ts, timer.ts

tests/
  timer-engine.test.ts, metrics-aggregate.test.ts, storage-logs.test.ts
```

`lib/timer/engine.ts` and `lib/metrics/aggregate.ts` are pure functions with
no `chrome.*`/`browser.*` calls — that's what makes them unit-testable with
plain Vitest, and reusable if a future entrypoint (a side panel, say) or a
new metric needs the same math.

## Adding a new entrypoint

1. Create `entrypoints/<name>/{index.html,main.ts,App.vue}` (WXT picks up
   any folder with an `index.html` automatically; special names like
   `popup`/`options`/`background` get auto-wired into the manifest, other
   names build as an unlisted page you can wire in manually — see how
   `wxt.config.ts` points `options_ui.page` at `dashboard.html`).
2. Reuse `stores/timer.ts` / `stores/metrics.ts` for state rather than
   talking to `lib/storage/*` or `lib/messaging/*` directly from a
   component.
3. Run `npm run dev` (or `npm run dev:firefox`) and load the unpacked
   build from `.output/` to try it.

## Adding a new metric

1. Add the pure aggregation function to `lib/metrics/aggregate.ts`, with a
   test in `tests/metrics-aggregate.test.ts`.
2. Expose it as a computed property on `stores/metrics.ts`.
3. Render it from a new or existing component under `components/dashboard/`.

## Development

```
npm install
npm run dev          # Chrome, with HMR
npm run dev:firefox  # Firefox
npm run test         # Vitest
npm run compile      # vue-tsc --noEmit
npm run build         # production build -> .output/<target>/
```

## Installing (unpacked)

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked**, and select `.output/chrome-mv3/`.
