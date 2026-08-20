# Progress log

See `CLAUDE.md` for architecture/data-model reference — this file is just the
running "what's done, what's next" log, most recent entry first.

## 2026-08-20 — Reset/End controls, manual long-break start, quick pomodoro settings

Reworked the popup's phase controls per the user's ask:

- **Renamed "Stop" to "Reset"** on the running-focus page (same behavior as
  before — discards progress, no session logged, parks idle back on the
  same phase). Renamed throughout the stack for consistency, not just the
  label: `engine.stop` -> `engine.reset`, the `"stop"` message command ->
  `"reset"`, `stores/timer.ts`'s `stop()` -> `reset()`.
- **New "End" button** (focus and break, while running): ends the phase
  early but logs it as a *completed* session (`completed: true`, using
  whatever elapsed time there was) and advances to the next phase, same
  cycling rule as a natural completion. Reuses `engine.completePhase`
  as-is in `lib/messaging/router.ts`'s new `"end"` case — no new engine
  reducer needed, since completePhase already doesn't care whether `now`
  is the planned end or an early one.
- **Break idle page**: added a "Start long break" button alongside the
  existing Skip/"Start short break" pair, shown whenever the auto-computed
  next phase isn't already a long break — lets the user manually take a
  long break out of cycle. Reuses the existing `start` command with an
  explicit `phase` argument; `TimerRing`'s label already derives from
  `state.phase`, so no separate wiring was needed to make the "under the
  timer" text track whichever break actually got started.
- **`components/timer/PomodoroSettings.vue`** (new): a collapsed-by-default
  "Settings" panel on the idle-focus page, expandable on click, with a
  +/- pomodoro-count control that steps `settings.focusMinutes` in
  25-minute increments only, plus short-break/long-break length `<select>`
  dropdowns (both include the currently-saved value as an option even if
  it's not one of the presets, so selecting doesn't silently change it on
  render). Writes straight through `stores/metrics.ts`'s existing
  `saveSettings`, so the choice persists via the same `settings` storage
  key the dashboard's full `SettingsPanel.vue` already reads/writes — no
  new storage plumbing.

**Verified:** `npm run test` (31 Vitest tests, `timer-engine.test.ts`
updated for the `stop`->`reset` rename), `npm run compile` (clean), `npm
run build` (chrome-mv3, clean). Also did a real browser click-through this
time (Playwright + Chromium, loading the built `.output/chrome-mv3`
extension unpacked and driving `popup.html` directly): expanded the
settings panel, incremented pomodoros to 50 min and confirmed it stuck
across a Reset and a fresh Start; started/Reset a focus session; started/
Ended a focus session early and landed on the short-break idle page with
the new "Start long break" button visible; clicked it and confirmed a real
15:00 long break started with the "Long break" label updating correctly;
Skipped a running break back to focus idle; separately confirmed changing
the short-break length select to 10 min actually changes the started
break's duration, and that Ending (not skipping) a break saves it and
returns to focus idle.

**Not yet done:**
- No automated component-level test for the new `PomodoroSettings.vue` or
  the router's new `"end"` case (matches the project's existing pattern —
  only the pure `lib/timer/engine.ts` reducers have Vitest coverage; `end`
  reuses `completePhase`, which is already tested).
- Firefox build/click-through wasn't repeated for this change (only
  chrome-mv3 was driven); nothing in this change touches
  browser-specific APIs so it should carry over, but it's untested.

## 2026-08-15 — Port to WXT + Vue 3 + TypeScript + Pinia + Tailwind + Chart.js

Ported the whole extension from plain JS/HTML/CSS (no build step) to the
stack specified in `Prompt.md`: WXT, Vue 3 (`<script setup>`/Composition
API), TypeScript (strict), Pinia, Tailwind, Chart.js/vue-chartjs, and
Vitest. Per the plan agreed with the user (see the three decisions below),
this was a genuine architecture change, not just a lift-and-shift.

