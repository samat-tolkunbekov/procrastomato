# Procrastomato

A simple Pomodoro timer with task tracking, stored locally in your browser —
a Chrome extension (Manifest V3), plain JS/HTML/CSS, no build step.

## Features

- Start/pause/resume a countdown timer with a title and description
- Default 25-minute duration, adjustable per session (and while running)
- Manual logging of past sessions
- Toolbar badge showing remaining minutes / pause status
- Completion notification
- History list with edit/delete

## Installing (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this repo's root directory

## Project layout

```
manifest.json          MV3 manifest
icons/                  toolbar/extension icons
src/
  timer.js              pure elapsed/remaining/format helpers
  storage.js             chrome.storage.local read/write + session logic
  background.js          service worker: badge, alarms, notifications
  popup.html/css/js      toolbar popup UI
```

See `CLAUDE.md` for the architecture and data model, and `PROGRESS.md` for
the current status and next steps.
