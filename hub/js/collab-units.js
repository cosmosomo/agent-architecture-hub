/* ===== 基本协作单元 & DRAW.IO 级结构化流程图引擎 — PART 1: 节点类型学与 CSS 视觉体系 ===== */
(function(){
  if (typeof AD === 'undefined' || typeof PR === 'undefined' || typeof PM === 'undefined') return;

  // 注入 6 类节点视觉区分 + 结构泳道框 + Draw.io 级连线标签与编辑器样式
  var styleEl = document.getElementById('collabUnitsVisualStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'collabUnitsVisualStyle';
    styleEl.textContent = [
      /* 结构分区泳道框 (Subgraph / Swimlane Zones) — 标题作为悬浮 Legend 贴合上边框，绝不遮挡内部节点 */
      '.cv-zone-layer{position:absolute;inset:0;pointer-events:none;z-index:1}',
      '.cv-zone{position:absolute;border-radius:16px;border:1.8px dashed color-mix(in srgb,var(--zc,#38bdf8) 48%,rgba(148,163,184,0.32));background:linear-gradient(180deg,color-mix(in srgb,var(--zc,#38bdf8) 7%,rgba(15,23,42,0.52)),rgba(10,14,26,0.24));box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);transition:all .2s}',
      '.cv-zone-hdr{position:absolute;top:-13px;left:14px;display:inline-flex;align-items:center;gap:6px;padding:3px 11px;border-radius:999px;background:#0b1020;border:1.5px solid color-mix(in srgb,var(--zc,#38bdf8) 65%,rgba(148,163,184,0.4));box-shadow:0 4px 12px rgba(0,0,0,0.45);z-index:2}',
      '.cv-zone-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;box-shadow:0 0 8px var(--zc,#38bdf8)}',
      '.cv-zone-title{font-family:var(--hd,sans-serif);font-size:10.5px;font-weight:800;color:#f8fafc;white-space:nowrap;letter-spacing:.02em}',
      '.cv-zone-sub{position:absolute;bottom:-10px;right:14px;padding:1.5px 9px;border-radius:999px;background:#0b1020;border:1px solid rgba(148,163,184,0.28);font-size:9px;color:#cbd5e1;font-family:var(--mn,monospace);white-space:nowrap;z-index:2}',

      /* 四向锚点 (Top / Right / Bottom / Left Ports) */
      '.nd .nd-anc.left{left:-5px;top:50%;transform:translateY(-50%)}',
      '.nd .nd-anc.right{right:-5px;top:50%;transform:translateY(-50%)}',

      /* 类型徽章与代码签名通用 */
      '.nd-kind-tag{font-family:var(--mn,monospace);font-size:8px;font-weight:800;letter-spacing:.04em;padding:1.5px 6px;border-radius:4px;border:1px solid rgba(148,163,184,0.35);background:rgba(9,13,26,0.85);display:inline-flex;align-items:center;gap:3px;white-space:nowrap;line-height:1.2}',
      '.nd-code-pill,.nd-code-sig{font-family:var(--mn,monospace);font-size:8.5px;padding:2px 7px;border-radius:5px;background:rgba(4,7,16,0.9);border:1px solid rgba(148,163,184,0.26);color:#93c5fd;margin-top:3px;max-width:136px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;line-height:1.3}',

      /* 1. 智能体节点 (kind-agent): 竖向饱满圆角主卡 + 双环发光头像 + 模型徽章 */
      '.nd.kind-agent .nd-body{width:120px!important;min-width:120px!important;max-width:120px!important;height:122px!important;min-height:122px!important;padding:8px 8px 7px!important;border-width:2px!important;border-style:solid!important;border-color:color-mix(in srgb,var(--ic,#6366f1) 68%,rgba(255,255,255,0.2))!important;border-radius:18px!important;background:radial-gradient(circle at 50% 24%,color-mix(in srgb,var(--ic,#6366f1) 22%,transparent),rgba(13,17,30,0.95) 72%)!important;box-shadow:0 10px 26px rgba(0,0,0,0.55),inset 0 0 16px color-mix(in srgb,var(--ic,#6366f1) 18%,transparent)!important;justify-content:space-between!important}',
      '.nd.kind-agent .nd-orb{width:38px!important;height:38px!important;border-radius:50%!important;border:2px solid var(--ic,#6366f1)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--ic,#6366f1) 25%,transparent),0 0 14px var(--ic,#6366f1)!important}',

      /* 2A. 接口端口 (kind-port): 横向胶囊/跑道插座 (Stadium Pill Socket)，绝无模型徽章 */
      '.nd.kind-port .nd-body{width:148px!important;min-width:148px!important;max-width:148px!important;height:74px!important;min-height:74px!important;border-radius:999px!important;border:2px solid var(--ic,#10b981)!important;background:linear-gradient(90deg,color-mix(in srgb,var(--ic,#10b981) 22%,rgba(12,18,32,0.96)),rgba(15,23,42,0.96) 65%)!important;padding:6px 14px!important;justify-content:center!important;align-items:center!important;gap:2px!important;box-shadow:0 6px 18px rgba(0,0,0,0.45),inset 0 0 12px color-mix(in srgb,var(--ic,#10b981) 16%,transparent)!important}',
      '.nd.kind-port .nd-body::before{border-radius:999px!important}',
      '.nd-port-hdr{display:flex;align-items:center;justify-content:center;width:100%;gap:5px;margin-bottom:1px}',
      '.nd-port-dir{font-family:var(--mn,monospace);font-size:7.5px;color:#cbd5e1;font-weight:800;letter-spacing:.04em}',
      '.nd-port-main{display:flex;align-items:center;gap:6px;justify-content:center;width:100%}',
      '.nd.kind-port .nd-orb{width:22px!important;height:22px!important;border-radius:50%!important;margin:0!important;flex-shrink:0}',
      '.nd.kind-port .nd-lbl{font-size:11px!important;font-weight:800!important;white-space:nowrap!important}',

      /* 2B. 工具调用槽 (kind-tool): 工业切角六边形虚线插槽 (Chamfered Tool Cartridge) */
      '.nd.kind-tool .nd-body{width:150px!important;min-width:150px!important;max-width:150px!important;height:80px!important;min-height:80px!important;border-radius:4px!important;clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px);border:2px dashed #f59e0b!important;background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(15,23,42,0.96) 65%)!important;padding:6px 10px!important;justify-content:center!important;align-items:center!important;gap:2px!important;box-shadow:0 6px 20px rgba(245,158,11,0.18)!important}',
      '.nd.kind-tool .nd-body::before{display:none!important}',
      '.nd.kind-tool .nd-orb{width:22px!important;height:22px!important;border-radius:6px!important;margin:0!important;flex-shrink:0;border-color:#f59e0b!important}',
      '.nd.kind-tool .nd-lbl{font-size:11px!important;font-weight:800!important;white-space:nowrap!important}',
      '.nd.kind-tool .nd-code-sig{color:#fde68a!important;border-color:rgba(245,158,11,0.45)!important;background:rgba(24,16,6,0.9)!important}',

      /* 3. 步间 3 个决定 (kind-decision): 纯正 45° SVG 菱形判断门 (True Rhombus Gateway) */
      '.nd.kind-decision{width:136px!important;height:136px!important}',
      '.nd.kind-decision .nd-body{width:136px!important;min-width:136px!important;max-width:136px!important;height:136px!important;min-height:136px!important;background:transparent!important;border:none!important;box-shadow:none!important;padding:18px 8px!important;justify-content:center!important;align-items:center!important;gap:2px!important}',
      '.nd.kind-decision .nd-body::before{display:none!important}',
      '.nd-diamond-svg{position:absolute;inset:0;width:136px;height:136px;pointer-events:none;z-index:0;filter:drop-shadow(0 6px 18px rgba(244,63,94,0.35))}',
      '.nd.kind-decision .nd-body > *{position:relative;z-index:1}',
      '.nd.kind-decision .nd-orb{width:24px!important;height:24px!important;border-radius:6px!important;transform:rotate(45deg);margin:1px 0!important;border-color:#f43f5e!important;background:rgba(244,63,94,0.2)!important}',
      '.nd.kind-decision .nd-orb svg{transform:rotate(-45deg)}',
      '.nd.kind-decision .nd-lbl{font-size:10.5px!important;font-weight:800!important;white-space:nowrap!important;margin-top:1px!important}',
      '.nd-dec-chips,.nd-dec-questions{display:flex;gap:2px;margin-top:2px;flex-wrap:nowrap;justify-content:center}',
      '.nd-dec-chip,.nd-dec-questions span{font-family:var(--mn,monospace);font-size:7.5px;font-weight:800;padding:1px 4px;border-radius:3px;background:rgba(244,63,94,0.24);color:#fecdd3;border:1px solid rgba(244,63,94,0.5);white-space:nowrap}',

      /* 4. 中心控制面 (kind-control): 机架式双横梁宿主控制台 (Host Control Plane Rack) */
      '.nd.kind-control .nd-body{width:152px!important;min-width:152px!important;max-width:152px!important;height:90px!important;min-height:90px!important;border-radius:8px!important;border-top:2px solid #38bdf8!important;border-bottom:2px solid #38bdf8!important;border-left:5px double #38bdf8!important;border-right:5px double #38bdf8!important;background:linear-gradient(180deg,rgba(56,189,248,0.22) 0%,rgba(11,17,30,0.96) 24%,rgba(11,17,30,0.98) 100%)!important;padding:18px 8px 6px!important;justify-content:center!important;align-items:center!important;gap:2px!important;box-shadow:0 8px 22px rgba(56,189,248,0.22)!important}',
      '.nd.kind-control .nd-body::after{content:"HOST CONTROL PLANE";position:absolute;top:0;left:0;right:0;height:15px;background:rgba(56,189,248,0.28);color:#e0f2fe;font-family:var(--mn,monospace);font-size:7px;font-weight:800;letter-spacing:.08em;display:flex;align-items:center;padding-left:7px;border-bottom:1px solid rgba(56,189,248,0.45)}',
      '.nd-ctrl-leds{position:absolute;top:4px;right:8px;display:flex;gap:3px;z-index:3}',
      '.nd-ctrl-leds i{width:5px;height:5px;border-radius:50%;background:#38bdf8;box-shadow:0 0 5px #38bdf8}',
      '.nd-ctrl-leds i:nth-child(2){background:#10b981;box-shadow:0 0 5px #10b981}',
      '.nd-ctrl-leds i:nth-child(3){background:#f59e0b;box-shadow:0 0 5px #f59e0b}',
      '.nd.kind-control .nd-orb{width:22px!important;height:22px!important;margin:0!important;flex-shrink:0}',
      '.nd.kind-control .nd-lbl{font-size:11px!important;font-weight:800!important;white-space:nowrap!important}',

      /* 5. 单步原语动作块 (kind-primitive): 左侧 6px 亮色脊柱 + 横向系统原语指令卡 */
      '.nd.kind-primitive .nd-body{width:148px!important;min-width:148px!important;max-width:148px!important;height:78px!important;min-height:78px!important;border-radius:5px 12px 12px 5px!important;border:1.5px solid color-mix(in srgb,var(--ic,#38bdf8) 50%,rgba(148,163,184,0.25))!important;border-left:6px solid var(--ic,#38bdf8)!important;background:linear-gradient(90deg,color-mix(in srgb,var(--ic,#38bdf8) 16%,rgba(15,23,42,0.96)),rgba(12,17,29,0.96) 55%)!important;padding:5px 8px!important;justify-content:center!important;align-items:center!important;gap:2px!important;box-shadow:0 6px 18px rgba(0,0,0,0.42)!important}',
      '.nd.kind-primitive .nd-orb{width:22px!important;height:22px!important;margin:0!important;flex-shrink:0}',
      '.nd.kind-primitive .nd-lbl{font-size:10.5px!important;font-weight:800!important;white-space:nowrap!important}',

      /* 6. 共享读写存储 / 黑板 / 任务池 (kind-store): 3D 数据库圆柱体 + 多槽位黑板 */
      '.nd.kind-store .nd-body{width:156px!important;min-width:156px!important;max-width:156px!important;height:102px!important;min-height:102px!important;border-radius:16px/24px!important;border:2px solid #06b6d4!important;background:linear-gradient(180deg,rgba(6,182,212,0.28) 0%,rgba(11,19,32,0.96) 24%,rgba(11,19,32,0.96) 80%,rgba(6,182,212,0.22) 100%)!important;padding:4px 8px 6px!important;justify-content:space-between!important;align-items:center!important;box-shadow:0 8px 24px rgba(6,182,212,0.26)!important}',
      '.nd-store-cap{height:11px;width:94%;margin:0 auto;border-radius:50%;border:1.5px solid #22d3ee;background:radial-gradient(ellipse at center,rgba(34,211,238,0.38),rgba(8,51,68,0.85));box-shadow:0 2px 6px rgba(0,0,0,0.45);flex-shrink:0}',
      '.nd-store-main{display:flex;align-items:center;gap:6px;justify-content:center;width:100%}',
      '.nd.kind-store .nd-orb{width:22px!important;height:22px!important;margin:0!important;flex-shrink:0}',
      '.nd.kind-store .nd-lbl{font-size:11px!important;font-weight:800!important;white-space:nowrap!important}',
      '.nd-store-slots{display:flex;gap:3px;justify-content:center;width:100%}',
      '.nd-store-slot,.nd-store-slots span{font-family:var(--mn,monospace);font-size:7.5px;font-weight:700;padding:1.5px 5px;border-radius:3px;background:rgba(6,182,212,0.22);border:1px solid rgba(34,211,238,0.5);color:#a5f3fc;white-space:nowrap}',

      /* 顶部结构推导公式栏样式 (#phaseBar 协作单元模式：紧凑单行流式公式条) */
      '#phaseBar.unit-struct-bar{display:flex!important;flex-direction:row!important;align-items:center!important;gap:7px!important;padding:5px 12px!important;max-width:calc(100% - 290px)!important;border-radius:10px!important;border:1px solid rgba(56,189,248,0.35)!important;background:rgba(9,13,24,0.92)!important;box-shadow:0 6px 22px rgba(0,0,0,0.5)!important;flex-wrap:nowrap!important;overflow:hidden!important}',
      '.usb-lvl{font-family:var(--mn,monospace);font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--uc,#38bdf8) 18%,transparent);border:1px solid color-mix(in srgb,var(--uc,#38bdf8) 55%,transparent);color:var(--uc,#38bdf8);white-space:nowrap;flex-shrink:0}',
      '.usb-formula{font-family:var(--mn,monospace);font-size:9.5px;font-weight:700;color:#f1f5f9;background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.09);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:440px}',
      '.usb-sep{width:1px;height:14px;background:rgba(255,255,255,0.14);flex-shrink:0}',
      '.usb-leg{display:inline-flex;align-items:center;gap:4px;font-family:var(--mn,monospace);font-size:8.5px;color:#cbd5e1;white-space:nowrap;flex-shrink:0}',
      '.usb-leg i{display:inline-block;width:10px;height:3px;border-radius:2px}',

      /* 连线高亮与编辑器按钮 */
      'path.conn-main{transition:stroke-width .15s,filter .15s}',
      'path.hit{cursor:pointer;pointer-events:stroke}',
      'path.hit:hover + path.conn-hover-ring{opacity:1!important}',
      '.edge-ed-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:5px}',
      '.edge-ed-btn{cursor:pointer;font-size:10px;padding:5px 7px;border-radius:6px;border:1px solid var(--b1,rgba(148,163,184,0.22));background:var(--s2,rgba(15,23,42,0.55));color:var(--t1,#e2e8f0);display:flex;align-items:center;gap:5px;text-align:left;transition:all .12s}',
      '.edge-ed-btn:hover{border-color:#38bdf8}',
      '.edge-ed-btn.on{border-color:#38bdf8;background:rgba(56,189,248,0.18);color:#fff;font-weight:700}'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  AG_CAT_META['COLLAB_UNIT'] = { pl: '基本协作单元原语', en: '基本协作单元原语', emoji: '🧩', c: '#38bdf8' };

  window.UNIT_CAT_ORDER = ['L12', 'L3', 'L4S', 'L4P'];
  window.UNIT_CAT_META = {
    L12: {
      name: '第 1–2 级：单体接口与一次问答',
      en: 'Lv.1–2: Single-Agent Ports & One Q&A',
      icon: '①',
      color: '#38bdf8',
      badge: 'L1–L2 · 最小合体单元',
      badgeEn: 'L1–L2 · Minimal Composite Atom',
      desc: '单智能体一进两出接口 + 中心对智能体做完「发过去 → 跑 → 观察状态 → 读」4 步合体（按未开/空闲/正忙分三种入口）'
    },
    L3: {
      name: '第 3 级：两种双人连法',
      en: 'Lv.3: Two 2-Agent Connection Circuits',
      icon: '②',
      color: '#818cf8',
      badge: 'L3 · 双体连接通路',
      badgeEn: 'L3 · Two-Agent Connection Circuits',
      desc: 'A 不直接抓 B：甲路走信息（A 写在输出里交中心转办），乙路走能力渠道（中心把「问 B」包成 A 的工具）'
    },
    L4S: {
      name: '第 4 级 A：五种基本形状',
      en: 'Lv.4A: Five Basic Shapes + 3 Seam Decisions',
      icon: '③',
      color: '#10b981',
      badge: 'L4A · 五种基本形状',
      badgeEn: 'L4A · Five Basic Shapes',
      desc: '把多轮「一次问答」排成 ①接力、②分发、③汇总、④往返、⑤共享，并在每次问答之间做「下一个是谁 / 给他什么 / 停不停」3 个决定'
    },
    L4P: {
      name: '第 4 级 B：常见协作模式拼装',
      en: 'Lv.4B: Assembled Collaboration Patterns',
      icon: '④',
      color: '#f59e0b',
      badge: 'L4B · 模式拆解对照',
      badgeEn: 'L4B · Pattern Decomposition',
      desc: '不引入任何新原语，仅由「五种基本形状 + 两种双人连法 + 步间三个决定（规则/智能体/人）」拼出 7 种常见多智能体架构'
    }
  };

  // 15 个协作原语与角色节点（每个节点具备明确 nodeKind、视觉造型标签 kindTag、代码签名 codeSig）
  var UNIT_NODE_DEFS = [
    {
      id: 'u_center_ctrl', name: '中心 / 调用方', enName: 'Center / Caller',
      nodeKind: 'control', kindTag: '🎛️ 控制中心', codeSig: 'open/resume · observe · read',
      role: '会话控制 + 观察状态 + 读写流转', enRole: 'Session Control + Observe + Read/Write',
      cat: 'COLLAB_UNIT', color: '#38bdf8', tok: 400, eff: 'Low',
      desc: '单智能体外部的宿主、编排中心或外层循环。手握「会话控制（新建/恢复/插话/答复审批/打断/关闭）+ 观察状态 + 读/写」原语，负责在智能体之间搬运信息并做步间决定。',
      enDesc: 'Host runtime or outer orchestrator holding Session Control + Observe State + Read/Write primitives.',
      edu: '为什么 A 不能直接抓 B？因为每个智能体只有「一进两出」，所有跨智能体连接都经由中心把前一步的「读」塞进下一步的「进口」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="6" width="24" height="24" rx="5" stroke="#38bdf8" stroke-width="2.2" fill="#38bdf8" fill-opacity="0.16"/><circle cx="18" cy="18" r="4.5" fill="#38bdf8"/><path d="M18 6v5M18 25v5M6 18h5M25 18h5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'u_port_in', name: '进口：上下文', enName: 'Inlet: Context',
      nodeKind: 'port', kindTag: '📥 唯一进口', codeSig: 'in: context_window',
      role: '单智能体唯一进口（指令+历史+工具结果）', enRole: 'Single-Agent Sole Inlet (Prompt+History+Tool Results)',
      cat: 'COLLAB_UNIT', color: '#10b981', tok: 600, eff: 'Low',
      desc: '单智能体唯一的进口：当前上下文窗口。无论是人给的任务、中心塞入的前序结果、续聊追加的话，还是工具返回的数据，最终都只能从这个进口进入智能体。',
      enDesc: 'The sole inlet of a single agent: its context window.',
      edu: '「给他什么」这个步间决定，本质上就是决定往下一个智能体的「进口：上下文」里塞全量对话、摘要还是只塞最终产物。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><path d="M5 18h17M16 12l6 6-6 6" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="22" y="7" width="8" height="22" rx="3" stroke="#10b981" stroke-width="2.2" fill="#10b981" fill-opacity="0.2"/></svg>'
    },
    {
      id: 'u_agent_loop', name: '单体智能体', enName: 'Single Agent Loop',
      nodeKind: 'agent', kindTag: '🤖 智能体本体', codeSig: 'think() ⇄ tool_loop()',
      role: '内部思考 + 工具循环（一进两出）', enRole: 'Internal Reasoning + Tool Loop (1-In, 2-Out)',
      cat: 'COLLAB_UNIT', color: '#818cf8', tok: 1800, eff: 'High',
      desc: '第 1 级单体智能体本体：从唯一进口读取上下文，在内部自主思考并循环调用工具，直到停下并从出口交出最终文本或产物。',
      enDesc: 'Level-1 single agent body: reads context from its sole inlet, loops over reasoning and tool calls, and emits final output when done.',
      edu: '多智能体协作没有发明新的智能体内部结构——每个参与者依然只是一个「一进两出」的单体智能体。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="11" stroke="#818cf8" stroke-width="2.2" fill="#818cf8" fill-opacity="0.18"/><path d="M13 18a5 5 0 1 1 8.5 3.5M21.5 21.5v-4h-4" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'u_port_tool', name: '出口①：调工具', enName: 'Outlet 1: Tool Call',
      nodeKind: 'tool', kindTag: '🔧 工具出口①', codeSig: 'out1: tool_call(args)',
      role: '向外调工具 / 读写外部环境或触发乙路', enRole: 'External Tool Call / Environment & Route-B Trigger',
      cat: 'COLLAB_UNIT', color: '#f59e0b', tok: 500, eff: 'Medium',
      desc: '单智能体的两个出口之一：发出结构化工具调用（Tool Call）。既可用于读写外部文件/共享区，也可在「乙路（走能力渠道）」中被中心拦截去触发一次对 B 的完整问答。',
      enDesc: 'First outlet of a single agent: structured tool calls.',
      edu: '当中心把「问 B」包装成 A 的一个工具时，A 从出口①发出工具调用，就会在底层触发中心对 B 的「一次问答」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="8" width="12" height="20" rx="3" stroke="#f59e0b" stroke-width="2.2" fill="#f59e0b" fill-opacity="0.2"/><path d="M18 18h12M25 13l5 5-5 5" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'u_port_out', name: '出口②：最终产出', enName: 'Outlet 2: Final Output',
      nodeKind: 'port', kindTag: '📤 产出出口②', codeSig: 'out2: final_output',
      role: '本轮停下时交出的回复与结构化产物', enRole: 'Final Response & Structured Artifact on Stop',
      cat: 'COLLAB_UNIT', color: '#ec4899', tok: 700, eff: 'Low',
      desc: '单智能体的第二个出口：本轮推理结束停下时，交出的最终回复或产物。在「甲路（走信息）」中，A 把「请 B 做什么」或交接标签直接写在这里，由中心读出后再去调 B。',
      enDesc: 'Second outlet of a single agent: final response/artifact emitted when the turn stops.',
      edu: '「甲路」与「乙路」的根本区别，就是 A 究竟走「出口②：最终产出」还是走「出口①：调工具」来触发下一个智能体。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="8" width="12" height="20" rx="3" stroke="#ec4899" stroke-width="2.2" fill="#ec4899" fill-opacity="0.2"/><path d="M18 18h12M25 13l5 5-5 5" stroke="#ec4899" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'u_step_open', name: '① 开会话 (未开)', enName: '1. Open Session (Closed)',
      nodeKind: 'primitive', kindTag: 'STEP ① · 原语', codeSig: 'open(agent, task)',
      role: '状态一：会话未开 → 新建上下文并发起首问', enRole: 'State 1: Not Open -> Create Context & Send Task',
      cat: 'COLLAB_UNIT', color: '#38bdf8', tok: 500, eff: 'Low',
      desc: '一次问答的第 1 步（针对未开启的会话）：中心调用「开会话（Open）」原语，分配全新上下文窗口，把任务说明和初始材料从进口塞入并启动运行。',
      enDesc: 'Step 1 of One Q&A when no session exists: Center calls Open to allocate a fresh context window.',
      edu: '用后即弃的子智能体（Subagent）或并行分发的 Worker，每次问答第 1 步走的都是「① 开会话」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#38bdf8" stroke-width="2.2" fill="#38bdf8" fill-opacity="0.18"/><path d="M18 12v12M12 18h12" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'u_step_resume', name: '① 续会话 (空闲)', enName: '1. Resume Session (Idle)',
      nodeKind: 'primitive', kindTag: 'STEP ① · 原语', codeSig: 'resume(sid, msg)',
      role: '状态二：已开且空闲 → 带着记忆追加新一轮', enRole: 'State 2: Open & Idle -> Append Turn with Memory',
      cat: 'COLLAB_UNIT', color: '#10b981', tok: 600, eff: 'Low',
      desc: '一次问答的第 1 步（针对已存在且已停下的会话）：中心调用「续会话（Resume）」原语，保留原会话里的前序上下文记忆，直接追加新指令或审查反馈，唤醒智能体继续跑。',
      enDesc: 'Step 1 of One Q&A when session is open & idle: Center calls Resume, preserving prior context history.',
      edu: '「生成—审查循环」和「双人商量」之所以能记住上一轮改了什么，靠的就是第 1 步走「① 续会话」而不是重开。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#10b981" stroke-width="2.2" fill="#10b981" fill-opacity="0.18"/><path d="M14 12l10 6-10 6V12z" fill="#10b981"/></svg>'
    },
    {
      id: 'u_step_steer', name: '① 插话/打断 (正忙)', enName: '1. Steer / Interrupt (Busy)',
      nodeKind: 'primitive', kindTag: 'STEP ① · 原语', codeSig: 'steer() / abort()',
      role: '状态三：正在跑 → 运行中注入新信息或紧急叫停', enRole: 'State 3: Busy Running -> Mid-Run Steer or Abort',
      cat: 'COLLAB_UNIT', color: '#f59e0b', tok: 500, eff: 'Medium',
      desc: '一次问答的第 1 步（针对正在运行中的会话）：目标智能体还没停下，中心或人调用「插话（Steer） / 回应审批（Respond） / 打断（Abort）」原语，在它的下一步工具循环前注入纠偏信息或直接叫停。',
      enDesc: 'Step 1 of One Q&A when target session is currently busy: Center injects a mid-run Steer, Respond, or Abort.',
      edu: '当观察者发现执行者跑偏、或者用户在界面上点「插话纠偏」时，触发的就是运行中状态下的「① 插话/打断」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#f59e0b" stroke-width="2.2" fill="#f59e0b" fill-opacity="0.18"/><path d="M19 10l-6 9h5l-1 7 6-9h-5l1-7z" fill="#f59e0b"/></svg>'
    },
    {
      id: 'u_step_wait', name: '②③ 观察状态·等停', enName: '2-3. Observe State & Await Stop',
      nodeKind: 'primitive', kindTag: 'STEP ②③ · 原语', codeSig: 'observe(until=STOP)',
      role: '监听运行中/待审批/已停下/出错状态信号', enRole: 'Observe Running / Awaiting-Approval / Stopped / Error',
      cat: 'COLLAB_UNIT', color: '#a855f7', tok: 300, eff: 'Low',
      desc: '一次问答的第 2–3 步：智能体在内部跑（思考与调工具），中心通过「观察状态（Observe State）」原语监听它是仍在忙、卡在权限确认，还是已经正常停下/报错。',
      enDesc: 'Steps 2–3 of One Q&A: Center uses Observe State to detect when the agent stops, blocks on approval, or errors.',
      edu: '哪怕是最简单的「调一下智能体」，也必须包含「观察状态直到停下」这一步，否则中心拿到的是半截输出。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="11" stroke="#a855f7" stroke-width="2.2" fill="#a855f7" fill-opacity="0.18"/><circle cx="18" cy="18" r="4" fill="#a855f7"/><path d="M18 7v3M18 26v3M7 18h3M26 18h3" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'u_step_read', name: '④ 读回产出', enName: '4. Read Output',
      nodeKind: 'primitive', kindTag: 'STEP ④ · 原语', codeSig: 'read(session_out)',
      role: '智能体停下后，中心读取其最终回复或产物', enRole: 'Read Final Reply or Artifact After Agent Stops',
      cat: 'COLLAB_UNIT', color: '#ec4899', tok: 450, eff: 'Low',
      desc: '一次问答的第 4 步：看到智能体状态变为「已停下」后，中心调用「读（Read）」原语，从它的出口取回最终答复、结构化字段或产物引用，完成「一次问答」闭环。',
      enDesc: 'Step 4 of One Q&A: once Observe State reports Stopped, Center calls Read to retrieve the final output.',
      edu: '第 4 步「读回产出」是一次问答的终点，也是下一步「给他什么」的原料来源。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="8" y="7" width="20" height="22" rx="3" stroke="#ec4899" stroke-width="2.2" fill="#ec4899" fill-opacity="0.18"/><path d="M13 14h10M13 19h10M13 24h6" stroke="#ec4899" stroke-width="2.2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'u_seam_3dec', name: '步间 3 个决定', enName: '3 Inter-Step Decisions',
      nodeKind: 'decision', kindTag: '◆ 步间判断门', codeSig: '①谁 · ②什么 · ③停?',
      role: '①下一个是谁 · ②给他什么 · ③停不停', enRole: '1. Who Next · 2. What Context · 3. Stop or Continue',
      cat: 'COLLAB_UNIT', color: '#f43f5e', tok: 500, eff: 'Medium',
      desc: '两次「一次问答」之间的菱形接缝判断门。每次前一个问答结束、后一个问答开始前，必须回答三个问题：①下一个是谁？②给他什么（全量/摘要/仅产物）？③停不停？回答者只能是「写死的规则」、「另一个智能体」或「人」。',
      enDesc: 'The diamond decision gateway between two Q&A units: (1) Who is next? (2) What context? (3) Stop or continue?',
      edu: '五种基本形状之所以能演变出几十种常见协作模式，核心变量就是「菱形判断门里的这 3 个决定由谁回答（规则 / 智能体 / 人）」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><polygon points="18,4 32,18 18,32 4,18" stroke="#f43f5e" stroke-width="2.4" fill="#f43f5e" fill-opacity="0.22"/><circle cx="18" cy="13.5" r="2" fill="#f43f5e"/><circle cx="14" cy="21" r="2" fill="#f43f5e"/><circle cx="22" cy="21" r="2" fill="#f43f5e"/></svg>'
    },
    {
      id: 'u_shared_board', name: '共享读写区', enName: 'Shared Read/Write Store',
      nodeKind: 'store', kindTag: '🗄️ 公共读写存储', codeSig: 'read() / write() store',
      role: '黑板 / 共享文件 / 公共任务池（原语：读+写）', enRole: 'Blackboard / Shared Files / Task Pool (Read+Write)',
      cat: 'COLLAB_UNIT', color: '#06b6d4', tok: 400, eff: 'Low',
      desc: '第 4 级基本形状「⑤ 共享」的核心存储媒介：一块所有参与者都能通过「读（Read）」和「写（Write）」原语访问的公共区域（如共享黑板、代码库目录、任务看板/队列）。',
      enDesc: 'Core medium of Shape 5 (Shared): a common store (blackboard, repo workspace, or task pool) accessed via Read and Write.',
      edu: '在「⑤ 共享」形状中，A 和 B 不靠对话传话，而是通过读写同一块公共存储区来间接协作。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="10" rx="11" ry="4" stroke="#06b6d4" stroke-width="2.2" fill="#06b6d4" fill-opacity="0.25"/><path d="M7 10v16c0 2.2 4.9 4 11 4s11-1.8 11-4V10" stroke="#06b6d4" stroke-width="2.2"/><path d="M7 18c0 2.2 4.9 4 11 4s11-1.8 11-4" stroke="#06b6d4" stroke-width="1.8" stroke-dasharray="3 2"/></svg>'
    },
    {
      id: 'u_agent_a', name: '智能体 A', enName: 'Agent A',
      nodeKind: 'agent', kindTag: '🤖 智能体 A', codeSig: 'Agent_A (上游/主办)',
      role: '发起方 / 前序步骤 / 主办智能体', enRole: 'Initiator / Upstream Step / Lead Agent',
      cat: 'COLLAB_UNIT', color: '#6366f1', tok: 1500, eff: 'High',
      desc: '协作单元中的第一个智能体参与者（或上游节点/主管节点）。内部同样是单智能体循环，对外只通过「进口：上下文」和「出口：调工具 / 最终产出」与中心或共享区交互。',
      enDesc: 'First participating agent (upstream producer, initiator, or lead) executing a standard single-agent loop.',
      edu: '看智能体 A 的出口连线样式：绿色粗实线代表走「甲路（写在产出里）」，紫金双轨线代表走「乙路（调中心工具）」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#6366f1" stroke-width="2.4" fill="#6366f1" fill-opacity="0.2"/><path d="M18 11l-5 14h2.5l1.1-3.2h2.8L20.5 25H23L18 11zm-1 8.5l1-3.2 1 3.2h-2z" fill="#6366f1"/></svg>'
    },
    {
      id: 'u_agent_b', name: '智能体 B', enName: 'Agent B',
      nodeKind: 'agent', kindTag: '🤖 智能体 B', codeSig: 'Agent_B (下游/审查)',
      role: '接收方 / 后序步骤 / 协作者智能体', enRole: 'Receiver / Downstream Step / Collaborator Agent',
      cat: 'COLLAB_UNIT', color: '#14b8a6', tok: 1500, eff: 'High',
      desc: '协作单元中的第二个智能体参与者（或下游节点/审查者/并行分支）。由中心通过「一次问答」唤醒，接收上游传来的材料并产出自己的结果。',
      enDesc: 'Second participating agent (downstream step, reviewer, or parallel worker) invoked via a One Q&A unit.',
      edu: '智能体 B 可以每次新建会话（用完即关），也可以保留会话反复续聊（带着上下文记忆多轮往返）。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#14b8a6" stroke-width="2.4" fill="#14b8a6" fill-opacity="0.2"/><path d="M14 11h5c2.2 0 3.8 1.2 3.8 3.2 0 1.4-.8 2.4-2 2.8 1.5.4 2.4 1.5 2.4 3.2 0 2.3-1.8 3.8-4.2 3.8h-5V11zm2.4 5.5h2.3c1 0 1.7-.6 1.7-1.6s-.7-1.6-1.7-1.6h-2.3v3.2zm0 6.2h2.6c1.2 0 1.9-.7 1.9-1.8 0-1.2-.7-1.8-1.9-1.8h-2.6v3.6z" fill="#14b8a6"/></svg>'
    },
    {
      id: 'u_agent_c', name: '智能体 C', enName: 'Agent C',
      nodeKind: 'agent', kindTag: '🤖 智能体 C', codeSig: 'Agent_C (汇总/裁判)',
      role: '第三参与方 / 并行分支 / 汇总裁判智能体', enRole: 'Third Participant / Parallel Branch / Aggregator-Judge',
      cat: 'COLLAB_UNIT', color: '#f97316', tok: 1500, eff: 'High',
      desc: '协作单元中的第三个智能体参与者（用于并行分发、多路汇总、辩论裁判或交接链下游）。展示多智能体拓扑如何从双人连接自然扩展到多人结构。',
      enDesc: 'Third participating agent (used in parallel fan-out, fan-in aggregation, debate judge, or multi-hop handoff).',
      edu: '无论是第 3 个还是第 N 个智能体，中心对它的调用依然只是重复同一个最小合体单元——「一次问答」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="12" stroke="#f97316" stroke-width="2.4" fill="#f97316" fill-opacity="0.2"/><path d="M22.5 15c-.4-1.2-1.5-2-3-2-2.2 0-3.6 1.8-3.6 5s1.4 5 3.6 5c1.5 0 2.6-.8 3-2h2.5c-.6 2.6-2.6 4.3-5.5 4.3-3.7 0-6.2-2.8-6.2-7.3s2.5-7.3 6.2-7.3c2.9 0 4.9 1.7 5.5 4.3h-2.5z" fill="#f97316"/></svg>'
    }
  ];

  window.UNIT_NODE_META = {};
  function innerSvg24(svgStr) {
    var inner = String(svgStr || '').replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
    return '<g transform="scale(0.6667)">' + inner + '</g>';
  }

  UNIT_NODE_DEFS.forEach(function(d) {
    window.UNIT_NODE_META[d.id] = d;
    var hasIt = (typeof AD_MAP.has === 'function') ? AD_MAP.has(d.id) : Boolean(AD_MAP[d.id]);
    if (!hasIt) {
      var item = {
        cat: d.cat,
        id: d.id,
        name: d.name,
        icon: '🧩',
        color: 'cy',
        model: 'sonnet',
        effort: String(d.eff || 'medium').toLowerCase(),
        load: d.nodeKind === 'agent' ? 60 : 30,
        phase: d.nodeKind === 'agent' ? 'build' : (d.nodeKind === 'decision' ? 'hitl' : 'strategy'),
        nodeKind: d.nodeKind,
        kindTag: d.kindTag,
        codeSig: d.codeSig,
        role: d.desc,
        tools: d.codeSig || 'Session, Observe, Read, Write',
        prompt: 'ROLA: ' + d.name + ' (' + d.role + ')\n\nINPUT:\n- ' + d.desc + '\n\nOUTPUT:\n- ' + d.edu
      };
      AD.push(item);
      if (typeof AD_MAP.set === 'function') AD_MAP.set(d.id, item);
      else AD_MAP[d.id] = item;
    }
    if (typeof AGENT_SVG !== 'undefined') AGENT_SVG[d.id] = innerSvg24(d.svg);
    if (typeof AGENT_COLORS_DARK !== 'undefined') AGENT_COLORS_DARK[d.id] = d.color;
    if (typeof AGENT_COLORS_LIGHT !== 'undefined') AGENT_COLORS_LIGHT[d.id] = d.color;
    if (typeof I18N_EN !== 'undefined') {
      if (I18N_EN.agentNames) I18N_EN.agentNames[d.id] = d.name;
      if (I18N_EN.agentRoles) I18N_EN.agentRoles[d.id] = d.desc + ' ' + d.edu;
    }
  });
})();
/* ===== 基本协作单元 — PART 2A: 带结构泳道(zones)与 Draw.io 级连线语义(edges)的前 10 个单元 ===== */
(function(){
  if (typeof PR === 'undefined' || typeof PM === 'undefined') return;

  window.UNIT_META = window.UNIT_META || {};
  window.UNIT_IDS = window.UNIT_IDS || [];

  var UNITS_PART_A = [
    {
      id: 'unit_l1_ports',
      unitCat: 'L12',
      name: '1. 单智能体「一进两出」接口',
      enName: '1. Single-Agent "1-In, 2-Out" Interface',
      sub: '第 1 级底座：唯一进口是上下文，两个出口是调工具与最终产出',
      enSub: 'Lv.1 Foundation: Sole inlet is Context; two outlets are Tool Call & Final Output',
      color: '#38bdf8',
      badge: '第 1 级 · 单体对外接口',
      formula: '单智能体 = 进口(上下文) ──► [内部思考 + 工具循环] ──► 出口①(调工具) + 出口②(最终产出)',
      channel: '单体底座（尚未跨智能体）：甲路靠出口②写交接文本，乙路靠出口①调中心封装的工具。',
      decNext: { who: '单体内部循环', text: '模型自主决定继续调工具还是结束本轮输出' },
      decWhat: { who: '进口：上下文', text: '指令 + 历史消息 + 工具返回结果全部从唯一进口塞入' },
      decStop: { who: '单体停止条件', text: '不再发出工具调用、达到终止条件或被外部打断时停下' },
      related: ['unit_ask_open', 'unit_conn_info', 'unit_conn_channel'],
      zones: [
        { x: 18, y: 55, w: 175, h: 205, title: '📥 唯一进口 (Inlet)', sub: '所有信息必经上下文窗口', color: '#10b981' },
        { x: 215, y: 40, w: 180, h: 235, title: '🤖 单体智能体内部循环', sub: '思考 ⇄ 工具调用', color: '#818cf8' },
        { x: 418, y: 18, w: 190, h: 275, title: '📤 两个对外出口 (Outlets)', sub: '出口①调工具 · 出口②交产出', color: '#f59e0b' }
      ],
      nodes: [
        { id: 'u_port_in', x: 40, y: 125 },
        { id: 'u_agent_loop', x: 243, y: 105 },
        { id: 'u_port_tool', x: 446, y: 52 },
        { id: 'u_port_out', x: 446, y: 188 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '塞入上下文窗口', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [1, 2, 'two', { seq: '②', label: '发出 tool_call ⇄ 返回结果', sem: 'channel', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#f59e0b', af: 'right', at: 'left' }],
        [1, 3, 'one', { seq: '③', label: '本轮停下 → 交出最终产出', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#ec4899', af: 'right', at: 'left' }]
      ],
      edu: '多智能体协作没有发明任何新的智能体内部机制。每个智能体对外只有「一进两出」：所有协作信息只能从「进口：上下文」塞进去，所有对外动作只能从「出口①：调工具」或「出口②：最终产出」出来。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><path d="M5 18h8" stroke="#10b981" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="18" r="6" stroke="#818cf8" stroke-width="2"/><path d="M24 15l7-4M24 21l7 4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_ask_open',
      unitCat: 'L12',
      name: '2A. 一次问答 · 状态一：未开 → 开会话',
      enName: '2A. One Q&A · State 1: Closed -> Open Session',
      sub: '第 2 级最小合体单元：会话未开时，新建上下文并走完 4 步闭环',
      enSub: 'Lv.2 Minimal Composite Unit: When closed, Open fresh context & complete 4-step loop',
      color: '#38bdf8',
      badge: '第 2 级 · 一次问答 (未开)',
      formula: '一次问答(未开) = ① 开会话(Open) ──► ② 智能体跑 ──► ③ 观察状态(等停) ──► ④ 读回产出(Read)',
      channel: '中心 ⇄ 单智能体（适用于用完即关的 Subagent 或并行 Worker 首轮启动）。',
      decNext: { who: '调用方 / 中心', text: '选定目标智能体并调用「开会话（Open）」分配全新上下文' },
      decWhat: { who: '调用方 / 中心', text: '把任务指令与本轮所需背景材料一次性塞进新会话进口' },
      decStop: { who: '观察状态原语', text: '监听到状态从「运行中」变为「已停下」后，触发第 ④ 步读回结果' },
      stateSiblings: { open: 'unit_ask_open', resume: 'unit_ask_resume', steer: 'unit_ask_steer' },
      related: ['unit_ask_resume', 'unit_ask_steer', 'unit_shape_fanout'],
      zones: [
        { x: 15, y: 20, w: 395, h: 280, title: '🎛️ 宿主/中心控制面 (Host Control Plane)', sub: '掌握 开会话 · 观察状态 · 读回产出', color: '#38bdf8' },
        { x: 430, y: 20, w: 195, h: 280, title: '🤖 目标智能体会话 (状态一：未开)', sub: '新建上下文 → 自主运行至停下', color: '#6366f1' }
      ],
      nodes: [
        { id: 'u_center_ctrl', x: 38, y: 112 },
        { id: 'u_step_open', x: 240, y: 48 },
        { id: 'u_agent_a', x: 465, y: 55 },
        { id: 'u_step_wait', x: 465, y: 205 },
        { id: 'u_step_read', x: 240, y: 205 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '发起 open() 原语', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '新建上下文塞入任务', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [2, 3, 'continuous', { seq: '③', label: '观察状态 (RUNNING → STOPPED)', sem: 'observe', algo: 'ortho', weight: 'thin', dash: 'dotted', startMarker: 'circle', endMarker: 'bar', color: '#a855f7', af: 'bottom', at: 'top' }],
        [3, 4, 'one', { seq: '④', label: '确认已停 → 触发 read()', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'none', endMarker: 'open', color: '#ec4899', af: 'left', at: 'right' }],
        [4, 0, 'one', { seq: '⑤', label: '读回最终产出闭环', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#ec4899', af: 'left', at: 'bottom' }]
      ],
      edu: '单靠一个原语成不了事：光「新建会话」不「读」拿不到结果；光「读」不等它停下读到的是半截话。所以「①开会话 → ②跑 → ③观察状态等停 → ④读回产出」合起来才是协作里的最小合体单元——「一次问答」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="8" width="24" height="20" rx="5" stroke="#38bdf8" stroke-width="2"/><path d="M13 18h10M18 13v10" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_ask_resume',
      unitCat: 'L12',
      name: '2B. 一次问答 · 状态二：已开且空闲 → 续会话',
      enName: '2B. One Q&A · State 2: Idle -> Resume Session',
      sub: '第 2 级最小合体单元：会话已开且停下时，保留记忆追加新一轮问答',
      enSub: 'Lv.2 Minimal Composite Unit: When open & idle, Resume with memory & complete 4-step loop',
      color: '#10b981',
      badge: '第 2 级 · 一次问答 (空闲)',
      formula: '一次问答(空闲) = ① 续会话(Resume) ──► ② 带着记忆跑 ──► ③ 观察状态(等停) ──► ④ 读回产出(Read)',
      channel: '中心 ⇄ 持久会话智能体（适用于多轮商量、审查返工、按阶段追问）。',
      decNext: { who: '调用方 / 中心', text: '定位已存在的空闲会话 ID，调用「续会话（Resume）」而非重开' },
      decWhat: { who: '调用方 / 中心', text: '无需重复塞前序历史（已在会话记忆内），只追加本轮新反馈或追问' },
      decStop: { who: '观察状态原语', text: '等本轮续跑再次变为「已停下」，读出更新后的产出' },
      stateSiblings: { open: 'unit_ask_open', resume: 'unit_ask_resume', steer: 'unit_ask_steer' },
      related: ['unit_ask_open', 'unit_ask_steer', 'unit_shape_roundtrip'],
      zones: [
        { x: 15, y: 20, w: 395, h: 280, title: '🎛️ 宿主/中心控制面 (Host Control Plane)', sub: '定位原会话 ID · 发起续会话', color: '#10b981' },
        { x: 430, y: 20, w: 195, h: 280, title: '🤖 持久智能体会话 (状态二：空闲带记忆)', sub: '保留前序历史 + 追加新一轮指令', color: '#6366f1' }
      ],
      nodes: [
        { id: 'u_center_ctrl', x: 38, y: 112 },
        { id: 'u_step_resume', x: 240, y: 48 },
        { id: 'u_agent_a', x: 465, y: 55 },
        { id: 'u_step_wait', x: 465, y: 205 },
        { id: 'u_step_read', x: 240, y: 205 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '发起 resume(sid) 原语', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [1, 2, 'two', { seq: '②', label: '保留原记忆 + 追加新反馈', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond_open', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [2, 3, 'continuous', { seq: '③', label: '观察状态 (等本轮再次停下)', sem: 'observe', algo: 'ortho', weight: 'thin', dash: 'dotted', startMarker: 'circle', endMarker: 'bar', color: '#a855f7', af: 'bottom', at: 'top' }],
        [3, 4, 'one', { seq: '④', label: '确认已停 → 触发 read()', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'none', endMarker: 'open', color: '#ec4899', af: 'left', at: 'right' }],
        [4, 0, 'one', { seq: '⑤', label: '读回本轮更新产出', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#ec4899', af: 'left', at: 'bottom' }]
      ],
      edu: '当目标会话处于「已开且空闲」状态时，一次问答的第 ① 步走「续会话（Resume）」。因为原会话还留着前序上下文记忆，只需追加本轮修改意见即可实现真正的多轮协作。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="8" width="24" height="20" rx="5" stroke="#10b981" stroke-width="2"/><path d="M15 13l8 5-8 5V13z" fill="#10b981"/></svg>'
    },
    {
      id: 'unit_ask_steer',
      unitCat: 'L12',
      name: '2C. 一次问答 · 状态三：正忙 → 插话/答复审批/打断',
      enName: '2C. One Q&A · State 3: Busy -> Steer / Respond / Abort',
      sub: '第 2 级最小合体单元：会话正在跑或等确认时，中途注入纠偏或紧急叫停',
      enSub: 'Lv.2 Minimal Composite Unit: When busy/blocked, inject mid-run Steer, Respond, or Abort',
      color: '#f59e0b',
      badge: '第 2 级 · 一次问答 (正忙)',
      formula: '一次问答(正忙) = ① 插话(Steer)/答复审批(Respond)/打断(Abort) ──► ② 转向或终止 ──► ③ 观察状态 ──► ④ 读回结果',
      channel: '中心/监督者 ──► 正在运行的智能体（适用于运行中纠偏、权限审批放行、超时熔断）。',
      decNext: { who: '监督者 / 人 / 规则', text: '观察到目标会话正在跑偏或卡在待确认状态，立即向该运行中会话出手' },
      decWhat: { who: '插话 / 回应 / 打断', text: '塞入一句中途纠偏提示（插话）、批准/拒绝（回应），或直接发停止信号（打断）' },
      decStop: { who: '观察状态原语', text: '确认智能体按新方向跑完停下，或确认已被安全打断终止' },
      stateSiblings: { open: 'unit_ask_open', resume: 'unit_ask_resume', steer: 'unit_ask_steer' },
      related: ['unit_ask_open', 'unit_ask_resume', 'unit_pat_supervisor'],
      zones: [
        { x: 15, y: 20, w: 395, h: 280, title: '🎛️ 监督者/中心控制面 (Mid-Run Intervention)', sub: '运行中实时干预：插话 · 回应审批 · 打断', color: '#f59e0b' },
        { x: 430, y: 20, w: 195, h: 280, title: '🤖 正在运行的会话 (状态三：正忙/待确认)', sub: '工具循环间隙接收插话或立即中止', color: '#f43f5e' }
      ],
      nodes: [
        { id: 'u_center_ctrl', x: 38, y: 112 },
        { id: 'u_step_steer', x: 240, y: 48 },
        { id: 'u_agent_a', x: 465, y: 55 },
        { id: 'u_step_wait', x: 465, y: 205 },
        { id: 'u_step_read', x: 240, y: 205 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '发出 steer/respond/abort', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'circle', endMarker: 'classic', color: '#f59e0b', af: 'right', at: 'left' }],
        [1, 2, 'continuous', { seq: '②', label: '运行中强行注入 / 叫停', sem: 'loop', algo: 'ortho', weight: 'double', dash: 'dashed', startMarker: 'diamond', endMarker: 'bar', color: '#f43f5e', af: 'right', at: 'left' }],
        [2, 3, 'continuous', { seq: '③', label: '观察转向后完成或已中止', sem: 'observe', algo: 'ortho', weight: 'thin', dash: 'dotted', startMarker: 'circle', endMarker: 'bar', color: '#a855f7', af: 'bottom', at: 'top' }],
        [3, 4, 'one', { seq: '④', label: '停稳后触发 read()', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'none', endMarker: 'open', color: '#ec4899', af: 'left', at: 'right' }],
        [4, 0, 'one', { seq: '⑤', label: '读回纠偏后产出/截断现场', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#ec4899', af: 'left', at: 'bottom' }]
      ],
      edu: '如果目标智能体「正在跑」，不用傻等它跑完再返工——中心或人可以直接调用「插话（Steer）」在它下一步工具循环前塞入新指令，或调用「打断（Abort）」及时止损。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="8" width="24" height="20" rx="5" stroke="#f59e0b" stroke-width="2"/><path d="M19 11l-5 7h4l-1 7 5-7h-4l1-7z" fill="#f59e0b"/></svg>'
    },
    {
      id: 'unit_conn_info',
      unitCat: 'L3',
      name: '3A. 甲路：走信息（A 写在输出里交中心转办）',
      enName: '3A. Route A: Info Path (Written in Output, Routed by Center)',
      sub: '第 3 级双人连法一：A 从出口②交出文本/标签，中心读出后再对 B 发起一次问答',
      enSub: 'Lv.3 Circuit A: Agent A writes handoff/output at Outlet 2; Center reads & triggers One Q&A on B',
      color: '#ec4899',
      badge: '第 3 级 · 甲路（走信息）',
      formula: '甲路 = A 停下交出[出口②：最终产出] ──► 中心[读 + 步间决定] ──► 塞入 B 的[进口：上下文]触发一次问答',
      channel: '甲路（走信息）：A 并不拥有调 B 的工具，A 只是在产出里写明结果或「交接给 B」，等 A 停下后由中心接盘转交。',
      decNext: { who: '规则 或 A 的输出标签', text: 'A 停下后，中心解析 A 的产出（或按固定流水线规则）决定下一步找 B' },
      decWhat: { who: '中心筛选 / 裁剪', text: '中心从 A 的最终产出中提取正文或结构化字段，塞进 B 的进口' },
      decStop: { who: 'A 先停，B 后跑', text: 'A 的本次问答已经彻底停下结束，然后才开启 B 的问答（串行解耦）' },
      related: ['unit_conn_channel', 'unit_shape_relay', 'unit_pat_handoff'],
      zones: [
        { x: 10, y: 30, w: 325, h: 215, title: '🤖 上游：智能体 A（先跑完停下）', sub: '通过出口②交出最终文本/交接标签', color: '#6366f1' },
        { x: 350, y: 30, w: 170, h: 215, title: '🎛️ 中心接盘转办', sub: '读出 A 产出 → 步间决定', color: '#38bdf8' },
        { x: 535, y: 30, w: 325, h: 215, title: '🤖 下游：智能体 B（后启动问答）', sub: '从唯一进口接收中心塞入的材料', color: '#14b8a6' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 28, y: 92 },
        { id: 'u_port_out', x: 185, y: 108 },
        { id: 'u_center_ctrl', x: 368, y: 98 },
        { id: 'u_port_in', x: 552, y: 108 },
        { id: 'u_agent_b', x: 712, y: 92 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: 'A 停下交出产出', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#ec4899', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '中心 read() 读取文本', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'circle', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [2, 3, 'one', { seq: '③', label: '中心裁剪并塞入 B 进口', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [3, 4, 'one', { seq: '④', label: '唤醒 B 执行一次问答', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }]
      ],
      edu: '甲路（走信息）的特点是「A 先停下，B 再开始」：A 甚至不需要知道外部有几个智能体，只需按约定把结果写进自己的最终产出（出口②），由中心读出并塞进 B 的上下文进口。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="9" cy="18" r="5" stroke="#6366f1" stroke-width="2"/><rect x="15" y="14" width="6" height="8" rx="1.5" stroke="#ec4899" stroke-width="1.8"/><circle cx="27" cy="18" r="5" stroke="#14b8a6" stroke-width="2"/><path d="M14 18h1M21 18h1" stroke="#38bdf8" stroke-width="2"/></svg>'
    },
    {
      id: 'unit_conn_channel',
      unitCat: 'L3',
      name: '3B. 乙路：走能力渠道（把「问 B」包成 A 的工具）',
      enName: '3B. Route B: Capability Channel ("Ask B" Wrapped as A\'s Tool)',
      sub: '第 3 级双人连法二：A 从出口①调工具，中心在底层跑完对 B 的一次问答再把结果塞回 A',
      enSub: 'Lv.3 Circuit B: Agent A calls tool at Outlet 1; Center runs One Q&A on B & returns result to A',
      color: '#818cf8',
      badge: '第 3 级 · 乙路（走能力渠道）',
      formula: '乙路 = A 发出[出口①：调工具 ask_B] ──► 中心拦截并对 B 做[一次问答] ──► B 的产出作为[工具结果]塞回 A 的进口',
      channel: '乙路（走能力渠道）：在 A 看来自己只是调了一个普通工具（如 spawn_agent / send_message），中心在背后完成了对 B 的新建/恢复、等停和读回。',
      decNext: { who: '智能体 A（自主调工具）', text: 'A 在思考循环中自己决定何时调用 `ask_B` 工具以及调哪个子智能体' },
      decWhat: { who: '智能体 A（工具参数）', text: 'A 自己构造工具调用的 prompt 参数，中心将其原样或附加约束后塞给 B' },
      decStop: { who: 'B 先停，A 继续跑', text: 'B 跑完停下后，结果作为 Tool Result 回到 A 的进口，A 继续自己的思考循环' },
      related: ['unit_conn_info', 'unit_shape_fanout', 'unit_pat_supervisor'],
      zones: [
        { x: 15, y: 15, w: 365, h: 285, title: '🤖 主智能体 A（本轮未结束 · 挂起等工具返回）', sub: '出口①发出 ask_B 工具调用 → 进口接收 Tool Result', color: '#6366f1' },
        { x: 398, y: 15, w: 175, h: 285, title: '🔧 中心能力渠道总线', sub: '把「问 B」包装成工具', color: '#f59e0b' },
        { x: 590, y: 15, w: 185, h: 285, title: '🤖 子智能体 B（被调方）', sub: '底层完整跑完一次问答', color: '#14b8a6' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 35, y: 105 },
        { id: 'u_port_tool', x: 220, y: 42 },
        { id: 'u_center_ctrl', x: 418, y: 112 },
        { id: 'u_agent_b', x: 620, y: 105 },
        { id: 'u_port_in', x: 220, y: 205 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: 'A 调工具 ask_B(prompt)', sem: 'channel', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#f59e0b', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '中心拦截 Tool Call', sem: 'channel', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#f59e0b', af: 'right', at: 'top' }],
        [2, 3, 'two', { seq: '③', label: '对 B 执行完整「一次问答」', sem: 'control', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [2, 4, 'one', { seq: '④', label: '将 B 产出包装为 Tool Result', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'none', endMarker: 'classic', color: '#10b981', af: 'bottom', at: 'right' }],
        [4, 0, 'one', { seq: '⑤', label: '塞回 A 进口，A 继续思考', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#10b981', af: 'left', at: 'bottom' }]
      ],
      edu: '乙路（走能力渠道）是当前 Agent SDK 最常用的子智能体机制：中心把「对 B 的一次问答」包装成 A 手里的一个工具。A 调工具时不结束本轮，等 B 跑完返回结果后，A 接着往下想。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="10" cy="18" r="5" stroke="#6366f1" stroke-width="2"/><rect x="16" y="10" width="6" height="6" rx="1.5" stroke="#f59e0b" stroke-width="1.8"/><circle cx="27" cy="18" r="5" stroke="#14b8a6" stroke-width="2"/><path d="M22 22l-8 0" stroke="#10b981" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_shape_relay',
      unitCat: 'L4S',
      name: '4A-① 基本形状：接力（A → B → C 串行）',
      enName: '4A-1 Basic Shape: Relay (A -> B -> C Sequential)',
      sub: '第 4 级基本形状①：前一个问答的产出塞进后一个问答的进口，一步接一步往下传',
      enSub: 'Lv.4A Shape 1: Output of upstream Q&A feeds inlet of downstream Q&A step-by-step',
      color: '#10b981',
      badge: '第 4 级 A · 形状① 接力',
      formula: '① 接力 = 一次问答(A) ──► [◆步间3决定] ──► 一次问答(B) ──► [◆步间3决定] ──► 一次问答(C)',
      channel: '常走「甲路（走信息）」：A 停下产出 → 中心按接缝决定转交 B → B 停下产出 → 转交 C。',
      decNext: { who: '规则 或 前序智能体', text: '固定流水线由写死的规则指定下一棒；动态交接由前序智能体指名下一棒' },
      decWhat: { who: '仅最终产物 / 摘要', text: '通常只把上一棒的最终结构化产物塞进下一棒进口，避免无关思考过程污染上下文' },
      decStop: { who: '到达末棒 C 即停', text: '走完最后一棒（或某一步触发门禁阻断）即停止整条接力链' },
      related: ['unit_conn_info', 'unit_pat_handoff', 'unit_shape_roundtrip'],
      zones: [
        { x: 10, y: 40, w: 165, h: 195, title: '第一棒：一次问答(A)', sub: '上游产出', color: '#6366f1' },
        { x: 190, y: 40, w: 170, h: 195, title: '◆ 接缝 1：步间三决定', sub: '选 B · 塞产物 · 不停', color: '#f43f5e' },
        { x: 375, y: 40, w: 165, h: 195, title: '第二棒：一次问答(B)', sub: '中游加工', color: '#14b8a6' },
        { x: 555, y: 40, w: 335, h: 195, title: '◆ 接缝 2 ➔ 第三棒：一次问答(C)', sub: '转交末棒 C 产出终稿后停止', color: '#f97316' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 30, y: 85 },
        { id: 'u_seam_3dec', x: 206, y: 88 },
        { id: 'u_agent_b', x: 395, y: 85 },
        { id: 'u_center_ctrl', x: 572, y: 95 },
        { id: 'u_agent_c', x: 740, y: 85 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: 'A 停下交出产物', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '决定找 B + 塞入 A 产物', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#10b981', af: 'right', at: 'left' }],
        [2, 3, 'one', { seq: '③', label: 'B 停下交出产物', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [3, 4, 'one', { seq: '④', label: '决定找 C + 末棒跑完即停', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'bar', color: '#f97316', af: 'right', at: 'left' }]
      ],
      edu: '形状①「接力」是最基础的串行拓扑：每次问答之间过一次「◆ 步间 3 个决定（下一个是谁/给他什么/停不停）」。流水线、阶段门禁、角色交接链在形状上全都是接力。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="8" cy="18" r="4" stroke="#6366f1" stroke-width="2"/><circle cx="18" cy="18" r="4" stroke="#14b8a6" stroke-width="2"/><circle cx="28" cy="18" r="4" stroke="#f97316" stroke-width="2"/><path d="M12 18h2M22 18h2" stroke="#10b981" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_shape_fanout',
      unitCat: 'L4S',
      name: '4A-② 基本形状：分发（一拆多并行）',
      enName: '4A-2 Basic Shape: Fan-Out (1-to-N Parallel Dispatch)',
      sub: '第 4 级基本形状②：从一处同时对多个智能体发起「一次问答」，各自独立跑',
      enSub: 'Lv.4A Shape 2: Launch multiple parallel One Q&A sessions simultaneously from one point',
      color: '#38bdf8',
      badge: '第 4 级 A · 形状② 分发',
      formula: '② 分发 = 上游/中心 ──► [◆步间决定：拆成 N 份] ──► 并行发起 { 一次问答(A), 一次问答(B), 一次问答(C) }',
      channel: '可走甲路（中心按规则并发开会话）或乙路（主智能体一次发出多个并行子智能体工具调用）。',
      decNext: { who: '规则 或 拆解智能体', text: '同时选中 A、B、C 多个互不依赖的智能体会话并发启动（状态一：开会话）' },
      decWhat: { who: '切片子任务 或 同一问题', text: '任务分片时各给不同子切片；多视角采样/辩论时给所有人塞同一份问题' },
      decStop: { who: '等待全部或达到阈值停', text: '中心通过「观察状态」并行监听所有分支，全部停下（或满足抢答条件）后进入下一阶段' },
      related: ['unit_shape_reduce', 'unit_pat_supervisor', 'unit_pat_debate_judge'],
      zones: [
        { x: 15, y: 65, w: 365, h: 210, title: '🎛️ 中心拆解与分发门禁 (1-to-N Dispatch)', sub: '决定并发对象 A/B/C 与各自上下文切片', color: '#38bdf8' },
        { x: 405, y: 10, w: 215, h: 335, title: '⚡ 并行独立会话区 (Parallel Sessions)', sub: '三路同时 open()，上下文互不干扰', color: '#10b981' }
      ],
      nodes: [
        { id: 'u_center_ctrl', x: 35, y: 125 },
        { id: 'u_seam_3dec', x: 215, y: 118 },
        { id: 'u_agent_a', x: 445, y: 22 },
        { id: 'u_agent_b', x: 445, y: 132 },
        { id: 'u_agent_c', x: 445, y: 242 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '触发并行分发决策', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②a', label: '并发 open(A, 切片1)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 3, 'one', { seq: '②b', label: '并发 open(B, 切片2)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [1, 4, 'one', { seq: '②c', label: '并发 open(C, 切片3)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#f97316', af: 'right', at: 'left' }]
      ],
      edu: '形状②「分发」不要求智能体之间有任何新原语——它只是中心在同一时刻对 A、B、C 分别执行了「①开会话」，让三个单智能体在各自独立的上下文窗口里并行跑。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="8" cy="18" r="4" stroke="#38bdf8" stroke-width="2"/><circle cx="28" cy="9" r="3.5" stroke="#6366f1" stroke-width="2"/><circle cx="28" cy="18" r="3.5" stroke="#14b8a6" stroke-width="2"/><circle cx="28" cy="27" r="3.5" stroke="#f97316" stroke-width="2"/><path d="M12 16l12-6M12 18h12M12 20l12 6" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_shape_reduce',
      unitCat: 'L4S',
      name: '4A-③ 基本形状：汇总（多合一收口）',
      enName: '4A-3 Basic Shape: Fan-In / Reduce (N-to-1 Aggregation)',
      sub: '第 4 级基本形状③：中心读出多路问答的产出，合并塞进同一个汇总方进口',
      enSub: 'Lv.4A Shape 3: Read outputs from multiple Q&A branches & merge into one aggregator inlet',
      color: '#a855f7',
      badge: '第 4 级 A · 形状③ 汇总',
      formula: '③ 汇总 = 读回 { 产出(A), 产出(B) } ──► [◆步间决定：拼接/去重] ──► 塞入 C 的[进口：上下文]做一次问答',
      channel: '常与「② 分发」配对使用：多路分支各自停下后，由中心把多份产出打包塞给汇总智能体 C（或回到主智能体）。',
      decNext: { who: '规则（全齐后触发）', text: '当所有上游分支状态均为「已停下」时，指定汇总者/裁判 C 为下一个' },
      decWhat: { who: '多路最终产出拼接', text: '把 A、B 的最终答复按角色打标拼接（不含各自冗长工具过程）塞入 C 的进口' },
      decStop: { who: '汇总者 C 产出后停', text: '汇总者 C 输出最终合并结论或裁决结果后结束' },
      related: ['unit_shape_fanout', 'unit_pat_supervisor', 'unit_pat_debate_judge'],
      zones: [
        { x: 15, y: 15, w: 185, h: 295, title: '上游多路并行产出', sub: 'A 与 B 均已停下', color: '#6366f1' },
        { x: 215, y: 55, w: 345, h: 215, title: '🎛️ 中心多路读回与合并门禁 (Fan-In Reduce)', sub: '等待全齐 → read() 读出 → 拼接去重', color: '#a855f7' },
        { x: 575, y: 55, w: 185, h: 215, title: '🤖 汇总智能体 C', sub: '单进口接收多路合成材料', color: '#f97316' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 40, y: 38 },
        { id: 'u_agent_b', x: 40, y: 185 },
        { id: 'u_step_read', x: 235, y: 125 },
        { id: 'u_seam_3dec', x: 400, y: 110 },
        { id: 'u_agent_c', x: 600, y: 105 }
      ],
      edges: [
        [0, 2, 'one', { seq: '①a', label: 'read(产出 A)', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '①b', label: 'read(产出 B)', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 3, 'one', { seq: '②', label: '全齐后进入步间合并', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'circle', endMarker: 'classic', color: '#a855f7', af: 'right', at: 'left' }],
        [3, 4, 'one', { seq: '③', label: '合并 A+B 塞入 C 进口', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#f97316', af: 'right', at: 'left' }]
      ],
      edu: '形状③「汇总」揭示了为什么多路结果能合成一份：因为单智能体的「进口：上下文」天然可以塞入多段文本。中心只需把 A 和 B 的产出读出来拼在一起，塞进 C 的进口即可。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="8" cy="10" r="4" stroke="#6366f1" stroke-width="2"/><circle cx="8" cy="26" r="4" stroke="#14b8a6" stroke-width="2"/><circle cx="28" cy="18" r="4.5" stroke="#f97316" stroke-width="2"/><path d="M12 11l11 6M12 25l11-6" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_shape_roundtrip',
      unitCat: 'L4S',
      name: '4A-④ 基本形状：往返（A ⇄ B 多轮循环）',
      enName: '4A-4 Basic Shape: Round-Trip (A <-> B Multi-Turn Loop)',
      sub: '第 4 级基本形状④：A 的产出给 B、B 的产出再续回给 A，直到满足停止条件',
      enSub: 'Lv.4A Shape 4: A output feeds B, B output resumes A, looping until stop condition met',
      color: '#f59e0b',
      badge: '第 4 级 A · 形状④ 往返',
      formula: '④ 往返 = 一次问答(A) ──► 一次问答(B) ──► [◆步间决定：停不停？不停则 ①续会话(A)] ──► 循环',
      channel: '关键在于状态二「① 续会话（Resume）」：A 与 B 保留各自会话记忆，中心在两者之间来回传话，直到「停不停」判停。',
      decNext: { who: '规则（A 与 B 交替）', text: '只要未停，固定在 A 与 B 两个已开启的会话之间交替发起「续会话」' },
      decWhat: { who: '对方本轮新增回复', text: '因为双方会话都保留着历史记忆，每次只需把对方刚刚产出的新意见塞过去' },
      decStop: { who: 'B 判通过 / 达成共识 / 轮数上限', text: '「停不停」是往返形状的灵魂：由审查者打 PASS、双方对齐或规则达到最大轮数叫停' },
      related: ['unit_ask_resume', 'unit_pat_review_loop', 'unit_pat_pair_discuss'],
      zones: [
        { x: 20, y: 18, w: 600, h: 155, title: '🔄 正向交接链：智能体 A ──► 中心转交 ──► 智能体 B', sub: 'A 交草稿/观点 → 中心塞入 B', color: '#38bdf8' },
        { x: 20, y: 188, w: 600, h: 135, title: '⚖️ 逆向往返回路：◆ 步间判「停不停」 ──► 未停则 ① 续会话(A)', sub: '保留 A 原会话上下文记忆，追加 B 的反馈继续下一轮', color: '#f59e0b' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 45, y: 42 },
        { id: 'u_center_ctrl', x: 255, y: 52 },
        { id: 'u_agent_b', x: 465, y: 42 },
        { id: 'u_seam_3dec', x: 365, y: 202 },
        { id: 'u_step_resume', x: 145, y: 215 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: 'A 产出本轮结果', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '中心转交 B 审阅/回应', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 3, 'one', { seq: '③', label: 'B 交出反馈 → 判停不停?', sem: 'control', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#f43f5e', af: 'bottom', at: 'right' }],
        [3, 4, 'continuous', { seq: '④', label: '若未停 → 触发 resume(A)', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'diamond', endMarker: 'classic', color: '#f59e0b', af: 'left', at: 'right' }],
        [4, 0, 'continuous', { seq: '⑤', label: '带着记忆唤醒 A 改稿', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'none', endMarker: 'classic', color: '#10b981', af: 'left', at: 'bottom' }]
      ],
      edu: '形状④「往返」和形状①「接力」的唯一区别，就是在步间决定「停不停」选了「继续」时，下一棒指回已经开启过的 A（走状态二：续会话）。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="10" cy="18" r="4.5" stroke="#6366f1" stroke-width="2"/><circle cx="26" cy="18" r="4.5" stroke="#14b8a6" stroke-width="2"/><path d="M14 14h8M22 22h-8" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>'
    }
  ];

  function innerSvg24(svgStr) {
    var inner = String(svgStr || '').replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
    return '<g transform="scale(0.6667)">' + inner + '</g>';
  }

  window._registerCollabUnits = function(list) {
    list.forEach(function(u) {
      if (window.UNIT_IDS.indexOf(u.id) === -1) window.UNIT_IDS.push(u.id);
      PR[u.id] = u.nodes.map(function(n) {
        return { d: n.id, x: n.x, y: n.y, m: n.m || 'sonnet' };
      });
      PC[u.id] = u.edges.map(function(e) {
        var tp = e[2] === 'bi' || e[2] === 'two' ? 'two' : (e[2] === 'loop' || e[2] === 'continuous' ? 'continuous' : 'one');
        return [e[0], e[1], tp, e[3] || null];
      });
      var prosList = [
        '✓ 推演公式：' + u.formula,
        '✓ 下一个是谁：' + u.decNext.who + '（' + u.decNext.text + '）',
        '✓ 给他什么：' + u.decWhat.who + '（' + u.decWhat.text + '）'
      ];
      var consList = [
        '⚖ 停不停：' + u.decStop.who + '（' + u.decStop.text + '）'
      ];
      PM[u.id] = {
        n: u.name,
        i: '🧩',
        c: u.nodes.length,
        dsc: u.sub,
        use: u.channel,
        p: prosList,
        m: consList,
        t: '~20-60K',
        $: '$0.05-0.18',
        pt: u.badge,
        color: u.color,
        isUnit: true,
        unitCoords: true,
        unitCat: u.unitCat
      };
      window.UNIT_META[u.id] = u;
      if (typeof PRESET_SVG !== 'undefined') PRESET_SVG[u.id] = innerSvg24(u.svg);
      if (typeof PRESET_COLORS_DARK !== 'undefined') PRESET_COLORS_DARK[u.id] = u.color;
      if (typeof PRESET_COLORS_LIGHT !== 'undefined') PRESET_COLORS_LIGHT[u.id] = u.color;
      if (typeof PRESET_PT_ZH !== 'undefined') PRESET_PT_ZH[u.badge] = u.badge;
      if (typeof I18N_EN !== 'undefined') {
        if (I18N_EN.presetNames) I18N_EN.presetNames[u.id] = u.name;
        if (I18N_EN.presetDescs) I18N_EN.presetDescs[u.id] = u.sub;
        if (I18N_EN.presetMid) I18N_EN.presetMid[u.id] = u.edu;
        if (I18N_EN.presetGreen) I18N_EN.presetGreen[u.id] = prosList;
        if (I18N_EN.presetRed) I18N_EN.presetRed[u.id] = consList;
      }
    });
  };

  window._registerCollabUnits(UNITS_PART_A);
})();

// ═══════════════════════════════════════════════════════════════════════════
// PART 2B: COLLABORATION UNITS (Shape 5 + 7 Assembled Collaboration Patterns)
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  if (typeof window._registerCollabUnits !== 'function') return;

  var UNITS_PART_B = [
    {
      id: 'unit_shape_shared',
      unitCat: 'L4S',
      name: '4A-⑤ 基本形状：共享区（黑板 / 任务池）',
      enName: '4A-5 Basic Shape: Shared Store (Blackboard / Task Pool)',
      sub: '第 4 级基本形状⑤：不直接给对方塞话，而是各自通过工具读写同一块外部空间',
      enSub: 'Lv.4A Shape 5: Read/write a common external store via tools instead of direct passing',
      color: '#ec4899',
      badge: '第 4 级 A · 形状⑤ 共享区',
      formula: '⑤ 共享区 = 智能体 A/B/C [出口①：读写工具] <═══> 共享读写区（黑板 / 任务池 / 仓库）',
      channel: '乙路的特例：出口①接的不是另一个智能体，而是一块共享外部空间（文件、看板、任务队列）。',
      decNext: { who: '共享区状态 / 自主认领', text: '谁看到共享区里出现自己能处理的条目，或者轮到谁扫描共享区，谁就执行' },
      decWhat: { who: '按需拉取（Pull）', text: '不再由中心硬塞全量上下文，而是智能体自己调 read_store 工具按需读取所需片段' },
      decStop: { who: '目标条目全部完成', text: '共享任务池清零，或黑板上的目标产物槽位全部填满并通过校验' },
      related: ['unit_conn_channel', 'unit_pat_blackboard', 'unit_pat_task_pool'],
      zones: [
        { x: 18, y: 16, w: 340, h: 315, title: '🤖 并发协作者层 + 🔧 各自挂载读写工具 (Outlet ①)', sub: '不直接互相点名，全部通过 read_store / write_store 工具访问', color: '#38bdf8' },
        { x: 380, y: 40, w: 355, h: 265, title: '🗄️ 外部持久化共享空间 (Shared Store / Blackboard)', sub: '状态槽位：任务队列 · 共享黑板 · 代码树 · 锁状态', color: '#ec4899' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 35, y: 30 },
        { id: 'u_agent_b', x: 35, y: 190 },
        { id: 'u_port_tool', x: 205, y: 120 },
        { id: 'u_shared_board', x: 425, y: 105 },
        { id: 'u_agent_c', x: 605, y: 105 }
      ],
      edges: [
        [0, 2, 'one', { seq: '①a', label: 'A 调 write_store()', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '①b', label: 'B 调 read/write()', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 3, 'two', { seq: '②', label: '原子读写共享槽位', sem: 'store', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'diamond_open', endMarker: 'diamond', color: '#ec4899', af: 'right', at: 'left' }],
        [4, 3, 'two', { seq: '③', label: 'C 订阅/认领共享区', sem: 'store', algo: 'ortho', weight: 'double', dash: 'dashed', startMarker: 'classic', endMarker: 'diamond', color: '#f97316', af: 'left', at: 'right' }]
      ],
      edu: '形状⑤「共享区」跳出了「你传给我、我传给你」的点对点传话，把协作变成「所有人围着一块黑板或任务池各自读写」，彻底解耦了智能体之间的直接依赖。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="11" y="5" width="14" height="10" rx="2" stroke="#ec4899" stroke-width="2"/><circle cx="8" cy="28" r="4" stroke="#6366f1" stroke-width="1.8"/><circle cx="18" cy="29" r="4" stroke="#14b8a6" stroke-width="1.8"/><circle cx="28" cy="28" r="4" stroke="#f97316" stroke-width="1.8"/><path d="M9 24l5-8M18 25v-9M27 24l-5-8" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_pat_review_loop',
      unitCat: 'L4P',
      name: '4B-1 生成—审查循环（Writer ⇄ Reviewer）',
      enName: '4B-1 Generator-Reviewer Loop (Writer <-> Reviewer)',
      sub: '组合拼法 = ① 接力 + ④ 往返｜A 先写初稿交 B 审查，不通过则带评审意见续回 A 重修',
      enSub: 'Pattern = Relay + Round-Trip | A drafts, B critiques, loops via Resume until approved',
      color: '#10b981',
      badge: '第 4 级 B · 拼法① 生成审查',
      formula: '生成—审查 = ①接力(A写初稿 → B审阅) + ④往返(若 REJECT 则 ①续会话(A) 返工，PASS 则停)',
      channel: '通常走甲路（中心在 Writer 与 Reviewer 之间传话），也可让 Writer 主动调 ask_reviewer 工具自检。',
      decNext: { who: '规则（A 写 → B 审 → A 改）', text: '初稿完成后必交 B；B 若打回则必续回 A；B 若通过则直接结束输出' },
      decWhat: { who: '初稿全文 / 结构化修改意见', text: 'A 给 B 的是本轮最新产物；B 给 A 的是具体缺陷清单与修改指令' },
      decStop: { who: '审查者 B（给出 PASS 判定）或最大轮数', text: '由 Reviewer 的结构化判定字段（如 verdict=PASS）或重试上限决定何时跳出循环' },
      related: ['unit_shape_relay', 'unit_shape_roundtrip', 'unit_ask_resume'],
      zones: [
        { x: 18, y: 18, w: 730, h: 155, title: '✍️ 阶段 1：正向生成与审查接力 (① 接力 Shape)', sub: '起草者 A 产出代码/方案 → 审查者 B 逐项核对质量标准 → 步间 3 决定门禁', color: '#10b981' },
        { x: 18, y: 188, w: 540, h: 135, title: '🔁 阶段 2：打回返工回路 (④ 往返 Shape + 状态二：续会话)', sub: '当 Verdict = REJECT 时，带着 B 的批注唤醒 A 的原会话继续修改', color: '#f59e0b' },
        { x: 572, y: 188, w: 176, h: 135, title: '🏁 阶段 3：定稿放行', sub: 'Verdict = PASS 跳出循环', color: '#38bdf8' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 40, y: 38 },
        { id: 'u_agent_b', x: 300, y: 38 },
        { id: 'u_seam_3dec', x: 565, y: 32 },
        { id: 'u_step_resume', x: 255, y: 215 },
        { id: 'u_port_out', x: 585, y: 218 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '提交初稿 / 修订稿', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: '输出审查报告 + Verdict', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 3, 'continuous', { seq: '③a', label: 'REJECT: 触发续会话返工', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'diamond', endMarker: 'classic', color: '#f59e0b', af: 'bottom', at: 'right' }],
        [3, 0, 'continuous', { seq: '③b', label: 'resume(A, 审查批注)', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'none', endMarker: 'classic', color: '#f59e0b', af: 'left', at: 'bottom' }],
        [2, 4, 'one', { seq: '④', label: 'PASS: 放行最终定稿', sem: 'control', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'bar', endMarker: 'classic', color: '#10b981', af: 'bottom', at: 'top' }]
      ],
      edu: '这是工程里最常见也最有效的组合：把「写」和「挑刺」拆到两个独立智能体会话里，避免同一个上下文自己审自己时的思维盲区。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="4" y="11" width="10" height="14" rx="2" stroke="#6366f1" stroke-width="2"/><rect x="22" y="11" width="10" height="14" rx="2" stroke="#10b981" stroke-width="2"/><path d="M14 15h8M22 21h-8" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_pat_pair_discuss',
      unitCat: 'L4P',
      name: '4B-2 双人多轮对谈（对等协商 / CAMEL Role-Playing）',
      enName: '4B-2 Pair Multi-Turn Dialogue (Peer Negotiation / CAMEL)',
      sub: '组合拼法 = ④ 往返｜两个对等角色保持各自会话记忆，围绕同一议题多轮碰撞直至收敛',
      enSub: 'Pattern = Round-Trip | Two peer sessions converse back-and-forth until consensus',
      color: '#6366f1',
      badge: '第 4 级 B · 拼法② 双人对谈',
      formula: '双人对谈 = ④往返(智能体 A 角色会话 ⇄ 中心传话/步间判停 ⇄ 智能体 B 角色会话)',
      channel: '甲路（上下文塞入）结合状态二（续会话）：双方各自拥有独立的上下文历史，只看得到对方说出的话，看不到对方内部推理。',
      decNext: { who: '规则（A 与 B 严格轮流发言）', text: '像下棋一样，A 说完必轮到 B，B 说完必轮到 A' },
      decWhat: { who: '对方上一轮发言正文', text: '把 A 的出口②作为 B 续会话的新输入，反之亦然' },
      decStop: { who: '约定结束标记（如 <TASK_DONE>）或轮数上限', text: '当任意一方输出达成共识的结束符，或中心检测到对话收敛/达到最大轮数时停止' },
      related: ['unit_shape_roundtrip', 'unit_ask_resume', 'unit_conn_info'],
      zones: [
        { x: 18, y: 20, w: 215, h: 295, title: '🗣️ 角色会话 A (Proposer)', sub: '独立记忆 Session A · 提出方案与追问', color: '#6366f1' },
        { x: 250, y: 20, w: 250, h: 295, title: '🔄 双人往返传话与共识检测器', sub: '交替 ①续会话 + 检测 <TASK_DONE>', color: '#f59e0b' },
        { x: 518, y: 20, w: 215, h: 295, title: '🗣️ 角色会话 B (Partner)', sub: '独立记忆 Session B · 响应执行与补充', color: '#14b8a6' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 50, y: 105 },
        { id: 'u_step_resume', x: 300, y: 45 },
        { id: 'u_seam_3dec', x: 306, y: 175 },
        { id: 'u_agent_b', x: 550, y: 105 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: 'A 发言 (出站话语)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 3, 'one', { seq: '②', label: 'resume(B, A 的话)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'top' }],
        [3, 2, 'one', { seq: '③', label: 'B 回应 → 检查是否达成共识', sem: 'control', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#f59e0b', af: 'left', at: 'right' }],
        [2, 0, 'continuous', { seq: '④', label: '未结束 → resume(A, B 的话)', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'diamond', endMarker: 'classic', color: '#ec4899', af: 'left', at: 'bottom' }]
      ],
      edu: '与「生成—审查」不同，双人对谈中的 A 和 B 是对等互补角色（例如产品经理与架构师），通过多轮问答逐步澄清模糊需求。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="10" cy="18" r="5" stroke="#6366f1" stroke-width="2"/><circle cx="26" cy="18" r="5" stroke="#14b8a6" stroke-width="2"/><path d="M15 14c3-3 3-3 6 0M21 22c-3 3-3 3-6 0" stroke="#ec4899" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_pat_supervisor',
      unitCat: 'L4P',
      name: '4B-3 主管派工与汇总（Supervisor / Orchestrator-Workers）',
      enName: '4B-3 Supervisor Dispatch & Synthesis (Orchestrator-Workers)',
      sub: '组合拼法 = ② 分叉 + ③ 汇总 + ④ 往返｜主管智能体把大任务拆给多个下属并行做，再收回合成',
      enSub: 'Pattern = Fan-Out + Reduce + Round-Trip | Supervisor delegates to workers via tools and synthesizes',
      color: '#a855f7',
      badge: '第 4 级 B · 拼法③ 主管派工',
      formula: '主管派工 = 主管 A [出口①：调工具] ──► ②分叉(B, C 并行) ──► ③汇总(回填 A 进口) ──► ④往返或收尾',
      channel: '典型走乙路（能力渠道）：把下属 B、C 封装成主管 A 手里的 Subagent 工具；主管 A 自己决定何时调谁、传什么参数、拿回结果后是否还要补调。',
      decNext: { who: '主管智能体 A（动态规划）', text: '不写死固定流程，由主管 A 根据任务复杂度动态决定派给哪几个 Worker' },
      decWhat: { who: '主管 A 生成的子任务专属指令', text: '主管 A 为每个下属裁剪出最小必要的子任务描述（隔离全局噪音）' },
      decStop: { who: '主管智能体 A（判断拼图已齐）', text: '下属结果作为工具返回值回到 A 的进口后，由 A 判断是否足以向用户交卷' },
      related: ['unit_conn_channel', 'unit_shape_fanout', 'unit_shape_reduce'],
      zones: [
        { x: 18, y: 18, w: 385, h: 315, title: '👑 主管控制层 (Supervisor A + Subagent 派工总线)', sub: '主管 A 负责拆解任务、通过出口①双轨派发子任务、回收结果并决定是否结案', color: '#a855f7' },
        { x: 422, y: 18, w: 325, h: 315, title: '👷 专职下属执行池 (Isolated Worker Sessions)', sub: '各自独立短会话 · 只看得到子任务最小上下文', color: '#38bdf8' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 38, y: 48 },
        { id: 'u_port_tool', x: 225, y: 48 },
        { id: 'u_agent_b', x: 465, y: 35 },
        { id: 'u_agent_c', x: 465, y: 190 },
        { id: 'u_seam_3dec', x: 230, y: 182 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '拆解并发起 tool_call', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#a855f7', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②a', label: 'spawn_worker(B, 子任务1)', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#38bdf8', af: 'right', at: 'left' }],
        [1, 3, 'one', { seq: '②b', label: 'spawn_worker(C, 子任务2)', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 4, 'one', { seq: '③a', label: 'Worker B 结果返回', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'none', endMarker: 'classic', color: '#38bdf8', af: 'left', at: 'right' }],
        [3, 4, 'one', { seq: '③b', label: 'Worker C 结果返回', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'left', at: 'right' }],
        [4, 0, 'continuous', { seq: '④', label: '汇总回填 A 进口 (判停或追派)', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#f59e0b', af: 'left', at: 'bottom' }]
      ],
      edu: '这就是 Claude Code `Task` 子智能体、LangGraph Supervisor 的标准骨架：主管握着方向盘，下属作为工具被按需召唤、用完即收。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="8" r="4.5" stroke="#a855f7" stroke-width="2"/><circle cx="8" cy="27" r="4" stroke="#6366f1" stroke-width="1.8"/><circle cx="28" cy="27" r="4" stroke="#14b8a6" stroke-width="1.8"/><path d="M15 12l-6 11M21 12l6 11" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_pat_handoff',
      unitCat: 'L4P',
      name: '4B-4 角色交接棒（Handoff / Swarm 接力路由）',
      enName: '4B-4 Dynamic Role Handoff (Swarm / Triage Routing)',
      sub: '组合拼法 = ① 接力（动态选路）｜当前智能体判断不归自己管时，直接调交接工具把控制权移交给专职智能体',
      enSub: 'Pattern = Dynamic Relay | Current agent invokes handoff_to_X tool to transfer active control',
      color: '#f97316',
      badge: '第 4 级 B · 拼法④ 交接棒',
      formula: '交接棒 = 智能体 A [出口①：调 transfer_to_B()] ──► 步间决定：当前主控切换为 B ──► 智能体 B 接管会话',
      channel: '乙路触发甲路切换：A 调用的不是「让 B 干完活向我汇报」，而是「把话筒彻底交给 B（Handoff）」，后续直接由 B 面向任务。',
      decNext: { who: '当前持棒智能体 A', text: '由 A 通过调用 transfer_to_B 或 transfer_to_C 工具，自己点名下一棒接管者' },
      decWhat: { who: '交接摘要 + 会话上下文', text: '把前序对话状态与交接原因（handoff context）一并塞给接棒的专职智能体' },
      decStop: { who: '接棒后的专职智能体 B/C', text: '当接棒者直接解决了问题（走出口②回复）且不再触发新的 transfer 工具时停止' },
      related: ['unit_shape_relay', 'unit_conn_channel', 'unit_l1_ports'],
      zones: [
        { x: 18, y: 20, w: 345, h: 295, title: '🎯 第一棒：分诊/前台智能体 A', sub: '识别意图 → 调用 transfer_to_X() 交出话筒控制权', color: '#6366f1' },
        { x: 380, y: 20, w: 370, h: 295, title: '🏃 第二棒：动态路由交接门禁与专职接管者 (B / C)', sub: '主控权彻底转移，后续无需再绕回 A 汇报', color: '#f97316' }
      ],
      nodes: [
        { id: 'u_agent_a', x: 35, y: 105 },
        { id: 'u_port_tool', x: 195, y: 125 },
        { id: 'u_seam_3dec', x: 395, y: 98 },
        { id: 'u_agent_b', x: 590, y: 38 },
        { id: 'u_agent_c', x: 590, y: 185 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①', label: '识别领域 → 调交接工具', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'left' }],
        [1, 2, 'one', { seq: '②', label: 'transfer_to_B / C()', sem: 'control', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'bar', endMarker: 'classic', color: '#f97316', af: 'right', at: 'left' }],
        [2, 3, 'one', { seq: '③a', label: '若选 B：移交控制权与上下文', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }],
        [2, 4, 'one', { seq: '③b', label: '若选 C：移交控制权与上下文', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'dashed', startMarker: 'diamond_open', endMarker: 'open', color: '#f97316', af: 'right', at: 'left' }]
      ],
      edu: '注意「主管派工（拼法③）」与「交接棒（拼法④）」的核心区别：主管派工是「借用下属干活，完事必须回禀主管」；交接棒是「我把话筒递给你，接下来你全权负责」。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="8" cy="18" r="4.5" stroke="#6366f1" stroke-width="2"/><path d="M13 18h7l6-8M20 18l6 8" stroke="#f97316" stroke-width="2" stroke-linecap="round"/><circle cx="29" cy="9" r="3.5" stroke="#14b8a6" stroke-width="1.8"/><circle cx="29" cy="27" r="3.5" stroke="#f97316" stroke-width="1.8"/></svg>'
    },
    {
      id: 'unit_pat_debate_judge',
      unitCat: 'L4P',
      name: '4B-5 多路辩论 + 裁判（Debate & Judge / 合议庭）',
      enName: '4B-5 Multi-Agent Debate + Judge (Ensemble / Courtroom)',
      sub: '组合拼法 = ② 分叉 + ④ 往返 + ③ 汇总｜多方独立立论并交叉反驳，最终交由裁判智能体一锤定音',
      enSub: 'Pattern = Fan-Out + Round-Trip + Reduce | Parallel debaters cross-examine, Judge synthesizes verdict',
      color: '#ef4444',
      badge: '第 4 级 B · 拼法⑤ 辩论裁判',
      formula: '辩论+裁判 = ②分叉(正方 A / 反方 B 独立立论) ──► ④往返(互看对方论据反驳) ──► ③汇总(裁判 C 裁决)',
      channel: '甲路（上下文塞入）：第 1 轮分叉隔离以防从众偏见；第 2 轮把对方立论塞进彼此会话做交叉质询；最后全量汇总塞进裁判 C。',
      decNext: { who: '规则（并行立论 → 交叉反驳 → 裁判收尾）', text: '严格按合议庭阶段推进：先背靠背独立立论，再面对面交锋，最后交裁判' },
      decWhat: { who: '同题独立视角 → 对方反驳论据 → 正反全卷宗', text: '不同阶段塞入不同颗粒度的材料，最后给裁判 C 的是完整的正反辩词对照表' },
      decStop: { who: '固定辩论轮数（如 2 轮）+ 裁判 C 给出终审裁决', text: '辩论轮次到达设定值后强制进入汇总阶段，由裁判 C 输出最终裁定后停止' },
      related: ['unit_shape_fanout', 'unit_shape_roundtrip', 'unit_shape_reduce'],
      zones: [
        { x: 18, y: 18, w: 195, h: 300, title: '🔀 阶段 1：② 分叉', sub: '中心同题盲派 · 防止先入为主', color: '#06b6d4' },
        { x: 228, y: 18, w: 335, h: 300, title: '⚔️ 阶段 2：正反独立立论 + ④ 往返交叉质询', sub: '正方 A 与反方 B 互换论据、多轮攻防辩驳', color: '#f59e0b' },
        { x: 578, y: 18, w: 195, h: 300, title: '⚖️ 阶段 3：③ 汇总终审裁决', sub: '收拢双边全卷宗 → 裁判 C 裁定', color: '#ef4444' }
      ],
      nodes: [
        { id: 'u_center_ctrl', x: 35, y: 120 },
        { id: 'u_agent_a', x: 250, y: 35 },
        { id: 'u_agent_b', x: 250, y: 185 },
        { id: 'u_seam_3dec', x: 415, y: 98 },
        { id: 'u_agent_c', x: 615, y: 105 }
      ],
      edges: [
        [0, 1, 'one', { seq: '①a', label: '派发议题 (正方视角)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#06b6d4', af: 'right', at: 'left' }],
        [0, 2, 'one', { seq: '①b', label: '派发议题 (反方视角)', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'circle', endMarker: 'classic', color: '#06b6d4', af: 'right', at: 'left' }],
        [1, 2, 'two', { seq: '②', label: '交叉互换立论与反驳', sem: 'loop', algo: 'arc', weight: 'bold', dash: 'dashed', startMarker: 'classic', endMarker: 'classic', color: '#f59e0b', af: 'bottom', at: 'top' }],
        [1, 3, 'one', { seq: '③a', label: '提交正方辩词卷宗', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'top' }],
        [2, 3, 'one', { seq: '③b', label: '提交反方辩词卷宗', sem: 'context', algo: 'ortho', weight: 'normal', dash: 'solid', startMarker: 'none', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'bottom' }],
        [3, 4, 'one', { seq: '④', label: '合并正反辩词交裁判 C', sem: 'context', algo: 'ortho', weight: 'bold', dash: 'solid', startMarker: 'diamond', endMarker: 'classic', color: '#ef4444', af: 'right', at: 'left' }]
      ],
      edu: '当单个模型容易产生幻觉或片面判断时，「分叉盲审 + 往返辩论 + 汇总裁决」能用结构化的对抗把隐含漏洞逼出来。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><circle cx="9" cy="9" r="4" stroke="#6366f1" stroke-width="2"/><circle cx="9" cy="27" r="4" stroke="#14b8a6" stroke-width="2"/><path d="M9 13v10" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2 2"/><circle cx="28" cy="18" r="5" stroke="#ef4444" stroke-width="2"/><path d="M13 10l10 6M13 26l10-6" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'unit_pat_blackboard',
      unitCat: 'L4P',
      name: '4B-6 共享黑板协同（Blackboard 增量拼图）',
      enName: '4B-6 Shared Blackboard Collaboration (Incremental Blackboard)',
      sub: '组合拼法 = ⑤ 共享区 + ④ 往返｜多个专长智能体围着同一块结构化黑板读写，逐步把半成品拼成完整方案',
      enSub: 'Pattern = Shared Store + Round-Trip | Specialists incrementally read/write a shared blackboard',
      color: '#ec4899',
      badge: '第 4 级 B · 拼法⑥ 共享黑板',
      formula: '共享黑板 = ⑤共享区(结构化黑板状态) + ④往返(中心观察黑板变化 → 唤醒下一个专长智能体补充)',
      channel: '乙路读写共享区 + 甲路按需唤醒：智能体不互相发长消息，所有阶段性结论都写回黑板的指定区域（Slot）。',
      decNext: { who: '黑板触发器 / 调度规则', text: '看黑板上哪一格刚被填上、哪一格还缺依赖，就唤醒对应的专长智能体' },
      decWhat: { who: '黑板当前快照索引', text: '智能体自己通过工具读取黑板上与自己相关的槽位，避免全量上下文爆炸' },
      decStop: { who: '黑板目标槽位全部就绪且无冲突', text: '当黑板上的最终目标字段被填满并通过一致性检查时停止' },
      related: ['unit_shape_shared', 'unit_shape_roundtrip', 'unit_conn_channel'],
      zones: [
        { x: 18, y: 18, w: 465, h: 315, title: '🗄️ 核心状态层：⑤ 结构化共享黑板 (Blackboard Slots)', sub: '所有专家围着同一块黑板读写 · 触发器监听槽位变更并决定下一轮唤醒谁', color: '#ec4899' },
        { x: 500, y: 18, w: 245, h: 315, title: '🧠 专长智能体池 (Specialists)', sub: '按需拉取黑板片段 · 增量写回新结论', color: '#6366f1' }
      ],
      nodes: [
        { id: 'u_shared_board', x: 40, y: 45 },
        { id: 'u_port_tool', x: 265, y: 55 },
        { id: 'u_seam_3dec', x: 260, y: 180 },
        { id: 'u_agent_a', x: 545, y: 35 },
        { id: 'u_agent_b', x: 545, y: 185 }
      ],
      edges: [
        [3, 1, 'two', { seq: '①a', label: '专家 A 读写黑板槽位', sem: 'store', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'classic', endMarker: 'classic', color: '#6366f1', af: 'left', at: 'right' }],
        [4, 1, 'two', { seq: '①b', label: '专家 B 读写黑板槽位', sem: 'store', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'classic', endMarker: 'classic', color: '#14b8a6', af: 'left', at: 'right' }],
        [1, 0, 'two', { seq: '②', label: '更新黑板 Slot 1..N', sem: 'store', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'diamond_open', endMarker: 'diamond', color: '#ec4899', af: 'left', at: 'right' }],
        [0, 2, 'one', { seq: '③', label: '监听黑板缺口与冲突', sem: 'observe', algo: 'ortho', weight: 'normal', dash: 'dotted', startMarker: 'circle', endMarker: 'open', color: '#f59e0b', af: 'bottom', at: 'left' }],
        [2, 3, 'continuous', { seq: '④a', label: '缺架构槽 → 唤醒 A', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'diamond', endMarker: 'classic', color: '#6366f1', af: 'right', at: 'bottom' }],
        [2, 4, 'continuous', { seq: '④b', label: '缺验证槽 → 唤醒 B', sem: 'loop', algo: 'ortho', weight: 'bold', dash: 'dashed', startMarker: 'diamond', endMarker: 'classic', color: '#14b8a6', af: 'right', at: 'left' }]
      ],
      edu: '当协作人数超过 3 个、且产物是复杂工程（如架构图+代码+测试报告）时，共享黑板比点对点传话省下大量重复搬运上下文的开销。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="12" width="24" height="12" rx="2" stroke="#ec4899" stroke-width="2"/><circle cx="12" cy="6" r="3" stroke="#6366f1" stroke-width="1.8"/><circle cx="24" cy="6" r="3" stroke="#14b8a6" stroke-width="1.8"/><circle cx="18" cy="30" r="3" stroke="#f97316" stroke-width="1.8"/></svg>'
    },
    {
      id: 'unit_pat_task_pool',
      unitCat: 'L4P',
      name: '4B-7 共享任务池自领（Task Queue / 自组织抢单）',
      enName: '4B-7 Autonomous Shared Task Pool (Self-Claiming Queue)',
      sub: '组合拼法 = ⑤ 共享区 + ② 分叉｜待办任务挂在共享看板上，多个空闲智能体自主认领、更新状态并解锁后续任务',
      enSub: 'Pattern = Shared Store + Fan-Out | Idle workers autonomously claim unlocked tasks from shared queue',
      color: '#14b8a6',
      badge: '第 4 级 B · 拼法⑦ 任务池自领',
      formula: '任务池自领 = ⑤共享任务队列(带依赖锁) + ②多智能体并行(调 claim_task 抢单 → 完成后 complete_task 解锁下游)',
      channel: '乙路读写共享任务池：无需主管逐个点名派活，每个 Worker 循环调用 `claim_next_task()` 原子认领可用任务。',
      decNext: { who: '空闲智能体自主抢单（Pull 模式）', text: '谁先干完手头活、谁处于空闲状态，谁就去共享任务池认领下一个已解锁任务' },
      decWhat: { who: '被认领任务卡 + 前置产出引用', text: '从任务卡里读取该任务的验收标准及前置依赖任务留下的产物路径' },
      decStop: { who: '共享任务池所有任务状态均为 COMPLETED', text: '当队列中不再有待办（PENDING/IN_PROGRESS）任务时，全体 Worker 自然退出' },
      related: ['unit_shape_shared', 'unit_shape_fanout', 'unit_pat_supervisor'],
      zones: [
        { x: 18, y: 18, w: 365, h: 300, title: '📋 共享任务队列与原子锁网关 (Shared Task Pool)', sub: '维护 Task #1..#N 状态 (PENDING / LOCKED / DONE) 与依赖图', color: '#14b8a6' },
        { x: 400, y: 18, w: 355, h: 300, title: '⚡ 自治工作者集群 (Autonomous Pull Workers)', sub: '谁空闲谁调 claim_task() 抢单 · 干完写回并解锁下游任务', color: '#38bdf8' }
      ],
      nodes: [
        { id: 'u_shared_board', x: 32, y: 105 },
        { id: 'u_port_tool', x: 215, y: 118 },
        { id: 'u_agent_a', x: 435, y: 35 },
        { id: 'u_agent_b', x: 435, y: 185 },
        { id: 'u_agent_c', x: 610, y: 108 }
      ],
      edges: [
        [0, 1, 'two', { seq: '①', label: '原子锁认领 & 状态更新', sem: 'store', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'diamond_open', endMarker: 'diamond', color: '#ec4899', af: 'right', at: 'left' }],
        [2, 1, 'two', { seq: '②a', label: 'Worker A claim / complete', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'classic', endMarker: 'classic', color: '#6366f1', af: 'left', at: 'right' }],
        [3, 1, 'two', { seq: '②b', label: 'Worker B claim / complete', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'solid', startMarker: 'classic', endMarker: 'classic', color: '#14b8a6', af: 'left', at: 'right' }],
        [4, 1, 'two', { seq: '②c', label: 'Worker C 抢单解锁后继任务', sem: 'tool', algo: 'ortho', weight: 'double', dash: 'dashed', startMarker: 'classic', endMarker: 'classic', color: '#f97316', af: 'left', at: 'right' }]
      ],
      edu: '对比「主管派工（Push 模式）」与「任务池自领（Pull 模式）」：当子任务数量很多且长短不一时，共享任务池自领能避免主管成为串行瓶颈。',
      svg: '<svg viewBox="0 0 36 36" fill="none"><rect x="4" y="8" width="12" height="20" rx="2" stroke="#14b8a6" stroke-width="2"/><path d="M7 13h6M7 18h6M7 23h4" stroke="#14b8a6" stroke-width="1.6" stroke-linecap="round"/><circle cx="28" cy="10" r="3.5" stroke="#6366f1" stroke-width="1.8"/><circle cx="28" cy="18" r="3.5" stroke="#f97316" stroke-width="1.8"/><circle cx="28" cy="26" r="3.5" stroke="#ec4899" stroke-width="1.8"/><path d="M16 13l8-2M16 18h8M16 23l8 2" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/></svg>'
    }
  ];

  window._registerCollabUnits(UNITS_PART_B);
})();

// ═══════════════════════════════════════════════════════════════════════════
// PART 3A: ARCHETYPE-DISTINCT NODE RENDERER (rWez) + SWIMLANE ZONES (rZones)
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  if (typeof window === 'undefined') return;

  // Dimensions by nodeKind matching the CSS overrides on .nd.kind-* .nd-body
  window.NODE_KIND_DIMS = {
    agent:     { w: 120, h: 122 },
    port:      { w: 148, h: 74 },
    tool:      { w: 150, h: 80 },
    decision:  { w: 136, h: 136 },
    control:   { w: 152, h: 90 },
    primitive: { w: 148, h: 78 },
    store:     { w: 156, h: 102 },
    default:   { w: 112, h: 116 }
  };

  window.getNodeKind = function(defId) {
    var meta = window.UNIT_NODE_META && window.UNIT_NODE_META[defId];
    if (meta && meta.nodeKind) return meta.nodeKind;
    var d = (typeof AD_MAP !== 'undefined') ? AD_MAP.get(defId) : null;
    if (d && d.nodeKind) return d.nodeKind;
    return 'default';
  };

  window.getNodeDims = function(nd) {
    if (!nd) return window.NODE_KIND_DIMS.default;
    var k = window.getNodeKind(nd.defId);
    return window.NODE_KIND_DIMS[k] || window.NODE_KIND_DIMS.default;
  };

  // Render structural swimlane / subgraph zones behind nodes
  window.rZones = function() {
    if (typeof cvT === 'undefined' || !cvT) return;
    var zWrap = document.getElementById('cvZones');
    if (!zWrap) {
      zWrap = document.createElement('div');
      zWrap.id = 'cvZones';
      zWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';
      cvT.insertBefore(zWrap, cvT.firstChild);
    }
    var u = (typeof actPr !== 'undefined' && actPr && window.UNIT_META) ? window.UNIT_META[actPr] : null;
    if (!u || !Array.isArray(u.zones) || !u.zones.length || !nodes.length) {
      zWrap.innerHTML = '';
      return;
    }
    var pr = (typeof PR !== 'undefined' && PR[actPr]) ? PR[actPr] : null;
    var offX = (pr && pr[0] && nodes[0]) ? (nodes[0].x - pr[0].x) : 0;
    var offY = (pr && pr[0] && nodes[0]) ? (nodes[0].y - pr[0].y) : 0;

    var html = '';
    u.zones.forEach(function(z) {
      var zx = Math.round(z.x + offX);
      var zy = Math.round(z.y + offY);
      var zc = z.color || '#38bdf8';
      html += '<div class="cv-zone" style="transform:translate(' + zx + 'px,' + zy + 'px);width:' + z.w + 'px;height:' + z.h + 'px;--zc:' + zc + '">' +
        '<div class="cv-zone-hdr">' +
          '<span class="cv-zone-dot" style="background:' + zc + '"></span>' +
          '<span class="cv-zone-title">' + escHtml(z.title || '') + '</span>' +
        '</div>' +
        (z.sub ? '<div class="cv-zone-sub">' + escHtml(z.sub) + '</div>' : '') +
      '</div>';
    });
    zWrap.innerHTML = html;
  };

  // Sync edge metadata from PC[actPr] onto conns items
  window.syncUnitConnsMeta = function() {
    if (typeof actPr === 'undefined' || !actPr || typeof PC === 'undefined' || !PC[actPr]) return;
    var pcList = PC[actPr];
    pcList.forEach(function(cDef, idx) {
      var nFrom = nodes[cDef[0]];
      var nTo = nodes[cDef[1]];
      if (!nFrom || !nTo) return;
      var match = conns[idx];
      if (!match || match.fi !== nFrom.id || match.ti !== nTo.id) {
        match = conns.find(function(cn) { return cn.fi === nFrom.id && cn.ti === nTo.id; });
      }
      if (match && cDef[3] && !match._userEdited) {
        match.meta = Object.assign({}, cDef[3]);
      }
    });
  };

  // Override ukladWezlow ("整理布局") so it restores exact swimlane coordinates for Collaboration Units
  var _origUkladWezlow = window.ukladWezlow;
  window.ukladWezlow = function() {
    if (typeof actPr !== 'undefined' && actPr && window.UNIT_META && window.UNIT_META[actPr] && typeof PR !== 'undefined' && PR[actPr]) {
      var pr = PR[actPr];
      nodes.forEach(function(nd, idx) {
        if (pr[idx]) {
          nd.x = pr[idx].x;
          nd.y = pr[idx].y;
        }
      });
      return;
    }
    if (typeof _origUkladWezlow === 'function') _origUkladWezlow();
  };

  // Override dopasujWidok so swimlane zones and nodes fit comfortably in the viewport
  window.dopasujWidok = function() {
    if (!nodes.length) return;
    var r = cvA.getBoundingClientRect();
    var minX = Math.min.apply(null, nodes.map(function(n) { return n.x; }));
    var minY = Math.min.apply(null, nodes.map(function(n) { return n.y; }));
    var maxX = Math.max.apply(null, nodes.map(function(n) { return n.x + window.getNodeDims(n).w; }));
    var maxY = Math.max.apply(null, nodes.map(function(n) { return n.y + window.getNodeDims(n).h; }));

    var u = (typeof actPr !== 'undefined' && actPr && window.UNIT_META) ? window.UNIT_META[actPr] : null;
    if (u && Array.isArray(u.zones) && u.zones.length) {
      var pr = (typeof PR !== 'undefined' && PR[actPr]) ? PR[actPr] : null;
      var offX = (pr && pr[0] && nodes[0]) ? (nodes[0].x - pr[0].x) : 0;
      var offY = (pr && pr[0] && nodes[0]) ? (nodes[0].y - pr[0].y) : 0;
      u.zones.forEach(function(z) {
        minX = Math.min(minX, z.x + offX - 14);
        minY = Math.min(minY, z.y + offY - 22);
        maxX = Math.max(maxX, z.x + offX + z.w + 14);
        maxY = Math.max(maxY, z.y + offY + z.h + 22);
      });
    }

    var gW = maxX - minX + 120;
    var gH = maxY - minY + 130;
    scale = Math.min(1.12, Math.min(r.width / gW, (r.height - 64) / gH));
    scale = Math.max(0.32, Math.round(scale * 100) / 100);
    panX = Math.round((r.width - (maxX - minX) * scale) / 2 - minX * scale);
    panY = Math.round((r.height - (maxY - minY) * scale) / 2 - minY * scale + 18);
    if (typeof zastTransf === 'function') zastTransf();
  };

  // Override aktPasekFaz so Collaboration Units show a Structural Formula + Arrow Semantics Bar at the top of the canvas
  var _origAktPasekFaz = window.aktPasekFaz;
  window.aktPasekFaz = function() {
    var bar = G('phaseBar');
    if (!bar) return;
    if (!nodes.length) {
      bar.classList.remove('show', 'unit-struct-bar');
      bar.innerHTML = '';
      return;
    }
    var u = (typeof actPr !== 'undefined' && actPr && window.UNIT_META) ? window.UNIT_META[actPr] : null;
    if (u) {
      bar.className = 'phase-bar show unit-struct-bar';
      bar.innerHTML =
        '<span class="usb-lvl" style="--uc:' + u.color + '">' + escHtml(u.badge) + '</span>' +
        '<span class="usb-formula">' + escHtml(u.formula) + '</span>' +
        '<span class="usb-sep"></span>' +
        '<span class="usb-leg" title="点击任意连线可打开 Draw.io 箭头编辑器"><i style="background:#38bdf8"></i>甲路:塞上下文</span>' +
        '<span class="usb-leg" title="双轨空心管道代表通过工具渠道调用"><i style="background:#a855f7;border:1px solid #fff"></i>乙路:工具管道══▶</span>' +
        '<span class="usb-leg" title="橙色粗虚线代表未达停止条件时返工回路"><i style="background:#f97316"></i>回路:返工虚线</span>' +
        '<button type="button" onclick="otworzEdytorStrzalek()" style="margin-left:4px;padding:2px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.45);background:rgba(56,189,248,0.14);color:#38bdf8;font-family:var(--mn);font-size:9px;font-weight:700;cursor:pointer">🎨 改箭头</button>';
      return;
    }

    bar.classList.remove('unit-struct-bar');
    if (typeof _origAktPasekFaz === 'function') _origAktPasekFaz();
  };

  // Override aktLicznik so Ports/Tools/Stores are not miscounted as "Sonnet Agents"
  var _origAktLicznik = window.aktLicznik;
  window.aktLicznik = function() {
    var el = G('cvI');
    if (!el) return;
    var agentCnt = 0, primCnt = 0;
    nodes.forEach(function(n) {
      var k = window.getNodeKind(n.defId);
      if (k === 'agent' || k === 'default') agentCnt++;
      else primCnt++;
    });
    if (primCnt > 0) {
      el.textContent = agentCnt + ' 智能体 · ' + primCnt + ' 协作原语/接口 | ' + conns.length + ' 条语义连线';
      if (typeof aktKoszt === 'function') aktKoszt();
    } else if (typeof _origAktLicznik === 'function') {
      _origAktLicznik();
    }
  };

  // Override rPalete so Left Palette shows archetype badges (PORT / TOOL / GATE / HOST / STEP / STORE) instead of fake SONNET badges
  var _origRPalete = window.rPalete;
  window.rPalete = function() {
    if (typeof _origRPalete === 'function') _origRPalete();
    var paL = G('paL');
    if (!paL || !window.UNIT_NODE_META) return;
    var kindBadgeMap = {
      port:      ['⇄ PORT',   '#38bdf8'],
      tool:      ['🔧 TOOL',   '#f59e0b'],
      decision:  ['◆ GATE',   '#fbbf24'],
      control:   ['🎛️ HOST',   '#818cf8'],
      primitive: ['⚡ STEP',   '#10b981'],
      store:     ['🗄️ STORE',  '#a855f7'],
      agent:     ['🤖 AGENT',  '#60a5fa']
    };
    paL.querySelectorAll('.pa-item[data-aid]').forEach(function(item) {
      var aid = item.getAttribute('data-aid');
      var uMeta = window.UNIT_NODE_META[aid];
      if (!uMeta || !kindBadgeMap[uMeta.nodeKind]) return;
      var kb = kindBadgeMap[uMeta.nodeKind];
      var bEl = item.querySelector('.pa-badge');
      if (bEl) {
        bEl.className = 'pa-badge';
        bEl.style.cssText = 'background:' + kb[1] + '22;color:' + kb[1] + ';border:1px solid ' + kb[1] + '55;font-weight:700;';
        bEl.textContent = kb[0];
      }
    });
  };

  // Override pokazWezel & pokazDef so non-agent nodes show an Architecture Component Inspector instead of a fake LLM Model Switcher
  var _origPokazWezel = window.pokazWezel;
  window.pokazWezel = function(nid) {
    var nd = nodes.find(function(x) { return x.id === nid; });
    if (!nd) return;
    var uMeta = window.UNIT_NODE_META && window.UNIT_NODE_META[nd.defId];
    if (!uMeta || uMeta.nodeKind === 'agent') {
      if (typeof _origPokazWezel === 'function') _origPokazWezel(nid);
      return;
    }
    var d = AD_MAP.get(nd.defId);
    if (!d) return;
    var agc = uMeta.color || '#38bdf8';
    var inEdges = conns.filter(function(c) { return c.ti === nid; });
    var outEdges = conns.filter(function(c) { return c.fi === nid; });

    var edgesHtml = '';
    inEdges.concat(outEdges).forEach(function(c) {
      var m = window.ensureConnMeta(c);
      var isOut = c.fi === nid;
      var otherId = isOut ? c.ti : c.fi;
      var otherNd = nodes.find(function(n) { return n.id === otherId; });
      var otherName = otherNd ? getAgentName(otherNd.defId) : otherId;
      edgesHtml += '<div onclick="zmienTypPol(\'' + c.id + '\')" style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:4px;border-radius:7px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;font-size:10px">' +
        '<span style="font-family:var(--mn);color:' + (m.color || agc) + ';font-weight:700">' + (isOut ? '发出 →' : '← 接收') + '</span>' +
        '<span style="flex:1;color:#f1f5f9">' + escHtml(otherName) + ' <span style="color:var(--t2)">(' + escHtml(m.label || '') + ')</span></span>' +
        '<span style="font-family:var(--mn);font-size:9px;color:#38bdf8">改箭头</span>' +
      '</div>';
    });

    G('srS').innerHTML =
      '<div class="ds-card" style="border-left:3px solid ' + agc + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
          '<span style="font-family:var(--mn);font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:6px;background:' + agc + '22;color:' + agc + ';border:1px solid ' + agc + '55">' + escHtml(uMeta.kindTag) + '</span>' +
          '<span style="font-family:var(--mn);font-size:9px;color:var(--t2)">非 LLM 节点 · 原生架构组件</span>' +
        '</div>' +
        '<div class="ds-hdr" style="margin-top:4px">' +
          '<div class="ds-av duo" style="color:' + agc + ';border-color:' + agc + '44;background:' + agc + '15">' + svgAgenta(d.id, 28) + '</div>' +
          '<div><div class="ds-nm">' + escHtml(getAgentName(d.id)) + '</div><div class="ds-rl">' + escHtml(getAgentRole(d.id)) + '</div></div>' +
        '</div>' +
        '<div class="ds-desc">' + escHtml(getAgentDesc(d.id)) + '</div>' +
      '</div>' +
      '<div class="ds"><div class="ds-l">接口签名 / 原语协议</div>' +
        '<code style="display:block;padding:8px 10px;border-radius:8px;background:rgba(2,6,23,0.85);border:1px solid rgba(255,255,255,0.08);font-family:var(--mn);font-size:10.5px;color:' + agc + '">' + escHtml(uMeta.codeSig || d.tools) + '</code>' +
      '</div>' +
      '<div class="ds"><div class="ds-l">关键架构约束与失效防线</div><div class="ds-box" style="color:var(--accent3)">' + escHtml(getAgentSteps(d.id)) + '</div></div>' +
      (edgesHtml ? '<div class="ds"><div class="ds-l">关联连线（点击可编辑箭头样式）</div>' + edgesHtml + '</div>' : '') +
      '<button class="btn btn-d" style="width:100%;justify-content:center;margin-top:4px" onclick="usunWezel(\'' + nid + '\')">✕ 从画布移除此组件</button>';
  };

  var _origPokazDef = window.pokazDef;
  window.pokazDef = function(id) {
    var uMeta = window.UNIT_NODE_META && window.UNIT_NODE_META[id];
    if (!uMeta || uMeta.nodeKind === 'agent') {
      if (typeof _origPokazDef === 'function') _origPokazDef(id);
      return;
    }
    var d = AD_MAP.get(id);
    if (!d) return;
    var agc = uMeta.color || '#38bdf8';
    G('srS').innerHTML =
      '<div class="ds-card" style="border-left:3px solid ' + agc + '">' +
        '<span style="font-family:var(--mn);font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:6px;background:' + agc + '22;color:' + agc + ';border:1px solid ' + agc + '55">' + escHtml(uMeta.kindTag) + '</span>' +
        '<div class="ds-hdr" style="margin-top:8px">' +
          '<div class="ds-av duo" style="color:' + agc + ';border-color:' + agc + '44;background:' + agc + '15">' + svgAgenta(d.id, 28) + '</div>' +
          '<div><div class="ds-nm">' + escHtml(getAgentName(d.id)) + '</div><div class="ds-rl">' + escHtml(getAgentRole(d.id)) + '</div></div>' +
        '</div>' +
        '<div class="ds-desc">' + escHtml(getAgentDesc(d.id)) + '</div>' +
      '</div>' +
      '<div class="ds"><div class="ds-l">接口签名 / 原语协议</div>' +
        '<code style="display:block;padding:8px 10px;border-radius:8px;background:rgba(2,6,23,0.85);border:1px solid rgba(255,255,255,0.08);font-family:var(--mn);font-size:10.5px;color:' + agc + '">' + escHtml(uMeta.codeSig || d.tools) + '</code>' +
      '</div>' +
      '<button class="btn btn-p" style="width:100%;justify-content:center;margin-top:6px" onclick="szybkoDodaj(\'' + d.id + '\')">+ 添加组件到画布</button>';
  };

  // Upgrade generujMermaid so exported Mermaid code includes real subgraphs, distinct shapes (diamond/cylinder/stadium/hexagon), and edge labels
  window.generujMermaid = function() {
    var u = (typeof actPr !== 'undefined' && actPr && window.UNIT_META) ? window.UNIT_META[actPr] : null;
    var lines = ['flowchart LR'];
    if (u) {
      lines.push('  %% ' + u.badge + ' · ' + u.name);
      lines.push('  %% 推导公式: ' + u.formula);
    }

    function shapeForNode(nd) {
      var d = AD_MAP.get(nd.defId);
      var nm = (d ? getAgentName(d.id) : nd.defId).replace(/"/g, "'");
      var k = window.getNodeKind(nd.defId);
      if (k === 'port')      return nd.id + '(["⇄ ' + nm + '"])';
      if (k === 'tool')      return nd.id + '{{"🔧 ' + nm + '"}}';
      if (k === 'decision')  return nd.id + '{"◆ ' + nm + '"}';
      if (k === 'store')     return nd.id + '[("🗄️ ' + nm + '")]';
      if (k === 'control')   return nd.id + '[["🎛️ ' + nm + '"]]';
      if (k === 'primitive') return nd.id + '[/"⚡ ' + nm + '"/]';
      return nd.id + '["🤖 ' + nm + ' (' + nd.model.toUpperCase() + ')"]';
    }

    var assigned = new Set();
    if (u && Array.isArray(u.zones) && u.zones.length) {
      var pr = (typeof PR !== 'undefined' && PR[actPr]) ? PR[actPr] : null;
      var offX = (pr && pr[0] && nodes[0]) ? (nodes[0].x - pr[0].x) : 0;
      var offY = (pr && pr[0] && nodes[0]) ? (nodes[0].y - pr[0].y) : 0;
      u.zones.forEach(function(z, zi) {
        var zx = z.x + offX, zy = z.y + offY;
        var zNodes = nodes.filter(function(nd) {
          var dm = window.getNodeDims(nd);
          var cx = nd.x + dm.w / 2, cy = nd.y + dm.h / 2;
          return cx >= zx && cx <= zx + z.w && cy >= zy && cy <= zy + z.h;
        });
        if (zNodes.length) {
          lines.push('  subgraph Z' + (zi + 1) + '["' + z.title.replace(/"/g, "'") + '"]');
          zNodes.forEach(function(nd) {
            assigned.add(nd.id);
            lines.push('    ' + shapeForNode(nd));
          });
          lines.push('  end');
        }
      });
    }

    nodes.forEach(function(nd) {
      if (!assigned.has(nd.id)) lines.push('  ' + shapeForNode(nd));
    });

    conns.forEach(function(c) {
      var m = window.ensureConnMeta(c);
      var lbl = ((m.seq ? m.seq + ' ' : '') + (m.label || '')).trim().replace(/"/g, "'");
      var arrow = '-->';
      if (m.weight === 'double' || m.sem === 'tool' || m.sem === 'store') arrow = '==>';
      else if (m.dash === 'dashed' || m.dash === 'dotted' || m.sem === 'loop' || m.sem === 'observe') arrow = '-.->';
      else if (c.tp === 'two') arrow = '<-->';
      if (lbl) {
        lines.push('  ' + c.fi + ' ' + arrow + '|"' + lbl + '"| ' + c.ti);
      } else {
        lines.push('  ' + c.fi + ' ' + arrow + ' ' + c.ti);
      }
    });

    return lines.join('\n');
  };

  // Override rWez to render unmistakably distinct geometric shapes for all 6+ node archetypes
  window.rWez = function() {
    if (typeof cvT === 'undefined' || !cvT) return;
    window.rZones();
    cvT.querySelectorAll('.nd').forEach(function(e) { e.remove(); });

    nodes.forEach(function(nd) {
      var d = AD_MAP.get(nd.defId);
      if (!d) return;
      var uMeta = (window.UNIT_NODE_META && window.UNIT_NODE_META[nd.defId]) || null;
      var kind = uMeta ? uMeta.nodeKind : 'default';
      var cc = cMap[d.color] || 'c-mu';
      var agc = uMeta ? uMeta.color : KOLOR_IKONY_AGENTA(d.id);
      var bc = bMap[nd.model] || 'b-so';
      var ld = d.load + (nd.model === 'haiku' ? 10 : nd.model === 'opus' ? -15 : 0);
      var lc = ld >= 80 ? 'var(--accent4)' : ld >= 55 ? 'var(--accent3)' : 'var(--accent2)';
      var isFM = d.cat === 'FIVE MINDS';
      var phCls = d.phase ? ' ph-' + d.phase : '';

      var el = document.createElement('div');
      var kindCls = kind !== 'default' ? ' nd-unit kind-' + kind : '';
      el.className = 'nd ' + cc + phCls + kindCls + (sel.has(nd.id) ? ' sel' : '') + (isFM ? ' five-minds-expert' : '');
      el.id = nd.id;
      el.style.transform = 'translate(' + nd.x + 'px,' + nd.y + 'px)';
      el.style.setProperty('--ic', agc);

      var anchorsHtml =
        '<div class="nd-anc top" data-n="' + nd.id + '" data-side="top" title="上方锚点"></div>' +
        '<div class="nd-anc right" data-n="' + nd.id + '" data-side="right" title="右侧锚点"></div>' +
        '<div class="nd-anc bot" data-n="' + nd.id + '" data-side="bottom" title="下方锚点"></div>' +
        '<div class="nd-anc left" data-n="' + nd.id + '" data-side="left" title="左侧锚点"></div>';

      var bodyInner = '';
      if (kind === 'decision') {
        // True 45° SVG Diamond Rhombus for Step-to-Step 3 Decisions
        bodyInner =
          '<svg class="nd-diamond-svg" viewBox="0 0 136 136">' +
            '<polygon points="68,4 132,68 68,132 4,68" fill="rgba(28,19,8,0.95)" stroke="' + agc + '" stroke-width="2.2"/>' +
            '<polygon points="68,12 124,68 68,124 12,68" fill="none" stroke="' + agc + '" stroke-opacity="0.32" stroke-width="1" stroke-dasharray="4 3"/>' +
          '</svg>' +
          '<div class="nd-body">' +
            '<span class="nd-kind-tag" style="color:' + agc + ';border-color:' + agc + '66">' + escHtml(uMeta.kindTag || '◆ GATE') + '</span>' +
            '<div class="nd-orb duo">' + svgAgenta(d.id, 18) + '</div>' +
            '<div class="nd-lbl" style="color:#fef3c7">' + escHtml(getAgentName(d.id)) + '</div>' +
            '<div class="nd-dec-questions">' +
              '<span>①谁</span><span>②给啥</span><span>③停?</span>' +
            '</div>' +
          '</div>';
      } else if (kind === 'port') {
        // Stadium / Pill Horizontal Socket (border-radius: 999px)
        bodyInner =
          '<div class="nd-body">' +
            '<div class="nd-port-hdr">' +
              '<span class="nd-kind-tag" style="color:' + agc + ';border-color:' + agc + '55">' + escHtml(uMeta.kindTag || '⇄ PORT') + '</span>' +
              '<span class="nd-port-dir">⇄ I/O</span>' +
            '</div>' +
            '<div class="nd-port-main">' +
              '<div class="nd-orb duo">' + svgAgenta(d.id, 17) + '</div>' +
              '<div class="nd-lbl" style="color:#e0f2fe">' + escHtml(getAgentName(d.id)) + '</div>' +
            '</div>' +
            '<code class="nd-code-sig">' + escHtml(uMeta.codeSig || d.tools || '') + '</code>' +
          '</div>';
      } else if (kind === 'tool') {
        // Chamfered Hexagonal / Beveled Tool Cartridge with Dashed Amber Frame
        bodyInner =
          '<div class="nd-body">' +
            '<div class="nd-port-hdr">' +
              '<span class="nd-kind-tag" style="color:' + agc + ';border-color:' + agc + '66">' + escHtml(uMeta.kindTag || '🔧 TOOL') + '</span>' +
              '<span class="nd-port-dir" style="color:#fbbf24">⚡ CALL</span>' +
            '</div>' +
            '<div class="nd-port-main">' +
              '<div class="nd-orb duo">' + svgAgenta(d.id, 18) + '</div>' +
              '<div class="nd-lbl" style="color:#fef3c7">' + escHtml(getAgentName(d.id)) + '</div>' +
            '</div>' +
            '<code class="nd-code-sig">' + escHtml(uMeta.codeSig || d.tools || '') + '</code>' +
          '</div>';
      } else if (kind === 'store') {
        // 3D Database Cylinder / Multi-Slot Blackboard Store
        bodyInner =
          '<div class="nd-store-cap"></div>' +
          '<div class="nd-body">' +
            '<div class="nd-store-main">' +
              '<div class="nd-orb duo">' + svgAgenta(d.id, 18) + '</div>' +
              '<div>' +
                '<div class="nd-lbl" style="color:#f3e8ff;text-align:left">' + escHtml(getAgentName(d.id)) + '</div>' +
                '<div style="font-family:var(--mn);font-size:7.5px;color:#c084fc">' + escHtml(uMeta.kindTag || '🗄️ STORE') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="nd-store-slots">' +
              '<span>Slot A</span><span>Slot B</span><span>Lock</span>' +
            '</div>' +
          '</div>';
      } else if (kind === 'control') {
        // Host Control Plane Rack Chassis with Top Status Bar & LEDs
        bodyInner =
          '<div class="nd-ctrl-leds"><i></i><i></i><i></i></div>' +
          '<div class="nd-body">' +
            '<div class="nd-port-main">' +
              '<div class="nd-orb duo">' + svgAgenta(d.id, 19) + '</div>' +
              '<div class="nd-lbl" style="color:#e0e7ff">' + escHtml(getAgentName(d.id)) + '</div>' +
            '</div>' +
            '<code class="nd-code-sig">' + escHtml(uMeta.codeSig || '') + '</code>' +
          '</div>';
      } else if (kind === 'primitive') {
        // Horizontal Syscall Step Block with 6px Left Spine
        bodyInner =
          '<div class="nd-body">' +
            '<div class="nd-port-hdr">' +
              '<span class="nd-kind-tag" style="color:' + agc + ';border-color:' + agc + '55">' + escHtml(uMeta.kindTag || '⚡ STEP') + '</span>' +
              '<span class="nd-port-dir">SYSCALL</span>' +
            '</div>' +
            '<div class="nd-port-main">' +
              '<div class="nd-orb duo">' + svgAgenta(d.id, 17) + '</div>' +
              '<div class="nd-lbl" style="color:#f1f5f9">' + escHtml(getAgentName(d.id)) + '</div>' +
            '</div>' +
            '<code class="nd-code-sig">' + escHtml(uMeta.codeSig || '') + '</code>' +
          '</div>';
      } else if (kind === 'agent') {
        // AI Agent Portrait Card (ONLY archetype with LLM Model Badge & Circular Glowing Avatar)
        bodyInner =
          '<div class="nd-body">' +
            '<span class="nd-kind-tag" style="color:' + agc + ';border-color:' + agc + '55">' + escHtml(uMeta.kindTag || '🤖 AGENT') + '</span>' +
            '<div class="nd-orb duo">' + svgAgenta(d.id, 24) + '</div>' +
            '<div class="nd-lbl" style="color:#f8fafc">' + escHtml(getAgentName(d.id)) + '</div>' +
            '<span class="nd-mdl ' + bc + '">' + nd.model.toUpperCase() + '</span>' +
            '<div class="nd-sim-progress"><div class="nd-sim-progress-bar"></div></div>' +
          '</div>';
      } else {
        // Standard Concept Board Agent Card
        bodyInner =
          '<div class="nd-body">' +
            '<div class="nd-orb duo">' + svgAgenta(d.id, 26) + '</div>' +
            '<div class="nd-lbl" style="color:' + agc + '">' + escHtml(getAgentName(d.id)) + '</div>' +
            '<span class="nd-mdl ' + bc + '">' + nd.model.toUpperCase() + '</span>' +
            '<div class="nd-load"><div class="nd-load-bar" style="width:' + Math.min(100, ld) + '%;background:' + lc + '"></div></div>' +
            '<div class="nd-sim-progress"><div class="nd-sim-progress-bar"></div></div>' +
          '</div>';
      }

      el.innerHTML = anchorsHtml + bodyInner + '<div class="nd-check">\u2713</div><div class="nd-speech"></div>';

      el.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('nd-anc')) {
          naKotwice(nd.id, e.target.getAttribute('data-side'));
          return;
        }
        if (connMode) {
          naKotwice(nd.id);
          return;
        }
        var r = cvA.getBoundingClientRect();
        if (!sel.has(nd.id)) {
          if (!e.shiftKey) sel.clear();
          sel.add(nd.id);
          aktZazn();
        }
        dragGroup = [...sel].map(function(sid) {
          var n = nodes.find(function(x) { return x.id === sid; });
          return { node: n, ox: (e.clientX - r.left - panX) / scale - n.x, oy: (e.clientY - r.top - panY) / scale - n.y };
        });
        e.preventDefault();
        e.stopPropagation();
      });

      el.addEventListener('click', function(e) {
        if (!connMode) {
          window.selConnId = null;
          if (e.shiftKey) {
            if (sel.has(nd.id)) sel.delete(nd.id);
            else sel.add(nd.id);
            aktZazn();
            if (sel.size > 1) pokazZazn();
            else if (sel.size === 1) pokazWezel([...sel][0]);
          } else {
            sel.clear();
            sel.add(nd.id);
            aktZazn();
            pokazWezel(nd.id);
          }
          rPol();
        }
        e.stopPropagation();
      });

      cvT.appendChild(el);
    });

    window.syncUnitConnsMeta();
    rPol();
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// PART 3B: DRAW.IO MULTI-ALGORITHM, MULTI-WEIGHT & MULTI-MARKER EDGE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  if (typeof window === 'undefined') return;

  window.selConnId = null;

  // Semantic presets for one-click engineering meaning + visual styling
  window.EDGE_SEMANTIC_PRESETS = {
    context: {
      key: 'context',
      name: '📥 甲路：上下文塞入 (Data Flow)',
      desc: '把上一步文本/产出塞进目标智能体的「进口：上下文」',
      algo: 'ortho', weight: 'bold', dash: 'solid',
      startMarker: 'none', endMarker: 'classic', color: '#38bdf8'
    },
    tool: {
      key: 'tool',
      name: '🔧 乙路：能力/工具渠道 (Tool Bus)',
      desc: '通过「出口①：调工具」发起受控调用（双轨管道线）',
      algo: 'ortho', weight: 'double', dash: 'solid',
      startMarker: 'circle', endMarker: 'classic', color: '#a855f7'
    },
    control: {
      key: 'control',
      name: '🎛️ 会话控制与门禁 (Session Control)',
      desc: '开会话 / 续会话 / 插话打断 / 步间门禁放行',
      algo: 'ortho', weight: 'bold', dash: 'solid',
      startMarker: 'bar', endMarker: 'classic', color: '#10b981'
    },
    observe: {
      key: 'observe',
      name: '👁️ 状态观察探针 (Observe Probe)',
      desc: '外部非侵入探针观察 RUNNING / STOPPED 状态与进展',
      algo: 'ortho', weight: 'thin', dash: 'dotted',
      startMarker: 'circle', endMarker: 'open', color: '#f59e0b'
    },
    loop: {
      key: 'loop',
      name: '🔁 循环返工 / 多轮往返 (Feedback Loop)',
      desc: '未达停止条件时，带着评审意见或新追问跳回前序会话',
      algo: 'ortho', weight: 'bold', dash: 'dashed',
      startMarker: 'diamond', endMarker: 'classic', color: '#f97316'
    },
    store: {
      key: 'store',
      name: '🗄️ 共享区原子读写 (Shared Store I/O)',
      desc: '读写外部共享黑板、文件树或带锁任务队列',
      algo: 'ortho', weight: 'double', dash: 'solid',
      startMarker: 'diamond_open', endMarker: 'diamond', color: '#ec4899'
    }
  };

  window.ensureConnMeta = function(c) {
    if (!c.meta) {
      var defColor = c.tp === 'two' ? '#10b981' : (c.tp === 'continuous' ? '#f59e0b' : '#818cf8');
      c.meta = {
        seq: '',
        label: '',
        sem: c.tp === 'continuous' ? 'loop' : (c.tp === 'two' ? 'store' : 'context'),
        algo: (typeof actPr !== 'undefined' && actPr && window.UNIT_META && window.UNIT_META[actPr]) ? 'ortho' : 'bezier',
        weight: 'normal',
        dash: c.tp === 'continuous' ? 'dashed' : 'solid',
        startMarker: c.tp === 'two' ? 'classic' : 'none',
        endMarker: 'classic',
        color: defColor,
        af: 'auto',
        at: 'auto',
        bend: 0
      };
    }
    return c.meta;
  };

  function resolveSmartSides(f, t, af, at) {
    var df = window.getNodeDims(f);
    var dt = window.getNodeDims(t);
    var fcx = f.x + df.w / 2, fcy = f.y + df.h / 2;
    var tcx = t.x + dt.w / 2, tcy = t.y + dt.h / 2;
    var dx = tcx - fcx, dy = tcy - fcy;

    var s1 = (af && af !== 'auto') ? af : null;
    var s2 = (at && at !== 'auto') ? at : null;

    if (!s1 || !s2) {
      if (Math.abs(dx) > Math.abs(dy) * 0.92) {
        if (!s1) s1 = dx >= 0 ? 'right' : 'left';
        if (!s2) s2 = dx >= 0 ? 'left' : 'right';
      } else {
        if (!s1) s1 = dy >= 0 ? 'bottom' : 'top';
        if (!s2) s2 = dy >= 0 ? 'top' : 'bottom';
      }
    }
    return { s1: s1, s2: s2 };
  }

  function getAnchorPoint(nd, side) {
    var dm = window.getNodeDims(nd);
    var pad = 3;
    if (side === 'top')    return { x: Math.round(nd.x + dm.w / 2), y: Math.round(nd.y - pad), nx: 0, ny: -1 };
    if (side === 'right')  return { x: Math.round(nd.x + dm.w + pad), y: Math.round(nd.y + dm.h / 2), nx: 1, ny: 0 };
    if (side === 'left')   return { x: Math.round(nd.x - pad), y: Math.round(nd.y + dm.h / 2), nx: -1, ny: 0 };
    return { x: Math.round(nd.x + dm.w / 2), y: Math.round(nd.y + dm.h + pad), nx: 0, ny: 1 };
  }

  function roundedPolyline(pts, radius) {
    if (!pts || pts.length < 2) return '';
    if (pts.length === 2) return 'M' + pts[0].x + ',' + pts[0].y + ' L' + pts[1].x + ',' + pts[1].y;
    var r = radius || 10;
    var d = 'M' + pts[0].x + ',' + pts[0].y;
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      var dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
      var dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
      var len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
      if (len1 < 2 || len2 < 2) {
        d += ' L' + p1.x + ',' + p1.y;
        continue;
      }
      var cr = Math.min(r, len1 / 2, len2 / 2);
      var sx = p1.x - (dx1 / len1) * cr;
      var sy = p1.y - (dy1 / len1) * cr;
      var ex = p1.x + (dx2 / len2) * cr;
      var ey = p1.y + (dy2 / len2) * cr;
      d += ' L' + Math.round(sx) + ',' + Math.round(sy) + ' Q' + Math.round(p1.x) + ',' + Math.round(p1.y) + ' ' + Math.round(ex) + ',' + Math.round(ey);
    }
    var last = pts[pts.length - 1];
    d += ' L' + last.x + ',' + last.y;
    return d;
  }

  function polylineMidpoint(pts) {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    if (pts.length === 2) return { x: Math.round((pts[0].x + pts[1].x) / 2), y: Math.round((pts[0].y + pts[1].y) / 2) };
    var bestIdx = 0, bestLen = -1;
    for (var i = 0; i < pts.length - 1; i++) {
      var l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (l > bestLen) { bestLen = l; bestIdx = i; }
    }
    return {
      x: Math.round((pts[bestIdx].x + pts[bestIdx + 1].x) / 2),
      y: Math.round((pts[bestIdx].y + pts[bestIdx + 1].y) / 2)
    };
  }

  function computeOrthoPoints(p1, p2, bendOffset) {
    var stub = 22;
    var bend = Number(bendOffset) || 0;
    var s1x = p1.x + p1.nx * stub, s1y = p1.y + p1.ny * stub;
    var s2x = p2.x + p2.nx * stub, s2y = p2.y + p2.ny * stub;
    var pts = [{ x: p1.x, y: p1.y }];

    var horiz1 = p1.nx !== 0;
    var horiz2 = p2.nx !== 0;

    if (horiz1 && horiz2) {
      if (p1.nx === p2.nx) {
        // Same-side horizontal U-turn (e.g., right -> right or left -> left)
        var outX = p1.nx > 0 ? Math.max(s1x, s2x) + 18 + Math.abs(bend) : Math.min(s1x, s2x) - 18 - Math.abs(bend);
        pts.push({ x: outX, y: p1.y }, { x: outX, y: p2.y });
      } else if ((p1.nx > 0 && s2x >= s1x) || (p1.nx < 0 && s2x <= s1x)) {
        var midX = Math.round((s1x + s2x) / 2 + bend);
        pts.push({ x: midX, y: p1.y }, { x: midX, y: p2.y });
      } else {
        var detourY = Math.round((p1.y + p2.y) / 2 + (bend || (p2.y >= p1.y ? 72 : -72)));
        pts.push({ x: s1x, y: p1.y }, { x: s1x, y: detourY }, { x: s2x, y: detourY }, { x: s2x, y: p2.y });
      }
    } else if (!horiz1 && !horiz2) {
      if (p1.ny === p2.ny) {
        // Same-side vertical U-turn (e.g., bottom -> bottom or top -> top feedback loops)
        var outY = p1.ny > 0 ? Math.max(s1y, s2y) + 22 + Math.abs(bend) : Math.min(s1y, s2y) - 22 - Math.abs(bend);
        pts.push({ x: p1.x, y: outY }, { x: p2.x, y: outY });
      } else if ((p1.ny > 0 && s2y >= s1y) || (p1.ny < 0 && s2y <= s1y)) {
        var midY = Math.round((s1y + s2y) / 2 + bend);
        pts.push({ x: p1.x, y: midY }, { x: p2.x, y: midY });
      } else {
        var detourX = Math.round((p1.x + p2.x) / 2 + (bend || (p2.x >= p1.x ? 84 : -84)));
        pts.push({ x: p1.x, y: s1y }, { x: detourX, y: s1y }, { x: detourX, y: s2y }, { x: p2.x, y: s2y });
      }
    } else if (horiz1 && !horiz2) {
      if ((p1.nx > 0 && p2.x >= s1x) || (p1.nx < 0 && p2.x <= s1x)) {
        pts.push({ x: p2.x, y: p1.y });
      } else {
        pts.push({ x: s1x, y: p1.y }, { x: s1x, y: s2y }, { x: p2.x, y: s2y });
      }
    } else {
      if ((p1.ny > 0 && p2.y >= s1y) || (p1.ny < 0 && p2.y <= s1y)) {
        pts.push({ x: p1.x, y: p2.y });
      } else {
        pts.push({ x: p1.x, y: s1y }, { x: s2x, y: s1y }, { x: s2x, y: p2.y });
      }
    }

    pts.push({ x: p2.x, y: p2.y });
    return pts;
  }

  window.buildEdgeGeometry = function(p1, p2, algo, bendOffset) {
    var mode = algo || 'ortho';
    var bend = Number(bendOffset) || 0;
    if (mode === 'straight') {
      return {
        d: 'M' + p1.x + ',' + p1.y + ' L' + p2.x + ',' + p2.y,
        mid: { x: Math.round((p1.x + p2.x) / 2), y: Math.round((p1.y + p2.y) / 2) }
      };
    }
    if (mode === 'arc') {
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var dx = p2.x - p1.x, dy = p2.y - p1.y;
      var dist = Math.hypot(dx, dy) || 1;
      var arcBend = bend || Math.min(88, Math.max(44, dist * 0.32));
      var cpx = Math.round(mx - (dy / dist) * arcBend);
      var cpy = Math.round(my + (dx / dist) * (dx < 0 ? arcBend : -arcBend));
      return {
        d: 'M' + p1.x + ',' + p1.y + ' Q' + cpx + ',' + cpy + ' ' + p2.x + ',' + p2.y,
        mid: { x: Math.round(0.25 * p1.x + 0.5 * cpx + 0.25 * p2.x), y: Math.round(0.25 * p1.y + 0.5 * cpy + 0.25 * p2.y) }
      };
    }
    if (mode === 'bezier') {
      var distB = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      var cLen = Math.max(48, Math.min(160, distB * 0.42));
      var c1x = Math.round(p1.x + p1.nx * cLen);
      var c1y = Math.round(p1.y + p1.ny * cLen + bend * 0.5);
      var c2x = Math.round(p2.x + p2.nx * cLen);
      var c2y = Math.round(p2.y + p2.ny * cLen + bend * 0.5);
      return {
        d: 'M' + p1.x + ',' + p1.y + ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + p2.x + ',' + p2.y,
        mid: {
          x: Math.round(0.125 * p1.x + 0.375 * c1x + 0.375 * c2x + 0.125 * p2.x),
          y: Math.round(0.125 * p1.y + 0.375 * c1y + 0.375 * c2y + 0.125 * p2.y)
        }
      };
    }
    var pts = computeOrthoPoints(p1, p2, bend);
    var dStr = mode === 'elbow' ? roundedPolyline(pts, 0) : roundedPolyline(pts, 11);
    return { d: dStr, mid: polylineMidpoint(pts) };
  };

  function buildMarkerDefs(colorsSet) {
    var defs = '';
    colorsSet.forEach(function(col) {
      var cid = col.replace(/[^a-zA-Z0-9]/g, '');
      defs += '<marker id="mk_classic_e_' + cid + '" markerWidth="10" markerHeight="8" refX="8.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M0,0.5 L9.5,4 L0,7.5 L2.2,4 z" fill="' + col + '"/></marker>';
      defs += '<marker id="mk_open_e_' + cid + '" markerWidth="10" markerHeight="8" refX="8.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M1,1 L8.5,4 L1,7" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>';
      defs += '<marker id="mk_block_open_e_' + cid + '" markerWidth="10" markerHeight="8" refX="8.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M1,1 L9,4 L1,7 z" fill="#0b0c14" stroke="' + col + '" stroke-width="1.6"/></marker>';
      defs += '<marker id="mk_diamond_e_' + cid + '" markerWidth="11" markerHeight="9" refX="9.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M0.5,4.5 L5.2,1 L10,4.5 L5.2,8 z" fill="' + col + '"/></marker>';
      defs += '<marker id="mk_diamond_open_e_' + cid + '" markerWidth="11" markerHeight="9" refX="9.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M0.8,4.5 L5.2,1.2 L9.6,4.5 L5.2,7.8 z" fill="#0b0c14" stroke="' + col + '" stroke-width="1.6"/></marker>';
      defs += '<marker id="mk_circle_e_' + cid + '" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">' +
        '<circle cx="4.5" cy="4.5" r="3" fill="#0b0c14" stroke="' + col + '" stroke-width="1.8"/></marker>';
      defs += '<marker id="mk_bar_e_' + cid + '" markerWidth="11" markerHeight="9" refX="9.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M1.5,1 L1.5,8 M3.5,1 L10,4.5 L3.5,8 z" fill="' + col + '" stroke="' + col + '" stroke-width="1.5"/></marker>';

      ['classic', 'open', 'block_open', 'diamond', 'diamond_open', 'circle', 'bar'].forEach(function(mType) {
        defs += '<marker id="mk_' + mType + '_s_' + cid + '" markerWidth="11" markerHeight="9" refX="8.5" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">' +
          (mType === 'classic' ? '<path d="M0,1 L9,4.5 L0,8 L2,4.5 z" fill="' + col + '"/>' :
           mType === 'open' ? '<path d="M1,1.2 L8.5,4.5 L1,7.8" fill="none" stroke="' + col + '" stroke-width="1.8"/>' :
           mType === 'block_open' ? '<path d="M1,1.2 L9,4.5 L1,7.8 z" fill="#0b0c14" stroke="' + col + '" stroke-width="1.6"/>' :
           mType === 'diamond' ? '<path d="M0.5,4.5 L5.2,1 L10,4.5 L5.2,8 z" fill="' + col + '"/>' :
           mType === 'diamond_open' ? '<path d="M0.8,4.5 L5.2,1.2 L9.6,4.5 L5.2,7.8 z" fill="#0b0c14" stroke="' + col + '" stroke-width="1.6"/>' :
           mType === 'circle' ? '<circle cx="5.5" cy="4.5" r="3" fill="#0b0c14" stroke="' + col + '" stroke-width="1.8"/>' :
           '<path d="M7.5,1 L7.5,8" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round"/>') +
          '</marker>';
      });
    });
    return defs;
  }

  // Override rPol with Draw.io Multi-Algorithm SVG Edge Renderer + Label Anti-Collision
  window.rPol = function() {
    var svg = G('svg');
    if (!svg) return;
    window.rZones();
    window.syncUnitConnsMeta();

    svg.setAttribute('viewBox', '0 0 6000 6000');
    svg.setAttribute('width', 6000);
    svg.setAttribute('height', 6000);

    var colorsSet = new Set(['#38bdf8', '#818cf8', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#f43f5e']);
    conns.forEach(function(c) {
      var m = window.ensureConnMeta(c);
      if (m.color) colorsSet.add(m.color);
    });

    var h = '<defs>' +
      '<filter id="glowF"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<marker id="aDeb" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto"><path d="M0,0 L9,3.5 L0,7" fill="rgba(167,139,250,.9)"/></marker>' +
      '<marker id="aAtak" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto"><path d="M0,0 L9,3.5 L0,7" fill="rgba(248,113,113,.95)"/></marker>' +
      buildMarkerDefs(colorsSet) +
    '</defs>';

    var simActiveNodes = new Set();
    if (typeof simRunning !== 'undefined' && simRunning) {
      nodes.forEach(function(nd) {
        var el = G(nd.id);
        if (el && (el.classList.contains('sim-active') || el.classList.contains('always-on'))) simActiveNodes.add(nd.id);
      });
    }

    var labelsHtml = '';
    var placedLabels = [];

    conns.forEach(function(c) {
      var f = nodes.find(function(n) { return n.id === c.fi; });
      var t = nodes.find(function(n) { return n.id === c.ti; });
      if (!f || !t) return;

      var m = window.ensureConnMeta(c);
      var sides = resolveSmartSides(f, t, m.af, m.at);
      var p1 = getAnchorPoint(f, sides.s1);
      var p2 = getAnchorPoint(t, sides.s2);
      var geom = window.buildEdgeGeometry(p1, p2, m.algo, m.bend);
      var pathD = geom.d;

      var col = m.color || '#818cf8';
      var cid = col.replace(/[^a-zA-Z0-9]/g, '');
      var isSelected = window.selConnId === c.id;
      var isSimActive = (typeof simRunning !== 'undefined' && simRunning) && simActiveNodes.has(c.fi) && simActiveNodes.has(c.ti);

      var sw = m.weight === 'thin' ? 1.6 : (m.weight === 'bold' ? 3.8 : (m.weight === 'double' ? 6.2 : 2.5));
      if (isSimActive) sw += 0.8;

      var dashAttr = '';
      if (m.dash === 'dashed') dashAttr = ' stroke-dasharray="8 5"';
      else if (m.dash === 'dotted') dashAttr = ' stroke-dasharray="2.5 4.5" stroke-linecap="round"';
      else if (m.dash === 'flow') dashAttr = ' stroke-dasharray="10 6"';

      var mkStart = (m.startMarker && m.startMarker !== 'none') ? ' marker-start="url(#mk_' + m.startMarker + '_s_' + cid + ')"' : '';
      var mkEnd = (m.endMarker && m.endMarker !== 'none') ? ' marker-end="url(#mk_' + m.endMarker + '_e_' + cid + ')"' : '';

      var op = isSelected ? '1' : (isSimActive ? '0.95' : ((typeof simRunning !== 'undefined' && simRunning) ? '0.25' : '0.88'));

      if (isSelected) {
        h += '<path d="' + pathD + '" fill="none" stroke="' + col + '" stroke-width="' + (sw + 7) + '" stroke-opacity="0.28" stroke-linecap="round" stroke-linejoin="round"/>';
      }

      if (m.weight === 'double') {
        h += '<path d="' + pathD + '" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + mkStart + mkEnd + '/>';
        h += '<path d="' + pathD + '" fill="none" stroke="#080a12" stroke-opacity="0.94" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + '/>';
      } else {
        h += '<path d="' + pathD + '" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + mkStart + mkEnd + '>' +
          (m.dash === 'flow' ? '<animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.1s" repeatCount="indefinite"/>' : '') +
        '</path>';
      }

      var pSize = isSimActive ? 4.5 : 3;
      var pDur1 = isSimActive ? '1.5s' : '2.8s';
      h += '<circle r="' + pSize + '" fill="' + col + '" opacity="0.88"' + (isSimActive ? ' filter="url(#glowF)"' : '') + '>' +
        '<animateMotion dur="' + pDur1 + '" repeatCount="indefinite" path="' + pathD + '"/></circle>';

      h += '<path class="hit" d="' + pathD + '" fill="none" stroke="transparent" stroke-width="18" style="cursor:pointer" onclick="zmienTypPol(\'' + c.id + '\', event)"/>';

      if (m.seq || m.label) {
        var txt = (m.seq ? m.seq + ' ' : '') + (m.label || '');
        var charW = 0;
        for (var k = 0; k < txt.length; k++) {
          charW += txt.charCodeAt(k) > 255 ? 11.2 : 6.4;
        }
        var pillW = Math.max(44, Math.round(charW + (m.seq ? 22 : 16)));
        var pillH = 22;
        var midX = geom.mid.x;
        var midY = geom.mid.y;

        // Anti-collision: nudge label vertically if it overlaps a previously placed label
        for (var att = 0; att < 5; att++) {
          var hit = placedLabels.some(function(b) {
            return Math.abs(midX - b.cx) < (pillW + b.w) / 2 + 4 && Math.abs(midY - b.cy) < (pillH + b.h) / 2 + 3;
          });
          if (!hit) break;
          midY += (att % 2 === 0 ? 1 : -1) * (att + 1) * 14;
        }
        placedLabels.push({ cx: midX, cy: midY, w: pillW, h: pillH });

        var lx = Math.round(midX - pillW / 2);
        var ly = Math.round(midY - pillH / 2);

        labelsHtml += '<g class="edge-lbl-g" style="cursor:pointer" onclick="zmienTypPol(\'' + c.id + '\', event)">' +
          '<rect x="' + lx + '" y="' + ly + '" width="' + pillW + '" height="' + pillH + '" rx="6" fill="rgba(9,11,21,0.94)" stroke="' + col + '" stroke-width="' + (isSelected ? '1.8' : '1.15') + '" stroke-opacity="0.82"/>' +
          '<text x="' + midX + '" y="' + (midY + 4) + '" text-anchor="middle" fill="#f1f5f9" font-family="JetBrains Mono, monospace" font-size="10.2" font-weight="600">' +
            (m.seq ? '<tspan fill="' + col + '" font-weight="800">' + escHtml(m.seq) + '</tspan> ' : '') +
            escHtml(m.label || '') +
          '</text>' +
        '</g>';
      }
    });

    h += labelsHtml;
    svg.innerHTML = h;
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// PART 3C: INTERACTIVE DRAW.IO ARROW INSPECTOR + COLLAB UNITS SIDEBAR UI
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  if (typeof window === 'undefined') return;

  // Clicking an arrow on the canvas selects it and opens the Draw.io Arrow Inspector
  window.zmienTypPol = function(cid, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var c = conns.find(function(x) { return x.id === cid; });
    if (!c) return;
    sel.clear();
    if (typeof aktZazn === 'function') aktZazn();
    window.selConnId = cid;
    rPol();
    window.pokazLinie(cid);
  };

  window.otworzEdytorStrzalek = function() {
    if (!conns.length) {
      if (typeof pokazToast === 'function') pokazToast('当前画布暂无连线');
      return;
    }
    var targetId = (window.selConnId && conns.some(function(c) { return c.id === window.selConnId; }))
      ? window.selConnId
      : conns[0].id;
    window.zmienTypPol(targetId);
  };

  window.ustawMetaLinii = function(cid, key, val) {
    var c = conns.find(function(x) { return x.id === cid; });
    if (!c) return;
    var m = window.ensureConnMeta(c);
    c._userEdited = true;
    m[key] = val;
    if (key === 'startMarker' || key === 'endMarker') {
      c.tp = (m.startMarker && m.startMarker !== 'none') ? 'two' : (m.dash === 'dashed' ? 'continuous' : 'one');
    }
    rPol();
    window.pokazLinie(cid);
  };

  window.zastosujSemantykeLinii = function(cid, semKey) {
    var c = conns.find(function(x) { return x.id === cid; });
    var preset = window.EDGE_SEMANTIC_PRESETS[semKey];
    if (!c || !preset) return;
    var m = window.ensureConnMeta(c);
    c._userEdited = true;
    m.sem = preset.key;
    m.algo = preset.algo;
    m.weight = preset.weight;
    m.dash = preset.dash;
    m.startMarker = preset.startMarker;
    m.endMarker = preset.endMarker;
    m.color = preset.color;
    c.tp = semKey === 'loop' ? 'continuous' : (semKey === 'store' ? 'two' : 'one');
    rPol();
    window.pokazLinie(cid);
  };

  window.zastosujStylDoWszystkich = function(cid) {
    var src = conns.find(function(x) { return x.id === cid; });
    if (!src) return;
    var sm = window.ensureConnMeta(src);
    conns.forEach(function(c) {
      var m = window.ensureConnMeta(c);
      c._userEdited = true;
      m.algo = sm.algo;
      m.weight = sm.weight;
      m.dash = sm.dash;
    });
    rPol();
    if (typeof pokazToast === 'function') pokazToast('✓ 已将走线算法与粗细应用到全图 ' + conns.length + ' 条连线');
  };

  window.pokazLinie = function(cid) {
    var c = conns.find(function(x) { return x.id === cid; });
    if (!c) return;
    var m = window.ensureConnMeta(c);
    var f = nodes.find(function(n) { return n.id === c.fi; });
    var t = nodes.find(function(n) { return n.id === c.ti; });
    var fd = f ? AD_MAP.get(f.defId) : null;
    var td = t ? AD_MAP.get(t.defId) : null;
    var fName = fd ? getAgentName(fd.id) : c.fi;
    var tName = td ? getAgentName(td.id) : c.ti;

    var btnStyle = function(active, col) {
      var ac = col || m.color || '#38bdf8';
      return 'padding:5px 7px;border-radius:7px;font-family:var(--mn);font-size:9.5px;font-weight:' + (active ? '700' : '500') +
        ';cursor:pointer;border:1px solid ' + (active ? ac : 'rgba(255,255,255,0.1)') +
        ';background:' + (active ? ac + '24' : 'rgba(255,255,255,0.03)') +
        ';color:' + (active ? '#f8fafc' : 'var(--t2)') + ';transition:all .15s;';
    };

    var edgeIndex = conns.findIndex(function(x) { return x.id === cid; });
    var edgePickerHtml = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">';
    conns.forEach(function(cn, idx) {
      var cm = window.ensureConnMeta(cn);
      var on = cn.id === cid;
      edgePickerHtml += '<button type="button" onclick="zmienTypPol(\'' + cn.id + '\')" style="' + btnStyle(on, cm.color) + '">' +
        (cm.seq ? escHtml(cm.seq) : '#' + (idx + 1)) +
      '</button>';
    });
    edgePickerHtml += '</div>';

    var semHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
    Object.keys(window.EDGE_SEMANTIC_PRESETS).forEach(function(k) {
      var sp = window.EDGE_SEMANTIC_PRESETS[k];
      var on = m.sem === k;
      semHtml += '<button type="button" onclick="zastosujSemantykeLinii(\'' + cid + '\',\'' + k + '\')" title="' + escHtml(sp.desc) + '" style="text-align:left;' + btnStyle(on, sp.color) + '">' +
        '<div style="font-size:10px;color:' + (on ? '#fff' : sp.color) + ';font-weight:700">' + escHtml(sp.name.split(' ')[0] + ' ' + sp.name.split(' ')[1]) + '</div>' +
      '</button>';
    });
    semHtml += '</div>';

    var algos = [
      ['ortho', '📐 正交圆角 Ortho'],
      ['bezier', '〰️ 平滑曲线 Bezier'],
      ['elbow', '📏 直角折线 Elbow'],
      ['arc', '🌈 跨线弧桥 Arc'],
      ['straight', '↗️ 直线直连 Straight']
    ];
    var algoHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
    algos.forEach(function(a) {
      algoHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'algo\',\'' + a[0] + '\')" style="' + btnStyle(m.algo === a[0]) + '">' + a[1] + '</button>';
    });
    algoHtml += '</div>';

    var weights = [
      ['thin', '细 1.6px'],
      ['normal', '标准 2.5px'],
      ['bold', '粗 3.8px'],
      ['double', '双轨管道 ══']
    ];
    var weightHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
    weights.forEach(function(w) {
      weightHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'weight\',\'' + w[0] + '\')" style="' + btnStyle(m.weight === w[0]) + '">' + w[1] + '</button>';
    });
    weightHtml += '</div>';

    var dashes = [
      ['solid', '─── 实线'],
      ['dashed', '- - - 虚线'],
      ['dotted', '···· 点线'],
      ['flow', '⚡ 动态流']
    ];
    var dashHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:5px">';
    dashes.forEach(function(d) {
      dashHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'dash\',\'' + d[0] + '\')" style="' + btnStyle(m.dash === d[0]) + '">' + d[1] + '</button>';
    });
    dashHtml += '</div>';

    var markers = [
      ['none', '无 None'],
      ['classic', '▶ 实心三角'],
      ['open', '> 开放箭头'],
      ['block_open', '▷ 空心三角'],
      ['diamond', '◆ 实心菱形'],
      ['diamond_open', '◇ 空心菱形'],
      ['circle', '● 圆点探针'],
      ['bar', '|▶ 门禁竖杠']
    ];
    var mkStartHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
    var mkEndHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
    markers.forEach(function(mk) {
      mkStartHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'startMarker\',\'' + mk[0] + '\')" style="' + btnStyle((m.startMarker || 'none') === mk[0]) + '">' + mk[1] + '</button>';
      mkEndHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'endMarker\',\'' + mk[0] + '\')" style="' + btnStyle((m.endMarker || 'classic') === mk[0]) + '">' + mk[1] + '</button>';
    });
    mkStartHtml += '</div>';
    mkEndHtml += '</div>';

    var sides = [
      ['auto', '自动'],
      ['top', '↑ 上'],
      ['right', '→ 右'],
      ['bottom', '↓ 下'],
      ['left', '← 左']
    ];
    var afHtml = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">';
    var atHtml = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">';
    sides.forEach(function(s) {
      afHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'af\',\'' + s[0] + '\')" style="' + btnStyle((m.af || 'auto') === s[0]) + '">' + s[1] + '</button>';
      atHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'at\',\'' + s[0] + '\')" style="' + btnStyle((m.at || 'auto') === s[0]) + '">' + s[1] + '</button>';
    });
    afHtml += '</div>';
    atHtml += '</div>';

    var bends = [
      [-45, '↖ 上/左绕 (-45px)'],
      [0,   '● 居中默认 (0)'],
      [45,  '↘ 下/右绕 (+45px)']
    ];
    var bendHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px">';
    bends.forEach(function(b) {
      bendHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'bend\',' + b[0] + ')" style="' + btnStyle(Number(m.bend || 0) === b[0]) + '">' + b[1] + '</button>';
    });
    bendHtml += '</div>';

    var swatches = ['#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#10b981', '#14b8a6', '#f59e0b', '#f97316', '#ef4444'];
    var colorHtml = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">';
    swatches.forEach(function(sc) {
      var on = (m.color || '').toLowerCase() === sc.toLowerCase();
      colorHtml += '<button type="button" onclick="ustawMetaLinii(\'' + cid + '\',\'color\',\'' + sc + '\')" style="width:20px;height:20px;border-radius:50%;background:' + sc + ';border:' + (on ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)') + ';cursor:pointer;box-shadow:' + (on ? '0 0 10px ' + sc : 'none') + '"></button>';
    });
    colorHtml += '</div>';

    var h =
      '<div class="ds-card" style="border-left:3px solid ' + (m.color || '#38bdf8') + ';background:linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.8))">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">' +
          '<span style="font-family:var(--mn);font-size:9px;font-weight:800;color:' + (m.color || '#38bdf8') + ';letter-spacing:.08em">🎨 DRAW.IO 连线语义与箭头编辑器</span>' +
          '<span style="font-family:var(--mn);font-size:9px;color:var(--t2)">#' + (edgeIndex + 1) + '/' + conns.length + '</span>' +
        '</div>' +
        '<div style="font-family:var(--hd);font-size:13px;font-weight:700;color:#f8fafc;margin-top:5px">' +
          escHtml(fName) + ' <span style="color:' + (m.color || '#38bdf8') + '">──►</span> ' + escHtml(tName) +
        '</div>' +
        edgePickerHtml +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#38bdf8">1. 箭头代表什么？（一键切换架构语义预设）</div>' +
        semHtml +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#a78bfa">2. 步骤序号与线上语义标签</div>' +
        '<div style="display:grid;grid-template-columns:68px 1fr;gap:6px">' +
          '<input type="text" value="' + escHtml(m.seq || '') + '" placeholder="序号 ①" oninput="ustawMetaLinii(\'' + cid + '\',\'seq\',this.value)" style="padding:6px 8px;border-radius:7px;border:1px solid var(--brd);background:rgba(0,0,0,0.3);color:#f8fafc;font-family:var(--mn);font-size:10.5px"/>' +
          '<input type="text" value="' + escHtml(m.label || '') + '" placeholder="线上标签（如：塞入上下文 / ask_B）" oninput="ustawMetaLinii(\'' + cid + '\',\'label\',this.value)" style="padding:6px 8px;border-radius:7px;border:1px solid var(--brd);background:rgba(0,0,0,0.3);color:#f8fafc;font-family:var(--mn);font-size:10.5px"/>' +
        '</div>' +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#34d399">3. 走线算法 & 避让偏移 (Routing & Detour Offset)</div>' +
        algoHtml +
        bendHtml +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#fbbf24">4. 线条粗细 / 双轨管道 & 虚实动画</div>' +
        weightHtml +
        dashHtml +
        colorHtml +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#f472b6">5. 终点箭头样式 (Target Arrowhead)</div>' +
        mkEndHtml +
        '<div class="ds-l" style="color:#94a3b8;margin-top:8px">起点端头样式 (Source Marker)</div>' +
        mkStartHtml +
      '</div>' +

      '<div class="ds">' +
        '<div class="ds-l" style="color:#60a5fa">6. 进出端口锚点方向 (Port Anchor Side)</div>' +
        '<div style="font-size:9.5px;color:var(--t2);margin-bottom:3px">起点从哪一侧发出：</div>' + afHtml +
        '<div style="font-size:9.5px;color:var(--t2);margin:6px 0 3px">终点从哪一侧进入：</div>' + atHtml +
      '</div>' +

      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button type="button" class="btn btn-p" style="flex:1;justify-content:center;font-size:10px" onclick="zastosujStylDoWszystkich(\'' + cid + '\')">⚡ 同步算法与粗细到全图</button>' +
        '<button type="button" class="btn btn-d" style="font-size:10px" onclick="usunPolacz(\'' + cid + '\')">✕ 删除连线</button>' +
      '</div>' +
      (actPr ? '<button type="button" class="btn" style="width:100%;justify-content:center;margin-top:6px;font-size:10px" onclick="window.selConnId=null;rPol();pokazInfoPr(\'' + actPr + '\')">← 返回当前单元/预设总览</button>' : '');

    G('srS').innerHTML = h;
  };

  // Inject "🎨 箭头样式" button into canvas bottom control bar (.cv-ctrl)
  function injectEdgeToolbarBtn() {
    var ctrl = document.querySelector('.cv-ctrl');
    if (!ctrl || document.getElementById('edgeEditBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'edgeEditBtn';
    btn.style.cssText = 'border-color:rgba(56,189,248,0.4);color:#38bdf8;font-weight:600';
    btn.innerHTML = '🎨 箭头样式';
    btn.title = '打开 Draw.io 连线语义、走线算法、粗细与箭头端头编辑器';
    btn.onclick = function() { window.otworzEdytorStrzalek(); };
    var cBtn = document.getElementById('cBtn');
    if (cBtn && cBtn.parentNode === ctrl) {
      ctrl.insertBefore(btn, cBtn.nextSibling);
    } else {
      ctrl.appendChild(btn);
    }
  }

  // Left sidebar Collaboration Units list renderer (supports UNIT_CAT_ORDER + UNIT_CAT_META + UNIT_IDS + u.unitCat)
  window.rJednostki = function() {
    var el = document.getElementById('unL');
    if (!el || !window.UNIT_META) return;
    var qEl = document.getElementById('unS');
    var q = (qEl && qEl.value ? qEl.value : '').trim().toLowerCase();
    var catSel = document.getElementById('unCatSel');
    var selCat = (catSel && catSel.value) ? catSel.value : '';

    var h =
      '<div style="padding:7px 9px;margin-bottom:8px;border-radius:9px;background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(99,102,241,0.08));border:1px solid rgba(56,189,248,0.28);font-size:10px;line-height:1.45;color:var(--t1)">' +
        '<div style="font-family:var(--mn);font-size:8.8px;font-weight:800;color:#38bdf8;letter-spacing:.05em;margin-bottom:2px">🧩 4 级渐进推导 · 异构节点 + Draw.io 箭头</div>' +
        '<div>点击任一单元加载结构化泳道图；<b>直接点击画布上的任何箭头</b>即可调整其走线算法、双轨粗细与端头。</div>' +
      '</div>';

    var catOrder = window.UNIT_CAT_ORDER || ['L12', 'L3', 'L4S', 'L4P'];
    var allUnitIds = window.UNIT_IDS || Object.keys(window.UNIT_META);

    catOrder.forEach(function(catKey) {
      if (selCat && selCat !== 'all' && selCat !== catKey) return;
      var cm = (window.UNIT_CAT_META && window.UNIT_CAT_META[catKey]) || { name: catKey, color: '#38bdf8' };
      var unitIds = allUnitIds.filter(function(uid) {
        var u = window.UNIT_META[uid];
        if (!u || (u.unitCat || u.cat) !== catKey) return false;
        if (!q) return true;
        return (u.name + ' ' + u.sub + ' ' + u.formula + ' ' + u.badge).toLowerCase().includes(q);
      });
      if (!unitIds.length) return;
      h += '<div class="pa-cat" style="color:' + cm.color + ';margin-top:8px">' + escHtml(cm.name) + ' (' + unitIds.length + ')</div>';
      unitIds.forEach(function(uid) {
        var u = window.UNIT_META[uid];
        if (!u) return;
        var isOn = (typeof actPr !== 'undefined' && actPr === uid) ? ' on' : '';
        var nCnt = (typeof PR !== 'undefined' && PR[uid]) ? PR[uid].length : 0;
        var eCnt = (typeof PC !== 'undefined' && PC[uid]) ? PC[uid].length : 0;
        h += '<div class="pr-item' + isOn + '" id="ui_' + uid + '" onclick="ladujPreset(\'' + uid + '\')" style="--pc:' + u.color + ';border-left:3px solid ' + u.color + ';display:flex;flex-direction:column;align-items:stretch;gap:3px;padding:8px 10px;margin-bottom:6px">' +
          '<div class="pr-hdr" style="display:flex;align-items:center;gap:6px;width:100%">' +
            '<div class="pr-ico" style="color:' + u.color + ';flex-shrink:0;width:22px;height:22px">' + (typeof svgPresetu === 'function' ? svgPresetu(uid, 16) : '🧩') + '</div>' +
            '<span class="pr-name" style="font-size:11px;font-weight:700;flex:1;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(u.name) + '</span>' +
            '<span class="pr-cnt" style="font-family:var(--mn);font-size:8.5px;color:' + u.color + ';flex-shrink:0">' + nCnt + '节点·' + eCnt + '线</span>' +
          '</div>' +
          '<div class="pr-dsc" style="font-size:9.8px;color:var(--t2);line-height:1.35">' + escHtml(u.sub) + '</div>' +
          '<div class="pr-bar" style="font-family:var(--mn);font-size:8.5px;color:' + u.color + ';opacity:.92;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(u.formula) + '</div>' +
        '</div>';
      });
    });
    el.innerHTML = h;
  };

  window.filtrujJednostki = function() {
    window.rJednostki();
  };

  // Override pokazInfoPr so Collaboration Units replace the misleading "0 Opus / 5 Sonnet / 0 Haiku" bar with real Heterogeneous Archetype Chips
  var _origPokazInfoPr = window.pokazInfoPr;
  window.pokazInfoPr = function(pid) {
    if (typeof _origPokazInfoPr === 'function') _origPokazInfoPr(pid);
    var u = window.UNIT_META && window.UNIT_META[pid];
    if (!u) return;
    var srS = G('srS');
    if (!srS) return;

    var counts = { agent: 0, port: 0, tool: 0, decision: 0, control: 0, primitive: 0, store: 0 };
    var pr = (typeof PR !== 'undefined' && PR[pid]) ? PR[pid] : [];
    pr.forEach(function(p) {
      var k = window.getNodeKind(p.d);
      counts[k] = (counts[k] || 0) + 1;
    });

    var roleEl = srS.querySelector('.ds-avatar-info .ds-role');
    if (roleEl) {
      roleEl.innerHTML = '<span style="color:' + u.color + ';font-weight:700">' + escHtml(u.badge) + '</span> · ' + pr.length + ' 异构组件 · ' + ((PC[pid] || []).length) + ' 条语义连线';
    }
    var compEl = srS.querySelector('.ds-avatar-info .ds-comp');
    if (compEl) {
      var chips = [];
      if (counts.agent)     chips.push('<span class="ds-comp-chip" style="border-color:#60a5fa66;color:#93c5fd;background:rgba(96,165,250,0.12)">🤖 ' + counts.agent + ' 智能体</span>');
      if (counts.port)      chips.push('<span class="ds-comp-chip" style="border-color:#38bdf866;color:#7dd3fc;background:rgba(56,189,248,0.12)">⇄ ' + counts.port + ' 接口</span>');
      if (counts.tool)      chips.push('<span class="ds-comp-chip" style="border-color:#f59e0b66;color:#fcd34d;background:rgba(245,158,11,0.12)">🔧 ' + counts.tool + ' 工具槽</span>');
      if (counts.decision)  chips.push('<span class="ds-comp-chip" style="border-color:#fbbf2466;color:#fde68a;background:rgba(251,191,36,0.12)">◆ ' + counts.decision + ' 判断门</span>');
      if (counts.control)   chips.push('<span class="ds-comp-chip" style="border-color:#818cf866;color:#c7d2fe;background:rgba(129,140,248,0.12)">🎛️ ' + counts.control + ' 控台</span>');
      if (counts.primitive) chips.push('<span class="ds-comp-chip" style="border-color:#10b98166;color:#6ee7b7;background:rgba(16,185,129,0.12)">⚡ ' + counts.primitive + ' 原语</span>');
      if (counts.store)     chips.push('<span class="ds-comp-chip" style="border-color:#06b6d466;color:#67e8f9;background:rgba(6,182,212,0.12)">🗄️ ' + counts.store + ' 共享区</span>');
      compEl.innerHTML = '<div class="ds-comp-chips" style="flex-wrap:wrap;gap:4px;margin-top:4px">' + chips.join('') + '</div>';
    }
  };

  // Right sidebar Collaboration Unit deduction card + quick edge list
  window.renderUnitMetaCard = function(pid) {
    var u = window.UNIT_META && window.UNIT_META[pid];
    if (!u) return '';
    var edgeRows = '';
    if (typeof conns !== 'undefined' && conns.length) {
      edgeRows = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">' +
          '<span style="font-family:var(--mn);font-size:9px;font-weight:700;color:#38bdf8">🎨 本图连线语义清单（点击任一连线编辑箭头）</span>' +
        '</div>';
      conns.forEach(function(c, idx) {
        var m = window.ensureConnMeta(c);
        edgeRows += '<div onclick="zmienTypPol(\'' + c.id + '\')" style="display:flex;align-items:center;gap:6px;padding:4px 7px;margin-bottom:3px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);cursor:pointer;font-size:10px">' +
          '<span style="font-family:var(--mn);font-weight:800;color:' + (m.color || '#38bdf8') + ';min-width:22px">' + escHtml(m.seq || ('#' + (idx + 1))) + '</span>' +
          '<span style="flex:1;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(m.label || '连线') + '</span>' +
          '<span style="font-family:var(--mn);font-size:8.5px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--t2)">' + escHtml(m.algo + '/' + m.weight) + '</span>' +
        '</div>';
      });
      edgeRows += '</div>';
    }

    return '<div class="ds" style="border:1px solid ' + u.color + '44;border-radius:12px;padding:10px 12px;background:linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.5))">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<span style="font-family:var(--mn);font-size:9px;font-weight:800;color:' + u.color + ';letter-spacing:.06em">🧩 协作单元推导卡 · ' + escHtml(u.badge) + '</span>' +
      '</div>' +
      '<div style="font-family:var(--mn);font-size:10px;color:#f8fafc;padding:6px 8px;border-radius:7px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);margin-bottom:8px;line-height:1.45">' +
        escHtml(u.formula) +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:5px;font-size:10.5px;line-height:1.45">' +
        '<div style="padding:5px 8px;border-radius:7px;background:rgba(56,189,248,0.08);border-left:2.5px solid #38bdf8"><b style="color:#38bdf8">① 下一个是谁：</b>' + escHtml(u.decNext.who) + ' — <span style="color:var(--t2)">' + escHtml(u.decNext.text) + '</span></div>' +
        '<div style="padding:5px 8px;border-radius:7px;background:rgba(168,85,247,0.08);border-left:2.5px solid #a855f7"><b style="color:#c084fc">② 给他什么：</b>' + escHtml(u.decWhat.who) + ' — <span style="color:var(--t2)">' + escHtml(u.decWhat.text) + '</span></div>' +
        '<div style="padding:5px 8px;border-radius:7px;background:rgba(245,158,11,0.08);border-left:2.5px solid #f59e0b"><b style="color:#fbbf24">③ 停不停：</b>' + escHtml(u.decStop.who) + ' — <span style="color:var(--t2)">' + escHtml(u.decStop.text) + '</span></div>' +
      '</div>' +
      edgeRows +
    '</div>';
  };

  window.syncUnitsTopBtn = function(pid) {
    var btn = document.getElementById('unitsBtn');
    if (!btn) return;
    var isUnit = !!(pid && window.UNIT_META && window.UNIT_META[pid]);
    btn.classList.toggle('is-active', isUnit);
  };

  // Wrap ladujPreset so loading any preset or unit automatically dismisses the welcome hero overlay
  var _origLadujPreset = window.ladujPreset;
  window.ladujPreset = function(k) {
    if (typeof zamknijHero === 'function') zamknijHero();
    window.selConnId = null;
    if (typeof _origLadujPreset === 'function') _origLadujPreset(k);
  };

  window.otworzJednostki = function(defaultUnitId) {
    if (typeof zamknijHero === 'function') zamknijHero();
    var tab = document.getElementById('slTabUn');
    if (tab && typeof zmienTab === 'function') zmienTab('un', tab);
    if (typeof window.rJednostki === 'function') window.rJednostki();
    var target = defaultUnitId || ((typeof actPr !== 'undefined' && window.UNIT_META && window.UNIT_META[actPr]) ? actPr : 'unit_l1_ports');
    if (typeof window.ladujPreset === 'function') window.ladujPreset(target);
  };

  function initCollabUnitsUI() {
    injectEdgeToolbarBtn();
    if (typeof window.rJednostki === 'function') window.rJednostki();
    if (typeof rPalete === 'function') rPalete();
    if (typeof aktTabCounts === 'function') aktTabCounts();
    if (window.location.hash === '#units') {
      setTimeout(function() { window.otworzJednostki('unit_l1_ports'); }, 60);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollabUnitsUI);
  } else {
    setTimeout(initCollabUnitsUI, 20);
  }
})();