Decisions made with the user before starting:
- **Adopted Prompt.md's auto-cycling focus/short-break/long-break phase
  model**, replacing the old single-duration/pause-resume session model.
  `lib/timer/engine.ts`'s pure reducers (`start`/`pause`/`resume`/`skip`/
  `completePhase`/`adjustDuration`) generalize the old `storage.js`
  mutators onto a `TimerState` shaped like Prompt.md's spec
  (`phase`/`phaseStartedAt`/`phaseDuration`/`isPaused`/`pausedElapsed`),
  plus `nextPhaseType()` for the short-break-vs-long-break cycling that
  Prompt.md didn't fully specify (long break every `longBreakInterval`
  focus sessions, configurable, default 4).
- **Dropped the multi-device sync feature** (`src/sync.js`,
  `ulquiorra/BACKEND_SPEC.md`) — out of scope for this port.
  `ulquiorra/BACKEND_SPEC.md` is left untouched but now describes a
  contract nothing in the extension talks to.
- **Kept "Procrastomato" branding** rather than Prompt.md's "Pomodoro
  Metrics" name.
- **One deliberate deviation from Prompt.md's literal `Session` type**:
  added optional `title`/`note` fields beyond `tag`, to preserve the
  original app's "what are you working on" / manual-log-and-edit UX that
  Prompt.md's spec (written for a from-scratch app) didn't otherwise have
  a place for.

What moved where (business logic preserved, not rewritten from scratch):
`src/timer.js`'s derive functions -> `lib/timer/engine.ts`; `storage.js`'s
session mutators -> `lib/timer/engine.ts` reducers + `lib/messaging/router.ts`
(now background-mediated instead of called directly from the popup, since
Prompt.md requires the background to own timer state exclusively);
`addManualSession`/`updateSessionRecord`/`deleteSessionRecord`/suggestion
lists -> `lib/storage/logs.ts` (still called directly from
`stores/metrics.ts`, same as before, since log CRUD has no concurrent-writer
race the way live timer state does); `background.js`'s badge/alarm/
notification logic -> `lib/timer/alarms.ts`, same 1-minute-alarm-granularity
design.

New: `lib/metrics/aggregate.ts` (daily/weekly totals, streaks, completion
rate, daily-goal progress — all pure, tested), the dashboard (options page:
`FocusChart.vue` bar chart, `StreakCard.vue`, `SessionHistoryTable.vue`,
`SettingsPanel.vue`), and a typed `lib/messaging/` contract between
background and UI (previously the popup called `storage.js` directly and
relied on `chrome.storage.onChanged` alone).

**Verified:** `npm run test` (29 Vitest tests across `timer-engine`,
`metrics-aggregate`, `storage-logs` — the storage tests use a small
in-memory `chrome.storage.local` fake via `vi.stubGlobal`), `npm run
compile` (`vue-tsc --noEmit`, strict, clean), `npm run build` for both
`chrome-mv3` and `firefox-mv2` targets (clean, correct manifest —
`options_ui.page` pointing at the built `dashboard.html`, icons copied from
`public/icons/`).

**Not verified:** actually loading either unpacked build in a browser and
clicking through the flows (start a focus phase -> pause/resume -> auto
phase-transition -> notification -> badge -> short/long break cycling ->
manual log -> edit/delete -> settings) — no browser-automation tooling is
set up in this environment. This is the same limitation logged for the
original build below; next session (human or Claude) should do that
click-through, on both Chrome and Firefox, before relying on this.

**Not yet done:**
- `settings.soundEnabled` is stored but not wired to actual audio —
  `chrome.notifications` has no cross-browser "silent" flag, and real
  playback from a service worker needs an offscreen document. Noted inline
  in `lib/timer/alarms.ts`.
- No automated Vue-component tests (Prompt.md explicitly deferred UI
  testing — "UI can stay untested initially").
- The `ulquiorra/` sync backend spec is now stale relative to the
  extension (sync was dropped) — flag if multi-device sync comes back up.

