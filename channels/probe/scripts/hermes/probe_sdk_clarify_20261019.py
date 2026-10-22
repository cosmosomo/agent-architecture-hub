# probe_hermes_sdk_clarify_20261019.py — research-acp (ZCode)
# Hermes SDK 级实测：宿主注入 clarify_callback → 智能体一轮内问人、宿主作答、答案回同一轮。
# 方法：monkey-patch hermes_cli.oneshot._oneshot_clarify_callback，走它自己的 run_oneshot 单轮入口。
import sys, io, os

REPO = r"E:\program\GIT\Agent\hermes and vcp like\hermes-agent"
sys.path.insert(0, REPO)
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")

import hermes_cli.oneshot as oneshot

ASKED = []
ANSWER = "香蕉"

def my_clarify(question, choices=None, multi_select=False, *args, **kwargs):
    questions = kwargs.get("questions")
    if questions:
        for q in questions:
            ASKED.append({"batch_question": q.get("question"), "choices": q.get("choices"), "qid": q.get("qid")})
        answers = {q.get("qid") or f"q{i}": ANSWER for i, q in enumerate(questions)}
        import json
        return json.dumps({"answers": answers, "timed_out": False}, ensure_ascii=False)
    ASKED.append({"question": question, "choices": choices, "multi_select": multi_select})
    return ANSWER

oneshot._oneshot_clarify_callback = my_clarify

PROMPT = ("请调用 clarify 工具向我提问：「苹果还是香蕉？」（选项：苹果、香蕉）。"
          "你必须等我回答后再继续，并根据我的答案回复。")

buf = io.StringIO()
rc = None
try:
    old = sys.stdout
    rc = oneshot.run_oneshot(PROMPT)
finally:
    pass
print("[RC]", rc)
print("[CLARIFY_TOOL_ASKED]", ASKED)
