#!/usr/bin/env python3
"""家长端证据截图：serve web/dist + playwright（chrome channel, 390x844, dsf=2）。

用法（需先 VITE_MOCK_API=1 npm run build）：
  python3 shot_parent.py            # 默认四张：三态首页 + 日历
  python3 shot_parent.py button     # 按钮覆盖证据
  python3 shot_parent.py page       # 页面覆盖证据
"""
import datetime
import functools
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = "/home/xixil/xiaoxiaowo"
DIST = os.path.join(ROOT, "web/dist")
OUT = os.path.join(ROOT, "web/mockup-review/out/evidence")
PORT = 8801

ninth = datetime.date.today().replace(day=9).isoformat()

SETS = {
    "default": [
        ("05-home-both", "/#/parent?mockState=both"),
        ("06-home-empty", "/#/parent?mockState=empty"),
        ("home-guide-only", "/#/parent?mockState=guideOnly"),
        ("07-calendar", f"/#/parent/calendar?mockState=both&date={ninth}"),
    ],
    "button": [("override-button", "/#/parent?mockState=both")],
    "page": [("override-page", "/#/parent?mockState=both")],
}

which = sys.argv[1] if len(sys.argv) > 1 else "default"
os.makedirs(OUT, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIST)
httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    for name, path in SETS[which]:
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        msgs = []
        page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: msgs.append(f"[pageerror] {e}"))
        page.goto(f"http://127.0.0.1:{PORT}/{path}", wait_until="networkidle")
        page.wait_for_timeout(900)
        page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=False)
        bad = [m for m in msgs if "error" in m.lower() or "404" in m or "failed" in m.lower()]
        if bad:
            errors.append((name, bad))
        print(f"OK {name}.png", flush=True)
        page.close()
    browser.close()
httpd.shutdown()

if errors:
    print("\n--- console issues ---")
    for n, b in errors:
        print(n, *b, sep="\n  ")
    sys.exit(1)
print("\nall done")
