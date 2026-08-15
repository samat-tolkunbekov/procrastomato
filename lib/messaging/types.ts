// Typed message contract between background and UI contexts — no raw
// untyped message objects anywhere (per Prompt.md's messaging rule).
// Commands flow UI -> background; broadcasts flow background -> UI.

import type { PhaseType } from "../../types/session";
import type { TimerState } from "../../types/timer";

export interface SessionMeta {
  tag?: string;
  title?: string;
  note?: string;
}

export interface StartCommand {
  type: "start";
  phase: PhaseType;
  meta?: SessionMeta;
}
export interface PauseCommand {
  type: "pause";
}
export interface ResumeCommand {
  type: "resume";
}
export interface SkipCommand {
  type: "skip";
}
export interface AdjustDurationCommand {
  type: "adjustDuration";
  minutes: number;
}
export interface UpdateCurrentMetaCommand {
  type: "updateCurrentMeta";
  meta: SessionMeta;
}
export interface GetStateCommand {
  type: "getState";
}

export type TimerCommand =
  | StartCommand
  | PauseCommand
  | ResumeCommand
  | SkipCommand
  | AdjustDurationCommand
  | UpdateCurrentMetaCommand
  | GetStateCommand;

export interface TimerCommandOk {
  ok: true;
  state: TimerState;
}
export interface TimerCommandErr {
  ok: false;
  error: string;
}
export type TimerCommandResult = TimerCommandOk | TimerCommandErr;

// Background -> UI, sent when state changes for a reason other than a
// direct reply to a command (e.g. the periodic alarm auto-completing a
// phase), so any other open popup/dashboard instance stays in sync.
export interface StateUpdateBroadcast {
  type: "stateUpdate";
  state: TimerState;
}

export function isStateUpdateBroadcast(message: unknown): message is StateUpdateBroadcast {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "stateUpdate"
  );
}
