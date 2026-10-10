import type { ComponentPropsWithRef, ReactElement } from "react";

import { ChevronsDownUp } from "lucide-react";

import type { ReadonlyProps } from "./ReadonlyProps";

import { IconButton } from "./IconButton";

export type SpanCardCollapseAllButtonProps = ComponentPropsWithRef<"button"> & {
  onCollapseAll: () => void;
};

export const CollapseAllButton = ({
  "aria-label": ariaLabel = "全部收起",
  onCollapseAll,
  ...rest
}: ReadonlyProps<SpanCardCollapseAllButtonProps>): ReactElement => {
  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={onCollapseAll}
      size="6"
      {...rest}
    >
      <ChevronsDownUp className="size-3.5" />
    </IconButton>
  );
};
