---
ticket_id: UPG-20261014-02
channel_id: claude-code
maintainer: S5
status: 🔍 pending
verified_version: "2.1.85"
detected_version: "2.1.296"
created_at: "2026-10-14T12:20:00+08:00"
---

# 渠道升级调研单：`claude-code` (`2.1.85` → `2.1.296`)

## 一、触发信号（巡检捕获差量）
- **版本跃迁**：从 `2.1.85` 升级至 **`2.1.296`**。
- **`claude --help` 新增能力差量**：
  1. **后台会话管理全套子命令**：`claude --bg`（后台启动会话）、`claude ps`（查看后台会话）、`claude logs <id>`、`claude attach <id>`、`claude stop <id>`（优雅停止并保留上下文）；
  2. **在线实例发现**：`claude agents --json`（直接输出本机所有活跃 Claude Code 进程的 PID、`sessionId`、`status: idle|working`、`cwd`）；
  3. **子代理流式透传与缓存优化**：`--forward-subagent-text`、`--exclude-dynamic-system-prompt-sections`。

## 二、调研与实测清单（责任维护者：`S5`）
- [x] **1. 实测 `claude agents --json`**：本机实测 0 秒返回 JSON 数组，可作为判断 Claude 会话真正在线（`working` vs `stale`）的权威信号；
- [ ] **2. 实测 `claude --bg` 与 `claude stop <id>`**：验证在 Windows PowerShell 7 下后台守护进程的生命周期与日志落盘完整性。

## 三、对 `Agent-Architecture-Hub` 的接入影响
- 已在 [`channels/hosts/claude-code.md`](file:///e:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/hosts/claude-code.md) 登记，并在 Step 4 `/api/session/control` 中接入 `claude --resume <id> -p` 与 `claude stop <id>`。
