// Typed storage key builders. Storage is split per Prompt.md so reads for
// "today"/"this week" don't require scanning the whole session history:
//   state:timer   — current/live timer state (small, frequently written)
//   logs:<date>   — completed session log entries, one key per day
//   settings      — durations, sound on/off, daily goal, etc.

export const STORAGE_KEYS = {
  timerState: "state:timer",
  settings: "settings",
} as const;

export function logKey(dateKeyStr: string): string {
  return `logs:${dateKeyStr}`;
}
