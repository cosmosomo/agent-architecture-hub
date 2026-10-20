import { sessionId, type AdapterCapabilities, type Session } from '@hub-trace/contract';
import type { Bundle, FinishOptions, SourceAdapter, SourceFile } from '../types.ts';
import { TurnBuilder } from '../turns.ts';
import { maskSecrets, oneLine, partsText } from '../text.ts';
import { toolFamily } from '../gemini/parse.ts';

const KIND = 'doubao-desktop';
const VERSION = '0.1.1';
const MARKER = /^(.*[\\/]\.sessions[\\/]([^\\/]+))[\\/]agents[\\/]([^\\/]+)[\\/]system[\\/]assignment\.md$/;
const CAPABILITIES: AdapterCapabilities = {
  observe_only: true,
  control_lifecycle: { start: false, resume: false, fork: false, stop: false },
  steer_in_turn: { in_turn: false, next_turn: false, inbox_file: false },
  coordinate_team: { spawn_subagent: false, peer_message: false, task_board: false },
};

function parse(file: SourceFile, bundle: Bundle, _opts: FinishOptions): Session {
  const match = file.path?.match(MARKER);
  if (!match) throw new Error(`Invalid Doubao assignment path: ${file.path}`);
  const [, root, nativeId, agentId] = match;
  const assignment = bundle.read(file.path!);
  const agents = bundle.files.map((p) => p.match(MARKER)).filter((m) => m && m[1] === root);
  // Native m_ is the conversation agent; o_ is its organizer. Some old sessions contain only an organizer.
  const main = agents.find((m) => m![3].startsWith('m_')) || agents.find((m) => m![3].startsWith('o_'));
  if (!main) throw new Error(`Doubao session ${nativeId} has no main or organizer assignment`);
  const isMain = main[3] === agentId;
  const sourceId = isMain ? nativeId : `${nativeId}:${agentId}`;
  const trajectory = file.path!.replace(/assignment\.md$/, 'trajectory.jsonl');
  const text = bundle.files.includes(trajectory) ? bundle.read(trajectory) : '';
  const requirements = [...assignment.matchAll(/^##\s*\[([^\]]+)\]\s*需求\s*\r?\n([\s\S]*?)(?=^##\s*\[|(?![\s\S]))/gm)];
  const B = new TurnBuilder({ userStartsTurn: true, turnForInferred: false });
  let records = 0;
  let requirementIndex = 0;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let row: any;
    try { row = JSON.parse(line); } catch (error) {
      throw new Error(`Invalid Doubao JSONL ${trajectory}:${index + 1}`, { cause: error });
    }
    if (!row || typeof row !== 'object' || !['user', 'assistant', 'tool', 'system'].includes(row.role)) {
      throw new Error(`Unsupported Doubao record ${trajectory}:${index + 1}`);
    }
    records++;
    const content = partsText(row.content);
    let at: string | undefined;
    if (row.role === 'user') {
      const requirement = requirements.slice(requirementIndex).find((r) => r[2].trim() === content.trim());
      if (requirement) {
        requirementIndex = requirements.indexOf(requirement) + 1;
        const ms = Date.parse(requirement[1]);
        if (Number.isFinite(ms)) at = new Date(ms).toISOString();
      }
      B.cur = null;
      B.model = null;
      B.openTurn(undefined, at);
      B.addMessage('user', content, at, undefined, { text: maskSecrets(content) });
      B.cur!.input = maskSecrets(content);
    } else if (row.role === 'assistant') {
      const model = B.ensureModel(at);
      B.cur!.status = 'running';
      if (content) model.text = maskSecrets(content);
      if (row.reasoning_content) model.reasoning = maskSecrets(partsText(row.reasoning_content));
      for (const call of row.tool_calls || []) {
        if (!call.id || !call.function?.name) throw new Error(`Invalid Doubao tool call ${trajectory}:${index + 1}`);
        const input = typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments);
        const tool = B.addToolCall({ callId: call.id, name: call.function.name, family: toolFamily(call.function.name.toLowerCase()), input, at });
        if (input !== undefined) tool.input = maskSecrets(input);
      }
      B.closeModel(at);
      if (!row.tool_calls?.length && B.cur) B.cur.status = 'completed';
    } else if (row.role === 'tool') {
      const tool = B.addToolOutput({ callId: row.tool_call_id, name: row.name, output: content, at, isError: row.is_error === true });
      tool.output = maskSecrets(content);
    } else {
      B.addMessage('context', content, at, undefined, { text: maskSecrets(content) });
    }
    B.stamp(at);
  }
  // A local log cannot prove that the desktop process is alive; pending work stays stale, never "working".
  B.finishPending();
  const folded = B.fold();
  for (const turn of B.turns) {
    const replies = turn.steps.filter((s) => s.kind === 'model' && s.text);
    const last = replies[replies.length - 1];
    if (last?.kind === 'model') turn.output = last.text;
  }
  const startedAt = B.firstAt || (requirements[0] && new Date(requirements[0][1]).toISOString());
  const updatedAt = file.mtimeMs !== undefined ? new Date(file.mtimeMs).toISOString() : B.lastAt;
  const parentAgent = assignment.match(/^- Assigned by:\s*(\S+)/m)?.[1];
  const parentId = parentAgent && parentAgent !== main[3] ? `${nativeId}:${parentAgent}` : nativeId;
  return {
    id: sessionId(KIND, sourceId), sourceId,
    source: { kind: KIND, format: 'doubao/agent-mode-jsonl', adapter: `${KIND}@${VERSION}`, ...file },
    title: oneLine(requirements[0]?.[2] || folded.firstUser || `豆包会话 ${nativeId}`),
    agent: { product: 'Doubao', name: isMain ? `doubao-${nativeId}` : agentId, role: isMain ? 'main' : 'subagent', path: agentId, originator: KIND },
    startedAt, updatedAt,
    links: isMain ? [] : [{ rel: 'parent', id: sessionId(KIND, parentId) }],
    turns: B.turns, capabilities: CAPABILITIES,
    state: { status: !B.turns.length ? 'empty' : B.cur?.status === 'completed' ? 'idle' : 'stale', detail: '仅据本地轨迹判断；未查询豆包进程' },
    stats: { turns: B.turns.length, modelCalls: folded.modelCalls, toolCalls: folded.toolCalls, toolErrors: folded.toolErrors,
      messages: folded.messages, compactions: 0, subagents: 0, records, skipped: 0 },
    notes: ['只读本地文件；没有消息时间戳时不推测回复时间。', ...B.notes()],
  };
}

export const doubaoAdapter: SourceAdapter = {
  kind: KIND, version: VERSION, label: '豆包', capabilities: CAPABILITIES,
  homeRoots: ['AppData/Local/Doubao/User Data/Default/.doubao/agent_mode/workspace/.sessions'],
  matchFile: (path) => MARKER.test(path),
  createParser() { throw new Error('Doubao requires an assignment/trajectory bundle'); },
  bundleMembers(markerPath, allFiles) {
    const match = markerPath.match(MARKER);
    if (!match) throw new Error(`Invalid Doubao marker: ${markerPath}`);
    const trajectory = markerPath.replace(/assignment\.md$/, 'trajectory.jsonl');
    return allFiles.filter((p) => p === trajectory || p.match(MARKER)?.[1] === match[1]);
  },
  parseBundle: parse,
};
