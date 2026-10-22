# -*- coding: utf-8 -*-
"""Prepare original full-resolution workbench screenshots in 主线/img/ for native PowerPoint cropping."""
import shutil
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
IMG_DIR = HERE.parent / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

DIR_V4_SHOTS = Path(
    r"E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\研究任务书_20261014\成果\方向1\协作图演示_v4\截图"
)
DIR_DIR1 = Path(
    r"E:\program\GIT\Jobs\08_简历设计工作区\02_项目打磨与展示\智能体技术\多智能体协作\研究任务书_20261014\成果\方向1"
)
DIR_MOBILE = Path(
    r"E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\results\screenshots-m-v2"
)


def main() -> None:
    # Copy full original screenshots so PowerPoint retains 100% uncropped image data for native Crop tool!
    copies = [
        (DIR_V4_SHOTS / "02_light_whowhen24_collapsed.png", IMG_DIR / "orig_blackboard_light.png"),
        (DIR_DIR1 / "hub_02_light_1280_panel_dedup.png", IMG_DIR / "orig_console_light.png"),
        (DIR_V4_SHOTS / "04_dark_reverse_control_diff.png", IMG_DIR / "orig_reverse_diff.png"),
        (DIR_MOBILE / "20_feed_view_default.png", IMG_DIR / "orig_m1_feed.png"),
        (DIR_MOBILE / "10_composer_with_text.png", IMG_DIR / "orig_m2_steer.png"),
        (DIR_MOBILE / "24_projects_view.png", IMG_DIR / "orig_m3_projects.png"),
    ]
    for src, dst in copies:
        shutil.copy2(src, dst)
        im = Image.open(dst)
        print(f"[ok] {dst.name} (full original {im.size[0]}x{im.size[1]} px)")

    # Also save movable badge overlay for Card 1 ('送达四分外环 · 共享黑板') as an independent PPT picture
    im_bb = Image.open(DIR_V4_SHOTS / "02_light_whowhen24_collapsed.png").convert("RGB")
    ring_badge = im_bb.crop((10, 700, 332, 850))
    ring_path = IMG_DIR / "orig_ring_badge.png"
    ring_badge.save(ring_path, format="PNG", optimize=True)
    print(f"[ok] {ring_path.name} ({ring_badge.size[0]}x{ring_badge.size[1]} px independent overlay)")


if __name__ == "__main__":
    main()
