# ALGET — Remaining UI Upgrade Opportunities (Follow-up Review)

_Senior product-design follow-up after the A-grade overhaul. Scope: what is STILL upgradeable now, ranked by impact vs effort. Items the overhaul already resolved are excluded._

## Where the UI is now

**Grade: A- (strong A-grade foundation, with a B-grade execution gap on two specific surfaces).**

The overhaul did the hard part. Tokens (type/space/semantic color/container/`--ath-viz-1..5`), the full button-state matrix, dark-mode parity (Fraunces + desaturated-green brand), the EmptyState primitive, card taxonomy, accessible dialogs/quizzes/chat, a reduced-motion-aware motion layer, and a Skeleton primitive all exist and are visibly applied. None of that is re-flagged here.

**Theme of what is left: "the system is built; the last mile is adoption + the edges of state changes."** The remaining work is craft tightening, not bug-fixing, and it clusters into three honest gaps that three independent lenses all converged on:

1. **Token adoption is incomplete on high-traffic surfaces.** The `--ath-viz` palette is defined (10 refs in `index.css`) but consumed by **zero** components/pages. `ConceptDiagrams.jsx` carries **118** off-system color literals; `BookLayout.jsx` header has **35** raw `rgba()` literals (including a legacy blue `rgba(15,81,103)` focus tint on a green app); ChapterPassport/BookToc still use raw `emerald-*`; the landing hero ships **9** purple/cyan gradient stops. The tokens exist — enforcement is the last mile.
2. **The tablet band (768–1279px) is unfinished.** The TOC rail and IntelRail are both gated at `xl:` (1280px), with no `lg:` tier. Landscape tablet — the most common classroom device — drops to a mobile single column floating inside a desktop-width canvas with dead side margins.
3. **The highest-emotion and most data-dense surfaces are the least crafted.** Answer-feedback reveals are instant DOM swaps with no entrance or reward beat; lazy fallbacks ignore the Skeleton primitive; the analytics dashboard has **zero real charts** (0 `<svg>`/`polyline`); 192 generated section illustrations are shipped but referenced nowhere in `src`.

Everything below is additive-safe (no destructive refactors) and respects the existing reduced-motion clamp and the intentional 92ch reading width.

---

## Ranked opportunities (quick wins first)

| # | Opportunity | Impact | Effort | Surface |
|---|---|---|---|---|
| 1 | Animate answer-feedback reveal (most frequent state change) | High | S | reading-statics / reading-aiethics-interactive |
| 2 | Rebrand landing hero illustration to green palette | Med | S | landing |
| 3 | Tokenize ChapterPassport + TOC completed-state to `--ath-success` | Med | S | toc-statics |
| 4 | Toast exit animation + brand-token success skin | Med | S | dashboard / reading toast |
| 5 | Entrance choreography for gated screens + welcome modal | Med | S | analytics, lab, diagnostic |
| 6 | Calm TOC competing radii + tighten mobile density | Low | S | toc-mobile |
| 7 | Disabled→enabled CTA "armed" settle | Low | S | reading-statics |
| 8 | Replace emoji glyphs in diagrams with lucide icons | Low | S | reading interactive diagrams |
| 9 | Give tablets a navigation rail (the 768–1279px dead band) | High | M | reading-tablet |
| 10 | Center reading column / reclaim empty side margins | High | S | reading-tablet |
| 11 | Shape-matched skeletons for lazy fallbacks | High | M | reading-statics, dashboard |
| 12 | Correct-answer reward micro-interaction | High | M | reading-aiethics-interactive |
| 13 | Surface the 192 unused deep-exemplar illustrations | High | M | reading section openers |
| 14 | Route header's 35 raw `rgba()` through tokens | Med | M | reading-aiethics-interactive |
| 15 | Consume spacing + container tokens on pages | Med | M | landing |
| 16 | Move KnowledgeGraph onto brand/semantic tokens | Med | M | reading sidebar graph |
| 17 | Enrich ParameterExplorer plot (gridlines/ticks/area) | Med | M | reading interactive |
| 18 | Serif brand moment (editorial pull-quote) on landing | Med | M | landing |
| 19 | Add real charts to analytics dashboard | High | L | analytics |
| 20 | Wire concept diagrams onto `--ath-viz` + dark parity | High | L | reading concept diagrams |

