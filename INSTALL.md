# 在 Claude Code 中安装智能体与预设

Agent Architecture Designer 在同一个仓库里包含两样东西：一个在浏览器中打开的单 HTML 可视化工具，以及 **60 个智能体提示词**与 **62 个团队预设**的唯一可信来源（source of truth），你可以直接在 [Claude Code](https://claude.com/claude-code) 中使用它们。本文件介绍的是第二部分。

## 你会得到什么

- **60 个智能体 skill**（`~/.claude/skills/*.md`）—— 每个智能体一份自包含的提示词（角色、输入/输出契约、职责、规则、反模式）
- **62 个团队预设**（`~/.claude/commands/*.md`）—— 每个预设都是一条斜杠命令（`/deep-five-minds`、`/security`、`/solo`……），按阶段编排 60 个智能体中的一个子集
- **一份路由目录**（`~/.claude/PRESET_CATALOG.md`）—— 让 Claude Code 根据自然语言的任务描述主动推荐预设，而不需要你手动挑选（见第 4 步）

这三者都是**全局**的 —— 生成之后即可在你机器上的所有项目中使用，而不只是本仓库。不会向 Claude Code 自身的设置中安装任何内容；它们只是普通的 Markdown 文件，在你调用时才会被读取。

## 最快途径 —— 以插件形式安装

如果你只想要智能体和预设、不需要重新生成它们的能力，可以跳过下面的全部内容。本仓库本身就是一个 Claude Code 插件：

```
/plugin marketplace add TheJacksonCode/Agent-Architecture
/plugin install agent-architecture-designer@Agent-Architecture
```

这会安装同样的 60 个智能体和 62 个预设，它们以 `agents/*.md` 和 `commands/*.md` 的形式打包在仓库内。本文件余下部分介绍的是克隆后生成（clone-and-generate）路径 —— 如果你想在编辑源 HTML 之后重新生成、添加你自己的智能体，或者直接把文件保存在 `~/.claude/` 而不是以插件形式使用，就走这条路径。

## 前置条件

- [Node.js](https://nodejs.org/) 18 或更新版本（仅用于运行下面的生成器脚本 —— 不会作为依赖安装任何东西，也没有 `package.json`）
- 已安装且能正常使用的 [Claude Code](https://claude.com/claude-code)

## 1. 克隆仓库

```bash
git clone https://github.com/TheJacksonCode/Agent-Architecture.git
cd Agent-Architecture
```

## 2. 生成 skill 与命令

```bash
node generate_skills.js      # writes ~/.claude/skills/*.md      (60 files)
node generate_commands.js    # writes ~/.claude/commands/*.md    (62 files)
```

两个脚本都直接从 `v41/AGENT_TEAMS_CONFIGURATOR_v41.html`（浏览器应用运行的就是这同一个文件）读取智能体和预设定义，因此你得到的 skill 和命令保证与你在百科中看到的一致。

默认情况下，两个脚本都是**只增不改（additive-only）**的 —— 它们只写入尚不存在的文件，其余一概不动。这一点很重要，因为 skill 文件带有一个 `effort:` 字段（`low` / `medium` / `high` / `xhigh`），人们在安装后通常会手工调整它，而一次不慎的覆盖会无声地丢弃这些调整。

如果你想要一次完整、干净的重生成（例如在拉取本仓库的新版本之后）：

```bash
node generate_skills.js --all      # rewrites every skill file (keeps your existing effort: values)
node generate_commands.js --all    # rewrites every command file (this DOES reset agent/model choices)
```

在向 HTML 添加了全新的智能体或预设之后，运行不带 `--all` 的普通脚本 —— 它们只会创建缺失的文件，并打印一份覆盖率报告，指出任何仍未同步的内容（引用了不存在智能体的预设、没有 skill 文件的智能体等）。

## 3. 使用预设

在任意项目中打开 Claude Code 并输入 `/`。你应该能在自动补全列表中看到全部 62 个预设，大致按规模分组：

| 层级 | 示例 | 智能体数 |
|------|---------|--------|
| 极简 | `/solo`, `/quick-fix`, `/trio` | 2-3 |
| 核心 | `/bug-hunt`, `/test-suite`, `/startup` | 4-6 |
| 进阶 | `/security`, `/design-sys`, `/research` | 7-11 |
| 企业级 | `/saas`, `/full`, `/five-minds`, `/deep-five-minds` | 12-27 |

运行 `/deep-five-minds <你的任务>`（或任何其他预设），Claude Code 会按阶段顺序派生该预设 `## REFERENCES TO SKILLS` 表格中列出的智能体，每个智能体使用应用中为其指定的模型（Opus / Sonnet / Haiku）。

不确定哪个预设适合你的任务？打开应用，使用左侧面板中的搜索框，或者阅读每个预设百科条目中的 "Use when" / "vs" 对比文字 —— 这些文字正是为了帮你做出选择而写的。

## 4.（可选）根据任务描述自动路由

你可以用自然语言描述任务，让 Claude Code 自行推荐最合适的预设，而不必手动挑选 —— 作者本人平时就是这样使用这个项目的。

```bash
node generate_catalog.js     # writes ~/.claude/PRESET_CATALOG.md (all 62 presets, ~8,600 tokens)
```

这会构建一个单一的 Markdown 目录 —— 按规模分层分组，每个预设一个条目，包含其描述、"Use when"、优势/局限、token 区间和预估成本，全部直接取自另外两个脚本读取的同一份 HTML。与 skill 和命令不同，目录中没有需要逐条目手工调整的内容，因此这个脚本总是执行完整重写；拉取新版本后随时可以重新运行。

目录本身不会起任何作用 —— Claude Code 还需要在你的 `~/.claude/CLAUDE.md` 中有一条简短的路由指令，告诉它当任务看起来需要多智能体团队时查阅 `~/.claude/PRESET_CATALOG.md`。完整设计 —— token 预算、目录结构、决策指南 —— 记录在 [`docs/ROUTING_SYSTEM.md`](docs/ROUTING_SYSTEM.md) 中；目录生成后，把那里的路由代码片段复制到你的 `CLAUDE.md` 即可。如果你只需要显式的 `/preset-name` 命令，可以完全跳过本节 —— 上面的第 3 步已经是你需要的全部。

## 在本仓库发布新版本之后更新

```bash
git pull
node generate_skills.js --all
node generate_commands.js --all
```

每次更新后运行 `--all` 都是安全的：它始终会保留你手工编辑的 `effort:` 值，并把其余所有内容（提示词、模型分配、新增智能体/预设）重新同步为与最新 HTML 一致。如果你想在重新生成之前了解实际改动了什么，可以对照 `VERSIONS.md` 和 README 中的版本表。

## 向目录中添加你自己的智能体

本仓库自身的 `AGENT_META` 表（位于 `generate_skills.js` 内）是智能体 ID 到其阶段与允许工具的映射 —— 脚本必须先知道某个智能体，才能为它生成 skill 文件。简要步骤：

1. 把该智能体的定义添加到 HTML 中（`v41/AGENT_TEAMS_CONFIGURATOR_v41.html` 里的 `AGENT_EDU_PL` 对象）
2. 把它的 ID 连同一个阶段和工具列表添加到 `generate_skills.js` 的 `AGENT_META` 中
3. 运行 `node generate_skills.js` —— 它只会创建这个新的 skill 文件，不做其他任何事
4. 把该智能体添加到它所属的预设中（HTML 中的 `PR` 对象）
5. 运行 `node generate_commands.js`，用新的 skill 引用更新受影响的命令文件

完整的逐字段格式说明：[`docs/SKILLS_ARCHITECTURE.md`](docs/SKILLS_ARCHITECTURE.md)。

## 故障排除

- **`/preset-name` 没有出现在 Claude Code 中** —— 确认文件存在于 `~/.claude/commands/<preset-name>.md`。如果缺失，重新运行 `node generate_commands.js` 并检查其打印的覆盖率报告中是否有不匹配。
- **预设能运行但某个智能体行为异常** —— 直接打开它的 skill 文件（`~/.claude/skills/<agent-id>.md`）阅读提示词；它是普通 Markdown，阅读或手工编辑都很安全。如果你手工编辑了它，`--all` 重生成会保留你的 `effort:` 值，但下次带 `--all` 运行时会覆盖提示词正文本身。
- **脚本报 "cannot find HTML" 错误** —— 它们读取的是相对于仓库根目录的 `v41/AGENT_TEAMS_CONFIGURATOR_v41.html`；请在克隆出来的仓库内部运行，而不是在任意工作目录中运行。
- **你想改用旧的 v32 目录** —— 生成器脚本在设计上固定指向 v41（每个文件顶部的 `HTML_PATH`）；如果你确实需要规模较小的 35 智能体 / 42 预设集合，把该常量指向 `v32/AGENT_TEAMS_CONFIGURATOR_v32.html` 即可，但请注意这两个目录并不是设计为可以混用的。
