# 实测矩阵（由黑板生成，勿手改）

生成时间：2026-10-18T04:11:36.280Z。来源：`blackboard.jsonl`，共 1529 条。重新生成：`node channels/probe/scripts/build_matrix.js`。

图例：✅ 通　❌ 断　◐ 部分通　— 不适用　❓ 未验证（只有声明或描述，没有原始输出）　⚠ 同一格有互相矛盾的记录（以最新一条显示）　空白＝还没测。格子里的数字是黑板行号。

## *

列：

- **C1** L3 · web-chat-drawer · */L3/web-chat-drawer
- **C2** L3 · web-console · */L3/web-console

| 能力 | C1 | C2 |
|---|---|---|
| open | ❌⚠ 860 | ❌⚠ 831 |
| resume | ◐ 859 | ◐ 830 |
| observe-history | ✅ 863 | ✅ 845 |
| state | ✅ 862 | ✅ 844 |
| cancel | ✅ 857 | ✅ 841 |
| steer | ❌ 858 |  |
| permission | ❌ 856 | ❌ 840 |
| fork | ◐ 861 | ◐ 842 |
| mode-switch | ✅ 855 | ❌ 839 |
| wait-visible |  | ❌ 846 |

断点与条件：

- 行 830 · resume · L3 */L3/web-console · ◐ 条件：实现=向同名槽位重发固定提示词"请直接从刚才中断…继续"。会话身份两套（原生 vs acpx）在 L3 未区分，点原生会话发消息=新建空槽
- 行 831 · open · L3 */L3/web-console · ❌ 条件：console.js:1603 toast「✓ 已创建」。「创建」实为内存草稿，延迟到首轮发送；UI 未说明
- 行 839 · mode-switch · L3 */L3/web-console · ❌ 条件：对显示它的 4 家（codex/claude/workbuddy/opencode，gateway caps.canSetPermissionMode=true。下拉是纯装饰；zcode/hermes/AGY 正确隐藏（caps=false）
- 行 840 · permission · L3 */L3/web-console · ❌ 条件：默认 meta_approver 开启时权限被静默升级为 all（3414-3426），横幅根本不可达。与 HANDOFF 病灶4一致：非轮中挂起审批，批准=新开一轮重发
- 行 842 · fork · L3 */L3/web-console · ◐ 条件：文案称「上下文自动打包，无缝移交」。作为"接力"是真动作；作为"无缝/打包"名不副实；不是分叉
- 行 846 · wait-visible · L3 */L3/web-console · ❌ 条件：渲染成 <button> 但 bindEvents(console.js:2213-2431) 无 data-jump-* 分支。死按钮
- 行 856 · permission · L3 */L3/web-chat-drawer · ❌ 条件：默认配置下横幅不可达（见 console 行）。
- 行 858 · steer · L3 */L3/web-chat-drawer · ❌ 条件：按钮文案宣称「插队/插话」。动作真实但不是 steer；对排队条用「插队」误导
- 行 859 · resume · L3 */L3/web-chat-drawer · ◐ 条件：acpx 槽位真续（T1b 暗号法证明 -s 续接可用）；trace 里的原生会话落 hub-<ch> 空槽假续。与 console 断点续跑同目的、两套实现两个接口
- 行 860 · open · L3 */L3/web-chat-drawer · ❌ 条件：toast「✨ 已新建 独立会话槽」（chat.js:1915）。
- 行 861 · fork · L3 */L3/web-chat-drawer · ◐ 条件：标题「无缝接力」。

## antigravity

列：

- **C1** L0 · daemon · antigravity/L0/agentapi
- **C2** L0 · daemon · antigravity/L0/agentapi+connect-rpc
- **C3** L0 · daemon · antigravity/L0/agentapi+desktop-input
- **C4** L0 · daemon · antigravity/L0/agentapi+projects-config
- **C5** L0 · daemon · antigravity/L0/agentapi+summaries-db
- **C6** L0 · daemon · antigravity/L0/artifacts-ui
- **C7** L0 · daemon · antigravity/L0/artifacts+transcript
- **C8** L0 · daemon · antigravity/L0/ask_question+send_message
- **C9** L0 · daemon · antigravity/L0/builtin-browser
- **C10** L0 · daemon · antigravity/L0/builtin-tool
- **C11** L0 · daemon · antigravity/L0/connect-rpc
- **C12** L0 · daemon · antigravity/L0/customizations
- **C13** L0 · daemon · antigravity/L0/desktop-app
- **C14** L0 · daemon · antigravity/L0/desktop-toast
- **C15** L0 · daemon · antigravity/L0/file-inbox
- **C16** L0 · daemon · antigravity/L0/force-stop+lock-release
- **C17** L0 · daemon · antigravity/L0/gateway+daemon
- **C18** L0 · daemon · antigravity/L0/generative_ui+webview
- **C19** L0 · daemon · antigravity/L0/hooks
- **C20** L0 · daemon · antigravity/L0/hooks-json
- **C21** L0 · daemon · antigravity/L0/hooks+slash
- **C22** L0 · daemon · antigravity/L0/loop-detector
- **C23** L0 · daemon · antigravity/L0/manage_task+board-file
- **C24** L0 · daemon · antigravity/L0/mcp
- **C25** L0 · daemon · antigravity/L0/mcp-client
- **C26** L0 · daemon · antigravity/L0/mcp+plugins
- **C27** L0 · daemon · antigravity/L0/metadata-hide
- **C28** L0 · daemon · antigravity/L0/presence-lock
- **C29** L0 · daemon · antigravity/L0/presence-lock+gateway
- **C30** L0 · daemon · antigravity/L0/process+rpc
- **C31** L0 · daemon · antigravity/L0/rules+post-invocation-hook
- **C32** L0 · daemon · antigravity/L0/run_command
- **C33** L0 · daemon · antigravity/L0/send_message+rpc
- **C34** L0 · daemon · antigravity/L0/slash-commands
- **C35** L0 · daemon · antigravity/L0/slash-learn+conversations-db
- **C36** L0 · daemon · antigravity/L0/slash-rewind+fork
- **C37** L0 · daemon · antigravity/L0/sqlite-delete+rpc
- **C38** L0 · subagent · antigravity/L0/subagent
- **C39** L0 · daemon · antigravity/L0/subagents+fork
- **C40** L0 · daemon · antigravity/L0/summaries-db
- **C41** L0 · daemon · antigravity/L0/summaries-db+metadata
- **C42** L0 · jsonl-file · antigravity/L0/transcript
- **C43** L0 · daemon · antigravity/L0/transcript-stream
- **C44** L0 · daemon · antigravity/L0/workspace-boundary
- **C45** L1a · acp-bridge · antigravity/L1a/agy-acp
- **C46** L1b · acpx · antigravity/L1b/acpx
- **C47** L2 · agent-gateway-cli · antigravity/L2/agent_gateway
- **C48** L2 · gateway-server · antigravity/L2/server-api
- **C49** L3 · web-chat-drawer · antigravity/L3/web-chat-drawer
- **C50** L3 · web-console · antigravity/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 | C22 | C23 | C24 | C25 | C26 | C27 | C28 | C29 | C30 | C31 | C32 | C33 | C34 | C35 | C36 | C37 | C38 | C39 | C40 | C41 | C42 | C43 | C44 | C45 | C46 | C47 | C48 | C49 | C50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| open | ✅ 407 |  |  |  |  |  |  |  |  |  | ✅⚠ 1048 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 453 |  | — 476 |  |  | ❌ 499 | ❌ 522 | ✅ 813 | ✅⚠ 896 |  |  |
| resume | ✅ 408 |  |  |  |  |  |  |  |  |  | ✅ 431 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 454 |  | — 477 |  |  | ❌ 500 | ❌ 523 |  | ✅⚠ 897 |  |  |
| resume-native | ◐ 409 |  |  |  |  |  |  |  |  |  | ✅ 432 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 455 |  | — 478 |  |  | ❌ 501 | ❌ 524 |  | ✅ 884 |  |  |
| observe-live | — 410 |  |  |  |  |  |  |  |  |  | ◐ 433 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 456 |  | ✅ 479 |  |  | ❌ 502 | ❌ 525 |  | ✅ 890 |  |  |
| observe-history | ✅ 411 |  |  |  |  |  |  |  |  |  | ✅ 434 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1011 |  | ◐ 457 |  | ✅ 480 |  |  | ❌ 503 | ❌ 526 |  |  |  |  |
| state | — 412 |  |  |  |  |  |  |  |  |  | ◐ 435 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❌ 3 |  |  |  |  |  |  |  |  |  | ✅ 1012 |  | ◐⚠ 545 |  | ◐⚠ 481 |  |  | ❌ 504 | ❌ 527 | ✅ 806 | ◐⚠ 889 |  |  |
| cancel | — 413 |  |  |  |  |  |  |  |  |  | ✅ 436 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1014 |  | — 459 |  | — 482 |  |  | ❌ 505 | ❌ 528 | ❌ 820 | ✅ 886 |  |  |
| close | — 414 |  |  |  |  |  |  |  |  |  | ◐ 437 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 460 |  | — 483 |  |  | ❌ 506 | ❌ 529 |  |  |  |  |
| steer | ✅ 415 |  |  |  |  |  |  |  |  |  | ✅ 438 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1013 |  | — 461 |  | ✅ 484 |  |  | ❌ 507 | ❌ 530 |  | ◐ 885 |  |  |
| inject-next |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1496 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| inject-tool |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1497 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| inject-inbox |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1498 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| inject-silent |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ◐ 1118 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| goal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1499 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| permission | ❌ 416 |  |  |  |  |  |  |  |  |  | ❌ 439 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 462 |  | ❌ 485 |  |  | ❌ 508 | ❌ 531 |  | ❌ 771 |  |  |
| fork | — 417 |  |  |  |  |  |  |  |  |  | ✅ 1051 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 463 |  | — 486 |  |  | ❌ 509 | ❌ 532 |  | ❌ 778 |  |  |
| compact | — 418 |  |  |  |  |  |  |  |  |  | — 441 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 464 |  | — 487 |  |  | ❌ 510 | ❌ 533 |  |  |  |  |
| model-list | — 419 |  |  |  |  |  |  |  |  |  | ✅ 442 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 465 |  | — 488 |  |  | ❌ 511 | ❌ 534 | ✅ 799 |  |  |  |
| model-new | ✅ 420 |  |  |  |  |  |  |  |  |  | — 443 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 466 |  | ◐ 489 |  |  | ❌ 512 | ❌ 535 |  |  | ✅ 854 | ❌ 838 |
| model-switch | ❌ 421 |  |  |  |  |  |  |  |  |  | ❌ 444 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 467 |  | — 490 |  |  | ❌ 513 | ❌ 536 |  | ❌ 892 |  |  |
| mode-switch | ❌ 422 |  |  |  |  |  |  |  |  |  | ❌ 445 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 468 |  | — 491 |  |  | ❌ 514 | ❌ 537 |  | ◐ 764 |  |  |
| quota | — 423 |  |  |  |  |  |  |  |  |  | ✅ 1045 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 469 |  | — 492 |  |  | ❌ 515 | ❌ 538 | ✅ 827 |  |  |  |
| channel-route |  | ◐ 1126 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| channel-health |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1500 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| guard |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1525 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| act-deliver |  |  |  |  |  |  | ❓⚠ 1505 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| act-request |  |  |  |  |  |  |  | ❓⚠ 1506 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| act-yield |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1507 |  |  |  |  |  |  |  |  |  |  |
| act-report |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1508 |  |  |  |  |  |  |  |
| wait-visible | — 427 |  |  |  |  |  |  |  |  |  | ✅ 450 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅⚠ 473 |  | ✅ 496 |  |  | ❌ 519 | ❌ 542 |  |  |  |  |
| wake-bg | ✅ 424 |  |  |  |  |  |  |  |  |  | ✅ 447 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 470 |  | ✅ 493 |  |  | ❌ 516 | ❌ 539 |  |  |  |  |
| wake-timer | ✅⚠ 425 |  |  |  |  |  |  |  |  |  | ✅ 448 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 471 |  | ✅ 494 |  |  | ❌ 517 | ❌ 540 |  |  |  |  |
| wake-msg | ✅ 426 |  |  |  |  |  |  |  |  |  | ✅ 449 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | — 472 |  | ✅ 495 |  |  | ❌ 518 | ❌ 541 |  |  |  |  |
| wake-stall | ❌⚠ 910 |  |  |  |  |  |  |  |  |  | ◐ 451 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ◐⚠ 474 |  | ◐ 497 |  |  | ❌ 520 | ❌ 543 |  |  |  |  |
| wake-persist | ◐ 429 |  |  |  |  |  |  |  |  |  | ◐ 452 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ◐ 475 |  | — 498 |  |  | ❌ 521 | ❌ 544 |  |  |  |  |
| spawn-subagent |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1492 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1009 |  |  |  |  |  |  |  |  |  |  |  |  |
| peer-message |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1513 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| handoff |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1514 |  |  |  |  |  |  |  |  |  |  |  |
| task-board |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1515 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ask-user |  |  |  |  |  |  |  |  |  | ❓⚠ 1509 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| notify-user |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1510 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| human-steer |  |  | ❓⚠ 1511 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| artifact |  |  |  |  |  | ❓⚠ 1517 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| browser |  |  |  |  |  |  |  |  | ❓⚠ 1518 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| terminal |  |  |  |  |  |  |  |  |  |  | ✅ 1530 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1519 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| dev-preview |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1520 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| mount-tools |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1495 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| instructions |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1494 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| workspace |  |  |  | ❓⚠ 1493 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| output-contract |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1526 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| open-idle |  |  |  |  |  |  |  |  |  |  | ✅ 1047 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| label |  |  |  |  | ✅ 1109 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| ownership |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1111 |  |  |  |  |  |  |  |  |  |
| discover-sessions |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1010 |  | ✅ 1110 |  |  |  |  |  |  |  |  |  |  |
| probe-host |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1130 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| capacity |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1502 |  |  |  |  |  |  |  |  |  |  |
| rewind |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ◐ 1176 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| archive |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1522 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| delete |  |  |  |  |  |  |  |  |  |  | ✅ 1528 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1523 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| handover-human |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1512 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| reclaim |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1516 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| cmd-list |  |  |  |  |  |  |  |  |  |  | ✅ 1529 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1521 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| sampling |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❌ 1132 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| memory-mode |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1504 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| loop-guard |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1524 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| channel-lease |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1501 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| host-drain |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1503 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| permission-scope |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1527 |  |  |  |  |  |  |

断点与条件：

