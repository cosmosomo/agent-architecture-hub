# 任务书（戊）：一条命令全测——按四张表自动回归

## 用户原话（逐字）

- 10-18 晚：“还是感觉效率低，能不能一口气全开发了，然后全测试一下，发现一次开发就全做好了，有这种可能性吗”
- “如果测试antigravity不好看，可以用zcode的glm-5.3-flash，测试会很流利的”

## 我的理解（总负责人 Claude；这是我的理解，不是用户的话）

“一口气全开发、全测、只修没过的”需要一个前提：一条命令把系统全测一遍。现在验收靠我手工翻产品记录，是瓶颈。要做的是一个回归工具：读四张表（`node hub/tools/agent_gateway.js tables`，`hub/data/*.json`），对每个产品的每个“后端已接”的单元，在 probe- 会话上真实跑一遍对应的动作，拿产品自己的记录或我们的运行记录、派活单比对，把结果写成黑板 L2 行，最后给出“过了 / 没过 / 为什么”的表。

## 要回答的问题

能不能让“全测一遍”变成一条命令、几十分钟跑完、结果可信（以产品自己的记录和 ~/.agent-hub 的运行记录为证，不信接口自报）？哪些单元能自动测，哪些测不了（要人、要网页、要外部条件），各自原因。

## 怎样算做成

- 一条命令（建议 `node hub/tools/agent_gateway.js verify [--product x] [--unit y]`，放在 channels/probe/scripts/ 下实现，网关子命令只是一行转发），按表生成测试、并发有节制地跑、写黑板、打印汇总；加一个单元或产品时，测试跟着表走，不手写。
- 用你自己的端口实例测（channels/probe/README.md 第九节），不要重启 8899。测试会话一律 probe- 开头；Claude 只用 haiku；能用 ZCode GLM-5.3-Flash 做被测对象的优先用它。
- 跑一遍全量，给出汇总；和现在功能矩阵里“实测通过”的格子对不上的，列出来。
- 汇报写 channels/probe/results/verify-all-20261018.md。交回前跑 tables，证据一项要过。资料和现状你自己查。

## 规矩

照 channels/probe/README.md 第九节。只写 channels/probe/scripts/ 下的新文件，和 hub/tools/agent_gateway.js 里加一个子命令（只加，不改别的段）。不改 trace/、m/、hub/data/。不提交、不推送。
