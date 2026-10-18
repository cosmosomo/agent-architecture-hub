#!/usr/bin/env node
// 从工作区产物组装 6 条 L1b acpx 黑板记录并逐条追加
const fs = require('fs');
const path = require('path');
const WS = 'C:/Users/COLORFIRE/hub-workspaces/probe-retest-zcode-1018';
const appendPath = path.join(__dirname, 'retest1018_append.js');

const base = { family: 'claude', layer: 'L1b', route: 'claude/L1b/acpx', surface: 'acpx' };
const cond = 'acpx 0.19.5，经 npx @agentclientprotocol/claude-agent-acp@^0.81.2 拉桥（注意：非全局 0.90.0；该桥自带的 claude.exe 不读 ~/.claude/settings.json 的 env，须在启动时注入 ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN，且必须显式 --model haiku，否则 default 档落到 claude-opus-5-5）；渠道 yinzi api.yinziapi.top；工作区 C:/Users/COLORFIRE/hub-workspaces/probe-retest-zcode-1018';

const recs = [
  {
    ...base, capability: 'state', result: 'partial',
    condition: cond + '；named 会话 probe-rt-l1b-b（ab551661）',
    evidence: '空闲：status 输出 pid:-、status:idle、model:default；长轮进行中（第 15 秒）：pid:102440、status:running、uptime:00:00:12、lastPromptTime:2026-10-17T19:47:46Z；cancel 时背景轮输出 [done] cancelled。但有两个反例：a) 首次认证失败的残留 worker 让 status 显示 pid:76120 status:running，而实际无轮在跑（同刻 cancel 报 nothing to cancel）；b) 对已 close 的会话名执行 status 仍答 idle（status 会自动 ensure 记录）',
    cmd: 'acpx claude status -s <名> 在 空闲/运行中/关闭后 三种时刻执行对照',
    note: '记 partial：idle/running 有字段判据且转换实测成立，但存在残留 worker 的 running 误报与 closed 后仍答 idle 的假象——acpx status 不可单独作状态真源。mode 字段恒为 "-"，不反映会话模式。原第 198 行只录了 idle 一态',
  },
  {
    ...base, capability: 'cancel', result: 'pass',
    condition: cond + '；probe-rt-l1b-b 长轮（数到 600）进行中第 15 秒 cancel。注意该轮与随后校验轮发生在显式 --model haiku 之前，实际模型为桥默认 claude-opus-5-5（用量见 c 会话与报告事故注记）',
    evidence: 'acpx claude cancel -s probe-rt-l1b-b 输出 cancel requested（exit 0）；背景 prompt 进程随即以「[done] cancelled」结束（exit 0）；随后同会话 prompt 正常 end_turn，且再问「上一条让你回复什么」能答出被取消那轮的指令词 BIG_DONE——轮停、会话活、上下文保留',
    cmd: '后台起 acpx claude -s probe-rt-l1b-b "从 1 数到 600..." → 15s 后 acpx claude cancel -s probe-rt-l1b-b → 再 acpx claude -s probe-rt-l1b-b 校验轮',
    note: 'cancel 成立。原第 199 行证据是 nothing to cancel (code=0)——那是对空闲会话的空转，什么都没取消，不能作证；本次真停了一个运行中的轮',
  },
  {
    ...base, capability: 'close', result: 'pass',
    condition: cond + '；对带有残留 worker 的 probe-rt-l1b-a（44ab6ef0）执行 sessions close',
    evidence: '第一次 close：exit 0 但带警告 Queue-owner descendant cleanup is incomplete or unverified. Its lease was retained.——worker 进程 76120 实际已死（tasklist //FI "PID eq 76120" 报 无匹配任务）；queue-owner 是我方首次失败调用遗留、单独 kill 后第二次 close 干净返回 44ab6ef0-...；sessions list --local 显示该记录带 [closed] 标记（记录保留不删除）',
    cmd: 'acpx claude sessions close probe-rt-l1b-a → tasklist 核对 pid → acpx claude sessions list --local',
    note: 'worker 进程被杀、记录标 [closed]：close 成立，但有两点瑕疵：残留 queue-owner 时首次 close 只能半清（lease retained 警告）；close 不删记录，同名 status 仍可解析。原第 200 行证据只有一行会话 id (code=0)，无进程与记录核验',
  },
  {
    ...base, capability: 'compact', result: 'pass',
    condition: cond + '；probe-rt-l1b-d 全程显式 --model haiku（model_usage 证实 claude-haiku-5-5）：d1 喂 5.8KB 材料 → d2 /compact → d3 对比',
    evidence: 'd1 轮 _meta.quota.model_usage 累计 61197 tok（end_turn）；d2 轮（/compact）end_turn、回复文本为空、累计 64098 tok；d3 轮（压缩后）累计降到 51638 tok——上下文用量净降约 1.25 万 token（被总结掉的会话史），方向与 L0（97.4K→2K）、L1a（113K→2.2K）一致；本会话降幅小是因桥的固定系统上下文约 5 万 tok 仍在',
    cmd: 'acpx --format json --model haiku claude -s probe-rt-l1b-d 依次发 材料 / "/compact"（MSYS_NO_PATHCONV=1） / 标记词提问，读每轮 result._meta.quota.model_usage',
    note: '上下文用量下降判据满足：compact 成立。原第 204 行证据是一句描述（passes slash command to underlying adapter），非行为证据。注意：/compact 参数必须加 MSYS_NO_PATHCONV=1，否则被 Git Bash 改写成 C:/Program Files/Git/compact（L0 复测已证该坑）',
  },
  {
    ...base, capability: 'model-list', result: 'fail',
    condition: cond + '；穷举 acpx claude 命令面（prompt/exec/cancel/set-mode/set/status/sessions）',
    evidence: 'acpx claude --help 无列模型子命令；acpx claude set model totally-fake-model -s probe-rt-l1b-e 报 Failed session/set_config_option for model "totally-fake-model": Invalid value for config option model（只拒非法值，不枚举合法值）；status 只给当前模型（model: haiku）',
    cmd: 'acpx claude --help；acpx claude set model totally-fake-model -s probe-rt-l1b-e；acpx claude status -s probe-rt-l1b-e',
    note: '判据「拿到真实可用的模型列表」在 acpx 命令面不成立，记 fail。完整五档列表只能经直连桥的 newSession configOptions 拿到（见 L1a model-list 格）。原第 205 行记 pass、证据是桥的五档数组但 cmd 写的是 acpx claude status——status 根本不输出该数组，张冠李戴',
  },
  {
    ...base, capability: 'mode-switch', result: 'pass',
    condition: cond + '；probe-rt-l1b-d（plan 腿）与全新 probe-rt-l1b-e（acceptEdits 腿），--model haiku',
    evidence: 'set-mode plan 返回 mode set: plan；随后写文件轮被拒：exit=5、回复原文 The write operation was refused. The user declined permission to create the file.、l1b_plan.txt 未创建。set-mode acceptEdits 返回 mode set: acceptEdits；全新会话 e 上写文件轮 exit=0、l1b_edit.txt 真实创建且内容 EDIT_OK（磁盘核实）',
    cmd: 'acpx claude set-mode plan -s <会话> → prompt 写文件；acpx claude set-mode acceptEdits -s <会话> → prompt 写文件',
    note: '切换后行为随之改变（拒写→写成功）：mode-switch 成立。注意 acpx status 的 mode 字段恒为 "-"，模式只能靠 set 返回与实际行为证实；plan 模式下拒绝来自 acpx 的 nonInteractivePermissions:deny 自动答复退栈审批。原第 208 行只是 set 命令回显，无行为证据',
  },
];

const { execFileSync } = require('child_process');
let n = 0;
for (const rec of recs) {
  const tmp = path.join(WS, 'rec_tmp.json');
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 1));
  console.log(execFileSync(process.execPath, [appendPath, tmp], { encoding: 'utf8' }).trim());
  n++;
}
console.log('appended', n, 'records');
