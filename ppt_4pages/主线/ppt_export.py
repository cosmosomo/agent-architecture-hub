# -*- coding: utf-8 -*-
"""Export 4-page deck via Office PowerPoint COM, check overflow, and stitch 2x2 overview sheet."""
import os
import shutil
import sys
import time

sys.path.insert(
    0,
    r"E:\program\GIT\Jobs\09_招聘追踪\行业调研_可控核聚变\能量奇点\面试准备_20261016_光学诊断\汤星宇_能量奇点光学诊断_20261016\interactive\tools",
)
import ppt_view  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402


def overflow(sl):
    out = []
    for s in sl.Shapes:
        try:
            if s.HasTextFrame and s.TextFrame2.HasText and s.TextFrame2.AutoSize == 0:
                tf = s.TextFrame2
                need = tf.TextRange.BoundHeight + tf.MarginTop + tf.MarginBottom
                if need > s.Height + 1.5:
                    out.append((tf.TextRange.Text[:20], round((need - s.Height) / 0.75, 1)))
        except Exception:
            pass
    return out


def sheet(pngs, path, cols=2, w=800):
    h = w * 9 // 16
    rows = (len(pngs) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * (w + 16) + 16, rows * (h + 44) + 16), "#D1D5DB")
    font = ImageFont.truetype("msyh.ttc", 22)
    d = ImageDraw.Draw(canvas)
    for k, (no, p) in enumerate(pngs):
        x, y = 16 + (k % cols) * (w + 16), 16 + (k // cols) * (h + 44)
        canvas.paste(Image.open(p).convert("RGB").resize((w, h), Image.LANCZOS), (x, y + 32))
        d.text((x, y), "第 %d 页" % no, fill="#111827", font=font)
    canvas.save(path)


def main():
    src, out = sys.argv[1], os.path.abspath(sys.argv[2])
    os.makedirs(out, exist_ok=True)
    copy = os.path.join(out, "_copy_" + os.path.basename(src))
    shutil.copyfile(src, copy)
    before = ppt_view.ppt_pids()
    pres = ppt_view.open_in_office(copy)
    app = pres.Application
    done = []
    try:
        for i in range(1, pres.Slides.Count + 1):
            sl = pres.Slides(i)
            png = os.path.join(out, "p%02d.png" % i)
            sl.Export(png, "PNG", 1920, 1080)
            over = overflow(sl)
            done.append((i, png))
            note = ""
            try:
                for sh in sl.NotesPage.Shapes:
                    if sh.Type == 14 and sh.PlaceholderFormat.Type == 2 and sh.HasTextFrame:
                        note = sh.TextFrame.TextRange.Text
            except Exception:
                pass
            print(
                "第 %2d 页 %s%s"
                % (i, "溢出 %s" % over if over else "OK", "  备注 %d 字" % len(note) if note else "")
            )
    finally:
        pres.Saved = -1
        pres.Close()
        if not before:
            try:
                app.Quit()
            except Exception:
                pass
            time.sleep(2)
            for pid in ppt_view.ppt_pids() - before:
                os.system("taskkill /PID %d /F >nul 2>nul" % pid)
        try:
            os.remove(copy)
        except OSError:
            pass
    if done:
        sheet(done, os.path.join(out, "总览_01-04.png"))


if __name__ == "__main__":
    main()
