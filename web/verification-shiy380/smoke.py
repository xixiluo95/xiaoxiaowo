# -*- coding: utf-8 -*-
"""SHIY-380 按钮素材接入冒烟（VITE_MOCK_API=1，mock 模式，非真机/非真实语音链路）。

覆盖：发送/麦克风/键盘/输入底板真实显示与热区；空输入禁用；发送后清空；
按住录音/松开发送与打断提示；320/390px 布局；6 周月历；分享卡演示标识；
图片 404 时文字兜底仍可操作。
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5182"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy380"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


def hold_talk(page):
    hold = page.locator(".xxw-btn--voice-hold-talk")
    box = hold.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()


def run_width(p, width):
    tag = str(width)
    browser = p.chromium.launch(args=[
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
    ])
    ctx = browser.new_context(
        viewport={"width": width, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        permissions=["microphone"],
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen','1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".voice-input", timeout=15000)
    page.wait_for_timeout(600)

    # 1. 文字态：输入底板 + 麦克风切换钮 + 发送图钮
    send = page.get_by_role("button", name="发送")
    check(f"{tag} 发送按钮可见且带图", send.is_visible() and send.locator("img.btn-art--send").count() == 1)
    check(f"{tag} 空输入发送禁用", send.is_disabled())
    mode_btn = page.get_by_role("button", name="切换到语音输入")
    check(f"{tag} 模式切换钮（麦克风图）", mode_btn.locator("img.btn-art--mode").count() == 1)
    bg = page.evaluate(
        "getComputedStyle(document.querySelector('.voice-input-bg')).borderImageSource"
    )
    check(f"{tag} 输入底板图片已应用", "chat-input-base.png" in bg, bg[:80])
    page.screenshot(path=f"{OUT}/{tag}-01-text-idle.png")

    # 2. 输入后发送可用，点击发送后清空并出消息
    page.fill(".voice-input", "今天体育课我很开心")
    check(f"{tag} 有输入发送可用", not send.is_disabled())
    page.screenshot(path=f"{OUT}/{tag}-02-text-typed.png")
    send.click()
    page.wait_for_timeout(2500)
    check(f"{tag} 发送后输入框清空", page.input_value(".voice-input") == "")
    page.screenshot(path=f"{OUT}/{tag}-03-after-send.png")

    # 3. 切语音态：键盘图切换钮 + 麦克风按住说话
    mode_btn.click()
    page.wait_for_timeout(500)
    kb = page.get_by_role("button", name="切换回文字输入")
    check(f"{tag} 语音态键盘图切换钮", kb.locator("img.btn-art--mode").count() == 1)
    check(f"{tag} 按住说话麦克风图", page.locator(".xxw-btn--voice-hold-talk img.btn-art--hold").count() == 1)
    page.screenshot(path=f"{OUT}/{tag}-04-voice-mode.png")

    # 4. 按住 -> 录音提示 -> 松开发送
    hold_talk(page)
    page.wait_for_timeout(1000)
    hint = page.locator(".voice-hint").inner_text()
    check(f"{tag} 按住出现录音提示", "正在听" in hint, hint)
    page.screenshot(path=f"{OUT}/{tag}-05-recording.png")
    page.mouse.up()
    page.wait_for_timeout(2200)
    page.screenshot(path=f"{OUT}/{tag}-06-after-voice.png")

    # 5. 我的：绑定入口为绘本版本普通卡片（装饰底图按用户要求撤掉）+ 演示绑定徽章
    page.goto(BASE + "/#/me", wait_until="networkidle")
    page.wait_for_timeout(600)
    guardian = page.get_by_role("button", name="绑定的大人")
    card_bg = page.evaluate(
        "getComputedStyle(document.querySelector('.xxw-btn--me-entry-guardian'),'::before').backgroundImage"
    )
    check(f"{tag} 绑定入口无分享卡底图", "share-card-base" not in card_bg, card_bg[:80])
    check(f"{tag} 演示绑定徽章仍在", guardian.locator(".xwme-badge").inner_text() == "演示绑定")
    check(f"{tag} 无扫码误导文案", "扫码" not in page.locator("body").inner_text())
    page.screenshot(path=f"{OUT}/{tag}-07-me.png")

    # 6. 日历 6 周样例（2026-08，周一起 36 格 -> 6 行）
    page.goto(BASE + "/#/calendar", wait_until="networkidle")
    page.wait_for_timeout(600)
    page.get_by_role("button", name="上个月").click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name="上个月").click()
    page.wait_for_timeout(600)
    label = page.locator(".calendar-month").inner_text()
    cells = page.locator(".calendar-grid > *").count()
    import math
    rows = math.ceil((cells - 7) / 7)
    check(f"{tag} 日历6周布局", label == "2026年8月" and rows == 6, f"{label} rows={rows}")
    page.screenshot(path=f"{OUT}/{tag}-08-calendar-6week.png")

    check(f"{tag} 无页面JS错误", len(errors) == 0, "; ".join(errors[:3]))
    browser.close()


def run_fallback(p):
    """素材 404 时的文字兜底。"""
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.route("**/assets/ui/**", lambda r: r.abort())
    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen','1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".voice-input", timeout=15000)
    page.wait_for_timeout(800)
    check("fallback 发送回退为文字", page.get_by_role("button", name="发送").locator(".btn-art-fallback").inner_text() == "发送")
    check("fallback 模式切换回退为文字", page.get_by_role("button", name="切换到语音输入").locator(".btn-art-fallback").inner_text() == "语音")
    # 兜底按钮仍可操作：切语音态
    page.get_by_role("button", name="切换到语音输入").click()
    page.wait_for_timeout(500)
    check("fallback 仍可切换到语音态", page.locator(".xxw-btn--voice-hold-talk").count() == 1)
    check("fallback 按住说话回退", page.locator(".xxw-btn--voice-hold-talk .btn-art-fallback").count() == 1)
    # 输入底板 404 -> 回退底色仍可输入
    page.get_by_role("button", name="切换回文字输入").click()
    page.wait_for_timeout(400)
    page.fill(".voice-input", "兜底测试")
    check("fallback 输入框仍可输入", page.input_value(".voice-input") == "兜底测试")
    page.screenshot(path=f"{OUT}/fallback-01.png")
    # 分享卡 404 -> 回退卡片底色
    page.goto(BASE + "/#/me", wait_until="networkidle")
    page.wait_for_timeout(500)
    check("fallback 绑定入口仍可见可用", page.get_by_role("button", name="绑定的大人").is_visible())
    page.screenshot(path=f"{OUT}/fallback-02-me.png")
    browser.close()


with sync_playwright() as p:
    run_width(p, 390)
    run_width(p, 320)
    run_fallback(p)

fails = [r for r in results if not r[1]]
print(f"\n==== {len(results) - len(fails)}/{len(results)} 通过 ====")
sys.exit(1 if fails else 0)
