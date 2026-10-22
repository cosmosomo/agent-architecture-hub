# -*- coding: utf-8 -*-
import os
from playwright.sync_api import sync_playwright

IMG_DIR = r"E:\program\GIT\Agent\multi\Agent-Architecture-Hub\ppt_4pages\主线\img"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
    ctx = browser.new_context(viewport={"width": 1600, "height": 1000}, color_scheme="light")
    page = ctx.new_page()

    # Set light theme in localStorage
    page.goto("http://127.0.0.1:8899/", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('hub.theme', 'light'); document.documentElement.setAttribute('data-theme', 'light');")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1800)

    # 1. Main Observatory - View 1 (Full Collaboration Graph)
    page.screenshot(path=os.path.join(IMG_DIR, "snap_obs_full_light.png"))
    print("saved snap_obs_full_light.png")

    # Click view 1 (完整协作) and view 4 (业务流程)
    btns = page.locator("#tbMain button")
    if btns.count() >= 4:
        btns.nth(0).click()
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(IMG_DIR, "snap_obs_view1_light.png"))
        print("saved snap_obs_view1_light.png")
        btns.nth(3).click()
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(IMG_DIR, "snap_obs_process_light.png"))
        print("saved snap_obs_process_light.png")

    # 2. Console page (/console/) - Kanban Board
    page.goto("http://127.0.0.1:8899/console/", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('hub.theme', 'light'); document.documentElement.setAttribute('data-theme', 'light');")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    board_btn = page.locator("[data-view='board']")
    if board_btn.count() > 0:
        board_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(IMG_DIR, "snap_console_board_light.png"))
        print("saved snap_console_board_light.png")

    # 3. Capability Matrix page via file:///
    page.goto("file:///E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/capability-matrix.html", wait_until="domcontentloaded")
    page.evaluate("document.documentElement.setAttribute('data-theme', 'light');")
    page.wait_for_timeout(1000)
    page.screenshot(path=os.path.join(IMG_DIR, "snap_cap_matrix_light.png"))
    print("saved snap_cap_matrix_light.png")

    browser.close()
