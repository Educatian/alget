# ALGET — Consolidated Design Critique

**Reviewer:** Design Lead (consolidating 6 specialist lenses)
**Surface set:** landing, reading (statics / AI-ethics interactive / dark / tablet / mobile), TOC, dashboard, analytics, lab, diagnostic
**Stack:** React/Vite + custom `--ath-*` design tokens + Tailwind
**Date:** 2026-05-29

---

## Overall grade: **C+**

ALGET has the *bones* of a top-studio product but not yet the *discipline*. The editorial concept (Fraunces serif display + IBM Plex Sans/Mono, forest-green/cream palette, grid-textured canvas) is genuinely tasteful, and a few systems are A-grade: the motion/reduced-motion engineering (`motion.js` + JS transform-stripping + `:focus-visible` discipline + skip link) is better than most commercial apps ship. But the product is held back by **token gaps** (no type-size scale, no spacing scale, no semantic color ramp) and a **second, off-system design language** (raw Tailwind indigo/slate/amber/crimson components) fighting the tokenized editorial one. The result reads as two products stitched together, and the difference is most visible exactly where it costs the most: the reading-surface quiz widgets and the dashboard.

### Per-dimension grades

| Dimension | Grade | One-line verdict |
|---|---|---|
| Visual hierarchy & Typography | C+ | Strong concept, but no modular scale; dark mode deletes the serif; reading measure too wide; data has no display tier. |
| Layout, Spacing & Grid | C+ | Landing is excellent; dashboard wastes ~60% of the viewport and has no spacing-scale tokens or shared container token. |
| Color, Theming & Contrast | C+ | Good token set, but legacy teal/blue leftovers, no success/warn/info tokens, and dark mode changes the brand *hue* (green→lime). |
| Components, States & Consistency | **C-** | Two parallel design languages; incomplete state matrix (`:disabled`/`:active`/`:focus-visible` missing); 4 competing "primary" buttons. |
| Responsive & Adaptive | C+ | Reflows mostly work, but real overflow bugs on mobile (reaction bar clipped, chat panel `w-[420px]`), sub-44px touch targets, no tablet sidebar. |
| Motion, Microinteraction & Affordance | **B** | Best dimension. Motion engineering is A-grade; pulled down by the onboarding tour that never spotlights its targets and weak empty-state affordance. |

---

## Blunt verdict: is this commercial / Figma-pro level?

**Not yet — but it is close in a way most apps aren't.** The visual taste, the motion/a11y rigor, and the landing page would pass a senior bar today. What *blocks* a Figma-pro sign-off is consistency, and consistency is failing for one structural reason: **the design system is half-built.** Tokens exist for color, radius, and shadow, but not for type size or spacing, and there is no semantic color ramp. So every page hand-picks literals, a second cohort of components (`InteractiveQuiz`, `AffectiveReaction`, `ConfidenceFeedback`, `RetentionBanner`, dashboard cards) was built entirely on raw Tailwind palette with zero tokens, and dark mode is only partial parity (serif stripped, brand hue shifted, off-token components don't invert).

A reviewer's eye lands on three "tells" immediately: (1) the dashboard is a tiny content block floating in a huge empty grid, (2) the reading surface shows two visually unrelated quiz widgets side by side (indigo radio-dot vs green letter-badge), and (3) dark mode looks like a *different, more neon product* than light. Fix those three and the perceived quality jumps a full grade.

---

## Top issues, ranked by impact on perceived quality

### 1. Dashboard wastes ~60% of the viewport as dead grid space  *(High)*
The content stack ends at ~600–700px, but `editorial-shell min-h-screen` forces the shell to 100vh, so the lower half is empty grid-textured background — it reads as an unfinished/broken page, not breathing room. This is the first thing a reviewer sees.
**Fix:** Move `min-h-screen` to an outer background layer only; let content be height:auto with a bottom tail: `<div className="editorial-shell min-h-screen"><div className="mx-auto max-w-5xl px-6 pb-24 md:px-8 flex flex-col gap-8">…</div></div>`.
**File:** `frontend/src/pages/StudentDashboard.jsx` (root, line 114)

