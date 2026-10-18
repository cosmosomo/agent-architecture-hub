#!/usr/bin/env node
// 从 l1a_results.json 组装 9 条 L1a 黑板记录并逐条追加
const fs = require('fs');
const path = require('path');
const WS = 'C:/Users/COLORFIRE/hub-workspaces/probe-retest-zcode-1018';
const R = JSON.parse(fs.readFileSync(path.join(WS, 'l1a_results.json'), 'utf8'));
const appendPath = path.join(__dirname, 'retest1018_append.js');

const base = { family: 'claude', layer: 'L1a', route: 'claude/L1a/claude-agent-acp', surface: 'acp-bridge' };
const cond = 'claude-agent-acp 0.90.0（acpx 内置注册表的桥，node 直跑其 dist/index.js），底层 claude-agent-sdk 的 claude.exe（claude 2.1.296）；模型 claude-haiku-5-5（渠道 yinzi api.yinziapi.top，settings.json env ANTHROPIC_MODEL=claude-haiku-5-5）；ACP SDK 1.8.0 自写客户端 initialize→newSession→prompt；脚本 channels/probe/scripts/retest1018_l1a.mjs，原始返回全在 工作区/l1a_results.json';

const S = (o) => JSON.stringify(o);
const recs = [
  {
    ...base, capability: 'observe-history', result: 'pass',
    condition: cond + '；session/load 加载 L0 原生会话 N1=70924f50（CLI 所建，1 轮含暗号与工具调用）',
    evidence: 'loadSession 返回 sessionId+modes+configOptions；加载期间桥经 session/update 完整回放历史：user_message_chunk（原文 记住暗号 PROBE_RT_ACP_HIST_555，只回复 ACK_HIST）→ tool_call bash_code_execution pending→completed（Output: HELLO_CHECK）→ agent_message_chunk（The script executed successfully and printed HELLO_CHECK.）；回放后同 sessionId 续 prompt，stopReason=end_turn、回复 ACK_HIST（取自被加载会话的内容）',
    cmd: 'conn.loadSession({cwd:<工作区>,mcpServers:[],sessionId:70924f50-c96c-4d80-be72-c286260ea17c})；随后 conn.prompt 同 sessionId 问暗号',
    note: '全部轮次原样回放、无丢弃：observe-history 成立。原第 180 行证据只是 loadSession:true / readResumedSession:true 两个标志位（声明而非行为），本次是真实回放事件流。注意：续轮模型答 ACK_HIST 而非暗号本身，haiku-5.5 经该中转答题质量不稳，不影响本格判据',
  },
  {
    ...base, capability: 'state', result: 'pass',
    condition: cond + '；同一会话观察 运行中/正常结束/被打断/已关闭 四态',
    evidence: '长轮（数到 300）进行中第 10 秒 update 流持续到达（末 12 条为 agent_message_chunk×10 + usage_update×2），轮毕 stopReason=end_turn（本轮 update 共 83 条）；cancel 轮 stopReason=cancelled；closeSession 后 prompt 报 Internal error。四种状态判据均可外部观察',
    cmd: 'conn.prompt 长任务期间记录 clientHandler.sessionUpdate；配合 conn.cancel / conn.closeSession 对照',
    note: '原第 181 行只有 end_turn 一态；本次补齐运行中（update 流）与 cancelled/closed 态。完成与否看 stopReason，与 channels/README.md 第七节判据一致',
  },
  {
    ...base, capability: 'cancel', result: 'pass',
    condition: cond + '；长轮（从 1 数到 900）进行中第 8 秒 cancel',
    evidence: 'conn.cancel 无错误；该轮以 stopReason:"cancelled" 结束、无回复文本；随后同 sessionId prompt「回复 STILL_ALIVE」→ stopReason=end_turn、text=STILL_ALIVE',
    cmd: 'conn.prompt 长任务 → 8s 后 conn.cancel({sessionId}) → 待本轮返回 → conn.prompt 同会话',
    note: '轮停、会话存活可续：cancel 成立。原第 182 行只有方法名与 cancelled 字样，本次补了打断后可续的行为证据',
  },
  {
    ...base, capability: 'close', result: 'pass',
    condition: cond + '；对已加载的原生会话 N1 执行 closeSession',
    evidence: 'conn.closeSession 返回 {}（成功无错误）；随后对同一 sessionId prompt 返回错误 Internal error',
    cmd: 'conn.closeSession({sessionId:70924f50-...}) → conn.prompt 同 sessionId',
    note: '关闭后会话不可再用：close 成立。原第 183 行证据只是声明 sessionCapabilities.close:{}，本次为真实调用与关闭后行为',
  },
  {
    ...base, capability: 'compact', result: 'pass',
    condition: cond + '；会话 B：喂 5.8KB 材料（其后 _meta.model_usage 累计 8957 tok），再 /compact，再对比用量',
    evidence: '/compact 轮 _meta.quota.model_usage[claude-haiku-5-5] 累计 {inputTokens:2164,cachedWriteTokens:106123,outputTokens:5138}（5138 output 即总结生成量）；压缩后下一轮 _meta 的 token_count 与 model_usage 全部重置为 2154——上下文从十万级回落到 2K 级',
    cmd: 'conn.prompt(会话B, 材料) → conn.prompt(会话B, "/compact") → conn.prompt(会话B, 标记词提问)，每轮读 promptResponse._meta.quota',
    note: '上下文用量下降判据满足：compact 成立。原第 187 行证据是钩子名（hook:PostCompact, handler:recordSummary），声明而非行为；本次以 _meta 用量对比为准。/compact 轮回复文本为空，与 L0 一致',
  },
  {
    ...base, capability: 'model-list', result: 'pass',
    condition: cond + '；newSession 响应 configOptions',
    evidence: 'configOptions[model].options 原文五档：default（Default (recommended)/Opus 5.5）、opus（Custom Opus model claude-opus-5-5）、claude-fable-5-1[1m]（Fable 5.1）、sonnet（Custom Sonnet model claude-sonnet-5-5）、haiku（Custom Haiku model claude-haiku-5-5）；haiku 档实轮 _meta.model_usage 证实跑的正是 claude-haiku-5-5',
    cmd: 'conn.newSession({cwd,mcpServers:[]}) → 读 response.configOptions',
    note: '列表来自桥的活响应，custom 描述与渠道配置（settings.json env DEFAULT_*_MODEL）逐一吻合，haiku 档经实轮验证：model-list 成立。fable=claude-fable-5-1[1m]（此前档案未记过）；opus/sonnet/fable 未实跑（用户红线，只在 haiku 内验证）',
  },
  {
    ...base, capability: 'model-new', result: 'partial',
    condition: cond + '；newSession 经 _meta.claudeCode.options.settings.env 注入 ANTHROPIC_MODEL=claude-haiku-5-5（会话 D）',
    evidence: '注入后 newSession 响应 configOptions[model].currentValue 仍为 "default"；但该会话首轮 _meta.quota.model_usage=[{model:"claude-haiku-5-5",...}]——实际模型 haiku',
    cmd: 'conn.newSession({_meta:{claudeCode:{options:{settings:{env:{ANTHROPIC_MODEL:"claude-haiku-5-5"}}}}}}) → conn.prompt',
    note: '记 partial：注入被接受、首轮实际跑 haiku，但渠道默认本就是 haiku（settings.json env ANTHROPIC_MODEL），注入效果与默认不可区分——唯一能区分的档位 opus/sonnet 被用户红线禁用。原第 189 行以 model_usage 出现 haiku 记 pass 属循环论证（不注入也是 haiku）。ACP newSession 无标准选模参数，选模只能 _meta 注入或建后 setSessionConfigOption',
  },
  {
    ...base, capability: 'mode-switch', result: 'pass',
    condition: cond + '；会话 D：setSessionMode(plan) 后要求写文件，再 setSessionMode(acceptEdits) 后同样要求',
    evidence: 'plan 轮：桥发来真实 session/request_permission，选项原文 exit-plan-default(allow_once)/exit-plan-clear-bypass(allow_always)/exit-plan-bypass(allow_always)/exit-plan-auto(allow_always)/reject(reject_once)；客户端选 reject 后该轮 stopReason=cancelled、acp_plan.txt 未创建。acceptEdits 轮：stopReason=end_turn，acp_edit.txt 真实创建且内容 EDIT_OK（磁盘核实）',
    cmd: 'conn.setSessionMode({sessionId,modeId:"plan"}) → prompt 写文件（客户端自动拒）→ conn.setSessionMode({modeId:"acceptEdits"}) → prompt 写文件',
    note: '切换后行为随之改变（写被挡[审批拒绝即 cancelled]→写成功）：mode-switch 成立，且顺带证实该桥的中途审批链路真实存在（有完整选项原文与答复生效）。原第 191 行证据只是 {mode:"plan"} 回显。附：桥默认模式 bypassPermissions（桥 stderr 有 canUseTool shadowed 警告）',
  },
  {
    ...base, capability: 'quota', result: 'partial',
    condition: cond + '；读 prompt 响应 _meta.quota',
    evidence: '_meta.quota 原文（A1 轮）：{token_count:{totalTokens:2154,inputTokens:2071,outputTokens:83,...}, model_usage:[{model:"claude-haiku-5-5",token_count:{totalTokens:3546,...}}]}——只有 token 用量与按模型分账，无剩余额度/窗口字段',
    cmd: '读 conn.prompt 响应的 _meta.quota 字段',
    note: '记 partial：能拿到会话级与按模型的 token 用量（压缩后归零可当判据），但无剩余额度/时间窗口——中转渠道本无订阅窗口。原第 192 行记 pass 名不副实：那是用量不是额度',
  },
];

let n = 0;
for (const rec of recs) {
  const tmp = path.join(WS, 'rec_tmp.json');
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 1));
  const { execFileSync } = require('child_process');
  console.log(execFileSync(process.execPath, [appendPath, tmp], { encoding: 'utf8' }).trim());
  n++;
}
console.log('appended', n, 'records');
