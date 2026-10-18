import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. act-deliver
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/artifacts+transcript',
  surface: 'daemon',
  capability: 'act-deliver',
  result: 'pass',
  condition: 'Antigravity 2.23.1, ArtifactMetadata + PLANNER_RESPONSE DONE',
  evidence: '智能体通过 write_to_file ArtifactMetadata 发布产物文件，并在最后一步交出 PLANNER_RESPONSE status=DONE；中心从 transcript.jsonl 中结构化提取产物路径与最终交付成果',
  cmd: 'write_to_file with ArtifactMetadata',
  note: '原生交付机制：产物文件持久化落盘，轮次以 DONE 明确完结'
});

// 2. act-request
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/ask_question+send_message',
  surface: 'daemon',
  capability: 'act-request',
  result: 'pass',
  condition: 'Antigravity 2.23.1, ask_question / send_message',
  evidence: '智能体在一轮中途调用 ask_question 挂起等待人类答复，或调用 send_message 向同伴/子智能体索取信息；中心可在事件流捕获请求并答复',
  cmd: 'ask_question / send_message tool call',
  note: '原生动作请求：支持阻塞式向人求助与非阻塞同伴求助'
});

// 3. act-yield
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/summaries-db',
  surface: 'daemon',
  capability: 'act-yield',
  result: 'pass',
  condition: 'Antigravity 2.23.1, run_command WaitMsBeforeAsync + schedule',
  evidence: '智能体启动后台任务后交出阶段文本并让出，conversation_summaries.db 标记 not_fully_idle=1 (CASCADE_RUN_STATUS_IDLE)；中心读出其正在等待后台任务结果',
  cmd: 'run_command with WaitMsBeforeAsync',
  note: '权威让出判据：IDLE/1 准确表征智能体进入主动让出、等待后台叫醒状态'
});

// 4. act-report
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/transcript-stream',
  surface: 'daemon',
  capability: 'act-report',
  result: 'pass',
  condition: 'Antigravity 2.23.1, mid-turn thinking and planner_response streaming',
  evidence: '多步任务执行中，智能体在工具调用之间持续输出阶段进展文本与思考签名，轮次不中断，transcript 实时逐步写入',
  cmd: 'tail -f transcript.jsonl',
  note: '多步轮次内流式持续上报，无需打断轮次即可感知进展'
});

// 5. ask-user
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/builtin-tool',
  surface: 'daemon',
  capability: 'ask-user',
  result: 'pass',
  condition: 'Antigravity 2.23.1, built-in ask_question tool',
  evidence: '原生内置 ask_question 工具，支持单选/多选/输入框交互，UI 弹窗阻塞式等待人类答复并将回答送回上下文继续执行',
  cmd: 'ask_question({ questions: [...] })',
  note: '原生人在环提问工具，完整支持结构化问题与用户输入回传'
});

// 6. notify-user
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/desktop-toast',
  surface: 'daemon',
  capability: 'notify-user',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Windows Toast + App UI Badge',
  evidence: '后台任务或定时唤醒完成时，Antigravity 宿主通过操作系统桌面 Toast 通知弹窗和托盘气泡提示用户，终端回显可见',
  cmd: 'n/a (宿主通知通道)',
  note: '支持系统级桌面推送通知，人在后台也能感知任务完成'
});

// 7. human-steer
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/agentapi+desktop-input',
  surface: 'daemon',
  capability: 'human-steer',
  result: 'pass',
  condition: 'Antigravity 2.23.1, send-message during active turn',
  evidence: '会话 RUNNING 期间外部/界面发送消息，以 SYSTEM_MESSAGE 即时插在两步之间，模型在同逻辑轮次内立刻回应并改变后续行为（黑板第61行原始证据）',
  cmd: 'agentapi send-message <cid> <msg>',
  note: '原生支持轮内真插话，非简单排队'
});

// 8. handover-human
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/desktop-app',
  surface: 'native-desktop',
  capability: 'handover-human',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Antigravity.exe session switcher',
  evidence: '外部（网关/agentapi）新建的会话在 conversation_summaries.db 登记后，在 Antigravity Desktop 侧边栏完全立即可见，人点击即可打开并接手继续交互',
  cmd: 'Antigravity.exe 打开对应会话',
  note: '会话身份底层统一：外部启动会话可在桌面 GUI 原生打开并继续'
});