- 行 2 · state · L0 antigravity/L0/transcript · ❌ 条件：智能体把命令放到后台、先交一段文字再等通知时。对应设计里的“主动让出”；只看 transcript 会把让出误判为本轮结束
- 行 3 · state · L0 antigravity/L0/presence-lock · ❌ 条件：会话已空闲。锁文件不能单独用来判活
- 行 68 · wait-visible · L0 antigravity/L0/summaries-db · ◐ 条件：。
- 行 69 · wake-stall · L0 antigravity/L0/summaries-db · ❌ 条件：会话已交最终回复之后。“让出中”标记会残留，Antigravity 自己不报超时；原因未知。外部要用“让出且 N 分钟无新步骤”兜底（watch_agy.js 用 10 分钟）
- 行 70 · wake-timer · L0 antigravity/L0/agentapi · ❓ 条件：。声明，未实测；若成立则唤醒由常驻守护进程托管，可能撑过桌面窗口关闭
- 行 227 · wake-stall · L0 antigravity/L0/agentapi · ❌ 条件：智能体把不会自己退出的命令放到后台（守护进程、或卡住的命令）。Antigravity 的后台任务没有超时，等不来就一直挂着；外部消息唤醒（wake-msg）可以救回。中心要自己做卡住检测（watch_agy.js：让出 10 分钟无新步骤）
- 行 228 · wake-stall · L0 antigravity/L0/agentapi · ❌ 条件：run_command launching persistent daemon without timeout。app-server is a persistent background daemon; executing it via run_command without a self-terminating client will hang execution indefinitely.
- 行 409 · resume-native · L0 antigravity/L0/agentapi · ◐ 条件：桌面人开的会话无法测（规矩禁触桌面 UI/他人会话）。用桌面同款 RPC StartCascade 开的会话是空壳：agentapi send-message 。壳会话任何后端路线都跑不动；RPC 方向续 agentapi 会话是通的（见 connect-rpc 行）
- 行 416 · permission · L0 antigravity/L0/agentapi · ❌ 条件：agentapi 开的会话命令执行策略恒为 eager（自动放行）；--profile=review/ask/always-ask 三档全部被忽略；工作区外写操。后端路线无法进入"等审批"状态，审批应答 RPC（HandleCascadeUserInteraction/ResolveOutstandingSteps）无从验证
- 行 421 · model-switch · L0 antigravity/L0/agentapi · ❌ 条件：CLI 无切模型子命令；其他路线也无（SetCascadeModelConfigData 404、332 方法表无 Set*Model*），会话中切模型后端做不。桌面端有模型下拉，说明该能力只存在于桌面私有通道
- 行 422 · mode-switch · L0 antigravity/L0/agentapi · ❌ 条件：--profile 三档全被忽略（策略恒 eager）；无改模式子命令。
- 行 428 · wake-stall · L0 antigravity/L0/agentapi · ◐ 条件：等不来时智能体用 Timer 周期自醒（有界轮询），外部可用 ForceStopCascadeTree 解卡且会话存活；但被等任务本身无硬超时（无法构造永不来事。
- 行 429 · wake-persist · L0 antigravity/L0/agentapi · ◐ 条件：定时唤醒以配置文件持久（重启后由 LS 重载，构造上存活）；进行中的后台等待驻留 language_server.exe 进程内（task id 仅存 tran。重启验证被规矩禁止，构造推断需标为假设
- 行 430 · open · L0 antigravity/L0/connect-rpc · ◐ 条件：StartCascade(source=CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT) 200 建出会话（db 可见）但轮次从。400 错误链: 首次 "CortexTrajectorySource is unspecified"
- 行 433 · observe-live · L0 antigravity/L0/connect-rpc · ◐ 条件：阻塞式等待原语可用（会话全闲即返回）；流式方法在 332 方法表中存在但未做流式观察实测。方法表尚有 StreamCascadeSummariesReactiveUpdates/StreamAgentStateUpdates 未实测
- 行 435 · state · L0 antigravity/L0/connect-rpc · ◐ 条件：步级状态完备（CORTEX_STEP_STATUS_*、statusTransitions），有阻塞等待原语；会话级 RUNNING/IDLE 真值只在 sum。
- 行 437 · close · L0 antigravity/L0/connect-rpc · ◐ 条件：DeleteConversation 二进制有符号但未注册 HTTP 服务（404）；DeleteCascadeTrajectory 可用：200 且库行+br。无优雅关闭/归档接口
- 行 439 · permission · L0 antigravity/L0/connect-rpc · ❌ 条件：审批应答方法存在（HandleCascadeUserInteraction、ResolveOutstandingSteps 在 332 方法表）但后端无法制造待。应答半边 unverified：造不出审批请求
- 行 444 · model-switch · L0 antigravity/L0/connect-rpc · ❌ 条件：SetCascadeModelConfigData 符号存在但 404（未挂服务）；332 方法表中模型相关仅 Get*；中途切模型后端无接口。
- 行 445 · mode-switch · L0 antigravity/L0/connect-rpc · ❌ 条件：无会话级模式 RPC（BattleMode 是另一功能）；唯一的静态配置写口 SetOrVerifyStaticConfig 501 弃用。
- 行 451 · wake-stall · L0 antigravity/L0/connect-rpc · ◐ 条件：外部解卡完备（ForceStopCascadeTree 实测，6s 内 not_fully_idle 1→0 且会话存活）；被等事件无内建超时，构造不了永不来事。
- 行 452 · wake-persist · L0 antigravity/L0/connect-rpc · ◐ 条件：同 agentapi 行：定时类配置盘上持久、进行中等待驻留进程内存；重启验证被规矩禁止。
- 行 457 · observe-history · L0 antigravity/L0/summaries-db · ◐ 条件：索引有 step_count/preview/raw_summary 但无全量内容；全量要靠 transcript/conversations db。
- 行 474 · wake-stall · L0 antigravity/L0/summaries-db · ◐ 条件：卡住可由长时 busy=1 被外部发现并配合 ForceStop 解除；库内无超时字段。
- 行 475 · wake-persist · L0 antigravity/L0/summaries-db · ◐ 条件：会话行落盘持久（重启后行仍在）；not_fully_idle 由 LS 进程维护，崩溃/重启后的陈旧值行为未验（不能重启桌面）。
- 行 481 · state · L0 antigravity/L0/transcript · ◐ 条件：单独用 transcript 判结束会误判：让出等后台时也会写 DONE 且无 tool_calls 的回复；必须联 summaries-db。此坑与 hosts/antigravity.md 第四节第 5 条一致，本轮实测复现
- 行 485 · permission · L0 antigravity/L0/transcript · ❌ 条件：全程未出现任何审批/permissions 步：eager 策略下工具直行，越界操作只有拒绝文本。
- 行 489 · model-new · L0 antigravity/L0/transcript · ◐ 条件：transcript 只能证 source=MODEL，模型名不在步字段；模型真值在 GetCascadeTrajectory（RPC 路线）。
- 行 497 · wake-stall · L0 antigravity/L0/transcript · ◐ 条件：Timer 步序列证明有界自醒（4/5/6 分钟逐次）；无硬超时步；解卡靠外部 RPC。
- 行 499 · open · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 500 · resume · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 501 · resume-native · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 502 · observe-live · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 503 · observe-history · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 504 · state · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 505 · cancel · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 506 · close · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 507 · steer · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 508 · permission · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 509 · fork · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 510 · compact · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 511 · model-list · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 512 · model-new · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 513 · model-switch · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 514 · mode-switch · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 515 · quota · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 516 · wake-bg · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 517 · wake-timer · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 518 · wake-msg · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 519 · wait-visible · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 520 · wake-stall · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 521 · wake-persist · L1a antigravity/L1a/agy-acp · ❌ 条件：无公开 ACP 桥：SDK 起桥即失败，协议会话根本建立不起来。
- 行 522 · open · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 523 · resume · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 524 · resume-native · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 525 · observe-live · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 526 · observe-history · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 527 · state · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 528 · cancel · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 529 · close · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 530 · steer · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 531 · permission · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 532 · fork · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 533 · compact · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 534 · model-list · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 535 · model-new · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 536 · model-switch · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 537 · mode-switch · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 538 · quota · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 539 · wake-bg · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 540 · wake-timer · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 541 · wake-msg · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 542 · wait-visible · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 543 · wake-stall · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 544 · wake-persist · L1b antigravity/L1b/acpx · ❌ 条件：acpx antigravity 起不动：spawn 找不到程序（预期内的 ENOENT）。
- 行 545 · state · L0 antigravity/L0/summaries-db · ◐ 条件：智能体交出“等后台任务”的文字后、后台任务登记之前的瞬间。索引会短暂显示空闲。判结束须“空闲且 transcript 无新行”持续 5 秒；两处网关已改（2026-10-17）
- 行 750 · open · L2 antigravity/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-antigravity-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 757 · model-switch · L2 antigravity/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 764 · mode-switch · L2 antigravity/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 771 · permission · L2 antigravity/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 778 · fork · L2 antigravity/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 792 · steer · L2 antigravity/L2/server-api · ◐ 条件：调用 POST /api/control 向 antigravity 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 820 · cancel · L2 antigravity/L2/agent_gateway · ❌ 条件：执行 node hub/tools/agent_gateway.js cancel --agent antigravity --standalone。agent_gateway.js:1017 硬编码判定 prof.driver !== 'acpx' 则直接抛错退出。底层 Antigravity Connect-RPC 拥有实测可用的 CancelCascadeInvocation（黑板 436 行），网关层在独立模式下完全没接上
- 行 838 · model-new · L3 antigravity/L3/web-console · ❌ 条件：console.js:49 antigravity canSwitchModelOnNew=false 且单模型 → 下拉完全不渲染。chat 抽屉反而给了 tier 下拉（chat.js:80）——两个前端对同一能力一砍一留
- 行 885 · steer · L2 antigravity/L2/server-api · ◐ 条件：会话运行中下发 POST /api/gateway/send (mode=queue)。网关未调用底层轮内实时插话接口，仅在内存中做了跨轮排队；区别于真正的一轮内生效插话
- 行 888 · resume · L2 antigravity/L2/server-api · ◐ 条件：POST /api/gateway/resume 恢复中断会话。只是在网关层拼了一句话重新发给智能体，未调用任何原生底层 resume 原语
- 行 889 · state · L2 antigravity/L2/server-api · ◐ 条件：GET /api/gateway/state 获取 7 渠道状态。纯内存状态机，未读取 conversation_summaries.db 或锁文件
- 行 892 · model-switch · L2 antigravity/L2/server-api · ❌ 条件：POST /api/gateway/model 对 antigravity 渠道切模型。表面返回 ok 但未对底层做任何操作，典型假闭环，核实 HANDOFF.md 第三节病灶 5
- 行 910 · wake-stall · L0 antigravity/L0/agentapi · ❌ 条件：测试员（Antigravity pro）一条命令返回码 1 之后。工具失败后会话静默结束，既不报错也不继续；外部只能看到“空闲”，看不出它没做完
- 行 1118 · inject-silent · L0 antigravity/L0/hooks · ◐ 条件：Antigravity 2.23.1, PreInvocation hook injectSteps.ephemeralMessage。原生命令行/RPC缺少静默注库原语；最高通过 PreInvocation 生命周期钩子补齐
- 行 1126 · channel-route · L0 antigravity/L0/agentapi+connect-rpc · ◐ 条件：Antigravity 2.23.1, --model / planModel。支持单次按需选模型档位；不支持单次换供应商凭证/中转Key（绑定官方OAuth）
- 行 1132 · sampling · L0 antigravity/L0/mcp-client · ❌ 条件：Antigravity 2.23.1, MCP Client Implementation。做不到：宿主未开放 MCP 反向借道采样端口
- 行 1176 · rewind · L0 antigravity/L0/slash-rewind+fork · ◐ 条件：Antigravity 2.23.1, /rewind slash command + forkAtStepIndex。最高通过分叉到指定步数实现逻辑回溯；原会话就地连带文件版本回退在无头接口下未开放
- 行 1492 · spawn-subagent · L0 antigravity/L0/connect-rpc · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：虽已验证父子索引关联与 ForceStopCascadeTree 杀树，但缺少子会话完成任务后产出真实回传父会话并被父会话引用的端到端回显
- 行 1493 · workspace · L0 antigravity/L0/agentapi+projects-config · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：元数据中虽存在 workspaceUris，但缺少智能体在指定独立工作区后，真实文件读写物理落盘在指定目录的原始回显
- 行 1494 · instructions · L0 antigravity/L0/customizations · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：系统虽支持 GEMINI.md/AGENTS.md 规则注入，但缺少新建会话指定专属角色说明后，模型回复严格受其约束且后续无法篡改的对照测试输出
- 行 1495 · mount-tools · L0 antigravity/L0/mcp+plugins · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：mcp_config.json 与 launchedMcpServers 元数据存在，但缺少挂接工具可成功调用、未挂接工具调用报错的原始执行对照
- 行 1496 · inject-next · L0 antigravity/L0/connect-rpc · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：二进制存在 MESSAGE_DELIVERY_STRATEGY_WHEN_IDLE 枚举，但缺少运行中送入消息、待当前轮结束后自动作为下轮输入触发推理的原始轨迹
- 行 1497 · inject-tool · L0 antigravity/L0/mcp · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：MCP 协议规范支持 ToolResult 携带上下文，但缺少在真实 ToolResult 中捎带指令并被下一步 PLANNER_RESPONSE 照做的原始输出
- 行 1498 · inject-inbox · L0 antigravity/L0/file-inbox · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：智能体具备 view_file 工具，但缺少外部写入收件箱文件后智能体主动巡检读取并改变行为的完整执行日志
- 行 1499 · goal · L0 antigravity/L0/hooks+slash · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：/goal 命令与 Stop 钩子规范存在，但缺少设定具体目标与预算后，智能体持续推进直到预算耗尽被拦下的原始回显
- 行 1500 · channel-health · L0 antigravity/L0/connect-rpc · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：/healthz 接口与配额查询可用，但缺少渠道网络异常或服务报错时系统自动标记不可用并停止派活的熔断日志
- 行 1501 · channel-lease · L0 antigravity/L0/presence-lock+gateway · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：presence 锁文件与 5h 平滑限流规则存在，但缺少多调用方并发请求时按上限排队并在持有者释放后放行的调度日志
- 行 1502 · capacity · L0 antigravity/L0/summaries-db · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：数据库可统计活跃会话槽位，但缺少并发数达到配额上限时新任务被硬性挂起或拒绝的运行证据
- 行 1503 · host-drain · L0 antigravity/L0/gateway+daemon · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：网关代码支持平稳退出，但缺少在跑轮次期间触发 drain、在跑任务全部完成且新请求被拦截暂存的原始输出
- 行 1504 · memory-mode · L0 antigravity/L0/slash-learn+conversations-db · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：底层单会话库文件物理隔离，但缺少新会话无法回忆上一会话专属秘密、显式 /learn 后新会话能读出的对照实验输出
- 行 1505 · act-deliver · L0 antigravity/L0/artifacts+transcript · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：write_to_file 带有 ArtifactMetadata，但缺少外部中心通过 API 收到结构化交付事件并提取产物的端到端原始回显
- 行 1506 · act-request · L0 antigravity/L0/ask_question+send_message · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：ask_question 与 send_message 工具存在，但缺少智能体主动发起审批/资源请求并由中心答复解挂的交互记录
- 行 1507 · act-yield · L0 antigravity/L0/summaries-db · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：后台长命令可进入 IDLE 待命，但缺少中心通过结构化接口读出其“正在等待什么”的标准字段输出
- 行 1508 · act-report · L0 antigravity/L0/transcript-stream · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：日志支持流式落盘，但缺少多步任务中外部监听器捕获到阶段性进展上报且当前轮次不中断的事件流输出
- 行 1509 · ask-user · L0 antigravity/L0/builtin-tool · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：ask_question 工具声明存在，但缺少在无头/CLI 环境下触发提问并在终端捕获人输入送回的原始日志
- 行 1510 · notify-user · L0 antigravity/L0/desktop-toast · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：宿主支持操作系统通知，但缺少程序触发桌面弹窗并在系统端捕获通知回执的原始数据
- 行 1511 · human-steer · L0 antigravity/L0/agentapi+desktop-input · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：agentapi send-message 支持插话，但缺少本次实测中在同一轮内插话后两步内改变输出的独立原始日志（前人日志不计入本次）
- 行 1512 · handover-human · L0 antigravity/L0/desktop-app · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：外部会话在桌面端侧边栏可见，但缺少人类在桌面端接手点击并继续交互的真实链路证据
- 行 1513 · peer-message · L0 antigravity/L0/send_message+rpc · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：SendAgentMessage 方法存在，但缺少会话 A 投递消息、会话 B 自动唤醒并回复的端到端调用链证据
- 行 1514 · handoff · L0 antigravity/L0/subagents+fork · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：invoke_subagent 与分叉方法存在，但缺少任务与上下文移交新会话后由接手者独立闭环的完整转写
- 行 1515 · task-board · L0 antigravity/L0/manage_task+board-file · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：manage_task 工具存在，但缺少多个会话同时读写同一份共享任务清单并达成状态共识的并发记录
- 行 1516 · reclaim · L0 antigravity/L0/force-stop+lock-release · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：ForceStopCascadeTree 可杀灭进程树，但缺少实例停下、会话锁放手、任务回到中心调度池重新派发的闭环回显
- 行 1517 · artifact · L0 antigravity/L0/artifacts-ui · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：write_to_file 规范支持发布产物，但缺少通过无头 API 触发发布并在人类端确认可打开交互的端到端回执
- 行 1518 · browser · L0 antigravity/L0/builtin-browser · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：内置搜索与正文提取工具存在，但缺少在测试会话中操作浏览器交互/渲染并取回 DOM 的行为日志
- 行 1519 · terminal · L0 antigravity/L0/run_command · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：此前仅为通用工具描述，缺少在被测宿主执行命令并捕获标准输出的专项独立证据（已通过补测打通）
- 行 1520 · dev-preview · L0 antigravity/L0/generative_ui+webview · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：generative_ui 规范存在，但缺少起本地服务并在独立预览容器内加载页面的控制台网络回执
- 行 1521 · cmd-list · L0 antigravity/L0/slash-commands · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：此前仅查阅 CLI 帮助文档，缺少通过服务端接口直接读取完整可用命令清单的原始输出（已通过补测打通）
- 行 1522 · archive · L0 antigravity/L0/metadata-hide · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：hideFromConversationList 字段存在，但缺少执行归档后主列表剔除、重新发消息后成功取回的状态机证据
- 行 1523 · delete · L0 antigravity/L0/sqlite-delete+rpc · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：此前仅为 SQL 操作假设，缺少调用宿主删除方法后再次读取报错的生命周期测试（已通过补测打通）
- 行 1524 · loop-guard · L0 antigravity/L0/loop-detector · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：二进制存在 loopErrorModelMessage 机制，但缺少构造重复失败行为触发模型警告或强制熔断的原始日志
- 行 1525 · guard · L0 antigravity/L0/hooks-json · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：hooks.json 钩子配置存在，但缺少在执行敏感工具时被 PreToolUse 真实拦截或改写参数的终端证据
- 行 1526 · output-contract · L0 antigravity/L0/rules+post-invocation-hook · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：GEMINI.md 规则存在，但缺少输出格式不合规时被 PostInvocation 钩子真正拦截并迫使模型重写的原始回显
- 行 1527 · permission-scope · L0 antigravity/L0/workspace-boundary · ❓ 条件：Antigravity 2.23.1 负责人复核：严格按行为证据标准重评。接口存在，缺行为证据：提示词规则包含目录限制，但缺少智能体尝试越界写文件被宿主安全沙箱硬拦截报错的原始终端输出

## claude

列：

- **C1** L0 · file · claude/L0/claude-cli
- **C2** L0 · native-desktop · claude/L0/desktop-app
- **C3** L0 · subagent · claude/L0/subagent
- **C4** L1a · acp-bridge · claude/L1a/claude-agent-acp
- **C5** L1b · acpx · claude/L1b/acpx
- **C6** L2 · agent-gateway-cli · claude/L2/agent_gateway
- **C7** L2 · gateway-server · claude/L2/server-api
- **C8** L3 · web-chat-drawer · claude/L3/web-chat-drawer
- **C9** L3 · web-console · claude/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---|---|---|---|---|---|---|---|---|
| open | ✅ 159 |  |  | ✅ 176 | ✅ 193 | ✅ 808 | ✅⚠ 921 |  |  |
| resume | ✅ 160 |  |  | ✅ 177 | ✅ 194 |  | ❌⚠ 922 |  |  |
| resume-native | ✅ 939 |  |  | ✅⚠ 741 | ❌⚠ 215 |  | ❌ 879 |  |  |
| observe-live | ✅ 162 |  |  | ✅ 179 | ✅ 196 |  |  |  |  |
| observe-history | ✅ 942 |  | ✅ 1023 | ✅ 987 | ◐ 197 |  |  |  |  |
| state | ✅ 949 |  | ◐⚠ 1024 | ✅ 988 | ◐⚠ 996 | ✅ 801 | ✅ 780 |  |  |
| cancel | ❌ 165 |  | ❌ 1026 | ✅ 989 | ✅ 997 | ✅ 815 |  |  |  |
| close | ✅ 950 |  |  | ✅ 990 | ✅ 998 |  |  |  |  |
| steer | ❌⚠ 739 |  | ❌ 1025 | ❌⚠ 740 | ◐⚠ 216 |  | ◐ 787 |  |  |
| inject-tool | ✅ 1273 |  |  |  |  |  |  |  |  |
| inject-inbox | ✅⚠ 1487 |  |  |  |  |  |  |  |  |
| inject-silent | ✅⚠ 1489 |  |  |  |  |  |  |  |  |
| goal | ✅ 1277 |  |  |  |  |  |  |  |  |
| permission | ❌ 168 |  |  | ✅⚠ 742 | ❌⚠ 217 |  | ❌ 766 |  |  |
| fork | ✅ 1175 |  |  | ✅⚠ 682 | — 203 |  | ❌ 773 |  |  |
| compact | ✅ 982 |  |  | ✅ 991 | ✅ 999 |  |  |  |  |
| model-list | — 171 |  |  | ✅ 992 | ❌⚠ 1000 | ✅ 794 |  |  |  |
| model-new | ✅ 983 |  |  | ◐⚠ 993 | ✅⚠ 743 |  |  |  |  |
| model-switch | ✅ 984 |  |  | —⚠ 683 | —⚠ 685 |  | ❌ 752 | ❌ 851 | ❌ 833 |
| mode-switch | ✅ 985 |  |  | ✅ 994 | ✅ 1001 |  | ◐ 759 |  |  |
| quota | ◐⚠ 986 |  |  | ◐⚠ 995 | — 209 | ✅ 822 |  |  |  |
| channel-route | ✅ 1269 |  |  |  |  |  |  |  |  |
| channel-health | ◐ 1284 |  |  |  |  |  |  |  |  |
| guard | ✅ 1149 |  |  |  |  |  |  |  |  |
| act-deliver | ✅ 1278 |  |  |  |  |  |  |  |  |
| act-yield | ❓⚠ 1455 |  |  |  |  |  |  |  |  |
| act-report | ❓⚠ 1454 |  |  |  |  |  |  |  |  |
| wait-visible | ❓⚠ 1450 |  |  |  |  |  |  |  |  |
| wake-bg |  | ✅ 63 |  |  |  |  |  |  |  |
| wake-timer |  | ❓ 65 |  |  |  |  |  |  |  |
| wake-msg |  | ✅ 64 |  |  |  |  |  |  |  |
| wake-stall | ❓⚠ 1449 |  |  |  |  |  |  |  |  |
| wake-persist | ❌ 1280 |  |  |  |  |  |  |  |  |
| spawn-subagent |  |  | ✅ 1021 |  |  |  |  |  |  |
| peer-message | ❓⚠ 1445 |  |  |  |  |  |  |  |  |
| handoff | ❓⚠ 1452 |  |  |  |  |  |  |  |  |
| task-board | ❓⚠ 1444 |  |  |  |  |  |  |  |  |
| ask-user | ❓⚠ 1446 |  |  |  |  |  |  |  |  |
| human-steer | ❓⚠ 1453 |  |  |  |  |  |  |  |  |
| artifact | ❓⚠ 1451 |  |  |  |  |  |  |  |  |
| terminal | ✅ 1217 |  |  |  |  |  |  |  |  |
| mount-tools | ✅⚠ 1485 |  |  |  |  |  |  |  |  |
| instructions | ❓⚠ 1439 |  |  |  |  |  |  |  |  |
| workspace | ✅⚠ 1488 |  |  |  |  |  |  |  |  |
| output-contract | ✅ 1276 |  |  |  |  |  |  |  |  |
| open-idle |  |  |  |  | ✅ 1206 |  |  |  |  |
| label |  |  |  |  | ✅ 1207 |  |  |  |  |
| ownership | ❓⚠ 1441 |  |  |  |  |  |  |  |  |
| discover-sessions | ✅ 1209 |  | ◐ 1022 |  |  |  |  |  |  |
| delete | ✅⚠ 1486 |  |  |  |  |  |  |  |  |
| handover-human | ❓⚠ 1443 |  |  |  |  |  |  |  |  |

断点与条件：

