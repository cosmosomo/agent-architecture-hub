---
hub: "1.0"
kind: agents
case: demo_minimal
---

# @worker [individual] #phase/build #role/engineer #hub
name: 执行者
model: claude-sonnet-5-5
role: 按清单把活干完并交付
trigger: 分派任务后启动

# @checker [individual] #phase/qa #role/reviewer
name: 把关者
model: claude-sonnet-5-5
role: 检查交付是否符合清单，不合格打回
trigger: 执行者交付后启动
watches: [worker]
