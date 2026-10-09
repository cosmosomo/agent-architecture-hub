# CLAUDE.md - Agent Architecture Designer

## 本项目是什么

面向多智能体 AI 系统的单 HTML 可视化设计器与百科。
60 个智能体，62 个团队预设，PL/EN 双语。零依赖。

首要目的：**教育** —— 让你在花费任何 token 之前，先理解每个智能体如何思考、它做什么、团队如何协作、以及要花多少成本。

## 当前版本

**工作版本：v41** —— 60 个智能体，62 个预设，约 3.5 MB。它是智能体与预设定义的唯一可信来源；更早的版本均已冻结。

- 源文件：`v41/AGENT_TEAMS_CONFIGURATOR_v41.html`
- 日志、该文件专属的规则与压缩后交接说明：`v41/PROGRESS.md`
- 应用内教程的构建计划：`v41/plans/PLAN_BUDOWY.md`
- 视觉决策（整个项目）：`DESIGN_DECISIONS.md`

v41 主题：**应用内教程**。四个阶段已全部交付：带独立最小引擎的五步引导导览、首次访问自动启动、PL/EN 完全对等。入口是页眉中的手电筒按钮，位于 Hooki 与成本栏之间。

- 步骤数据与引擎位于 `v41/plans/samouczek_kod.js` —— 这是编辑它们的唯一位置。请使用标记替换脚本部署；直接编辑 HTML 的改动会在下次部署时丢失。
- 协作模式（Wzorce）模块的工作方式相同：权威源现在是 `v41/plans/wzorce_kod.js`（2026-09-15 为发布而复制到此处 —— v39 保持冻结，因此它不再会独立于实际部署的内容发生变动）。请使用标记替换脚本部署。例外：`wzSyncLang()` 位于 HTML 中、标记之外。

教程之外，v41 还包含一轮界面美化（DD59-DD70）、已关闭的 A/B/C 待办事项（DD71-DD75）、一个匿名化的 `Research/` 文件夹（DD74），以及两轮性能优化 —— 百科（DD76）与画布（DD77）。信息图已在 DD84（2026-09-24）移除。当前体积 3 511 779 字节，六个测试套件中的 **499 项测试全部通过**。v41 已于 2026-09-15 发布到 GitHub（经 Maciej 明确同意）。今后任何一次推送仍需每次都获得他的明确同意 —— 这是一条长期有效的规则，不是一次性的批准。

**上一版本：v40** —— 冻结于 7 029 741 字节。Wzorce 模块已重建（DD52-DD55）。

**已批准的回退版本：v39** —— 冻结于 6 959 003 字节。在 Maciej 另有说明之前，它仍是指定的回退版本。不得编辑它，连以读写方式打开也不行。

v38 及更早版本仅作历史保留 —— 留在目录树中，不再是回退版本（2026-09-13 的决定）。不要使用它们来定义智能体或预设。

**在线演示：v41** —— 自 2026-09-15 的发布决定起，根目录的 `index.html` 为 GitHub Pages 镜像 `v41/AGENT_TEAMS_CONFIGURATOR_v41.html`（仅展示 v41；v33-v40 只保留在本地，见 `.gitignore`）。

**首个公开发布版本：v32**（构建 v32.16 "Universal Bilingual"）—— 35 个智能体，42 个预设。以 `v32/AGENT_TEAMS_CONFIGURATOR_v32.html` 的形式作为历史保留在仓库中；不再是在线演示。

## 智能体基础设施

本项目为 Claude Code 提供了一套完整的智能体编排层：

| 组件 | 位置 | 数量 | 用途 |
|-----------|----------|-------|---------|
| Skills | `~/.claude/skills/*.md` | 60 | 单个智能体的提示词（全局，从克隆源码安装） |
| Commands | `~/.claude/commands/*.md` | 62 | 团队预设的编排（全局，从克隆源码安装） |
| Agents（打包） | `agents/*.md` | 60 | 相同的提示词，打包在仓库内供插件安装使用 |
| Commands（打包） | `commands/*.md` | 62 | 相同的预设，打包在仓库内供插件安装使用 |
| 清单（Manifest） | `.claude-plugin/plugin.json` | 1 | 插件清单 —— `/plugin install` 读取的内容 |
| 目录（Catalog） | `~/.claude/PRESET_CATALOG.md` | 1 | 自动路由：任务描述 -> 最佳预设 |
| 路由（Routing） | `~/.claude/CLAUDE.md` | 1 | 7 行路由指令（始终加载） |

