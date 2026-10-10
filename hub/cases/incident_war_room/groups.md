---
hub: "1.0"
kind: groups
case: incident_war_room
---

# @command [group] #level/1
name: 指挥层
members: [ic, comms, postmortem, devil]

# @diagnose [group] #level/1
name: 并行诊断层
members: [diag_infra, diag_app, diag_db, forensics]

# @mitigate [group] #level/1
name: 止损与验证层
members: [fix_eng, validator]
