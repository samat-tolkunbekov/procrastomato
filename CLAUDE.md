# Procrastomato

A browser extension (Manifest V3, Chrome + Firefox) Pomodoro timer that logs
every session and shows productivity metrics. Built with
[WXT](https://wxt.dev), Vue 3 (`<script setup>`/Composition API only — no
Options API), TypeScript (strict), Pinia, Tailwind, Chart.js, and Vitest.

For current status and next steps, see `PROGRESS.md`. This file covers the
stable architecture that shouldn't need to change often.

## Why timestamps, not a ticking counter

MV3 background scripts are **service workers**: the browser can kill them
whenever idle and wake them later. You cannot keep a `setInterval` alive in
the background and trust it to tick every second forever — it won't.

So the design never treats "seconds remaining" as mutable state. Instead:

- `types/timer.ts`'s `TimerState` stores `phaseStartedAt`, `phaseDuration`,
  `isPaused`, `pausedAt`, `pausedElapsed` — plain timestamps/durations, one
  "current phase" at a time (persisted to `chrome.storage.local` under
  `state:timer`, see `lib/storage/timer-state.ts`).
- Elapsed/remaining time is always *derived* from those timestamps at the
  moment you need it (`lib/timer/engine.ts`), never stored or incremented
  directly.
- The popup and dashboard can show a smooth live countdown because they're
  just regular web pages — while mounted, `stores/timer.ts`'s own
  `setInterval` recomputes from timestamps every second (see `nowMs`/the
  computed getters in that store). This resets fine on popup close/reopen
  because nothing is lost — it's recomputed each time.
- The service worker (`entrypoints/background.ts` + `lib/timer/alarms.ts`)
  doesn't tick at all. It reacts to three things: `chrome.runtime.onMessage`
  (a command from the popup/dashboard), `chrome.storage.onChanged` on
  `state:timer` (something changed — recompute the badge/alarm), and a
  `chrome.alarms` periodic alarm capped at 1-minute granularity (Chrome's
  minimum) that updates the toolbar badge and checks whether the running
  phase's time is up.

If you're tempted to "fix" perceived badge lag by shortening the alarm
period: you can't go below 1 minute, that's a Chrome platform limit
(`chrome.alarms` docs). The Pinia stores' own countdown is what provides
second-level feedback while a popup/dashboard is open.

## Architecture: background is the source of truth

The popup and dashboard are dumb views — they read state and send typed
commands (`lib/messaging/types.ts`'s `TimerCommand` union) via
`lib/messaging/client.ts`; they never run their own timer logic, only a
display-refresh tick (see above). `entrypoints/background.ts` wires
`chrome.runtime.onMessage` to `lib/messaging/router.ts#handleCommand`,
which applies the command via `lib/timer/engine.ts`'s pure reducers,
persists the result, and broadcasts it (`lib/messaging/broadcast.ts`) so
any other open popup/dashboard instance stays in sync without polling.

## Data model

Storage is split across three key patterns in `chrome.storage.local` (see
`lib/storage/keys.ts`), so reads for "today"/"this week" don't require
scanning the whole history:

- `state:timer` — the single running `TimerState` (`types/timer.ts`):
  `{ phase, phaseStartedAt, phaseDuration, isPaused, pausedAt, pausedElapsed, focusSessionsCompleted, currentTag?, currentTitle?, currentNote? }`.
  At most one phase is running at a time; `phaseStartedAt === null` means
  idle.
- `logs:<YYYY-MM-DD>` — an array of completed/skipped `Session` entries for
  that local calendar day (`types/session.ts`):
  `{ id, type: 'focus'|'short-break'|'long-break', startedAt, endedAt, completed, tag?, title?, note? }`.
  `title`/`note` are additive beyond the original Pomodoro Metrics spec —
  they preserve this app's original "what are you working on" / manual-log
  UX. Managed by `lib/storage/logs.ts`.
- `settings` — durations per phase, long-break interval, sound-on/off
  (stored but not yet wired to actual audio, see `lib/timer/alarms.ts`),
  daily goal minutes (`types/settings.ts`, `lib/storage/settings.ts`).

`lib/timer/engine.ts` and `lib/metrics/aggregate.ts` are pure functions —
no `chrome.*`/`browser.*` calls — so they're unit-testable with plain
Vitest (`tests/timer-engine.test.ts`, `tests/metrics-aggregate.test.ts`)
and reusable wherever the same math is needed.

## File layout

```
wxt.config.ts           manifest generation, modules (@wxt-dev/module-vue), options_ui wiring

entrypoints/
  background.ts           service worker: alarms, storage-change/message listeners
  popup/                   toolbar popup UI
  dashboard/                options page (chrome://extensions "Details" -> "Extension options"),
                             doubles as the metrics dashboard — wired via
                             wxt.config.ts's manifest.options_ui since
                             "dashboard" isn't one of WXT's auto-detected
                             entrypoint names (only entrypoints/options/ is)

components/timer/, components/dashboard/, components/shared/
stores/timer.ts, stores/metrics.ts
lib/storage/, lib/messaging/, lib/timer/, lib/metrics/, lib/date.ts, lib/id.ts
types/session.ts, types/settings.ts, types/timer.ts
tests/
```

Use the `browser` global from `wxt/browser` (backed by
`webextension-polyfill`) rather than raw `chrome.*` in new code — that's
what makes the same codebase work on both Chrome and Firefox.

## The toolbar icon / "corner icon" requirement

Browsers already put every extension's icon in the toolbar by default —
clicking it opens the popup. No special code was needed for basic
visibility/click-to-open. What we *did* build on top of that:
`browser.action.setBadgeText` shows remaining minutes (or a pause glyph) on
top of that icon so status is visible without opening the popup
(`lib/timer/alarms.ts#syncBadgeAndAlarm`).
