# -*- coding: utf-8 -*-
"""把 notes.json 写进 pptx 的讲者备注，并为第 5 页的原始全尺寸截图设置 PowerPoint 原生无损裁剪（crop_left/top/right/bottom）。
用户在 PowerPoint 中右键任意截图点击「裁剪」，即可直接拖拽调整完整原图的视野范围！
"""
import json
import sys

from lxml import etree
from pptx import Presentation

BODY = ('<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<p:nvSpPr><p:cNvPr id="%d" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
        '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>'
        '<p:spPr><a:xfrm><a:off x="685800" y="6096000"/><a:ext cx="5486400" cy="5486400"/></a:xfrm></p:spPr>'
        '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>')

deck, notes_path = sys.argv[1], sys.argv[2]
notes = {k: v for k, v in json.load(open(notes_path, encoding='utf-8')).items() if not k.startswith('_')}
prs = Presentation(deck)

# 1. 写入讲者备注
for k, text in sorted(notes.items(), key=lambda kv: int(kv[0])):
    idx = int(k) - 1
    if idx < len(prs.slides):
        ns = prs.slides[idx].notes_slide
        if ns.notes_text_frame is None:
            tree = ns.shapes._spTree
            ids = [int(i) for i in tree.xpath('.//p:cNvPr/@id')] or [1]
            tree.append(etree.fromstring(BODY % (max(ids) + 1)))
        ns.notes_text_frame.text = text

# 2. 为第 6 页 (06_实机协同界面) 的独立全尺寸原图应用 PowerPoint 原生无损局部裁剪 (严格等比例 0% 拉伸变形)
if len(prs.slides) >= 6:
    s6 = prs.slides[5]
    # 仅筛选内容区图片 (100pt < top < 340pt)，按 (left, top) 从左到右排序，绝不触碰顶部校徽与底图
    content_pics = sorted(
        [sh for sh in s6.shapes if sh.shape_type == 13 and 100 < sh.top.pt < 340],
        key=lambda s: (round(s.left.pt, 1), round(s.top.pt, 1)),
    )
    # 展示框比例：前两张 360x276 (1.3043)，后两张手机图 174x276 (0.6304)
    # 裁剪后像素：1304x1000 (1.3040) 与 375x595 (0.6303)，长宽比误差 <0.03%，彻底消除压缩变形
    crops = [
        (268 / 1600, 0.0, 28 / 1600, 0.0),
        (268 / 1600, 0.0, 28 / 1600, 0.0),
        (0.0, 0.0, 0.0, 217 / 812),
        (0.0, 217 / 812, 0.0, 0.0),
    ]
    for sh, (cl, ct, cr, cb) in zip(content_pics, crops):
        sh.crop_left = round(cl, 5)
        sh.crop_top = round(ct, 5)
        sh.crop_right = round(cr, 5)
        sh.crop_bottom = round(cb, 5)
    print(f'applied zero-distortion native PowerPoint crops to {len(content_pics)} content pictures on Slide 6')

prs.save(deck)
print('notes ->', ', '.join(sorted(notes, key=int)))
