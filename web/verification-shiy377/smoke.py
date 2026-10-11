# -*- coding: utf-8 -*-
"""SHIY-377 移动端冒烟（真实后端：localhost:8017，经 vite:5180 代理）。
覆盖：聊天生成日记 → 日记页（分块编辑/我改的/删除重算/确认/分享）→ 日历（色块/不串页/空态）→ 我的。
"""
import json
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5180"
API = "http://localhost:8017"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy377"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 1. 首页：发三条不同情绪的聊天，生成真实日记数据
    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen', '1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".voice-input", timeout=15000)
    for text in ["今天体育课我和同学吵架了，我很生气", "我和同桌一起画画，特别开心", "放学下雨没带伞，我有点难过"]:
        page.fill(".voice-input", text)
        page.click("button.xxw-btn--chat-send")
        page.wait_for_timeout(1200)
    sid = page.evaluate("localStorage.getItem('xxw_session_id')")
    check("会话已建立", bool(sid), sid or "")

    heart = api(f"/api/mood/{sid}")
    check("后端情绪计票（三事件并列）", heart.get("votes") == {"anger": 1, "joy": 1, "sadness": 1}, json.dumps(heart.get("votes"), ensure_ascii=False))
    check("并列最高三色", sorted(heart.get("colors", [])) == ["anger", "joy", "sadness"] and heart.get("gradient"), str(heart.get("colors")))

    # 2. 日记页
    page.goto(BASE + "/#/diary", wait_until="networkidle")
    page.wait_for_timeout(800)
    blocks = page.locator(".diary-block")
    check("日记页三块", blocks.count() == 3, f"count={blocks.count()}")
    check("当天唯一提示", page.locator(".xwdiary-unique").count() == 1)
    mood = page.locator(".diary-mood-line").inner_text()
    check("心情颜色并列显示", "开心" in mood and "生气" in mood and "难过" in mood, mood)
    segs = page.locator(".stats-seg").count()
    check("情绪占比三段", segs == 3, f"segs={segs}")
    page.screenshot(path=f"{OUT}/01-diary-real.png", full_page=True)

    # 2a. 分块编辑 → 我改的标识
    page.locator("button.xxw-btn--diary-block-edit").first.click()
    page.wait_for_selector(".block-textarea")
    page.fill(".block-textarea", "今天体育课吵架了，后来我们说好轮流玩，我不那么生气了。")
    page.locator("button.xxw-btn--diary-block-save").click()
    page.wait_for_timeout(800)
    check("用户修改标识「我改的」", page.locator(".block-badge").count() == 1)
    d = api(f"/api/diary?sessionId={sid}")
    edited = [b for b in d["blocks"] if b["locked"]]
    check("后端块已锁定(locked)", len(edited) == 1 and "轮流玩" in edited[0]["text"], edited[0]["text"][:20] if edited else "")
    page.screenshot(path=f"{OUT}/02-diary-edited.png", full_page=True)

    # 2b. 删除事件 → 统计重算
    page.locator("button.xxw-btn--diary-event-delete").first.click()
    page.wait_for_timeout(400)
    page.locator(".adm-dialog-button").filter(has_text="确定").first.click()
    page.wait_for_timeout(900)
    blocks2 = page.locator(".diary-block").count()
    heart2 = api(f"/api/mood/{sid}")
    check("删除后剩两块", blocks2 == 2, f"count={blocks2}")
    check("删除后统计重算(2票)", sum(heart2.get("votes", {}).values()) == 2, json.dumps(heart2.get("votes"), ensure_ascii=False))
    page.screenshot(path=f"{OUT}/03-diary-after-delete.png", full_page=True)

    # 2c. 确认日记
    page.locator("button.xxw-btn--diary-confirm").click()
    page.wait_for_timeout(800)
    check("确认后显示已确认", page.locator(".xwdiary-confirmed").count() == 1)
    st = api(f"/api/diary?sessionId={sid}")
    check("后端日记状态 confirmed", st["diary"]["status"] == "confirmed", st["diary"]["status"])

    # 2d. 分享
    page.locator("button.xxw-btn--diary-share").click()
    page.wait_for_timeout(400)
    page.locator(".adm-dialog-button").filter(has_text="确定").first.click()
    page.wait_for_timeout(900)
    check("已分享标记", page.locator(".shared-mark").count() == 1)
    snaps = api(f"/api/parent/diaries/{sid}")
    check("后端生成分享快照", len(snaps.get("snapshots", [])) == 1, f"snapshots={len(snaps.get('snapshots', []))}")
    page.screenshot(path=f"{OUT}/04-diary-shared.png", full_page=True)

    # 3. 日历页
    page.goto(BASE + "/#/calendar", wait_until="networkidle")
    page.wait_for_timeout(900)
    today_cell = page.locator(".xwcal-cell.xwcal-today")
    check("今天格存在且着色", today_cell.count() == 1 and "xwcal-colored" in (today_cell.get_attribute("class") or ""))
    fill = today_cell.locator(".xwcal-fill")
    bg = fill.evaluate("el => getComputedStyle(el).backgroundImage") if fill.count() else ""
    check("并列最高渐变", "gradient" in bg, bg[:60])
    page.screenshot(path=f"{OUT}/05-calendar-real.png", full_page=True)

    # 3a. 月份切换不串页：切到下月应无着色格
    page.locator("button.xxw-btn--calendar-next-month").click()
    page.wait_for_timeout(700)
    colored = page.locator(".xwcal-cell.xwcal-colored").count()
    check("切换月份不串页（下月无色块）", colored == 0, f"colored={colored}")
    page.screenshot(path=f"{OUT}/06-calendar-next-month.png", full_page=True)
    page.locator("button.xxw-btn--calendar-prev-month").click()
    page.wait_for_timeout(700)

    # 3b. 点击空日期 → 日记页统一空态
    empty_day = page.locator(".xwcal-cell", has_text="15").first
    empty_day.click()
    page.wait_for_timeout(900)
    check("空日期进入统一空态", page.locator(".empty-state").count() == 1 and "没有留下日记" in page.locator(".empty-state").inner_text())
    page.screenshot(path=f"{OUT}/07-diary-empty-day.png", full_page=True)

    # 3c. 再点今天 → 日记正常显示（验证日期切换不串页）
    page.goto(BASE + "/#/calendar", wait_until="networkidle")
    page.wait_for_timeout(700)
    page.locator(".xwcal-cell.xwcal-today").click()
    page.wait_for_timeout(900)
    check("空日期→今天切换不串页", page.locator(".diary-block").count() == 2, f"blocks={page.locator('.diary-block').count()}")

    # 4. 我的页
    page.goto(BASE + "/#/me", wait_until="networkidle")
    page.wait_for_timeout(700)
    entries = page.locator(".me-entry").count()
    check("我的页四个入口", entries == 4, f"entries={entries}")
    check("演示绑定徽章", page.locator(".xwme-badge").count() == 1)
    page.screenshot(path=f"{OUT}/08-me.png", full_page=True)
    # 演示家长入口可用
    page.locator("button.xxw-btn--me-entry-guardian").click()
    page.wait_for_timeout(1200)
    check("家长视角入口可跳转", "/parent" in page.url, page.url)
    page.screenshot(path=f"{OUT}/09-parent-from-me.png", full_page=True)

    check("无页面 JS 异常", not errors, "; ".join(errors[:3]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n== {len(results) - len(fails)}/{len(results)} 通过 ==")
sys.exit(1 if fails else 0)
