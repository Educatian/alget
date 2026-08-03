"""
Capture real screenshots of ALGET surfaces for INSTRUCTOR_GUIDE.html and
LEARNER_GUIDE.html. Replaces the SVG mockups with PNG captures.

Run AFTER both servers are up:
  - vite dev on 127.0.0.1:5173
  - FastAPI on 127.0.0.1:8000
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)
BASE = "http://127.0.0.1:5173"

# Capture viewport: 1280x800 (16:10), DPR 2 → crisp on retina screens
VIEWPORT = {"width": 1280, "height": 800}


async def enter_demo(page):
    """Open AuthModal from landing and click 'Continue in Demo Mode'."""
    # Click 'Sign in to start' on the landing page if visible.
    try:
        sign_in = page.get_by_role("button", name="Sign in to start")
        if await sign_in.is_visible(timeout=2000):
            await sign_in.click()
            await page.wait_for_timeout(400)
    except Exception:
        pass
    # Or the 'Sign in' header button.
    try:
        sign_in = page.get_by_role("button", name="Sign in").first
        if await sign_in.is_visible(timeout=1000):
            await sign_in.click()
            await page.wait_for_timeout(300)
    except Exception:
        pass
    # Now click Continue in Demo Mode.
    try:
        btn = page.get_by_role("button", name="Continue in Demo Mode")
        await btn.wait_for(state="visible", timeout=5000)
        await btn.click()
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.wait_for_timeout(800)
    except Exception as e:
        print(f"  (demo entry failed: {e})")


async def shoot(page, name, **opts):
    path = OUT / f"{name}.png"
    await page.wait_for_timeout(500)
    await page.screenshot(path=str(path), **opts)
    print(f"  -> {path.name}")


async def seed_agentic_demo(page):
    """Seed approval-gated agentic examples for reproducible README captures."""
    await page.evaluate(
        """
        () => {
          const authKey = Object.keys(localStorage).find((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
          let auth = {}
          try { auth = JSON.parse(localStorage.getItem(authKey) || '{}') } catch { auth = {} }
          const userId = auth?.user?.id || auth?.currentSession?.user?.id || auth?.session?.user?.id || 'demo-learner'
          const now = new Date().toISOString()
          const workflow = {
            id: 'workflow-readme-plan', owner_id: userId, course_id: 'bio-inspired', workflow_type: 'learner_plan',
            status: 'awaiting_approval', risk_level: 'low', goal: 'Master directional adhesion for Friday', created_at: now, updated_at: now,
          }
          const plan = {
            id: 'plan-readme', workflow_id: workflow.id, user_id: userId, status: 'awaiting_approval', created_at: now, updated_at: now,
            agent_workflows: workflow,
            plan: {
              sessions: [
                { id: 's1', concept_id: 'directional_adhesion', mode: 'worked-example', scheduled_for: '2026-08-01', minutes: 30, why_now: 'Current mastery evidence is 38%, below the 80% learner goal.' },
                { id: 's2', concept_id: 'preload_sensitivity', mode: 'retrieval-practice', scheduled_for: '2026-08-03', minutes: 25 },
                { id: 's3', concept_id: 'dry_adhesion_constraints', mode: 'teach-back', scheduled_for: '2026-08-05', minutes: 30 },
              ],
              learner_control: { requires_approval: true, can_edit: true, can_pause: true, can_cancel: true, memory_scope: 'learner-owned' },
            },
          }
          const interventionWorkflow = {
            id: 'workflow-readme-intervention', owner_id: userId, course_id: 'statics', workflow_type: 'instructor_intervention',
            status: 'awaiting_approval', risk_level: 'medium', goal: 'Re-teach force vectors', created_at: now, updated_at: now,
          }
          const intervention = {
            id: 'intervention-readme', workflow_id: interventionWorkflow.id, course_id: 'statics', concept_id: 'force_vectors',
            title: 'Re-teach force vectors', status: 'awaiting_approval', risk_level: 'medium', created_at: now, updated_at: now,
            agent_workflows: interventionWorkflow,
            proposal: {
              summary: 'Prepare a short compare-and-correct activity; review the next evidence snapshot before further action.',
              evidence: { learner_count: 8, average_mastery: 0.38, urgency: 'urgent', causal_claim: false },
              delivery: { executed: false, requires_instructor_approval: true },
            },
          }
          localStorage.setItem('alget_agentic_lms_v1', JSON.stringify({
            goals: [], workflows: [workflow, interventionWorkflow], studyPlans: [plan], interventions: [intervention], events: [],
          }))
        }
        """
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()
        page.set_default_timeout(15000)

        # 1. LandingPage
        print("[1] Landing page")
        await page.goto(f"{BASE}/", wait_until="networkidle")
        await shoot(page, "01_landing")

        # Enter demo mode from landing page so subsequent /learn /book /dashboard
        # /instructor /analytics routes are reachable.
        print("[*] Entering demo mode")
        await enter_demo(page)

        # Skip the OnboardingTour modal so it doesn't block reader screenshots.
        await page.evaluate(
            "localStorage.setItem('alget_onboarding_completed_v1','true')"
        )
        await seed_agentic_demo(page)

        # 2. /learn (course chooser)
        print("[2] Course chooser /learn")
        await page.goto(f"{BASE}/learn", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await shoot(page, "02_course_chooser")

        # 3. Book reader at bio-inspired/01/03
        print("[3] Book reader /book/bio-inspired/01/03")
        await page.goto(f"{BASE}/book/bio-inspired/01/03", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        # Dismiss OnboardingTour if it auto-opened (localStorage flag isn't enough
        # since the component may have already mounted).
        for label in ("Skip tour", "Close"):
            try:
                btn = page.get_by_role("button", name=label)
                if await btn.is_visible(timeout=800):
                    await btn.click()
                    await page.wait_for_timeout(400)
                    break
            except Exception:
                continue
        await page.wait_for_timeout(1000)
        await shoot(page, "03_book_reader")

        # 4. Book reader with IntelRail explicitly opened (Get Help button)
        print("[4] Reader with IntelRail open")
        rail_opened = False
        try:
            help_btn = page.get_by_role("button", name="Get Help")
            await help_btn.click()
            await page.wait_for_timeout(800)
            rail_opened = True
        except Exception:
            print("  (rail unavailable at this viewport; preserving existing capture)")
        if rail_opened:
            await shoot(page, "04_intel_rail_open")

        # 5. Floating chat — find launcher (the bottom-right floating bubble) and open
        print("[5] Floating ChatWidget")
        chat_opened = False
        # Close the rail first if open, for a cleaner shot.
        try:
            close_help = page.get_by_role("button", name="Close Help")
            if await close_help.is_visible(timeout=1000):
                await close_help.click()
                await page.wait_for_timeout(400)
        except Exception:
            pass
        # The launcher is `fixed bottom-6 right-6 w-14 h-14 rounded-full`.
        try:
            chat_btn = page.locator(
                "button.fixed.bottom-6.right-6, button[class*='bottom-6'][class*='right-6'][class*='rounded-full']"
            ).first
            await chat_btn.click(timeout=4000)
            await page.wait_for_timeout(1000)
            chat_opened = True
        except Exception as e:
            print(f"  (chat launcher unavailable; preserving existing capture: {e})")
        if chat_opened:
            await shoot(page, "05_chat_widget")

        # 6. Mastery / brain network — try /dashboard
        print("[6] Student dashboard /dashboard")
        await page.goto(f"{BASE}/dashboard", wait_until="networkidle")
        await page.wait_for_timeout(1800)
        await shoot(page, "06_student_dashboard")

        # 7. Instructor dashboard /instructor — grant access flag first
        print("[7] Instructor dashboard /instructor")
        await page.evaluate("sessionStorage.setItem('alget_instructor_access','granted')")
        await page.goto(f"{BASE}/instructor", wait_until="networkidle")
        await page.wait_for_timeout(1800)
        await shoot(page, "07_instructor_dashboard")

        # 8. Researcher / analytics
        print("[8] Analytics /analytics")
        await page.evaluate("sessionStorage.setItem('alget_researcher_access','granted')")
        await page.goto(f"{BASE}/analytics", wait_until="networkidle")
        await page.wait_for_timeout(1800)
        await shoot(page, "08_analytics")

        await browser.close()
        print("\nDone. PNGs in:", OUT)


if __name__ == "__main__":
    asyncio.run(main())
