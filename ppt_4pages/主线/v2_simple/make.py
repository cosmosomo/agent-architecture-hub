# -*- coding: utf-8 -*-
"""v2_simple 页面组装：统一页眉页脚（取自 05.slide）+ 每页正文 body/*.body → v2_simple/*.slide
用法：uv run python make.py <总页数>
"""
import os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '05.slide')
TOTAL = sys.argv[1] if len(sys.argv) > 1 else '5'

t = open(SRC, encoding='utf-8').read()
head = t[:t.index("    <Box style={{ position: 'relative', zIndex: 1")]
head = head.replace(
    "Agent-Architecture-Hub · 全生态能力渠道与渐进式多智能体系统",
    "Agent-Architecture-Hub · 跨客户端多智能体协同与受控运行系统",
).replace(
    "Agent-Architecture-Hub ｜ 官方协议 + CDP + 适配器三路合一 · 126 项能力单元矩阵 · 五种编排拓扑与三态对照",
    "Agent-Architecture-Hub ｜ 多通道客户端接入 · 共享工作区黑板 · 两级轨迹追溯与实时纠偏",
)
tail = "</Slide>\n"

for body_path in sorted(glob.glob(os.path.join(HERE, 'body', '*.body'))):
    name = os.path.splitext(os.path.basename(body_path))[0]
    no = int(name.split('_')[0])
    label = '%d / %s' % (no, TOTAL)
    h = re.sub(r'>\d+ / \d+<', '>' + label + '<', head)
    body = open(body_path, encoding='utf-8').read()
    out = os.path.join(HERE, name + '.slide')
    open(out, 'w', encoding='utf-8').write(h + body.rstrip() + '\n' + tail)
    print('built', name)
