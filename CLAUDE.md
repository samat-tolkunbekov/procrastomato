# Procrastomato

A Chrome extension (Manifest V3) Pomodoro timer. Plain JS/HTML/CSS, no build
step — load the repo root directly as an unpacked extension.

For current status and next steps, see `PROGRESS.md`. This file covers the
stable architecture that shouldn't need to change often.

## Why timestamps, not a ticking counter

MV3 background scripts are **service workers**: Chrome can kill them whenever
idle and wake them later. You cannot keep a `setInterval` alive in the
background and trust it to tick every second forever — it won't.

So the design never treats "seconds remaining" as mutable state. Instead:

- A session stores `startTime`, `endTime`, and a list of `pauses` (each with
  `pausedAt` / `resumedAt`) — plain timestamps.
- Elapsed/remaining time is always *derived* from those timestamps at the
  moment you need it (`src/timer.js`), never stored or incremented directly.
- The popup can show a smooth live countdown because it's just a regular web
  page — while it's open, its own `setInterval` recomputes from timestamps
  every second (see `tick()` in `src/popup.js`). This resets fine on
  popup close/reopen because nothing is lost — it's recomputed each time.
- The service worker (`src/background.js`) doesn't tick at all. It reacts to
  two events: `chrome.storage.onChanged` (something changed — recompute the
  badge/alarm) and a `chrome.alarms` periodic alarm capped at 1-minute
  granularity (Chrome's minimum) that updates the toolbar badge and checks
  whether the session's time is up.

If you're tempted to "fix" perceived badge lag by shortening the alarm
period: you can't go below 1 minute, that's a Chrome platform limit
(`chrome.alarms` docs). The popup's own countdown is what provides
second-level feedback while it's open.

## Data model

Everything lives under a single key in `chrome.storage.local`
(`procrastomatoState`, see `src/storage.js`):

```js
{
  sessions: [
    {
      id: "uuid",
      title: "string",
      description: "string",            // optional, may be ""
      plannedDurationMinutes: 25,
      status: "active" | "paused" | "completed" | "stopped" | "manual",
      startTime: "ISO string",
      endTime: "ISO string" | null,      // set once stopped/completed/manual
      pauses: [{ pausedAt: "ISO", resumedAt: "ISO" | null }]
    }
  ],
  activeSessionId: "uuid" | null,        // points into sessions while active/paused
  settings: { defaultDurationMinutes: 25 }
}
```

- At most one session is `active`/`paused` at a time (`activeSessionId`).
  Starting a new one while one is in progress is rejected
  (`storage.js#startSession` throws).
- `manual` sessions are logged directly with explicit start/end and never
  touch `activeSessionId` or `pauses`.
- "Adjusting time" on a running session just edits `plannedDurationMinutes`
  in place (`adjustActiveDuration`) — no timestamp surgery needed since
  remaining time is always derived.

## File layout

```
manifest.json          MV3 manifest — permissions: storage, alarms, notifications
icons/                  placeholder PNG icons (16/32/48/128), script-generated
src/
  timer.js              pure functions: elapsed/remaining/format — no I/O, no chrome.* calls
  storage.js             chrome.storage.local read/write + all session mutation logic
                          (shared by popup.js and background.js so business rules
                          like "how a session completes" live in exactly one place)
  background.js          service worker: badge text, chrome.alarms, completion notification
  popup.html/css/js      the toolbar popup UI: start form, active timer, manual log
                          form, history list with edit/delete
```

`storage.js` and `timer.js` are plain ES modules (`import`/`export`),
imported both by `popup.js` (`<script type="module">`) and by
`background.js` (manifest declares `"type": "module"` for the service
worker) — this is how MV3 service workers support ES modules natively, no
bundler needed.

## The toolbar icon / "corner icon" requirement

Chrome extensions already put every extension's icon in the toolbar (top
right of the browser) by default — clicking it opens `default_popup`. No
special code was needed for basic visibility/click-to-open. What we *did*
build on top of that: `chrome.action.setBadgeText` shows remaining minutes
(or a pause glyph) on top of that icon so status is visible without opening
the popup.
