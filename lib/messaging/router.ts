// Background-side message handler: applies a TimerCommand to the persisted
// TimerState via lib/timer/engine.ts's pure reducers, logs a Session entry
// for any phase that ends (skip or completion), and broadcasts the result
// so any other open popup/dashboard instance stays in sync.

import { generateId } from "../id";
import { appendLog } from "../storage/logs";
import { getSettings } from "../storage/settings";
import { checkAndComplete } from "../timer/alarms";
import * as engine from "../timer/engine";
import { getTimerState, setTimerState } from "../storage/timer-state";
import type { Session } from "../../types/session";
import type { TimerState } from "../../types/timer";
import { broadcastState } from "./broadcast";
import type { TimerCommand, TimerCommandResult } from "./types";

export function buildSessionFromState(state: TimerState, now: number, completed: boolean): Session {
  return {
    id: generateId(),
    type: state.phase,
    startedAt: state.phaseStartedAt as number,
    endedAt: now,
    completed,
    tag: state.currentTag,
    title: state.currentTitle,
    note: state.currentNote,
  };
}

export async function handleCommand(command: TimerCommand): Promise<TimerCommandResult> {
  try {
    switch (command.type) {
      case "getState": {
        // Mirrors the old popup.js init pattern: check for an
        // already-overdue phase before returning state, so the UI doesn't
        // have to wait for the next 1-minute alarm tick to see it end.
        const state = await checkAndComplete();
        return { ok: true, state };
      }

      case "start": {
        const settings = await getSettings();
        const state = await getTimerState();
        if (engine.isRunning(state)) {
          return { ok: false, error: "A phase is already in progress." };
        }
        const next = engine.start(state, command.phase, settings, Date.now(), command.meta);
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "pause": {
        const state = await getTimerState();
        const next = engine.pause(state, Date.now());
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "resume": {
        const state = await getTimerState();
        const next = engine.resume(state, Date.now());
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "adjustDuration": {
        const state = await getTimerState();
        const next = engine.adjustDuration(state, command.minutes);
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "updateCurrentMeta": {
        const state = await getTimerState();
        const next: TimerState = {
          ...state,
          currentTag: command.meta.tag,
          currentTitle: command.meta.title,
          currentNote: command.meta.note,
        };
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "skip": {
        // Allowed from an idle break screen too (the "skip this break, go
        // straight to focus" button), not just mid-phase — only log a
        // session if a phase was actually running to skip out of.
        const settings = await getSettings();
        const state = await getTimerState();
        if (engine.isRunning(state)) {
          const session = buildSessionFromState(state, Date.now(), false);
          await appendLog(session);
        }
        const next = engine.skip(state, settings);
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }

      case "stop": {
        const state = await getTimerState();
        if (!engine.isRunning(state)) {
          return { ok: false, error: "Nothing is running." };
        }
        const session = buildSessionFromState(state, Date.now(), false);
        await appendLog(session);
        const next = engine.stop(state);
        await setTimerState(next);
        await broadcastState(next);
        return { ok: true, state: next };
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