---

## Quick wins (additive-safe, high-impact, do first)

These ship value immediately with near-zero blast radius. #1, #9, #10, #11 are the four that most move perceived quality.

### 1. Answer-feedback reveal pops in with no entrance animation — High / S
**File:** `frontend/src/components/KnowledgeCheck.jsx` (feedback container ~line 393), `frontend/src/components/PracticeBlock.jsx` (currentResult panel ~line 418).
The single most frequent state change in the product — submitting an answer — renders the Correct/Needs-Another-Pass panel as an instant DOM swap. `animate-fade-in` (defined `index.css:680`, scale 0.97→1) and `reading-interactive-enter` already exist and are reduced-motion-safe. **Fix:** add `className="animate-fade-in"` to both feedback containers; keep `aria-live` as-is. The most emotionally loaded moment currently feels the least crafted.

### 9. Give tablets a navigation rail (768–1279px dead band) — High / M
**File:** `frontend/src/pages/BookLayout.jsx` (lines 534, 660, 838).
Verified: TOC aside (`hidden xl:block w-64`, line 660) and IntelRail (`xl:block`, line 838) are both gated at `xl:` with **no `lg:` tier**; the TOC hamburger is `xl:hidden` (line 534). On any tablet the entire left rail + ChapterPassport vanish and the reader falls to mobile single-column inside a desktop canvas (confirmed in reading-tablet.png — wide empty margins, no nav). **Fix:** add an `lg:` tier — change the aside to `hidden lg:block lg:w-56 xl:w-64` and the hamburger to `lg:hidden`; keep IntelRail overlay/bottom-sheet at `lg`, full pane only at `xl`. Net: 2-pane on tablet, 3-pane at `xl`, single column only on true mobile. Biggest perceived-quality gap left.

### 10. Reclaim the empty side margins when the rail is collapsed — High / S
**File:** `frontend/src/pages/BookLayout.jsx` (main/ReadingPane wrapper ~lines 748–766); `index.css` `.ath-container` (line 308).
With the IntelRail closed (its default), the reading column is `--reading-width` inside a full-width flex parent, so content sits as a left-aligned ribbon with a bare grid band to its right — reads as "something is missing," not intentional whitespace. **Fix:** wrap ReadingPane content in `.ath-container` (`max-width: var(--ath-container-app)`) with `mx-auto` and `--ath-gutter` padding so a closed-rail page reads as a centered editorial page. Pairs with #9.

### 2. Rebrand the landing hero illustration to green — Med / S
**File:** `frontend/src/components/GenerativeIllustration.jsx`.
Verified: 9 purple/cyan stops (`#6d28d9 #4338ca #0ea5e9 #a855f7 #7c3aed`). It is the single largest image a first-time visitor sees (confirmed in landing.png — purple/cyan against an all-green page). **Fix:** swap stops to brand tokens — center-glow → `var(--ath-primary)/--ath-primary-deep`, accent nodes → `var(--ath-viz-1/3/5)`, document tints → `var(--ath-panel)/--ath-line`. Keep motion; only the color identity moves on-brand.

### 3. Tokenize ChapterPassport + TOC completed-state — Med / S
**File:** `frontend/src/components/ChapterPassport.jsx:59`, `frontend/src/components/BookToc.jsx:145`.
Verified raw literals: passport complete branch `border-emerald-200 bg-emerald-50 text-emerald-700`; BookToc "Done" badge `text-emerald-600`. These off-system greens differ from `--ath-success` and have no defined dark value. **Fix:** swap to `border:color-mix(in srgb, var(--ath-success) 35%, transparent)`, `bg:var(--ath-success-soft)`, `text:var(--ath-success)`; BookToc → `text-[var(--ath-success)]`.

