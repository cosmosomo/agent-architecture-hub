"""
Chinese labels for the AgentPrism components copied into src/components/agent-prism
(upstream: github.com/evilmartians/agent-prism, packages/ui/src/components, commit 4fd371b).
Each replacement must match exactly once, so a re-copy from a newer upstream shows what moved.
Usage (from trace/): python apps/viewer/scripts/localize-agent-prism.py
"""
import io
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'components', 'agent-prism')

R = {
    'DetailsView/DetailsView.tsx': [
        ('label: "In/Out"', 'label: "输入输出"'),
        ('label: "Thinking"', 'label: "思考"'),
        ('label: "Context"', 'label: "上下文"'),
        ('label: "Attributes"', 'label: "属性"'),
        ('label: "RAW"', 'label: "原始"'),
    ],
    'DetailsView/DetailsViewAttributeSection.tsx': [('{ label: "Plain", value: "plain" }', '{ label: "文本", value: "plain" }')],
    'DetailsView/DetailsViewIOSection.tsx': [
        ('{ label: "Plain", value: "plain" }', '{ label: "文本", value: "plain" }'),
        ('      title={section}\n', '      title={section === "Input" ? "输入" : "输出"}\n'),
        ('        label={section}\n', '        label={section === "Input" ? "输入" : "输出"}\n'),
    ],
    'DetailsView/DetailsViewAttributesTab.tsx': [('No attributes available for this span.', '这一项没有属性。')],
    'DetailsView/DetailsViewContentViewer.tsx': [('No data available', '没有内容')],
    'DetailsView/DetailsViewContextTab.tsx': [
        ('cache_read: "Cache read"', 'cache_read: "缓存读取"'),
        ('cache_write: "Cache write"', 'cache_write: "缓存写入"'),
        ('input: "Input tokens"', 'input: "输入 token"'),
        ('output: "Output tokens"', 'output: "输出 token"'),
        ('label: "Cumulative tokens"', 'label: "累计 token"'),
        ('label: "Context fill"', 'label: "上下文占用"'),
        ('label: "Cache hit ratio"', 'label: "缓存命中率"'),
        ('label: "Total"', 'label: "合计"'),
        ('label: "Cost"', 'label: "费用"'),
        ('No context data for this span.', '这一项没有上下文数据。'),
        ('Context tracking is available on LLM call spans with cumulative token\n          attributes.', '模型调用带有累计 token 属性时才有上下文统计。'),
    ],
    'DetailsView/DetailsViewContextWindowBar.tsx': [
        ('aria-label="Context window fill"', 'aria-label="上下文窗口占用"'),
        ('title="Compaction threshold"', 'title="压缩阈值"'),
    ],
    'DetailsView/DetailsViewHeader.tsx': [
        ('? "Copy span details"', '? "复制详情"'),
        (': "Copy disabled"', ': "不能复制"'),
        ('LATENCY: {formatDuration(durationMs)}', '耗时 {formatDuration(durationMs)}'),
    ],
    'DetailsView/DetailsViewInputOutputTab.tsx': [('No input or output data available for this span', '这一项没有输入输出')],
    'DetailsView/DetailsViewRawDataTab.tsx': [
        ('No raw data available for this span.', '这一项没有原始数据。'),
        ('`Raw ${index + 1} of ${data.raw.length}`', '`原始 ${index + 1}/${data.raw.length}`'),
        (': "Raw";', ': "原始";'),
    ],
    'DetailsView/DetailsViewRunErrorsSummary.tsx': [('title="Run errors"', 'title="这次运行里的错误"')],
    'DetailsView/DetailsViewThinkingLevelBadge.tsx': [
        ('label: "High"', 'label: "高"'),
        ('label: "Low"', 'label: "低"'),
        ('label: "Medium"', 'label: "中"'),
    ],
    'DetailsView/DetailsViewThinkingTab.tsx': [
        ('No thinking content available for this span.', '这一项没有思考内容。'),
        ('Extended thinking is available for assistant message spans when the\n          model uses extended reasoning.', '模型调用给出推理摘要时会显示在这里。'),
        ('The provider reported thinking tokens but did not return the\n            thinking text.', '模型推理过，但来源只保留了加密内容，没有可读的摘要。'),
    ],
    'DetailsView/DetailsViewTodoItemRow.tsx': [
        ('completed: "Completed"', 'completed: "已完成"'),
        ('in_progress: "In progress"', 'in_progress: "进行中"'),
        ('pending: "Pending"', 'pending: "未开始"'),
    ],
    'DetailsView/DetailsViewTodosSection.tsx': [('            Tasks\n', '            计划\n')],
    'ExpandAllButton.tsx': [('ariaLabel = "Expand all"', 'ariaLabel = "全部展开"')],
    'CollapseAllButton.tsx': [('ariaLabel = "Collapse all"', 'ariaLabel = "全部收起"')],
    'ThinkingBadge.tsx': [('label="Thinking"', 'label="思考"')],
    'CopyButton.tsx': [
        ('error: `Failed to copy ${label}`', 'error: `复制失败：${label}`'),
        ('idle: `Copy ${label}`', 'idle: `复制${label}`'),
    ],
    'ErrorCountBadge.tsx': [
        ('import { errorCountLabel } from "@evilmartians/agent-prism-data";\n\n', ''),
        ('label={errorCountLabel(count)}', 'label={`${count} 个错误`}'),
    ],
    # Layout: titles in the tree were capped at 8rem; Chinese titles need more room.
    'SpanCard/SpanCard.tsx': [('max-w-32 truncate text-sm', 'max-w-[22rem] truncate text-sm')],
    'SpanBadge.tsx': [
        ('label: "AGENT INVOCATION"', 'label: "智能体"'),
        ('label: "CHAIN"', 'label: "轮"'),
        ('label: "CREATE AGENT"', 'label: "派生"'),
        ('label: "EMBEDDING"', 'label: "向量"'),
        ('label: "EVENT"', 'label: "事件"'),
        ('label: "GUARDRAIL"', 'label: "护栏"'),
        ('label: "LLM"', 'label: "模型"'),
        ('label: "RETRIEVAL"', 'label: "检索"'),
        ('label: "SPAN"', 'label: "片段"'),
        ('label: "TOOL"', 'label: "工具"'),
        ('label: "UNKNOWN"', 'label: "未知"'),
    ],
}

failed = []
for rel, pairs in R.items():
    path = os.path.join(ROOT, rel)
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        if s.count(new) and not s.count(old):
            continue  # already applied
        if s.count(old) != 1:
            failed.append('%s: %r matched %d times' % (rel, old[:60], s.count(old)))
            continue
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
if failed:
    print('\n'.join(failed))
    sys.exit(1)
print('localized %d files' % len(R))
