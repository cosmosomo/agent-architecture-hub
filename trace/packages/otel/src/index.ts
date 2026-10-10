/**
 * Trace contract -> OpenTelemetry document (OTLP/JSON), following the GenAI
 * semantic conventions: one invoke_agent span for the session, one per turn,
 * chat spans for model calls, execute_tool spans for tool calls. Messages and
 * events become span events. Token usage sits on chat spans only, so summing
 * over spans never counts a token twice.
 *
 * Ids are hashes of contract ids: exporting the same session twice gives the
 * same trace.
 */
import type { Iso, ModelStep, Session, Step, ToolStep, Turn, Usage } from '@hub-trace/contract';

export type OtlpValue = {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpValue[] };
};
export type OtlpAttribute = { key: string; value: OtlpValue };
export type OtlpEvent = { timeUnixNano: string; name: string; attributes: OtlpAttribute[] };
export type OtlpSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  events: OtlpEvent[];
  status: { code: number; message?: string };
};
export type OtlpDocument = {
  resourceSpans: {
    resource: { attributes: OtlpAttribute[] };
    scopeSpans: { scope: { name: string; version: string }; spans: OtlpSpan[] }[];
  }[];
};

export const SCOPE = { name: 'hub-trace', version: '0.1.0' };

const KIND_INTERNAL = 1;
const KIND_CLIENT = 3;
const STATUS_UNSET = 0;
const STATUS_OK = 1;
const STATUS_ERROR = 2;

/** FNV-1a, 32 bit, with a seed so several runs give independent words. */
function fnv(s: string, seed: number): string {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
export const hexId = (s: string, bytes: 8 | 16): string => Array.from({ length: bytes / 4 }, (_, i) => fnv(s, i * 0x9e3779b1)).join('');

function nanos(iso: Iso | undefined, fallback: string): string {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? (BigInt(ms) * 1000000n).toString() : fallback;
}
const later = (a: string, b: string) => (BigInt(a) >= BigInt(b) ? a : b);

function attr(key: string, v: unknown): OtlpAttribute | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return { key, value: { stringValue: v } };
  if (typeof v === 'boolean') return { key, value: { boolValue: v } };
  if (typeof v === 'number') return Number.isInteger(v) ? { key, value: { intValue: String(v) } } : { key, value: { doubleValue: v } };
  if (Array.isArray(v)) return { key, value: { arrayValue: { values: v.map((x) => ({ stringValue: String(x) })) } } };
  return { key, value: { stringValue: JSON.stringify(v) } };
}
function attrs(pairs: [string, unknown][]): OtlpAttribute[] {
  return pairs.map(([k, v]) => attr(k, v)).filter((a): a is OtlpAttribute => a !== null);
}

function usageAttrs(u: Usage | undefined): [string, unknown][] {
  if (!u) return [];
  return [
    ['gen_ai.usage.input_tokens', u.input],
    ['gen_ai.usage.output_tokens', u.output],
    ['gen_ai.usage.cache_read.input_tokens', u.cachedInput || undefined],
    ['gen_ai.usage.cache_creation.input_tokens', u.cacheWrite || undefined],
    ['gen_ai.usage.reasoning.output_tokens', u.reasoning || undefined],
  ];
}

