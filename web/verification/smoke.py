#!/usr/bin/env python3
"""小小我儿童端移动端冒烟截图（390x844）。用法: python3 smoke.py [BASE_URL]"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
OUT = '/home/xixil/xiaoxiaowo/web/verification'

console_errors = []

def swipe(page, y0, y1):
    page.evaluate(
        """([y0, y1]) => {
            const el = document.querySelector('.page');
            const mk = (y) => new Touch({identifier: 1, target: el, clientX: 200, clientY: y});
            el.dispatchEvent(new TouchEvent('touchstart', {touches: [mk(y0)], changedTouches: [mk(y0)], bubbles: true}));
            el.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [mk(y1)], bubbles: true}));
        }""",
        [y0, y1],
    )

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
        ])
        ctx = browser.new_context(
            viewport={'width': 390, 'height': 844},
            has_touch=True,
            permissions=['microphone'],
            device_scale_factor=2,
        )
        ctx.add_init_script("localStorage.setItem('xxw_intro_seen','1')")
        page = ctx.new_page()
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))

        # 1. 首页（文字态）
        page.goto(f'{BASE}/#/', wait_until='networkidle')
        page.wait_for_timeout(1200)
        page.screenshot(path=f'{OUT}/01-home.png')

        # 发两条消息，让角色登场 + 日记有内容
        page.fill('.voice-input', '今天体育课小明抢了我的球，我很生气')
        page.press('.voice-input', 'Enter')
        page.wait_for_timeout(2600)
        page.fill('.voice-input', '后来我和同桌一起画画，特别开心')
        page.press('.voice-input', 'Enter')
        page.wait_for_timeout(2600)
        page.screenshot(path=f'{OUT}/02-home-chat.png')

        # 2. 聊天文字流（上滑）
        swipe(page, 700, 300)
        page.wait_for_timeout(600)
        page.screenshot(path=f'{OUT}/06-chat-sheet.png')
        page.get_by_role('button', name='回到舞台').click()
        page.wait_for_timeout(400)

        # 3. 语音态（按住说话大圆钮）
        page.get_by_role('button', name='切换输入方式').click()
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUT}/05-voice-mode.png')

        # 按住 -> 录音中（波纹态）
        hold = page.locator('.xxw-btn--voice-hold-talk')
        box = hold.bounding_box()
        page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.mouse.down()
        page.wait_for_timeout(1200)
        page.screenshot(path=f'{OUT}/05b-recording.png')
        page.mouse.up()
        page.wait_for_timeout(1800)

        # 4. 日记页（先确认，让日历出现彩色心）
        page.goto(f'{BASE}/#/diary', wait_until='networkidle')
        page.wait_for_timeout(800)
        page.screenshot(path=f'{OUT}/03-diary.png')
        confirm = page.get_by_role('button', name='确认完成')
        if confirm.count():
            confirm.click()
            page.wait_for_timeout(800)

        # 5. 日历
        page.goto(f'{BASE}/#/calendar', wait_until='networkidle')
        page.wait_for_timeout(800)
        page.screenshot(path=f'{OUT}/02-calendar.png')

        # 6. 我的
        page.goto(f'{BASE}/#/me', wait_until='networkidle')
        page.wait_for_timeout(800)
        page.screenshot(path=f'{OUT}/04-me.png')

        browser.close()

    print('console errors:', len(console_errors))
    for e in console_errors:
        print(' -', e[:300])

if __name__ == '__main__':
    main()
