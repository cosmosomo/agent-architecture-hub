/**
 * census_doubao.mjs
 *
 * 全量普查本机 豆包 Desktop (智能体模式) 会话与 Harness 痕迹
 * 扫描范围：
 *   1. %LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.sessions\
 *   2. %LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\conversation\
 *   3. %LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.skills\ & .user_skills\
 *   4. %LOCALAPPDATA%\Doubao\User Data\Default\saman_shell_db_storage\ (普通模式 LevelDB 概览)
 *
 * 输出：
 *   channels/research/harness/doubao-census.json
 */

import fs from 'node:fs';
import path from 'node:path';

const LOCALAPPDATA = process.env.LOCALAPPDATA || '';
const DOUBAO_ROOT = path.join(LOCALAPPDATA, 'Doubao', 'User Data', 'Default');
const AGENT_MODE_DIR = path.join(DOUBAO_ROOT, '.doubao', 'agent_mode', 'workspace');
const SESSIONS_DIR = path.join(AGENT_MODE_DIR, '.sessions');
const CONV_DIR = path.join(AGENT_MODE_DIR, 'conversation');
const SKILLS_DIR = path.join(AGENT_MODE_DIR, '.skills');
const USER_SKILLS_DIR = path.join(AGENT_MODE_DIR, '.user_skills');
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'channels/research/harness/doubao-census.json');

console.log('Starting full Doubao harness census...');

const census = {
  meta: {
    product: 'Doubao Desktop (Agent Mode / 智能体模式)',
    harnessArchitecture: 'Doubao Multi-Agent Workspace (Main + Organizer + Subagents + Socket/Board System)',
    scanTime: new Date().toISOString(),
    totalSessions: 0,
    totalAgents: 0,
    totalTrajectoryFiles: 0,
    totalTrajectoryLines: 0,
  },
  agentHierarchy: {
    mainAgents: { prefix: 'm_', count: 0, description: '主会话入口智能体 (Main Agent)' },
    organizerAgents: { prefix: 'o_', count: 0, description: '组织者/规划者智能体 (Organizer Agent)' },
    workerSubagents: { prefix: 's_', count: 0, description: '特化子智能体/工作者 (Worker Subagent)' },
  },
  roles: {},
  toolCalls: {},
  recordFieldsByRole: {
    user: {},
    assistant: {},
    tool: {},
  },
  sessionArtifacts: {
    boardMdCount: 0,
    boardMdSample: null,
    memoryCount: 0,
    memorySample: null,
    attachmentsCount: 0,
  },
  agentArtifacts: {
    assignmentCount: 0,
    assignmentSample: null,
    toolResultsFilesCount: 0,
    toolResultsSample: null,
    pollMonitorsDirsCount: 0,
    briefingCount: 0,
    findingsCount: 0,
  },
  backgroundTaskQueue: {
    totalConversationsWithQueue: 0,
    sampleTask: null,
  },
  skillsCensus: {
    builtinSkills: [],
    userSkills: [],
  },
  harnessClassification: {
    '上下文装配 (Context Assembly)': [
      'system/assignment.md (需求分块与多轮提示词注入)',
      'socket/briefing.md (父子智能体任务简报)',
      'user record in trajectory.jsonl (含 image_link_list 多模态输入)'
    ],
    '预算与压缩 (Budget & Compaction)': [
      'system/tool-results/ (大输出独立文件溢出落盘，轨迹仅保留引用与精简截断)',
      'TaskOutput (结构化交付，收束子智能体上下文)'
    ],
    '工具系统 (Tool System)': [
      'trajectory.jsonl assistant.tool_calls + role:tool 闭环',
      '20 项特化工具（PowerShell, Write, Read, Edit, web.fetch, general_search 等）',
      'system/tool-results/ 原始工具输出镜像'
    ],
    '组织 (Organization: Multi-Agent Mesh & Coordination)': [
      'm_ / o_ / s_ 三级智能体层级拓扑',
      'create_agent / wait_agent / send_message 编排原语',
      'board.md 共享任务看板 (任务ID, 标题, Organizer, 状态, 产物路径, 产物链接)',
      'socket/findings.jsonl 流式发现回传',
      'poll-monitors 轮询状态机'
    ],
    '记忆与持久化 (Memory & Persistence)': [
      'memory/MEMORY.md (会话级长期记忆)',
      'manage_preference 工具调用',
      'search_memory (hybrid mode: 关键词+向量混合检索 task_history)',
      'workspace/experience 跨会话经验库'
    ],
    '可观测 (Observability)': [
      'trajectory.jsonl 逐步持久化',
      'assistant.reasoning_content (思考链/CoT 记录)',
      'background_history_task/index.json + outputs/<uuid>.output'
    ]
  }
};

