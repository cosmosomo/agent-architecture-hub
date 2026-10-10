---
hub: "1.0"
kind: process
case: demo_minimal
---

# @s_do [stage] #group/g_do
name: 执行
executors: [worker]

# @gt_check [gate]
name: 交付是否合格
after_stage: s_do
decider_type: agent
decider_who: checker
decider_text: 对照清单逐项检查
pass: done
fail: s_do
