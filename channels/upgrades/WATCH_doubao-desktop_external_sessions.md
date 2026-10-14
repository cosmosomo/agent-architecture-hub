---
ticket_id: WATCH-DOUBAO-01
channel_id: doubao-desktop
maintainer: S5
status: 🔍 pending
verified_version: "CDP:9225"
detected_version: "CDP:9225"
created_at: "2026-10-14T12:20:00+08:00"
---

# 渠道能力哨兵单：监测 `doubao-desktop` 何时开放外部查看 Sessions 功能

## 一、背景与监测目标
- 当前 **豆包 Desktop** (`Doubao` / `DoubaoWork`) 将本地会话存储在 `%LOCALAPPDATA%\Doubao\User Data\Default\saman_shell_db_storage\`（Chromium LevelDB 二进制块，且客户端运行时加锁），尚未像 Codex / Claude Code / ZCode 那样提供可直接离线解析的 JSONL 或 SQLite 会话表。
- 用户明确提出：**需要监测渠道升级后是否突然开放了外部查看 sessions 的功能**。

## 二、自动探针基线（由 `hub/tools/check_channels.js` 每次巡检自动比对）
1. **数据目录结构指纹**：
   - 监测路径：`%LOCALAPPDATA%\Doubao\User Data\Default\` 与 `%APPDATA%\Doubao\`
   - 当前已知基线目录：`saman_shell_db_storage`、`IndexedDB`、`Local Storage`、`Session Storage`
   - **升级触发条件**：一旦上述目录或子目录中出现新增的 `*.sqlite`、`*.db`、`*.jsonl`、`sessions/`、`transcripts/`、`chat_history/`、`export/` 文件，立即将 `doubao-desktop` 状态翻转为 `🔍 upgrade_pending`！
2. **OpenCLI 适配器能力指纹**：
   - 监测 `opencli doubao-app --help` 子命令集合（当前基线：`status, ask, send, read, new, screenshot, dump`）；
   - 若新增 `list-sessions`、`history`、`transcript`、`export` 等子命令，立即触发调研单。

## 三、触发后的维护者（`S5 / S3`）调研动作
1. 在不重启、不打扰用户前台客户端的前提下，复制新增的只读文件或调用新只读命令检查 Schema；
2. 编写 `trace/packages/adapters/src/doubao/` 适配器并更新 [`channels/hosts/doubao-desktop.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/doubao-desktop.md) 的 `external_session_read: true`。