// 1. Scan Sessions
if (fs.existsSync(SESSIONS_DIR)) {
  const sessionIds = fs.readdirSync(SESSIONS_DIR);
  census.meta.totalSessions = sessionIds.length;

  for (const sid of sessionIds) {
    const sp = path.join(SESSIONS_DIR, sid);

    // Board.md check
    const bm = path.join(sp, 'board.md');
    if (fs.existsSync(bm)) {
      census.sessionArtifacts.boardMdCount++;
      if (!census.sessionArtifacts.boardMdSample) {
        census.sessionArtifacts.boardMdSample = fs.readFileSync(bm, 'utf8').slice(0, 400);
      }
    }

    // Memory check
    const mem = path.join(sp, 'memory');
    if (fs.existsSync(mem)) {
      const mf = fs.readdirSync(mem);
      census.sessionArtifacts.memoryCount += mf.length;
      if (!census.sessionArtifacts.memorySample && mf.length > 0) {
        census.sessionArtifacts.memorySample = {
          file: mf[0],
          content: fs.readFileSync(path.join(mem, mf[0]), 'utf8').slice(0, 300),
        };
      }
    }

    // Attachments check
    const att = path.join(sp, 'attachments');
    if (fs.existsSync(att)) {
      census.sessionArtifacts.attachmentsCount += fs.readdirSync(att).length;
    }

    // Agents scan
    const agDir = path.join(sp, 'agents');
    if (!fs.existsSync(agDir)) continue;

    for (const ag of fs.readdirSync(agDir)) {
      census.meta.totalAgents++;
      const ap = path.join(agDir, ag);

      if (ag.startsWith('m_')) census.agentHierarchy.mainAgents.count++;
      else if (ag.startsWith('o_')) census.agentHierarchy.organizerAgents.count++;
      else if (ag.startsWith('s_')) census.agentHierarchy.workerSubagents.count++;

      // assignment.md
      const as = path.join(ap, 'system', 'assignment.md');
      if (fs.existsSync(as)) {
        census.agentArtifacts.assignmentCount++;
        if (!census.agentArtifacts.assignmentSample) {
          census.agentArtifacts.assignmentSample = fs.readFileSync(as, 'utf8').slice(0, 400);
        }
      }

      // tool-results
      const tr = path.join(ap, 'system', 'tool-results');
      if (fs.existsSync(tr)) {
        const trFiles = fs.readdirSync(tr);
        census.agentArtifacts.toolResultsFilesCount += trFiles.length;
        if (!census.agentArtifacts.toolResultsSample && trFiles.length > 0) {
          census.agentArtifacts.toolResultsSample = {
            fileName: trFiles[0],
            contentPreview: fs.readFileSync(path.join(tr, trFiles[0]), 'utf8').slice(0, 300),
          };
        }
      }

      // poll-monitors
      const pm = path.join(ap, 'poll-monitors');
      if (fs.existsSync(pm)) census.agentArtifacts.pollMonitorsDirsCount++;

      // socket briefing & findings
      const bf = path.join(ap, 'socket', 'briefing.md');
      if (fs.existsSync(bf) && fs.statSync(bf).size > 0) census.agentArtifacts.briefingCount++;
      const fd = path.join(ap, 'socket', 'findings.jsonl');
      if (fs.existsSync(fd) && fs.statSync(fd).size > 0) census.agentArtifacts.findingsCount++;

      // trajectory.jsonl
      const tj = path.join(ap, 'system', 'trajectory.jsonl');
      if (fs.existsSync(tj)) {
        census.meta.totalTrajectoryFiles++;
        const content = fs.readFileSync(tj, 'utf8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          census.meta.totalTrajectoryLines++;
          try {
            const o = JSON.parse(line);
            const r = o.role || 'UNKNOWN';
            census.roles[r] = (census.roles[r] || 0) + 1;

            if (census.recordFieldsByRole[r]) {
              for (const k of Object.keys(o)) {
                census.recordFieldsByRole[r][k] = (census.recordFieldsByRole[r][k] || 0) + 1;
              }
            }

            if (Array.isArray(o.tool_calls)) {
              for (const tc of o.tool_calls) {
                const fn = (tc.function && tc.function.name) || tc.name || 'unknown';
                if (!census.toolCalls[fn]) {
                  census.toolCalls[fn] = {
                    count: 0,
                    sampleArgs: null,
                  };
                }
                census.toolCalls[fn].count++;
                if (!census.toolCalls[fn].sampleArgs && tc.function?.arguments) {
                  census.toolCalls[fn].sampleArgs = String(tc.function.arguments).slice(0, 200);
                }
              }
            }
          } catch {}
        }
      }
    }
  }
}

// 2. Scan background_history_task
if (fs.existsSync(CONV_DIR)) {
  const convs = fs.readdirSync(CONV_DIR);
  for (const c of convs) {
    const bgt = path.join(CONV_DIR, c, 'background_history_task');
    if (fs.existsSync(bgt)) {
      census.backgroundTaskQueue.totalConversationsWithQueue++;
      const idx = path.join(bgt, 'index.json');
      if (fs.existsSync(idx) && !census.backgroundTaskQueue.sampleTask) {
        try {
          census.backgroundTaskQueue.sampleTask = JSON.parse(fs.readFileSync(idx, 'utf8'));
        } catch {}
      }
    }
  }
}

// 3. Scan Skills
if (fs.existsSync(SKILLS_DIR)) {
  census.skillsCensus.builtinSkills = fs.readdirSync(SKILLS_DIR);
}
if (fs.existsSync(USER_SKILLS_DIR)) {
  census.skillsCensus.userSkills = fs.readdirSync(USER_SKILLS_DIR);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(census, null, 2), 'utf8');
console.log('Doubao census completed! Written to:', OUTPUT_FILE);
