# -*- coding: utf-8 -*-
"""Generate 01..05 Main Slides + 06..08 Backup Slides for v2_simple.
- Main Slides (01..05): Ultra-clean (~240-310 chars/slide), large fonts (>=11pt), borderless top/left accent lines,
  Cobalt-Indigo (#1E3A8A / #3730A3) + Amber-Orange (#D97706) palette, small 3D accents, full-height workbench screenshots on P5.
- Backup Slides (06..08): B1 (vs 35+ open-source table), B2 (full capability matrix & 15-state lifecycle),
  B3 (communication primitives Deliver!=Wake & diagnostic logs).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "body")
os.makedirs(OUT, exist_ok=True)

NAVY = "#1E3A8A"       # Deep Cobalt Blue
COBALT = "#3730A3"     # Cobalt Purple-Indigo
SLATE = "#334155"
INK = "#1E293B"
MUTED = "#64748B"
LIGHT_BG = "#F8FAFC"
TINT_INDIGO = "#EEF2FF"
TINT_AMBER = "#FFFBEB"
WHITE = "#FFFFFF"
AMBER = "#D97706"      # Characteristic Amber-Orange accent
WARM_AMBER = "#B45309"
CRIMSON = "#9D0A12"
GREEN = "#047857"


def T(text, size=14, color=INK, bold=False, extra=""):
    w = ", fontWeight: 'bold'" if bold else ""
    e = (", " + extra) if extra else ""
    return "<Text style={{ fontSize: %s, color: '%s'%s%s }}>%s</Text>" % (size, color, w, e, text)


def B(text, color=NAVY):
    return '<span style={{ fontWeight: \'bold\', color: \'%s\' }}>%s</span>' % (color, text)


def box(children, style):
    return "<Box style={{ %s }}>\n%s\n</Box>" % (style, "\n".join(children))


def img(src, w, h, extra=""):
    e = (", " + extra) if extra else ""
    return '<Image src="主线/img/%s" style={{ width: %d, height: %d, objectFit: \'fill\'%s }} />' % (src, w, h, e)


def tag(text, fg=COBALT, bg="#EEF2FF"):
    return box(
        [T(text, 11.5, fg, True)],
        "background: '%s', borderRadius: 4, padding: '2px 8px', alignItems: 'center', justifyContent: 'center'" % bg,
    )


def page(title, subtitle, content, key_idea, is_backup=False):
    badge_col = WARM_AMBER if is_backup else COBALT
    badge_lbl = "补充深潜" if is_backup else "核心机制"
    head = [T(title, 26.0 if is_backup else 26.5, NAVY, True)]
    if subtitle:
        head.append(T(subtitle, 13.8, MUTED, extra="marginTop: 5"))
    footer_bar = [
        box([], "flex: 1"),
        box(
            [
                box(
                    [T(badge_lbl, 12.2, WHITE, True)],
                    "background: '%s', borderRadius: 4, padding: '3px 9px', alignItems: 'center', justifyContent: 'center'" % badge_col,
                ),
                T(key_idea, 13.5, INK, True),
            ],
            "height: 38, flexDirection: 'row', alignItems: 'center', gap: 12, background: '%s', borderLeft: '4px solid %s', borderRadius: 6, padding: '0 14px'"
            % ("#FFFBEB" if is_backup else "#EEF2FF", badge_col),
        ),
    ]
    body = box(
        head + content + footer_bar,
        "position: 'relative', zIndex: 1, width: '1280px', height: '720px', padding: '94px 56px 76px 56px', flexDirection: 'column'",
    )
    return "\n".join("    " + line for line in body.split("\n")) + "\n"


def write(name, text):
    with open(os.path.join(OUT, name + ".body"), "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", name)


def mini_chip(title, sub="", col=COBALT, bg="#F8FAFC", bcol="#CBD5E1", flex_val=1):
    fl = ("flex: %s, " % flex_val) if flex_val else ""
    kids = [T(title, 11.6, col, True)]
    if sub:
        kids.append(T(sub, 11.5, MUTED, extra="marginTop: 1"))
    return box(
        kids,
        "%sbackground: '%s', borderTop: '2.5px solid %s', border: '1px solid %s', borderRadius: 4, padding: '3px 6px', flexDirection: 'column', justifyContent: 'center'"
        % (fl, bg, col, bcol),
    )


def inline_chip(title, sub="", col=COBALT, bg="#F8FAFC", bd_or_flex=1, flex_val=1):
    if isinstance(bd_or_flex, str) and bd_or_flex.startswith("#"):
        bcol = bd_or_flex
        fl = ("flex: %s, " % flex_val) if flex_val else ""
    else:
        bcol = "#E2E8F0"
        fl = ("flex: %s, " % bd_or_flex) if bd_or_flex else ""
    txt = B(title, col) + (" · " + sub if sub else "")
    return box(
        [T(txt, 11.5, INK)],
        "%sbackground: '%s', border: '1px solid %s', borderLeft: '3px solid %s', borderRadius: 3, padding: '3px 6px', alignItems: 'center', flexDirection: 'row'"
        % (fl, bg, bcol, col),
    )


def flow_strip(items, col=COBALT, bg="#F8FAFC", bd_or_arrow="➔", arrow="➔"):
    if isinstance(bd_or_arrow, str) and bd_or_arrow.startswith("#"):
        bcol = bd_or_arrow
        arr = arrow
    else:
        bcol = col
        arr = bd_or_arrow
    nodes = []
    for i, item in enumerate(items):
        if i > 0:
            nodes.append(T(arr, 11.6, col, True, extra="margin: '0 2px'"))
        if isinstance(item, tuple):
            t, s = item
            nodes.append(mini_chip(t, s, col, bg, bcol, 1))
        else:
            nodes.append(
                box(
                    [T(item, 11.5, col, True)],
                    "flex: 1, background: '%s', border: '1px solid %s', borderRadius: 4, padding: '3px 5px', alignItems: 'center', justifyContent: 'center'"
                    % (bg, bcol),
                )
            )
    return box(nodes, "flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2")


def sub_row(lbl, right_node, col=COBALT, w=78):
    if isinstance(right_node, list):
        right_node = box(right_node, "flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4")
    return box(
        [
            box(
                [T(lbl, 11.5, col, True)],
                "width: %d, paddingRight: 4" % w,
            ),
            right_node,
        ],
        "flexDirection: 'row', alignItems: 'center', marginTop: 3",
    )


def stat_badge(num_txt, lbl_txt, sub_txt, col=COBALT, bg="#EEF2FF", bd="#C7D2FE"):
    return box(
        [
            box(
                [
                    T(num_txt, 17.5, col, True),
                    T(lbl_txt, 12.2, INK, True, extra="marginLeft: 6"),
                ],
                "flexDirection: 'row', alignItems: 'baseline'",
            ),
            T(sub_txt, 11.5, MUTED, extra="marginTop: 1"),
        ],
        "flex: 1, background: '%s', border: '1px solid %s', borderLeft: '4px solid %s', borderRadius: 4, padding: '4px 10px', flexDirection: 'column', justifyContent: 'center'"
        % (bg, bd, col),
    )


# ==============================================================================
# 正片 P1: 系统立题与技术路线（真实家底大数字 + 三路线对比 + 最高缓存率与借别家所长）
# ==============================================================================
def p01_chip(title, sub, col):
    return box(
        [
            T(title, 12.2, col, True),
            T(sub, 11.6, MUTED, extra="marginTop: 3"),
        ],
        "flex: 1, background: '#F8FAFC', borderTop: '2.5px solid %s', border: '1px solid #E2E8F0', borderRadius: 4, padding: '6px 7px', flexDirection: 'column', justifyContent: 'center'"
        % col,
    )


def p01_item_block(col, title, chips):
    chip_nodes = [p01_chip(c_title, c_sub, col) for c_title, c_sub in chips]
    return box(
        [
            T(title, 13.4, col, True),
            box(chip_nodes, "flexDirection: 'row', gap: 6, marginTop: 5"),
        ],
        "borderLeft: '3.5px solid %s', padding: '4px 0 4px 9px', flexDirection: 'column'" % col,
    )


def p01_col(step_tag, title, sub, width_px, top_col, item_blocks, summary_txt, is_ours=False, right_img=None, has_left_div=False):
    head_col = COBALT if is_ours else SLATE
    div_style = ", borderLeft: '1px solid #CBD5E1', paddingLeft: 14" if has_left_div else ""
    mid_row = (
        box(
            [
                box(item_blocks, "flex: 1, flexDirection: 'column', justifyContent: 'space-between'"),
                box(
                    [
                        img(right_img, 100, 100, "borderRadius: 6"),
                        T("三层状态映射", 11.6, MUTED, extra="marginTop: 4"),
                    ],
                    "width: 106, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginLeft: 6",
                ),
            ],
            "flex: 1, flexDirection: 'row', alignItems: 'stretch', marginTop: 8, marginBottom: 8",
        )
        if right_img
        else box(item_blocks, "flex: 1, flexDirection: 'column', justifyContent: 'space-between', marginTop: 8, marginBottom: 8")
    )
    return box(
        [
            box([], "height: 4, background: '%s', borderRadius: 2" % top_col),
            box(
                [
                    T(step_tag, 12.0, WARM_AMBER if is_ours else MUTED, True),
                    tag(sub, WARM_AMBER if is_ours else SLATE, "#FEF3C7" if is_ours else "#F1F5F9"),
                ],
                "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6",
            ),
            T(title, 14.6, head_col, True, extra="marginTop: 4"),
            mid_row,
            box(
                [T(summary_txt, 12.0, WHITE if is_ours else SLATE, True)],
                "background: '%s', borderRadius: 4, padding: '6px 8px', alignItems: 'center'"
                % (COBALT if is_ours else "#F1F5F9"),
            ),
        ],
        "width: %d, background: '#FFFFFF', padding: '4px 8px 6px 8px', flexDirection: 'column'%s"
        % (width_px, div_style),
    )


p01_stats = box(
    [
        stat_badge("9 款", "本机 AI 产品", "7 家可驱动 · 2 家只读检索", COBALT, "#EEF2FF", "#C7D2FE"),
        stat_badge("1,882 条", "真实会话记录", "统一格式直读 · 全文可搜", WARM_AMBER, "#FFFBEB", "#FDE68A"),
        stat_badge("132 个", "能力单元矩阵", "82 项功能 + 50 项显示交互", COBALT, "#EEF2FF", "#C7D2FE"),
        stat_badge("26 个", "已跑通目标", "累计产出 60 份研究报告", GREEN, "#ECFDF5", "#A7F3D0"),
    ],
    "flexDirection: 'row', gap: 10, marginTop: 4, height: 50",
)

write(
    "01_立题与路线",
    page(
        "系统立题：本机 9 款 AI 产品统一接入与跨产品协同",
        "9 款产品 · 1,882 条会话 · 132 个能力单元 · 26 个已完成目标 ｜ 复用各家客户端最高缓存率与 42 条独家功能",
        [
            p01_stats,
            box(
                [
                    p01_col(
                        "路线 01",
                        "代码框架调裸接口（如 LangGraph）",
                        "什么都要手写 · 仅适固定流程",
                        290,
                        "#94A3B8",
                        [
                            p01_item_block(
                                CRIMSON,
                                "裸接口缺原厂高缓存与低价",
                                [("无客户端缓存", "缺原厂最高命中"), ("无套餐补贴", "长上下文成本高")],
                            ),
                            p01_item_block(
                                CRIMSON,
                                "底层轮子全靠自己手写",
                                [("手写底层轮子", "沙箱/补丁/工具"), ("写死状态机", "LangGraph/AutoGen")],
                            ),
                            p01_item_block(
                                CRIMSON,
                                "多端会话割裂与改流程难",
                                [("会话日志割裂", "各工具各自建库"), ("探索改拓扑难", "改流程需重写代码")],
                            ),
                        ],
                        "缺高缓存率 · 重复造轮子 · 仅适固定流程",
                        False,
                        None,
                        False,
                    ),
                    p01_col(
                        "路线 02",
                        "成品客户端单窗（如 Codex/Claude）",
                        "高缓存与独家功能 · 困在单窗",
                        310,
                        "#94A3B8",
                        [
                            p01_item_block(
                                GREEN,
                                "自家应用享最高最强缓存率",
                                [("最高缓存命中", "如 Codex / Claude"), ("官方套餐补贴", "实际成本极便宜")],
                            ),
                            p01_item_block(
                                COBALT,
                                "含 42 条独家功能与个人渠道",
                                [("42条独家功能", "闭源Skill/知识库"), ("个人功能渠道", "邮箱/飞书连接器")],
                            ),
                            p01_item_block(
                                WARM_AMBER,
                                "锁在单窗且逆向反代违规",
                                [("单窗信息孤岛", "各存各的难协同"), ("逆向反代封号", "丢高缓存与生态")],
                            ),
                        ],
                        "享最高缓存与独家功能 · 锁单窗难协同",
                        False,
                        None,
                        True,
                    ),
                    p01_col(
                        "路线 03 · 本系统",
                        "三路接入 + 中心自动派活 + 借别家所长",
                        "9 款产品组队 + 拓展固定流程",
                        540,
                        AMBER,
                        [
                            p01_item_block(
                                COBALT,
                                "保留原厂最高缓存率 + 借别家所长派活",
                                [("100% 原生缓存", "直驱官方客户端"), ("42条独家功能", "操作电脑/深研"), ("邮箱/飞书渠道", "基础/共享/专属")],
                            ),
                            p01_item_block(
                                COBALT,
                                "中心自动挑人派活 + 异构验收 + 额度排队",
                                [("自动挑人换人", "按负载挑·超时换"), ("另一家AI验收", "7m交回·35s验收"), ("额度撞线排队", "4家共用等恢复")],
                            ),
                            p01_item_block(
                                WARM_AMBER,
                                "粗粒度灵活探索 + 沉淀拓展固定工作流",
                                [("MD 契约探索", "零代码秒改拓扑"), ("成熟路径固化", "抽为标准任务链"), ("拓展固定工作流", "兼顾确定性执行")],
                            ),
                        ],
                        "把 9 款本机产品变成能分工、能互相验收、能拓展固定流程的团队",
                        True,
                        "gpt_p13_hub_glass_layers.png",
                        True,
                    ),
                ],
                "marginTop: 6, flexDirection: 'row', gap: 12, height: 370",
            ),
        ],
        "直接驱动 9 款本机产品复用原厂最高缓存率与 42 条独家功能，由中心自动挑人派活、异构验收并支持拓展固定工作流。",
    ),
)

# ==============================================================================
# 正片 P2: 能力与渠道体系（132 个能力单元 + 4家共用账号额度排队 + 借别家所长 + 跨压缩回看历史）
# ==============================================================================
p02_left = box(
    [
        box(
            [
                T("双层能力渠道：额度自动排队与借别家所长", 13.8, COBALT, True),
                tag("42 条独家功能已登记", WARM_AMBER, "#FEF3C7"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                mini_chip("智能体 = 模型+工具口", "上下文口读 · 工具口写", COBALT, "#EEF2FF", "#C7D2FE", 1),
                box([T("↔", 12, WARM_AMBER, True)], "width: 12, alignItems: 'center', justifyContent: 'center'"),
                mini_chip("双层能力渠道", "运行载体 + 6 类调用能力", WARM_AMBER, "#FFFBEB", "#FDE68A", 1),
                box([T("↔", 12, COBALT, True)], "width: 12, alignItems: 'center', justifyContent: 'center'"),
                mini_chip("三类 × 三范围信息", "说明/内容/状态·黑板/私有", NAVY, "#F8FAFC", "#CBD5E1", 1),
            ],
            "flexDirection: 'row', alignItems: 'stretch'",
        ),
        box(
            [
                box(
                    [T("① 运行载体与共用账号额度自动排队（10-19 实测）", 12.2, COBALT, True), tag("不算任务失败", COBALT, "#EEF2FF")],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
                ),
                sub_row(
                    "三类供给源",
                    box(
                        [
                            mini_chip("30+ 模型池", "按专长自动路由", COBALT, "#F8FAFC"),
                            mini_chip("原厂客户端 OAuth", "享最高缓存与补贴", GREEN, "#ECFDF5"),
                            mini_chip("API 中转站", "多站冗余兜底", COBALT, "#F8FAFC"),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 4",
                    ),
                    COBALT,
                    70,
                ),
                sub_row(
                    "额度排队",
                    flow_strip(
                        ["4家共用智谱", "一家撞上限", "同步等至18:08", "原因记入轨迹"],
                        WARM_AMBER,
                        "#FFFBEB",
                        "#FDE68A",
                    ),
                    WARM_AMBER,
                    70,
                ),
            ],
            "background: '#FFFFFF', borderLeft: '3.5px solid #3730A3', borderRadius: 4, padding: '6px 8px', flexDirection: 'column'",
        ),
        box(
            [
                box(
                    [T("② 借别家所长：四大高阶能力与 42 条独家功能路由", 12.2, WARM_AMBER, True), tag("按最强产品派活", WARM_AMBER, "#FEF3C7")],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
                ),
                box(
                    [
                        mini_chip("操作电脑", "桌面界面理解操控", WARM_AMBER, "#FFFFFF"),
                        mini_chip("网页浏览器", "OpenCLI 160+站", COBALT, "#FFFFFF"),
                        mini_chip("联网搜索", "22把Key自动轮换", COBALT, "#FFFFFF"),
                        mini_chip("深度调研", "多源查证·60份报告", GREEN, "#FFFFFF"),
                    ],
                    "flexDirection: 'row', gap: 4, marginTop: 4",
                ),
                box(
                    [
                        mini_chip("42 条各家自登记独家功能", "记录开放程度/积分倍率/定时任务", WARM_AMBER, "#FFFFFF"),
                        mini_chip("个人与递归连接器", "邮箱/飞书 + 把别家AI当工具调", GREEN, "#FFFFFF"),
                    ],
                    "flexDirection: 'row', gap: 4, marginTop: 4",
                ),
            ],
            "background: '#FFFBEB', borderLeft: '3.5px solid #D97706', borderRadius: 4, padding: '6px 8px', flexDirection: 'column'",
        ),
        box(
            [
                T("③ 渠道三层分域管理 × 自动排障恢复链", 12.0, GREEN, True),
                sub_row(
                    "三层分域",
                    box(
                        [
                            inline_chip("基础能力", "零门槛", COBALT, "#FFFFFF"),
                            inline_chip("共享渠道", "租约锁排队", WARM_AMBER, "#FFFFFF"),
                            inline_chip("专属/个人", "权限隔离", GREEN, "#FFFFFF"),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 4",
                    ),
                    GREEN,
                    62,
                ),
                sub_row(
                    "自动排障",
                    flow_strip(["健康探测", "自动熔断", "维护排障", "恢复上线"], GREEN, "#FFFFFF"),
                    GREEN,
                    62,
                ),
            ],
            "background: '#ECFDF5', borderLeft: '3.5px solid #047857', borderRadius: 4, padding: '5px 8px', flexDirection: 'column'",
        ),
    ],
    "width: 486, background: '#F8FAFC', borderTop: '3.5px solid #3730A3', borderRadius: 5, padding: '7px 9px', flexDirection: 'column', justifyContent: 'space-between'",
)


def p02_struct_card(badge_txt, title, sub_stat, sub_rows, col=COBALT):
    return box(
        [
            box(
                [
                    box(
                        [
                            box([T(badge_txt, 11.5, WHITE, True)], "background: '%s', borderRadius: 3, padding: '1px 6px'" % col),
                            T(title, 13.0, col, True, extra="marginLeft: 7"),
                        ],
                        "flexDirection: 'row', alignItems: 'center'",
                    ),
                    tag(sub_stat, col, "#EEF2FF" if col == COBALT else ("#FEF3C7" if col == WARM_AMBER else "#ECFDF5")),
                ],
                "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1px solid #E2E8F0'",
            ),
            box(sub_rows, "flexDirection: 'column'"),
        ],
        "background: '#FFFFFF', borderLeft: '4px solid %s', borderRadius: 4, padding: '6px 10px', flexDirection: 'column'" % col,
    )


p02_right = box(
    [
        box(
            [
                T("132 个能力单元矩阵（82 项功能 + 50 项显示与交互）", 13.8, COBALT, True),
                tag("7 家 × 4 位置状态在册", COBALT, "#EEF2FF"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        p02_struct_card(
            "A",
            "会话生命周期与跨压缩回看历史（recall-history）",
            "实测第 17 轮取回第 1 轮原话",
            [
                sub_row(
                    "会话控制",
                    box(
                        [
                            mini_chip("新建会话", "open 只建不跑", COBALT),
                            mini_chip("恢复续跑", "resume 续接", COBALT),
                            mini_chip("原生接管", "native 终端", COBALT),
                            mini_chip("打断归档", "cancel/close", SLATE),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 5",
                    ),
                    COBALT,
                    68,
                ),
                sub_row(
                    "回看历史",
                    box(
                        [
                            mini_chip("跨压缩翻回全部原话", "一条命令翻回被压缩掉的对话", WARM_AMBER, "#FFFBEB", "#FDE68A", 1.2),
                            mini_chip("OpenCode 17 轮实测", "第 17 轮准确取回第 1 轮原话", GREEN, "#ECFDF5", "#A7F3D0", 1.2),
                            mini_chip("实况流跟随", "observe-live", COBALT, "#F8FAFC", "#CBD5E1", 0.8),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 5",
                    ),
                    WARM_AMBER,
                    68,
                ),
                sub_row(
                    "五态归属",
                    box(
                        [
                            inline_chip("● 我们管", "", COBALT, "#EEF2FF"),
                            inline_chip("● 应用管", "", COBALT, "#F8FAFC"),
                            inline_chip("● 人在终端", "", WARM_AMBER, "#FFFBEB"),
                            inline_chip("● 已放手", "", GREEN, "#ECFDF5"),
                            inline_chip("○ 未知态", "", SLATE, "#F1F5F9"),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 4",
                    ),
                    COBALT,
                    68,
                ),
            ],
            COBALT,
        ),
        p02_struct_card(
            "B",
            "运行中半路插话、写文件挂起审批与环境配置",
            "四级送话 + 5 家挂起全通",
            [
                sub_row(
                    "四级送话",
                    flow_strip(["① 轮内插话 steer", "② 排下一轮队列", "③ 工具结果捎带", "④ 收件箱+唤醒注入"], WARM_AMBER, "#FFFBEB", "＞"),
                    WARM_AMBER,
                    68,
                ),
                sub_row(
                    "受控干预",
                    box(
                        [
                            mini_chip("写文件前挂起审批", "手机/CLI 放行续写", WARM_AMBER, "#FFFBEB"),
                            mini_chip("单步就地回退", "rewind 撤销错误步", COBALT),
                            mini_chip("会话快照分叉", "fork 换路重跑", COBALT),
                            mini_chip("主动压缩上下文", "compact 省开销", GREEN),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 5",
                    ),
                    WARM_AMBER,
                    68,
                ),
                sub_row(
                    "新建配置",
                    box(
                        [
                            inline_chip("挂接工具", "mount", COBALT),
                            inline_chip("角色卡", "prompt", COBALT),
                            inline_chip("隔离目录", "cwd", COBALT),
                            inline_chip("切模回滚锁", "防切模污染", WARM_AMBER),
                            inline_chip("熔断守卫", "guard", CRIMSON),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 4",
                    ),
                    WARM_AMBER,
                    68,
                ),
            ],
            WARM_AMBER,
        ),
        p02_struct_card(
            "C",
            "智能体主动上行 4 动作 × 中心保管 5 类唤醒",
            "等待可见 + 中心触发恢复",
            [
                sub_row(
                    "主动上行",
                    box(
                        [
                            mini_chip("交付产出", "deliver", GREEN, "#ECFDF5"),
                            mini_chip("提问/请求", "ask / request", WARM_AMBER, "#FFFBEB"),
                            mini_chip("声明让出", "yield 等条件", COBALT),
                            mini_chip("进度上报", "report", COBALT),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 5",
                    ),
                    GREEN,
                    68,
                ),
                sub_row(
                    "中心唤醒",
                    box(
                        [
                            inline_chip("慢任务完成", "bg", GREEN),
                            inline_chip("定时触发", "timer", GREEN),
                            inline_chip("新消息到达", "msg", COBALT),
                            inline_chip("卡住巡检", "stall", WARM_AMBER),
                            inline_chip("重启恢复", "persist", COBALT),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 4",
                    ),
                    GREEN,
                    68,
                ),
                sub_row(
                    "50项交互",
                    box(
                        [
                            inline_chip("跨家待处理流", "attention-feed", WARM_AMBER, "#FFFBEB"),
                            inline_chip("四类结构卡片", "思考/工具/Diff", COBALT),
                            inline_chip("多端实时同步", "桌面↔手机", GREEN),
                        ],
                        "flex: 1, flexDirection: 'row', gap: 5",
                    ),
                    GREEN,
                    68,
                ),
            ],
            GREEN,
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '3.5px solid #D97706', borderRadius: 5, padding: '7px 10px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "02_能力单元与渠道体系",
    page(
        "能力渠道：132 个能力单元矩阵、额度排队与借别家所长",
        "82 项功能 + 50 项显示交互 ｜ 4 家共用智谱账号撞上限自动排队至 18:08 ｜ 42 条独家功能与跨压缩回看原话",
        [
            box(
                [p02_left, p02_right],
                "marginTop: 8, flexDirection: 'row', gap: 12, height: 426",
            )
        ],
        "登记 42 条各家独家功能与四大高阶能力路由，支持 4 家共用账号撞上限自动排队至 18:08，并实测在第 17 轮跨压缩取回第 1 轮原话。",
    ),
)

# ==============================================================================
# 正片 P3 (03_协作拓扑与契约编排): 任务调度、自动挑人派活、异构验收与复合拓扑
# 融合 10-19 真实故事（Codex 7分钟交回+Claude 35秒验收、超时自动换人、已完成26个目标）+ 7个微拓扑图 + 3项【规划中】
# ==============================================================================
def topo_prim_card(title, sub, img_name, accent=COBALT, bg="#F8FAFC", bd="#CBD5E1"):
    return box(
        [
            box(
                [T(title, 11.6, accent, True), T(sub, 11.5, SLATE)],
                "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
            ),
            box(
                [img(img_name, 102, 34)],
                "marginTop: 2, alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 3, padding: '1px 0', border: '1px solid #E2E8F0'",
            ),
        ],
        "flex: 1, background: '%s', border: '1px solid %s', borderTop: '2.5px solid %s', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'"
        % (bg, bd, accent),
    )


def topo_comp_row(title, badge_txt, img_name, steps, accent=WARM_AMBER, bg="#FFFBEB", bd="#FDE68A"):
    return box(
        [
            box(
                [
                    T(title, 11.6, accent, True),
                    box(
                        [img(img_name, 114, 28)],
                        "marginTop: 2, alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 3, padding: '1px 0', border: '1px solid #E2E8F0'",
                    ),
                ],
                "width: 148, flexDirection: 'column', justifyContent: 'center'",
            ),
            box(
                [
                    flow_strip(steps, accent, bg, bd),
                    box(
                        [T(badge_txt, 11.5, SLATE, True)],
                        "marginTop: 2, flexDirection: 'row', alignItems: 'center'",
                    ),
                ],
                "flex: 1, marginLeft: 8, flexDirection: 'column', justifyContent: 'center'",
            ),
        ],
        "background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3.5px solid %s', borderRadius: 4, padding: '3px 8px', flexDirection: 'row', alignItems: 'center'"
        % accent,
    )


p03_left = box(
    [
        box(
            [
                T("多智能体协作拓扑：五种基本形状与三种常用组合模式", 13.6, COBALT, True),
                tag("基本形状 × 组合模式", COBALT, "#EEF2FF"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        # 模块 ①：五种基本形状与每步 3 个决定
        box(
            [
                box(
                    [
                        T("① 五种基本协作形状与每步 3 个决定", 12.2, COBALT, True),
                        tag("最小单元：一轮问答", COBALT, "#EEF2FF"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1.5px solid #3730A3'",
                ),
                box(
                    [
                        topo_prim_card("串行接力", "A→B→C", "topo_prim_1_relay.png", COBALT, "#EEF2FF", "#C7D2FE"),
                        topo_prim_card("一对多分发", "Fan-out", "topo_prim_2_fanout.png", COBALT, "#EEF2FF", "#C7D2FE"),
                        topo_prim_card("多对一汇总", "Fan-in", "topo_prim_3_fanin.png", COBALT, "#EEF2FF", "#C7D2FE"),
                        topo_prim_card("双人往返", "A↔B", "topo_prim_4_loop.png", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                    ],
                    "flexDirection: 'row', gap: 6, marginTop: 5",
                ),
                box(
                    [
                        sub_row(
                            "第5种形状",
                            [
                                inline_chip("共享黑板 / 消息池", "单写者锁 + 事件触发唤醒（免轮询等待）", GREEN, "#ECFDF5", "#A7F3D0"),
                            ],
                            GREEN,
                            64,
                        ),
                        sub_row(
                            "每步3决定",
                            [
                                inline_chip("选谁", "按健康与强项挑人", COBALT, "#EEF2FF", "#C7D2FE"),
                                inline_chip("给啥", "四件套路径指针", COBALT, "#F8FAFC", "#CBD5E1"),
                                inline_chip("停不停", "独立验收与限次", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                            ],
                            COBALT,
                            64,
                        ),
                    ],
                    "flexDirection: 'column', gap: 3, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 4, padding: '6px 9px', flexDirection: 'column'",
        ),
        # 模块 ②：三种常用组合模式（深层机制见补充页 B4）
        box(
            [
                box(
                    [
                        T("② 三种高阶组合模式（由基本形状拼装 · 深层机制见补充 B4）", 12.2, WARM_AMBER, True),
                        tag("3 种高阶组合", WARM_AMBER, "#FEF3C7"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1.5px solid #D97706'",
                ),
                box(
                    [
                        topo_comp_row(
                            "层级状态板+异构验收",
                            "本地任务状态板领活回填 · 做与验分属不同 AI 家族，超时换人",
                            "topo_comp_2_dag.png",
                            ["主控写规范", "状态板认领", "完成回填", "换家验收"],
                            COBALT,
                            "#EEF2FF",
                            "#C7D2FE",
                        ),
                        topo_comp_row(
                            "多路盲跑+交叉合议",
                            "首轮互不可见防顺从附和 · 次轮只对分歧举证收敛",
                            "topo_comp_1_debate.png",
                            ["各自盲跑", "汇总分歧", "交叉核实", "裁判合议"],
                            WARM_AMBER,
                            "#FFFBEB",
                            "#FDE68A",
                        ),
                        topo_comp_row(
                            "角色常驻+交接接力",
                            "上下文满 60% 换新会话 · 传文件路径指针不拷长聊天",
                            "topo_comp_3_relay.png",
                            ["写交接包", "落盘指针", "满额换新", "读盘续跑"],
                            GREEN,
                            "#ECFDF5",
                            "#A7F3D0",
                        ),
                    ],
                    "flexDirection: 'column', gap: 5, marginTop: 5",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #D97706', borderRadius: 4, padding: '6px 9px', flexDirection: 'column'",
        ),
    ],
    "width: 584, background: '#EEF2FF', borderTop: '3.5px solid #3730A3', borderRadius: 5, padding: '7px 10px', flexDirection: 'column', justifyContent: 'space-between'",
)

p03_right = box(
    [
        box(
            [
                T("10-19 自动调度实证、本地状态板协同与可配置自治功能", 13.6, WARM_AMBER, True),
                tag("真跑实证 × 状态板协同", WARM_AMBER, "#FEF3C7"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        # 右 ①：10-19 自动调度与异构验收真实案例
        box(
            [
                box(
                    [
                        T("① 10-19 真实案例：中心自动派活、异构验收与超时换人", 12.2, COBALT, True),
                        tag("已完成 26 个目标", COBALT, "#EEF2FF"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1.5px solid #3730A3'",
                ),
                box(
                    [
                        mini_chip("26 个目标", "中心调度已完成", COBALT, "#EEF2FF", "#C7D2FE"),
                        mini_chip("7 分钟交回", "Codex 独立完成研究", COBALT, "#EEF2FF", "#C7D2FE"),
                        mini_chip("35 秒验收", "换 Claude 异构复核", GREEN, "#ECFDF5", "#A7F3D0"),
                        mini_chip("自动换人", "Codex 超时换 Claude", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                    ],
                    "flexDirection: 'row', gap: 5, marginTop: 4",
                ),
                box(
                    [
                        sub_row(
                            "实跑过程",
                            [
                                flow_strip(
                                    ["研究拆给两家", "Codex 7m交回", "Claude 35s验", "超时换人重做"],
                                    COBALT,
                                    "#F8FAFC",
                                    "#CBD5E1",
                                )
                            ],
                            COBALT,
                            62,
                        ),
                    ],
                    "marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 4, padding: '5px 9px', flexDirection: 'column'",
        ),
        # 右 ②：层级协作与本地状态板机制（写规范 -> 认领任务 -> 完成回填 -> 渐进固化）
        box(
            [
                box(
                    [
                        T("② 层级协作与本地状态板机制：写规范 · 认领任务 · 完成回填", 12.2, WARM_AMBER, True),
                        tag("状态板认领 × 渐进固化", WARM_AMBER, "#FEF3C7"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1.5px solid #D97706'",
                ),
                box(
                    [
                        sub_row(
                            "状态板流",
                            [
                                mini_chip("① 主控写规范", "定边界与验收标准", COBALT, "#EEF2FF", "#C7D2FE"),
                                mini_chip("② 状态板认领", "按锁领活防冲突重做", COBALT, "#EEF2FF", "#C7D2FE"),
                                mini_chip("③ 完成回填路径", "写回状态与产物指针", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                            ],
                            COBALT,
                            58,
                        ),
                        sub_row(
                            "四层文档",
                            [
                                mini_chip("全局规范", "CLAUDE.md", COBALT, "#F8FAFC", "#CBD5E1"),
                                mini_chip("角色职责", "agents/*.md", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                                mini_chip("领域技能", "SKILL.md", COBALT, "#F8FAFC", "#CBD5E1"),
                                mini_chip("任务状态板", "TASK / JSON", GREEN, "#ECFDF5", "#A7F3D0"),
                            ],
                            WARM_AMBER,
                            58,
                        ),
                        sub_row(
                            "渐进固化",
                            [
                                mini_chip("① 探索期：文档协作", "状态板灵活改", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                                T("➔", 12.0, GREEN, True),
                                mini_chip("② 收敛期：标准模板", "跑通路径抽模板", COBALT, "#EEF2FF", "#C7D2FE"),
                                T("➔", 12.0, GREEN, True),
                                mini_chip("③ 成熟期：固定脚本", "高频链路代码化", GREEN, "#ECFDF5", "#A7F3D0"),
                            ],
                            GREEN,
                            58,
                        ),
                    ],
                    "flexDirection: 'column', gap: 3, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #D97706', borderRadius: 4, padding: '5px 9px', flexDirection: 'column'",
        ),
        # 右 ③：可配置调度与研究自治功能
        box(
            [
                box(
                    [
                        T("③ 可配置调度与研究自治功能（按任务场景灵活开关）", 12.2, GREEN, True),
                        tag("可配置自治功能", GREEN, "#ECFDF5"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1.5px solid #047857'",
                ),
                box(
                    [
                        mini_chip("目标拆解模式可配", "支持人工拆单或中心自动拆解", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        mini_chip("夜间闲时排程可配", "晚间自动排入大研究与测试", COBALT, "#EEF2FF", "#C7D2FE"),
                        mini_chip("常驻路线研究员可配", "各路线配研究员并自动攒经验", GREEN, "#ECFDF5", "#A7F3D0"),
                    ],
                    "flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #047857', borderRadius: 4, padding: '5px 9px', flexDirection: 'column'",
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '3.5px solid #D97706', borderRadius: 5, padding: '7px 10px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "03_协作拓扑与契约编排",
    page(
        "任务调度：协作拓扑组合、本地状态板认领与异构验收",
        "5 种基本形状 × 3 种高阶组合 ｜ 本地状态板（写规范 · 认领任务 · 完成回填） ｜ 26 个目标实证与可配置自治",
        [
            box(
                [p03_left, p03_right],
                "marginTop: 8, flexDirection: 'row', gap: 12, height: 426",
            )
        ],
        "以 5 种基本形状拼出层级状态板、多路盲跑合议与跨轮接力，靠「写规范→状态板认领→完成回填→异构验收」跑通 26 个目标。",
    ),
)

# ==============================================================================
# 正片 P4 (04_跨产品接入与宿主分工): 能力地图、9 款产品多路融合跃升与桌面操控集成
# ==============================================================================
def p04_host_row(col1, col2, col3, col4, bg=WHITE, is_hdr=False, accent=INK):
    fw = True if is_hdr else False
    fc = WHITE if is_hdr else INK
    fc1 = WHITE if is_hdr else accent
    fs = 11.6 if is_hdr else 11.5
    pad = "5px 7px" if is_hdr else "4px 7px"
    return box(
        [
            box([T(col1, fs, fc1, True)], "width: 154"),
            box([T(col2, fs, fc, fw)], "width: 214"),
            box([T(col3, fs, fc1 if not is_hdr else WHITE, True)], "width: 142"),
            box([T(col4, fs, fc, fw)], "flex: 1"),
        ],
        "flexDirection: 'row', alignItems: 'center', background: '%s', padding: '%s', borderBottom: '1px solid #E2E8F0'" % (bg, pad),
    )


p04_left = box(
    [
        T("自报探查三级证据 SOP、三路互补与桌面操控网关", 13.6, COBALT, True),
        # 1. 生态自报探查 SOP 与三级证据分层（看到接口 ≠ 试过行为）
        box(
            [
                box(
                    [T("1. 生态自报探查 SOP 与三级证据分层", 12.2, COBALT, True), tag("42 条独家功能入表", COBALT, "#EEF2FF")],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1px solid #E2E8F0'",
                ),
                box(
                    [
                        mini_chip("自报提示词显式分层", "区分「推测 / 看到接口 / 试过」", COBALT, "#EEF2FF", "#C7D2FE"),
                        T("➔", 13.0, WARM_AMBER, True),
                        mini_chip("真机行为验证入表", "跑通探针留证据标「实测通」", GREEN, "#ECFDF5", "#A7F3D0"),
                    ],
                    "flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4",
                ),
                box(
                    [
                        mini_chip("各家登记 42 条独家功能", "含开放程度·实现路径·成本倍率", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        mini_chip("四张配置表自动核对", "能力·记录·路线·动作实时对齐", COBALT, "#EEF2FF", "#C7D2FE"),
                    ],
                    "flexDirection: 'row', gap: 5, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 4, padding: '6px 9px', flexDirection: 'column'",
        ),
        # 2. 三大接入家族互补（破除单接口 11%-28% 残缺）
        box(
            [
                box(
                    [T("2. 三大接入路线互补（破除单口 11%–28% 残缺）", 12.2, WARM_AMBER, True), tag("三路互补汇合", WARM_AMBER, "#FEF3C7")],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1px solid #E2E8F0'",
                ),
                box(
                    [
                        sub_row(
                            "官方协议",
                            [
                                inline_chip("Codex", "app-srv", COBALT, "#EEF2FF", "#C7D2FE"),
                                inline_chip("Claude", "stream", COBALT, "#EEF2FF", "#C7D2FE"),
                                inline_chip("AGY", "332接口", COBALT, "#EEF2FF", "#C7D2FE"),
                            ],
                            COBALT,
                            56,
                        ),
                        sub_row(
                            "常驻桥接",
                            [
                                inline_chip("ZCode", "ACP桥", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                                inline_chip("WB/OC", "ACP桥", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                                inline_chip("豆包", "CDP9225", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                            ],
                            WARM_AMBER,
                            56,
                        ),
                        sub_row(
                            "会话直读",
                            [
                                inline_chip("SQLite", "无锁读", GREEN, "#ECFDF5", "#A7F3D0"),
                                inline_chip("JSONL", "实时读", GREEN, "#ECFDF5", "#A7F3D0"),
                                inline_chip("1882条", "9款通", GREEN, "#ECFDF5", "#A7F3D0"),
                            ],
                            GREEN,
                            56,
                        ),
                    ],
                    "flexDirection: 'column', gap: 3, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #D97706', borderRadius: 4, padding: '6px 9px', flexDirection: 'column'",
        ),
        # 3. 共享工具网关与多项 Computer Use / GUI Use 集成
        box(
            [
                box(
                    [T("3. 共享工具网关与多项 Computer / GUI Use 集成", 12.2, GREEN, True), tag("多路桌面操控", GREEN, "#ECFDF5")],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1px solid #E2E8F0'",
                ),
                box(
                    [
                        mini_chip("30+ 模型与 22 把搜索 Key", "Tavily/Serp/Exa 轮换", GREEN, "#ECFDF5", "#A7F3D0"),
                        mini_chip("OpenCLI 160+ 站与无头 CDP", "0.5s 拉起·零锁克隆登录态", COBALT, "#EEF2FF", "#C7D2FE"),
                    ],
                    "flexDirection: 'row', gap: 5, marginTop: 4",
                ),
                box(
                    [
                        mini_chip("UIA 控件树 (cua-driver)", "无焦点读取控件与语义点击", COBALT, "#EEF2FF", "#C7D2FE"),
                        mini_chip("豆包电脑模式+PiP虚拟桌面", "影子会话+视觉 GUI Agent", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                    ],
                    "flexDirection: 'row', gap: 5, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #047857', borderRadius: 4, padding: '6px 9px', flexDirection: 'column'",
        ),
    ],
    "width: 424, background: '#EEF2FF', borderTop: '3.5px solid #3730A3', borderRadius: 5, padding: '8px 10px', flexDirection: 'column', justifyContent: 'space-between'",
)

p04_right = box(
    [
        box(
            [
                T("9 款本机 AI 产品多路融合跃升与专长分工对账（表 1）", 13.8, COBALT, True),
                tag("1,882 条会话 · 实时生成", WARM_AMBER, "#FEF3C7"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                p04_host_row("本机产品 (会话数)", "多路互补接入（协议 + 会话库）", "单口 ➔ 多路融合", "核心专长与系统内分工角色", NAVY, True),
                p04_host_row("Claude Code (520)", "stream-json 双向流 + JSONL 直读", "22% ➔ 68% (+6独家)", "主力架构重构、长程推理、35秒异构独立验收", WHITE, False, COBALT),
                p04_host_row("OpenAI Codex (280)", "app-server(31项)+CLI(16%)+ACP", "16% ➔ 66% (+6独家)", "沙箱受控执行、轮内实时插话、7分钟快速交回", "#F8FAFC", False, COBALT),
                p04_host_row("Antigravity (110)", "Connect-RPC(332口)+agentapi+库", "18% ➔ 59% (+5独家)", "多模态百万长上下文、内置浏览器与子智能体协同", WHITE, False, COBALT),
                p04_host_row("ZCode / WB (664)", "常驻 ACP 桥 + 本地会话库直读", "28% ➔ 60% (+17独家)", "日常调研与回归主力、验收级文档、283个连接器与远控", "#FFFBEB", False, WARM_AMBER),
                p04_host_row("OpenCode/Hermes(272)", "常驻 ACP 桥 + 本地 HTTP 共享服务", "21% ➔ 56% (+8独家)", "第17轮跨压缩取回第1轮原话、轻量并发巡检与独立复算", WHITE, False, GREEN),
                p04_host_row("Gemini / Droid (36)", "本地 JSON/JSONL 零侵入直读", "100% 原始记录对数", "历史会话全文检索、跨工具经验提炼与决策链逆向复原", "#F8FAFC", False, SLATE),
            ],
            "borderRadius: 4, overflow: 'hidden', border: '1px solid #CBD5E1', marginTop: 2",
        ),
        box(
            [
                box(
                    [
                        T("132 个能力单元（82 项功能 + 50 项显示交互）× 7 家 × 4 个位置协同矩阵", 11.6, NAVY, True),
                        tag("跨产品协同补齐", WARM_AMBER, "#FEF3C7"),
                    ],
                    "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
                ),
                box(
                    [
                        mini_chip("位置① 产品本体", "盘清上限+42条独家", SLATE, "#F8FAFC", "#CBD5E1"),
                        T("➔", 12.0, WARM_AMBER, True),
                        mini_chip("位置② 原生接口", "9类入口 ≥191项暴露", COBALT, "#EEF2FF", "#C7D2FE"),
                        T("➔", 12.0, WARM_AMBER, True),
                        mini_chip("路线 协议/ACP/GUI", "三路互补+桌面操控", COBALT, "#EEF2FF", "#C7D2FE"),
                        T("➔", 12.0, WARM_AMBER, True),
                        mini_chip("位置③ 中心后端", "283项·群组补齐89项", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        T("➔", 12.0, WARM_AMBER, True),
                        mini_chip("位置④ 网页与手机", "50项对数·126项控", GREEN, "#ECFDF5", "#A7F3D0"),
                    ],
                    "flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4",
                ),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #D97706', borderRadius: 4, padding: '5px 8px', flexDirection: 'column', marginTop: 2",
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '3.5px solid #D97706', borderRadius: 5, padding: '8px 12px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "04_跨产品接入与宿主分工",
    page(
        "能力地图：9 款产品多路融合跃升与桌面操控网关",
        "7 家可驱动 + 2 家只读（1,882 条会话） ｜ 单口 11%–28% 跃升至多路 56%–68%（+42 条独家） ｜ 集成多项 Computer / GUI Use",
        [
            box(
                [p04_left, p04_right],
                "marginTop: 8, flexDirection: 'row', gap: 12, height: 426",
            )
        ],
        "通过协议+ACP+会话库+Computer/GUI Use 多路融合，将单口 11%–28% 残缺覆盖跃升至 56%–68% 并登记 42 条独家能力。",
    ),
)

# ==============================================================================
# 正片 P5 (05_轨迹追溯与受控恢复): 质量对数、三层轨迹追溯与误删自动恢复
# 融合 10-19 真实故事（回归脚本逐条对数查出 5 处隐藏问题 + 共享记录 2600 行被改剩 18 行后 1 分钟自动恢复 + 1882 条会话 L0/L1/L2 追溯）
# ==============================================================================
def spine_card_step(badge_lbl, title, sub_tag, body_nodes, col=COBALT, has_connector=True):
    conn = (
        [box([], "width: 3, height: 18, background: '#CBD5E1', marginTop: 2")]
        if has_connector
        else []
    )
    bg_tag = "#EEF2FF" if col == COBALT else ("#FEF3C7" if col == WARM_AMBER else "#F1F5F9")
    return box(
        [
            box(
                [
                    box(
                        [T(badge_lbl, 11.8, WHITE, True)],
                        "width: 36, height: 22, borderRadius: 4, background: '%s', alignItems: 'center', justifyContent: 'center'" % col,
                    )
                ]
                + conn,
                "width: 40, alignItems: 'center', flexDirection: 'column'",
            ),
            box(
                [
                    box(
                        [T(title, 12.4, col, True), tag(sub_tag, col, bg_tag)],
                        "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2, borderBottom: '1px solid #E2E8F0'",
                    ),
                    box(body_nodes, "flexDirection: 'column', gap: 2, marginTop: 2"),
                ],
                "flex: 1, marginLeft: 7, background: '#F8FAFC', borderLeft: '3.5px solid %s', borderRadius: 4, padding: '4px 8px', flexDirection: 'column'"
                % col,
            ),
        ],
        "flexDirection: 'row', alignItems: 'flex-start', marginTop: 2",
    )


p05_left = box(
    [
        box(
            [
                box(
                    [
                        T("组织拓扑与执行时间轴结合的三层轨迹追溯", 13.8, COBALT, True),
                        T("按轮次与步骤双向锚定，解决单层流水账看不出分支决策原因的难题", 11.5, MUTED, extra="marginTop: 2"),
                    ],
                    "flex: 1, flexDirection: 'column'",
                ),
                img("gpt_p14_trace_microscope.png", 48, 48, "borderRadius: 5"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '2px solid #3730A3'",
        ),
        spine_card_step(
            "L0",
            "组织拓扑层（跨产品全局图与三态对账）",
            "全局空间视图",
            [
                sub_row(
                    "三级粒度",
                    [
                        inline_chip("部门级", "Dept", COBALT, "#EEF2FF", "#C7D2FE"),
                        inline_chip("小组级", "Team", COBALT, "#EEF2FF", "#C7D2FE"),
                        inline_chip("个体级", "Agent", COBALT, "#EEF2FF", "#C7D2FE"),
                        inline_chip("四连线", "派/报/醒", COBALT, "#FFFFFF", "#CBD5E1"),
                    ],
                    COBALT,
                    58,
                ),
                sub_row(
                    "三态对账",
                    [
                        inline_chip("预设契约", "实线基准", SLATE, "#FFFFFF", "#CBD5E1"),
                        inline_chip("实际运行", "虚线叠加", COBALT, "#EEF2FF", "#C7D2FE"),
                        inline_chip("越权通信", "橙色告警", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                    ],
                    COBALT,
                    58,
                ),
            ],
            COBALT,
            True,
        ),
        spine_card_step(
            "L1",
            "粗粒度决策段（多维抽象 · 预定义记录 · 旧会话复原）",
            "预埋记录 × 逆向复原",
            [
                sub_row(
                    "多维抽象",
                    [
                        mini_chip("阶段任务切换", "按里程碑聚合", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        mini_chip("方案路线选型", "按分支理由聚合", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        mini_chip("异常回退纠偏", "按报错改道聚合", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                    ],
                    WARM_AMBER,
                    58,
                ),
                sub_row(
                    "预埋记录",
                    [
                        flow_strip(
                            ["写决策库", "触发原因", "备选方案", "所选路径", "锚定步号"],
                            COBALT,
                            "#EEF2FF",
                            "#C7D2FE",
                        )
                    ],
                    COBALT,
                    58,
                ),
                sub_row(
                    "旧库复原",
                    [
                        inline_chip("存量旧会话", "1,882 条无埋点", GREEN, "#ECFDF5", "#A7F3D0"),
                        inline_chip("逆向复原决策链", "按骨架索引抽取拐点", GREEN, "#ECFDF5", "#A7F3D0"),
                    ],
                    GREEN,
                    58,
                ),
            ],
            WARM_AMBER,
            True,
        ),
        spine_card_step(
            "L2",
            "细粒度轮/步证据层（本机会话库无锁直读）",
            "底层证据锚定",
            [
                sub_row(
                    "一键下钻",
                    [
                        inline_chip("模型思考", "Think", NAVY, "#FFFFFF", "#CBD5E1"),
                        inline_chip("工具入参", "Args", NAVY, "#FFFFFF", "#CBD5E1"),
                        inline_chip("修改补丁", "Diff", WARM_AMBER, "#FFFBEB", "#FDE68A"),
                        inline_chip("退出码", "Exit", GREEN, "#ECFDF5", "#A7F3D0"),
                    ],
                    NAVY,
                    58,
                ),
            ],
            NAVY,
            False,
        ),
        box(
            [
                T("分层阅读：", 11.6, WARM_AMBER, True),
                flow_strip(
                    ["① 读首尾与骨架", "② 定位转折轮次", "③ 按需展开 (省80%上下文)"],
                    WARM_AMBER,
                    "#FFFBEB",
                    "#FDE68A",
                ),
            ],
            "marginTop: 2, background: '#FFFBEB', borderLeft: '4px solid #D97706', padding: '3px 8px', flexDirection: 'row', alignItems: 'center', gap: 4",
        ),
    ],
    "width: 585, background: '#FFFFFF', padding: '2px 8px 2px 2px', flexDirection: 'column', justifyContent: 'space-between'",
)


def p05_stage_card(step_tag, title, flow_steps, chips, verify_line, accent_col=COBALT):
    bg_tag = "#EEF2FF" if accent_col == COBALT else ("#FEF3C7" if accent_col == WARM_AMBER else ("#FEF2F2" if accent_col == CRIMSON else "#ECFDF5"))
    bd_col = "#C7D2FE" if accent_col == COBALT else ("#FDE68A" if accent_col == WARM_AMBER else ("#FECACA" if accent_col == CRIMSON else "#A7F3D0"))
    return box(
        [
            box(
                [T(title, 12.6, accent_col, True), tag(step_tag, accent_col, bg_tag)],
                "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 3, borderBottom: '1px solid #E2E8F0'",
            ),
            box([flow_strip(flow_steps, accent_col, bg_tag, bd_col)], "marginTop: 4"),
            box(chips, "flexDirection: 'row', gap: 5, marginTop: 4"),
            box(
                [T(verify_line, 11.5, accent_col, True)],
                "marginTop: 4, paddingTop: 3, borderTop: '1px dashed #CBD5E1'",
            ),
        ],
        "flex: 1, background: '#F8FAFC', borderLeft: '4px solid %s', borderRadius: 4, padding: '5px 10px', flexDirection: 'column', justifyContent: 'space-between'"
        % accent_col,
    )


p05_right = box(
    [
        box(
            [
                T("10-19 逐条对数、共享记录三层防误删与常驻会话拦截恢复", 13.8, COBALT, True),
                tag("真跑核验 × 自动恢复", COBALT, "#EEF2FF"),
            ],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        p05_stage_card(
            "① 逐条对数核验",
            "回归脚本把 7 家显示内容与原始记录逐条对数（查出 5 处隐藏问题）",
            ["直读原始会话库", "比对网页与手机", "核对工具与思考", "查出 5 处并修复"],
            [
                mini_chip("逐条核对三项指标", "工具调用 · 结果 · 思考字数", COBALT, "#FFFFFF", "#CBD5E1"),
                mini_chip("自述忠实度核验", "decisions 理由 vs 真实 Diff", COBALT, "#FFFFFF", "#CBD5E1"),
            ],
            "10-19 实测：probe_display.mjs 逐条对数查出并修复 5 处之前标“通过”的隐藏问题",
            COBALT,
        ),
        p05_stage_card(
            "② 共享记录保护",
            "防 AI 误删共享记录三层防线（2,600 行被改剩 18 行后 1 分钟恢复）",
            ["2600行被改剩18行", "① 仅中心能写", "② 变短自动恢复", "③ 存私有版本库"],
            [
                mini_chip("1 分钟内自动恢复", "guard.ts 实时监控行数骤降", CRIMSON, "#FFFFFF", "#FECACA"),
                mini_chip("私有版本库留底", "每次改动自动快照防丢失", WARM_AMBER, "#FFFFFF", "#FDE68A"),
            ],
            "10-19 实测：一个 AI 误把 2,600 行实测记录重写成 18 行，三层防线在 1 分钟内自动恢复",
            CRIMSON,
        ),
        p05_stage_card(
            "③ 事中拦截与分叉",
            "写文件前轮内挂起审批、中途插话纠偏与历史快照分叉续跑",
            ["触敏写文件前挂起", "手机/CLI 审批放行", "同轮继续写出", "注入Diff分叉续跑"],
            [
                mini_chip("5 款宿主轮内挂起", "免杀进程原位等待放行", GREEN, "#FFFFFF", "#A7F3D0"),
                mini_chip("历史快照分叉恢复", "任务板熔断 20/20 判定全过", GREEN, "#FFFFFF", "#A7F3D0"),
            ],
            "实测验证：Codex / Claude / ZCode / WB / Hermes 5 款产品写文件前轮内挂起放行全通过",
            GREEN,
        ),
    ],
    "flex: 1, borderLeft: '1px solid #CBD5E1', paddingLeft: 12, flexDirection: 'column', gap: 7, justifyContent: 'space-between'",
)

write(
    "05_轨迹追溯与受控恢复",
    page(
        "质量与安全：逐条对数、三层轨迹追溯与误删自动恢复",
        "L0 拓扑 → L1 决策段 → L2 原始记录（1,882 条会话） ｜ 回归脚本逐条对数查出 5 处隐藏问题 ｜ 误重写 2,600 行 1 分钟自动恢复",
        [
            box(
                [p05_left, p05_right],
                "marginTop: 8, flexDirection: 'row', gap: 12, height: 426",
            )
        ],
        "三层轨迹让 1,882 条会话可追因，回归脚本逐条对数查出 5 处隐藏问题，三层防线在共享记录 2,600 行被改剩 18 行时 1 分钟自动恢复。",
    ),
)

# ==============================================================================
# 正片 P6 (06_实机协同界面): 实机工作台（手机督工台、中心控制台与全景观察台）
# 保持 4 张实机截图在 100 < top < 340 原位，确保 apply_notes.py 零变形原生裁剪自动生效
# ==============================================================================
wb_card_1 = box(
    [
        box(
            [T("① 全景编排与流程对账观察台", 14.0, COBALT, True), tag("6 大部门 · 3 粒度 × 3 状态", COBALT, "#EEF2FF")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("snap_obs_full_light.png", 360, 276, "borderRadius: 4"),
            ],
            "position: 'relative', width: 360, height: 276, background: '#FFFFFF', borderRadius: 4, marginTop: 6, border: '1px solid #E2E8F0'",
        ),
        T("部门/小组/个体三级粒度切换 · 预设契约/实际运行/越权三态对账", 12.0, INK, True, extra="marginTop: 7"),
        T("同屏呈现 6 大部门完整协作拓扑、送达四分外环与底部执行时间轴，点击节点直接下钻 1,882 条会话原始证据", 11.5, MUTED, extra="marginTop: 3, lineHeight: 1.3"),
    ],
    "width: 376, background: '#FFFFFF', borderTop: '3.5px solid #3730A3', padding: '8px 8px', flexDirection: 'column'",
)

wb_card_2 = box(
    [
        box(
            [T("② 跨产品中心控制台与自动巡检", 14.0, COBALT, True), tag("26 个目标 · 跨产品接力", WARM_AMBER, "#FEF3C7")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("snap_console_sup_light.png", 360, 276, "borderRadius: 4"),
            ],
            "width: 360, height: 276, background: '#FFFFFF', borderRadius: 4, marginTop: 6, border: '1px solid #E2E8F0'",
        ),
        T("7 款可驱动宿主健康监控 · 自动挑人派活 · 跨渠道上下文一键接力", 12.0, INK, True, extra="marginTop: 7"),
        T("已完成 26 个目标、60 份研究报告；实时统计自动批准 (19次)、断网续跑 (120次)、额度排队与超时换人重做", 11.5, MUTED, extra="marginTop: 3, lineHeight: 1.3"),
    ],
    "width: 376, background: '#FFFFFF', borderTop: '3.5px solid #1E3A8A', padding: '8px 8px', flexDirection: 'column'",
)

wb_card_3 = box(
    [
        box(
            [T("③ 手机督工台与安全组网远程办公", 14.0, WARM_AMBER, True), tag("Tailscale 组网 · 随地督工", GREEN, "#ECFDF5")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("orig_m1_feed.png", 174, 276, "borderRadius: 4"),
                img("orig_m2_steer.png", 174, 276, "borderRadius: 4"),
            ],
            "width: 360, height: 276, background: '#F8FAFC', borderRadius: 4, padding: '0 4px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, border: '1px solid #E2E8F0'",
        ),
        T("手机上看任意 AI 每一步 · 半路插话 · 批准操作 · 回答提问 · 派活", 12.0, WARM_AMBER, True, extra="marginTop: 7"),
        T("通过 Tailscale 点对点加密组网直连本机（免公网暴露端口），在通勤或差旅任意地方用手机实时督工与放行审批", 11.5, INK, extra="marginTop: 3, lineHeight: 1.3"),
    ],
    "width: 380, background: '#FFFFFF', borderTop: '3.5px solid #D97706', padding: '8px 8px', flexDirection: 'column'",
)

write(
    "06_实机协同界面",
    page(
        "实机工作台：手机督工台、中心控制台与全景观察台",
        "在手机上看任意 AI 每一步、半路插话、批准操作、回答提问、派活 ｜ 已统管 9 款产品、1,882 条会话、26 个目标",
        [
            box(
                [wb_card_1, wb_card_2, wb_card_3],
                "marginTop: 8, flexDirection: 'row', gap: 14, height: 426",
            )
        ],
        "桌面端全景掌控 6 大部门三态拓扑、中心巡检与跨产品接力；手机督工台通过安全组网实现任意地方看每一步、插话、批准、答问与派活。",
    ),
)

# ==============================================================================
# 补充页 B1 (Page 07): 《相比 35+ 开源智能体项目的横向优势对照表》
# ==============================================================================
def b1_row(num, dim, badge_txt, targets, pain_txt, our_txt, evidence_txt):
    return box(
        [
            box(
                [
                    T(num + "  " + dim, 14.0, COBALT, True),
                    tag(badge_txt, WARM_AMBER, "#FEF3C7"),
                ],
                "width: 170, flexDirection: 'column', alignItems: 'flex-start', gap: 6, justifyContent: 'center'",
            ),
            box(
                [
                    T(targets, 12.5, CRIMSON, True),
                    T(pain_txt, 11.8, SLATE, extra="marginTop: 4"),
                ],
                "width: 310, background: '#FFFFFF', borderLeft: '3.5px solid #9D0A12', borderRadius: 4, padding: '8px 12px', flexDirection: 'column', justifyContent: 'center'",
            ),
            box(
                [
                    T(our_txt, 12.5, COBALT, True),
                    T(evidence_txt, 11.8, INK, extra="marginTop: 4"),
                ],
                "flex: 1, background: '#EEF2FF', borderLeft: '3.5px solid #3730A3', borderRadius: 4, padding: '8px 12px', flexDirection: 'column', justifyContent: 'center'",
            ),
        ],
        "flex: 1, background: '#F8FAFC', borderRadius: 6, padding: '8px 14px', flexDirection: 'row', gap: 12, alignItems: 'stretch'",
    )


write(
    "07_补充B1_开源对比",
    page(
        "开源对比：相比 35+ 开源智能体项目的四项优势对照",
        "覆盖四大主流赛道：CLI/协议桥接器（acpx/opencli） · 编排运行时（OpenRig/GasTown） · 代码框架（LangGraph/AutoGen） · 遥测看板（Langfuse/OTel）",
        [
            box(
                [
                    b1_row(
                        "01",
                        "调度与接入面",
                        "多路接入",
                        "vs acpx / opencli / 单协议桥接器",
                        "仅走单一 ACP 协议或单侧网页 UI 适配器，遇单接口能力残缺（如 Codex CLI 仅 16%、ACP 仅 11%）无法互补。",
                        "官方协议 + CDP + 本地适配器三路互补接入",
                        "按 4 个位置多路择优：统管 7 款可驱动宿主 + 2 只读会话库（1,882 条会话）+ 豆包桌面端 (CDP 协议) + OpenCLI 160+ 网页 + 22 把 Key。",
                    ),
                    b1_row(
                        "02",
                        "运行控制与挂起",
                        "会话控制",
                        "vs OpenRig / GasTown / Paperclip",
                        "强绑定 POSIX tmux 终端会话或单次进程盲跑，在 Windows/GUI 宿主上遇写文件权限审批即挂死或断连。",
                        "Windows / GUI 全宿主常驻会话轮内挂起审批 + 额度排队至恢复时刻",
                        "Codex / Claude / ZCode / WB / Hermes 5 款产品实测写文件前轮内挂起放行；4 家共用智谱账号撞上限自动排队至 18:08 恢复。",
                    ),
                    b1_row(
                        "03",
                        "编排演进与验收",
                        "契约编排",
                        "vs LangGraph / AutoGen / CrewAI / MetaGPT",
                        "只调裸模型 API（补丁/沙箱/记忆全靠手写），且用 Python 代码写死 DAG 状态机，改流程慢、缺异构独立验收。",
                        "直接复用成品宿主 + Markdown 渐进式契约 (CLAUDE.md) + 异构独立验收",
                        "免造底层工具轮子；中心自动挑人派活（Codex 7分钟交回、Claude 35秒验收、超时自动换人），已完成 26 个目标与 60 份报告。",
                    ),
                    b1_row(
                        "04",
                        "观测粒度与反向操控",
                        "双层追溯",
                        "vs Langfuse / Arize Phoenix / OpenTelemetry",
                        "仅只读记录单层细粒度 API 调用流水账，既看不出分支决策理由，也无法在发现偏离时反向介入正在跑的会话。",
                        "三层轨迹追溯 + 回归脚本逐条对数 + 共享记录三层防误删",
                        "L0 三态拓扑 → L1 决策段 → L2 1,882 条会话原始记录；逐条对数查出 5 处隐藏问题；2,600 行记录被改剩 18 行后 1 分钟自动恢复。",
                    ),
                ],
                "marginTop: 10, flexDirection: 'column', gap: 10, height: 424",
            )
        ],
        "在多路互补接入、常驻会话挂起与额度排队、自动派活异构验收、逐条对数与 1 分钟防误删恢复四个方向补齐开源断点。",
        True,
    ),
)

# ==============================================================================
# 补充页 B2 (Page 08): 《智能体基本能力单元完整矩阵与会话状态机》
# ==============================================================================
b2_left = box(
    [
        T("四张表单一真源与 4 个位置实测对账（132 个能力单元 = 82 项功能 + 50 项显示交互）", 13.5, COBALT, True),
        box(
            [
                box([T("① capability-units.json", 11.8, COBALT, True), T("82 项功能 + 50 项显示交互定义", 11.5, INK, extra="marginTop: 2")], "flex: 1, background: '#FFFFFF', borderTop: '2.5px solid #3730A3', borderRadius: 4, padding: '6px 8px'"),
                box([T("② blackboard.jsonl", 11.8, WARM_AMBER, True), T("真机探针实测事实（三层防删保护）", 11.5, INK, extra="marginTop: 2")], "flex: 1, background: '#FFFFFF', borderTop: '2.5px solid #D97706', borderRadius: 4, padding: '6px 8px'"),
                box([T("③ integration-map.json", 11.8, COBALT, True), T("45 单元后端路由与前端映射", 11.5, INK, extra="marginTop: 2")], "flex: 1, background: '#FFFFFF', borderTop: '2.5px solid #3730A3', borderRadius: 4, padding: '6px 8px'"),
                box([T("④ actions.json", 11.8, GREEN, True), T("20 / 37 动作已配 CLI 子命令", 11.5, INK, extra="marginTop: 2")], "flex: 1, background: '#FFFFFF', borderTop: '2.5px solid #047857', borderRadius: 4, padding: '6px 8px'"),
            ],
            "flexDirection: 'row', gap: 6, marginTop: 6",
        ),
        box(
            [
                T("按产品单口基线到多路融合实测跃升明细（CAPABILITY_MAP.md，共 1,882 条会话）", 12.5, NAVY, True),
                T("• Claude Code (520)：单口 22% ➔ 多路融合 68%（stream-json + 会话库，登记 6 项独家，35 秒异构验收主力）", 11.5, INK, extra="marginTop: 5"),
                T("• OpenAI Codex (280)：单口 16% ➔ 三路互补 66%（app-server 31 项 + CLI + 会话库，登记 6 项独家）", 11.5, INK, extra="marginTop: 4"),
                T("• Antigravity (110)：单口 18% ➔ 三路互补 59%（Connect-RPC 332 接口 + vscdb，区分「看到接口」与「试过行为」）", 11.5, INK, extra="marginTop: 4"),
                T("• ZCode / WorkBuddy (664)：单口 28% ➔ 多路互补 60%（登记 17 项独家，日常调研主力、验收级文档与 283 个连接器）", 11.5, COBALT, True, extra="marginTop: 4"),
                T("• OpenCode / Hermes (272)：单口 21% ➔ 多路互补 56%（常驻共享服务 + ACP 桥，第 17 轮跨压缩取回第 1 轮原话）", 11.5, INK, extra="marginTop: 4"),
                T("• Gemini CLI / Factory Droid (36)：本地会话库零侵入直读（100% 原始记录对数还原），统一检索与决策链复原", 11.5, MUTED, extra="marginTop: 4"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 5, padding: '10px 12px', marginTop: 8, flexDirection: 'column'",
        ),
        box(
            [
                T("四个位置协同补齐矩阵", 12.5, WARM_AMBER, True),
                T("位置① 产品本体（盘清上限+42条独家） ➔ 位置② 原生接口（9类入口 ≥191项暴露） ➔ 位置③ 中心后端（接通283项·群组0→89项） ➔ 位置④ 网页与手机（50项显示全对数+126项控）", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFBEB', borderLeft: '4px solid #D97706', borderRadius: 5, padding: '8px 12px', marginTop: 8, flexDirection: 'column'",
        ),
    ],
    "width: 680, background: '#EEF2FF', borderTop: '4px solid #3730A3', borderRadius: 6, padding: '12px 14px', flexDirection: 'column', justifyContent: 'space-between'",
)

b2_right = box(
    [
        T("会话与任务板受控状态转移体系", 13.5, WARM_AMBER, True),
        box(
            [
                T("① 创建、预检与额度排队态 (Created / Preflight / Quota_Wait)", 12.2, COBALT, True),
                T("校验模型池配额与锁；4 家共用智谱账号撞上限时自动排队等到恢复时刻（18:08），不算失败", 11.5, INK, extra="marginTop: 3"),
            ],
            "background: '#FFFFFF', borderLeft: '3.5px solid #3730A3', borderRadius: 4, padding: '8px 10px'",
        ),
        box(
            [
                T("② 常驻运行与轮内流式态 (Running / Streaming / Steerable)", 12.2, COBALT, True),
                T("常驻进程流式输出推理步与工具调用，支持轮内插话纠偏或降级下一轮队列", 11.5, INK, extra="marginTop: 3"),
            ],
            "background: '#FFFFFF', borderLeft: '3.5px solid #3730A3', borderRadius: 4, padding: '8px 10px'",
        ),
        box(
            [
                T("③ 轮内审批挂起态 (Approval_Pending → Approved / Rejected)", 12.2, WARM_AMBER, True),
                T("触敏写文件/命令前在当前轮挂起，手机端或 CLI 批准后同轮继续写出", 11.5, INK, extra="marginTop: 3"),
            ],
            "background: '#FFFBEB', borderLeft: '3.5px solid #D97706', borderRadius: 4, padding: '8px 10px'",
        ),
        box(
            [
                T("④ 异构独立验收态 (Verifying → PASS / FAIL_Rework)", 12.2, GREEN, True),
                T("交回结果触发命令或异构智能体独立复核（如 Codex 7m 交回 → Claude 35s 验收），PASS 解封下游", 11.5, INK, extra="marginTop: 3"),
            ],
            "background: '#ECFDF5', borderLeft: '3.5px solid #047857', borderRadius: 4, padding: '8px 10px'",
        ),
        box(
            [
                T("⑤ 超时换人、熔断与分叉态 (Reassigned / Circuit_Broken / Forked)", 12.2, CRIMSON, True),
                T("卡住超时自动排除并换另一家 AI 重做；连败超限熔断，支持注入 Diff 从快照分叉恢复", 11.5, INK, extra="marginTop: 3"),
            ],
            "background: '#FEF2F2', borderLeft: '3.5px solid #9D0A12', borderRadius: 4, padding: '8px 10px'",
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '4px solid #D97706', borderRadius: 6, padding: '12px 14px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "08_补充B2_能力矩阵与状态机",
    page(
        "能力详表：132 个能力单元四张表对账与受控状态机",
        "node hub/tools/agent_gateway.js tables 实时核对 ｜ 82 项功能 + 50 项显示交互 ｜ 额度排队与超时换人状态机",
        [
            box(
                [b2_left, b2_right],
                "marginTop: 8, flexDirection: 'row', gap: 14, height: 424",
            )
        ],
        "四张表将各产品原生能力、后端接通率与网页可用率实时锁定在唯一证据源，配合受控状态机实现额度排队与超时自动换人。",
        True,
    ),
)

# ==============================================================================
# 补充页 B3 (Page 09): 《多智能体通信原语映射（Deliver≠Wake）与全量真跑故障诊断详单》
# ==============================================================================
b3_left = box(
    [
        T("跨产品通信原语映射：送达 ≠ 唤醒（四态回执 + 五类唤醒 + 四件套指针定义）", 13.5, COBALT, True),
        box(
            [
                T("1. 严格区分「送达 (Deliver) ≠ 读到 (Read) ≠ 唤醒 (Wake)」", 12.4, WARM_AMBER, True),
                T("• 发出 (Sent) → 送达 (Delivered，写入目标收件箱或消息队列) → 读到 (Read，进入目标当前轮上下文口) → 交回 (Returned，产出回执)", 11.5, INK, extra="marginTop: 4"),
                T("• 观察台「送达四分外环」实时显示每条黑板消息的【1.该知道 / 2.已送到 / 3.已读到 / 4.已写回】，防止把「文件写进目录」误判为「对方已读到」", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFBEB', borderLeft: '4px solid #D97706', borderRadius: 5, padding: '9px 12px', flexDirection: 'column'",
        ),
        box(
            [
                T("2. 五类唤醒机制与甲乙两条决定传路", 12.4, COBALT, True),
                T("• 五类唤醒：派活唤醒 (dispatch) · 交回唤醒 (deliver) · 依赖解封唤醒 · 审批放行唤醒 · 异常/超预算唤醒人", 11.5, INK, extra="marginTop: 4"),
                T("• 甲路（写进信息尾块，全宿主通用） vs 乙路（调用 agent_gateway.js 20 个 CLI 子命令或 MCP 工具）", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 5, padding: '9px 12px', flexDirection: 'column'",
        ),
        box(
            [
                T("3. 任务与记忆路径指针交接包（四件套定义）与单写者锁", 12.4, COBALT, True),
                T("• ① 要求标准 (CLAUDE.md) · ② 角色任务 (TASK.md) · ③ 记忆路径指针 · ④ 上手先读步骤；严禁多轮自由聊天拷贝长文，统一单写者锁", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #1E3A8A', borderRadius: 5, padding: '9px 12px', flexDirection: 'column'",
        ),
    ],
    "width: 590, background: '#EEF2FF', borderTop: '4px solid #3730A3', borderRadius: 6, padding: '12px 14px', flexDirection: 'column', justifyContent: 'space-between'",
)

b3_right = box(
    [
        T("10-18 至 10-19 全量真跑实证与真实故障诊断重演详单", 13.5, CRIMSON, True),
        box(
            [
                T("诊断实录 A：10-19 逐条对数抓出 5 处假通过 & 共享记录 2,600 行误删 1 分钟恢复", 12.4, CRIMSON, True),
                T("• 逐条对数（probe_display.mjs）：把 7 家网页/手机显示内容与原始记录逐条核对工具调用、结果、思考字数，查出并修复 5 处隐藏问题", 11.5, INK, extra="marginTop: 4"),
                T("• 误删恢复（guard.ts）：一个 AI 误把 2,600 行实测记录整份重写剩 18 行；建立三层防线（仅中心写/每分钟查变短恢复/私有版本库），1 分钟自动恢复", 11.5, GREEN, True, extra="marginTop: 4"),
            ],
            "background: '#FEF2F2', borderLeft: '4px solid #9D0A12', borderRadius: 5, padding: '10px 12px', flexDirection: 'column'",
        ),
        box(
            [
                T("诊断实录 B：OpenCode 免费模型切换污染全局配置 & 跨压缩回看第 1 轮原话", 12.4, COBALT, True),
                T("• 切模防污染：独立测试员（ZCode，dsp_151506_yvx4）真跑 56 项回归抓出 OpenCode 切模改写全局配置缺陷，加快照回滚锁修复", 11.5, INK, extra="marginTop: 4"),
                T("• 跨压缩取原话（recall-history）：实测 OpenCode 在第 17 轮一条命令准确取回被自动压缩掉的第 1 轮原话", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 5, padding: '10px 12px', flexDirection: 'column'",
        ),
        box(
            [
                T("诊断实录 C：10-19 自动调度异构验收、额度排队与轮内挂起审批真跑", 12.4, WARM_AMBER, True),
                T("• Codex 7 分钟交回 + Claude 35 秒验收通过；Codex 超时自动换 Claude 重做；4 家共用智谱撞上限自动排队至 18:08；5 款宿主轮内挂起放行全通过", 11.5, INK, extra="marginTop: 4"),
            ],
            "background: '#FFFBEB', borderLeft: '4px solid #D97706', borderRadius: 5, padding: '10px 12px', flexDirection: 'column'",
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '4px solid #9D0A12', borderRadius: 6, padding: '12px 14px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "09_补充B3_原语与排障详单",
    page(
        "通信与排障：送达≠唤醒四态回执与 10-19 真实排障详单",
        "发出→送达→读到→交回四态回执 ｜ 逐条对数查出 5 处隐藏问题 ｜ 2,600 行误删 1 分钟恢复与切模污染排障",
        [
            box(
                [b3_left, b3_right],
                "marginTop: 8, flexDirection: 'row', gap: 14, height: 424",
            )
        ],
        "严格区分「送达 ≠ 读到 ≠ 唤醒」四态回执，通过逐条对数、三层防删与 56 项回归真跑抓出并修复跨产品隐藏缺陷。",
        True,
    ),
)

# ==============================================================================
# 补充页 B4 (Page 10): 《高阶复合协作拓扑、生成式五维空间与 8 种交接契约详解》
# 对应 8 份协作拓扑研究文档：5形状×3决定×5控制源×5可见域、8种交接契约、三大复合拓扑防退化机制
# ==============================================================================
b4_left = box(
    [
        T("生成式拓扑五维空间 × 8 种标准交接契约（拒绝写死几十种固定模板）", 13.0, COBALT, True),
        box(
            [
                T("1. 生成式拓扑公式：五维正交组合空间", 12.0, COBALT, True),
                T("• 5 种基本形状：串行接力 (A→B→C) · 一对多分发 · 多对一汇总 · 双人往返 (A↔B) · 共享黑板/消息池", 11.5, INK, extra="marginTop: 2"),
                T("• 每步 3 个决定：选谁（按负载与强项挑人） · 给啥（四件套指针+工具授权） · 停不停（判据/闸门/限次）", 11.5, INK, extra="marginTop: 2"),
                T("• 5 种控制权来源：预写规则（代码/表） · 主管智能体 · 当前智能体自决（交棒） · 自由抢单 · 人类插手", 11.5, INK, extra="marginTop: 2"),
                T("• 5 级信息可见范围：全隔离（仅看交接包） ➔ 只读快照 ➔ 点对点带过滤 ➔ 群聊消息池 ➔ 共享黑板（单写者锁）", 11.5, COBALT, True, extra="marginTop: 2"),
                T("• 两条决定传路：路径甲（写进回复末尾协定块，全宿主通用） × 路径乙（调 MCP/CLI 工具，轮内即时执行）", 11.5, INK, extra="marginTop: 2"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 5, padding: '6px 10px', flexDirection: 'column'",
        ),
        box(
            [
                T("2. 8 种标准交接场景 × 四件套路径指针契约（防传话失真与上下文过载）", 12.0, WARM_AMBER, True),
                T("• 纵向 4 种：① 任务分派 (主管→执行) · ② 执行交回 (执行→主管) · ③ 审查退回 (审查→执行) · ④ 升级求助 (执行→主管/人)", 11.5, INK, extra="marginTop: 2"),
                T("• 横向与跨批 4 种：⑤ 平级协查 (A↔B) · ⑥ 汇总归档 (多路→汇总) · ⑦ 轮换接力 (前任→继任) · ⑧ 跨轮事件唤醒 (中心→待命)", 11.5, INK, extra="marginTop: 2"),
                T("• 四件套指针包：① 全局规范 (CLAUDE.md) · ② 角色任务书 (TASK.md) · ③ 记忆路径指针 · ④ 产物路径（带身份戳与逻辑时钟）", 11.5, GREEN, True, extra="marginTop: 2"),
            ],
            "background: '#FFFBEB', borderLeft: '4px solid #D97706', borderRadius: 5, padding: '6px 10px', flexDirection: 'column'",
        ),
        box(
            [
                T("3. 覆盖 7 类主流组织结构与三度解耦守恒", 12.0, GREEN, True),
                T("• 7 类结构：单主管星型 · 多层树形 · 流水线 DAG · 审查环 · 辩论合议庭 · 共享黑板自治池 · 跨轮记忆接力链", 11.5, INK, extra="marginTop: 2"),
                T("• 三度解耦：① 角色与渠道绑定可调 · ② 决定权归属可调 · ③ 必读清单上限防过载（先粗粒度探索再固化脚本）", 11.5, INK, extra="marginTop: 2"),
            ],
            "background: '#ECFDF5', borderLeft: '4px solid #047857', borderRadius: 5, padding: '6px 10px', flexDirection: 'column'",
        ),
    ],
    "width: 585, background: '#EEF2FF', borderTop: '4px solid #3730A3', borderRadius: 6, padding: '8px 11px', flexDirection: 'column', justifyContent: 'space-between'",
)

b4_right = box(
    [
        T("三大高阶复合拓扑的「防退化、防盲从、防失控」核心工程机制", 13.0, WARM_AMBER, True),
        box(
            [
                T("复合拓扑 A：双循环双账本主管 + 本地状态板认领 + 跨家族异构验收环", 12.0, COBALT, True),
                T("• 双账本 + 状态板：外环维护任务账本（已知事实、待证假设、总计划），内环维护进度账本；子智能体在状态板按锁认领任务、完成回填路径", 11.5, INK, extra="marginTop: 2"),
                T("• 跨家族异构验收：强制执行者与验收者分属不同模型家族（如 Codex 产出由 Claude 35 秒验收），阻断同源训练盲区导致的「自己审自己放水」", 11.5, COBALT, True, extra="marginTop: 2"),
                T("• 四级防死锁熔断：L1 单步超时换异构宿主 ➔ L2 审查退回限 3 次 ➔ L3 乒乓震荡检测 ➔ L4 退回外环缩减重规划或交人", 11.5, INK, extra="marginTop: 2"),
            ],
            "background: '#FFFFFF', borderLeft: '4px solid #3730A3', borderRadius: 5, padding: '8px 10px', flexDirection: 'column'",
        ),
        box(
            [
                T("复合拓扑 B：首轮全隔离盲跑 + 极差防带偏 + 硬判据辩论合议庭", 12.0, WARM_AMBER, True),
                T("• 阻断顺从附和与反共识带偏：首轮强制「全隔离可见域」独立盲跑产出结论与证据，防止早发言高置信度错误带偏同伴（Anti-Conformity）", 11.5, INK, extra="marginTop: 2"),
                T("• 极差阈值与硬判据一票否决：次轮仅交换结构化分歧摘要；评审打分极差超阈值时严禁算平均分，强制触发质询并以测试/脚本硬判据裁决", 11.5, WARM_AMBER, True, extra="marginTop: 2"),
            ],
            "background: '#FFFBEB', borderLeft: '4px solid #D97706', borderRadius: 5, padding: '8px 10px', flexDirection: 'column'",
        ),
        box(
            [
                T("复合拓扑 C：受控拉起账本 + 长角色短实例（满 60% 交棒）+ 双层状态映射", 12.0, GREEN, True),
                T("• 受控拉起防递归失控：每次派生子会话必记入中心账本（记录父子关系、层数上限、预算与超时），严禁无记录隐式递归拉起", 11.5, INK, extra="marginTop: 2"),
                T("• 满 60% 主动交棒 + 状态映射：角色与记忆常驻、单次会话短命（窗口达 60% 打包四件套指针换新实例）；内部 7 细态自动折算为父级 4 粗态", 11.5, GREEN, True, extra="marginTop: 2"),
            ],
            "background: '#ECFDF5', borderLeft: '4px solid #047857', borderRadius: 5, padding: '8px 10px', flexDirection: 'column'",
        ),
    ],
    "flex: 1, background: '#F8FAFC', borderTop: '4px solid #D97706', borderRadius: 6, padding: '8px 11px', flexDirection: 'column', justifyContent: 'space-between'",
)

write(
    "10_补充B4_复合拓扑与交接契约",
    page(
        "复合拓扑详解：生成式五维空间、8 种交接契约与三大防退化机制",
        "5 形状 × 3 决定 × 5 控制源 × 5 可见域 ｜ 8 种交接 × 四件套指针 ｜ 双账本状态板 · 隔离极差仲裁 · 受控拉起接力",
        [
            box(
                [b4_left, b4_right],
                "marginTop: 8, flexDirection: 'row', gap: 14, height: 424",
            )
        ],
        "以五维正交生成公式与 8 种四件套交接契约统一 7 类组织结构，并为三大高阶复合拓扑配齐防死锁、防盲从、防失控机制。",
        True,
    ),
)


