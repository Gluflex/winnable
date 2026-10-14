"""Quick screenshot of one page state for slice checks.

    <python with playwright> tests/shot.py <url> <out.png> [width] [height] [dark]
"""
import sys
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
scheme = "dark" if len(sys.argv) > 5 and sys.argv[5] == "dark" else "light"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme).new_page()
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_timeout(2500)
    page.screenshot(path=out)
    b.close()
print("errors:", errors or "none")
sys.exit(1 if [e for e in errors if "Failed to load resource" not in e] else 0)