### 2. Two parallel design languages: `InteractiveQuiz` is entirely off-token  *(High)*
The single most-used interactive widget uses **zero `--ath-*` tokens**: selection is `indigo-500/indigo-50`, chrome is hardcoded `bg-white / text-slate-700 / border-slate-200`, primary CTA is raw `bg-[#9E1B32]` crimson. Indigo selection exists nowhere else (everything else is green `--ath-primary #27624f`), and the white block does not invert in dark mode. On one reading section the learner sees this indigo radio-dot "Knowledge Check" directly above the green letter-badge "Practice" quiz — same job, two unrelated looks.
**Fix:** Replace the indigo/slate/crimson palette with tokens (`border-[var(--ath-primary)]`, `bg-[var(--ath-primary-soft)]`, `bg-[var(--ath-panel)]`, `text-[var(--ath-text)]`), matching `ParameterExplorer.jsx`/`PracticeBlock`. Extract a shared `<QuizOption>` primitive so both quiz widgets render identical markup.
**File:** `frontend/src/components/InteractiveQuiz.jsx`

### 3. Dark mode strips the serif AND shifts the brand hue — it's a different product at night  *(High)*
Two parity failures compound. (a) `index.css` lines 132–142 and 203–206 reassign every heading to IBM Plex Sans in dark, deleting the Fraunces serif/sans editorial contrast that *defines* the product. (b) `--ath-primary` flips from forest green `#27624f` (light) to near-lime `#b9ff4a` (dark, line 57) — a ~40° hue jump plus a saturation spike, so dark reads "neon/techy" not "calm editorial," and lime falsely signals success/active.
**Fix:** Delete the dark-mode font-family overrides (keep Fraunces; use `font-optical-sizing: auto` and the loaded 600–700 weights for contrast). Set dark `--ath-primary` to a lighter desaturated green (`#5fae8c` / `--ath-primary-deep #3f8a6a`); if lime is wanted, demote it to `--ath-accent`.
**File:** `frontend/src/index.css` (lines 57–58, 132–142, 203–206)

### 4. Incomplete interaction-state matrix — buttons have no disabled/active/focus  *(High)*
`.editorial-button` defines only default + `:hover` — no `:disabled`, `:active`, or `:focus-visible`. So the dashboard "Review" button keeps the full green gradient when disabled (reads as enabled), and `.editorial-button-secondary:hover` sets a background identical to its default (a literal no-op). Separately, the quiz disabled "Check Answer" is `bg-slate-300` + `text-white` ≈ 1.5:1 contrast — effectively illegible.
**Fix:** Add to `index.css`: `.editorial-button:active{transform:translateY(0);filter:brightness(.97)}` / `.editorial-button:disabled{opacity:.55;box-shadow:none;transform:none;cursor:not-allowed}` / `.editorial-button:focus-visible{outline:2px solid var(--ath-primary);outline-offset:2px}`. Give secondary a real hover delta (`background:var(--ath-panel-muted);border-color:var(--ath-line-strong)`). Route the quiz disabled state through `bg-[var(--ath-panel-muted)] text-[var(--ath-muted)]`, never white-on-grey.
**File:** `frontend/src/index.css` (lines 241–279) and `frontend/src/components/InteractiveQuiz.jsx`

### 5. No modular type scale + flat dashboard hierarchy + no data type tier  *(High)*
There are **zero `--ath` font-size tokens**; sizes are one-off literals (0.68/0.72/0.74/0.78/0.82/0.9/1.0625/1.08rem plus Tailwind `text-[10px]/[11px]/[15px]`) with no governing ratio, and 0.68 vs 0.72 vs 0.74 are visually indistinguishable steps. Downstream, the dashboard is a uniform 10–14px gray field: section titles (`text-sm font-semibold`) are the same size as body, focus kickers are `text-[10px]`, the serif face is absent, and quantitative values ("6", "14", mastery %) get no tabular/display treatment — nothing tells the eye where to start.
**Fix:** Define a 1.20 (minor-third) scale in `:root` (`--ath-text-2xs:0.75rem … --ath-text-3xl:2.25rem` + `--ath-text-stat:1.875rem`) and a `.ath-stat` utility (`IBM Plex Mono; font-variant-numeric:tabular-nums; font-weight:600`). Replace ad-hoc literals; raise `text-[10px]/[11px]` to the `2xs` 12px floor; promote dashboard card titles to Fraunces `--ath-text-xl` weight 600.
**Files:** `frontend/src/index.css`; `frontend/src/pages/StudentDashboard.jsx` (lines 268/301/321)

### 6. Reading body measure is 92ch — well past the readable window  *(High)*
`--reading-width: 92ch` (index.css line 40) drives `.reading-narrative` max-width. 92 characters/line is far beyond the 66ch ideal / 75ch upper bound, hurting return-sweep on the one surface where measure matters most. The breakout system (74rem) is separate, so tables/figures are unaffected.
**Fix:** Lower default to `--reading-width: 68ch`; keep a UDL "Wide" preference mapping to ~80ch. Single highest-impact reading-comfort change.
**File:** `frontend/src/index.css` (line 40)

