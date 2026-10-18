# zcode 渠道 L0 + L1a 实测报告（zcode-tester）

- **测试员**：zcode/probe-tester（ZCode 智能体）
- **时间**：2026-10-17 17:30 ~ 18:05 (+08:00)
- **范围**：zcode 一族 × L0（原生 CLI）× L1a（ACP SDK 直连桥）。未触碰其他家族、L1b/L2/L3（L1b 已有 probe-lead 黑板行覆盖）。
- **黑板**：`channels/probe/blackboard.jsonl` 追加 34 条（`by=zcode/probe-tester`），全部为真实调用的命令与证据。
- **脚本**（均为本次新写，未改任何已有文件）：`scripts/test_l1a_zcode_tester.mjs`、`scripts/test_l1a_retest_zcode_tester.mjs`、`scripts/test_l1a_fork_check.mjs`；L0 复用命令行手动执行 + `db.sqlite` 真值核对。结果数据：`scripts/l1a_tester_results.json`、`scripts/l1a_retest_results.json`。

## 一、通断概览

### L0（`zcode.cjs -p --json`，一次性进程）
| 结论 | 能力 |
|---|---|
| 通 | open、resume、mode-switch（行为级：plan 拦写文件 / yolo 放行） |
| 部分通 | resume-native（仅 CLI 自有会话）、cancel（SIGINT 有损但会话可续）、quota（经 db.sqlite） |
| 断 | observe-live（退出时一次性输出 JSON）、observe-history、state、steer、permission（`-p` 无审批客户端，plan 轮 ExitPlanMode 报"未配置权限客户端"）、fork、compact、model-list、**model-new、model-switch** |
| 不适用 | close |

### L1a（ACP SDK 1.8.0 → zcode-acp-server 0.69.3 `dist/cli.js`）
| 结论 | 能力 |
|---|---|
| 通 | open、resume、observe-live（21 分片/轮）、cancel（stopReason=cancelled 且会话存活）、**permission（中途 requestPermission→选 reject→写入被拦，回路完整）**、**fork（真分叉：新进程 session/load 复活后答出父会话暗号 ACP-L1A-999）**、compact、mode-switch（current_mode_update+行为验证）、quota（usage_update×26）、state（`$/zcode/turnState` 独立通知）、model-list（7 模型 4 provider） |
| 部分通 | model-switch（协议层真实路由到目标模型，但目标渠道银子 `auth_failed`×7 → 轮报 Internal error）、observe-history（无 session/read，靠 compact 快照 / load 重放） |
| 断 | close（Method not found）、steer（轮中 prompt 把首轮**取消**后开新轮，ACP 无轮内插话） |

## 二、与 probe-lead 黑板行的分歧（双方行并存，供负责人裁决）

1. **L0 model-new / model-switch**：lead 判 pass/pass（依据：会话能启动、env 变量被读取）；我判 fail/fail，依据是 `~/.zcode/cli/db/db.sqlite` `model_usage` 地面真值——我的 5 轮请求全部实际跑在 `deepseek-v4.1-flash@new-provider`（银子），与 `ZCODE_MODEL` 声明的 GLM 完全无关；lead 自己的 model-new 证据会话 `sess_6d513f38` 真值同样是 deepseek。**按 README 验收标准（以下一轮实际模型为准），lead 的判定不成立。** 同机历史会话（`sess_87939329`/`sess_33a8a02f`）出现过真实 `GLM-5.3-Flash→GLM-5.3` 切换，说明该 env 曾生效，本次失效原因未知。
2. **L1a fork**：lead 判 fail（"声明 fork 但调用 Internal error"）；我两次调用均成功（返回 `sess_6ba5eca1` 等 + checkpoint），并跨进程验证了上下文连续性。不排除其调用方式或时机不同，建议以我的复现命令重跑裁决。
3. **L1a state**：lead 判 pass 但归因于 "sessionUpdate 状态快照"；实际 `running` 推送走的是**非标准扩展方法** `$/zcode/turnState`（桥源码 `dist/handlers/io.js:278`）。我首条记 partial 系只挂了 sessionUpdate 监听的盲区，已追加修正条 pass（附集成警告：标准 ACP 客户端必须单独挂该通知）。

## 三、新发现的系统级事实

- **同机不同入口的默认模型路由不一致**：L0 CLI 默认路由 = `deepseek-v4.1-flash@new-provider`（银子），L1a 桥默认路由 = `GLM-5.3@account:bigmodel-individual-coding-plan`（db 真值，13+5 次请求）。HANDOFF.md 说的"入口不等价"又添一例。
- **银子渠道在 ~17:50 后 auth_failed**（17:36 同渠道 L0 尚通）：7 次请求全败，`channels/models/yinzi-api.md` 卡片仍是 🟢 ok，需要维护官复核。
- `model_usage.mode` 列不可靠：plan 轮被记为 `build`（L0）/恒记 `yolo`（L1a），模式证据只能靠行为与 `current_mode_update`。
- **前人遗留脚本不可直接复用**：`suite_zcode_l1a.mjs` 桥入口路径不存在（正确为 `dist/cli.js`）、SDK 方法名错误（应为 `setSessionMode`/`setSessionConfigOption`）、state/model-new/quota 判定是硬编码 `pass:true`。`l0_results.json` 的 open 失败为偶发连接超时，非格式问题。

## 四、需要负责人判断的事

1. 裁决第二节三条分歧（尤其 L0 模型能力按哪条标准算数）。
2. 银子渠道 auth_failed 是否熔断/换源（红线 2：连续 403/认证失败应停机，见 yinzi-api.md）。
3. `ZCODE_MODEL` 失效根因（CLI 版本 0.151.1 的 env 解析变更？provider_config 优先级？）——我未动任何配置。
4. 旧 `suite_zcode_l1a.mjs` 是修复还是废弃（我按规矩未改，已另起正确脚本）。

## 五、对任务定义的反驳/建议

- README 3.2 的 model-switch 验收标准（看实际用量）是对的，本次唯一能落地的地面真值是 `db.sqlite model_usage`；建议把"查 db 真值"写进各能力测试的标准步骤，否则 L0 层会反复出现"假 pass"。
- `steer` 在 ACP 生态的语义建议明确为"打断+换轮"，与 `codex app-server turn/steer`（真轮内插话）区分开，避免把两种"插话"混为一谈。
