import type {
  TraceSpan,
  TraceSpanCategory,
} from "@evilmartians/agent-prism-types";
import type { ReactElement } from "react";

import { getTimelineData } from "@evilmartians/agent-prism-data";
import cn from "classnames";

import type { ReadonlyProps } from "../ReadonlyProps";

type SpanCardTimelineProps = {
  className?: string | undefined;
  maxEnd: number;
  minStart: number;
  spanCard: TraceSpan;
};

const timelineBgColors: Record<TraceSpanCategory, string> = {
  agent_invocation: "bg-agentprism-timeline-agent",
  chain_operation: "bg-agentprism-timeline-chain",
  create_agent: "bg-agentprism-timeline-create-agent",
  embedding: "bg-agentprism-timeline-embedding",
  event: "bg-agentprism-timeline-event",
  guardrail: "bg-agentprism-timeline-guardrail",
  llm_call: "bg-agentprism-timeline-llm",
  retrieval: "bg-agentprism-timeline-retrieval",
  span: "bg-agentprism-timeline-span",
  tool_execution: "bg-agentprism-timeline-tool",
  unknown: "bg-agentprism-timeline-unknown",
};

export const SpanCardTimeline = ({
  className,
  maxEnd,
  minStart,
  spanCard,
}: ReadonlyProps<SpanCardTimelineProps>): ReactElement => {
  const { startPercent, widthPercent } = getTimelineData({
    maxEnd,
    minStart,
    spanCard,
  });

  return (
    <span
      className={cn(
        "bg-agentprism-secondary/80 border-agentprism-border/60 relative flex h-2 w-24 sm:w-28 shrink-0 overflow-hidden rounded-full border",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0.5 top-1/2 h-1 -translate-y-1/2">
        <span
          className={`absolute h-full rounded-full ${timelineBgColors[spanCard.type]}`}
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(widthPercent, 4)}%`,
          }}
        />
      </span>
    </span>
  );
};
