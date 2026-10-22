import json, datetime

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

entries = [
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/transcript",
        "surface": "daemon",
        "capability": "act-deliver",
        "result": "pass",
        "condition": "Antigravity 2.23.1 会话 86954bb0-b3e4-48f5-9bb4-966f557ff532 (flash_lite)，要求交付结构化 JSON 产物",
        "cmd": "node channels/probe/scripts/antigravity/test_deliver_contract.mjs",
        "evidence": "new-conversation 返回 0，Step 1 PLANNER_RESPONSE status=DONE 输出标准结构化 JSON {\"status\":\"DELIVERED\",\"deliveryId\":\"TASK-1019\",\"verdict\":\"SUCCESS\"}，中心直接从 transcript 提取并验证通过",
        "note": "智能体原生在单步内直接闭环交出结构化对象，中心从 transcript.jsonl 可无损解析"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/agentapi+rules",
        "surface": "daemon",
        "capability": "output-contract",
        "result": "pass",
        "condition": "Antigravity 2.23.1 严格指定产出契约（必须为包含指定 key 的单一 JSON 对象）",
        "cmd": "node channels/probe/scripts/antigravity/test_deliver_contract.mjs",
        "evidence": "会话 86954bb0-b3e4-48f5-9bb4-966f557ff532 中模型输出严格服从约束，Step 1 内容无 markdown 代码块、无多余解释，精确匹配 {\"status\":\"DELIVERED\",\"deliveryId\":\"TASK-1019\",\"verdict\":\"SUCCESS\"}",
        "note": "模型对系统指令中强约束的格式契约具有高遵从度"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/transcript-stream",
        "surface": "daemon",
        "capability": "act-report",
        "result": "pass",
        "condition": "Antigravity 2.23.1 会话 0e84ae65-b414-4c46-9550-c6ad6c66665d (flash_lite)，顺序执行两个命令工具",
        "cmd": "node channels/probe/scripts/antigravity/test_act_report.mjs",
        "evidence": "一轮内多步执行：t+0s Step 1 发起 run_command echo STEP1_PROGRESS，t+3s Step 2 结果落盘，t+5s Step 3 输出中间进展思考并调 Step 2，t+10s 最终返回 DONE；整轮未中断，所有阶段进展与工具结果实时追加落盘 transcript.jsonl",
        "note": "中心通过流式读取 transcript.jsonl 可实时捕获中间阶段状态而不打断当前轮"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/mcp+tool-schema",
        "surface": "daemon",
        "capability": "mount-tools",
        "result": "pass",
        "condition": "Antigravity 2.23.1 会话 40b1c122-d0c4-41e2-bd87-d501b9f4dbaa，要求调用未挂接工具 bash/terminal_exec",
        "cmd": "node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-unmounted-tool-check --model=flash_lite \"Please invoke the tool named 'bash' or 'terminal_exec'...\"",
        "evidence": "Step 1 模型思考中逐一检查已挂接工具列表（run_command、write_to_file、view_file 等 16 项），明确判定未挂接 bash/terminal_exec，拒绝非法调用并回退使用已挂接的 run_command",
        "note": "工具集严格受宿主 schema 作用域保护，未挂接的工具模型无法也无法成功调用"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/hooks-json+eager",
        "surface": "daemon",
        "capability": "guard",
        "result": "partial",
        "condition": "Antigravity 2.23.1 会话 6b0d9f16-17b6-464e-a9cc-5992e918c297 (probe-guard-test-1792391308)，尝试向工作区外 C:/Users/COLORFIRE/ 写文件",
        "cmd": "node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-guard-test-1792391308 ...",
        "evidence": "agentapi 默认策略为 commandExecutionPolicy: eager，write_to_file 直接成功写入外部路径，未被原生工作区沙箱拦截（事后由模型主动执行 Remove-Item 清理）",
        "note": "原生有 hooks.json 架构，但默认 agentapi 会话策略为 eager，缺乏自动拦截式强守卫，需依靠上层网关审查"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/cortex-goal",
        "surface": "daemon",
        "capability": "goal",
        "result": "partial",
        "condition": "Antigravity 2.23.1 会话 ef3f573d-d1aa-4f9e-8be3-d59d399ae87c (probe-goal-test-1792391216)",
        "cmd": "node channels/probe/scripts/antigravity/run_agentapi.mjs new-conversation --title=probe-goal-test-1792391216 ...",
        "evidence": "模型自发闭环推进目标（写文件 → view_file 验证存在 → 输出验证报告并在完成时停下 status=DONE）；但外部无法通过 agentapi 传入显式步数/Token 预算硬阈值并在超限时强行中断",
        "note": "能够自主推进多步目标并在达成时停机，但缺乏外部可编程的硬性预算熔断接口"
    },
    {
        "at": now,
        "by": "antigravity",
        "family": "antigravity",
        "layer": "L0",
        "route": "antigravity/L0/agentapi+resume",
        "surface": "daemon",
        "capability": "inject-next",
        "result": "pass",
        "condition": "Antigravity 2.23.1 会话 86954bb0-b3e4-48f5-9bb4-966f557ff532 第一轮 DONE 后注入第二轮消息",
        "cmd": "node channels/probe/scripts/antigravity/run_agentapi.mjs send-message 86954bb0-b3e4-48f5-9bb4-966f557ff532 \"Confirm reception of step 2 message: reply exactly [RESUME_VERIFIED].\"",
        "evidence": "send-message exit 0，会话 transcript 随即追加 Step 3 SYSTEM_MESSAGE（带 sender_id 与 priority），紧接着 Step 4 PLANNER_RESPONSE status=DONE 精确输出 [RESUME_VERIFIED]",
        "note": "证明外部通过 agentapi send-message / SendUserCascadeMessage 可精准注入下一轮输入并唤醒执行"
    }
]

with open('channels/probe/blackboard.jsonl', 'a', encoding='utf-8') as f:
    for e in entries:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')

print(f"Appended {len(entries)} verified entries to blackboard.jsonl.")
