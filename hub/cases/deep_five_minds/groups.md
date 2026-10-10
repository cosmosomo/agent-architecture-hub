---
hub: "1.0"
kind: groups
case: deep_five_minds
---

# @g_strategy [group] #level/1
name: 战略
members: [n0, n1, n2, n3, n4]

# @g_research [group] #level/1
name: 调研
children: [g_research_general, g_research_community]

# @g_research_general [group] #level/2
name: 通用调研
parent: g_research
members: [n5, n7, n8, n11]

# @g_research_community [group] #level/2
name: 社区调研
parent: g_research
members: [n6, n9, n10]

# @g_debate [group] #level/1
name: 五心智辩论
members: [n12, n13, n14, n15, n16]

# @g_gate [group] #level/1
name: 人工把关
members: [n4, n17, n23]

# @g_build [group] #level/1
name: 构建
children: [g_build_backend, g_build_frontend]

# @g_build_backend [group] #level/2
name: 服务端小组
parent: g_build
members: [n18, n20, n22]

# @g_build_frontend [group] #level/2
name: 界面小组
parent: g_build
members: [n19, n21]

# @g_qa [group] #level/1
name: 质检
members: [n24, n25, n26]
