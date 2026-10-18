# 测试任务：Claude 会话中途换模型（haiku → sonnet）

用户原话（10-18 晚）：“换可以换sonnet。。”——测“中途换模型”时，Claude 可以从 haiku 换到 sonnet；其余一律 haiku，不用 opus。

要回答的问题：经我们的后端（8899），一个 Claude 会话第一轮用 haiku，中途换成 sonnet 后，第二轮是不是真的由 sonnet 回答。以 Claude 自己的会话记录为准：~/.claude/projects/<目录>/<会话编号>.jsonl 里每条 assistant 记录的 "model" 字段，第一轮应是 claude-haiku-…，第二轮应是 claude-sonnet-…。

怎么做（你判断细节）：
1. 新建一个 probe- 开头的 Claude 会话（POST http://127.0.0.1:8899/api/gateway/send，channel claude，model haiku，prompt 只回复一句话），等它跑完（GET /api/gateway/run?channel=claude&session=<名>&waitMs=120000）。
2. POST /api/gateway/model 把这个会话换成 sonnet，再发一句话，等跑完。
3. 找到这个会话的记录文件（/api/sessions?slim=1 里找 controlName 等于你的会话名的那条，id 后面就是会话编号），数两轮的 model 字段。
4. 在 channels/probe/blackboard.jsonl 追加一行 JSON：{"ts": 真实当前时间, "route": "claude/L2/server-api", "capability": "model-switch", "result": "pass" 或 "fail", "by": "zcode-tester", "evidence": 写清会话编号、两次运行编号 run_…、两轮的 model 字段原值, "note": "haiku→sonnet"}。
5. 跑 node hub/tools/agent_gateway.js tables，证据一项要过。

交回：用一段话说结论和证据（会话编号、两个 run 编号、两轮 model 原值）。不要改任何代码文件，不要重启 8899，不要碰别的会话。
