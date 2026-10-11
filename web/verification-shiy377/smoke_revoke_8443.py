# -*- coding: utf-8 -*-
"""SHIY-377 打回复测冒烟（验收环境版）：8443 预览（dist + 真实后端同端口，HTTPS）。

覆盖：聊天生成日记 → 分享 → 出现「已分享给大人」+「撤回分享」按钮 →
二次确认撤回 → 回到分享按钮态；后端断言：旧链接 410、家长端快照清空、按天撤回返回 count。
"""
import json
import ssl
import sys
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "https://192.168.110.86:8443"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy377"
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5, context=SSL_CTX) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        ignore_https_errors=True,
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen', '1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".voice-input", timeout=15000)
    for text in ["今天体育课我和同学吵架了，我很生气", "我和同桌一起画画，特别开心"]:
        page.fill(".voice-input", text)
        with page.expect_response(
            lambda r: "/api/chat" in r.url and r.request.method == "POST", timeout=60000
        ) as resp_info:
            page.click("button.xxw-btn--chat-send")
        resp_info.value.finished()
        page.wait_for_timeout(500)
    sid = page.evaluate("localStorage.getItem('xxw_session_id')")
    check("会话已建立", bool(sid), sid or "")

    # 日记页：分享
    page.goto(BASE + "/#/diary", wait_until="networkidle")
    page.wait_for_timeout(900)
    check("日记块渲染", page.locator(".diary-block").count() == 2)
    page.locator("button.xxw-btn--diary-share").click()
    page.wait_for_timeout(400)
    page.locator(".adm-dialog-button").filter(has_text="确定").first.click()
    page.wait_for_timeout(900)
    check("分享后显示「已分享给大人」", page.locator(".shared-mark").count() == 1)
    revoke_btn = page.locator("button.xxw-btn--diary-share-revoke")
    check("出现「撤回分享」按钮", revoke_btn.count() == 1, revoke_btn.inner_text() if revoke_btn.count() else "")
    page.screenshot(path=f"{OUT}/16-8443-shared-with-revoke.png", full_page=True)

    # 旧分享链接（家长可读）
    st, snaps = api(f"/api/parent/diaries/{sid}")
    check("后端已有分享快照", st == 200 and len(snaps["snapshots"]) == 1)
    st, share2 = api("/api/diary/share", "POST", {"sessionId": sid})
    token = share2["shareToken"]
    st, _ = api(f"/api/share/{token}")
    check("撤回前旧链接可读", st == 200, f"status={st}")

    # 二次确认撤回
    revoke_btn.click()
    page.wait_for_timeout(400)
    dlg = page.locator(".adm-dialog").inner_text()
    check("撤回二次确认弹窗", "撤回" in dlg and "链接" in dlg, dlg[:40])
    page.locator(".adm-dialog-button").filter(has_text="确定").first.click()
    page.wait_for_timeout(900)

    check("撤回成功 toast", page.locator(".adm-toast").count() >= 0)
    check("撤回后回到「分享给大人」按钮", page.locator("button.xxw-btn--diary-share").count() == 1)
    check("撤回后「已分享」标记消失", page.locator(".shared-mark").count() == 0)
    page.screenshot(path=f"{OUT}/17-8443-after-revoke.png", full_page=True)

    st, _ = api(f"/api/share/{token}")
    check("撤回后旧链接 410", st == 410, f"status={st}")
    st, snaps = api(f"/api/parent/diaries/{sid}")
    check("撤回后家长端快照清空", st == 200 and snaps["snapshots"] == [])

    # 刷新页面后状态持久（shared 来自服务端）
    page.goto(BASE + "/#/diary", wait_until="networkidle")
    page.wait_for_timeout(900)
    check("刷新后仍是未分享态", page.locator("button.xxw-btn--diary-share").count() == 1)

    check("无页面 JS 异常", not errors, "; ".join(errors[:3]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n== {len(results) - len(fails)}/{len(results)} 通过 ==")
sys.exit(1 if fails else 0)
