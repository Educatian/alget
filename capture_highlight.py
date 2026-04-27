"""Capture the highlight popover by programmatically selecting text in the
reading pane. Run while vite dev + backend are up."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screenshots"
BASE = "http://127.0.0.1:5173"
VIEWPORT = {"width": 1280, "height": 800}


async def enter_demo(page):
    print(f"  url before: {page.url}")
    # Try the landing-page primary CTA first; fall back to any visible Sign in.
    for label in ("Sign in to start", "Sign in"):
        try:
            btn = page.get_by_role("button", name=label).first
            if await btn.is_visible(timeout=2000):
                await btn.click()
                await page.wait_for_timeout(500)
                print(f"  clicked: {label}")
                break
        except Exception as e:
            print(f"  {label!r} not clickable: {e}")
    try:
        btn = page.get_by_role("button", name="Continue in Demo Mode")
        await btn.wait_for(state="visible", timeout=5000)
        await btn.click()
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.wait_for_timeout(1200)
        print(f"  url after demo: {page.url}")
    except Exception as e:
        print("  demo entry failed:", e)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()
        page.set_default_timeout(15000)

        await page.goto(f"{BASE}/", wait_until="networkidle")
        await enter_demo(page)
        await page.evaluate(
            "localStorage.setItem('alget_onboarding_completed_v1','true')"
        )

        await page.goto(f"{BASE}/book/bio-inspired/01/03",
                        wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # Dismiss tour if it appeared.
        for label in ("Skip tour", "Close"):
            try:
                btn = page.get_by_role("button", name=label)
                if await btn.is_visible(timeout=800):
                    await btn.click()
                    await page.wait_for_timeout(400)
                    break
            except Exception:
                pass

        # Programmatically select a stretch of text using the Range API,
        # then dispatch a mouseup so HighlightableContent's handler reads
        # window.getSelection() and shows the popover.
        await page.evaluate("""
            () => {
                // Pick a meaty paragraph from the reading pane.
                const candidates = Array.from(
                    document.querySelectorAll('main p, article p, .prose p')
                ).filter(p => (p.textContent || '').length > 80);
                if (!candidates.length) {
                    throw new Error('No reading-pane paragraph found.');
                }
                // Prefer one that mentions setae/spatulae if possible.
                const target = candidates.find(p =>
                    /setae|spatulae|gecko/i.test(p.textContent || '')
                ) || candidates[0];
                target.scrollIntoView({block: 'center', behavior: 'instant'});

                // Walk to the first non-empty text node.
                const walker = document.createTreeWalker(
                    target, NodeFilter.SHOW_TEXT, null
                );
                let node = walker.nextNode();
                while (node && !node.textContent.trim()) {
                    node = walker.nextNode();
                }
                if (!node) throw new Error('No text node in target paragraph.');

                const length = Math.min(node.textContent.length, 70);
                const range = document.createRange();
                range.setStart(node, 0);
                range.setEnd(node, length);

                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                // HighlightableContent listens on document for mouseup.
                document.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true, cancelable: true, view: window
                }));
                return target.textContent.slice(0, length);
            }
        """)
        await page.wait_for_timeout(1500)

        out = OUT / "09_highlight_popover.png"
        await page.screenshot(path=str(out))
        print("->", out)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
