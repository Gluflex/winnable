"""Screenshots for the README, with the page clock pinned so they match the video and submission.

    <python with playwright> tests/readme_shots.py [base-url] [iso-time]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090/site/"
NOW = sys.argv[2] if len(sys.argv) > 2 else None
OUT = Path(__file__).resolve().parent.parent / "docs" / "img"
PROFILE = {"country": "Switzerland", "adult": True, "student": "university", "team": True, "onlineOnly": True, "github": "Gluflex"}
errors = []


def page_for(browser, **ctx):
    c = browser.new_context(**ctx)
    if NOW:
        c.clock.set_fixed_time(NOW)
    c.add_init_script(f"localStorage.setItem('winnable:profile', {json.dumps(json.dumps(PROFILE))})")
    p = c.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(BASE)
    p.wait_for_selector("#rows .row", timeout=20000)
    p.wait_for_timeout(1500)  # GitHub match markers
    return p


with sync_playwright() as pw:
    b = pw.chromium.launch()
    for scheme, name in (("light", "board.png"), ("dark", "board-dark.png")):
        p = page_for(b, viewport={"width": 1280, "height": 860}, color_scheme=scheme)
        p.select_option("#sortSel", "ev"); p.wait_for_timeout(900)
        p.screenshot(path=str(OUT / name))
        if scheme == "light":
            p.click("#rows .row:has-text('Meta VR Start')"); p.wait_for_timeout(900)
            p.screenshot(path=str(OUT / "detail.png"))
            p.keyboard.press("Escape"); p.wait_for_timeout(300)
            p.click("#howBtn"); p.wait_for_timeout(900)
            p.screenshot(path=str(OUT / "how-the-odds-work.png"))
    p = page_for(b, viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p.select_option("#sortSel", "ev"); p.wait_for_timeout(900)
    p.screenshot(path=str(OUT / "phone.png"))
    b.close()
print("errors:", errors or "none")
