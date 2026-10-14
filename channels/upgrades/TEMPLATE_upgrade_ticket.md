---
ticket_id: UPG-YYYYMMDD-XX
channel_id: <channel_id>
maintainer: S5 | S6 | S3
status: 🔍 pending | 🧪 testing | ✅ verified_merged
verified_version: "<old_version>"
detected_version: "<new_version>"
created_at: "YYYY-MM-DDTHH:mm:ss+08:00"
---

# 渠道升级调研单：`<channel_id>` (`<old_version>` → `<new_version>`)

## 一、触发信号（巡检脚本 `check_channels.js` 自动捕获的差量）
- **版本变化**：`verified_version` (`<old>`) $\to$ `detected_version` (`<new>`)
- **`--help` / 本地目录 / 数据库表结构差量**：
  - 新增子命令或参数：
  - 新增本地落盘文件或表：

## 二、调研与实测清单（由对应维护者执行）
- [ ] **1. 离线契约与帮助文档核对**：运行 `--help` 或检查 schema，确认参数语法与权限边界；
- [ ] **2. 隔离沙箱最小成本实测**：在临时目录用单条最小请求验证新功能是否可用、退出码与落盘格式；
- [ ] **3. 评估对观察台 (`trace` / `hub`) 与调度的增益**：
  - 是否解锁了新的会话读取（如外部读取 sessions）或反向控制能力（如 `queue` / `stop`）？
  - 是否破坏了既有解析器的字段假设？

## 三、实测结论与回写动作
- **实测结果摘要**：
- **已回写卡片**：`channels/<domain>/<channel_id>.md`（更新 `verified_version`、`capabilities`、`§2 独立能力矩阵`、`§4 升级演进日志`）