- 行 65 · wake-timer · L0 claude/L0/desktop-app · ❓ 条件：。
- 行 165 · cancel · L0 claude/L0/claude-cli · ❌ 条件：长轮次执行中 SIGTERM 打断（2.5s），再尝试 --resume。进程强杀后未持久化有效上下文，恢复轮次报 code 1
- 行 168 · permission · L0 claude/L0/claude-cli · ❌ 条件：-p 非交互模式带 --permission-mode manual 执行写文件。非交互打印模式无外部审批中转通道
- 行 197 · observe-history · L1b claude/L1b/acpx · ◐ 条件：acpx sessions history <name>。顶层 sessions history 默认 fallback 至 codex，需带完整 agent 路径
- 行 210 · resume-native · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 178 行（原结论 pass）。只是 initialize 声明了 loadSession/resume，没有续一个原生会话的调用结果
- 行 211 · steer · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 184 行（原结论 pass）。只是 _meta 声明了 promptQueueing；排队也不等于轮内插话
- 行 212 · permission · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 185 行（原结论 pass）。只写了方法名，没有收到审批请求的原文和答复后的行为
- 行 213 · fork · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 186 行（原结论 pass）。只是 initialize 声明了 fork，没有分叉调用和上下文连续的证据
- 行 214 · model-switch · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 190 行（原结论 pass）。只是列出了可选模型，没有切换后下一轮实际模型
- 行 215 · resume-native · L1b claude/L1b/acpx · ❌ 条件：核验第 195 行（原结论 pass）。证据是 acpx 新建了一个会话（created session），不是续接原生会话
- 行 216 · steer · L1b claude/L1b/acpx · ◐ 条件：核验第 201 行（原结论 pass）。--no-wait 是排队到下一轮，不是轮内插话（与 ZCode L1b 第 47 行同）
- 行 217 · permission · L1b claude/L1b/acpx · ❌ 条件：核验第 202 行（原结论 pass）。--approve-* 是启动时的静态策略，调用方无法中途答复（与 ZCode L1b 第 57 行同）
- 行 218 · model-new · L1b claude/L1b/acpx · ❓ 条件：核验第 206 行（原结论 pass）。model: haiku 是配置值，不是实际用量记录
- 行 219 · model-switch · L1b claude/L1b/acpx · ❓ 条件：核验第 207 行（原结论 pass）。status 显示的是配置的模型，不是下一轮实际用的模型
- 行 220 · steer · L0 claude/L0/claude-cli · ❓ 条件：核验第 167 行（原结论 pass）。证据只有 result=STEER_STOP，看不出第二句话是本轮内生效还是排到下一轮
- 行 678 · steer · L0 claude/L0/claude-cli · ❌ 条件：claude -p --input-format stream-json --output-format stream-json 管道输入连续两段 user m。CLI 非交互打印模式不支持轮内插话（表现为排队串行出两次结果）；同时受限于上游智能路由额度耗尽报错
- 行 679 · resume-native · L1a claude/L1a/claude-agent-acp · ❌ 条件：通过 connection.loadSession 加载原生会话 e7bb63b1-f61a-47e9-b51a-e1842913067b 并下发 prompt。loadSession 协议层成功，但后序提问验证轮因上游额度耗尽断在首轮请求，无法问出暗号
- 行 680 · steer · L1a claude/L1a/claude-agent-acp · ❌ 条件：活跃 turn 进行中下发并发 connection.prompt()。claude-agent-acp 仅支持 promptQueueing（排队），不满足任务书轮内插话（steer）定义
- 行 681 · permission · L1a claude/L1a/claude-agent-acp · ❌ 条件：模式置为 default (manual)，下发写文件 prompt 触发审批。无法在轮内收到审批请求原文，断在上游额度不足无法完成模型推理
- 行 684 · model-new · L1b claude/L1b/acpx · ❌ 条件：acpx claude sessions new -s probe-claude-l1b-mnew --model haiku 并下发 prompt。断在首轮请求，因上游额度耗尽无法完成一轮生成并取得实际用量/日志行
- 行 686 · resume-native · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 679 行（原结论 fail）。会话加载成功，但提问时上游返回 403 余额不足，没测到能力本身
- 行 687 · permission · L1a claude/L1a/claude-agent-acp · ❓ 条件：核验第 681 行（原结论 fail）。上游 403 余额不足，模型没产生工具调用，审批无从触发
- 行 688 · model-new · L1b claude/L1b/acpx · ❓ 条件：核验第 684 行（原结论 fail）。上游 403 余额不足，不是选模型能力的问题
- 行 739 · steer · L0 claude/L0/claude-cli · ❌ 条件：claude -p --input-format stream-json --output-format stream-json，中途管道写入第二个 user 。claude -p stream-json 将后续管道消息作为新轮次顺序排队，当前轮不受插话打断
- 行 740 · steer · L1a claude/L1a/claude-agent-acp · ❌ 条件：首个 session/prompt 运行中途发送并发的第二个 session/prompt。ACP桥协议层显式拒绝一轮未完时的 prompt 请求，不支持在当前轮插话
- 行 745 · open · L2 claude/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-claude-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 752 · model-switch · L2 claude/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 759 · mode-switch · L2 claude/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 766 · permission · L2 claude/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 773 · fork · L2 claude/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 787 · steer · L2 claude/L2/server-api · ◐ 条件：调用 POST /api/control 向 claude 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 833 · model-switch · L3 claude/L3/web-console · ❌ 条件：console.js:18-19 显示 glm-5.1/glm-5-turbo/glm-4.5-air（与 gateway sonnet/opus/defaul。默认渠道表（服务未连上时）显示的是编造模型清单
- 行 851 · model-switch · L3 claude/L3/web-chat-drawer · ❌ 条件：显示（mid=true）。显示未验证能力
- 行 879 · resume-native · L2 claude/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: claude-code:455376bf-3926-4c9b-8324-。点开原生会话发消息却新建了 hub-claude 空会话，核实 HANDOFF.md 第三节病灶 2
- 行 899 · open · L2 claude/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。时长越过写死的 --timeout 180，疑似被 acpx 超时杀掉；原因待确认
- 行 904 · resume · L2 claude/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。返回太快，像是进了网关内存队列排在未完成的上一轮后面，并未执行；接口 ok 不代表续上
- 行 922 · resume · L2 claude/L2/server-api · ❌ 条件：同上。
- 行 965 · steer · L0 claude/L0/subagent · ❌ 条件：Claude Code 2.1.296, CLI 尝试恢复子智能体。断在 CLI 参数强校验：子智能体 ID 非 UUID 格式，无法被外部命令单独 resume 交互
- 行 966 · cancel · L0 claude/L0/subagent · ❌ 条件：Claude Code 2.1.296。断在生命周期绑定：Sidechain 附庸无独立对外打断控制句柄
- 行 986 · quota · L0 claude/L0/claude-cli · ◐ 条件：claude 2.1.296，--model haiku（映射 claude-haiku-5-5），渠道 yinzi 中转 api.yinziapi.top（A。能拿到本会话按模型的累计用量与费用（Usage by model 分项），但没有剩余额度或时间窗口——中转渠道本就无订阅窗口，登记表判据"拿到剩余额度或窗口"只满足一半，记 partial。原第 175 行以 Total cost 摘要记 pass，同样只是用量不是额度。重要发现：S1 里出现 $0.60 的 clau
- 行 993 · model-new · L1a claude/L1a/claude-agent-acp · ◐ 条件：claude-agent-acp 0.90.0（acpx 内置注册表的桥，node 直跑其 dist/index.js），底层 claude-agent-sdk。记 partial：注入被接受、首轮实际跑 haiku，但渠道默认本就是 haiku（settings.json env ANTHROPIC_MODEL），注入效果与默认不可区分——唯一能区分的档位 opus/sonnet 被用户红线禁用。原第 189 行以 model_usage 出现 haiku 记 pass 属循
- 行 995 · quota · L1a claude/L1a/claude-agent-acp · ◐ 条件：claude-agent-acp 0.90.0（acpx 内置注册表的桥，node 直跑其 dist/index.js），底层 claude-agent-sdk。记 partial：能拿到会话级与按模型的 token 用量（压缩后归零可当判据），但无剩余额度/时间窗口——中转渠道本无订阅窗口。原第 192 行记 pass 名不副实：那是用量不是额度
- 行 996 · state · L1b claude/L1b/acpx · ◐ 条件：acpx 0.19.5，经 npx @agentclientprotocol/claude-agent-acp@^0.81.2 拉桥（注意：非全局 0.90.0。记 partial：idle/running 有字段判据且转换实测成立，但存在残留 worker 的 running 误报与 closed 后仍答 idle 的假象——acpx status 不可单独作状态真源。mode 字段恒为 "-"，不反映会话模式。原第 198 行只录了 idle 一态
- 行 1000 · model-list · L1b claude/L1b/acpx · ❌ 条件：acpx 0.19.5，经 npx @agentclientprotocol/claude-agent-acp@^0.81.2 拉桥（注意：非全局 0.90.0。判据「拿到真实可用的模型列表」在 acpx 命令面不成立，记 fail。完整五档列表只能经直连桥的 newSession configOptions 拿到（见 L1a model-list 格）。原第 205 行记 pass、证据是桥的五档数组但 cmd 写的是 acpx claude status——status 根
- 行 1022 · discover-sessions · L0 claude/L0/subagent · ◐ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1024 · state · L0 claude/L0/subagent · ◐ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1025 · steer · L0 claude/L0/subagent · ❌ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1026 · cancel · L0 claude/L0/subagent · ❌ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1280 · wake-persist · L0 claude/L0/claude-cli · ❌ 条件：Claude Code 2.1.296, 内置 CronCreate 工具 schema。唤醒撑过重启原生失败：Claude 内置定时唤醒仅在内存 session 中存活，会话或进程退出后全丢；最高补齐至中心代管（中心持久化定时器，到期执行 claude --resume 唤醒），代价是中心必须自建调度常驻进程
- 行 1284 · channel-health · L0 claude/L0/claude-cli · ◐ 条件：Claude Code 2.1.296, claude doctor 与 API 错误结构化上报。渠道健康与熔断半支持（partial）：原生能清晰报告渠道异常与网络错误分类，但 CLI 自身无多渠道故障转移/自动熔断路由机制；最高打通需在 L2 配合 agent_gateway/cc-switch 统一调度
- 行 1438 · mount-tools · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少模型尝试调用未挂接工具（如 Bash）时被拒绝或无权调用的行为输出
- 行 1439 · instructions · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少模型在回复中实际遵循所设定角色指令的行为输出证据
- 行 1440 · workspace · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少模型在指定工作目录下实际创建/修改文件的行为及工作树隔离生效的证据
- 行 1441 · ownership · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少中心/应用/人类终端不同所有权下的行为权限差异或所有权转移行为证据
- 行 1442 · delete · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少真实删除会话文件后导致 --resume 失败抛错的端到端行为验证
- 行 1443 · handover-human · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在真实 TTY 交互终端中完成附着接管并验证人工输入与退出脱离的行为
- 行 1444 · task-board · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少开启后智能体实际调用工具创建/流转任务看板条目的行为证据
- 行 1445 · peer-message · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在两个会话/子代理间实际发送并接收消息的端到端行为证据
- 行 1446 · ask-user · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少智能体执行中实际触发该工具挂起并接收人类回复的行为证据
- 行 1447 · inject-inbox · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少向约定收件箱文件写入指令并由智能体通过 Read 真实读取并执行的行为证据
- 行 1448 · inject-silent · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少静默修改后在下轮由模型成功引用该静默注入内容的真实执行证据
- 行 1449 · wake-stall · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在实际运行中触发超时截断并抛出异常的真实行为证据
- 行 1450 · wait-visible · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在存在待命任务时从外部真实查询出等待原因与参数的结构化输出证据
- 行 1451 · artifact · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少智能体实际调用工具生成并发布产物的行为证据
- 行 1452 · handoff · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在跨环境或跨代理交接中责任转移与状态接续的真实执行证据
- 行 1453 · human-steer · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在生成过程中发送中断信号并让模型吸收新指令继续生成的真实行为日志
- 行 1454 · act-report · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少在真实多步任务中捕获包含进展信息的流式文本块且不中断执行的原始日志证据
- 行 1455 · act-yield · L0 claude/L0/claude-cli · ❓ 条件：Claude Code 2.1.296, claude-haiku-5-5, 负责人复核判定 B 类。接口存在，缺行为证据：缺少智能体主动让出控制权并携带状态与附注的真实事件证据

## claude-desktop

列：

- **C1** L0 · native-desktop · claude-desktop/L0/code-session

| 能力 | C1 |
|---|---|
| steer | ✅ 1003 |
| permission | ✅ 1008 |
| compact | ✅ 1007 |
| guard | ✅ 1004 |
| wake-bg | ✅ 926 |
| wake-timer | ❓ 928 |
| wake-msg | ✅ 924 |
| wake-stall | ◐ 927 |
| wake-persist | ◐⚠ 1006 |
| spawn-subagent | ✅ 923 |
| peer-message | ❓ 937 |
| task-board | ◐ 938 |
| ask-user | ◐ 934 |
| notify-user | ❓ 936 |
| human-steer | ✅ 1002 |
| artifact | ❓ 935 |
| browser | ✅ 931 |
| terminal | ✅ 932 |
| dev-preview | ✅ 930 |
| mount-tools | ✅ 1005 |

断点与条件：

- 行 927 · wake-stall · L0 claude-desktop/L0/code-session · ◐ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。看护要中心自己做
- 行 928 · wake-timer · L0 claude-desktop/L0/code-session · ❓ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。测试需建定时任务，待用户允许
- 行 929 · wake-persist · L0 claude-desktop/L0/code-session · ❓ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。
- 行 934 · ask-user · L0 claude-desktop/L0/code-session · ◐ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。不是阻塞式提问；AskUserQuestion 本次未用
- 行 935 · artifact · L0 claude-desktop/L0/code-session · ❓ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。
- 行 936 · notify-user · L0 claude-desktop/L0/code-session · ❓ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。
- 行 937 · peer-message · L0 claude-desktop/L0/code-session · ❓ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。
- 行 938 · task-board · L0 claude-desktop/L0/code-session · ◐ 条件：Claude 桌面应用 Code 标签页，负责人本会话，2026-10-17。只给人看，不是多个智能体共享的任务板
- 行 1006 · wake-persist · L0 claude-desktop/L0/code-session · ◐ 条件：Claude 桌面应用 Code 标签页，负责人本会话（claude-opus-5-5），2026-10-18。宿主退出后后台任务没了，只留下“已停止”的通知

## codex

列：

- **C1** L0 · app-server · codex/L0/app-server
- **C2** L0 · desktop · codex/L0/desktop
- **C3** L0 · cli · codex/L0/exec
- **C4** L0 · subagent · codex/L0/subagent
- **C5** L1a · acp-bridge · codex/L1a/codex-acp
- **C6** L1b · acpx · codex/L1b/acpx
- **C7** L2 · agent-gateway-cli · codex/L2/agent_gateway
- **C8** L2 · gateway-server · codex/L2/server-api
- **C9** L3 · web-chat-drawer · codex/L3/web-chat-drawer
- **C10** L3 · web-console · codex/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|
| open | ✅ 246 |  | ✅ 229 |  | ✅ 263 | ✅ 280 | ❌ 807 | ✅⚠ 919 |  |  |
| resume | ✅ 247 |  | ✅ 230 |  | ✅ 264 | ✅ 281 |  | ✅⚠ 920 |  |  |
| resume-native | ✅ 248 |  | ✅ 231 |  | — 265 | ❌ 282 |  | ❌ 878 |  |  |
| observe-live | ✅ 249 |  | ✅ 232 |  | ✅ 266 | ✅ 283 |  |  |  |  |
| observe-history | ✅ 250 |  | — 233 | ✅ 1017 | — 267 | ✅ 284 |  | ◐ 891 |  |  |
| state | ✅ 251 |  | — 234 | ✅ 1018 | ✅ 268 | ✅ 285 | ✅ 800 | ✅ 779 |  |  |
| cancel | ✅ 252 |  | ❌ 235 | ◐ 1020 | ✅ 269 | ✅⚠ 675 | ✅ 814 |  |  |  |
| close | ✅ 253 |  | ✅ 236 |  | — 270 | ◐ 287 |  |  |  |  |
| steer | ✅⚠ 670 |  | — 237 | ❌ 1019 | — 271 | — 288 |  | ◐ 786 |  |  |
| inject-next | ❓⚠ 1398 |  | ❓⚠ 1399 |  |  |  |  |  |  |  |
| inject-tool | ❓⚠ 1400 |  |  |  |  |  |  |  |  |  |
| inject-inbox | ❓⚠ 1401 |  |  |  |  |  |  |  |  |  |
| inject-silent | ❓⚠ 1402 |  |  |  |  |  |  |  |  |  |
| goal | ❓⚠ 1403 |  |  |  |  |  |  |  |  |  |
| permission | ◐⚠ 323 |  | ❌ 238 |  | ❌ 272 | ❌ 289 |  | ❌ 895 |  |  |
| fork | ✅⚠ 671 |  | ✅⚠ 1107 |  | — 273 | — 290 |  | ❌ 772 |  |  |
| compact | ✅⚠ 672 |  | — 240 |  | — 274 | — 291 |  |  |  |  |
| model-list | ✅ 258 |  | ✅ 241 |  | ✅ 275 | ✅ 292 | ✅ 793 |  |  |  |
| model-new | ✅ 259 |  | ✅ 242 |  | ✅⚠ 674 | ✅⚠ 676 |  |  |  | ✅ 832 |
| model-switch | ✅⚠ 673 |  | ✅ 243 |  | ◐ 277 | ✅⚠ 677 |  | ❌ 751 | ❌ 848 |  |
| mode-switch | ✅ 261 |  | ✅ 244 |  | ✅ 278 | ✅ 295 |  | ◐ 758 |  |  |
| quota | ◐⚠ 1106 |  | — 245 |  | — 279 | — 296 | ✅ 821 |  |  |  |
| channel-route | ❓⚠ 1490 |  |  |  |  |  |  |  |  |  |
| channel-health | ❓⚠ 1404 |  |  |  |  |  |  |  |  |  |
| guard | ❓⚠ 1405 |  |  |  |  |  |  |  |  |  |
| act-deliver | ❓⚠ 1406 |  |  |  |  |  |  |  |  |  |
| act-request | ❓⚠ 1407 |  |  |  |  |  |  |  |  |  |
| act-yield | ❓⚠ 1408 |  |  |  |  |  |  |  |  |  |
| act-report | ❓⚠ 1409 |  |  |  |  |  |  |  |  |  |
| wait-visible | ❓⚠ 1410 |  |  |  |  |  |  |  |  |  |
| wake-bg | ❓⚠ 1411 |  |  |  |  |  |  |  |  |  |
| wake-timer | ❌ 1069 |  |  |  |  |  |  |  |  |  |
| wake-msg | ❓⚠ 1412 |  |  |  |  |  |  |  |  |  |
| wake-stall | ❓⚠ 1413 |  |  |  |  |  |  |  |  |  |
| wake-persist | ❓⚠ 1414 |  |  |  |  |  |  |  |  |  |
| spawn-subagent | ✅ 1108 |  |  | ✅ 1015 |  |  |  |  |  |  |
| peer-message |  |  |  | ❓⚠ 1415 |  |  |  |  |  |  |
| handoff | ❓⚠ 1416 |  |  |  |  |  |  |  |  |  |
| task-board | ❓⚠ 1417 |  |  |  |  |  |  |  |  |  |
| ask-user | ❓⚠ 1418 |  |  |  |  |  |  |  |  |  |
| notify-user | ❓⚠ 1419 |  |  |  |  |  |  |  |  |  |
| human-steer | ❓⚠ 1420 |  |  |  |  |  |  |  |  |  |
| artifact | ❓⚠ 1421 |  |  |  |  |  |  |  |  |  |
| browser | ❓⚠ 1422 |  |  |  |  |  |  |  |  |  |
| terminal | ✅ 1395 |  |  |  |  |  |  |  |  |  |
| dev-preview |  | ❓⚠ 1423 |  |  |  |  |  |  |  |  |
| mount-tools | ❓⚠ 1424 |  |  |  |  |  |  |  |  |  |
| instructions | ✅⚠ 1397 |  |  |  |  |  |  |  |  |  |
| workspace | ❓⚠ 1425 |  |  |  |  |  |  |  |  |  |
| output-contract | ❓⚠ 1426 |  |  |  |  |  |  |  |  |  |
| open-idle | ✅ 1087 |  | ❌ 1088 |  |  |  |  |  |  |  |
| label | ✅ 1089 |  |  |  |  |  |  |  |  |  |
| ownership | ✅ 1090 |  |  |  |  |  |  |  |  |  |
| discover-sessions | ✅ 1091 |  |  | ✅ 1016 |  |  |  |  |  |  |
| probe-host |  |  | ✅ 1092 |  |  |  |  |  |  |  |
| capacity | ❓⚠ 1427 |  |  |  |  |  |  |  |  |  |
| rewind | ✅ 1094 |  |  |  |  |  |  |  |  |  |
| archive | ✅ 1095 |  |  |  |  |  |  |  |  |  |
| delete | ✅ 1096 |  |  |  |  |  |  |  |  |  |
| handover-human | ❓ 1163 |  | ❓⚠ 1428 |  |  |  |  |  |  |  |
| reclaim | ❓⚠ 1429 |  |  |  |  |  |  |  |  |  |
| cmd-list |  |  | ✅ 1099 |  |  |  |  |  |  |  |
| sampling |  |  |  | ❓⚠ 1430 |  |  |  |  |  |  |
| memory-mode | ❓⚠ 1431 |  |  |  |  |  |  |  |  |  |
| loop-guard | ❓⚠ 1432 |  |  |  |  |  |  |  |  |  |
| channel-lease | ❓⚠ 1433 |  |  |  |  |  |  |  |  |  |
| host-drain | ❓⚠ 1434 |  |  |  |  |  |  |  |  |  |
| permission-scope | ❓⚠ 1435 |  |  |  |  |  |  |  |  |  |

断点与条件：