两条安装路径并存，二者都从同一份 v41 HTML 生成：`/plugin marketplace add TheJacksonCode/Agent-Architecture` 直接从仓库读取 `agents/` + `commands/` + `.claude-plugin/plugin.json`（无需克隆）；从克隆源码安装的路径则在本地运行生成器，写入 `~/.claude/`。打包版命令引用 `${CLAUDE_PLUGIN_ROOT}/agents/*.md`（在插件安装内部解析）；从克隆源码安装的命令引用 `~/.claude/skills/*.md` —— 见 `generate_commands.js` 中的 `SKILL_REF_PREFIX` / `--plugin` 标志。

**工作原理：** 用户描述任务 -> Claude 读取目录 -> 推荐最佳预设 -> 用户确认 -> 预设为每个智能体加载 skill 文件 -> 各智能体作为子智能体运行。

**从源 HTML 重新生成**（以下命令均读取 `v41/`；前两条默认只创建缺失的文件，目录脚本则始终执行完整重写，因为它是单个聚合文件，没有需要逐条目保护的内容）：
```bash
node generate_skills.js                        # skill files -> ~/.claude/skills/ (only missing)
node generate_commands.js                       # command files -> ~/.claude/commands/ (only missing)
node generate_skills.js --all                   # rewrites every skill file (keeps existing effort:)
node generate_commands.js --all                 # rewrites every command file - changes agent models
node generate_skills.js --out ./agents          # same, into the in-repo plugin bundle
node generate_commands.js --out ./commands --plugin   # same, ${CLAUDE_PLUGIN_ROOT} refs instead of ~/.claude
node generate_catalog.js                        # rewrites ~/.claude/PRESET_CATALOG.md from PM (always full)
```

以下 12 个智能体（为手工添加，位于 `generate_skills.js` 中 `AGENT_META` 之外）完全不会由脚本重新生成 —— `res_extractor`、`synthesizer_lean`、`style_profiler`、`voice_qa`、`social_strategist`、`career_document_builder`、`interview_coach`、`recipe_scout`、`taste_recommender`、`recipe_filter`、`decision_advisor`、`voice_writer`。当其中任何一个发生变更时，需手工同时编辑 `~/.claude/skills/<id>.md` 和 `agents/<id>.md` —— 生成器会把它们报告为 "poza generatorem"，但不会改动它们。

`generate_commands.js` 会在最后打印一份覆盖率报告：没有对应命令的预设、没有对应 skill 的智能体、以及背后没有预设的命令。在向 HTML 添加智能体或预设之后请运行它 —— 这种缺口在应用中不可见，而命令文件不存在的预设，在用户把它粘贴进 Claude Code 时会静默失败。

## 版本管理

- 每个大版本 = 自己独立的文件夹，内含单个 HTML 文件
- 当前发布版本 / 在线演示：**v41**
- v33-v40 是开发历史，已被 gitignore —— 不推送，只有 v32 和 v41 公开
- 历史构建（v1-v32.15）保存在 git 历史中

## 文件地图

```
index.html                  # 在线演示（= v41 副本）
.claude-plugin/plugin.json  # Claude Code 插件清单（仓库根目录 = 插件根目录）
agents/                     # 60 个智能体提示词，打包供插件安装使用
commands/                   # 62 个预设文件，打包供插件安装使用
v41/                        # 工作版本（唯一可信来源），已发布
  AGENT_TEAMS_CONFIGURATOR_v41.html
  PROGRESS.md               # 日志 + 该文件专属的规则
  MASTER_PLAN.md            # 教程研究活动简报
  research/                 # R1-R8 + CRITIC
  plans/                    # SYNTHESIS.md + PLAN_BUDOWY.md
v32/                        # 首个公开发布版本（历史，不再是在线演示）
  AGENT_TEAMS_CONFIGURATOR_v32.html
docs/                       # 架构文档
  SKILLS_ARCHITECTURE.md    # 60 个智能体：格式、字段、模型路由
  ROUTING_SYSTEM.md         # 自动路由：目录、token 预算、流程
  screenshots/
Research/                   # 匿名化的研究活动（DD74）
generate_skills.js          # 从 HTML 重新生成 skill
generate_commands.js        # 从 HTML 重新生成命令
generate_catalog.js         # 从 HTML 重新生成路由目录
INSTALL.md                  # 公开的安装指南（skills/commands/目录）
VERSIONS.md                 # v1-v32 变更日志；v33-v41 的摘要见 README
```

## 文档

- **Skill 系统：** `docs/SKILLS_ARCHITECTURE.md`
- **路由系统：** `docs/ROUTING_SYSTEM.md`
- **版本历史：** `VERSIONS.md`
