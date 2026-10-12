# _reference：参考语料（收起来的）

这个文件夹里是**大模型根据论文、框架源码和数据集整理出来的 md 编排**，不是真源，只当参考：

- 页面左侧"目录"页里它是一个折叠的文件夹，点开才会去读；默认的检查和测试也不进来（要查加 `--all`）。
- 它约 250 MB，不进 git（见仓库根的 `.gitignore`，只有本说明提交）。
- 由 `hub/tools/_reference/import_*.js` 在作者本机生成，数据源在仓库外面，换一台机器跑不了，各脚本顶部写了数据源的位置。
- 目录分层就是左栏的层级：`<数据集>/<子集>/<案例>/`。

真源是原始数据集和真实记录；这里的编排只是读取器尚未做好之前的中间态。出了问题再来看这里，平时不用管。

> Reference corpus: machine-written orchestration documents, kept out of the way (collapsed in the UI, skipped by the default checks, not committed). The real source of truth is the raw datasets and recorded traces.
