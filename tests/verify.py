"""Drive the board in a real browser, fail on console errors, write screenshots.

    <python with playwright> tests/verify.py [base-url] [out-dir]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090/site/"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "docs" / "screens")
OUT.mkdir(parents=True, exist_ok=True)
errors = []


def run(ctx, tag, steps):
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and errors.append(f"{tag}: {m.text}"))
    page.on("pageerror", lambda e: errors.append(f"{tag}: {e}"))
    page.goto(BASE)
    page.wait_for_selector("#rows .row", timeout=20000)
    page.wait_for_timeout(800)
    for name, fn in steps:
        fn(page)
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / f"{tag}-{name}.png"), full_page=name.endswith("full"))
        print("  shot", f"{tag}-{name}")
    page.close()


def set_profile(page):
    if page.locator("#panel[hidden]").count():
        page.click("#youBtn")
    page.wait_for_timeout(300)
    if page.locator("#pfCountry").count():
        page.select_option("#pfCountry", "Switzerland")
        page.select_option("#pfAdult", "yes")
        page.select_option("#pfStudent", "university")
        page.check("#pfTeam")
        page.fill("#pfGithub", "Gluflex")
        page.click("#pfDone")


def open_top(page):
    page.click("#rows .row >> nth=0")


def close_panel(page):
    if page.locator("#panel:not([hidden])").count():
        page.keyboard.press("Escape")


steps = [
    ("first", lambda p: None),
    ("profile", set_profile),
    ("board", lambda p: (close_panel(p), p.wait_for_timeout(1500))),
    ("detail", open_top),
    ("how", lambda p: (close_panel(p), p.click("#howBtn") if p.locator("#howBtn").count() else None)),
    ("board-full", close_panel),
]

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for scheme in ("light", "dark"):
        run(b.new_context(viewport={"width": 1280, "height": 860}, color_scheme=scheme), f"desk-{scheme}", steps)
    run(b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True), "phone-light", steps)
    b.close()

real = [e for e in errors if "Failed to load resource" not in e]
print("console errors:", len(errors), "| non-network:", len(real))
for e in errors[:15]:
    print("  ", e[:220])
sys.exit(1 if real else 0)