- 行 235 · cancel · L0 codex/L0/exec · ❌ 条件：kill child process during execution on Windows。Killing the CLI process leaves background worker holding the active writer lock on Windows, blocking resume.
- 行 238 · permission · L0 codex/L0/exec · ❌ 条件：approval_policy="on-request" in headless exec。CLI does not support interactive mid-turn approval callbacks on stdio; tool calls fail without reverse RPC.
- 行 262 · quota · L0 codex/L0/app-server · ❌ 条件：account/rateLimits/read with custom provider。Requires official ChatGPT account authentication; fails under third-party bearer token config.
- 行 272 · permission · L1a codex/L1a/codex-acp · ❌ 条件：file write in workspace-write mode。codex-acp does not properly wire reverse permission approval to client handler, causing turn hang.
- 行 277 · model-switch · L1a codex/L1a/codex-acp · ◐ 条件：setSessionConfigOption mid-session。Config updated in bridge, but underlying app-server turn not guaranteed to switch.
- 行 282 · resume-native · L1b codex/L1b/acpx · ❌ 条件：acpx codex sessions new --resume-session with native threadId。acpx cannot directly resume native CLI thread ID because ACP bridge lacks loadSession support.
- 行 287 · close · L1b codex/L1b/acpx · ◐ 条件：acpx codex sessions close。Session entry closed locally, but descendant cleanup lease retained with warning.
- 行 289 · permission · L1b codex/L1b/acpx · ❌ 条件：non-interactive CLI run。acpx CLI runs non-interactively; permission requests cannot be interactively resolved by caller mid-turn.
- 行 321 · fork · L0 codex/L0/exec · ❓ 条件：核验第 239 行（原结论 pass）。只有原会话和分叉会话的编号与 FORK_BRANCH_OK 标签，没有在分叉会话里问出父会话内容
- 行 322 · steer · L0 codex/L0/app-server · ❓ 条件：核验第 254 行（原结论 pass）。turn/steer 只返回了 turnId，没有证据显示插入的话在本轮内生效
- 行 323 · permission · L0 codex/L0/app-server · ◐ 条件：核验第 255 行（原结论 pass）。确实在轮中途收到 item/fileChange/requestApproval 原文；答复之后它是否继续执行没有记录
- 行 324 · fork · L0 codex/L0/app-server · ❓ 条件：核验第 256 行（原结论 pass）。只有分叉线程编号，没有上下文连续的证据
- 行 325 · compact · L0 codex/L0/app-server · ❓ 条件：核验第 257 行（原结论 pass）。thread/compact/start 返回 {}，没有上下文用量下降的证据
- 行 326 · model-switch · L0 codex/L0/app-server · ❓ 条件：核验第 260 行（原结论 pass）。只记录了请求的模型，没有这一轮实际用的模型
- 行 327 · model-new · L1a codex/L1a/codex-acp · ❓ 条件：核验第 276 行（原结论 pass）。currentModelId 是会话配置，不是实际用量记录
- 行 328 · cancel · L1b codex/L1b/acpx · ❓ 条件：核验第 286 行（原结论 pass）。cancel 只返回 cancel requested，后面贴的是请求而不是响应，看不出被打断的那轮是否停下、会话是否可续
- 行 329 · model-new · L1b codex/L1b/acpx · ❓ 条件：核验第 293 行（原结论 pass）。默认模型是配置，不是实际用量记录
- 行 330 · model-switch · L1b codex/L1b/acpx · ❓ 条件：核验第 294 行（原结论 pass）。subsequent prompt verified 没有附实际模型字段原文
- 行 744 · open · L2 codex/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-codex-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 751 · model-switch · L2 codex/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 758 · mode-switch · L2 codex/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 765 · permission · L2 codex/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 772 · fork · L2 codex/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 786 · steer · L2 codex/L2/server-api · ◐ 条件：调用 POST /api/control 向 codex 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 807 · open · L2 codex/L2/agent_gateway · ❌ 条件：执行 node hub/tools/agent_gateway.js run --agent codex --standalone。agent_gateway.js:852-994：独立路径下 antigravity 调 language_server agentapi 命令行；其余 6 家通过临时文件经 acpx 发送，解决 Windows cmd.exe 多行截断问题；Codex 默认模型未被其 ACP 桥列入导致启动失败
- 行 848 · model-switch · L3 codex/L3/web-chat-drawer · ❌ 条件：chat.js:23 codex canSwitchModelMidSession=false → 现有会话只显示静态 pill。能做却不给入口（与 console 相反）
- 行 870 · open · L2 codex/L2/server-api · ❌ 条件：POST /api/gateway/send 传入模型与桥不匹配或使用声明模型 gpt-5.5。网关未对各渠道真实可用模型做预先校验，盲目向 acpx 传参；上游模型渠道 503 阻断
- 行 877 · resume · L2 codex/L2/server-api · ❌ 条件：POST /api/gateway/send 对 codex 会话续跑。首轮未通导致无法续跑，断在上游渠道
- 行 878 · resume-native · L2 codex/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: codex:01a14366-e657-7af2-8e24-4064d3。gateway.ts:3395 仅在 listAcpxSessions() 查找，原生 ID 查不到直接 fallback 至 hub-codex，造成原生会话脱节
- 行 891 · observe-history · L2 codex/L2/server-api · ◐ 条件：GET /api/sessions 与 GET /api/sessions/<id>。历史读取正常，但列表混合原生会话与 acpx 会话，未加 surfaceType 区分
- 行 895 · permission · L2 codex/L2/server-api · ❌ 条件：检查审批机制与 POST /api/gateway/approve 流程。非协议层中途挂起与应答，纯事后正则匹配与提示词重新注入，核实 HANDOFF.md 第三节病灶 4
- 行 898 · open · L2 codex/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。网关先 ensure 再 prompt，ensure 未建成会话；原因待查（模型 gpt-5.4-mini 在中转 503 可能相关）
- 行 960 · steer · L0 codex/L0/subagent · ❌ 条件：Codex app-server RPC 接口向子智能体排队发消息。断在服务端门禁：app-server 强行阻断外部直接向子智能体排队送话，要求必须由父级会话管理
- 行 961 · cancel · L0 codex/L0/subagent · ◐ 条件：Codex 多智能体协作工具。依赖父智能体控制面，无独立的无头子智能体外部 cancel 端点
- 行 1019 · steer · L0 codex/L0/subagent · ❌ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1020 · cancel · L0 codex/L0/subagent · ◐ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1069 · wake-timer · L0 codex/L0/app-server · ❌ 条件：codex-cli 0.159.2, 原生无定时器调度器。理论上限与限制：Codex 无内部 cron/定时唤醒原语，必须由宿主（中心任务调度器或系统级 cron）保管定时等待，到点通过 turn/start 唤醒。
- 行 1072 · wake-persist · L0 codex/L0/app-server · ◐ 条件：codex-cli 0.159.2, queue_1.sqlite & goals_1.sqlite 持久化。唤醒撑过重启部分支持：静态队列和目标能撑过进程重启，但运行中的临时监听器和未持久化状态需要宿主重新拉起。
- 行 1088 · open-idle · L0 codex/L0/exec · ❌ 条件：codex-cli 0.159.2, CLI exec 命令限制。CLI 一次性会话无法只建不跑，设计为单轮运行即退出。
- 行 1100 · sampling · L0 codex/L0/subagent · ◐ 条件：codex-cli 0.159.2, 子智能体继承宿主模型渠道。借道采样部分支持：子智能体代调模型统一走宿主配置，但未提供类似 MCP 协议标准的反向 sampling/createMessage RPC。
- 行 1103 · channel-lease · L0 codex/L0/app-server · ◐ 条件：codex-cli 0.159.2, account/rateLimits/updated 通知。渠道租约与排队部分支持：提供上游限流推送通知，但全局跨并发租约需由中心调度层维护。
- 行 1106 · quota · L0 codex/L0/app-server · ◐ 条件：codex-cli 0.159.2, account/rateLimits/read。查额度事实边界：Codex app-server 仅对官方 OAuth 登录态返回剩余额度与窗口；对自定义 key/中转站返回 -32600，只能由中心直接请求中转站管理 API 获取剩余额度。
- 行 1159 · mount-tools · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只看到 thread/start 接受了 dynamicTools 和 mcp_servers 参数，没有智能体实际调用挂上的工具的证据。要补行为级证据
- 行 1160 · instructions · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只看到 developerInstructions 写进了线程元数据，没有回复体现说明约束的证据。要补行为级证据
- 行 1161 · loop-guard · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只描述了 Stop 钩子可以返回 block，没有实际触发循环并被拦下的记录。要补行为级证据
- 行 1162 · host-drain · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只描述了 daemon stop 和关闭 stdio，没有“在跑的轮次正常结束、新活不丢”的实测。要补行为级证据
- 行 1163 · handover-human · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只描述了 codex resume 和 codex app 能打开会话，没有实测记录。要补行为级证据
- 行 1164 · guard · L0 codex/L0/app-server · ❓ 条件：负责人核验 agy-fact-codex 10-18 的记录。更正：只描述了钩子能力，本格无新的触发实测。要补行为级证据
- 行 1398 · inject-next · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：thread/queue/add 虽返回成功并进入列表，但缺一轮执行结束后待办队列项自动作为下一轮输入的实际运行截获证据。
- 行 1399 · inject-next · L0 codex/L0/exec · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：codex queue 命令语法虽经帮助核验，但缺会话实际在跑时通过外部 CLI 送入并在下轮看到的执行回执。
- 行 1400 · inject-tool · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：item/tool/call 反向 RPC 结构存在，但缺智能体调用工具时返回 contentItems 并被模型采纳照做的完整交互事件流。
- 行 1401 · inject-inbox · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：内置文件读取工具存在，但缺智能体在运行中主动读取收件箱文件并改变行动轨迹的实测日志。
- 行 1402 · inject-silent · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：thread/inject_items 虽返回空成功，但在随后的 turn 中模型回答“不知道密码”，未能证明注入的内容在下一轮被模型实际认知和引用。
- 行 1403 · goal · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：thread/goal/set/get 读写成功，但缺少在多轮消耗中 tokenBudget 耗尽后智能体自动转入 budgetLimited 停止状态的动态证据。
- 行 1404 · channel-health · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺实际制造渠道故障时捕获 error 通知中 willRetry 标记及熔断停用的事件流。
- 行 1405 · guard · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：hooks/list 列出了钩子，但缺少在运行中 Stop 钩子返回 {"decision":"block"} 成功强制轮次继续的实时轨迹证据。
- 行 1406 · act-deliver · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：outputSchema 参数存在，但缺少模型交出符合该 schema 的 JSON 并被校验通过的实测输出。
- 行 1407 · act-request · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：ServerRequest 字典存在，但缺少模型在运行时主动发起 requestApproval / requestUserInput 的活体拦截证据。
- 行 1408 · act-yield · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少智能体在一轮中间因等待审批主动挂起并触发 activeFlags 广播的事件日志。
- 行 1409 · act-report · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少模型在长步骤中实时推送 turn/plan/updated 的实际增量片段。
- 行 1410 · wait-visible · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少处于等待中时外部通过状态接口读出等待原因的具体返回载荷。
- 行 1411 · wake-bg · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少后台终端或进程派生后，通过 process/exited 通知唤醒主会话的完整生命周期日志。
- 行 1412 · wake-msg · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少处于挂起待命的会话由外部消息触发恢复并带着上下文继续的完整轮次记录。
- 行 1413 · wake-stall · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少故意造成连接挂起超过 300s 触发超时阻断的原始报错。
- 行 1414 · wake-persist · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少守护进程彻底重启后，静态队列项仍能被自动唤醒执行的端到端证据。
- 行 1415 · peer-message · L0 codex/L0/subagent · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少父子智能体之间通过 send_input / wait 成功传递消息并收到回执的真实 transcript。
- 行 1416 · handoff · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少 review/start delivery:detached 派生出的审查子线程接手责任完成交付的完整轨迹。
- 行 1417 · task-board · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少多个会话并发读写同一份 goal 状态的协作记录。
- 行 1418 · ask-user · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少模型提出选择题并接收中心 answers 回答后继续推导的完整往返。
- 行 1419 · notify-user · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少桌面通知可执行文件实际被拉起并接收到 "turn-ended" 参数的进程日志。
- 行 1420 · human-steer · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少在长推理过程中调用 turn/steer，并在同一轮的下一步输出中体现该输入的实测片段。
- 行 1421 · artifact · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少插件实际生成并在本地呈现 pptx/pdf/html 产物的物理文件证据。
- 行 1422 · browser · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少 browser@openai-bundled 实际驱动 Chrome 浏览器访问网页并返回内容的执行记录。
- 行 1423 · dev-preview · L0 codex/L0/desktop · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少桌面端捕获本地 HTTP 服务并在 webview 渲染出页面的截图或窗口探测。
- 行 1424 · mount-tools · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：dynamicTools 参数虽被接收，但缺少模型真正调用该动态工具并触发 item/tool/call 的交互事实。
- 行 1425 · workspace · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：cwd 参数虽已生效，但缺少智能体在指定工作目录下实际创建/修改文件的物理落盘证据。
- 行 1426 · output-contract · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少模型面对 outputSchema 输出合法 JSON 及格式不符时被拒的对比实验。
- 行 1427 · capacity · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少多线程并发打满宿主并读出当前活跃占用峰值的实测数据。
- 行 1428 · handover-human · L0 codex/L0/exec · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少通过 codex resume 进入 TUI 后人类按键继续交互的终端录屏/日志。
- 行 1429 · reclaim · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：thread/unsubscribe 虽执行，但 thread/loaded/list 仍包含该 ID，内存卸载的语义行为尚未确认。
- 行 1430 · sampling · L0 codex/L0/subagent · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少子会话调用模型并在账单或本地用量中体现为宿主扣费的对账凭据。
- 行 1431 · memory-mode · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：mode: "disabled" 虽返回成功，但缺少两次会话后全局长期记忆未发生变化的对照验证。
- 行 1432 · loop-guard · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少智能体重复失败动作达到阈值时被 Stop 钩子硬拦截的实际日志。
- 行 1433 · channel-lease · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少在并发场景下收到 rateLimits 通知并按租约排队依次放行的运行轨迹。
- 行 1434 · host-drain · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少在跑任务期间触发排空，确认任务无损完成而新任务被暂存的实测。
- 行 1435 · permission-scope · L0 codex/L0/app-server · ❓ 条件：codex-cli 0.159.2 复核审阅。接口存在，缺行为证据：缺少只读沙箱下智能体写自身数据目录放行、越界写入被拦截等审批的对照实测。
- 行 1490 · channel-route · L0 codex/L0/app-server · ❓ 条件：负责人抽查 agy-fact-codex-audit 的补测通过行。存疑：可能是不落盘的临时线程；需要可复查的证据（会话记录或供应商侧的请求日志）

## gemini

列：

- **C1** L0 · native-cli · gemini/L0/cli
- **C2** L1a · acp-bridge · gemini/L1a/gemini-acp
- **C3** L1b · acpx-cli · gemini/L1b/acpx

| 能力 | C1 | C2 | C3 |
|---|---|---|---|
| open | ❌ 600 | ❌ 623 | ❌ 646 |
| resume | ❌ 601 | ❌ 624 | ❌ 647 |
| resume-native | ❌ 602 | ❌ 625 | ❌ 648 |
| observe-live | ❌ 603 | ❌ 626 | ❌ 649 |
| observe-history | ❌ 604 | ❌ 627 | ❌ 650 |
| state | ❌ 605 | ❌ 628 | ❌ 651 |
| cancel | ❌ 606 | ❌ 629 | ❌ 652 |
| close | ❌ 607 | ❌ 630 | ❌ 653 |
| steer | — 608 | ❌ 631 | ❌ 654 |
| permission | ❌ 609 | ❌ 632 | ❌ 655 |
| fork | — 610 | ❌ 635 | na 656 |
| compact | — 611 | — 636 | na 657 |
| model-list | ❌ 612 | ❌ 637 | na 658 |
| model-new | ❌ 613 | ❌ 633 | ❌ 659 |
| model-switch | ❌ 614 | ❌ 634 | ❌ 660 |
| mode-switch | — 615 | ❌ 638 | ❌ 661 |
| quota | — 616 | — 639 | na 662 |
| wait-visible | — 620 | — 643 | ❌ 666 |
| wake-bg | — 617 | — 640 | na 663 |
| wake-timer | — 618 | — 641 | na 664 |
| wake-msg | — 619 | — 642 | na 665 |
| wake-stall | — 621 | — 644 | na 667 |
| wake-persist | — 622 | — 645 | na 668 |

断点与条件：

- 行 600 · open · L0 gemini/L0/cli · ❌ 条件：oauth 已过期且拒绝浏览器重登（按任务书不登录）。same wall for all -p runs
- 行 601 · resume · L0 gemini/L0/cli · ❌ 条件：--resume 存在但建会话已不可能。-
- 行 602 · resume-native · L0 gemini/L0/cli · ❌ 条件：无原生会话可开，无从续起。本轮未能自开 probe- 会话
- 行 603 · observe-live · L0 gemini/L0/cli · ❌ 条件：-o stream-json 存在但运行不到那一步。-
- 行 604 · observe-history · L0 gemini/L0/cli · ❌ 条件：--list-sessions 也被 auth 门挡住；本地旧会话文件存在。旧数据可读但无法做本轮端到端验证
- 行 605 · state · L0 gemini/L0/cli · ❌ 条件：同上，--list-sessions 不可用。-
- 行 606 · cancel · L0 gemini/L0/cli · ❌ 条件：无 turn 可跑，无从打断。-p 模式下只能杀进程（未验证）
- 行 607 · close · L0 gemini/L0/cli · ❌ 条件：--delete-session 依赖 --list-sessions 出索引，而后者被挡。-
- 行 609 · permission · L0 gemini/L0/cli · ❌ 条件：--approval-mode default 需要交互应答，headless 无法应答；且 auth 已挡。未达可测条件
- 行 612 · model-list · L0 gemini/L0/cli · ❌ 条件：无列表命令；-m 自由填写；auth 挡住一切。-
- 行 613 · model-new · L0 gemini/L0/cli · ❌ 条件：-m gemini-2.5-flash 传了但 turn 不可达，无法验证实际模型。-
- 行 614 · model-switch · L0 gemini/L0/cli · ❌ 条件：CLI 无会话中切换机制（--resume+-m 未验证，auth 挡）。-
- 行 623 · open · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 624 · resume · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 625 · resume-native · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 626 · observe-live · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 627 · observe-history · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 628 · state · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 629 · cancel · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 630 · close · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 631 · steer · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 632 · permission · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 633 · model-new · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 634 · model-switch · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 635 · fork · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。依据：@agentclientprotocol/sdk schema.json 无 compact/quota/wake 类方法，且桥未可达
- 行 637 · model-list · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 638 · mode-switch · L1a gemini/L1a/gemini-acp · ❌ 条件：桥启动即挂，initialize 90s 无响应，会话无从建立。initialize 无响应→agentCapabilities 未知，逐项调用不可进行
- 行 646 · open · L1b gemini/L1b/acpx · ❌ 条件：sessions new 失败→NO_SESSION；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 647 · resume · L1b gemini/L1b/acpx · ❌ 条件：无会话可续；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 648 · resume-native · L1b gemini/L1b/acpx · ❌ 条件：无原生会话可开，也无从续；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 649 · observe-live · L1b gemini/L1b/acpx · ❌ 条件：无会话，无流可看；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 650 · observe-history · L1b gemini/L1b/acpx · ❌ 条件：acpx gemini sessions list 依赖会话存在；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 651 · state · L1b gemini/L1b/acpx · ❌ 条件：acpx hermes 式 status 对 gemini 无会话可查；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 652 · cancel · L1b gemini/L1b/acpx · ❌ 条件：无在跑 turn；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 653 · close · L1b gemini/L1b/acpx · ❌ 条件：无会话可关；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 654 · steer · L1b gemini/L1b/acpx · ❌ 条件：无在跑 turn；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 655 · permission · L1b gemini/L1b/acpx · ❌ 条件：无在跑 turn；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 659 · model-new · L1b gemini/L1b/acpx · ❌ 条件：--model 无会话可应用；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 660 · model-switch · L1b gemini/L1b/acpx · ❌ 条件：无会话；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 661 · mode-switch · L1b gemini/L1b/acpx · ❌ 条件：set-mode 需活会话；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）
- 行 666 · wait-visible · L1b gemini/L1b/acpx · ❌ 条件：status 无会话可报；根因同启动超时。根因：OAuth 交互等待 + 无 API Key（见 L0 行）

## hermes

列：

- **C1** L0 · cli · hermes/L0/cli
- **C2** L0 · subagent · hermes/L0/subagent
- **C3** L1a · acp-bridge · hermes/L1a/acp-bridge
- **C4** L1b · acpx-cli · hermes/L1b/acpx
- **C5** L2 · agent-gateway-cli · hermes/L2/agent_gateway
- **C6** L2 · gateway-server · hermes/L2/server-api
- **C7** L3 · web-chat-drawer · hermes/L3/web-chat-drawer
- **C8** L3 · web-console · hermes/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|---|
| open | ✅ 297 |  | ✅ 554 | ✅ 577 | ✅ 812 | ✅⚠ 917 |  |  |
| resume | ✅ 298 |  | ✅ 555 | ✅ 578 |  | ◐⚠ 918 |  |  |
| resume-native | ✅ 299 |  | ✅ 556 | ❌ 579 |  | ❌ 883 |  |  |
| observe-live | ✅ 300 |  | ✅ 557 | ✅ 580 |  |  |  |  |
| observe-history | ✅ 301 | ❓⚠ 1342 | ✅ 558 | ✅ 581 |  |  |  |  |
| state | ◐ 302 |  | ◐ 559 | ✅ 582 | ✅ 805 | ✅ 784 |  |  |
| cancel | ✅ 303 | ❓⚠ 1343 | ✅ 560 | ✅ 583 | ✅ 819 |  |  |  |
| close | — 304 |  | ✅ 561 | ✅ 584 |  |  |  |  |
| steer | ❌ 305 |  | ✅ 562 | ❌ 585 |  | ◐ 791 |  |  |
| inject-next | ❓⚠ 1371 |  |  |  |  |  |  |  |
| inject-tool | ❓⚠ 1372 |  |  |  |  |  |  |  |
| inject-inbox | ❓⚠ 1373 |  |  |  |  |  |  |  |
| inject-silent | ◐ 1289 |  |  |  |  |  |  |  |
| goal | ❓⚠ 1370 |  |  |  |  |  |  |  |
| permission | ❌ 306 |  | ✅ 563 | ◐ 586 |  | ❌ 770 |  |  |
| fork | ✅⚠ 1183 |  | ✅ 564 | — 587 |  | ❌ 777 |  |  |
| compact | — 308 |  | — 565 | — 588 |  |  |  |  |
| model-list | ◐ 309 |  | ✅ 566 | ✅ 589 | ✅ 798 |  |  |  |
| model-new | ✅ 310 |  | ❌ 567 | ✅ 590 |  |  |  |  |
| model-switch | ✅ 311 |  | ✅ 568 | ✅ 591 |  | ❌ 756 | ❌ 853 | ✅ 837 |
| mode-switch | — 312 |  | ❌ 569 | ✅ 592 |  | ◐ 763 |  |  |
| quota | ◐⚠ 1312 |  | ◐ 570 | ◐ 593 | ✅ 826 |  |  |  |
| channel-route | ❓⚠ 1336 |  |  |  |  |  |  |  |
| channel-health | ❓⚠ 1337 |  |  |  |  |  |  |  |
| guard | ❌⚠ 1052 |  |  |  |  |  |  |  |
| act-deliver | ❓⚠ 1374 |  |  |  |  |  |  |  |
| act-request | ❓⚠ 1375 |  |  |  |  |  |  |  |
| act-yield | ❓⚠ 1376 |  |  |  |  |  |  |  |
| act-report | ❓⚠ 1377 |  |  |  |  |  |  |  |
| wait-visible | ❓⚠ 1378 |  | — 574 | ◐ 597 |  |  |  |  |
| wake-bg | ❓⚠ 1365 |  | — 571 | — 594 |  |  |  |  |
| wake-timer | ✅ 1294 |  | — 572 | — 595 |  |  |  |  |
| wake-msg | ❓⚠ 1366 |  | — 573 | — 596 |  |  |  |  |
| wake-stall | ◐ 318 |  | — 575 | — 598 |  |  |  |  |
| wake-persist | ❓⚠ 1364 |  | — 576 | — 599 |  |  |  |  |
| spawn-subagent |  | ❓⚠ 1340 |  |  |  |  |  |  |
| peer-message | ❓⚠ 1379 |  |  |  |  |  |  |  |
| handoff | ❓⚠ 1380 |  |  |  |  |  |  |  |
| task-board | ❓⚠ 1339 |  |  |  |  |  |  |  |
| notify-user | ❓⚠ 1367 |  |  |  |  |  |  |  |
| human-steer | ◐ 1313 |  |  |  |  |  |  |  |
| artifact | ❓⚠ 1368 |  |  |  |  |  |  |  |
| browser | ❓⚠ 1369 |  |  |  |  |  |  |  |
| terminal | ✅⚠ 1436 |  |  |  |  |  |  |  |
| mount-tools | ❓⚠ 1334 |  |  |  |  |  |  |  |
| instructions | ❓⚠ 1335 |  |  |  |  |  |  |  |
| workspace | ✅⚠ 1456 |  |  |  |  |  |  |  |
| output-contract | ❓⚠ 1346 |  |  |  |  |  |  |  |
| discover-sessions | ❓⚠ 1330 | ❓⚠ 1341 |  |  |  |  |  |  |
| probe-host | ✅⚠ 1158 |  |  |  |  |  |  |  |
| capacity | ❓⚠ 1338 |  |  |  |  |  |  |  |
| archive | ❓⚠ 1331 |  |  |  |  |  |  |  |
| delete | ✅⚠ 1392 |  |  |  |  |  |  |  |
| handover-human | ❓⚠ 1349 |  |  |  |  |  |  |  |
| memory-mode | ❓⚠ 1347 |  |  |  |  |  |  |  |
| loop-guard | ❓⚠ 1344 |  |  |  |  |  |  |  |
| channel-lease | ❓⚠ 1345 |  |  |  |  |  |  |  |

断点与条件：