### 4. Toast exit animation + brand success skin — Med / S
**File:** `frontend/src/lib/toast.jsx` (TONE_STYLES ~line 118; dismiss ~line 25; enter ~line 90).
Verified: success/info/warn skins use raw `emerald-50/sky-50/amber-50` (no `--ath` token), and dismiss just filters the array — toasts snap out with no symmetry to their graceful entrance. **Fix:** add a `leaving` flag set ~200ms before unmount, reuse enter classes in reverse (`translate-y-2 opacity-0`); re-skin success to `--ath-primary/--ath-panel` (keep rose/amber where semantic-red/amber is intended).

### 5. Entrance choreography for gated screens + welcome modal — Med / S
**File:** analytics/lab access page, `frontend/src/components/OnboardingTour.jsx`.
The Scholarly-analytics access card (confirmed in analytics.png) and the diagnostic welcome modal hard-cut onto a static grid — the literal first frame on those routes, yet inert versus the rest of the app's settle-in motion. **Fix:** wrap the card container and the dialog panel in `className="animate-fade-in"` (the keyframe already pairs fade + scale 0.97→1). Confirm focus still lands on the input/primary button (<0.25s, no a11y impact).

### 6. Calm the TOC's competing radii + mobile density — Low / S
**File:** `frontend/src/components/BookToc.jsx` (lines 76, 82, 86, 111, 136).
Three nested large radii (`rounded-[2rem]`/`[1.6rem]`/`[1rem]`) plus `[1.4rem]` tiles read busy on mobile and sit outside the radius scale. **Fix:** summary/chapter → `var(--ath-radius-xl)`, rows/tiles → `var(--ath-radius-lg)`; drop one nesting border; bump mobile row padding to the 44px touch rhythm.

### 7. Disabled→enabled CTA "armed" settle — Low / S
**File:** `frontend/src/components/PracticeBlock.jsx:403`, `index.css`.
Submit/Mark-Complete toggle disabled↔enabled as a flat `opacity-50` step with no readiness affordance. **Fix:** ensure the editorial-button transition covers opacity and add a one-time tiny scale settle (1→1.01→1) keyed on `hasSelection`, gated under `no-preference`.

### 8. Replace emoji glyphs in diagrams with lucide icons — Low / S
**File:** `frontend/src/components/ConceptDiagrams.jsx`.
Interactive diagrams use literal emoji as affordances/state (👆 prompts, ⚠️ COGNITIVE OVERLOAD ⚠️) while the rest of the app uses lucide consistently; emoji render inconsistently and ignore brand color. **Fix:** swap for lucide already in deps (MousePointerClick/Hand; AlertTriangle tinted `var(--ath-danger)`).

---

## Bigger bets (higher payoff, plan deliberately)

### 11. Lazy-load fallbacks ignore the Skeleton primitive — High / M
**File:** `frontend/src/pages/BookLayout.jsx`, `frontend/src/components/ReadingPane.jsx`, `frontend/src/components/Skeleton.jsx`.
Verified: the Skeleton/SkeletonCard/SkeletonGroup primitive is consumed by only the 3 social components (CohortLiveMap, HighlightDiscussion, KindredReaders) plus ReadingPane; every Suspense boundary in BookLayout falls back to `SurfaceFallback` (a label + one generic full-width pulse block) that doesn't approximate final layout, causing a visible shape/height jump on swap. **Fix:** build shape-matched skeletons — a `SkeletonReadingPane` (heading line + 3–4 option rows + block CTA) and reuse `SkeletonGroup` for IntelRail fallbacks; swap the `SurfaceFallback`/`PanelFallback` usages. Keep `aria-busy` for SR parity.

