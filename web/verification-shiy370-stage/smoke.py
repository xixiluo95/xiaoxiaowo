# -*- coding: utf-8 -*-
"""SHIY-370 小人常驻验证（VITE_MOCK_API=1，mock 模式，非真机/非真实语音链路）。

覆盖：初次进入平静小人常驻；发送/思考/回复/情绪切换期间角色不消失；
录音中角色可见；聊天面板展开后紧凑角色仍在顶部可视区；
角色素材 404 时回退平静静态小人（非纯色块）；320/390px 双尺寸。
键盘展开态为样式级验证（headless 无真实软键盘，直接加 with-keyboard 类核对布局）。
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5190"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy370-stage"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


def char_box(page):
    return page.locator(".character").bounding_box()


def swipe_up(page):
    page.evaluate(
        """() => {
        const el = document.querySelector('.child-home');
        const mk = (y) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(620)], changedTouches: [mk(620)], bubbles: true }));
        el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(180)], bubbles: true }));
    }"""
    )


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

    # 1. 初次进入：平静小人立即常驻（非空舞台）
    page.wait_for_selector(".character img", timeout=8000)
    src = page.locator(".character-img").get_attribute("src") or ""
    check(f"{tag} 初始平静小人常驻", "calm" in src, src)
    page.screenshot(path=f"{OUT}/{tag}-01-initial-calm.png")

    # 2. 发送文字 → 思考中角色仍在 → 回复后情绪切换（开心），全程不消失
    page.fill(".voice-input", "我今天很开心")
    page.locator(".xxw-btn--chat-send").click()
    page.wait_for_timeout(400)  # thinking 期间
    check(f"{tag} 思考等待期角色可见", page.locator(".character").is_visible())
    page.screenshot(path=f"{OUT}/{tag}-02-thinking.png")
    page.wait_for_selector(".subtitle", timeout=8000)
    page.wait_for_timeout(2200)  # 等 sensing 0.8~1.5s + 入场动画
    src2 = page.locator(".character-img").get_attribute("src") or ""
    check(f"{tag} 情绪切换后角色仍在（joy）", "joy" in src2, src2)
    check(f"{tag} 无页面错误", not errors, "; ".join(errors[:2]))
    page.screenshot(path=f"{OUT}/{tag}-03-after-reply.png")

    # 3. 语音模式录音中角色可见
    page.locator(".xxw-btn--voice-mode-switch").click()
    page.wait_for_selector(".xxw-btn--voice-hold-talk")
    hold = page.locator(".xxw-btn--voice-hold-talk").bounding_box()
    page.mouse.move(hold["x"] + hold["width"] / 2, hold["y"] + hold["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(500)
    check(f"{tag} 录音中角色可见", page.locator(".character").is_visible())
    page.screenshot(path=f"{OUT}/{tag}-04-recording.png")
    page.mouse.up()
    page.wait_for_timeout(600)
    page.locator(".xxw-btn--voice-mode-switch").click()  # 回文字模式
    page.wait_for_selector(".voice-input")

    # 4. 上滑展开聊天面板：紧凑角色仍在顶部可视区（面板不得完全盖住角色）
    swipe_up(page)
    page.wait_for_selector(".chat-sheet", timeout=4000)
    page.wait_for_timeout(400)
    sheet = page.locator(".chat-sheet").bounding_box()
    ch = char_box(page)
    check(
        f"{tag} 面板展开角色在面板上方",
        ch is not None and sheet is not None and ch["y"] + ch["height"] <= sheet["y"] + 8 and page.locator(".character").is_visible(),
        f"char={ch} sheet_y={sheet and sheet['y']}",
    )
    page.screenshot(path=f"{OUT}/{tag}-05-sheet-open.png")

    # 5. 键盘展开态（样式级：headless 无真实软键盘，直接加类核对紧凑布局）
    page.locator(".xxw-btn--chat-close-sheet").click()
    page.wait_for_selector(".chat-sheet", state="detached", timeout=4000)
    page.evaluate("document.querySelector('.emotion-stage').classList.add('with-keyboard')")
    page.wait_for_timeout(300)
    ch2 = char_box(page)
    check(f"{tag} 键盘态紧凑角色在顶部 30% 内", ch2 is not None and ch2["y"] + ch2["height"] < 844 * 0.32, f"char={ch2}")
    page.screenshot(path=f"{OUT}/{tag}-06-keyboard-compact.png")
    page.evaluate("document.querySelector('.emotion-stage').classList.remove('with-keyboard')")

    # 6. 角色素材 404：回退平静静态小人而非纯色块（fear 图本轮打回 404）
    page.route("**/assets/emotions/fear/idle.png", lambda r: r.abort())
    page.fill(".voice-input", "我有点害怕")
    page.locator(".xxw-btn--chat-send").click()
    page.wait_for_selector(".subtitle", timeout=8000)
    page.wait_for_timeout(2400)
    src3 = page.locator(".character-img").get_attribute("src") or ""
    check(f"{tag} 素材404回退平静小人", "calm" in src3, src3)
    page.screenshot(path=f"{OUT}/{tag}-07-media-fallback.png")

    browser.close()


with sync_playwright() as p:
    for w in (390, 320):
        run_width(p, w)

failed = [r for r in results if not r[1]]
print(f"\n== {len(results) - len(failed)}/{len(results)} 通过 ==")
sys.exit(1 if failed else 0)
