# -*- coding: utf-8 -*-
"""v1 页面组装：统一页眉页脚（取自 v0 正文页）+ 每页正文 body/*.body → v1/*.slide
用法：python make.py <总页数>
"""
import os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '05.slide')          # v0 正文页，取页眉页脚
TOTAL = sys.argv[1] if len(sys.argv) > 1 else '17'

t = open(SRC, encoding='utf-8').read()
head = t[:t.index("    <Box style={{ position: 'relative', zIndex: 1")]
tail = "</Slide>\n"

for body_path in sorted(glob.glob(os.path.join(HERE, 'body', '*.body'))):
    name = os.path.splitext(os.path.basename(body_path))[0]   # 如 03_P3
    no = int(name.split('_')[0])
    if no <= int(TOTAL):
        label = '%d / %s' % (no, TOTAL)
    else:
        label = '备用 · 深潜' if '深潜' in name else '备用'
    h = re.sub(r'>\d+ / \d+<', '>' + label + '<', head)
    h = h.replace("双颗粒度追踪", "两级轨迹追溯")
    body = open(body_path, encoding='utf-8').read()
    out = os.path.join(HERE, name + '.slide')
    open(out, 'w', encoding='utf-8').write(h + body.rstrip() + '\n' + tail)
    print('built', name)
