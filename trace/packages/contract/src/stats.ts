/**
 * Derived statistics for the analytics view (hub/SPEC.md 17.8). Everything here is
 * aggregated by the local service from the search index and session summaries; no
 * new truth, only folds of what the adapters already parsed.
 */
import type { Iso } from './index.ts';

/** One calendar day of activity, `date` is YYYY-MM-DD local to the machine that indexed. */
export type DayStats = {
  date: string;
  /** Steps of kind message with role user or assistant, and model calls, and tool calls. */
  steps: number;
  messages: number;
  toolCalls: number;
  modelCalls: number;
  /** Distinct sessions with a step that day. */
  sessions: number;
};

export type ToolStat = { name: string; calls: number; errors: number };
export type ModelStat = { name: string; calls: number };

export type StatsDoc = {
  contract: string;
  generatedAt: Iso;
  days: DayStats[];
  tools: ToolStat[];
  models: ModelStat[];
  /** Total indexed steps; the denominator when a chart shows shares. */
  steps: number;
  toolErrors: number;
};