### 12. Correct-answer moment has no reward micro-interaction — High / M
**File:** `frontend/src/index.css`, `frontend/src/components/KnowledgeCheck.jsx` (~line 353), `frontend/src/components/PracticeBlock.jsx`.
On a correct answer the only feedback is a toast + static emerald recolor — no tactile reward on the element the learner clicked, despite the product leaning on streaks/mastery. The `review-anchor-flash` keyframe already demos the exact "pulse a brand ring and fade" pattern. **Fix:** add an `answer-correct-pulse` keyframe (scale 1→1.015→1 + `--ath-primary` ring fade, ~600ms), gated `no-preference`, applied to the correct option/shell. Use `--ath-primary`, not emerald.

### 13. Surface the 192 unused deep-exemplar illustrations — High / M
**File:** `frontend/src/components/ReadingPane.jsx`.
Verified: `frontend/dist/course-art/deep-exemplars/` holds per-section generated PNGs (named by section order) across the supplement folders, with **0** references anywhere in `src` — built and shipped yet never displayed. Reading section openers are pure text (confirmed in reading screenshots), which is the main reason they read utilitarian. **Fix:** add a SectionOpener `<figure>` resolving `/course-art/deep-exemplars/{course}-supplement/{sectionId}.png` above the section H1, with graceful fallback to GenerativeIllustration or no image; reuse the `courseCatalog.js` `-supplement` resolution pattern.

### 14. Route the header's 35 raw `rgba()` literals through tokens — Med / M
**File:** `frontend/src/pages/BookLayout.jsx` (lines 417, 428–451, 482, 534–596, 640, 668).
Verified: 35 `rgba()` literals — the legacy blue focus tint `rgba(15,81,103,0.28)` on every focus ring (blue glow on a green app), `rgba(200,226,236,0.x)` teal-blue hover chips, and many `rgba(255,255,255,0.x)` glass fills. Highest concentration of off-system color left. **Fix:** ring → `color-mix(in srgb, var(--ath-primary) 28%, transparent)`; hover/active → `var(--ath-primary-soft)` / `color-mix(... var(--ath-primary) 16%)`; glass → `var(--ath-surface)/--ath-surface-strong`; selection literal → `color-mix(... var(--ath-primary) ...)`.

### 15. Consume the spacing + container tokens on pages — Med / M
**File:** `frontend/src/pages/LandingPage.jsx` (lines 116, 182, 211), `frontend/src/index.css` (`.ath-container` 308, `--ath-section-gap` 54).
`--ath-space-*`, `--ath-section-gap`, `--ath-gutter`, `--ath-container-*` are defined but pages still hand-pick `py-20 / gap-14 / mt-10 / max-w-7xl`. Rhythm looks right but is accidental and can drift on the next edit. **Fix:** swap `max-w-7xl` for `.ath-container-marketing` (dashboard → `.ath-container`); replace section `py-20`/inter-section margins with `var(--ath-section-gap)` / `var(--ath-space-*)` (e.g. a `.section-band` utility). Converts "good by hand" into "good by system."

### 16. Move the KnowledgeGraph onto brand/semantic tokens — Med / M
**File:** `frontend/src/components/KnowledgeGraph.jsx`.
Verified: hardcoded `#6366f1` (focus), `#10b981` (mastered), `#fbbf24` (emerging), `slate-950` background regardless of theme. The most prominent custom data-viz in the reading view is its own color island and the always-dark panel looks disconnected in light mode. **Fix:** focus → `var(--ath-primary)`, mastered → `var(--ath-success)`, emerging → `var(--ath-warning)`, unknown → `var(--ath-muted)`; derive links via `color-mix`; drive the panel bg from a token (e.g. `var(--ath-panel-deep)`).

### 17. Enrich the ParameterExplorer plot — Med / M
**File:** `frontend/src/components/ParameterExplorer.jsx`, `index.css`.
Correctly tokenized but visually bare: one 2px line on two unlabeled axes, no gridlines, no tick labels, no area fill, dead space in the card (confirmed in reading-aiethics-interactive.png). Reads as a sparkline, not the "build intuition by watching the curve" tool intended. **Fix:** add 3–4 faint gridlines (`stroke var(--ath-line)`), min/max + current tick labels (`fill var(--ath-muted)`), area fill `color-mix(in srgb, var(--ath-primary) 12%, transparent)`. Optionally animate `stroke-dashoffset` (0.4s, `no-preference`) so the line draws in. Additive, no deps. Keep the accessible `<desc>`.

