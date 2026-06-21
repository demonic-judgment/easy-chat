from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/workspace/screenshot_home.png', full_page=True)
    print("首页截图已保存")

    # 点击媒体按钮
    media_btn = page.locator('.media-btn')
    if media_btn.count() > 0:
        media_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/workspace/screenshot_media_dialog.png', full_page=True)
        print("媒体对话框截图已保存")

    browser.close()