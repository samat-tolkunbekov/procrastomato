// Pure time-calculation helpers shared by popup.js and background.js.
// Everything here is derived from stored timestamps — nothing here keeps its
// own running state, so it's safe to call from a service worker that may be
// woken up cold at any time.

export function totalPausedSeconds(pauses, now = new Date()) {
  return pauses.reduce((sum, pause) => {
    const pausedAt = new Date(pause.pausedAt);
    const resumedAt = pause.resumedAt ? new Date(pause.resumedAt) : now;
    return sum + Math.max(0, (resumedAt - pausedAt) / 1000);
  }, 0);
}

export function isCurrentlyPaused(session) {
  const last = session.pauses[session.pauses.length - 1];
  return Boolean(last && !last.resumedAt);
}

// Elapsed active (non-paused) seconds since start, up to `now` or endTime.
export function computeElapsedSeconds(session, now = new Date()) {
  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : now;
  const raw = (end - start) / 1000;
  const paused = totalPausedSeconds(session.pauses, end);
  return Math.max(0, raw - paused);
}

export function computeRemainingSeconds(session, now = new Date()) {
  const plannedSeconds = session.plannedDurationMinutes * 60;
  return plannedSeconds - computeElapsedSeconds(session, now);
}

export function isSessionDue(session, now = new Date()) {
  return (
    (session.status === "active" || session.status === "paused") &&
    computeRemainingSeconds(session, now) <= 0
  );
}

export function formatMMSS(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationHuman(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

// Duration to show in the history list: for finished sessions, the actual
// active time worked (endTime - start - pauses); for manual entries, the
// plain wall-clock span between start and end.
export function sessionDurationSeconds(session) {
  if (session.status === "manual") {
    return Math.max(0, (new Date(session.endTime) - new Date(session.startTime)) / 1000);
  }
  return computeElapsedSeconds(session, session.endTime ? new Date(session.endTime) : new Date());
}
