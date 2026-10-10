import type { ReactElement } from "react";

import { useState } from "react";

import type { ReadonlyProps } from "../ReadonlyProps";
import type { TabItem } from "../Tabs";

import { CollapsibleSection } from "../CollapsibleSection";
import { TabSelector } from "../TabSelector";
import {
  DetailsViewContentViewer,
  type DetailsViewContentViewMode,
} from "./DetailsViewContentViewer";

type DetailsViewIOSectionProps = {
  content: string;
  parsedContent: unknown;
  section: "Input" | "Output";
};

export const DetailsViewIOSection = ({
  content,
  parsedContent,
  section,
}: ReadonlyProps<DetailsViewIOSectionProps>): ReactElement => {
  const hasJson = Boolean(parsedContent);
  const [tab, setTab] = useState<DetailsViewContentViewMode>(
    hasJson ? "json" : "plain",
  );

  if (tab === "json" && !hasJson) {
    setTab("plain");
  }

  const tabItems: TabItem<DetailsViewContentViewMode>[] = [
    { disabled: !hasJson, label: "JSON", value: "json" },
    { label: "文本", value: "plain" },
  ];

  return (
    <CollapsibleSection
      defaultOpen
      rightContent={
        <TabSelector<DetailsViewContentViewMode>
          defaultValue={hasJson ? "json" : "plain"}
          items={tabItems}
          onValueChange={setTab}
          theme="pill"
          value={tab}
        />
      }
      title={section === "Input" ? "输入" : "输出"}
    >
      <DetailsViewContentViewer
        content={content}
        id={section}
        label={section === "Input" ? "输入" : "输出"}
        mode={tab}
        parsedContent={parsedContent}
      />
    </CollapsibleSection>
  );
};
