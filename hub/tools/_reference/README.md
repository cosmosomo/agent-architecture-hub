# tools/_reference：导入脚本和只服务参考语料的检查（收起来的）

- `import_*.js`：把外部数据集（AgentCollabBench、Who&When、MAST、τ-bench、CAMEL 等）转成 `hub/cases/_reference/` 下的 md 案例。数据源在仓库外面（相对路径指向作者本机的 `case_library/`），换机器需要自己改各脚本顶部的 `SRC`。输出目录按数据集分层。
- `check_real_facts.js`：对带真实轨迹（`traces/`）的参考案例跑完整流水线，要求参考语料在 `hub/cases/_reference/`。
- `audit_corpus.js`：参考语料的规模和覆盖分布。

默认的 `npm test` 不跑这里的东西。

> Importers and corpus-only checks, kept out of the way. They read datasets from the author's machine and are not part of the default test run.

注：导入脚本还会往输出目录里追加一个 `_index.md`——那是已经退役的案例登记表，现在目录是自动发现的，这个文件不起作用，可以删掉。`check_shells.js --all` 是对这批语料的验收：逐案例画一遍，数空框、无头像、破文字。
