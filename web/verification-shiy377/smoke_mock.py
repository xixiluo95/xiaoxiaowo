# -*- coding: utf-8 -*-
"""SHIY-377 mock 模式冒烟（VITE_MOCK_API=1，localhost:5181）：验证适配层 mock 分支与三页渲染。"""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5181"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy377"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen', '1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".voice-input", timeout=15000)
    for text in ["今天小明抢了我的球，我很生气", "我和同桌画画特别开心"]:
        page.fill(".voice-input", text)
        page.click("button.xxw-btn--chat-send")
        page.wait_for_timeout(1400)

    # 日记页：块、编辑、确认、分享
    page.goto(BASE + "/#/diary", wait_until="networkidle")
    page.wait_for_timeout(700)
    check("mock 日记页有块", page.locator(".diary-block").count() >= 1, f"blocks={page.locator('.diary-block').count()}")
    page.locator("button.xxw-btn--diary-block-edit").first.click()
    page.fill(".block-textarea", "我改过的内容。")
    page.locator("button.xxw-btn--diary-block-save").click()
    page.wait_for_timeout(500)
    check("mock 我改的标识", page.locator(".block-badge").count() == 1)
    page.locator("button.xxw-btn--diary-confirm").click()
    page.wait_for_timeout(500)
    check("mock 确认后已确认", page.locator(".xwdiary-confirmed").count() == 1)
    page.locator("button.xxw-btn--diary-share").click()
    page.wait_for_timeout(300)
    page.locator(".adm-dialog-button").filter(has_text="确定").first.click()
    page.wait_for_timeout(500)
    check("mock 已分享标记", page.locator(".shared-mark").count() == 1)
    page.screenshot(path=f"{OUT}/10-mock-diary.png", full_page=True)

    # 日历页：确认后今天着色
    page.goto(BASE + "/#/calendar", wait_until="networkidle")
    page.wait_for_timeout(700)
    today = page.locator(".xwcal-cell.xwcal-today")
    check("mock 今天格着色", "xwcal-colored" in (today.get_attribute("class") or ""))
    page.screenshot(path=f"{OUT}/11-mock-calendar.png", full_page=True)

    # 我的页
    page.goto(BASE + "/#/me", wait_until="networkidle")
    page.wait_for_timeout(500)
    check("mock 我的页入口", page.locator(".me-entry").count() == 4)
    page.screenshot(path=f"{OUT}/12-mock-me.png", full_page=True)

    check("无页面 JS 异常", not errors, "; ".join(errors[:3]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n== {len(results) - len(fails)}/{len(results)} 通过 ==")
sys.exit(1 if fails else 0)
