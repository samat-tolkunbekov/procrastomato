export type PhaseType = "focus" | "short-break" | "long-break";

export interface Session {
  id: string;
  type: PhaseType;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  completed: boolean; // true if it ran to completion, false if skipped/cancelled
  tag?: string; // optional project/task label
  title?: string; // what the user was working on (focus sessions)
  note?: string; // optional free-text detail
}