### 18. Add a serif brand moment to the landing — Med / M
**File:** `frontend/src/pages/LandingPage.jsx` (workflow section ~lines 211–237), `index.css` editorial-title/divider.
Fraunces only ever appears as section headlines — tasteful but forgettable; no single editorial moment where the serif voice carries a sentence (confirmed in landing.png — "A textbook with memory" gets an ordinary 3-step list). **Fix:** promote "A textbook with memory" (or a one-line manifesto) into an oversized centered Fraunces pull-quote band at `--ath-text-3xl`, generous `--ath-space-8` vertical padding, thin editorial-divider above/below, text-only (no card) so it reads as a printed chapter break.

### 19. Add real charts to the analytics dashboard — High / L
**File:** `frontend/src/pages/AnalyticsDashboard.jsx`.
Verified: **0** `<svg>`/`polyline`/`rect` chart elements. "Concept mastery distribution" is a grid of cards (not a distribution); pre/post/retention are three isolated big numbers with no visual delta; completion/signal-mix are 1D bars. The most data-dense screen in a "Research Console" product has the least graphical content. **Fix:** add three small SVG charts styled with `--ath-viz` tokens (reuse the `PlotSvg` approach, no chart dep): (a) binned mastery histogram colored by band via `--ath-danger/--ath-warning/--ath-success`; (b) a 3-point pre→post→retention slope so the gain is visible; (c) a compact donut/stacked bar for signalMix. Also: give the second stat row matching lucide icons (TrendingDown/Target/ShieldCheck/FileCheck) and optional inline sparklines.

### 20. Wire concept diagrams onto `--ath-viz` + dark parity — High / L
**File:** `frontend/src/components/ConceptDiagrams.jsx`.
Verified: **118** off-system color literals (raw hex + `fill-blue/indigo/fuchsia/red/green/purple`) across ~11 SVG diagrams (ADDIE/ARCS/ZPD/UDL/Kirkpatrick/cognitive-load/etc.); `--ath-viz` palette is defined (10 css refs) but used in **0** components. None have dark-mode parity — in dark mode they stay white cards with pale fills against the dark shell (confirmed in reading-dark.png). Single largest source of off-system color in the app. **Fix:** map each diagram's N categories to `var(--ath-viz-1..5)` in order; use `--ath-success/warning/danger` for semantic zones (e.g. ZPD comfort/zpd/panic); swap `bg-white`/`fill-*` for `var(--ath-panel)`/`var(--ath-line)`; soft fills via `color-mix(... 14%)` to mirror the `*-soft` tokens. Inherits light/dark automatically.

---

## De-duplication notes

- ParameterExplorer appears across two lenses (skeleton/draw-in vs. gridlines/area fill); consolidated into #17 (visual enrichment) — the draw-in animation is folded in as the optional motion sub-task.
- Analytics appears across two lenses (real charts vs. stat-card icons/sparklines); consolidated into #19.
- ConceptDiagrams appears across two lenses (token/dark-parity vs. emoji→lucide); kept as #20 (the large token job) and #8 (the trivial emoji swap) because effort and risk differ sharply.
- Skeleton appears across two lenses (lazy fallbacks vs. chart-shaped skeleton); the chart skeleton is folded into #19; the reading/panel skeletons are #11.
- Tablet rail (#9) and reclaim-margins (#10) are kept separate: #9 is the structural `lg:` tier; #10 is the closed-rail centering that helps even at `xl`.

_Nothing here re-flags the resolved overhaul items (type/space/color tokens, button matrix, dark parity, EmptyState, accessible dialogs/SVGs/quizzes/chat, the 6 interactive components, the reduced-motion motion layer) or the intentional 92ch reading width._
