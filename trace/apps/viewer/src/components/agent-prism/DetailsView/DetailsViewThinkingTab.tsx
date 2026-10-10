import type { TraceSpan } from "@evilmartians/agent-prism-types";
import type { ReactElement } from "react";

import { Brain } from "lucide-react";

import type { ReadonlyProps } from "../ReadonlyProps";

import { DetailsViewThinkingLevelBadge } from "./DetailsViewThinkingLevelBadge";

type DetailsViewThinkingTabProps = {
  data: TraceSpan;
};

export const DetailsViewThinkingTab = ({
  data,
}: ReadonlyProps<DetailsViewThinkingTabProps>): ReactElement => {
  const { reasoning } = data;

  if (!reasoning) {
    return (
      <div className="border-agentprism-border rounded-md border p-4">
        <p className="text-agentprism-muted-foreground text-sm">
          这一项没有思考内容。
        </p>
        <p className="text-agentprism-muted-foreground mt-2 text-xs">
          模型调用给出推理摘要时会显示在这里。
        </p>
      </div>
    );
  }

  const triggers = reasoning.triggers ?? [];
  const hasSummary =
    reasoning.level !== undefined ||
    triggers.length > 0 ||
    reasoning.tokens !== undefined;

  return (
    <div className="space-y-4">
      {hasSummary ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {reasoning.level ? (
            <DetailsViewThinkingLevelBadge level={reasoning.level} />
          ) : null}
          {reasoning.tokens !== undefined && (
            <span className="text-agentprism-muted-foreground text-xs">
              {reasoning.tokens.toLocaleString()} thinking tokens
            </span>
          )}
          {triggers.length > 0 && (
            <span className="text-agentprism-muted-foreground text-xs">
              Triggers: {triggers.join(", ")}
            </span>
          )}
        </div>
      ) : null}

      <div className="border-agentprism-border bg-agentprism-muted/30 rounded-md border p-4">
        <div className="text-agentprism-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
          <Brain className="size-4" />
          Extended Thinking
        </div>
        {reasoning.content ? (
          <div className="text-agentprism-foreground max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
            {reasoning.content}
          </div>
        ) : (
          <p className="text-agentprism-muted-foreground text-sm">
            模型推理过，但来源只保留了加密内容，没有可读的摘要。
          </p>
        )}
      </div>
    </div>
  );
};
