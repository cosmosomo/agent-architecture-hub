# -*- coding: utf-8 -*-
"""Generate 01..04 .body files for the 4-page Detailed Version using 100% native editable SlideDSL (<Box>/<Text>/<Image>).
Preserves 100% of the user's ideas across the conversation AND aligns with CAPABILITY_MAP.md (2026-10-19).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "body")
os.makedirs(OUT, exist_ok=True)

BLUE, RED, GOLD, GREEN, PURPLE, ORANGE = "#073E87", "#9D0A12", "#B45309", "#047857", "#6D28D9", "#D97706"
INK, MUTED, FAINT, LINE, CARD = "#1F2937", "#6B7280", "#9CA3AF", "#CBD5E1", "#F5F7FB"


def T(text, size=14, color=INK, bold=False, extra=""):
    w = ", fontWeight: 'bold'" if bold else ""
    e = (", " + extra) if extra else ""
    return "<Text style={{ fontSize: %s, color: '%s'%s%s }}>%s</Text>" % (size, color, w, e, text)


def B(text, color=BLUE):
    return '<span style={{ fontWeight: \'bold\', color: \'%s\' }}>%s</span>' % (color, text)


def box(children, style):
    return "<Box style={{ %s }}>\n%s\n</Box>" % (style, "\n".join(children))


def img(src, w, h, extra=""):
    e = (", " + extra) if extra else ""
    return '<Image src="主线/img/%s" style={{ width: %d, height: %d, objectFit: \'fill\'%s }} />' % (src, w, h, e)


def tag(text, fg=BLUE, bg="#E8F0FE", bd="#93C5FD"):
    return box(
        [T(text, 8.8, fg, True)],
        "background: '%s', border: '1px solid %s', borderRadius: 4, padding: '1px 5px', alignItems: 'center', justifyContent: 'center'"
        % (bg, bd),
    )


def page(title, subtitle, content):
    head = [T(title, 26.5, BLUE, True)]
    if subtitle:
        head.append(T(subtitle, 13.8, MUTED, extra="marginTop: 5"))
    body = box(
        head + content,
        "position: 'relative', zIndex: 1, width: '1280px', height: '720px', padding: '94px 56px 76px 56px', flexDirection: 'column'",
    )
    return "\n".join("    " + line for line in body.split("\n")) + "\n"


def scard(title, lines, accent=BLUE, extra=""):
    kids = [T(title, 14.8, accent, True)] + [
        T(l, 12.6, INK, extra="marginTop: 4, lineHeight: 1.30") for l in lines
    ]
    return box(
        kids,
        "background: '%s', borderRadius: 8, padding: '9px 12px', borderLeft: '3.5px solid %s', flexDirection: 'column'%s"
        % (CARD, accent, (", " + extra) if extra else ""),
    )


def strip_card(title, desc, accent=BLUE):
    return box(
        [T(title, 14.0, accent, True), T(desc, 12.0, INK, extra="marginTop: 2, lineHeight: 1.22")],
        "flex: 1, background: '%s', borderRadius: 6, padding: '5px 10px', borderTop: '3px solid %s', flexDirection: 'column'"
        % (CARD, accent),
    )


def duo(human, ai):
    half = lambda k, col, v: box(
        [T(k, 14.2, col, True, extra="width: 50"), T(v, 13.2, INK)],
        "flex: 1, flexDirection: 'row', alignItems: 'center'",
    )
    return [
        box([], "flex: 1"),
        box(
            [half("给人", BLUE, human), box([], "width: 1, height: 22, background: '%s'" % FAINT), half("给 AI", RED, ai)],
            "height: 42, flexDirection: 'row', alignItems: 'center', gap: 16, background: 'rgba(7,62,135,0.06)', borderRadius: 8, padding: '0 14px'",
        ),
    ]


def write(name, text):
    with open(os.path.join(OUT, name + ".body"), "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", name)


# ==============================================================================
# Page 01: 现实痛点与范式转换 (100% Native Editable SlideDSL)
# ==============================================================================
p01_top_left = box(
    [
        box(
            [T("各家成品生态：自家高缓存低价但封闭难拓展", 11.0, RED, True), tag("封闭 vs 反代", RED, "#FEE2E2", "#FCA5A5")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [T(B("✓ 为什么用成品", GREEN) + "：自家应用(如 Claude Desktop/Code)享最高最强缓存率与补贴，极便宜", 9.1, INK, extra="lineHeight: 1.24")],
            "marginTop: 4, background: '#ECFDF5', borderLeft: '2.5px solid #047857', borderRadius: 3, padding: '3px 6px'",
        ),
        box(
            [T(B("✗ 成品最大痛点", RED) + "：高度封闭、可拓展性差，跨产品派活与验收无公共宿主", 9.3, INK, extra="lineHeight: 1.24")],
            "marginTop: 3, background: '#FEF2F2', borderLeft: '2.5px solid #9D0A12', borderRadius: 3, padding: '3px 6px'",
        ),
        box(
            [T(B("⚠ 逆向反代不可取", GOLD) + "：拆凭证封号，且丢掉原厂高缓存率、补丁沙箱与会话状态", 9.2, INK, extra="lineHeight: 1.22")],
            "marginTop: 3, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 3, padding: '2.5px 6px'",
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #9D0A12', borderRadius: 6, padding: '6px 8px', flexDirection: 'column'",
)

p01_top_right = box(
    [
        box(
            [T("本系统：协议 + CDP + 适配器三路接入", 11.2, BLUE, True), tag("保留高缓存+中心宿主", BLUE, "#E8F0FE", "#93C5FD")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [T(B("① 官方协议", BLUE) + "：常驻 ACP、Codex app-server、Claude JSON、AGY RPC", 9.3, INK)],
            "marginTop: 4, background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '3px 6px'",
        ),
        box(
            [T(B("② 桌面与网页 CDP", BLUE) + "：豆包 9225 + OpenCLI 160+ 已登录网页（桌面 UI 实测 9 格）", 9.3, INK)],
            "marginTop: 3, background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '3px 6px'",
        ),
        box(
            [T(B("③ 分尺度当宿主", BLUE) + "：小尺度复用原厂宿主保留最高缓存率与低价，跨产品由中心当宿主", 9.1, INK)],
            "marginTop: 3, background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '3px 6px'",
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, padding: '6px 8px', flexDirection: 'column'",
)


def p01_row(dim, bad_title, bad_desc, good_title, good_desc, is_last=False):
    bb = "" if is_last else ", borderBottom: '1px solid #E5E7EB'"
    return box(
        [
            box(
                [T(dim, 10.0, BLUE, True)],
                "width: 82, padding: '4px 6px', background: '#F8FAFC', borderRight: '1px solid #E5E7EB', justifyContent: 'center'",
            ),
            box(
                [T(B(bad_title, RED) + "：" + bad_desc, 9.3, "#4B5563", extra="lineHeight: 1.25")],
                "width: 298, padding: '4px 7px', background: '#FFFBFB', borderRight: '1px solid #E5E7EB', justifyContent: 'center'",
            ),
            box(
                [T(B(good_title, BLUE) + "：" + good_desc, 9.4, INK, extra="lineHeight: 1.25")],
                "flex: 1, padding: '4px 7px', background: '#F8FBFF', justifyContent: 'center'",
            ),
        ],
        "flex: 1, flexDirection: 'row', alignItems: 'stretch'" + bb,
    )


p01_table = box(
    [
        box(
            [
                box([T("核心维度", 10.0, "#FFFFFF", True)], "width: 82, padding: '4px 6px'"),
                box([T("底层代码框架 (什么都要手写) 与 闭源成品 (封闭难拓展)", 9.8, "#FFFFFF", True)], "width: 298, padding: '4px 7px'"),
                box([T("本系统设计 (官方协议 + CDP + 适配器 · MD 渐进编排 · 双颗粒度 Trace)", 9.8, "#FFFFFF", True)], "flex: 1, padding: '4px 7px'"),
            ],
            "height: 25, background: '#073E87', flexDirection: 'row', alignItems: 'center'",
        ),
        p01_row(
            "1. 开发编排",
            "底层框架什么都要手写 + DAG 写死",
            "只调裸模型 API，补丁/沙箱/记忆全靠手写，改流程需改 Python 代码",
            "复用 7 大可驱动宿主 + MD 渐进编排",
            "免造底层轮子；用 CLAUDE.md、TASK.md 自然语言随时重构角色与拓扑",
        ),
        p01_row(
            "2. 决策还原",
            "单层调用流水账 + 生态黑盒",
            "通用遥测仅记细粒度 API 进出文本，满屏步骤看不出「当时为什么这么选」",
            "双颗粒度 Trace（粗粒度决策段 + 细粒度步）",
            "粗粒度决策段(触发/备选/选择/理由)经 turn+steps 锚定在 9 家细粒度轮/步证据上",
        ),
        p01_row(
            "3. 生态拓展",
            "各家产品封闭、可拓展性差",
            "虽有自家最高缓存命中率、低价补贴与子代理(12/84)，但跨产品无宿主",
            "按五级尺度分清宿主归属（532 格对账）",
            "小尺度复用原厂最高缓存率与低价优化；双会话(58/84)与群会话(31/35)由中心当宿主",
        ),
        p01_row(
            "4. 漂移监控",
            "长程多轮目标漂移失控",
            "多轮转发对话全文易冲淡初始约束，缺乏规范与实际轨迹的实时比对",
            "四件套指针交接 + 三态轨迹对照",
            "交接仅传路径指针不传长文；任务板预算熔断 + 异构独立验收 + 实线/虚线/橙色对照",
        ),
        p01_row(
            "5. 运行控制",
            "单次子进程遇审批即挂死或断连",
            "单次 CLI 进程无法在写文件前挂起等待外部批准，重跑易丢上下文",
            "常驻会话轮内审批 + 会话库线程分叉",
            "5 个产品实测写文件前轮内挂起→网页/CLI 批准后同轮写出；Codex 支持线程分叉",
            True,
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)

write(
    "01_问题背景",
    page(
        "现实痛点与范式转换：复用成品客户端生态，打破单窗封闭与刚性代码",
        "自家应用享最高缓存率与低价补贴，但封闭难拓展 ｜ 底层代码框架什么都要手写 ｜ 双颗粒度 Trace 与 MD 渐进编排",
        [
            box(
                [
                    box(
                        [
                            scard(
                                "痛点 A：各家成品享最高缓存率但封闭，反代违规丢功能",
                                [
                                    "各家对自家应用(如 Claude Desktop/Code)给最高缓存率与低价",
                                    "最大缺点是生态封闭、可拓展性差，会话锁在单窗口",
                                    "拆凭证逆向反代既违规封号，又丢掉原厂高缓存与工具链",
                                ],
                                RED,
                            ),
                            scard(
                                "痛点 B：底层代码框架什么都要手写 vs MD 渐进编排",
                                [
                                    "LangGraph、AutoGen 只给空架子，工具与沙箱全靠手写",
                                    "Python 写死 DAG 状态机改流程慢，我们直接复用成品宿主",
                                    "用 CLAUDE.md、TASK.md 定契约，随时用自然语言重构角色",
                                ],
                                BLUE,
                                extra="marginTop: 8",
                            ),
                            scard(
                                "痛点 C：单层流水账难看懂 vs 双颗粒度 Trace 回路",
                                [
                                    "通用追踪仅记细粒度调用流水账，看不出为什么这么选",
                                    "双颗粒度 Trace：粗粒度决策段(turn+steps)锚定细粒度步",
                                    "配合四件套指针交接、轮内挂起审批与异构独立验收",
                                ],
                                RED,
                                extra="marginTop: 8",
                            ),
                        ],
                        "width: 430, flexDirection: 'column', justifyContent: 'space-between'",
                    ),
                    box(
                        [
                            box([p01_top_left, p01_top_right], "height: 118, flexDirection: 'row', gap: 8"),
                            p01_table,
                        ],
                        "width: 726, flexDirection: 'column', gap: 8",
                    ),
                ],
                "marginTop: 10, flexDirection: 'row', gap: 12, height: 404",
            ),
        ]
        + duo(
            "双颗粒度 Trace 先看粗粒度决策段，再按 turn+steps 下钻细粒度步骤证据",
            "靠官方协议+CDP+适配器吃尽各家活动低价与闭源独家优化，小尺度复用宿主、大尺度中心当宿主",
        ),
    ),
)

# ==============================================================================
# Page 02: 全生态能力渠道与基本能力矩阵 (100% Native Editable SlideDSL)
# ==============================================================================
def p02_chip(code, col, name, route, stat):
    return box(
        [
            box(
                [
                    box(
                        [T(code, 8.2, "#FFFFFF", True)],
                        "background: '%s', borderRadius: 3, padding: '1px 4px', marginRight: 4" % col,
                    ),
                    T(name, 9.6, INK, True),
                ],
                "flexDirection: 'row', alignItems: 'center'",
            ),
            box(
                [T(route, 7.9, MUTED), T(stat, 8.1, BLUE, True)],
                "marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
            ),
        ],
        "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
    )


p02_channels_card = box(
    [
        box(
            [
                T("全生态 12 路能力渠道（7 可驱动产品 + 2 只读库共 1,707 条 + 豆包 + 160+ 网页 + 30+ 模型池 + 22 把 Key）", 10.2, "#FFFFFF", True),
                T("分母：76 能力 + 50 交互", 9.0, "#E0E7FF", True),
            ],
            "height: 23, background: '#073E87', padding: '0 8px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                box(
                    [
                        p02_chip("CC", "#D97706", "Claude (236)", "CLI/JSON", "实68%|后47%"),
                        p02_chip("CX", "#073E87", "Codex (151)", "app-server", "实66%|后46%"),
                        p02_chip("AG", "#2563EB", "AGY (240)", "RPC/API", "实59%|后38%"),
                        p02_chip("ZC", "#7C3AED", "ZCode (822)", "常驻ACP+库", "证29%→后50%"),
                        p02_chip("WB", "#059669", "WorkBuddy(84)", "常驻ACP+库", "证28%→后47%"),
                        p02_chip("OC", "#0D9488", "OpenCode(95)", "ACP/serve", "证33%→后43%"),
                    ],
                    "flexDirection: 'row', gap: 5",
                ),
                box(
                    [
                        p02_chip("HM", "#4F46E5", "Hermes (43)", "ACP/state", "证30%→后43%"),
                        p02_chip("RO", "#9D0A12", "Gemini/Droid", "本地会话库", "只读 16+20条"),
                        p02_chip("DB", "#0284C7", "豆包桌面端", "CDP 9225", "独立拨号通道"),
                        p02_chip("UI", "#EA580C", "OpenCLI网页", "CDP登录态", "160+站|UI 9格"),
                        p02_chip("MD", "#475569", "cc-switch池", "按次切配置", "30+ 供应商"),
                        p02_chip("SR", "#047857", "Search Hub", "自动轮换", "22 把搜索Key"),
                    ],
                    "marginTop: 4, flexDirection: 'row', gap: 5",
                ),
            ],
            "padding: '5px 6px', flexDirection: 'column'",
        ),
    ],
    "height: 114, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)


def p02_row(scale_name, scale_sub, native_title, native_desc, our_title, our_desc, is_last=False):
    bb = "" if is_last else ", borderBottom: '1px solid #E5E7EB'"
    return box(
        [
            box(
                [T(scale_name, 9.6, BLUE, True), T(scale_sub, 8.3, MUTED, extra="marginTop: 1")],
                "width: 96, padding: '3px 6px', background: '#F8FAFC', borderRight: '1px solid #E5E7EB', justifyContent: 'center'",
            ),
            box(
                [T(B(native_title, RED) + "：" + native_desc, 9.1, "#4B5563", extra="lineHeight: 1.24")],
                "width: 288, padding: '3px 6px', background: '#FFFBFB', borderRight: '1px solid #E5E7EB', justifyContent: 'center'",
            ),
            box(
                [T(B(our_title, BLUE) + "：" + our_desc, 9.2, INK, extra="lineHeight: 1.24")],
                "flex: 1, padding: '3px 6px', background: '#F8FBFF', justifyContent: 'center'",
            ),
        ],
        "flex: 1, flexDirection: 'row', alignItems: 'stretch'" + bb,
    )


p02_table = box(
    [
        box(
            [
                box([T("五个尺度 (532格)", 9.6, "#FFFFFF", True)], "width: 96, padding: '4px 6px'"),
                box([T("各产品原生面（谁当宿主 · 已证实下限 ≥191 格）", 9.6, "#FECACA", True)], "width: 288, padding: '4px 6px'"),
                box([T("本系统「多路择优 + 中心当宿主」实测（后端已接 283 格 / 通过 240 格）", 9.6, "#BFDBFE", True)], "flex: 1, padding: '4px 6px'"),
            ],
            "height: 24, background: '#073E87', flexDirection: 'row', alignItems: 'center'",
        ),
        p02_row(
            "1. 一轮之内",
            "10单元 · 70格",
            "各产品当宿主 (已证实 ≥39/70)",
            "Codex/Claude/AGY 支持轮内插话，但单口 CLI 或 ACP 通道暴露不全",
            "多路择优 + 轮内挂起 (已接 32/70)",
            "5 个产品实测写文件前轮内挂起→网页/CLI 批准后同轮写出；跨级可降级队列",
        ),
        p02_row(
            "2. 一个会话",
            "34单元 · 238格",
            "各产品当宿主 (已证实 ≥98/238)",
            "自带存储与恢复；跨进程带锁(Codex 7分钟)，ACP 缺会话分叉与压缩",
            "常驻 ACP + 本地会话库 (已接 129/238)",
            "实测通过 119 格；无锁直读会话库，ZCode 后端从 29% 升至 50%，WB 升至 47%",
        ),
        p02_row(
            "3. 两个会话间",
            "12单元 · 84格",
            "仅同产品子代理 (已证实 ≥12/84)",
            "7 家里 6 家支持内部派子智能体；跨产品派活与回执无单一产品当宿主",
            "跨产品由中心当宿主 (已接 58/84)",
            "实测通过 51 格；中心保管等待、跨产品问答原语、四态回执与五类消息唤醒",
        ),
        p02_row(
            "4. 一群会话",
            "5单元 · 35格",
            "仅单产品内列表 (已证实 ≥8/35)",
            "各家仅管自身会话列表；跨产品任务板、预算熔断与独立验收无单一宿主",
            "跨产品群会话中心当宿主 (已接 31/35)",
            "实测通过 24 格；任务板离线判定 20/20 过，ZCode→OpenCode→Hermes 验收跑通",
        ),
        p02_row(
            "5. 渠道与环境",
            "15单元·105格",
            "归各产品与本机 (已证实 ≥34/105)",
            "4 家可报命令清单；会话内切模型易改写产品级全局默认配置",
            "统一供给 + 双端入口 (已接 25/105)",
            "统管 30+ 模型池与 22 把 Key；手机端 /m/ 覆盖桌面端 53%–72% 交互项",
            True,
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)

write(
    "02_能力渠道",
    page(
        "能力渠道与基本能力矩阵：各家原生面 vs 多路择优 + 中心当宿主",
        "9 产品 1,707 条本地会话 + 豆包 + 160+ 网页登录态 + 30+ 模型池 + 22 把 Key ｜ 五级尺度 532 格实测对账",
        [
            box(
                [
                    box(
                        [
                            scard(
                                "四根轴正交拆解：尺度 × 位置 × 产品 × 依据",
                                [
                                    "五级尺度：一步 ⊂ 一轮 ⊂ 单会话 ⊂ 两会话 ⊂ 群会话",
                                    "五个位置：本体 → 原生面 → 适配路线 → 后端 → 网页",
                                    "四张表对账：原生证实 ≥191 格 → 后端已接 283 格",
                                ],
                                BLUE,
                            ),
                            scard(
                                "小尺度（一轮 / 单会话）：各产品当宿主 + 多路择优",
                                [
                                    "各家单一接口暴露不全（如 Codex CLI 16%、ACP 11%）",
                                    "组合常驻 ACP + 官方服务 + 本地会话库：ZCode 升至 50%",
                                    "小尺度做不到则跨级降级兜底（如轮内插话降级下一轮）",
                                ],
                                GOLD,
                                extra="marginTop: 8",
                            ),
                            scard(
                                "大尺度（两会话 / 群会话）：由本中心自己当宿主",
                                [
                                    "各家仅管内部子智能体(12/84)，跨产品协同无公共宿主",
                                    "中心当宿主实测接通双会话 58/84 格、群会话 31/35 格",
                                    "统管 9 家会话全文检索、160+ 网页登录态与 22 把 Key",
                                ],
                                RED,
                                extra="marginTop: 8",
                            ),
                        ],
                        "width: 430, flexDirection: 'column', justifyContent: 'space-between'",
                    ),
                    box(
                        [p02_channels_card, p02_table],
                        "width: 726, flexDirection: 'column', gap: 8",
                    ),
                ],
                "marginTop: 10, flexDirection: 'row', gap: 12, height: 404",
            ),
        ]
        + duo(
            "按五级尺度对比看清「各家原生下限」与「多路择优 + 中心当宿主」的实测增益",
            "基于四张表（agent_gateway.js tables）实时对账，自动择优路由并支持跨尺度降级兜底",
        ),
    ),
)

# ==============================================================================
# Page 03: 核心认知与编排拓扑结构图 (100% Native Editable SlideDSL)
# ==============================================================================
def node_circle(label, bg=BLUE, size=20, fsize=9):
    return box(
        [T(label, fsize, "#FFFFFF", True)],
        "width: %d, height: %d, borderRadius: 99, background: '%s', alignItems: 'center', justifyContent: 'center'"
        % (size, size, bg),
    )


def h_line(w=14, col=BLUE, h=2):
    return box([], "width: %d, height: %d, background: '%s'" % (w, h, col))


topo_1 = box(
    [
        box([T("① 接力", 9.8, BLUE, True), T("A→B→C", 8.5, MUTED)], "flexDirection: 'row', justifyContent: 'space-between'"),
        box(
            [node_circle("A", BLUE), h_line(16, BLUE), node_circle("B", GREEN), h_line(16, GREEN), node_circle("C", BLUE)],
            "height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 4, marginTop: 3",
        ),
        T("A 产出作 B 输入", 8.4, INK, extra="marginTop: 3"),
        T(B("实测", BLUE) + "：ZCode→OC→Hermes", 8.2, INK, extra="marginTop: 1"),
    ],
    "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
)

topo_2 = box(
    [
        box([T("② 分发", 9.8, BLUE, True), T("A→B₁..ₙ", 8.5, MUTED)], "flexDirection: 'row', justifyContent: 'space-between'"),
        box(
            [
                node_circle("A", BLUE, 20),
                h_line(12, BLUE),
                box(
                    [node_circle("B1", GREEN, 13, 7.5), node_circle("B2", GREEN, 13, 7.5), node_circle("B3", GREEN, 13, 7.5)],
                    "flexDirection: 'column', gap: 1, alignItems: 'center'",
                ),
            ],
            "height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 4, marginTop: 3",
        ),
        T("同一任务拆多人并行", 8.4, INK, extra="marginTop: 3"),
        T(B("场景", BLUE) + "：并行探索 / 多路竞速", 8.2, INK, extra="marginTop: 1"),
    ],
    "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
)

topo_3 = box(
    [
        box([T("③ 汇总", 9.8, BLUE, True), T("B₁..ₙ→C", 8.5, MUTED)], "flexDirection: 'row', justifyContent: 'space-between'"),
        box(
            [
                box(
                    [node_circle("B1", GREEN, 13, 7.5), node_circle("B2", GREEN, 13, 7.5), node_circle("B3", GREEN, 13, 7.5)],
                    "flexDirection: 'column', gap: 1, alignItems: 'center'",
                ),
                h_line(12, GREEN),
                node_circle("C", BLUE, 20),
            ],
            "height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 4, marginTop: 3",
        ),
        T("多路输出合交一人收口", 8.4, INK, extra="marginTop: 3"),
        T(B("场景", BLUE) + "：主管合流 / 汇总收口", 8.2, INK, extra="marginTop: 1"),
    ],
    "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
)

topo_4 = box(
    [
        box([T("④ 往返", 9.8, RED, True), T("A↔审", 8.5, MUTED)], "flexDirection: 'row', justifyContent: 'space-between'"),
        box(
            [
                node_circle("A", BLUE, 20),
                box([h_line(22, BLUE, 2), T("↔", 10, RED, True), h_line(22, RED, 2)], "flexDirection: 'column', alignItems: 'center'"),
                node_circle("审", RED, 20),
            ],
            "height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 4, marginTop: 3",
        ),
        T("异构智能体独立验收打回", 8.4, INK, extra="marginTop: 3"),
        T(B("实测", RED) + "：FAIL 自动打回重派", 8.2, INK, extra="marginTop: 1"),
    ],
    "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
)

topo_5 = box(
    [
        box([T("⑤ 共享", 9.8, GOLD, True), T("A,B,C↔板", 8.5, MUTED)], "flexDirection: 'row', justifyContent: 'space-between'"),
        box(
            [
                node_circle("A", BLUE, 16, 8),
                h_line(6, GOLD),
                box(
                    [T("共享黑板", 7.8, GOLD, True)],
                    "background: '#FEF3C7', border: '1.5px solid #D97706', borderRadius: 3, padding: '2px 4px'",
                ),
                h_line(6, GOLD),
                node_circle("B", GREEN, 16, 8),
            ],
            "height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 4, marginTop: 3",
        ),
        T("共用任务板与黑板读写", 8.4, INK, extra="marginTop: 3"),
        T(B("实测", GOLD) + "：依赖解封与预算熔断", 8.2, INK, extra="marginTop: 1"),
    ],
    "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
)

p03_left = box(
    [
        box(
            [T("最粗一层：三个基础抽象 × 两条通路 × 四级同构嵌套", 10.5, "#FFFFFF", True), T("外层=一步 里层=一圈", 8.8, "#E0E7FF")],
            "height: 22, background: '#073E87', padding: '0 8px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                box(
                    [T(B("✎ 写下它（编排）", BLUE) + "：把角色、拓扑、交接与验收写进 CLAUDE.md / TASK.md 与任务板", 8.7, INK)],
                    "background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 4, padding: '2.5px 6px'",
                ),
                box(
                    [
                        box(
                            [
                                T("能力渠道", 9.6, RED, True),
                                T("内置工具 (读/写/Shell)", 8.2, INK, extra="marginTop: 2"),
                                T("外部扩展 (MCP/OpenCLI)", 8.2, INK, extra="marginTop: 1"),
                                T("网关 (20 个子命令)", 8.2, INK, extra="marginTop: 1"),
                                T(B("其他智能体 (当工具)", RED), 8.2, RED, extra="marginTop: 1"),
                            ],
                            "width: 100, background: '#FEF2F2', border: '1.5px solid #9D0A12', borderRadius: 5, padding: '4px 5px', flexDirection: 'column'",
                        ),
                        box([T("↔", 11, RED, True)], "width: 14, alignItems: 'center', justifyContent: 'center'"),
                        box(
                            [
                                T("智能体 = 模型 + Harness", 9.6, BLUE, True),
                                box(
                                    [
                                        tag("◀ 工具口", RED, "#FEE2E2", "#FCA5A5"),
                                        tag("视窗推理", BLUE, "#DBEAFE", "#93C5FD"),
                                        tag("上下文口 ▶", GOLD, "#FEF3C7", "#FDE68A"),
                                    ],
                                    "marginTop: 3, flexDirection: 'row', justifyContent: 'space-between'",
                                ),
                                box(
                                    [
                                        T("①系统提示 ②工具注入 ③上下文装配", 8, INK),
                                        T("④输出解析 ⑤循环不早停 ⑥写回环境", 8, INK, extra="marginTop: 2"),
                                    ],
                                    "marginTop: 3, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '3px 4px', flexDirection: 'column'",
                                ),
                            ],
                            "flex: 1, background: '#F0F7FF', border: '1.5px solid #073E87', borderRadius: 5, padding: '4px 5px', flexDirection: 'column'",
                        ),
                        box([T("↔", 11, GOLD, True)], "width: 14, alignItems: 'center', justifyContent: 'center'"),
                        box(
                            [
                                T("信息", 9.6, GOLD, True),
                                T("任务规范 (MD文档)", 8.2, INK, extra="marginTop: 2"),
                                T("历史与外部资料", 8.2, INK, extra="marginTop: 1"),
                                T(B("交接包 (四件套指针)", BLUE), 8.2, BLUE, extra="marginTop: 1"),
                                T(B("共享状态 (任务板/黑板)", GOLD), 8.2, GOLD, extra="marginTop: 1"),
                            ],
                            "width: 98, background: '#FFFBEB', border: '1.5px solid #D97706', borderRadius: 5, padding: '4px 5px', flexDirection: 'column'",
                        ),
                    ],
                    "marginTop: 4, flexDirection: 'row', alignItems: 'stretch'",
                ),
                box(
                    [
                        T(B("多智能体相连的两条唯一通路（不引入第 4 个新概念）", BLUE), 8.8, BLUE, True),
                        T("① 靠「信息」相连：A 的产出成「交接包 / 共享黑板」进入 B 的「上下文口」", 8.3, INK, extra="marginTop: 1"),
                        T("② 靠「能力渠道」相连：A 通过「工具口」把 B 当子代理/工具直接调用（问答原语）", 8.3, INK, extra="marginTop: 1"),
                    ],
                    "marginTop: 4, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
                ),
                box(
                    [
                        T(B("四级同构嵌套（每步共用：❶ 下一个是谁 → ❷ 给它什么 → ❸ 执行 → ❹ 停不停）", BLUE), 8.6, BLUE, True),
                        box(
                            [
                                box([T("1 个智能体", 8.6, BLUE, True), T("单轮 6 步微循环", 7.8, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px', alignItems: 'center'"),
                                T("⊂", 10, BLUE, True),
                                box([T("2 个之间", 8.6, BLUE, True), T("最小原语「问答」", 7.8, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px', alignItems: 'center'"),
                                T("⊂", 10, RED, True),
                                box([T("超过 3 个", 8.6, RED, True), T("5 种基本形状拓扑", 7.8, INK)], "flex: 1, background: '#FEF2F2', border: '1.5px solid #9D0A12', borderRadius: 3, padding: '2px 4px', alignItems: 'center'"),
                                T("⊂", 10, GOLD, True),
                                box([T("编排层", 8.6, GOLD, True), T("写下它↔看着它", 7.8, INK)], "flex: 1, background: '#FFFBEB', border: '1.5px solid #D97706', borderRadius: 3, padding: '2px 4px', alignItems: 'center'"),
                            ],
                            "marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 2",
                        ),
                    ],
                    "marginTop: 4, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
                ),
                box(
                    [T(B("◉ 看着它（双颗粒度 Trace）", RED) + "：粗粒度决策段(触发/备选/选择/理由)经 turn+steps 锚定细粒度步", 8.5, INK)],
                    "marginTop: 4, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 4, padding: '2.5px 6px'",
                ),
            ],
            "flex: 1, padding: '5px 6px', flexDirection: 'column', justifyContent: 'space-between'",
        ),
    ],
    "width: 404, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)

p03_right = box(
    [
        box(
            [
                T("「超过 3 个智能体」与「编排层」拓扑结构：五种原子形状 × 决策通路 × 双颗粒度 Trace", 10.3, "#FFFFFF", True),
                T("节点=智能体 边=问答/交接包", 8.8, "#E0E7FF"),
            ],
            "height: 22, background: '#073E87', padding: '0 8px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                box(
                    [
                        box(
                            [
                                T("1. 五种基本拓扑形状（超过 3 个智能体的协作流程，均由这 5 种原子形状自由拼装）", 9.5, BLUE, True),
                                tag("多智能体编排拓扑", RED, "#FEE2E2", "#FCA5A5"),
                            ],
                            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
                        ),
                        box([topo_1, topo_2, topo_3, topo_4, topo_5], "marginTop: 3, flexDirection: 'row', gap: 5"),
                    ],
                    "flexDirection: 'column'",
                ),
                box(
                    [
                        box(
                            [
                                box([T("2. 三次决定的 3 种来源", 9.4, BLUE, True), tag("谁决定", BLUE, "#E8F0FE", "#93C5FD")], "flexDirection: 'row', justifyContent: 'space-between'"),
                                T(B("① 规则驱动", BLUE) + "：按任务板依赖图自动解封与流转", 8.4, INK, extra="marginTop: 2"),
                                T(B("② 智能体驱动", BLUE) + "：由主管或异构验收智能体裁决 PASS/FAIL", 8.4, INK, extra="marginTop: 2"),
                                T(B("③ 混合 + 人兜底", RED) + "：遇轮内审批或超预算熔断暂停，交人裁决", 8.4, INK, extra="marginTop: 2"),
                            ],
                            "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
                        ),
                        box(
                            [
                                box([T("3. 传决定 2 路与接力实测", 9.4, BLUE, True), tag("怎么传", RED, "#FEE2E2", "#FCA5A5")], "flexDirection: 'row', justifyContent: 'space-between'"),
                                T(B("甲路(信息尾块)", BLUE) + " 全宿主通 ｜ " + B("乙路(MCP/网关)", RED) + " 调工具派活", 8.3, INK, extra="marginTop: 2"),
                                T(B("跨产品实测", BLUE) + "：ZCode 算平方 → OpenCode 算总和得 55", 8.3, INK, extra="marginTop: 2"),
                                T(B("异构独立验收", GREEN) + "：中心自动派 Hermes 复算返回 PASS", 8.3, INK, extra="marginTop: 2"),
                            ],
                            "flex: 1.08, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
                        ),
                        box(
                            [
                                box([T("4. 交接包四件套与单写者锁", 9.4, BLUE, True), tag("防漂移", GREEN, "#ECFDF5", "#6EE7B7")], "flexDirection: 'row', justifyContent: 'space-between'"),
                                box(
                                    [
                                        box([T(B("① 要求标准", BLUE) + " · CLAUDE.md", 8.1, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px'"),
                                        box([T(B("② 角色任务", BLUE) + " · TASK.md", 8.1, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px'"),
                                    ],
                                    "marginTop: 2, flexDirection: 'row', gap: 3",
                                ),
                                box(
                                    [
                                        box([T(B("③ 记忆文件", BLUE) + " · 路径指针", 8.1, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px'"),
                                        box([T(B("④ 上手步骤", BLUE) + " · 先读哪几个", 8.1, INK)], "flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 3, padding: '2px 4px'"),
                                    ],
                                    "marginTop: 2, flexDirection: 'row', gap: 3",
                                ),
                                T(B("四态回执 + 单写者锁", RED) + "：发出→送达→读到→交回，杜绝覆盖", 8.2, INK, extra="marginTop: 2"),
                            ],
                            "flex: 1, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
                        ),
                    ],
                    "flexDirection: 'row', gap: 6",
                ),
                box(
                    [
                        box(
                            [
                                T("5. 编排层「写下它 ↔ 看着它」回路：四类拓扑连线 × 三态轨迹对照 × 双颗粒度 Trace 叠层", 9.4, BLUE, True),
                                T("粗粒度决策段 (turn+steps) ↔ 细粒度调用步", 8.5, RED, True),
                            ],
                            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
                        ),
                        box(
                            [
                                box(
                                    [
                                        T("四类拓扑连线 (节点=角色/文件/渠道)：", 8.5, BLUE, True),
                                        T(B("任务线", BLUE) + " 派发/转交 ｜ " + B("信息线", GREEN) + " 读写产出", 8.2, INK, extra="marginTop: 2"),
                                        T(B("汇报线", PURPLE) + " 验收/介入 ｜ " + B("唤醒线", GOLD) + " 恢复与换模配额", 8.2, INK, extra="marginTop: 1"),
                                    ],
                                    "flex: 1, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
                                ),
                                box(
                                    [
                                        T("三态轨迹对照 (预期规范 vs 真实轨迹)：", 8.5, BLUE, True),
                                        T(B("━━ 实线(已实现)", BLUE) + "：契约写了，实际也按约发生", 8.2, INK, extra="marginTop: 2"),
                                        T(B("┈┈ 虚线(未发生)", MUTED) + "：未跑到 ｜ " + B("━━ 橙色(越权)", ORANGE) + "：私调或越界", 8.2, INK, extra="marginTop: 1"),
                                    ],
                                    "flex: 1.15, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
                                ),
                                box(
                                    [
                                        T("双颗粒度 Trace 叠层 (annotate.js)：", 8.5, BLUE, True),
                                        T(B("粗粒度决策段", RED) + "：触发/备选/选择/理由 (挂 turn+steps)", 8.2, INK, extra="marginTop: 2"),
                                        T(B("细粒度证据层", BLUE) + "：展开 9 家会话库每一步推理与工具调用", 8.2, INK, extra="marginTop: 1"),
                                    ],
                                    "flex: 1.1, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 4, padding: '3px 6px', flexDirection: 'column'",
                                ),
                            ],
                            "marginTop: 3, flexDirection: 'row', gap: 5",
                        ),
                    ],
                    "background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 6px', flexDirection: 'column'",
                ),
            ],
            "flex: 1, padding: '5px 7px', flexDirection: 'column', justifyContent: 'space-between'",
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)

write(
    "03_核心认知",
    page(
        "核心认知与编排拓扑：三个基础抽象 × 四级同构 × 五种协作拓扑",
        "能力渠道 ↔ 智能体(模型+Harness) ↔ 信息 ｜ 1 个智能体 ⊂ 2 个之间 ⊂ 超过 3 个 ⊂ 编排层 ｜ 写下它 ↔ 看着它三态对照",
        [
            box(
                [
                    strip_card("三个基础抽象 + 两条通路", "能力渠道 ↔ 智能体 ↔ 信息；靠信息或当工具相连", BLUE),
                    strip_card("四级同构（超过 3 个）", "1个智能体 → 2个(问答) → 超过3个(拓扑) → 编排层", GOLD),
                    strip_card("五种拓扑 × 跨产品独立验收", "接力/分发/汇总/往返/共享；ZCode→OpenCode→Hermes 实证", RED),
                ],
                "marginTop: 8, flexDirection: 'row', gap: 10, height: 44",
            ),
            box([p03_left, p03_right], "marginTop: 7, flexDirection: 'row', gap: 10, height: 352"),
        ]
        + duo(
            "用五种基本拓扑与四线三态对照图，看清超过 3 个智能体的协作与偏离",
            "靠甲乙两路向中心传决定，配合四件套指针交接、单写者锁与异构智能体独立验收防偏移",
        ),
    ),
)

# ==============================================================================
# Page 04: 实机工作台展示与开源优势 (Native Editable Cards/Table + Croppable Images)
# ==============================================================================
wb_card_1 = box(
    [
        box(
            [T("① 编排与黑板观察台（黑板广播流 + 送达四分外环）", 10.6, BLUE, True), tag("14 视图对账", BLUE, "#E8F0FE", "#93C5FD")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("orig_blackboard_light.png", 366, 204, "borderRadius: 4"),
                img("orig_ring_badge.png", 112, 52, "position: 'absolute', left: 6, top: 146, borderRadius: 3"),
            ],
            "position: 'relative', width: 366, height: 204, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 4, marginTop: 3",
        ),
        T(B("局部聚焦", BLUE) + "：共享黑板广播流、角色送达四分外环（该知/送到/已读/已写）、三态轨迹对照", 9.0, INK, extra="marginTop: 3"),
    ],
    "width: 382, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, padding: '5px 7px', flexDirection: 'column'",
)

wb_card_2 = box(
    [
        box(
            [T("② 宿主调控与反向写回台（渠道矩阵 + Diff 写回）", 10.6, BLUE, True), tag("运行态 + 设计态", GOLD, "#FEF3C7", "#FDE68A")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("orig_console_light.png", 194, 200, "borderRadius: 3"),
                img("orig_reverse_diff.png", 164, 200, "borderRadius: 3"),
            ],
            "width: 366, height: 204, background: '#E2E8F0', border: '1px solid #CBD5E1', borderRadius: 4, padding: '2px', flexDirection: 'row', gap: 4, marginTop: 3",
        ),
        T(B("局部聚焦", BLUE) + "：统管 9 产品 1,707 条会话与 22 把 Key，右侧面板支持 inbox.md 规范 Diff 写回", 9.0, INK, extra="marginTop: 3"),
    ],
    "width: 382, background: '#FFFFFF', border: '1.5px solid #073E87', borderRadius: 6, padding: '5px 7px', flexDirection: 'column'",
)

wb_card_3 = box(
    [
        box(
            [T("③ 移动端实时督工台（/m/ 覆盖桌面端 53%–72% 交互）", 10.6, RED, True), tag("全双工热操控", RED, "#FEE2E2", "#FCA5A5")],
            "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                img("orig_m1_feed.png", 117, 198, "borderRadius: 3"),
                img("orig_m2_steer.png", 117, 198, "borderRadius: 3"),
                img("orig_m3_projects.png", 117, 198, "borderRadius: 3"),
            ],
            "width: 366, height: 204, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4, padding: '2px', flexDirection: 'row', gap: 4, marginTop: 3",
        ),
        T(B("局部聚焦", BLUE) + "：置顶轮内审批待办、工具步骤与 steer 插话发送、跨产品活跃会话池与任务板", 9.0, INK, extra="marginTop: 3"),
    ],
    "width: 384, background: '#FFFFFF', border: '1.5px solid #9D0A12', borderRadius: 6, padding: '5px 7px', flexDirection: 'column'",
)


def p04_col(dim, badge_txt, vs_head, vs_body, our_head, our_body, is_last=False):
    br = "" if is_last else ", borderRight: '1px solid #E5E7EB'"
    return box(
        [
            box([T(dim, 10.5, BLUE, True), tag(badge_txt, BLUE, "#E8F0FE", "#93C5FD")], "flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'"),
            box(
                [T(B(vs_head, RED) + "：" + vs_body, 9.0, "#4B5563", extra="lineHeight: 1.24")],
                "marginTop: 4, background: '#FEF2F2', borderLeft: '2.5px solid #9D0A12', borderRadius: 3, padding: '3px 6px'",
            ),
            box(
                [T(B(our_head, BLUE) + "：" + our_body, 9.1, INK, extra="lineHeight: 1.24")],
                "marginTop: 4, background: '#F0F7FF', borderLeft: '2.5px solid #073E87', borderRadius: 3, padding: '3.5px 6px'",
            ),
        ],
        "flex: 1, padding: '5px 8px', flexDirection: 'column', justifyContent: 'space-between'" + br,
    )


p04_cmp = box(
    [
        box(
            [
                T("相比 35+ 开源智能体项目的 4 个维度对位与独立测试员全量回归实证", 10.5, "#FFFFFF", True),
                T("覆盖 CLI 桥接器 / 编排运行时 / 代码框架 / 遥测看板四大赛道", 9.0, "#FEE2E2"),
            ],
            "height: 23, background: '#9D0A12', padding: '0 10px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'",
        ),
        box(
            [
                p04_col(
                    "1. 调度对象",
                    "调谁",
                    "LangGraph / acpx / opencli",
                    "或只调裸模型 API 需手写工具，或仅走单一协议路线",
                    "三路合一 + 中心跨产品宿主",
                    "协议+CDP+适配器调 7 大可驱动宿主+160+网页；双会话(58/84)与群会话(31/35)中心当宿主",
                ),
                p04_col(
                    "2. 观测与对账",
                    "看什么",
                    "Langfuse / Arize / OTel",
                    "仅记单层细粒度接口流水账，缺粗粒度决策段与跨端对账",
                    "双颗粒度 Trace + 四张表对账",
                    "粗粒度决策段(turn+steps)锚定 9 家会话库；532 格与四张表、三态轨迹实时核对",
                ),
                p04_col(
                    "3. 运行控制",
                    "怎么管",
                    "GasTown / Paperclip / OpenRig",
                    "绑死 POSIX tmux 或单次盲跑，遇写文件权限请求难挂起",
                    "常驻会话轮内审批 (5 产品实测)",
                    "Windows/GUI 全宿主写文件前轮内挂起，手机 /m/ 批准后同轮写出+Codex 线程分叉",
                ),
                p04_col(
                    "4. 协作演进与评测",
                    "怎么改/测",
                    "MetaGPT / CrewAI / 手工抽测",
                    "代码写死 DAG 状态机改流程慢，缺乏独立智能体全矩阵回归",
                    "MD 渐进契约 + 独立测试员全测",
                    "CLAUDE.md 即时重构角色；独立真跑 56 格+3 专项，捕获并修复切免费模型污染默认配置缺陷",
                    True,
                ),
            ],
            "flex: 1, flexDirection: 'row', alignItems: 'stretch'",
        ),
    ],
    "flex: 1, background: '#FFFFFF', border: '1.5px solid #9D0A12', borderRadius: 6, overflow: 'hidden', flexDirection: 'column'",
)

write(
    "04_系统界面",
    page(
        "实机工作台展示与开源优势：三大操控界面局部放大 × 四维对位 35+ 开源项目",
        "① 编排与黑板观察台（14 视图）｜ ② 宿主调控与反向写回台 ｜ ③ 手机端 /m/ 实时督工台 ｜ 四大维度对位主流开源方案",
        [
            box(
                [
                    box([wb_card_1, wb_card_2, wb_card_3], "height: 256, flexDirection: 'row', gap: 10"),
                    p04_cmp,
                ],
                "marginTop: 10, flexDirection: 'column', gap: 8, height: 404",
            ),
        ]
        + duo(
            "桌面端看共享黑板拓扑与反向调控 Diff 写回，手机端 /m/ 随时批权限与插话纠偏",
            "在常驻会话进程中受控运行，由独立测试智能体真跑 56 格与 3 个专项回归验证",
        ),
    ),
)