- 行 302 · state · L0 hermes/L0/cli · ◐ 条件：turn 进行中/被外部杀死后/续后，三次查 sessions 行。能区分 工作中(ended_at NULL)/已结束；但外部硬杀不回写库，行永远停在 working——死进程状态不可发现
- 行 305 · steer · L0 hermes/L0/cli · ❌ 条件：长 turn（ping -n 40）进行中经 stdin 管道注入第二句话。非 TTY 下 stdin 完全不被读取，插话被丢弃且不入队
- 行 306 · permission · L0 hermes/L0/cli · ❌ 条件：非 TTY，不带 --yolo（默认模式）及 --safe-mode 两次要求写 channels/probe/scripts/tmp 下文件。非交互模式无任何审批门，直接放行写盘；调用方收不到审批请求（TTY 交互内的审批不适用于后端调用路线）
- 行 309 · model-list · L0 hermes/L0/cli · ◐ 条件：找非交互模型列表命令。真实列表只在交互 picker 拉取后落缓存；无一条命令能非交互打印可用模型
- 行 314 · wake-bg · L0 hermes/L0/cli · ❌ 条件：让智能体用 delegate_task 后台跑 ping -n 20、本轮先结束、完成后回填结果。CLI oneshot 表面无唤醒通道；gateway/kanban 宿主的会话可能支持（未测，超出本路线）
- 行 316 · wake-msg · L0 hermes/L0/cli · ◐ 条件：外部消息唤醒让出中/待命会话——端到端未跑（需已配置消息平台收发）。存在注入唤醒机制（cron --deliver local / 平台插件），但本机未配置可收信平台，未能实测一轮真唤醒；未验证 ≠ 不存在
- 行 317 · wait-visible · L0 hermes/L0/cli · ◐ 条件：外部观察它是否在让出/在等什么。status/cron list 可看出等待安排；gateway_state.json 的 active_work 不随 turn 实时刷新（样本期间未观测到更新）
- 行 318 · wake-stall · L0 hermes/L0/cli · ◐ 条件：等的东西不来时是否可见、是否永久挂起。cron 侧失败可见不悬挂；单轮 LLM 调用级超时行为未构造（未测网络黑洞场景）
- 行 319 · wake-persist · L0 hermes/L0/cli · ◐ 条件：宿主重启后约定唤醒是否还在。任务/执行史持久化在磁盘，重启理论可恢复；按规矩不重启用户 gateway，未做实测（unverified 的部分仅剩重启这一步）
- 行 559 · state · L1a hermes/L1a/acp-bridge · ◐ 条件：turn 期间有通知可判忙；turn 之间协议层无状态推送。工作/待命可凭通知流推断，但无显式状态原语
- 行 567 · model-new · L1a hermes/L1a/acp-bridge · ❌ 条件：newSession 传 _meta.hermes.modelId 试选模型。协议无建会话选模型位；只能建后 set_model
- 行 569 · mode-switch · L1a hermes/L1a/acp-bridge · ❌ 条件：setSessionMode default→accept_edits，fork 读回验证。调用成功但状态未变（存疑：fork 复制可能重置模式；无任何通知可证已切换）
- 行 570 · quota · L1a hermes/L1a/acp-bridge · ◐ 条件：监听用量推送。只有上下文占用，非套餐额度
- 行 579 · resume-native · L1b hermes/L1b/acpx · ❌ 条件：尝试让 acpx 挂到原生 CLI 开的会话(20261017_180048_62652a)。acpx 只能续自己名下记录；原生会话 id 无法注入
- 行 585 · steer · L1b hermes/L1b/acpx · ❌ 条件：主 turn（ping -n 40）进行中 acpx hermes prompt --no-wait 插话。排队到下一轮，本轮不生效——与 L1a 直连（Redirected the active turn）行为不同
- 行 586 · permission · L1b hermes/L1b/acpx · ◐ 条件：default 模式（未加放行参数）要求写文件。中途请求-应答机制在，但应答方是 acpx 的非交互策略（默认 deny），人无法本轮内答复；对照组 accept_edits 会话同一请求被放行（perm_l1b_ae.txt 已建）
- 行 593 · quota · L1b hermes/L1b/acpx · ◐ 条件：stream 用量推送。仅上下文用量，非套餐额度
- 行 597 · wait-visible · L1b hermes/L1b/acpx · ◐ 条件：外部可观测性。-
- 行 749 · open · L2 hermes/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-hermes-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 756 · model-switch · L2 hermes/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 763 · mode-switch · L2 hermes/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 770 · permission · L2 hermes/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 777 · fork · L2 hermes/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 791 · steer · L2 hermes/L2/server-api · ◐ 条件：调用 POST /api/control 向 hermes 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 853 · model-switch · L3 hermes/L3/web-chat-drawer · ❌ 条件：chat.js:100 hermes canSwitchModelMidSession=false → 隐藏。漏掉真能力
- 行 883 · resume-native · L2 hermes/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: hermes:c5808c50-d59a-4e42-b384-ed795。无法跨层透传原生会话
- 行 901 · open · L2 hermes/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。原因待查
- 行 908 · resume · L2 hermes/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。返回太快，像是进了网关内存队列排在未完成的上一轮后面，并未执行；接口 ok 不代表续上
- 行 918 · resume · L2 hermes/L2/server-api · ◐ 条件：同上。回复正确但网关报错，完成判据有误
- 行 1046 · guard · L0 hermes/L0/cli · ◐ 条件：Hermes v0.21.3, custom:codingplanlite/glm-5.3, HERMES_HOME隔离配置, pre_tool_call 钩子。钩子机制生效但 context 字段可能未被模型采纳，或者模型直接输出了结果。
- 行 1049 · guard · L0 hermes/L0/cli · ◐ 条件：Hermes v0.21.3, custom:codingplanlite/glm-5.3, HERMES_HOME隔离配置, pre_tool_call 钩子。钩子机制生效但 context 字段可能未被模型采纳，或者模型直接输出了结果。
- 行 1050 · guard · L0 hermes/L0/cli · ❌ 条件：Hermes v0.21.3, custom:codingplanlite/glm-5.3, HERMES_HOME隔离配置, pre_tool_call sh。钩子未被触发，需排查 config.yaml hooks 解析和 allowlist 路径。
- 行 1052 · guard · L0 hermes/L0/cli · ❌ 条件：Hermes v0.21.3, custom:codingplanlite/glm-5.3, HERMES_HOME隔离配置, pre_tool_call sh。钩子未被触发，需排查 config.yaml hooks 解析和 allowlist 路径。
- 行 1120 · probe-host · L0 hermes/L0/cli · ❌ 条件：hermes --version, Python 3.11。查本机版本、安装目录与Python版本，结果与实际一致。
- 行 1169 · fork · L0 hermes/L0/cli · ◐ 条件：Hermes v0.21.3, DB level fork (probe-hermes-orig-1792271497554 -> probe-hermes-f。复制 sessions 和 messages 记录后，--resume 未能读取到历史暗号或执行报错。
- 行 1289 · inject-silent · L0 hermes/L0/cli · ◐ 条件：hermes v0.21.3, zai glm-5.2, state.db messages 表直接写入 (role='user', active=1)。写入 state.db messages 后 resume 未能识别。
- 行 1312 · quota · L0 hermes/L0/cli · ◐ 条件：hermes v0.21.3, session_model_usage & hermes auth。【定义差异·用量统计而非剩余额度】能精细统计 Token 用量、估计花费及凭据耗尽状态，但无法直接查出供应商账户内剩余人民币/美元余额，需由中心能力总控网关查询。
- 行 1313 · human-steer · L0 hermes/L0/cli · ◐ 条件：hermes v0.21.3, L1a ACP / L0 TUI。【路线分歧·协议支持CLI受限】L1a ACP 直连支持轮中重定向插话；TUI 界面支持人机交互；但在自动化非交互管道中需依赖 ACP 桥或 TUI 附着。
- 行 1330 · discover-sessions · L0 hermes/L0/cli · ❓ 条件：hermes sessions list / SQLite state.db。接口存在，缺行为证据：缺调用列表命令实际列出既有测试会话并匹配标题的原始输出
- 行 1331 · archive · L0 hermes/L0/cli · ❓ 条件：hermes sessions archive --help, sessions 表包含 archived 字段。接口存在，缺行为证据：缺归档后会话在列表被隐藏、取消归档后恢复的行为输出
- 行 1332 · delete · L0 hermes/L0/cli · ❓ 条件：hermes sessions delete --help。接口存在，缺行为证据：缺创建会话后执行删除并验证会话彻底不可查的端到端行为输出
- 行 1333 · workspace · L0 hermes/L0/cli · ❓ 条件：hermes --in DIR, hermes --worktree / -w。接口存在，缺行为证据：缺指定目录后智能体实际在该工作目录执行命令返回对应路径的交互输出
- 行 1334 · mount-tools · L0 hermes/L0/cli · ❓ 条件：hermes -t TOOLSETS, --skills SKILLS, config.yaml mcp_servers。接口存在，缺行为证据：缺挂接工具后智能体实际调用该挂接工具并拿到返回的行为输出
- 行 1335 · instructions · L0 hermes/L0/cli · ❓ 条件：SOUL.md / AGENTS.md / .cursorrules / config.yaml agent.system_prompt。接口存在，缺行为证据：缺通过参数/文件注入角色规则后智能体实际依从规则的行为输出
- 行 1336 · channel-route · L0 hermes/L0/cli · ❓ 条件：hermes -m MODEL --provider PROVIDER。接口存在，缺行为证据：缺切换指定模型参数后请求确实被指定模型处理的响应或用量行行为输出
- 行 1337 · channel-health · L0 hermes/L0/cli · ❓ 条件：hermes auth list / auth reset / auth refresh。接口存在，缺行为证据：缺渠道故障时凭证池自动标记耗尽或降级熔断的行为输出
- 行 1338 · capacity · L0 hermes/L0/cli · ❓ 条件：config.yaml delegation.max_concurrent_children, kanban.max_in_progress。接口存在，缺行为证据：缺并发超限时自动排队或拒绝的任务池行为输出
- 行 1339 · task-board · L0 hermes/L0/cli · ❓ 条件：Hermes 内置 kanban 调度器，hook 包含 kanban_task_claimed, kanban_task_completed, kanban_。接口存在，缺行为证据：缺多方对看板任务执行声明与完成流转的行为输出
- 行 1340 · spawn-subagent · L0 hermes/L0/subagent · ❓ 条件：Hermes v0.21.3, tools/delegate_tool.py (delegate_task)。接口存在，缺行为证据：缺实际派生子任务并取回子任务计算结果的原始输出
- 行 1341 · discover-sessions · L0 hermes/L0/subagent · ❓ 条件：Hermes delegate_tool_registry.py (list_active_subagents) / SQLite parent_session。接口存在，缺行为证据：缺调用列表命令实际列出既有测试会话并匹配标题的原始输出
- 行 1342 · observe-history · L0 hermes/L0/subagent · ❓ 条件：SQLite messages 表按 session_id 查询 / hermes sessions export <child_id>。接口存在，缺行为证据：缺读取子会话历史消息并在父会话消费的原始输出
- 行 1343 · cancel · L0 hermes/L0/subagent · ❓ 条件：Hermes delegate_tool_registry.py: interrupt_subagent(subagent_id)。接口存在，缺行为证据：缺向活跃子会话发送打断信号使其安全退出的原始输出
- 行 1344 · loop-guard · L0 hermes/L0/cli · ❓ 条件：tools/async_delegation.py & delegate_tool_progress.py: Stale-delegation detectio。接口存在，缺行为证据：缺制造循环动作后被守卫强制打断拦截并进入审批门禁的行为输出
- 行 1345 · channel-lease · L0 hermes/L0/cli · ❓ 条件：tools/delegate_tool_child_run.py: _lease_child_credential。接口存在，缺行为证据：缺子任务执行期间从凭证池借调并在退出后归还的凭据租约流水
- 行 1346 · output-contract · L0 hermes/L0/cli · ❓ 条件：tools/delegate_tool_child_run.py: _validate_child_output_schema。接口存在，缺行为证据：缺子智能体产出不符 Schema 时校验器报错或打回重写的原始输出
- 行 1347 · memory-mode · L0 hermes/L0/cli · ❓ 条件：hermes --ignore-rules / hermes --safe-mode。接口存在，缺行为证据：缺禁用规则或安全模式下违规操作被放行或拦截的对比行为输出
- 行 1348 · terminal · L0 hermes/L0/cli · ❓ 条件：Hermes tools/terminal_tool.py。接口存在，缺行为证据：缺智能体实际调用 terminal/bash 执行命令并捕获返回输出的行为凭据
- 行 1349 · handover-human · L0 hermes/L0/cli · ❓ 条件：hermes --tui --resume <ID> / hermes --cli -r <ID>。接口存在，缺行为证据：缺人实际通过 TUI/attach 接管并完成一轮人机交互的行为输出
- 行 1364 · wake-persist · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, cron/jobs.py, executions.db, durable notepad。接口存在，缺行为证据：缺在定时任务触发周期内重启应用仍按时被叫醒的行为输出
- 行 1365 · wake-bg · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, terminal(background=true, notify_on_complete=true)。接口存在，缺行为证据：缺后台任务退出后通过 Gateway 自动将通知打入会话的端到端行为输出
- 行 1366 · wake-msg · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, hermes gateway & platform adapters。接口存在，缺行为证据：缺外部 Webhook 消息到达后自动触发会话开启一轮推理的行为输出
- 行 1367 · notify-user · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, hermes send --to <target>。接口存在，缺行为证据：缺向外部平台实际发出消息并送达手机/IM 客户端的投递凭据
- 行 1368 · artifact · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, MEDIA:<path> attachment & preview tools。接口存在，缺行为证据：缺智能体实际生成文件并发布为可消费产出物的交互输出
- 行 1369 · browser · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, tools/browser_tool.py & browser_cdp_tool.py。接口存在，缺行为证据：缺智能体实际操控浏览器访问页面并提取 DOM/快照的行为输出
- 行 1370 · goal · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, delegation max_iterations, max_cost_usd, cli --usage-file。接口存在，缺行为证据：缺达到步数或预算上限时智能体被自动截断停止的行为输出
- 行 1371 · inject-next · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, acpx --no-wait [queued] & cron bot-chat deliver。接口存在，缺行为证据：缺轮中送入消息并在下一轮自动执行出结果的行为输出
- 行 1372 · inject-tool · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, MCP tool execution。接口存在，缺行为证据：缺在 MCP 工具返回中夹带指令且智能体在下一步照做的行为输出
- 行 1373 · inject-inbox · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, workspace file read tools。接口存在，缺行为证据：缺中心向收件箱文件写入指令且智能体读取照做的行为输出
- 行 1374 · act-deliver · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, _validate_child_output_schema & delivery_obligations。接口存在，缺行为证据：缺实际导出或产出结构化 payload 的端到端执行输出
- 行 1375 · act-request · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, write_approval.py, groups.approve, ACP requestPermission。接口存在，缺行为证据：缺智能体中途触发审批并拿到人工决策后恢复的行为输出
- 行 1376 · act-yield · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, terminal(background=true, notify_on_complete=true)。接口存在，缺行为证据：缺智能体主动交出轮次并在等待事件到达前保持静默的行为输出
- 行 1377 · act-report · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, kanban progress hooks & subagent callbacks。接口存在，缺行为证据：缺智能体向外部上报中间进度且当前轮次继续执行的行为输出
- 行 1378 · wait-visible · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, sessions.last_activity_description & handoff_state。接口存在，缺行为证据：缺外部通过接口或 DB 实际读出会话正处于“在等什么”状态字段的快照
- 行 1379 · peer-message · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, gateway/hosted_rooms.py & tui_gateway/methods_groups.py。接口存在，缺行为证据：缺一个智能体向房间发消息另一个智能体实际收到的双向行为输出
- 行 1380 · handoff · L0 hermes/L0/cli · ❓ 条件：hermes v0.21.3, sessions.handoff_state & groups.replicate。接口存在，缺行为证据：缺发起 handoff 后接手者会话从交接点恢复执行的端到端行为输出

## opencode

列：

- **C1** L0 · cli · opencode/L0/run
- **C2** L0 · serve · opencode/L0/serve
- **C3** L0 · subagent · opencode/L0/subagent
- **C4** L1a · acp-bridge · opencode/L1a/acp
- **C5** L1b · acpx-cli · opencode/L1b/acpx
- **C6** L2 · agent-gateway-cli · opencode/L2/agent_gateway
- **C7** L2 · gateway-server · opencode/L2/server-api
- **C8** L3 · web-chat-drawer · opencode/L3/web-chat-drawer
- **C9** L3 · web-console · opencode/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---|---|---|---|---|---|---|---|---|
| open | ◐⚠ 406 | ✅ 348 |  | ✅⚠ 703 | ✅⚠ 721 | ✅ 811 | ❌⚠ 915 |  |  |
| resume | ✅ 332 | ✅ 349 |  | ❌⚠ 704 | ✅⚠ 722 |  | ❌⚠ 916 |  |  |
| resume-native | ✅⚠ 689 | ❌⚠ 693 |  | ❌⚠ 707 | ❌⚠ 725 |  | ❌ 882 |  |  |
| observe-live | ✅ 334 | ✅ 351 |  | ✅⚠ 705 | ✅⚠ 723 |  |  |  |  |
| observe-history | ✅ 943 | ✅ 946 | ✅ 1035 | ❌⚠ 706 | ✅⚠ 724 |  |  |  |  |
| state | ◐ 336 | ❌⚠ 694 | ✅ 1036 | ❌⚠ 708 | ✅⚠ 720 | ✅ 804 | ✅ 783 |  |  |
| cancel | ✅ 944 | ✅ 947 | ✅ 1038 | ✅⚠ 709 | ✅⚠ 726 | ✅ 818 |  |  |  |
| close | ✅ 945 | ✅ 948 |  | ✅⚠ 717 | ✅⚠ 734 |  |  |  |  |
| steer | — 339 | ❌ 356 | ✅ 1037 | ❓⚠ 735 | ◐⚠ 737 |  | ◐ 790 |  |  |
| inject-next |  | ❓⚠ 1381 |  |  |  |  |  |  |  |
| inject-tool | ❓⚠ 1382 |  |  |  |  |  |  |  |  |
| inject-inbox | ❓⚠ 1383 |  |  |  |  |  |  |  |  |
| inject-silent | ◐ 1290 |  |  |  |  |  |  |  |  |
| goal | ❓⚠ 1384 |  |  |  |  |  |  |  |  |
| permission | ❌ 340 | ❌⚠ 695 |  | ❌⚠ 711 | ❌⚠ 728 |  | ❌ 769 |  |  |
| fork | ✅⚠ 1212 | — 358 |  | ❌⚠ 712 | ❌⚠ 729 |  | ❌ 776 |  |  |
| compact | — 342 | ❌⚠ 696 |  | ❌⚠ 713 | ❌⚠ 730 |  |  |  |  |
| model-list | ✅ 940 | ✅⚠ 692 |  | ✅⚠ 701 | ✅⚠ 718 | ✅ 797 |  |  |  |
| model-new | ✅⚠ 691 | ❌⚠ 697 |  | ❌⚠ 702 | ❌⚠ 719 |  |  |  |  |
| model-switch | ❌ 345 | ❌⚠ 698 |  | ❓⚠ 736 | ❓⚠ 738 |  | ❌ 755 | ❌ 852 | ❌ 836 |
| mode-switch | — 346 | ✅⚠ 699 |  | ❌⚠ 715 | ✅⚠ 732 |  | ◐ 762 |  |  |
| quota | ◐⚠ 941 | —⚠ 700 |  | —⚠ 716 | —⚠ 733 | ✅ 825 |  |  |  |
| channel-route | ❓⚠ 1362 |  |  |  |  |  |  |  |  |
| act-deliver | ✅⚠ 1437 |  |  |  |  |  |  |  |  |
| act-request | ❓⚠ 1386 |  |  |  |  |  |  |  |  |
| act-yield | ◐ 1320 |  |  |  |  |  |  |  |  |
| act-report | ❓⚠ 1387 |  |  |  |  |  |  |  |  |
| wait-visible | ◐ 1204 |  |  |  |  |  |  |  |  |
| wake-bg | ◐ 1203 |  |  |  |  |  |  |  |  |
| wake-timer | ❌ 1202 |  |  |  |  |  |  |  |  |
| wake-msg | ❓⚠ 1390 |  |  |  |  |  |  |  |  |
| wake-stall | ❓⚠ 1359 |  |  |  |  |  |  |  |  |
| wake-persist | ❌ 1329 |  |  |  |  |  |  |  |  |
| spawn-subagent | ✅ 1291 |  | ✅ 1033 |  |  |  |  |  |  |
| peer-message | ◐ 1323 |  |  |  |  |  |  |  |  |
| handoff | ❓⚠ 1388 |  |  |  |  |  |  |  |  |
| task-board | ✅ 1292 |  |  |  |  |  |  |  |  |
| ask-user | ❓⚠ 1363 |  |  |  |  |  |  |  |  |
| notify-user | ◐ 1326 |  |  |  |  |  |  |  |  |
| human-steer | ◐ 1327 |  |  |  |  |  |  |  |  |
| artifact | ❓⚠ 1389 |  |  |  |  |  |  |  |  |
| browser | ◐ 1324 |  |  |  |  |  |  |  |  |
| terminal | ✅⚠ 1394 |  |  |  |  |  |  |  |  |
| mount-tools | ❓⚠ 1352 |  |  |  |  |  |  |  |  |
| instructions | ❓⚠ 1353 |  |  |  |  |  |  |  |  |
| workspace | ✅⚠ 1393 |  |  |  |  |  |  |  |  |
| open-idle |  | ❓⚠ 1358 |  |  |  |  |  |  |  |
| label | ✅ 1189 |  |  |  |  |  |  |  |  |
| discover-sessions | ✅ 1187 |  | ✅ 1034 |  |  |  |  |  |  |
| probe-host | ✅ 1186 |  |  |  |  |  |  |  |  |
| rewind | ❓⚠ 1351 |  |  |  |  |  |  |  |  |
| archive | ❓⚠ 1350 |  |  |  |  |  |  |  |  |
| delete | ✅⚠ 1391 |  |  |  |  |  |  |  |  |
| handover-human | ❓⚠ 1357 |  |  |  |  |  |  |  |  |
| loop-guard | ❓⚠ 1354 |  |  |  |  |  |  |  |  |
| permission-scope | ❓⚠ 1355 |  |  |  |  |  |  |  |  |

断点与条件：

- 行 336 · state · L0 opencode/L0/run · ◐ 条件：opencode session list。CLI run does not have daemon-level live state API; session list shows existing sessions, status of completed runs is derived from process exit code.
- 行 340 · permission · L0 opencode/L0/run · ❌ 条件：CLI 非交互模式。CLI in non-interactive batch mode does not support interactive prompt callback; only supports static --auto flag.
- 行 345 · model-switch · L0 opencode/L0/run · ❌ 条件：续接时指定不同 -m。续接传参未能改变实际存储模型
- 行 356 · steer · L0 opencode/L0/serve · ❌ 条件：进行中并发 POST prompt。同会话运行中请求返回冲突或排队
- 行 360 · model-list · L0 opencode/L0/serve · ❓ 条件：指令停止测试。未测完，交复测
- 行 361 · model-new · L0 opencode/L0/serve · ❓ 条件：指令停止测试。未测完，交复测
- 行 362 · model-switch · L0 opencode/L0/serve · ❓ 条件：指令停止测试。未测完，交复测
- 行 363 · mode-switch · L0 opencode/L0/serve · ❓ 条件：指令停止测试。未测完，交复测
- 行 364 · quota · L0 opencode/L0/serve · ❓ 条件：指令停止测试。未测完，交复测
- 行 365 · open · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 366 · resume · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 367 · resume-native · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 368 · observe-live · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 369 · observe-history · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 370 · state · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 371 · cancel · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 372 · close · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 373 · steer · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 374 · permission · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 375 · fork · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 376 · compact · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 377 · model-list · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 378 · model-new · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 379 · model-switch · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 380 · mode-switch · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 381 · quota · L1a opencode/L1a/acp · ❓ 条件：指令停止测试。未测完，交复测
- 行 382 · open · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 383 · resume · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 384 · resume-native · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 385 · observe-live · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 386 · observe-history · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 387 · state · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 388 · cancel · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 389 · close · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 390 · steer · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 391 · permission · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 392 · fork · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 393 · compact · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 394 · model-list · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 395 · model-new · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 396 · model-switch · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 397 · mode-switch · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 398 · quota · L1b opencode/L1b/acpx · ❓ 条件：指令停止测试。未测完，交复测
- 行 399 · resume-native · L0 opencode/L0/run · ❓ 条件：核验第 333 行（原结论 pass）。只有一条 step_start 事件，没有续上后回复里引用原会话内容的证据
- 行 400 · fork · L0 opencode/L0/run · ❓ 条件：核验第 341 行（原结论 pass）。只有原会话和分叉会话的编号，没有上下文连续的证据
- 行 401 · model-new · L0 opencode/L0/run · ❓ 条件：核验第 344 行（原结论 pass）。证据里没有模型字段
- 行 402 · resume-native · L0 opencode/L0/serve · ❓ 条件：核验第 350 行（原结论 pass）。只有 200 和会话编号，没有续上后的回复内容
- 行 403 · state · L0 opencode/L0/serve · ❓ 条件：核验第 353 行（原结论 pass）。返回里只有 id 和标题，没有状态字段
- 行 404 · permission · L0 opencode/L0/serve · ❓ 条件：核验第 357 行（原结论 pass）。只是找到了审批相关的接口地址，没有在一轮中途收到审批请求
- 行 405 · compact · L0 opencode/L0/serve · ❓ 条件：核验第 359 行（原结论 pass）。只有 status=200，没有上下文用量下降的证据
- 行 406 · open · L0 opencode/L0/run · ◐ 条件：后台运行（无终端）时标准输入保持打开。opencode run 会读标准输入；从程序里调用必须关闭标准输入（< NUL 或 stdio ignore），否则永久阻塞。负责人提出猜测，测试员核实
- 行 693 · resume-native · L0 opencode/L0/serve · ❌ 条件：CLI 创建含暗号会话，HTTP 接口发送提问暗号并读取回复。回复中未包含暗号
- 行 694 · state · L0 opencode/L0/serve · ❌ 条件：分别在空闲时与运行中 GET 会话详情。GET /api/session/{id} 返回数据中只有 id/projectID/cost/tokens/time/title/location，无标识当前工作中/空闲的 status/state 字段
- 行 695 · permission · L0 opencode/L0/serve · ❌ 条件：要求智能体执行 bash 创建文件并在运行中轮询审批端点。运行中未向 /permission 端点派发拦截请求（无头 HTTP 模式默认自动放行或无拦截）
- 行 696 · compact · L0 opencode/L0/serve · ❌ 条件：POST /api/session/{id}/compact 触发上下文压缩。服务端报错断点：HTTP 503 {"_tag":"ServiceUnavailableError","message":"Session compact is not available yet","service":"session.compact"}
- 行 697 · model-new · L0 opencode/L0/serve · ❌ 条件：在新建会话中指定 model 为 zai-coding-plan/glm-5.3-flash。未在落盘消息中提取到模型字段
- 行 698 · model-switch · L0 opencode/L0/serve · ❌ 条件：同一会话第二轮改用 zhipuai-coding-plan/glm-5.3-flash 提问。第二轮未见新模型
- 行 702 · model-new · L1a opencode/L1a/acp · ❌ 条件：新建会话并设置 model 为 zhipuai-coding-plan/glm-5.3-flash。设置模型失败: connection.setConfigOption is not a function
- 行 704 · resume · L1a opencode/L1a/acp · ❌ 条件：同一会话第二轮提问复述暗号。回复中未见暗号
- 行 706 · observe-history · L1a opencode/L1a/acp · ❌ 条件：调用 loadSession 读取会话历史状态。读取失败: Invalid params
- 行 707 · resume-native · L1a opencode/L1a/acp · ❌ 条件：loadSession 失败。错误: Invalid params
- 行 708 · state · L1a opencode/L1a/acp · ❌ 条件：检查 ACP 流式通知中是否区分工作状态。ACP 未广播独立 status 字段
- 行 711 · permission · L1a opencode/L1a/acp · ❌ 条件：要求智能体执行 bash 工具并观察 requestPermission 回调。智能体未触发 requestPermission（桥层未派发或自动放行）
- 行 712 · fork · L1a opencode/L1a/acp · ❌ 条件：调用 ACP unstable_forkSession 分叉。分叉失败: Invalid params
- 行 713 · compact · L1a opencode/L1a/acp · ❌ 条件：调用 ACP 协议 session/compact。ACP 桥报错: "Method not found": session/compact
- 行 715 · mode-switch · L1a opencode/L1a/acp · ❌ 条件：通过 setSessionMode 切换模式为 plan。切换失败: Invalid params
- 行 719 · model-new · L1b opencode/L1b/acpx · ❌ 条件：新建会话并执行 acpx set model。设置模型失败: ⚠ No acpx session found (searched up to E:\program\GIT\Agent\multi\Agent-Architecture-Hub). Create one: acpx opencode sessions new --name probe-opencode
- 行 725 · resume-native · L1b opencode/L1b/acpx · ❌ 条件：原生 CLI 创建会话，经 acpx -s 指定该原生 sessionID 续接。未能复述暗号或会话不兼容
- 行 728 · permission · L1b opencode/L1b/acpx · ❌ 条件：检查命令行非交互调用下是否有中途审批交互。CLI 模式下 acpx 默认自动放行权限回调，不支持在终端中途中断交互
- 行 729 · fork · L1b opencode/L1b/acpx · ❌ 条件：调用 acpx sessions fork 命令。acpx sessions 无 fork 子命令: error: unknown option '-s' Usage: acpx opencode sessions [options] [command] List, ensure, create, or close sessions for this agent Op
- 行 730 · compact · L1b opencode/L1b/acpx · ❌ 条件：调用 acpx compact 命令。acpx 无 compact 子命令: ⚠ No acpx session found (searched up to E:\program\GIT\Agent\multi\Agent-Architecture-Hub). Create one: acpx opencode sessions new
- 行 735 · steer · L1a opencode/L1a/acp · ❓ 条件：核验第 710 行（原结论 pass）。只有 end_turn 和用量，看不出插入的话在本轮内体现
- 行 736 · model-switch · L1a opencode/L1a/acp · ❓ 条件：核验第 714 行（原结论 pass）。只有配置项 currentValue，没有切换后下一轮实际用的模型
- 行 737 · steer · L1b opencode/L1b/acpx · ◐ 条件：核验第 727 行（原结论 pass）。[queued] 说明是排队到下一轮，不是轮内插话（与其他家 acpx 一致）
- 行 738 · model-switch · L1b opencode/L1b/acpx · ❓ 条件：核验第 731 行（原结论 pass）。只有 model set 回执，没有下一轮实际模型
- 行 748 · open · L2 opencode/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-opencode-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 755 · model-switch · L2 opencode/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 762 · mode-switch · L2 opencode/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 769 · permission · L2 opencode/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 776 · fork · L2 opencode/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 790 · steer · L2 opencode/L2/server-api · ◐ 条件：调用 POST /api/control 向 opencode 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 836 · model-switch · L3 opencode/L3/web-console · ❌ 条件：两端 gating 均显示（canSwitchModelMidSession=true, gateway.ts:209）。对做不到/未证实的渠道照常显示下拉
- 行 852 · model-switch · L3 opencode/L3/web-chat-drawer · ❌ 条件：显示（mid=true）。对做不到的渠道照常显示
- 行 882 · resume-native · L2 opencode/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: opencode:ses_2c0f71da2ffetCou462F6Mu。原生会话与 acpx 会话命名空间分离
- 行 900 · open · L2 opencode/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。原因待查
- 行 907 · resume · L2 opencode/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。返回太快，像是进了网关内存队列排在未完成的上一轮后面，并未执行；接口 ok 不代表续上
- 行 915 · open · L2 opencode/L2/server-api · ❌ 条件：P0 修复后（stdin 关闭、超时 3600、默认只读），:8940。
- 行 916 · resume · L2 opencode/L2/server-api · ❌ 条件：同上。
- 行 941 · quota · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33 (opencode-ai npm), model zhipuai-coding-plan/glm-5.3-flash via 。判'partial'：stats 只给本机用量统计(Sessions/Messages/Tokens/Cost/ModelUsage)，无渠道剩余额度或窗口数据；Coding Plan 余额需另行查询。原347行'pass'证据实为本面板，与登记表'剩余额度与窗口'定义不符
- 行 1190 · workspace · L0 opencode/L0/run · ❌ 条件：opencode run --dir <directory>。原生支持 --dir 参数指定工作目录，智能体文件操作限定在指定目录。
- 行 1191 · delete · L0 opencode/L0/run · ❌ 条件：opencode session delete <sessionID>。原生支持 opencode session delete 命令删除指定会话，记录从 opencode.db 物理级联删除。
- 行 1198 · channel-route · L0 opencode/L0/run · ❌ 条件：opencode run -m provider/model。原生通过 -m 参数按次覆盖模型与供应商，全局配置保持不变。
- 行 1202 · wake-timer · L0 opencode/L0/run · ❌ 条件：opencode 1.18.33。【原生做不到·由宿主补齐】OpenCode 原生无定时器守护进程。理论上限：由 hub 后端担任宿主，自身保管等待计时，到点以 opencode run -s <id> 唤醒会话。
- 行 1203 · wake-bg · L0 opencode/L0/run · ◐ 条件：OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true (TaskTool background flag)。支持实验性后台子智能体（background=true），但自身进程无常驻唤醒循环，依赖轮询或父会话等待。
- 行 1204 · wait-visible · L0 opencode/L0/run · ◐ 条件：opencode.db session/message 状态。外部可通过 opencode.db 或 HTTP 接口查询会话最近更新时间与步骤状态，但无显式的“在等什么”原语字段。
- 行 1279 · inject-silent · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, opencode.db message/part direct SQL insert without inference。写入 opencode.db 后未能被后续会话识别。
- 行 1290 · inject-silent · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, zhipuai-coding-plan/glm-5.3-flash, opencode.db message/part 精确。写入 opencode.db 后未能被后续会话识别。
- 行 1320 · act-yield · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, opencode serve。【部分支持·服务态让出】CLI run 模式为同步阻塞执行直到退出；但在 serve 服务态下每轮结束自动让出并保持连接等待后续输入。
- 行 1323 · peer-message · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33。【需宿主补齐·点对点消息】OpenCode 本身不具备多会话直连协议，依赖中心总控（Hub）在不同 sessionID 间桥接中转。
- 行 1324 · browser · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, tools.webfetch: true。【部分支持·网页抓取而非交互浏览器】内置 webfetch 工具可读取并解析网页文本，但无原生无头浏览器点击/表单交互能力。
- 行 1326 · notify-user · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, stdout / TUI / SSE stream。【部分支持·控制台与Web通知】支持在控制台、TUI 及 Web 界面输出通知，但无原生 Telegram/钉钉等外部推送，需宿主补齐。
- 行 1327 · human-steer · L0 opencode/L0/run · ◐ 条件：opencode 1.18.33, --interactive / TUI / attach。【部分支持·交互模式支持】在 -i 交互底栏模式、TUI 或 attach 下支持人机插话；纯命令行批处理下不读取 stdin。
- 行 1329 · wake-persist · L0 opencode/L0/run · ❌ 条件：opencode 1.18.33。【原生做不到·由宿主补齐】OpenCode 无常驻定时守护进程，定时唤醒与持久调度必须由中心 Hub 担任保管者。
- 行 1350 · archive · L0 opencode/L0/run · ❓ 条件：opencode.db session 表原生包含 time_archived 字段。接口存在，缺行为证据：缺归档后会话在列表被隐藏、取消归档后恢复的行为输出
- 行 1351 · rewind · L0 opencode/L0/run · ❓ 条件：opencode.db session.revert 字段。接口存在，缺行为证据：缺实际执行回退并在历史检查点重新分支的行为输出
- 行 1352 · mount-tools · L0 opencode/L0/run · ❓ 条件：opencode mcp list, opencode.json mcp 配置。接口存在，缺行为证据：缺挂接工具后智能体实际调用该挂接工具并拿到返回的行为输出
- 行 1353 · instructions · L0 opencode/L0/run · ❓ 条件：opencode run --agent <agent>, AGENTS.md, opencode agent list。接口存在，缺行为证据：缺通过参数/文件注入角色规则后智能体实际依从规则的行为输出
- 行 1354 · loop-guard · L0 opencode/L0/run · ❓ 条件：opencode agent 权限策略: doom_loop。接口存在，缺行为证据：缺制造循环动作后被守卫强制打断拦截并进入审批门禁的行为输出
- 行 1355 · permission-scope · L0 opencode/L0/run · ❓ 条件：opencode agent list permissions 策略矩阵。接口存在，缺行为证据：缺触发越界访问时被权限门禁明确阻断拦截的行为输出
- 行 1356 · terminal · L0 opencode/L0/run · ❓ 条件：opencode 内置 bash 工具。接口存在，缺行为证据：缺智能体实际调用 terminal/bash 执行命令并捕获返回输出的行为凭据
- 行 1357 · handover-human · L0 opencode/L0/run · ❓ 条件：opencode attach <url>, opencode TUI (opencode [project])。接口存在，缺行为证据：缺人实际通过 TUI/attach 接管并完成一轮人机交互的行为输出
- 行 1358 · open-idle · L0 opencode/L0/serve · ❓ 条件：opencode serve REST API POST /session。接口存在，缺行为证据：缺创建空闲会话后在未推理状态下由后续消息激活的行为输出
- 行 1359 · wake-stall · L0 opencode/L0/run · ❓ 条件：opencode doom_loop 策略。接口存在，缺行为证据：缺制造卡住场景后超时或看门狗主动将其标出的行为输出
- 行 1360 · workspace · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode run --dir <path>。接口存在，缺行为证据：缺指定目录后智能体实际在该工作目录执行命令返回对应路径的交互输出
- 行 1361 · delete · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode session delete <sessionID>。接口存在，缺行为证据：缺创建会话后执行删除并验证会话彻底不可查的端到端行为输出
- 行 1362 · channel-route · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode run -m <provider>/<model>。接口存在，缺行为证据：缺切换指定模型参数后请求确实被指定模型处理的响应或用量行行为输出
- 行 1363 · ask-user · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, debug agent build tools.question: true, permission: question。接口存在，缺行为证据：缺智能体调用 question 工具阻断等待输入并接收到回答的行为输出
- 行 1381 · inject-next · L0 opencode/L0/serve · ❓ 条件：opencode 1.18.33, opencode serve POST /session/{id}/message。接口存在，缺行为证据：缺轮中送入消息并在下一轮自动执行出结果的行为输出
- 行 1382 · inject-tool · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode mcp list & tool output injection。接口存在，缺行为证据：缺在 MCP 工具返回中夹带指令且智能体在下一步照做的行为输出
- 行 1383 · inject-inbox · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, 内置 read 工具。接口存在，缺行为证据：缺中心向收件箱文件写入指令且智能体读取照做的行为输出
- 行 1384 · goal · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode debug agent plan。接口存在，缺行为证据：缺达到步数或预算上限时智能体被自动截断停止的行为输出
- 行 1385 · act-deliver · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode export [sessionID]。接口存在，缺行为证据：缺实际导出或产出结构化 payload 的端到端执行输出
- 行 1386 · act-request · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, question 工具与 ask 权限门禁。接口存在，缺行为证据：缺智能体中途触发审批并拿到人工决策后恢复的行为输出
- 行 1387 · act-report · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, task tool progress stream。接口存在，缺行为证据：缺智能体向外部上报中间进度且当前轮次继续执行的行为输出
- 行 1388 · handoff · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode export & import, DB clone。接口存在，缺行为证据：缺发起 handoff 后接手者会话从交接点恢复执行的端到端行为输出
- 行 1389 · artifact · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, write/edit tools & opencode export。接口存在，缺行为证据：缺智能体实际生成文件并发布为可消费产出物的交互输出
- 行 1390 · wake-msg · L0 opencode/L0/run · ❓ 条件：opencode 1.18.33, opencode serve POST /session/{id}/message。接口存在，缺行为证据：缺外部 Webhook 消息到达后自动触发会话开启一轮推理的行为输出

## workbuddy

列：

- **C1** L0 · cli · workbuddy/L0/cli
- **C2** L0 · cli · workbuddy/L0/cli-fork
- **C3** L0 · cli · workbuddy/L0/cli-mcp
- **C4** L0 · cli · workbuddy/L0/cli-probe
- **C5** L0 · cli · workbuddy/L0/cli-system-prompt
- **C6** L0 · hook · workbuddy/L0/hook-engine
- **C7** L0 · cli · workbuddy/L0/inbox-file
- **C8** L0 · logs · workbuddy/L0/logs-health
- **C9** L0 · native-cli · workbuddy/L0/native-cli
- **C10** L0 · cli · workbuddy/L0/settings
- **C11** L0 · sqlite · workbuddy/L0/sqlite-and-cli
- **C12** L0 · sqlite · workbuddy/L0/sqlite-automations
- **C13** L0 · sqlite · workbuddy/L0/sqlite-usage
- **C14** L0 · subagent · workbuddy/L0/subagent
- **C15** L0 · daemon · workbuddy/L0/system
- **C16** L0 · cli · workbuddy/L0/todo-tool
- **C17** L1a · acp · workbuddy/L1a/acp
- **C18** L1a · acp-bridge · workbuddy/L1a/codebuddy-acp
- **C19** L1b · acpx · workbuddy/L1b/acpx
- **C20** L1b · acpx · workbuddy/L1b/acpx-file-copy
- **C21** L2 · agent-gateway-cli · workbuddy/L2/agent_gateway
- **C22** L2 · gateway-server · workbuddy/L2/server-api
- **C23** L3 · web-chat-drawer · workbuddy/L3/web-chat-drawer
- **C24** L3 · web-console · workbuddy/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 | C22 | C23 | C24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| open |  |  |  |  |  |  |  |  | ✅ 108 |  |  |  |  |  |  |  |  | ✅ 125 | ❌ 142 |  | ✅ 810 | ◐⚠ 913 |  |  |
| resume |  |  |  |  |  |  |  |  | ✅ 109 |  |  |  |  |  |  |  |  | ✅ 126 | ❌ 143 |  |  | ✅⚠ 914 |  |  |
| resume-native |  |  |  |  |  |  |  |  | — 110 |  |  |  |  |  |  |  |  | — 127 | — 144 |  |  | ❌ 881 |  |  |
| observe-live |  |  |  |  |  |  |  |  | ✅ 111 |  |  |  |  |  |  |  |  | ✅ 128 | ✅ 145 |  |  |  |  |  |
| observe-history |  |  |  |  |  |  |  |  | ◐ 112 |  |  |  |  | ✅ 1041 |  |  |  | ◐ 129 | ✅ 146 |  |  |  |  |  |
| state |  |  |  |  |  |  |  |  | ◐ 113 |  |  |  |  | ✅ 1042 |  |  |  | ✅ 130 | ✅ 147 |  | ✅ 803 | ✅ 782 |  |  |
| cancel |  |  |  |  |  |  |  |  | ❌ 114 |  |  |  |  | ✅ 1044 |  |  |  | ❌ 131 | ✅ 148 |  | ✅ 817 |  |  |  |
| close |  |  |  |  |  |  |  |  | ❌ 115 |  |  |  |  |  |  |  |  | ❌ 132 | ✅ 149 |  |  |  |  |  |
| steer |  |  |  |  |  |  |  |  | ❌ 116 |  |  |  |  | ◐ 1043 |  |  |  | ❌ 133 | ◐ 150 |  |  | ◐ 789 |  |  |
| inject-next |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1470 |  |  |  |  |  |
| inject-inbox |  |  |  |  |  |  | ✅ 1458 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| inject-silent |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❌ 1268 |  |  |  |  |  |  |  |
| goal | ❓⚠ 1465 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| permission |  |  |  |  |  |  |  |  | ❌ 117 |  |  |  |  |  |  |  |  | ◐ 134 | ❌ 151 |  |  | ❌ 768 |  |  |
| fork |  | ✅ 1457 |  |  |  |  |  |  | ✅⚠ 547 |  |  |  |  |  |  |  |  | ❌ 135 | ❌ 152 | ✅ 1221 |  | ❌ 775 |  |  |
| compact |  |  |  |  |  |  |  |  | ❌ 119 |  |  |  |  |  |  |  |  | — 136 | ❌ 153 |  |  |  |  |  |
| model-list |  |  |  |  |  |  |  |  | ✅ 120 |  |  |  |  |  |  |  |  | ✅ 137 | ✅ 154 |  | ✅ 796 |  |  |  |
| model-new |  |  |  |  |  |  |  |  | ✅⚠ 548 |  |  |  |  |  |  |  |  | ✅⚠ 550 | ✅⚠ 551 |  |  |  |  |  |
| model-switch |  |  |  |  |  |  |  |  | ✅⚠ 549 |  |  |  |  |  |  |  |  | ❌ 139 | ✅⚠ 552 |  |  | ❌ 754 | ✅ 850 | ✅ 835 |
| mode-switch |  |  |  |  |  |  |  |  | ✅ 123 |  |  |  |  |  |  |  |  | ✅ 140 | ✅ 157 |  |  | ◐ 761 |  |  |
| quota |  |  |  |  |  |  |  |  | ◐ 124 |  |  |  | ◐ 1224 |  |  |  |  | ✅ 141 | ◐ 158 |  | ✅ 824 |  |  |  |
| channel-route | ❓⚠ 1472 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| channel-health |  |  |  |  |  |  |  | ❓⚠ 1474 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| guard |  |  |  |  |  | ◐ 1219 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| wake-timer |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1466 |  |  |  |  |  |  |  |  |  |  |  |  |
| spawn-subagent |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1039 |  |  |  |  |  |  |  |  |  |  |
| task-board |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1468 |  |  |  |  |  |  |  |  |
| mount-tools |  |  | ❓⚠ 1460 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| instructions |  |  |  |  | ✅ 1236 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| workspace | ✅ 1234 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| open-idle |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1226 |  |  |  |  |  |
| label |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1228 |  |  |  |  |  |
| ownership |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1232 |  |  |  |  |  |  |  |  |  |
| discover-sessions |  |  |  |  |  |  |  |  |  |  | ✅ 1230 |  |  | ✅ 1040 |  |  |  |  |  |  |  |  |  |  |
| probe-host |  |  |  | ✅ 1256 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| archive | ❓⚠ 1477 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| handover-human | ❓⚠ 1480 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| reclaim | ❓⚠ 1481 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| cmd-list | ❓⚠ 1463 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| memory-mode |  |  |  |  |  |  |  |  |  | ❓⚠ 1476 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| permission-scope | ❓⚠ 1484 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

断点与条件：

- 行 112 · observe-history · L0 workbuddy/L0/native-cli · ◐ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。codebuddy CLI 缺少 history 命令，但本地 projects 目录下存在完整会话 jsonl 文件
- 行 113 · state · L0 workbuddy/L0/native-cli · ◐ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。单次 -p 执行完毕即退出，无常驻会话状态机，但提供了 codebuddy ps 检查活跃会话
- 行 114 · cancel · L0 workbuddy/L0/native-cli · ❌ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。
- 行 115 · close · L0 workbuddy/L0/native-cli · ❌ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。
- 行 116 · steer · L0 workbuddy/L0/native-cli · ❌ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。非交互 CLI 单次运行在模型生成期间无法从外部 stdin 注入插话
- 行 117 · permission · L0 workbuddy/L0/native-cli · ❌ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。非交互 CLI 模式无法中途向调用方抛出审批请求并等待答复，自动依据策略拒绝未授权写操作
- 行 119 · compact · L0 workbuddy/L0/native-cli · ❌ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。
- 行 124 · quota · L0 workbuddy/L0/native-cli · ◐ 条件：codebuddy -p 原生非交互命令行调用，注入 CODEBUDDY_CONFIG_DIR 与 ACC_PRODUCT_CONFIG_V3，使用 custo。codebuddy CLI 缺少独立的 quota 命令，用量和额度在每一轮的 usage 结构中返回并在 SQLite 中落盘
- 行 129 · observe-history · L1a workbuddy/L1a/codebuddy-acp · ◐ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。ACP 桥声明 loadSession:true 支持加载已有会话
- 行 131 · cancel · L1a workbuddy/L1a/codebuddy-acp · ❌ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。
- 行 132 · close · L1a workbuddy/L1a/codebuddy-acp · ❌ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。
- 行 133 · steer · L1a workbuddy/L1a/codebuddy-acp · ❌ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。ACP 连接在单轮 prompt 进行中拒绝并发调用（Session is busy），不支持直接轮内插话
- 行 134 · permission · L1a workbuddy/L1a/codebuddy-acp · ◐ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。在 mode=default 下，文件写入工具触发了客户端 requestPermission 审批回调，客户端批准后写入成功完成
- 行 135 · fork · L1a workbuddy/L1a/codebuddy-acp · ❌ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。ACP 桥的 initialize 响应未声明 sessionFork，unstable_forkSession 调用返回 Method not found
- 行 139 · model-switch · L1a workbuddy/L1a/codebuddy-acp · ❌ 条件：codebuddy --acp 经由 ACP SDK ClientSideConnection 直接调用，注入 BYOK 环境变量，使用 custom-loca。
- 行 142 · open · L1b workbuddy/L1b/acpx · ❌ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。
- 行 143 · resume · L1b workbuddy/L1b/acpx · ❌ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。
- 行 150 · steer · L1b workbuddy/L1b/acpx · ◐ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。排队到下一轮生效，不能在本轮内打断修改当前正在生成的回复
- 行 151 · permission · L1b workbuddy/L1b/acpx · ❌ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。acpx 命令行仅支持预设策略（--approve-*），非交互调用时无法中途接收审批并回调
- 行 152 · fork · L1b workbuddy/L1b/acpx · ❌ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。acpx 命令行未暴露 fork 会话指令
- 行 153 · compact · L1b workbuddy/L1b/acpx · ❌ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。
- 行 158 · quota · L1b workbuddy/L1b/acpx · ◐ 条件：acpx workbuddy 命令调用，注入环境变量，使用 custom-local:glm-5.3。用量指标随每轮执行结果回显，无独立配额查询端点
- 行 221 · fork · L0 workbuddy/L0/native-cli · ❓ 条件：核验第 118 行（原结论 pass）。FORK_SUCCESS 是测试脚本自己打的标签，没有在分叉会话里问出父会话内容的证据
- 行 222 · model-new · L0 workbuddy/L0/native-cli · ❓ 条件：核验第 121 行（原结论 pass）。MODEL_NEW_OK 是脚本标签；用量里没有模型字段，要以 workbuddy 本地库的实际模型为准
- 行 223 · model-switch · L0 workbuddy/L0/native-cli · ❓ 条件：核验第 122 行（原结论 pass）。SWITCH_MODEL_OK 是脚本标签；没有切换后实际模型的记录
- 行 224 · model-new · L1a workbuddy/L1a/codebuddy-acp · ❓ 条件：核验第 138 行（原结论 pass）。只是配置了模型，没有实际调用的模型记录
- 行 225 · model-new · L1b workbuddy/L1b/acpx · ❓ 条件：核验第 155 行（原结论 pass）。证据是 initialize 请求样本，与选模型无关
- 行 226 · model-switch · L1b workbuddy/L1b/acpx · ❓ 条件：核验第 156 行（原结论 pass）。只有 set 命令返回 model_set，没有下一轮实际模型
- 行 747 · open · L2 workbuddy/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-workbuddy-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 754 · model-switch · L2 workbuddy/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 761 · mode-switch · L2 workbuddy/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 768 · permission · L2 workbuddy/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 775 · fork · L2 workbuddy/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 789 · steer · L2 workbuddy/L2/server-api · ◐ 条件：调用 POST /api/control 向 workbuddy 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 881 · resume-native · L2 workbuddy/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: workbuddy:01a14975-9dcc-7828-8b10-3c。WorkBuddy 桌面原生历史为只读，网关发消息走割裂的 acpx 路线
- 行 903 · open · L2 workbuddy/L2/server-api · ◐ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。同上
- 行 906 · resume · L2 workbuddy/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。返回太快，像是进了网关内存队列排在未完成的上一轮后面，并未执行；接口 ok 不代表续上
- 行 913 · open · L2 workbuddy/L2/server-api · ◐ 条件：P0 修复后（stdin 关闭、超时 3600、默认只读），:8940。智能体实际记住了暗号（续接答出），网关仍判失败
- 行 980 · steer · L0 workbuddy/L0/subagent · ◐ 条件：CodeBuddy CLI resume 机制。仅限作业级恢复交互
- 行 1043 · steer · L0 workbuddy/L0/subagent · ◐ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1219 · guard · L0 workbuddy/L0/hook-engine · ◐ 条件：CodeBuddy 2.168.2, @tencent-ai/codebuddy-code 源码。具备基于 Mod 的插件钩子基础设施，但在纯 CLI/ACP 无头环境下需先注册 clientApprovals 签名，最高补齐到 --system-prompt 命令行守卫
- 行 1224 · quota · L0 workbuddy/L0/sqlite-usage · ◐ 条件：WorkBuddy 2.168.2, ~/.workbuddy/workbuddy.db。仅记录单会话消耗的 token 与 Credits 积分，无头 CLI/ACP 模式下无法查询腾讯云账户总体剩余 Credits 余额与滑动窗口
- 行 1268 · inject-silent · L1a workbuddy/L1a/acp · ❌ 条件：WorkBuddy 2.168.2, ACP 协议标准。协议层限制：原生不支持纯上下文注入，最高补齐至文件收件箱或直写 SQLite 记录
- 行 1460 · mount-tools · L0 workbuddy/L0/cli-mcp · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：codebuddy mcp list 仅确认配置项存在，缺智能体在会话内真正调用挂载工具并返回结果的行为证据
- 行 1463 · cmd-list · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：仅 codebuddy --help 静态文档列出子命令，缺会话内动态可用命令清单与调用的行为证据
- 行 1465 · goal · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：包含 --max-turns 参数声明，缺多步任务在达到设定轮次预算时自动停机的行为证据
- 行 1466 · wake-timer · L0 workbuddy/L0/sqlite-automations · ❓ 条件：WorkBuddy v2.168.2; workbuddy.db。接口存在，缺行为证据：workbuddy.db 包含 automations 与 RRULE 任务表，缺由定时触发器在约定时间到点自动唤醒并恢复会话的即时行为证据
- 行 1468 · task-board · L0 workbuddy/L0/todo-tool · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：工具集声明包含 Todo 工具，缺多方协作读写共享任务板的行为证据
- 行 1470 · inject-next · L1b workbuddy/L1b/acpx · ❓ 条件：acpx v0.19.5。接口存在，缺行为证据：acpx 包含 --no-wait 参数，缺运行中排队并在本轮结束无缝承接下一轮的行为证据
- 行 1472 · channel-route · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：CLI 具备 --model 切换参数，缺单次执行中跨渠道切换并对账生效的行为证据
- 行 1474 · channel-health · L0 workbuddy/L0/logs-health · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：日志包含 status 401 与 isRetryable 错误结构，缺渠道熔断停用机制生效的行为证据
- 行 1476 · memory-mode · L0 workbuddy/L0/settings · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：CLI 包含 --no-session-persistence 参数，缺会话结束后验证磁盘未写入记忆的行为证据
- 行 1477 · archive · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：codebuddy rm 仅适用于后台作业会话（普通会话报 Session not found），缺标准会话移出活跃视图并由 respawn 成功取回的行为证据
- 行 1480 · handover-human · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：codebuddy attach 命令存在，缺在真实交互式终端中无缝挂接后台作业并接手操作的行为证据
- 行 1481 · reclaim · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2。接口存在，缺行为证据：codebuddy stop/kill 命令存在，缺实例停下、会话锁释放且任务回到可派状态的现场审计证据
- 行 1484 · permission-scope · L0 workbuddy/L0/cli · ❓ 条件：WorkBuddy v2.168.2; workbuddy.db。接口存在，缺行为证据：CLI 具备权限标志，缺智能体写自身数据目录放行但越界写工作区外被拦截的行为证据

## zcode

列：

- **C1** L0 · workspace · zcode/L0/agents-md
- **C2** L0 · cli · zcode/L0/cli-probe
- **C3** L0 · hook · zcode/L0/hook-engine
- **C4** L0 · acpx · zcode/L0/inbox-file
- **C5** L0 · native-cli · zcode/L0/native-cli
- **C6** L0 · opencli · zcode/L0/opencli
- **C7** L0 · config · zcode/L0/settings
- **C8** L0 · sqlite · zcode/L0/sqlite
- **C9** L0 · sqlite · zcode/L0/sqlite-health
- **C10** L0 · sqlite · zcode/L0/sqlite-todo
- **C11** L0 · subagent · zcode/L0/subagent
- **C12** L0 · daemon · zcode/L0/system
- **C13** L1a · acp · zcode/L1a/acp
- **C14** L1a · acp-bridge · zcode/L1a/acp-bridge
- **C15** L1a · acp · zcode/L1a/acp-mcp
- **C16** L1a · acp · zcode/L1a/zcode-acp-server
- **C17** L1b · acp-bridge · zcode/L1b/acp-bridge
- **C18** L1b · acpx · zcode/L1b/acpx
- **C19** L1b · acpx · zcode/L1b/acpx-file-copy
- **C20** L2 · agent-gateway-cli · zcode/L2/agent_gateway
- **C21** L2 · gateway-server · zcode/L2/server-api
- **C22** L3 · web-chat-drawer · zcode/L3/web-chat-drawer
- **C23** L3 · web-console · zcode/L3/web-console

| 能力 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 | C16 | C17 | C18 | C19 | C20 | C21 | C22 | C23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| open |  |  |  |  | ✅ 72 |  |  |  |  |  |  |  |  | ✅ 90 |  |  | ✅ 39 |  |  | ✅⚠ 809 | ✅⚠ 911 |  |  |
| resume |  |  |  |  | ✅ 73 |  |  |  |  |  |  |  |  | ✅ 92 |  |  | ✅ 40 |  |  |  | ✅⚠ 912 |  |  |
| resume-native |  |  |  |  | ◐⚠ 74 |  |  |  |  |  |  |  |  | ❌ 24 |  |  | ❌ 41 |  |  |  | ❌ 909 |  |  |
| observe-live |  |  |  |  | ❌ 75 |  |  |  |  |  |  |  |  | ✅ 91 |  |  | ✅ 42 |  |  | ❌ 320 |  |  |  |
| observe-history |  |  |  |  | ❌ 76 |  |  |  |  |  | ✅ 1029 |  |  | ◐⚠ 93 |  |  | ✅ 43 |  |  |  |  |  |  |
| state |  |  |  |  | ❌ 77 |  |  |  |  |  | ✅ 1030 |  |  | ✅⚠ 105 |  |  | ✅ 44 |  |  | ✅ 802 | ✅ 781 |  |  |
| cancel |  |  |  |  | ◐ 78 |  |  |  |  |  | ◐ 1032 |  |  | ✅ 95 |  |  | ◐⚠ 546 |  |  | ❓⚠ 828 | ✅ 887 |  |  |
| close |  |  |  |  | —⚠ 79 |  |  |  |  |  |  |  |  | ❌ 96 |  |  | ◐ 46 |  |  |  |  |  |  |
| steer |  |  |  |  | ❌ 80 |  |  |  |  |  | ❌ 1031 |  |  | ❌ 97 |  |  | ◐ 47 |  |  |  | ◐ 788 |  |  |
| inject-next |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1469 |  |  |  |  |  |
| inject-inbox |  |  |  | ✅ 1459 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| inject-silent |  |  |  |  |  |  |  |  |  |  |  |  | ❌ 1267 |  |  |  |  |  |  |  |  |  |  |
| goal |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1464 |  |  |  |  |  |  |  |  |  |  |
| permission |  |  |  |  | ❌⚠ 81 |  |  |  |  |  |  |  |  | ✅⚠ 98 |  |  | ❌⚠ 57 |  |  |  | ❌ 767 |  |  |
| fork |  |  |  |  | ❌ 82 |  |  |  |  |  |  |  |  | ✅⚠ 99 |  |  | ❌ 49 |  | ✅ 1220 |  | ❌ 894 |  |  |
| compact |  |  |  |  | ❌ 83 |  |  |  |  |  |  |  |  | ✅ 100 |  |  | ✅ 50 |  |  |  |  |  |  |
| model-list |  |  |  |  | ❌ 84 |  |  |  |  |  |  |  |  | ✅ 89 |  |  | ✅ 51 |  |  | ✅ 795 |  |  |  |
| model-new |  |  |  |  | ❌⚠ 85 |  |  |  |  |  |  |  |  | ✅ 101 |  |  | ✅ 52 |  |  |  |  |  |  |
| model-switch |  |  |  |  | ❌⚠ 86 |  |  |  |  |  |  |  |  | ◐⚠ 102 |  |  | ✅⚠ 553 |  |  |  | ✅⚠ 893 | ◐ 849 | ◐ 834 |
| mode-switch |  |  |  |  | ✅ 87 |  |  |  |  |  |  |  |  | ✅ 103 |  |  | ✅ 54 |  |  |  | ◐ 760 |  |  |
| quota |  |  |  |  | ◐ 88 |  |  |  |  |  |  |  |  | ✅⚠ 104 |  | ✅ 1223 | ◐ 55 |  |  | ✅ 823 |  |  |  |
| channel-route |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1471 |  |  |  |  |  |
| channel-health |  |  |  |  |  |  |  |  | ❓⚠ 1473 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| guard |  |  | ◐ 1218 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| wake-timer |  |  |  |  |  |  |  |  |  |  |  |  | ◐ 1244 | ❌ 71 |  |  |  |  |  |  |  |  |  |
| spawn-subagent |  |  |  |  |  |  |  |  |  |  | ✅ 1027 |  |  |  |  |  |  |  |  |  |  |  |  |
| task-board |  |  |  |  |  |  |  |  |  | ❓⚠ 1467 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| mount-tools |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1461 |  |  |  |  |  |  |  |  |
| instructions | ✅ 1235 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| workspace |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1233 |  |  |  |  |  |
| open-idle |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1225 |  |  |  |  |  |
| label |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ 1227 |  |  |  |  |  |
| ownership |  |  |  |  |  |  |  |  |  |  |  | ✅ 1231 |  |  |  |  |  |  |  |  |  |  |  |
| discover-sessions |  |  |  |  |  |  |  | ✅ 1229 |  |  | ✅ 1028 |  |  |  |  |  |  |  |  |  |  |  |  |
| probe-host |  | ✅ 1255 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| archive |  |  |  |  |  |  | ❓⚠ 1478 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| handover-human |  |  |  |  |  | ❓⚠ 1479 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| reclaim |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1482 |  |  |  |  |  |
| cmd-list |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1462 |  |  |  |  |  |  |  |  |  |  |
| memory-mode |  |  |  |  |  |  | ❓⚠ 1475 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| permission-scope |  |  |  |  |  |  |  |  |  |  |  |  | ❓⚠ 1483 |  |  |  |  |  |  |  |  |  |  |

断点与条件：

- 行 7 · resume-native · L0 zcode/L0/native-cli · ❌ 条件：尝试从 native-cli 续接 ZCode 桌面端会话。断在存储隔离：桌面版与 CLI 版未共享 session ID 索引
- 行 8 · observe-live · L0 zcode/L0/native-cli · ❌ 条件：CLI 带 --json 参数非交互运行。TUI 模式有终端字符渲染流，但不可被程序无头解析
- 行 9 · observe-history · L0 zcode/L0/native-cli · ❌ 条件：命令行尝试读取历史会话。历史仅能通过直接查询 SQLite ~/.zcode/cli/db/db.sqlite 或 app-server 获取
- 行 10 · state · L0 zcode/L0/native-cli · ❌ 条件：查询 CLI 进程或会话状态。只能依据 OS 级进程是否存在及退出码判断
- 行 11 · cancel · L0 zcode/L0/native-cli · ◐ 条件：中途向 node 子进程发送 POSIX 信号。粗暴杀进程，无法实现会话内存活的优雅轮次取消
- 行 12 · close · L0 zcode/L0/native-cli · ❌ 条件：关闭会话命令。CLI 进程退出即完成，无会话生命周期 close 操作
- 行 13 · steer · L0 zcode/L0/native-cli · ❌ 条件：在轮次执行过程中注入补充指令。断在交互模型：-p 为单批次启动
- 行 14 · permission · L0 zcode/L0/native-cli · ◐ 条件：启动时指定 --mode 参数（build, edit, plan, yolo, guarded）。只能静态设置，无法中途向外部客户端发起审批询问
- 行 15 · fork · L0 zcode/L0/native-cli · ❌ 条件：命令行参数尝试分叉。命令行未暴露分叉入口
- 行 16 · compact · L0 zcode/L0/native-cli · ❌ 条件：命令行参数尝试压缩。无法无头触发会话整理
- 行 17 · model-list · L0 zcode/L0/native-cli · ❌ 条件：尝试列出可用模型。断在命令暴露：仅在 TUI 下有 /model
- 行 21 · quota · L0 zcode/L0/native-cli · ◐ 条件：通过本地 SQLite 数据库查询账本。无直接 CLI 查询命令，需借由外部脚本查询账本
- 行 24 · resume-native · L1a zcode/L1a/acp-bridge · ❌ 条件：尝试加载桌面端会话。断在桥接层索引隔离：无法跨进程导入桌面端活动会话
- 行 26 · observe-history · L1a zcode/L1a/acp-bridge · ❌ 条件：通过 ACP 协议请求历史消息记录。断在协议定义：ACP 标准协议与 zcode-acp-server 均未开放 session/read 方法
- 行 29 · close · L1a zcode/L1a/acp-bridge · ❌ 条件：调用 ACP closeSession。断在服务端实现：zcode-acp-server 未挂载 session/close 处理函数
- 行 30 · steer · L1a zcode/L1a/acp-bridge · ❌ 条件：轮次未结束时下发新 prompt。ACP 规范目前未定义流式插话（steer）原语
- 行 32 · fork · L1a zcode/L1a/acp-bridge · ❌ 条件：调用 ACP session/fork。假闭环：桥自己声明了能力，但后端执行抛出 Internal error，断在适配器与后端协议对接
- 行 38 · quota · L1a zcode/L1a/acp-bridge · ◐ 条件：监听 usage_update 通知。单会话内能观测实时消耗与上限，跨会话统计需 SQLite 账本
- 行 41 · resume-native · L1b zcode/L1b/acp-bridge · ❌ 条件：试图用 acpx 续接 L0 原生生成的 sess_393f0ab4-2f13-4c6c-ab4a-475c1355f270。断在 acpx 自身会话注册表索引隔离：仅认 ~/.acpx/sessions，不透传外部未知原生 ID
- 行 46 · close · L1b zcode/L1b/acp-bridge · ◐ 条件：从外部进程请求关闭会话。Windows 下跨进程关闭因 process birth identity 校验失败被拦截，需等待 300s TTL 自然回收
- 行 47 · steer · L1b zcode/L1b/acp-bridge · ◐ 条件：携带 --no-wait 参数向正在运行的会话发送消息。实现了安全排队插话，但并非真正在正在生成的 token 流内部即时打断插话
- 行 49 · fork · L1b zcode/L1b/acp-bridge · ❌ 条件：尝试通过 acpx 分叉。acpx CLI 未提供 fork 包装
- 行 55 · quota · L1b zcode/L1b/acp-bridge · ◐ 条件：会话流内计量与本地 SQLite/渠道网关。多层组合达成配额水位观测
- 行 56 · permission · L1a zcode/L1a/acp-bridge · ❓ 条件：核验第 31 行。要在需要确认的模式下重测
- 行 57 · permission · L1b zcode/L1b/acp-bridge · ❌ 条件：acpx 非交互调用。这是启动时的静态策略，调用方无法在中途收到并答复审批请求；按定义记断
- 行 58 · model-switch · L0 zcode/L0/native-cli · ❓ 条件：核验第 19 行。要再跑一轮并记录实际模型
- 行 59 · model-switch · L1a zcode/L1a/acp-bridge · ❓ 条件：核验第 36 行。要再跑一轮并记录实际模型
- 行 60 · model-switch · L1b zcode/L1b/acp-bridge · ❓ 条件：核验第 53 行。要再跑一轮并记录实际模型
- 行 71 · wake-timer · L1a zcode/L1a/acp-bridge · ❌ 条件：经 zcode-acp-server 0.69.3 无头调用。定时唤醒是宿主能力：智能体请求，宿主保管和触发。我们的中枢若当宿主，需要实现 automation/*
- 行 74 · resume-native · L0 zcode/L0/native-cli · ◐ 条件：CLI 自己的 db.sqlite 会话可跨进程续（前几轮进程被杀后 --resume 同一会话成功）；桌面端 v2/tasks-index.sqlite 未测。桌面端与 CLI 存储不相通的说法本次未验证，维持 GATEWAY.md 的假设
- 行 75 · observe-live · L0 zcode/L0/native-cli · ❌ 条件：-p --json 模式。实时观察在 L0 不可得，需 L1a 或读 stream 文件
- 行 76 · observe-history · L0 zcode/L0/native-cli · ❌ 条件：CLI 无 history/read 子命令。被动读历史走 db 是通的，CLI 原生命令层面断
- 行 77 · state · L0 zcode/L0/native-cli · ❌ 条件：一次性进程。L0 无状态可查，状态识别要靠 db 或 ACP 层
- 行 78 · cancel · L0 zcode/L0/native-cli · ◐ 条件：进程运行中发 SIGINT。有损打断：杀进程而非协作取消
- 行 80 · steer · L0 zcode/L0/native-cli · ❌ 条件：-p 模式。-
- 行 81 · permission · L0 zcode/L0/native-cli · ❌ 条件：-p 非交互模式。-p 模式没有审批回路；审批要在 L1a 才存在
- 行 82 · fork · L0 zcode/L0/native-cli · ❌ 条件：-。-
- 行 83 · compact · L0 zcode/L0/native-cli · ❌ 条件：-。-
- 行 84 · model-list · L0 zcode/L0/native-cli · ❌ 条件：-。-
- 行 85 · model-new · L0 zcode/L0/native-cli · ❌ 条件：ZCODE_MODEL 环境变量在本次 5 轮中完全未生效。同机其他历史会话（sess_f59facad 等）确实跑过 GLM-5.3-Flash@account:bigmodel，说明是路由/配置问题而非模型不存在；失效原因未知
- 行 86 · model-switch · L0 zcode/L0/native-cli · ❌ 条件：同一会话换 ZCODE_MODEL 值后 --resume。sess_87939329/sess_33a8a02f 历史会话出现过真实 GLM-5.3-Flash→GLM-5.3 切换，说明环境变量曾在某些条件下有效，本次失效原因未知
- 行 88 · quota · L0 zcode/L0/native-cli · ◐ 条件：-。银子余额接口（channels/models/yinzi-api.md）本次未验
- 行 93 · observe-history · L1a zcode/L1a/acp-bridge · ◐ 条件：-。读回历史要靠 compact 快照或 load 重放，无直接 read
- 行 94 · state · L1a zcode/L1a/acp-bridge · ◐ 条件：会话期间监听全部 sessionUpdate。旧 suite 声称的 $/zcode/turnState 通知未出现，该判定不可采信（且其 state/model-new/quota 是硬编码 pass，未采用）
- 行 96 · close · L1a zcode/L1a/acp-bridge · ❌ 条件：-。桥 0.69.3 无关闭原语
- 行 97 · steer · L1a zcode/L1a/acp-bridge · ❌ 条件：首轮进行 1.5s 时发第二条 prompt。ACP 协议无轮内插话；'插话'行为等价于打断
- 行 102 · model-switch · L1a zcode/L1a/acp-bridge · ◐ 条件：setSessionConfigOption(model→new-provider\deepseek-v4.1-flash) 成功后下一轮。断点在目标渠道（银子）认证：17:36 同渠道 L0 还能通，~17:50 起 auth 失败，原因未知；按规矩未动其配置
- 行 106 · open · L2 zcode/L2/agent_gateway · ❌ 条件：agent_gateway.js 独立路径（:8899 未开）+ Windows + 多行提示词（--file）。runCommandSync 经 cmd.exe /c 拼一行命令，换行处被截断。影响所有走 acpx 的家族（命令行独立路径）；:8899 服务经 stdin（-f -）不受影响
- 行 320 · observe-live · L2 zcode/L2/agent_gateway · ❌ 条件：agent_gateway.js 独立路径，一轮输出超过 1MB（长任务、工具输出多）。Node 在输出超过 maxBuffer 时杀掉子进程。已改为 512MB（2026-10-17）。:8899 服务流式读取，不受影响
- 行 546 · cancel · L1b zcode/L1b/acp-bridge · ◐ 条件：acpx 调用方进程被杀（本例是命令行网关 1MB 缓冲上限把 acpx 客户端杀掉）。杀掉 acpx 客户端不会停止这一轮：队列进程里的智能体照样干完。调用方以为断了，智能体其实还在工作；要停必须走 acpx cancel（session/cancel）
- 行 746 · open · L2 zcode/L2/server-api · ❌ 条件：调用 POST /api/gateway/session/new 注册新会话 probe-L2b-zcode-new。gateway.ts:2203-2251 仅在网关内存 this.draftSessions 登记草稿对象，未调用任何下层 L0/L1 路线（calls: none），底层会话从未真实创建，属典型假闭环
- 行 753 · model-switch · L2 zcode/L2/server-api · ❌ 条件：调用 POST /api/gateway/model 切换模型。gateway.ts:2970-3068：对 antigravity 仅设内存 Map，底层无 RPC 调用（calls: none）；对其余 6 家若会话文件不存在则 acpx set-model 报错，即便改写了 .acpx json 也不改变下一轮实际模型，属假闭环
- 行 760 · mode-switch · L2 zcode/L2/server-api · ◐ 条件：调用 POST /api/gateway/cwd 切换会话工作目录。gateway.ts:2900-2967：仅校验目录合法性并在网关内存 selectedCwds 缓存，若存在 .acpx json 则修改 raw.cwd 字段，未向运行中进程或底层守护发送任何切换通知（calls: none），非运行时动态切目录
- 行 767 · permission · L2 zcode/L2/server-api · ❌ 条件：调用 POST /api/gateway/approve 响应权限审批。确认 HANDOFF.md 第三节病灶 4：审批完全脱离 ACP session/request_permission 与原生 RPC 挂起协议，是进程死后事后正则匹配造出的假卡片，点击后粗暴开启新轮次全放行，属典型假闭环
- 行 774 · fork · L2 zcode/L2/server-api · ❌ 条件：调用 POST /api/gateway/handoff 跨渠道会话接力。确认 HANDOFF.md 第三节说法：分叉/接力并非原生分支（如 Codex app-server fork 或 ACP session/fork），只是字符串摘要拼接后在新会话重新提问，破坏历史上下文完整性与快照隔离，属假闭环/接错路
- 行 788 · steer · L2 zcode/L2/server-api · ◐ 条件：调用 POST /api/control 向 zcode 派发人工调控指令。server.ts:359-406：该接口是 Mode 1 复杂架构案例与星空拓扑的反向调控仿真写入桩，纯写入案例目录文本，根本不与任何底层 Agent 运行时交互（calls: none），属假闭环
- 行 828 · cancel · L2 zcode/L2/agent_gateway · ❓ 条件：核验第 816 行（原结论 pass）。返回 cancelled:false，当时没有进行中的一轮可取消，不能证明取消接通
- 行 834 · model-switch · L3 zcode/L3/web-console · ◐ 条件：与 chat.js switchModel 完全相同的后端路径。「下一轮实际模型」按任务书标准缺证据，与 MATRIX 553 的 ⚠ 一致
- 行 849 · model-switch · L3 zcode/L3/web-chat-drawer · ◐ 条件：显示（mid=true）。与 console 判定同源
- 行 880 · resume-native · L2 zcode/L2/server-api · ❌ 条件：POST /api/gateway/send 携带原生 traceSessionId: zcode:sess_2f9d76a9-0152-48a2-9b09-7。原生会话无法通过网关原位续接
- 行 894 · fork · L2 zcode/L2/server-api · ❌ 条件：POST /api/gateway/handoff 会话接力/分叉。无原生分叉调用，纯 Prompt 拼接伪分叉，核实 HANDOFF.md 第三节表格第 4 条
- 行 902 · open · L2 zcode/L2/server-api · ◐ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。智能体回复了，网关仍判失败：完成判据有问题
- 行 905 · resume · L2 zcode/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。返回太快，像是进了网关内存队列排在未完成的上一轮后面，并未执行；接口 ok 不代表续上
- 行 909 · resume-native · L2 zcode/L2/server-api · ❌ 条件：POST /api/gateway/send wait 模式，测试员自建 :8931。对原生会话发消息被分配到 acpx 会话 hub-zcode，原生会话没续上
- 行 970 · steer · L0 zcode/L0/subagent · ❌ 条件：ZCode ACP 协议尝试对已加载子智能体发送 session/prompt。断在引擎核心规则：ZCode 内核对子智能体会话施加强制只读锁，外部无法送话
- 行 971 · cancel · L0 zcode/L0/subagent · ◐ 条件：ZCode DWF 工作流。仅限 DWF 架构子智能体支持打断
- 行 1031 · steer · L0 zcode/L0/subagent · ❌ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1032 · cancel · L0 zcode/L0/subagent · ◐ 条件：Antigravity pro 10-18 实测，负责人据报告总表代录（测试员未按要求写黑板）；Codex 父子关系表 thread_spawn_edges 已。子智能体入口
- 行 1218 · guard · L0 zcode/L0/hook-engine · ◐ 条件：ZCode CLI 0.16.9, zcode.cjs 内核源码。内核具备完备的额外上下文注入钩子，但无头 ACP 模式下默认禁用；需通过桌面端预信任工作区插件方可激活，最高补齐到工作区 AGENTS.md 守卫
- 行 1244 · wake-timer · L1a zcode/L1a/acp · ◐ 条件：ZCode 0.16.9。桌面端具备，但无头 ACP 桥接器未暴露定时唤醒接口，最高补齐到中心调度器托管唤醒
- 行 1267 · inject-silent · L1a zcode/L1a/acp · ❌ 条件：ZCode 0.16.9, ACP 协议标准。协议层限制：原生不支持只入上下文不触发推理；最高补齐需旁路向 SQLite 或 ndjson 追加消息行再行 resume
- 行 1461 · mount-tools · L1a zcode/L1a/acp-mcp · ❓ 条件：zcode-acp-server 0.69.3。接口存在，缺行为证据：ACP 握手包含 mcpServers 参数且支持 /mcp 命令，缺会话中实际调用挂载 MCP 工具并产生结果的行为证据
- 行 1462 · cmd-list · L1a zcode/L1a/acp · ❓ 条件：zcode-acp-server 0.69.3。接口存在，缺行为证据：握手帧返回 available_commands_update，缺逐条命令在会话内实际调用成功的一致性行为证据
- 行 1464 · goal · L1a zcode/L1a/acp · ❓ 条件：zcode-acp-server 0.69.3。接口存在，缺行为证据：原生包含 /goal 与 /auto 命令声明，缺实际运行长程自主循环推进至目标或因预算耗尽停下的行为证据
- 行 1467 · task-board · L0 zcode/L0/sqlite-todo · ❓ 条件：ZCode v0.16.9; db.sqlite。接口存在，缺行为证据：SQLite todo 表包含 2,351 条历史数据，缺两个独立智能体会话同时读写并感知同一份清单状态同步的行为证据
- 行 1469 · inject-next · L1b zcode/L1b/acpx · ❓ 条件：acpx v0.19.5。接口存在，缺行为证据：acpx 包含 --no-wait 参数，缺一轮进行中排队送入且在本轮结束后自动触发第二轮推理的行为证据
- 行 1471 · channel-route · L1b zcode/L1b/acpx · ❓ 条件：acpx v0.19.5; zcode-acp-server 0.69.3。接口存在，缺行为证据：ACP 支持 --model 传参格式，缺单次调用动态切换不同渠道且在对账记录中证实分别走通的行为证据
- 行 1473 · channel-health · L0 zcode/L0/sqlite-health · ❓ 条件：ZCode v0.16.9; db.sqlite。接口存在，缺行为证据：model_usage 表记录历史限流与网络错误分类，缺渠道出错时中心被标记并停止派活的熔断行为证据
- 行 1475 · memory-mode · L0 zcode/L0/settings · ❓ 条件：ZCode v0.16.9; setting.json。接口存在，缺行为证据：setting.json 声明 memoryEnabled 配置项，缺关闭后运行会话并验证跨会话长期记忆无变化的行为证据
- 行 1478 · archive · L0 zcode/L0/settings · ❓ 条件：ZCode v0.16.9; setting.json。接口存在，缺行为证据：setting.json 包含 taskAutoArchiveEnabled 配置项，缺时间到期后会话被自动归档的行为证据
- 行 1479 · handover-human · L0 zcode/L0/opencli · ❓ 条件：ZCode v0.16.9; opencli-zcode。接口存在，缺行为证据：遵守安全规则未在前台呼出桌面 Electron 窗口，缺人类在桌面原界面接手打字继续的即时行为证据
- 行 1482 · reclaim · L1b zcode/L1b/acpx · ❓ 条件：acpx v0.19.5; zcode-acp-server 0.69.3。接口存在，缺行为证据：acpx cancel 命令存在，缺正在执行的轮次被安全中止并回归待命的现场审计证据
- 行 1483 · permission-scope · L1a zcode/L1a/acp · ❓ 条件：zcode-acp-server 0.69.3。接口存在，缺行为证据：ACP 握手声明 5 档模式，缺在只读模式下越界写入被安全拦截并挂起等待审批的行为证据

## 待复测（最新结论仍是“未验证”的格子）

- **antigravity**：antigravity/L0/connect-rpc · spawn-subagent（行 1492）；antigravity/L0/agentapi+projects-config · workspace（行 1493）；antigravity/L0/customizations · instructions（行 1494）；antigravity/L0/mcp+plugins · mount-tools（行 1495）；antigravity/L0/connect-rpc · inject-next（行 1496）；antigravity/L0/mcp · inject-tool（行 1497）；antigravity/L0/file-inbox · inject-inbox（行 1498）；antigravity/L0/hooks+slash · goal（行 1499）；antigravity/L0/connect-rpc · channel-health（行 1500）；antigravity/L0/presence-lock+gateway · channel-lease（行 1501）；antigravity/L0/summaries-db · capacity（行 1502）；antigravity/L0/gateway+daemon · host-drain（行 1503）；antigravity/L0/slash-learn+conversations-db · memory-mode（行 1504）；antigravity/L0/artifacts+transcript · act-deliver（行 1505）；antigravity/L0/ask_question+send_message · act-request（行 1506）；antigravity/L0/summaries-db · act-yield（行 1507）；antigravity/L0/transcript-stream · act-report（行 1508）；antigravity/L0/builtin-tool · ask-user（行 1509）；antigravity/L0/desktop-toast · notify-user（行 1510）；antigravity/L0/agentapi+desktop-input · human-steer（行 1511）；antigravity/L0/desktop-app · handover-human（行 1512）；antigravity/L0/send_message+rpc · peer-message（行 1513）；antigravity/L0/subagents+fork · handoff（行 1514）；antigravity/L0/manage_task+board-file · task-board（行 1515）；antigravity/L0/force-stop+lock-release · reclaim（行 1516）；antigravity/L0/artifacts-ui · artifact（行 1517）；antigravity/L0/builtin-browser · browser（行 1518）；antigravity/L0/run_command · terminal（行 1519）；antigravity/L0/generative_ui+webview · dev-preview（行 1520）；antigravity/L0/slash-commands · cmd-list（行 1521）；antigravity/L0/metadata-hide · archive（行 1522）；antigravity/L0/sqlite-delete+rpc · delete（行 1523）；antigravity/L0/loop-detector · loop-guard（行 1524）；antigravity/L0/hooks-json · guard（行 1525）；antigravity/L0/rules+post-invocation-hook · output-contract（行 1526）；antigravity/L0/workspace-boundary · permission-scope（行 1527）
- **claude**：claude/L0/desktop-app · wake-timer（行 65）；claude/L0/claude-cli · instructions（行 1439）；claude/L0/claude-cli · ownership（行 1441）；claude/L0/claude-cli · handover-human（行 1443）；claude/L0/claude-cli · task-board（行 1444）；claude/L0/claude-cli · peer-message（行 1445）；claude/L0/claude-cli · ask-user（行 1446）；claude/L0/claude-cli · wake-stall（行 1449）；claude/L0/claude-cli · wait-visible（行 1450）；claude/L0/claude-cli · artifact（行 1451）；claude/L0/claude-cli · handoff（行 1452）；claude/L0/claude-cli · human-steer（行 1453）；claude/L0/claude-cli · act-report（行 1454）；claude/L0/claude-cli · act-yield（行 1455）
- **claude-desktop**：claude-desktop/L0/code-session · wake-timer（行 928）；claude-desktop/L0/code-session · artifact（行 935）；claude-desktop/L0/code-session · notify-user（行 936）；claude-desktop/L0/code-session · peer-message（行 937）
- **codex**：codex/L0/app-server · inject-next（行 1398）；codex/L0/exec · inject-next（行 1399）；codex/L0/app-server · inject-tool（行 1400）；codex/L0/app-server · inject-inbox（行 1401）；codex/L0/app-server · inject-silent（行 1402）；codex/L0/app-server · goal（行 1403）；codex/L0/app-server · channel-route（行 1490）；codex/L0/app-server · channel-health（行 1404）；codex/L0/app-server · guard（行 1405）；codex/L0/app-server · act-deliver（行 1406）；codex/L0/app-server · act-request（行 1407）；codex/L0/app-server · act-yield（行 1408）；codex/L0/app-server · act-report（行 1409）；codex/L0/app-server · wait-visible（行 1410）；codex/L0/app-server · wake-bg（行 1411）；codex/L0/app-server · wake-msg（行 1412）；codex/L0/app-server · wake-stall（行 1413）；codex/L0/app-server · wake-persist（行 1414）；codex/L0/subagent · peer-message（行 1415）；codex/L0/app-server · handoff（行 1416）；codex/L0/app-server · task-board（行 1417）；codex/L0/app-server · ask-user（行 1418）；codex/L0/app-server · notify-user（行 1419）；codex/L0/app-server · human-steer（行 1420）；codex/L0/app-server · artifact（行 1421）；codex/L0/app-server · browser（行 1422）；codex/L0/desktop · dev-preview（行 1423）；codex/L0/app-server · mount-tools（行 1424）；codex/L0/app-server · workspace（行 1425）；codex/L0/app-server · output-contract（行 1426）；codex/L0/app-server · capacity（行 1427）；codex/L0/exec · handover-human（行 1428）；codex/L0/app-server · reclaim（行 1429）；codex/L0/subagent · sampling（行 1430）；codex/L0/app-server · memory-mode（行 1431）；codex/L0/app-server · loop-guard（行 1432）；codex/L0/app-server · channel-lease（行 1433）；codex/L0/app-server · host-drain（行 1434）；codex/L0/app-server · permission-scope（行 1435）；codex/L0/app-server · handover-human（行 1163）
- **hermes**：hermes/L0/cli · wake-bg（行 1365）；hermes/L0/cli · wake-msg（行 1366）；hermes/L0/cli · wait-visible（行 1378）；hermes/L0/cli · wake-persist（行 1364）；hermes/L0/cli · discover-sessions（行 1330）；hermes/L0/cli · archive（行 1331）；hermes/L0/cli · mount-tools（行 1334）；hermes/L0/cli · instructions（行 1335）；hermes/L0/cli · channel-route（行 1336）；hermes/L0/cli · channel-health（行 1337）；hermes/L0/cli · capacity（行 1338）；hermes/L0/cli · task-board（行 1339）；hermes/L0/subagent · spawn-subagent（行 1340）；hermes/L0/subagent · discover-sessions（行 1341）；hermes/L0/subagent · observe-history（行 1342）；hermes/L0/subagent · cancel（行 1343）；hermes/L0/cli · loop-guard（行 1344）；hermes/L0/cli · channel-lease（行 1345）；hermes/L0/cli · output-contract（行 1346）；hermes/L0/cli · memory-mode（行 1347）；hermes/L0/cli · handover-human（行 1349）；hermes/L0/cli · notify-user（行 1367）；hermes/L0/cli · artifact（行 1368）；hermes/L0/cli · browser（行 1369）；hermes/L0/cli · goal（行 1370）；hermes/L0/cli · inject-next（行 1371）；hermes/L0/cli · inject-tool（行 1372）；hermes/L0/cli · inject-inbox（行 1373）；hermes/L0/cli · act-deliver（行 1374）；hermes/L0/cli · act-request（行 1375）；hermes/L0/cli · act-yield（行 1376）；hermes/L0/cli · act-report（行 1377）；hermes/L0/cli · peer-message（行 1379）；hermes/L0/cli · handoff（行 1380）
- **opencode**：opencode/L1a/acp · steer（行 735）；opencode/L1a/acp · model-switch（行 736）；opencode/L1b/acpx · model-switch（行 738）；opencode/L0/run · archive（行 1350）；opencode/L0/run · rewind（行 1351）；opencode/L0/run · mount-tools（行 1352）；opencode/L0/run · instructions（行 1353）；opencode/L0/run · loop-guard（行 1354）；opencode/L0/run · permission-scope（行 1355）；opencode/L0/run · channel-route（行 1362）；opencode/L0/run · handover-human（行 1357）；opencode/L0/serve · open-idle（行 1358）；opencode/L0/run · wake-stall（行 1359）；opencode/L0/run · ask-user（行 1363）；opencode/L0/serve · inject-next（行 1381）；opencode/L0/run · inject-tool（行 1382）；opencode/L0/run · inject-inbox（行 1383）；opencode/L0/run · goal（行 1384）；opencode/L0/run · act-request（行 1386）；opencode/L0/run · act-report（行 1387）；opencode/L0/run · handoff（行 1388）；opencode/L0/run · artifact（行 1389）；opencode/L0/run · wake-msg（行 1390）
- **workbuddy**：workbuddy/L0/cli-mcp · mount-tools（行 1460）；workbuddy/L0/cli · cmd-list（行 1463）；workbuddy/L0/cli · goal（行 1465）；workbuddy/L0/sqlite-automations · wake-timer（行 1466）；workbuddy/L0/todo-tool · task-board（行 1468）；workbuddy/L1b/acpx · inject-next（行 1470）；workbuddy/L0/cli · channel-route（行 1472）；workbuddy/L0/logs-health · channel-health（行 1474）；workbuddy/L0/settings · memory-mode（行 1476）；workbuddy/L0/cli · archive（行 1477）；workbuddy/L0/cli · handover-human（行 1480）；workbuddy/L0/cli · reclaim（行 1481）；workbuddy/L0/cli · permission-scope（行 1484）
- **zcode**：zcode/L2/agent_gateway · cancel（行 828）；zcode/L1a/acp-mcp · mount-tools（行 1461）；zcode/L1a/acp · cmd-list（行 1462）；zcode/L1a/acp · goal（行 1464）；zcode/L0/sqlite-todo · task-board（行 1467）；zcode/L1b/acpx · inject-next（行 1469）；zcode/L1b/acpx · channel-route（行 1471）；zcode/L0/sqlite-health · channel-health（行 1473）；zcode/L0/settings · memory-mode（行 1475）；zcode/L0/settings · archive（行 1478）；zcode/L0/opencli · handover-human（行 1479）；zcode/L1b/acpx · reclaim（行 1482）；zcode/L1a/acp · permission-scope（行 1483）
