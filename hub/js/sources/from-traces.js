/* HUB.fromTraces: the real trajectories a docs case keeps in traces/ -> the facts layer of its unified model
   (hub/SPEC.md 5; hub/cases_imported/PROPOSAL_lossless_adapter.md B and F). The definitions stay what the Markdown
   orchestration says; only the facts change from simulated to recorded, so every view compares the written
   orchestration with what really happened.
   - a reader per source format turns the files into episodes: one recorded run of the whole team, a list of turns
     (who spoke, to whom, what), the outcome and any failure label the source gives;
   - a speaker is matched to an individual by id or name; one the orchestration does not have is added and marked
     factOnly, never dropped; tool output is a tool call of the agent that asked for it;
   - consecutive turns of one speaker are one run; handoffs carry their recorded or protocol basis;
     adjacency alone never makes a handoff, whether or not the written orchestration has that task line
     (user decision 10-12): the order of speaking is kept as facts.turns, one record per recorded turn;
   - nobody is put in front of the first speaker: a handoff from the person exists only when the source
     has the person's own turn (user decision 10-12);
   - the sources carry no clock, so time is the turn order (one minute a turn) and the model says so (ordinal);
   - the recorded turns are also kept as trace-contract sessions, so 5/6 open the real text (HUB.model.traceOf).
   Pure: no DOM. hub/tools/check_real_facts.js runs every case with traces through it. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var STEP = 60 * 1000;          // one turn = one minute of ordinal time
  var GAP = 5 * STEP;            // between two episodes
  var MAX_FILES = 80;            // sample across the whole list, preserving its order

  function cut(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  function norm(s) { return String(s || '').replace(/[（(][^）)]*[）)]/g, '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ''); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'x'; }
  function iso(t) { return new Date(Date.UTC(2026, 0, 1) + t).toISOString(); }
  function text(v) { return typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v); }

  /* ---------- readers: files -> episodes ----------
     episode = { name, outcome: 'success'|'failure'|'unfinished', note, mistake: { speaker, index } | null,
                 turns: [{ speaker, to, kind: 'say'|'think'|'tool'|'context', text, tool }] }
     speaker is a raw name; resolve() maps it to an individual. */

  // Who&When (ag2ai/Agents_Failure_Attribution): history = [{ role, name?, content }].
  // Algorithm-Generated runs name the expert; hand-crafted Magentic-One runs put it in role: 'Orchestrator (-> WebSurfer)'.
  var whowhen = {
    id: 'whowhen', label: 'Who&When 失败归因数据集', product: 'Who&When',
    match: function (caseId) { return caseId.indexOf('imp_whowhen_') === 0; },
    episodes: function (files, parts) {
      var h = files[0] && Array.isArray(files[0].data) ? files[0].data : [];
      var k1 = (parts.scenarios.cases || [])[0] || {};
      var mm = String(k1.name || '').match(/(\S+)\s*第\s*(\d+)\s*步/);
      var note = ((k1.inject || [])[0] || {}).text || '';
      var turns = [];
      h.forEach(function (x, i) {
        var role = String(x.role || ''), name = x.name;
        var to = null, kind = 'say', speaker = name || role;
        var r = role.match(/^(.+?)\s*\((.+)\)\s*$/);
        if (!name && r) {
          speaker = r[1];
          var arrow = r[2].match(/^->\s*(.+)$/);
          if (arrow) to = arrow[1]; else kind = 'think';
        }
        if (/terminal/i.test(speaker) && !/^(orchestrator)$/i.test(speaker)) kind = 'tool-or-agent';
        turns.push({ speaker: speaker, to: to, kind: kind, text: text(x.content), tool: speaker, sourceIndex: i });
      });
      return [{ name: '实测运行（Who&When 标注为失败）', outcome: 'failure', note: note, turns: turns,
        switchBasis: turns.some(function (z) { return z.to; }) ? 'protocol' : 'adjacent',
        mistake: mm ? { speaker: mm[1].replace(/^.*[：:]/, ''), index: parseInt(mm[2], 10) } : null }];
    },
    alias: { assistant: 'coder' }
  };

  // tau-bench: one dialog per file, traj = [{ role: system|user|assistant|tool, content }], reward 1 = success.
  var taubench = {
    id: 'taubench', label: 'τ-bench 对话轨迹', product: 'τ-bench', switchBasis: 'protocol',
    match: function (caseId) { return caseId.indexOf('imp_taubench_') === 0; },
    episodes: function (files) {
      return files.filter(function (f) { return f.data && Array.isArray(f.data.traj); }).map(function (f) {
        var d = f.data, turns = [];
        d.traj.forEach(function (x, i) {
          var c = text(x.content);
          if (x.role === 'system') turns.push({ speaker: 'service_agent', kind: 'context', text: c });
          else if (x.role === 'user') turns.push({ speaker: 'user_simulator', kind: 'say', text: c });
          else if (x.role === 'tool') turns.push({ speaker: 'service_agent', kind: 'tool', text: c, tool: '业务 API' });
          else if (x.role === 'assistant') turns.push({ speaker: 'service_agent', kind: 'say', text: c,
            calls: Array.isArray(x.tool_calls) ? x.tool_calls.map(function (tc) { var fn = tc && tc.function || {}; return { name: String(fn.name || tc.name || '工具'), args: text(fn.arguments) }; }) : null });
          else throw new Error(f.name + '：未知 role ' + x.role);
          turns[turns.length - 1].sourceIndex = i;
        });
        return { name: '任务 ' + d.task_id + (d.trial != null ? ' · 第 ' + (d.trial + 1) + ' 次' : ''), outcome: d.reward === 1 ? 'success' : 'failure',
          note: 'reward=' + d.reward, turns: turns, mistake: null };
      });
    }
  };

  // CAMEL role-playing: { original_task, specified_task, message_1..n: { role_type: USER|ASSISTANT, content }, termination_reason }.
  var camel = {
    id: 'camel', label: 'CAMEL 角色扮演对话', product: 'CAMEL', switchBasis: 'protocol',
    match: function (caseId) { return caseId.indexOf('imp_camel_') === 0; },
    episodes: function (files) {
      return files.filter(function (f) { return f.data && f.data.message_1; }).map(function (f) {
        var d = f.data, turns = [];
        if (d.specified_task) turns.push({ speaker: 'task_specifier', kind: 'say', text: text(d.specified_task), sourceIndex: 0 });
        for (var i = 1; d['message_' + i]; i++) {
          var mm = d['message_' + i];
          var flat = typeof mm !== 'object' || mm === null;   // 学科集（biology/chemistry/...）是平铺格式：message_N 为纯文本，奇数条=用户提问、偶数条=助手作答
          var sp = flat ? (i % 2 === 1 ? 'ai_user' : 'ai_assistant') : (mm.role_type === 'USER' ? 'ai_user' : 'ai_assistant');
          turns.push({ speaker: sp, kind: 'say', text: text(flat ? mm : mm.content), sourceIndex: turns.length });
        }
        var done = /done/i.test(d.termination_reason || '');
        var nm = cut((d.role_1 || '') + (d.role_2 ? ' × ' + d.role_2 : ''), 40).replace(/_RoleType\.\w+/g, '').trim();
        return { name: nm, outcome: done ? 'success' : 'unfinished',
          note: '结束原因：' + (d.termination_reason || '未知'), turns: turns, mistake: null };
      });
    }
  };

  var READERS = [whowhen, taubench, camel];

  /* ---------- speakers -> individuals ---------- */
  function resolver(def, reader) {
    var byKey = new Map();
    def.individuals.forEach(function (x) {
      [x.id, x.name].forEach(function (k) { var n = norm(k); if (n && !byKey.has(n)) byKey.set(n, x); });
    });
    var extra = new Map();
    return function (raw) {
      var n = norm(raw);
      if (!n) return null;
      if (byKey.has(n)) return byKey.get(n);
      if (reader.alias && reader.alias[n]) n = reader.alias[n];
      if (n === 'human' || n === 'user' && byKey.has('human') && !byKey.has('user')) return byKey.get('human') || null;
      if (byKey.has(n)) return byKey.get(n);
      // 'ComputerTerminal' -> 'terminal': the declared id at the end of a longer recorded name
      var hit = null;
      byKey.forEach(function (x, k) { if (!hit && k.length >= 4 && n.length > k.length && n.slice(-k.length) === k) hit = x; });
      if (hit) return hit;
      if (extra.has(n)) return extra.get(n);
      return null;
    };
  }

  /* ---------- episodes -> facts ---------- */
  function build(model, reader, episodes, info) {
    var def = model.def;
    var resolve = resolver(def, reader);
    var indMap = new Map(def.individuals.map(function (x) { return [x.id, x]; }));
    var added = [];
    var who = function (raw) {
      var x = resolve(raw);
      if (x) return x;
      var id = 'x_' + slug(raw);
      if (indMap.has(id)) return indMap.get(id);
      x = { id: id, agentId: 'feature', kind: 'agent', name: cut(raw, 24), model: null, phase: 'build', role: '编排里没有这个角色，真实轨迹里出现了',
        trigger: '', groupId: null, isHub: false, watches: [], tags: [], attributes: {}, natives: [], channels: [], docs: [], tools: [],
        x: 0, y: 0, host: null, enhanced: false, factOnly: true };
      def.individuals.push(x); indMap.set(id, x); added.push(x);
      return x;
    };

    var chMap = new Map(def.channels.map(function (c) { return [c.id, c]; }));
    var use = function (x, c) { if (c.users.indexOf(x.id) < 0) c.users.push(x.id); if (x.channels.indexOf(c.id) < 0) x.channels.push(c.id); };
    var modelCh = function (x) {
      var id = x.channels.find(function (c) { return (chMap.get(c) || {}).kind === 'model'; });
      if (id) return chMap.get(id);
      var c = chMap.get('ch_model_unknown');
      if (!c) { c = { id: 'ch_model_unknown', kind: 'model', name: '模型：轨迹未注明', maintainer: null, capacity: '-', quota: '-', limit: null, users: [], tier: 'shared' }; def.channels.push(c); chMap.set(c.id, c); }
      use(x, c);
      return c;
    };
    var toolCh = function (x, name) {
      var id = 'ch_tool_' + slug(name);
      var c = chMap.get(id);
      if (!c) { c = { id: id, kind: 'tool', name: '工具：' + name, maintainer: null, capacity: '不限', quota: '-', limit: null, users: [], tier: 'basic' }; def.channels.push(c); chMap.set(id, c); }
      use(x, c);
      return c;
    };

    // which declared step a speaker works in, and the gate between two stages, to lay the case path on the process
    var stepOf = {}, stageOf = {};
    def.process.stages.forEach(function (st) {
      st.steps.forEach(function (sp) { (sp.executors || []).forEach(function (e) { if (!stepOf[e]) { stepOf[e] = sp.id; stageOf[e] = st.id; } }); });
    });
    var gateBetween = function (a, b) {
      var g = def.process.gates.find(function (g) {
        if (g.afterStage !== a) return false;
        if (g.pass === b || g.fail === b) return true;
        return (g.paths || []).some(function (p) { return p.next === b; });
      });
      return g ? g.id : null;
    };
    var taskRel = {};
    def.relations.forEach(function (r) { if (r.type === 'task' && !taskRel[r.from + '>' + r.to]) taskRel[r.from + '>' + r.to] = r; });

    var F = { synthetic: false, ordinal: true, span: { start: 0, end: 0 }, cases: [], tasks: [], runs: [], decisions: [], calls: [], handoffs: [], deliveries: [],
      turns: [],   // 记录：每条发言一项，案例内按 seq 排列；协作轨迹图画的就是它（hub/SPEC.md 5）
      gateEvents: [], channelEvents: [], versionEvents: [], actions: [], messages: [] };
    var sessions = new Map(), runRef = {};
    var t0 = 0, n = 0;

    episodes.forEach(function (ep, ei) {
      var k = { id: 'K' + (ei + 1), name: ep.name, start: t0, end: t0, status: 'done', path: [{ node: 'start', at: t0 }], waitingAt: null, rootTask: null,
        result: ep.outcome, note: ep.note || '' };
      F.cases.push(k);

      // turns -> segments of one speaker; a tool turn belongs to whoever asked for it
      var segs = [], cur = null;
      ep.turns.forEach(function (tn, ti) {
        var x;
        if (tn.kind === 'tool') x = cur ? cur.x : who(tn.speaker);
        else if (tn.kind === 'tool-or-agent') {
          x = resolve(tn.speaker);
          if (!x && cur) { tn.kind = 'tool'; x = cur.x; } else { tn.kind = 'say'; if (!x) x = who(tn.speaker); }
        } else x = who(tn.speaker);
        if (!cur || cur.x !== x) { cur = { x: x, turns: [] }; segs.push(cur); }
        tn.seq = ti + 1;
        tn.index = tn.sourceIndex;
        tn.individualId = x.id;
        cur.turns.push(tn);
      });
      var bad = ep.mistake ? who(ep.mistake.speaker) : null;
      if (bad) {
        var labeled = ep.turns.find(function (z) { return z.sourceIndex === ep.mistake.index; });
        k.mistake = { individualId: bad.id, turnIndex: ep.mistake.index, reason: ep.note || '', basis: 'human-label', source: 'Who&When',
          actualSpeaker: labeled ? labeled.speaker : null, consistent: !!(labeled && resolve(labeled.speaker) === bad) };
      }

      var t = t0, prev = null, lastStage = null;
      segs.forEach(function (sg, si) {
        var x = sg.x, start = t, end = t + sg.turns.length * STEP;
        sg.start = start;
        // the person is not a run: what they say is the input of whoever speaks next
        if (x.kind === 'human') { prev = { x: x, task: null, turns: sg.turns }; t = end; return; }
        n += 1;
        var task = { id: 't' + n, caseId: k.id, parentId: null, name: cut((sg.turns.find(function (z) { return z.kind !== 'context'; }) || sg.turns[0]).text, 40),
          stepId: stepOf[x.id] || null, assignee: x.id, status: 'done', created: start, started: start, done: end, visit: 1 };
        var mc = modelCh(x);
        var marked = !!(k.mistake && k.mistake.consistent && bad === x && sg.turns.some(function (z) { return z.index === ep.mistake.index; }));
        var run = { id: 'u' + n, taskId: task.id, caseId: k.id, individualId: x.id, start: start, end: end, outcome: 'deliver',
          version: 'v1', model: (x.attributes && x.attributes.source_model) || x.model || null, tokens: null, channelId: mc.id, queued: 0,
          coverage: { indexed: sg.turns.length, metaOnly: 0, truncated: 0 } };
        if (marked) run.mark = 'mistake';
        if (!k.rootTask) k.rootTask = task.id;
        F.tasks.push(task); F.runs.push(run);
        sg.run = run;

        // session + turn in the trace contract, so 5/6 show the recorded text
        var sid = 'trace:' + model.id + '/' + k.id + '/' + x.id;
        var ses = sessions.get(sid);
        if (!ses) {
          ses = { id: sid, sourceId: model.id + '/' + k.id + '/' + x.id,
            source: { kind: 'trace-file', format: reader.id, adapter: 'hub-traces@1', path: info.files.join(', ') },
            title: ep.name + ' · ' + x.name, agent: { product: reader.product, name: x.name, role: 'main', model: run.model || undefined },
            startedAt: iso(start), updatedAt: iso(end), links: [], turns: [], state: { status: 'idle' },
            stats: { turns: 0, modelCalls: 0, toolCalls: 0, toolErrors: 0, messages: 0, compactions: 0, subagents: 0, records: 0, skipped: 0 },
            notes: ['真实轨迹：' + reader.label + '；来源没有时间戳，时间按发言顺序排列（一条一分钟），不是真实时刻'] };
          sessions.set(sid, ses);
        }
        var steps = [], dec = { id: 'd' + n, runId: run.id, idx: 0, start: start, end: end, action: 'deliver', title: task.name,
          trigger: prev ? '前一位发言者：' + prev.x.name : '任务开始', alternatives: [], choice: '', reason: '', impact: '', outcome: 'pending',
          stageTags: [], evidence: [], unsupported: ['alternatives', 'reason'], basis: 'trace' };
        if (prev) steps.push({ id: run.id + '.in', kind: 'message', role: 'agent', from: prev.x.name, to: x.name, at: iso(start), text: prev.turns[prev.turns.length - 1].text,
          sourceIndex: prev.turns[prev.turns.length - 1].sourceIndex });
        sg.turns.forEach(function (z, zi) {
          var a = start + zi * STEP, b = a + STEP - 1000;
          var bad1 = marked && z.index === ep.mistake.index;
          if (z.kind === 'context') {
            steps.push({ id: run.id + '.' + zi, kind: 'message', role: 'context', at: iso(a), text: z.text, sourceIndex: z.sourceIndex });
            return;
          }
          var isTool = z.kind === 'tool';
          var ch = isTool ? toolCh(x, z.tool || '工具') : mc;
          var call = { id: run.id + '.c' + zi, runId: run.id, decisionId: dec.id, parentId: null, kind: isTool ? 'tool' : 'model', tool: isTool ? slug(z.tool) : null,
            name: isTool ? (z.tool || '工具') : (run.model || '模型'), channelId: ch.id, start: a, end: b, tokensIn: null, tokensOut: null,
            status: 'ok', repeat: false, input: '', output: cut(z.text, 400), context: null, turnIndex: z.index };
          F.calls.push(call); dec.evidence.push(call.id);
          if (isTool) {
            steps.push({ id: run.id + '.' + zi, kind: 'tool', name: z.tool || '工具', family: /terminal|shell/i.test(z.tool || '') ? 'shell' : 'other', status: 'ok',
              output: z.text, effects: [], at: iso(a), endAt: iso(b), sourceIndex: z.sourceIndex });
            dec.action = 'tool';
          } else {
            steps.push({ id: run.id + '.' + zi, kind: 'model', model: run.model || undefined, text: z.text, phase: z.kind === 'think' ? 'commentary' : 'final', calls: [], at: iso(a), endAt: iso(b), sourceIndex: z.sourceIndex });
            dec.action = 'deliver';
          }
          if (bad1) steps.push({ id: run.id + '.ann' + zi, kind: 'event', name: 'annotation', at: iso(b), sourceIndex: z.sourceIndex,
            text: '数据集标注的失误步（原始下标 ' + z.index + '，即第 ' + (z.index + 1) + ' 条）：' + ep.note });
        });
        var last = sg.turns[sg.turns.length - 1];
        var next = segs[si + 1];
        dec.choice = cut(last.text, 160);
        dec.impact = next ? '交给' + next.x.name : (ep.outcome === 'success' ? '结束：成功' : ep.outcome === 'failure' ? '结束：失败' : '结束：未完成');
        if (marked) dec.reason = '数据集标注：' + cut(ep.note, 200);
        F.decisions.push(dec);
        var turn = { id: run.id, index: ses.turns.length + 1, inferred: true, status: 'completed', startedAt: iso(start), endedAt: iso(end),
          durationMs: null, input: prev ? cut(prev.turns[prev.turns.length - 1].text, 200) : undefined, output: cut(last.text, 200), steps: steps };
        ses.turns.push(turn);
        ses.updatedAt = iso(end);
        ses.stats.turns += 1;
        steps.forEach(function (s) {
          ses.stats.records += 1;
          if (s.kind === 'model') ses.stats.modelCalls += 1;
          else if (s.kind === 'tool') { ses.stats.toolCalls += 1; if (s.status === 'error') ses.stats.toolErrors += 1; }
          else if (s.kind === 'message') ses.stats.messages += 1;
        });
        runRef[run.id] = { session: sid, turn: turn.id };

        // the case path over the declared process: the stage this speaker works in, with the gate passed on the way
        var stg = stageOf[x.id];
        if (stg && stg !== lastStage) {
          var g = lastStage ? gateBetween(lastStage, stg) : null;
          if (g) k.path.push({ node: g, at: start });
          k.path.push({ node: stg, at: start });
          lastStage = stg;
        }
        prev = { x: x, task: task, turns: sg.turns };
        sg.task = task;
        t = end;
      });
      k.end = t;
      k.path.push({ node: 'done', at: t });
      // 明写对象独立于下一位发言者。只凭相邻发言的换人一律不生成交接，补写的编排里有没有这条任务线都一样
      // （用户 10-12 决定；总览 9.4）：先后顺序由 F.turns 表达。sentSeq / gotSeq 是发出和接住的那条记录在案例内的序号。
      var handoff = function (from, to, fromTask, toTask, at, basis, sentSeq, gotSeq) {
        var r = taskRel[from + '>' + to] || null;
        if (from === to || basis === 'adjacent') return;
        F.handoffs.push({ id: 'h' + (F.handoffs.length + 1), caseId: k.id, from: from, to: to, fromTask: fromTask, toTask: toTask, at: at,
          basis: basis, relationId: r ? r.id : null, carried: [], missing: [], sentSeq: sentSeq == null ? null : sentSeq, gotSeq: gotSeq == null ? null : gotSeq });
      };
      segs.forEach(function (sg, si) {
        var prevSeg = segs[si - 1], nextSeg = segs[si + 1];
        // 第一段之前没有发言者时不补“人”：来源里有人的发言，才有从人出发的交接（用户 10-12 决定）
        if (sg.task && prevSeg && !prevSeg.turns.some(function (z) { return z.to; })) {
          handoff(prevSeg.x.id, sg.x.id, prevSeg.task ? prevSeg.task.id : null, sg.task.id, sg.start,
            prevSeg.x.kind === 'human' ? 'protocol' : ep.switchBasis || reader.switchBasis,
            prevSeg.turns[prevSeg.turns.length - 1].seq, sg.turns[0].seq);
        }
        sg.turns.forEach(function (z, zi) {
          if (!z.to) return;
          var target = who(z.to);
          var got = ep.turns.find(function (y) { return y.seq > z.seq && y.individualId === target.id; });
          handoff(sg.x.id, target.id, sg.task ? sg.task.id : null, nextSeg && nextSeg.x === target && nextSeg.task ? nextSeg.task.id : null,
            sg.start + (zi + 1) * STEP, 'explicit', z.seq, got ? got.seq : null);
        });
      });
      // 记录：这一个案例实例的全部发言，按来源顺序。人说的话不是运行（runId 为空），但在序列里
      var runOfTurn = new Map();
      segs.forEach(function (sg) { sg.turns.forEach(function (z) { runOfTurn.set(z, sg.run || null); }); });
      ep.turns.forEach(function (z) {
        var to = z.to ? who(z.to) : null, ru = runOfTurn.get(z);
        F.turns.push({ id: k.id + '.r' + z.seq, caseId: k.id, seq: z.seq, individualId: z.individualId, kind: z.kind, to: to ? to.id : null,
          text: z.text, tool: z.kind === 'tool' ? (z.tool || '工具') : null, calls: z.calls || null, sourceIndex: z.sourceIndex,
          runId: ru ? ru.id : null, at: k.start + (z.seq - 1) * STEP });
      });
      t0 = t + GAP;
    });
    F.span.end = Math.max(0, t0 - GAP);

    // the orchestration's own decision records stay, marked as written, on the first real run of their author
    (info.mdDecisions || []).forEach(function (d, i) {
      var r = F.runs.find(function (u) { return u.individualId === d.agentId; }) || F.runs[0];
      if (!r) return;
      F.decisions.push({ id: 'dm' + (i + 1), runId: r.id, idx: 1 + i, start: r.start, end: r.start, action: d.action || 'deliver', title: '〔编排文档〕' + (d.title || ''),
        trigger: d.trigger || '', alternatives: (d.alternatives || []).slice(), choice: d.choice || '', reason: d.reason || '', impact: d.impact || '',
        outcome: 'pending', stageTags: [], evidence: [], unsupported: [], basis: 'md' });
    });

    model.facts = F;
    model.synthetic = false;
    model.clock = 'ordinal';
    model.source = Object.assign({}, model.source, { facts: 'trace', reader: reader.id, sessions: sessions, runs: runRef });
    model.factSource = { kind: 'trace', reader: reader.id, label: reader.label, files: info.files, total: info.total, episodes: episodes.length,
      ordinal: true, added: added.map(function (x) { return x.id; }) };
    return model;
  }

  /* ---------- loading: traces/index.json -> files -> reader ---------- */
  function parse(t) {
    var s = String(t || '').trim();
    if (!s) throw new Error('轨迹文件为空');
    try { return JSON.parse(s); } catch (e) { /* JSONL below */ }
    try { return s.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return JSON.parse(l); }); }
    catch (e) { throw new Error('JSON / JSONL 解析失败：' + e.message); }
  }

  /** get(path) -> Promise<string> relative to the case directory; parts are from-docs' parsed files.
      Resolves with the model, its facts replaced when a reader knows these traces; otherwise untouched. */
  function attach(model, get, parts) {
    var reader = READERS.find(function (r) { return r.match(model.id); });
    if (!reader) return Promise.resolve(model);
    return get('traces/index.json').then(function (t) {
      var idx = parse(t);
      var names = Array.isArray(idx) ? idx : (idx && idx.files) || [];
      var total = names.length;
      if (!Array.isArray(names) || !names.length) throw new Error('轨迹索引没有文件');
      if (total > MAX_FILES) names = Array.from({ length: MAX_FILES }, function (_, i) { return names[Math.round(i * (total - 1) / (MAX_FILES - 1))]; });
      return Promise.all(names.map(function (nm) { return get('traces/' + nm).then(function (s) {
        try { return { name: nm, data: parse(s) }; } catch (e) { throw new Error(nm + '：' + e.message); }
      }); })).then(function (files) {
        var eps = reader.episodes(files, parts);
        if (eps.length !== files.length || eps.some(function (e) { return !e.turns.length; })) throw new Error('轨迹格式不匹配或没有发言');
        return build(model, reader, eps, { files: names, total: total, mdDecisions: parts.decisions });
      });
    }).catch(function (e) {
      model.factSource = { kind: 'error', error: String(e && e.message || e) };
      return model;
    });
  }

  HUB.fromTraces = { attach: attach, build: build, readers: READERS };
  if (HUB.facts) HUB.facts.register({ id: 'recorded-traces',
    applies: function (model, ctx) { return !!ctx.get && READERS.some(function (r) { return r.match(model.id); }); },
    provide: function (model, ctx) { return attach(model, ctx.get, ctx.parts); } });
})();
