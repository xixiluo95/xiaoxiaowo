# -*- coding: utf-8 -*-
"""SHIY-370 情绪舞台视频接入验证（VITE_MOCK_API=1，mock 模式，非真机/非真实语音链路）。

覆盖：初次进入平静舞台视频常驻；情绪切换视频交叉淡化不闪空；
循环播放 ~9s（跨过 2 个 4s 接缝）不断流；录音中角色可见；
聊天面板/键盘展开后视频紧凑条在顶部可视区；
视频 404 回退静态小人（非纯色块）；fear 无视频走静态图；320/390px 双尺寸。
headless 用 channel=chrome（内置 H.264 解码；playwright 自带 chromium 无 H.264）。
键盘展开态为样式级验证（headless 无真实软键盘，直接加 with-keyboard 类核对布局）。
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5191"
OUT = "/home/xixil/xiaoxiaowo/web/verification-shiy370-video"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


def active_video_state(page):
    return page.evaluate(
        """() => {
        const layer = [...document.querySelectorAll('.stage-video .video-layer')].filter((l) => !l.classList.contains('off')).pop();
        if (!layer) return null;
        const v = layer.querySelector('video.front') || layer.querySelector('video');
        if (!v) return null;
        return { src: v.currentSrc || v.src, paused: v.paused, t: v.currentTime, readyState: v.readyState };
    }"""
    )


def swipe_up(page):
    page.evaluate(
        """() => {
        const el = document.querySelector('.child-home');
        const mk = (y) => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(620)], changedTouches: [mk(620)], bubbles: true }));
        el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(180)], bubbles: true }));
    }"""
    )


def new_page(p, width):
    browser = p.chromium.launch(
        channel="chrome",
        args=[
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
        ],
    )
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
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in str(m.location) else None)
    return browser, page, errors


def run_width(p, width):
    tag = str(width)
    browser, page, errors = new_page(p, width)

    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen','1')")
    page.reload(wait_until="networkidle")

    # 1. 初次进入：平静舞台视频立即常驻且自动播放（非空舞台）
    page.wait_for_selector(".stage-video video", timeout=8000)
    page.wait_for_function(
        "() => { const v = document.querySelector('.stage-video video.front'); return v && !v.paused && v.currentTime > 0.1; }",
        timeout=8000,
    )
    st = active_video_state(page)
    check(f"{tag} 初始平静舞台视频常驻播放", st and "calm" in st["src"] and not st["paused"], str(st))
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/{tag}-01-initial-calm.png")

    # 2. 发送文字 → 回复后情绪切换 joy：视频交叉淡化，全程有画面
    page.fill(".voice-input", "我今天很开心")
    page.locator(".xxw-btn--chat-send").click()
    page.wait_for_selector(".subtitle", timeout=8000)
    page.wait_for_function(
        "() => { const v = [...document.querySelectorAll('.stage-video .video-layer:not(.off) video.front')].pop(); return v && v.src.includes('joy') && !v.paused && v.currentTime > 0; }",
        timeout=10000,
    )
    page.wait_for_timeout(1200)  # 等交叉淡化收尾
    st = active_video_state(page)
    check(f"{tag} 情绪切换 joy 视频播放", st and "joy" in st["src"] and not st["paused"], str(st))
    page.screenshot(path=f"{OUT}/{tag}-02-joy-video.png")

    # 3. 循环 ~9s（跨过 2 个 4s 接缝）：不断流、无报错
    page.wait_for_timeout(9000)
    st = active_video_state(page)
    check(f"{tag} 循环9s视频仍在播放", st and not st["paused"] and st["readyState"] >= 2, str(st))
    check(f"{tag} 无页面错误", not errors, "; ".join(errors[:2]))
    page.screenshot(path=f"{OUT}/{tag}-03-loop-9s.png")

    # 4. 语音模式录音中角色（舞台视频）可见
    page.locator(".xxw-btn--voice-mode-switch").click()
    page.wait_for_selector(".xxw-btn--voice-hold-talk")
    hold = page.locator(".xxw-btn--voice-hold-talk").bounding_box()
    page.mouse.move(hold["x"] + hold["width"] / 2, hold["y"] + hold["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(500)
    check(f"{tag} 录音中舞台视频可见", page.locator(".stage-video").is_visible())
    page.screenshot(path=f"{OUT}/{tag}-04-recording.png")
    page.mouse.up()
    page.wait_for_timeout(600)
    page.locator(".xxw-btn--voice-mode-switch").click()  # 回文字模式
    page.wait_for_selector(".voice-input")

    # 5. 上滑展开聊天面板：视频紧凑条在顶部可视区（面板不得完全盖住角色）
    swipe_up(page)
    page.wait_for_selector(".chat-sheet", timeout=4000)
    page.wait_for_timeout(400)
    sheet = page.locator(".chat-sheet").bounding_box()
    sv = page.locator(".stage-video").bounding_box()
    check(
        f"{tag} 面板展开视频条在面板上方",
        sv is not None and sheet is not None and sv["y"] + sv["height"] <= sheet["y"] + 8,
        f"video={sv} sheet_y={sheet and sheet['y']}",
    )
    page.screenshot(path=f"{OUT}/{tag}-05-sheet-open.png")

    # 6. 键盘展开态（样式级）：视频紧凑条在顶部 45% 内
    page.locator(".xxw-btn--chat-close-sheet").click()
    page.wait_for_selector(".chat-sheet", state="detached", timeout=4000)
    page.evaluate("document.querySelector('.emotion-stage').classList.add('with-keyboard')")
    page.wait_for_timeout(300)
    sv2 = page.locator(".stage-video").bounding_box()
    check(
        f"{tag} 键盘态视频条在顶部45%内",
        sv2 is not None and sv2["y"] + sv2["height"] < 844 * 0.45,
        f"video={sv2}",
    )
    page.screenshot(path=f"{OUT}/{tag}-06-keyboard-compact.png")
    page.evaluate("document.querySelector('.emotion-stage').classList.remove('with-keyboard')")

    browser.close()

    # 7. fear 无视频素材：走静态紫色小人
    browser, page, errors = new_page(p, width)
    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen','1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".stage-video video", timeout=8000)
    page.fill(".voice-input", "我有点害怕")
    page.locator(".xxw-btn--chat-send").click()
    page.wait_for_selector(".subtitle", timeout=8000)
    page.wait_for_timeout(2400)
    src = page.locator(".character-img").get_attribute("src") or ""
    check(f"{tag} fear无视频回静态小人", "fear" in src, src)
    page.screenshot(path=f"{OUT}/{tag}-07-fear-static.png")
    browser.close()

    # 8. 视频 404：回退静态小人（anger 图链），非纯色块
    browser, page, errors = new_page(p, width)
    page.route("**/assets/emotions/anger/loop.mp4", lambda r: r.abort())
    page.goto(BASE + "/#/", wait_until="networkidle")
    page.evaluate("localStorage.setItem('xxw_intro_seen','1')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".stage-video video", timeout=8000)
    page.fill(".voice-input", "今天有人抢我东西，我很生气")
    page.locator(".xxw-btn--chat-send").click()
    page.wait_for_selector(".subtitle", timeout=8000)
    page.wait_for_timeout(2400)
    src = page.locator(".character-img").get_attribute("src") or ""
    check(f"{tag} 视频404回退静态小人", "anger" in src or "calm" in src, src)
    check(f"{tag} 视频失败不白屏", page.locator(".character").is_visible() or page.locator(".stage-video").is_visible())
    page.screenshot(path=f"{OUT}/{tag}-08-video-fallback.png")
    browser.close()


import os

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    for w in (390, 320):
        run_width(p, w)

failed = [r for r in results if not r[1]]
print(f"\n== {len(results) - len(failed)}/{len(results)} 通过 ==")
sys.exit(1 if failed else 0)
