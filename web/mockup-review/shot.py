#!/usr/bin/env python3
"""「小小我」mockup 截图脚本：HTTP 服务 + playwright 截 9 张 720x1280 PNG。"""
import http.server, socketserver, threading, functools, os, sys
from playwright.sync_api import sync_playwright

ROOT = "/home/xixil/xiaoxiaowo"
PAGES = "/web/mockup-review/pages"
OUT = os.path.join(ROOT, "web/mockup-review/out")
PORT = 8799

FILES = [
    "01-stage-empty", "02-calendar-child", "03-diary", "04-me",
    "05-parent-guide-diary", "06-parent-empty", "07-parent-calendar",
    "08-voice", "09-text-chat",
]
if len(sys.argv) > 1:
    FILES = [f for f in FILES if any(f.startswith(a) for a in sys.argv[1:])]

os.makedirs(OUT, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", args=["--force-device-scale-factor=2"])
    for name in FILES:
        page = browser.new_page(viewport={"width": 360, "height": 640}, device_scale_factor=2)
        msgs = []
        page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: msgs.append(f"[pageerror] {e}"))
        url = f"http://127.0.0.1:{PORT}{PAGES}/{name}.html"
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        path = os.path.join(OUT, f"{name}.png")
        page.screenshot(path=path)
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