## 2026-08-08 — Multi-device sync (extension side)

Built the extension half of cross-device sync, per the design agreed with
the user: a sync key (not a login), since the user runs this on multiple
machines under different Google accounts and `chrome.storage.sync` can't
bridge those. Full design rationale and backend contract are in
`ulquiorra/BACKEND_SPEC.md` — that backend is a separate project/session,
not built yet.

- `src/storage.js`: every mutator now stamps `updatedAt` on the session it
  touches; `deleteSessionRecord` tombstones (`deletedAt`) instead of
  removing, so a sync merge can't resurrect something deleted on the other
  device; added `overwriteState()` for the sync layer to write a merged
  state back.
- `src/sync.js` (new): sync-key management (`enableSync`/`disableSync`/
  `regenerateToken`), `mergeStates` (per-session last-write-wins by
  `updatedAt`, with a tie-break rule for the rare case of two machines both
  starting a session while offline), and `runSync` (pull → merge → push
  against the `GET`/`PUT /sync/state` contract, single retry on a 409).
- `src/popup.js`/`popup.html`: new Settings/Sync card — enable (generate or
  paste a code) / sync now / regenerate / disable. History list now filters
  out tombstoned sessions.
- `manifest.json`: added `optional_host_permissions` so the extension can
  request access to a user-supplied backend URL at runtime, since that
  host isn't known at manifest-authoring time.

**Verified:** all five source files pass `node --check` (syntax); wrote a
throwaway fixture script exercising `mergeStates` directly (union of
disjoint sessions, newer-`updatedAt`-wins on conflicting edits, tombstone
vs. edit races both directions, dual-active-session tie-break) — all
passed. **Not verified:** actually loading the unpacked extension in
Chrome and clicking through the new Sync UI (and the existing flows, to
confirm the `updatedAt`/tombstone changes didn't regress anything) — no
browser-automation tooling is set up in this environment, and there's no
backend yet to sync against anyway. Next session (human or Claude) should
do that click-through before relying on this.

**Not yet done:**
- The backend itself (`ulquiorra/BACKEND_SPEC.md` has the full contract).
- Once a backend exists, real end-to-end sync between two loaded copies of
  the extension hasn't been exercised at all — only the client-side merge
  logic has been tested in isolation.

## 2026-08-07 — Initial build

Built the full MVP from scratch (empty repo → working extension), per the
plan agreed with the user. All 8 requirements from the original ask are
implemented:

- Start/countdown, default 25 min duration, title+description, pause/resume,
  manual past-session logging, local storage persistence, popup UI, toolbar
  badge for at-a-glance status.
- Stop (early end) and adjust-duration-while-running were added as natural
  extensions of "pause" and "manual time" since the user confirmed both
  interpretations of "add time manually" were wanted.
- History list with edit/delete on every past session.

**Not yet done / not tested against a real browser:**
- Have not yet loaded the unpacked extension in `chrome://extensions` and
  clicked through the flows (start → pause → resume → complete → notification
  → badge clears; stop early; manual log; edit; delete). This is next.
- Icons are placeholder PNGs generated by a one-off script (no Pillow/
  ImageMagick available in this environment, so a minimal raw PNG encoder
  was written to draw a red circle + green leaf). Fine to replace with real
  artwork later — nothing else depends on their appearance.
- No automated tests. Given the small scope (~4 files, no build step) manual
  verification was the agreed plan; revisit if the codebase grows.

**Open decisions nobody's raised yet, flag if it comes up:**
- No way to change `settings.defaultDurationMinutes` from the UI yet — it's
  hardcoded to 25 in `storage.js`'s `DEFAULT_STATE`. The start form lets you
  override per-session, so this only matters if the user wants the *default*
  itself to be persistently changeable.
- No cap on history length — `sessions` array grows forever in
  `chrome.storage.local` (5MB quota by default for unpacked/local storage
  API without `unlimitedStorage`). Not a near-term concern but worth knowing
  if this becomes a long-lived install.
