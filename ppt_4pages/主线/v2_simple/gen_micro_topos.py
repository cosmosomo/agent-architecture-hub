# -*- coding: utf-8 -*-
"""Generate 3x supersampled anti-aliased micro-topology diagrams (Tufte's Small Multiples)
into E:/program/GIT/Agent/multi/Agent-Architecture-Hub/ppt_4pages/主线/img/
Zero long text inside images — pure geometric nodes, directed curves/arrows, and 1-2 char node badges.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

IMG_DIR = r"E:\program\GIT\Agent\multi\Agent-Architecture-Hub\ppt_4pages\主线\img"
os.makedirs(IMG_DIR, exist_ok=True)

SCALE = 3
NAVY = (30, 58, 138, 255)
COBALT = (55, 48, 163, 255)
AMBER = (217, 119, 6, 255)
GREEN = (4, 120, 87, 255)
CRIMSON = (157, 10, 18, 255)
SLATE = (100, 116, 139, 255)
LIGHT_INDIGO = (238, 242, 255, 255)
LIGHT_AMBER = (254, 243, 199, 255)
LIGHT_GREEN = (236, 253, 245, 255)
WHITE = (255, 255, 255, 255)


def get_font(px):
    for fp in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, int(px * SCALE))
    return ImageFont.load_default()


def new_canvas(w, h, bg=WHITE):
    return Image.new("RGBA", (w * SCALE, h * SCALE), bg)


def save_aa(im, name, w, h):
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    out.save(os.path.join(IMG_DIR, name))
    print("saved", name, f"{w}x{h}")


def draw_arrow(draw, x1, y1, x2, y2, col=COBALT, width=2.2, head=6.5):
    X1, Y1, X2, Y2 = x1 * SCALE, y1 * SCALE, x2 * SCALE, y2 * SCALE
    W = max(1, int(width * SCALE))
    H = head * SCALE
    draw.line([(X1, Y1), (X2, Y2)], fill=col, width=W)
    ang = math.atan2(Y2 - Y1, X2 - X1)
    p1 = (X2, Y2)
    p2 = (X2 - H * math.cos(ang - 0.48), Y2 - H * math.sin(ang - 0.48))
    p3 = (X2 - H * math.cos(ang + 0.48), Y2 - H * math.sin(ang + 0.48))
    draw.polygon([p1, p2, p3], fill=col)


def draw_node(draw, cx, cy, r, fill_col, label="", txt_col=WHITE, fsize=10):
    CX, CY, R = cx * SCALE, cy * SCALE, r * SCALE
    # subtle halo
    draw.ellipse([CX - R - 2 * SCALE, CY - R - 2 * SCALE, CX + R + 2 * SCALE, CY + R + 2 * SCALE], fill=(241, 245, 249, 255))
    draw.ellipse([CX - R, CY - R, CX + R, CY + R], fill=fill_col)
    if label:
        f = get_font(fsize)
        bb = draw.textbbox((0, 0), label, font=f)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        draw.text((CX - tw / 2, CY - th / 2 - bb[1]), label, font=f, fill=txt_col)


def draw_pill_node(draw, cx, cy, w, h, fill_col, border_col, label, txt_col=COBALT, fsize=9.5):
    X1, Y1 = int((cx - w / 2) * SCALE), int((cy - h / 2) * SCALE)
    X2, Y2 = int((cx + w / 2) * SCALE), int((cy + h / 2) * SCALE)
    draw.rounded_rectangle([X1, Y1, X2, Y2], radius=int(4 * SCALE), fill=fill_col, outline=border_col, width=int(1.6 * SCALE))
    if label:
        f = get_font(fsize)
        bb = draw.textbbox((0, 0), label, font=f)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        draw.text(((X1 + X2 - tw) / 2, (Y1 + Y2 - th) / 2 - bb[1]), label, font=f, fill=txt_col)


# 1. Four Basic Transfer Primitives (116 x 42 each)
W_P, H_P = 116, 42

# P1: Relay A -> B -> C
im = new_canvas(W_P, H_P)
d = ImageDraw.Draw(im)
draw_arrow(d, 26, 21, 47, 21, COBALT)
draw_arrow(d, 69, 21, 90, 21, GREEN)
draw_node(d, 16, 21, 10, COBALT, "A", WHITE, 9.5)
draw_node(d, 58, 21, 10, GREEN, "B", WHITE, 9.5)
draw_node(d, 100, 21, 10, COBALT, "C", WHITE, 9.5)
save_aa(im, "topo_prim_1_relay.png", W_P, H_P)

# P2: Fan-out A -> B1, B2
im = new_canvas(W_P, H_P)
d = ImageDraw.Draw(im)
draw_arrow(d, 32, 20, 78, 11, COBALT)
draw_arrow(d, 32, 22, 78, 31, COBALT)
draw_node(d, 22, 21, 10, COBALT, "A", WHITE, 9.5)
draw_node(d, 90, 10, 8.5, GREEN, "B1", WHITE, 8.0)
draw_node(d, 90, 32, 8.5, GREEN, "B2", WHITE, 8.0)
save_aa(im, "topo_prim_2_fanout.png", W_P, H_P)

# P3: Fan-in B1, B2 -> C
im = new_canvas(W_P, H_P)
d = ImageDraw.Draw(im)
draw_arrow(d, 36, 11, 80, 20, GREEN)
draw_arrow(d, 36, 31, 80, 22, GREEN)
draw_node(d, 25, 10, 8.5, GREEN, "B1", WHITE, 8.0)
draw_node(d, 25, 32, 8.5, GREEN, "B2", WHITE, 8.0)
draw_node(d, 92, 21, 10, COBALT, "C", WHITE, 9.5)
save_aa(im, "topo_prim_3_fanin.png", W_P, H_P)

# P4: Round-trip A <-> B
im = new_canvas(W_P, H_P)
d = ImageDraw.Draw(im)
draw_arrow(d, 36, 15, 80, 15, COBALT)
draw_arrow(d, 80, 27, 36, 27, AMBER)
draw_node(d, 24, 21, 10, COBALT, "A", WHITE, 9.5)
draw_node(d, 92, 21, 10, AMBER, "审", WHITE, 9.5)
save_aa(im, "topo_prim_4_loop.png", W_P, H_P)

# 2. Three High-Order Composite Topologies (150 x 40 each)
W_C, H_C = 150, 40

# Comp 1: Dual-Blind + 5-Mind Debate
im = new_canvas(W_C, H_C, (255, 251, 235, 255))
d = ImageDraw.Draw(im)
draw_arrow(d, 24, 11, 50, 19, COBALT, 1.8, 5)
draw_arrow(d, 24, 29, 50, 21, COBALT, 1.8, 5)
draw_arrow(d, 68, 20, 92, 20, CRIMSON, 1.8, 5)
draw_arrow(d, 110, 20, 128, 20, GREEN, 1.8, 5)
draw_node(d, 15, 10, 7.5, COBALT, "盲1", WHITE, 7.2)
draw_node(d, 15, 30, 7.5, COBALT, "盲2", WHITE, 7.2)
draw_node(d, 59, 20, 9, CRIMSON, "反", WHITE, 8.5)
draw_node(d, 101, 20, 9, AMBER, "验", WHITE, 8.5)
draw_node(d, 137, 20, 9, GREEN, "合", WHITE, 8.5)
save_aa(im, "topo_comp_1_debate.png", W_C, H_C)

# Comp 2: Supervisor + DAG Task Pool + Heterogeneous Verify
im = new_canvas(W_C, H_C, (238, 242, 255, 255))
d = ImageDraw.Draw(im)
draw_arrow(d, 24, 20, 44, 20, COBALT, 1.8, 5)
draw_arrow(d, 74, 20, 92, 20, COBALT, 1.8, 5)
draw_arrow(d, 110, 20, 128, 20, GREEN, 1.8, 5)
draw_node(d, 15, 20, 9, NAVY, "主", WHITE, 8.5)
draw_pill_node(d, 59, 20, 28, 22, WHITE, COBALT, "DAG", COBALT, 8.0)
draw_node(d, 101, 20, 9, COBALT, "执", WHITE, 8.5)
draw_node(d, 137, 20, 9, GREEN, "验", WHITE, 8.5)
save_aa(im, "topo_comp_2_dag.png", W_C, H_C)

# Comp 3: Long-Role Short-Instance Relay
im = new_canvas(W_C, H_C, (236, 253, 245, 255))
d = ImageDraw.Draw(im)
# Top persistent role bar
d.rounded_rectangle([10 * SCALE, 4 * SCALE, 140 * SCALE, 14 * SCALE], radius=3 * SCALE, fill=COBALT)
f_sm = get_font(7.5)
bb = d.textbbox((0, 0), "常驻角色与记忆指针脊梁", font=f_sm)
d.text(((150 * SCALE - (bb[2] - bb[0])) / 2, 5 * SCALE - bb[1]), "常驻角色与记忆指针脊梁", font=f_sm, fill=WHITE)
# Bottom 3 short instances
draw_arrow(d, 40, 29, 60, 29, GREEN, 1.8, 5)
draw_arrow(d, 90, 29, 110, 29, GREEN, 1.8, 5)
draw_pill_node(d, 25, 29, 26, 15, WHITE, GREEN, "S1", GREEN, 8.0)
draw_pill_node(d, 75, 29, 26, 15, WHITE, GREEN, "S2", GREEN, 8.0)
draw_pill_node(d, 125, 29, 26, 15, WHITE, AMBER, "S3", AMBER, 8.0)
save_aa(im, "topo_comp_3_relay.png", W_C, H_C)
