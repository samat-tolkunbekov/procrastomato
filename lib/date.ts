// Pure local-calendar-day helpers shared by lib/storage/logs.ts (for the
// logs:<date> bucket keys) and lib/metrics/aggregate.ts (for grouping and
// streak math) — kept dependency-free so both can stay free of chrome.*
// calls and be trivially unit-testable.

export function dateKeyFor(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return dateKeyFor(date.getTime());
}

// Monday-based week start by default (weekStartsOn: 0 = Sunday, 1 = Monday).
export function startOfWeekKey(dateKey: string, weekStartsOn: 0 | 1 = 1): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return dateKeyFor(date.getTime());
}