### 7. Mobile overflow bugs: reaction bar clipped, chat panel wider than the viewport  *(High)*
On a 390px phone: (a) the `AffectiveReaction` bar is a non-wrapping `flex` of four `whitespace-nowrap` chips, so the first ("Got it" → "ot it") is clipped and "Boring" is pushed off-screen — content is unreachable; (b) `ChatWidget` opens at fixed `w-[420px]` + `right-6` = 444px required, overflowing a 390px viewport and triggering horizontal scroll, with `h-[600px]` clipping the composer.
**Fix:** Reaction bar → `flex flex-wrap justify-center gap-2 sm:gap-4`. Chat panel → `w-[min(420px,calc(100vw-2rem))] h-[min(600px,calc(100dvh-7rem))]` with `inset-x-3` on mobile and `dvh` (not `vh`).
**Files:** `frontend/src/components/AffectiveReaction.jsx` (line 37); `frontend/src/components/ChatWidget.jsx` (line 302)

### 8. OnboardingTour stores spotlight targets but never highlights them  *(High)*
Each step defines a `target` selector (`.intel-rail`, `[data-onboarding="chat-widget-button"]`, `.knowledge-graph-mount`) and the file promises learners won't "discover by trial and error" — but the render only paints a full-screen blur+scrim and a centered card. `target` is never queried: no `scrollIntoView`, no ring, no cutout. The tour *describes UI it actively obscures.*
**Fix:** On each step, `querySelector(current.target)`, `scrollIntoView({block:'center'})`, lift the element above the scrim with `outline:2px solid var(--ath-primary);outline-offset:4px` (or an SVG cutout), and position the card popper-style next to it. Gate smooth-scroll/highlight behind `useReducedMotion()`.
**File:** `frontend/src/components/OnboardingTour.jsx`

### 9. No semantic color ramp; off-system teal/blue focus & accents  *(High → consolidates color findings)*
There is no `--ath-success/-warning/-info`, so `Callout.jsx` hardcodes `#b45309/#047857/#6d28d9` and dashboard banners use raw `sky-/amber-/emerald-` (no dark values). Worse, a legacy **teal/blue** palette survives across `index.css` — input focus ring `rgba(15,81,103)` + glow `rgba(200,226,236)`, the `pulse`/`review-flash` keyframes, the shimmer gradient, and `.btn-crimson`'s `rgba(9,56,72)` shadow — so interactive states glow *blue* on a *green* app, and a `:focus-visible` fallback even resolves to purple `#6d28d9`.
**Fix:** Add a semantic ramp to both theme blocks (light `--ath-success #2f7d63 / --ath-warning #b45309 / --ath-info var(--ath-primary)`; dark variants). Tokenize focus to brand: `box-shadow:0 0 0 4px color-mix(in srgb, var(--ath-primary) 22%, transparent)`; drop every `rgba(15,81,103)/rgba(200,226,236)/rgba(9,56,72)/#6d28d9` literal. Rewrite Callout/banners/step-circles to derive tints via `color-mix(... var(--ath-success) ...)`.
**Files:** `frontend/src/index.css`; `frontend/src/components/Callout.jsx`

### 10. Touch targets below 44px across header & TOC  *(Medium)*
Reader header icon buttons are `h-9 w-9` (36px), the TOC drawer close is `h-8 w-8` (32px), and TOC rows are ~38px — all under the 44px (Apple) / 48px (Material) minimum, on the most densely packed mobile surface.
**Fix:** Add a global `@media (pointer: coarse){ header button, [role=button] { min-height:44px; min-width:44px } }` in `index.css`; bump TOC rows to `py-3`, drawer close to `h-10 w-10`, allow `md:h-9 md:w-9` for mouse.
**Files:** `frontend/src/pages/BookLayout.jsx`; `frontend/src/components/BookToc.jsx`

---

## Quick wins (additive-safe, low-risk)