export function sessionToOtlp(session: Session): OtlpDocument {
  const traceId = hexId(session.id, 16);
  const sid = (key: string) => hexId(session.id + '/' + key, 8);
  const spans: OtlpSpan[] = [];
  const t0 = nanos(session.startedAt, '0');
  const tEnd = nanos(session.updatedAt, t0);
  const rootId = sid('session');
  const provider = session.agent.provider;

  spans.push({
    traceId,
    spanId: rootId,
    name: 'invoke_agent ' + session.agent.name,
    kind: KIND_INTERNAL,
    startTimeUnixNano: t0,
    endTimeUnixNano: later(tEnd, t0),
    attributes: attrs([
      ['gen_ai.operation.name', 'invoke_agent'],
      ['gen_ai.agent.name', session.agent.name],
      ['gen_ai.conversation.id', session.id],
      ['gen_ai.provider.name', provider],
      ['input.value', session.title],
      ['hub.session.state', session.state.status],
      ['hub.session.state_detail', session.state.detail],
      ['hub.source.kind', session.source.kind],
      ['hub.source.format', session.source.format],
      ['hub.agent.role', session.agent.role],
      ['hub.agent.path', session.agent.path],
      ['hub.cwd', session.cwd],
      ['hub.links', session.links.map((l) => l.rel + ' ' + l.id)],
    ]),
    events: [],
    status: { code: session.state.status === 'failed' ? STATUS_ERROR : session.state.status === 'idle' ? STATUS_OK : STATUS_UNSET },
  });

  for (const turn of session.turns) spans.push(...turnSpans(turn));

  function turnSpans(turn: Turn): OtlpSpan[] {
    const out: OtlpSpan[] = [];
    const id = sid('turn/' + turn.id);
    const start = nanos(turn.startedAt, t0);
    let end = nanos(turn.endedAt, start);
    const events: OtlpEvent[] = [];
    for (const step of turn.steps) {
      if (step.kind === 'message') {
        events.push({ timeUnixNano: nanos(step.at, start), name: 'gen_ai.' + (step.role === 'agent' ? 'agent' : step.role) + '.message', attributes: attrs([['content', step.text], ['hub.from', step.from], ['hub.to', step.to]]) });
      } else if (step.kind === 'event') {
        events.push({ timeUnixNano: nanos(step.at, start), name: 'hub.' + step.name, attributes: attrs([['text', step.text], ['hub.ref', step.ref]]) });
      } else {
        const span = step.kind === 'model' ? modelSpan(step, id, start) : toolSpan(step, id, start);
        end = later(end, span.endTimeUnixNano);
        out.push(span);
      }
    }
    out.unshift({
      traceId,
      spanId: id,
      parentSpanId: rootId,
      name: 'invoke_agent turn ' + turn.index,
      kind: KIND_INTERNAL,
      startTimeUnixNano: start,
      endTimeUnixNano: end,
      attributes: attrs([
        ['gen_ai.operation.name', 'invoke_agent'],
        ['gen_ai.agent.name', session.agent.name],
        ['gen_ai.conversation.id', session.id],
        ['input.value', turn.input],
        ['output.value', turn.output],
        ['hub.turn.id', turn.id],
        ['hub.turn.index', turn.index],
        ['hub.turn.status', turn.status],
        ['hub.turn.inferred', turn.inferred],
        ['hub.turn.first_token_ms', turn.firstTokenMs],
        ['hub.turn.effort', turn.settings?.effort],
        ['hub.turn.approval', turn.settings?.approval],
        ['hub.turn.sandbox', turn.settings?.sandbox],
      ]),
      events,
      status: turn.status === 'completed' ? { code: STATUS_OK } : turn.status === 'failed' ? { code: STATUS_ERROR, message: turn.error || 'failed' } : { code: STATUS_UNSET, ...(turn.error ? { message: turn.error } : {}) },
    });
    return out;
  }

  function modelSpan(m: ModelStep, parent: string, fallback: string): OtlpSpan {
    const start = nanos(m.at, fallback);
    return {
      traceId,
      spanId: sid(m.id),
      parentSpanId: parent,
      name: 'chat ' + (m.model || 'model'),
      kind: KIND_CLIENT,
      startTimeUnixNano: start,
      endTimeUnixNano: later(nanos(m.endAt, start), start),
      attributes: attrs([
        ['gen_ai.operation.name', 'chat'],
        ['gen_ai.provider.name', provider],
        ['gen_ai.request.model', m.model],
        ['gen_ai.response.id', m.responseId],
        ...usageAttrs(m.usage),
        ['output.value', m.text],
        ['hub.reasoning', m.reasoning],
        ['hub.reasoning_hidden', m.reasoningHidden],
        ['hub.phase', m.phase],
        ['hub.tool_calls', m.calls.length ? m.calls : undefined],
      ]),
      events: [],
      status: { code: STATUS_OK },
    };
  }

  function toolSpan(t: ToolStep, parent: string, fallback: string): OtlpSpan {
    const start = nanos(t.at, fallback);
    const end = t.endAt ? nanos(t.endAt, start) : t.durationMs !== undefined && start !== '0' ? (BigInt(start) + BigInt(Math.round(t.durationMs)) * 1000000n).toString() : start;
    return {
      traceId,
      spanId: sid(t.id),
      parentSpanId: parent,
      name: 'execute_tool ' + t.name,
      kind: KIND_INTERNAL,
      startTimeUnixNano: start,
      endTimeUnixNano: later(end, start),
      attributes: attrs([
        ['gen_ai.operation.name', 'execute_tool'],
        ['gen_ai.tool.name', t.name],
        ['gen_ai.tool.call.id', t.callId],
        ['gen_ai.tool.type', t.family === 'mcp' ? 'extension' : 'function'],
        ['input.value', t.input],
        ['output.value', t.output],
        ['hub.tool.family', t.family],
        ['hub.tool.status', t.status],
        ['hub.tool.exit_code', t.exitCode],
        ['hub.tool.agents', t.agents],
        ['hub.tool.todos', t.todos ? t.todos.map((x) => '[' + x.status + '] ' + x.title) : undefined],
      ]),
      events: t.effects.map((e) => ({
        timeUnixNano: start,
        name: 'hub.effect.' + e.kind,
        attributes: attrs([['label', e.label], ['status', e.status], ['exit_code', e.exitCode], ['duration_ms', e.durationMs], ['ref', e.ref]]),
      })),
      status: t.status === 'error' ? { code: STATUS_ERROR, message: t.exitCode !== undefined ? 'exit code ' + t.exitCode : 'error' } : t.status === 'ok' ? { code: STATUS_OK } : { code: STATUS_UNSET },
    };
  }

  return {
    resourceSpans: [
      {
        resource: {
          attributes: attrs([
            ['service.name', session.agent.product],
            ['service.version', session.source.version],
            ['hub.source.adapter', session.source.adapter],
          ]),
        },
        scopeSpans: [{ scope: SCOPE, spans }],
      },
    ],
  };
}

/** Steps that become spans (model and tool calls); messages and events become span events. */
export function isSpanStep(step: Step): step is ModelStep | ToolStep {
  return step.kind === 'model' || step.kind === 'tool';
}
