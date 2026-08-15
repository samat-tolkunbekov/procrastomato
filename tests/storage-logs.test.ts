import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../types/session";

// lib/storage/* talks to chrome.storage.local via wxt/browser, which
// resolves `browser` to globalThis.chrome once, at module-evaluation time
// (see node_modules/@wxt-dev/browser). So the fake must be installed via
// vi.stubGlobal BEFORE the module under test is ever imported — done here
// with a top-level dynamic import — and each test clears the shared fake
// store's contents rather than swapping out chrome itself.
const store: Record<string, unknown> = {};

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: async (keys?: string | string[] | null) => {
        if (keys == null) return { ...store };
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyList) if (k in store) result[k] = store[k];
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      },
    },
  },
});

const {
  appendLog,
  updateLogEntry,
  deleteLogEntry,
  getLogsForDate,
  getLogsInRange,
  moveLogEntry,
  getTagSuggestions,
  dateKeyFor,
} = await import("../lib/storage/logs");

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    type: "focus",
    startedAt: 0,
    endedAt: 0,
    completed: true,
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = Date.now();

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe("lib/storage/logs", () => {
  it("appends a log entry under the correct day bucket", async () => {
    const session = makeSession({ startedAt: BASE, endedAt: BASE + 1500 * 1000 });
    await appendLog(session);
    const logs = await getLogsForDate(dateKeyFor(BASE));
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(session.id);
  });

  it("updates and deletes entries within a day bucket", async () => {
    const session = makeSession({ startedAt: BASE, endedAt: BASE + 1500 * 1000 });
    await appendLog(session);
    const key = dateKeyFor(BASE);

    await updateLogEntry(key, session.id, { title: "Renamed" });
    let logs = await getLogsForDate(key);
    expect(logs[0].title).toBe("Renamed");

    await deleteLogEntry(key, session.id);
    logs = await getLogsForDate(key);
    expect(logs).toHaveLength(0);
  });

  it("queries a range spanning multiple day buckets", async () => {
    const day0 = BASE;
    const day1 = BASE + DAY_MS;
    const day2 = BASE + 2 * DAY_MS;
    await appendLog(makeSession({ startedAt: day0, endedAt: day0 + 1000 }));
    await appendLog(makeSession({ startedAt: day1, endedAt: day1 + 1000 }));
    await appendLog(makeSession({ startedAt: day2, endedAt: day2 + 1000 }));

    const results = await getLogsInRange(day0, day1 + 60_000);
    expect(results).toHaveLength(2);
  });

  it("moves an entry between day buckets when its date changes", async () => {
    const originalStart = BASE;
    const session = makeSession({ startedAt: originalStart, endedAt: originalStart + 1000 });
    await appendLog(session);

    const newStart = BASE + DAY_MS;
    const moved = { ...session, startedAt: newStart, endedAt: newStart + 1000 };
    await moveLogEntry(dateKeyFor(originalStart), moved);

    expect(await getLogsForDate(dateKeyFor(originalStart))).toHaveLength(0);
    expect(await getLogsForDate(dateKeyFor(newStart))).toHaveLength(1);
  });

  it("collects unique tag suggestions, ignoring blanks and duplicates", async () => {
    await appendLog(makeSession({ startedAt: BASE, endedAt: BASE + 1000, tag: "writing" }));
    await appendLog(
      makeSession({ startedAt: BASE + 60_000, endedAt: BASE + 61_000, tag: "writing" })
    );
    await appendLog(makeSession({ startedAt: BASE + 120_000, endedAt: BASE + 121_000, tag: "" }));
    const tags = await getTagSuggestions();
    expect(tags).toEqual(["writing"]);
  });
});