- **Delete the Vite scaffold logo-spin** — `App.css` lines 30–33 ship an infinite 20s spin on a brittle `a:nth-of-type(2)` selector, contradicting the motion-restraint system. Remove it.
- **Fix the unloaded serif** — `.prose` / `.newsreader` reference `'Newsreader'`, which is **not in the `@import`** (line 1 loads Fraunces, not Newsreader), so those headings silently fall back to Georgia — a *second* serif. Replace `'Newsreader'` with `'Fraunces'` (index.css lines 126, 541).
- **Tokenize the input focus ring** to `color-mix(... var(--ath-primary) ...)` and drop the purple `#6d28d9` fallback (index.css lines 292–294, 305). One-line, removes the blue-on-green clash.
- **Lower `--reading-width` to 68ch** (index.css line 40). One value, biggest reading-comfort gain.
- **Swap landing stat-card label/value weight** so the substantive phrase ("pathway-aware reading") is the dominant line, not the tiny mono kicker (`LandingPage.jsx` lines 158–164).
- **Add `min-h-[7.5rem]` + `gap-4`** to the dashboard "Today's focus" 3-up so cards keep equal height and read as a deliberate band (`StudentDashboard.jsx` lines 189–195).
- **Standardize card chrome** — replace inline `rounded-2xl … bg-white/85 shadow-sm` on ~7 dashboard cards with the existing `.content-card` class so they dark-adapt and match elevation elsewhere.
- **Add `font-variant-numeric: tabular-nums`** to numeric spans (reading sidebar 6/14, mastery %) — the codebase currently has exactly one usage.

---

## Systemic design-system gaps

1. **No type-size scale.** Add `--ath-text-*` tokens on a fixed ratio; this is the single most-cited root cause across the typography, dashboard-hierarchy, and label-size findings.
2. **No spacing scale.** No `--ath-space-*` / `--ath-section-gap` / `--ath-gutter` exist, so the 8pt rhythm is accidental (section margins drift `mt-4/mt-6/mt-8`, gaps mix `gap-3/4/5/6`). Add a 4/8-base scale and one section-gap token.
3. **No semantic color ramp.** No success/warning/info tokens, so components hardcode off-system hexes (`#b45309`, `#047857`, `sky-/amber-/emerald-`) with no dark values. Add the ramp in both theme blocks and derive tints via `color-mix`.
4. **No shared container token.** Each surface invents a width (dashboard 1024 / landing 1280 / diagnostic 768/896 / reading 92ch), so the canvas visibly jumps between pages. Add `--ath-container-app / -marketing / -focus` + a `.ath-container` utility.
5. **Incomplete state matrix in the button primitive.** `.editorial-button` lacks `:disabled/:active/:focus-visible`; secondary `:hover` is a no-op. Encode the full matrix once in `index.css`.
6. **Two design languages.** A whole cohort (`InteractiveQuiz`, `AffectiveReaction`, `ConfidenceFeedback`, `RetentionBanner`, dashboard cards) bypasses tokens for raw Tailwind palette and therefore has no dark parity. Port them to `--ath-*` the way `StepReveal`/`BranchingScenario`/`ParameterExplorer` already are.
7. **Four competing "primary" buttons** (`.editorial-button`, `.btn-crimson` — which is actually green — raw `bg-[#9E1B32]`, ad-hoc Tailwind). Collapse to one primary + one secondary; rename the misleading `.btn-crimson`; reserve crimson for destructive only.
8. **No interactive-vs-static card taxonomy.** Clickable Today's-focus buttons and read-only summary panels share identical chrome, so nothing in the visual language encodes "this is clickable." Introduce `.card-actionable` (hover-lift, cursor, at-rest directional cue) vs `.card-surface` (no transform).
9. **No reusable empty-state primitive.** Every dashboard zero-state is a bare muted sentence; build `<EmptyState icon title body action>` with a dashed-border container and a recovery CTA.
10. **No data-viz token ramp + no diagram dark parity.** Concept diagrams hardcode the Tailwind default ramp (`#ef4444/#10b981/#3b82f6`) and light SVG fills (`#f8fafc`) that vanish on the `#08090b` dark canvas. Add `--ath-viz-1..5` (both themes) and make fills theme-aware.
11. **Reduced-motion clamp is duration-only.** It zeroes `animation/transition` duration but leaves transform *end-states* (`hover:scale-105`, `hover:-translate-y-0.5`) active, so reduced-motion users still get positional jumps. Add `@media (prefers-reduced-motion: reduce){ button:hover,[role=button]:hover{transform:none !important} }` or route through `motion.js`.

---

## What's genuinely good (keep / protect)

- **Motion + a11y engineering** — `motion.js` `useReducedMotion`, JS-side transform-offset stripping, global `prefers-reduced-motion` clamp, `:focus-visible` separation, skip link, slider/select ring tokens. A-grade; don't regress it.
- **Landing page** layout — `max-w-7xl`, consistent `py-20` rhythm, even `gap-6/gap-10` grids. Use it as the spacing reference for the rest of the app.
- **Reading heading rhythm** — clamp-based h1–h4 with sensible margins and `line-height: 1.78`.
- **The `--ath-*` token set + editorial palette** in light mode reads premium; the foundation is right, it just needs to be *completed and enforced*.
