---
hub: "1.0"
kind: scenarios
case: deep_five_minds
---

# 运行场景

## @K1 [case]
name: 第一期迁移
rework_gate: gt_qa
rework_times: 1
missing:
  - ind: n6
    doc: d_system_constraints
    note: 社区调研员没有引用现有系统约束文档

## @K2 [case]
name: 迁移方案复核

## @K3 [case]
name: 第二期迁移
blocked_at: gt_build
inject:
  - at: 0.6
    to: n22
    kind: instruction
    text: 人在运行中追加要求：第二期要支持灰度回滚，集成者补一份回滚脚本

---

# 特殊情况

## 从不派出
never_dispatch: [n10]
note: 补充调研员在本次运行里从未被派出

## 未声明的直接读取
@n19 >undeclared_read @n7   前端直接找体验调研员要资料（编排者未在任务书里授权）

## 渠道故障
@ch_opus outage at=0.5 dur=0.05 kind=quota
note: Opus 渠道在运行中途额度用完

## 文档版本变更
version_change at=0.3 by=human
note: 人补充"现有系统约束"文档，追加给调研组工作包
