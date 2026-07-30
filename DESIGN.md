# ALGET Design System

This contract records the visual and interaction system that exists in the tracked ALGET frontend as of 2026-07-10. It is descriptive, not a redesign brief. Product code remains the runtime authority when this document and the implementation differ.

## 1. Atmosphere & Identity

ALGET is an editorial intelligent textbook: calm cream reading surfaces, ink-like text, restrained botanical green controls, and warm amber emphasis make long study sessions feel more like a modern academic book than an application dashboard. The signature is the transition from a narrow, centered prose column to wide interactive textbook material without losing reading position or typographic continuity. The tracked palette is cream/green/amber, not navy/cyan; navy/cyan wording from earlier planning is stale and must not be used to introduce new tokens.

## 2. Color

### Semantic palette

All shared surfaces should consume the existing `--ath-*` roles. Raw colors already embedded in legacy or specialist diagrams are implementation debt, not permission to add new shared palette values.

| Role | Token | Light value | Dark value | Existing use |
|---|---|---:|---:|---|
| Canvas | `--ath-background` | `#f8f8f4` | `#08090b` | Page background and inverse control text |
| Translucent surface | `--ath-surface` | `rgba(255, 255, 252, 0.86)` | `rgba(17, 19, 23, 0.86)` | Glass/editorial panels |
| Strong surface | `--ath-surface-strong` | `rgba(255, 255, 252, 0.96)` | `rgba(22, 25, 30, 0.96)` | Modal and elevated reading chrome |
| Panel | `--ath-panel` | `#fffffc` | `#111318` | Controls and cards |
| Muted panel | `--ath-panel-muted` | `#eeeee8` | `#181b21` | Secondary bands and disabled/resting areas |
| Divider | `--ath-line` | `rgba(32, 38, 36, 0.14)` | `rgba(204, 214, 220, 0.14)` | Borders and rules |
| Strong divider | `--ath-line-strong` | `rgba(20, 27, 24, 0.24)` | `rgba(219, 232, 239, 0.24)` | Emphasized boundaries |
| Primary action | `--ath-primary` | `#27624f` | `#5fae8c` | Links, selected controls, focus, key icons |
| Primary emphasis | `--ath-primary-deep` | `#163f34` | `#3f8a6a` | Strong prose and primary gradients |
| Primary tint | `--ath-primary-soft` | `#d9ebe2` | `#1c3329` | Soft selected/related surfaces |
| Secondary text | `--ath-secondary` | `#5a615d` | `#9aa4aa` | Labels and lower-emphasis controls |
| Primary text | `--ath-text` | `#171a17` | `#f2f4f5` | Body and headings |
| Muted text | `--ath-muted` | `#555f59` | `#a4adb3` | Help and supporting text |
| Accent | `--ath-accent` | `#8a5f24` | `#b9ff4a` | Intentional highlights, not the primary action color |
| Danger | `--ath-danger` | `#a33a2d` | `#ff8674` | Error/destructive feedback |
| Top bar | `--ath-topbar` | `rgba(255, 255, 252, 0.86)` | `rgba(10, 11, 13, 0.88)` | Persistent book chrome |
| Grid line | `--ath-grid-line` | `rgba(25, 32, 29, 0.045)` | `rgba(95, 174, 140, 0.06)` | Background grid texture |
| Success | `--ath-success` | `#2f7d63` | `#5fae8c` | Positive state |
| Warning | `--ath-warning` | `#b45309` | `#e0a04a` | Caution state |
| Information | `--ath-info` | `var(--ath-primary)` | `#6bb3df` | Informational state |

`--ath-success-soft`, `--ath-warning-soft`, and `--ath-info-soft` are derived with `color-mix()` at 14% in light mode and 20% in dark mode. The existing five-step data-visualization ramp is `--ath-viz-1` through `--ath-viz-5`; it is categorical support, not a general component palette.

### Color rules

- Theme selection lives on `document.documentElement[data-theme]`; `light` and `dark` are the only accepted values.
- The primary role marks interaction, selection, focus, and important textbook emphasis. Accent is sparse.
- Do not translate the current green system into navy/cyan and do not add a new shared color without updating this contract first.

## 3. Typography

### Family roles

| Role | Existing stack | Use |
|---|---|---|
| Editorial/display serif | `Fraunces, Georgia, serif` | H1-H3, page titles, prose headings; reading headings use weight 650, line-height 1.12, tracking `-0.015em` |
| Interface and reading sans | `IBM Plex Sans, Inter, Segoe UI, sans-serif` | Body prose, controls, navigation, labels; the body fallback uses `system-ui` |
| Quantitative/label mono | `IBM Plex Mono, JetBrains Mono, ui-monospace, monospace` | Kicker/overline labels and tabular numeric displays |
| Code mono | `JetBrains Mono, Menlo, Monaco, monospace` | Preformatted code |
| Optional reading aids | `OpenDyslexic` and `Atkinson Hyperlegible` with safe sans fallbacks | User-selectable reading preference; current selector mismatch is accepted debt in Section 8 |

ALGET uses at most the three functional families already present: serif for editorial hierarchy, sans for continuous reading and interface work, and mono for data/code/labels. Do not substitute a new font family as visual direction.

### Existing type scale and reader rhythm

The shared `--ath-text-*` scale is 12, 13, 14, 16, 18, 24, 30, and 36px (`2xs` through `3xl`), with `--ath-text-stat: 30px`. Generic `.prose` uses Fraunces headings at 30/24/20/18px and 1.15 line-height; its paragraphs and lists use 1.75.

The textbook reader is a distinct surface:

- Desktop/tablet above 720px: `.reading-narrative` and its paragraphs are `calc(1.125rem * --reading-font-scale)`, giving 18px at 100%. The live default is Standard line spacing, 1.7, giving 30.6px at 18px.
- Mobile at 720px and below: the current rule hardcodes narrative and paragraph size to 16px and paragraph line-height to 1.82. This preserves a 16px baseline but currently prevents paragraph size/line spacing preferences from inheriting; Section 8 records the debt.
- H1 is `clamp(2.15rem, 4vw, 3.6rem)`, H2 is `clamp(1.65rem, 2.5vw, 2.25rem)`, H3 is `clamp(1.28rem, 2vw, 1.55rem)`, and H4 is an uppercase 0.9rem sans label.
- Paragraphs use pretty wrapping and lists inherit the live reader line-height above 720px. Long tokens wrap rather than forcing horizontal page overflow.

## 4. Spacing & Layout

### Spacing basis

The shared spacing basis is 4px. Existing tokens are `--ath-space-1` through `--ath-space-8`: 4, 8, 12, 16, 24, 32, 48, and 64px. `--ath-section-gap` is 32px and `--ath-gutter` is 24px. Reader-specific rhythm is semantic rather than forced onto that scale: `--reading-paragraph-spacing` defaults in CSS to `1.35rem`, while the live Standard preference sets it to `1.2em`.

### Widths and responsive contract

| Surface/state | Existing width or rule |
|---|---|
| App shell | `--ath-container-app: 64rem` |
| Marketing shell | `--ath-container-marketing: 80rem` |
| Focused flow | `--ath-container-focus: 48rem` |
| Reading shell | `--ath-container-reading: 80rem` |
| Standard prose measure | `--reading-width: 72ch` |
| Reader options | Narrow `60ch`, Standard `72ch`, Wide `92ch` |
| Reader breakout | `--reading-breakout: 74rem` |

The article fills `min(--reading-breakout, 100%)`; direct prose, list, blockquote, heading, and read-aloud children remain centered at the selected reading measure. Tables, figures, preformatted content, worked examples, and interactive blocks use the wider breakout lane. Table wrappers scroll horizontally instead of clipping.

The affected breakpoint matrix is exact:

| Width | Contract |
|---:|---|
| `<=720px` | Mobile reader baseline: 16px narrative/paragraph text, 1.82 paragraph line-height, H2 top margin 2.35rem. Current preference-inheritance exception is debt, not a new rule to copy elsewhere. |
| `721-1279px` | Desktop/tablet prose rhythm and selected preferences apply; breakouts remain clamped to the article width. |
| `>=1280px` | Breakouts may extend symmetrically beyond the prose measure up to 74rem and `calc(100% + 14rem)`. |

Book chrome also uses the existing Tailwind responsive boundaries at 768px (`md`), 1024px (`lg`), and 1280px (`xl`). Reader typography changes are owned only by the explicit 720px rule; do not treat `md` as an alias for that boundary.

## 5. Components

The existing `/book/:course/:chapter/:section` route is the primitive and state harness for this contract.

### Textbook narrative

- **Structure:** semantic `<article class="prose reading-narrative reading-narrative-fluid">` containing Markdown headings, paragraphs, lists, blockquotes, code, figures, tables, and typed interactive nodes.
- **Typography:** centered sans prose with Fraunces H1-H3 and sans uppercase H4; paragraphs use `--reading-font-scale`, `--reading-line-height`, and `--reading-paragraph-spacing` except for the mobile debt.
- **Widths:** selected 60/72/92ch prose measure, with 74rem breakout lane.
- **States:** content, empty source (`No content available`), lazy interactive loading, unavailable interactive fallback, and block error containment.
- **Accessibility:** semantic headings/paragraphs, generated stable heading anchors, wrap-safe prose, scrollable wide tables, and no expert-answer source leakage from unparsed interactive tags.

### Textbook prose primitives

- **Paragraph:** primary text, user-controlled size/rhythm, `text-wrap: pretty`, default live margin 1.2em.
- **Ordered/unordered list:** 1.4rem left inset, 0.6rem item spacing, selected reader line-height.
- **H1-H3:** balanced Fraunces display hierarchy with stable reading anchors and 8rem scroll margin.
- **H4:** 0.9rem IBM Plex Sans label, weight 800, `0.08em` tracking, uppercase, secondary color.
- **Wide material:** figure, pre, worked example, `.reading-table-scroll`, and `[data-reading-breakout]`; nested wide material is constrained to its parent board.

### Reading-preference segmented control

- **Structure:** labelled group containing buttons with `role="radio"`, `aria-checked`, and a hidden named input.
- **States:** unselected uses line border and muted text; hover raises text to primary; selected uses the primary border plus a 14% primary tint; Reset restores all defaults. Focus is supplied by the global `:focus-visible` outline.
- **Text-size states:** 100%, 112%, 125%, 150% (`1`, `1.12`, `1.25`, `1.5`).
- **Line-spacing states:** Compact `1.4`, Standard `1.7`, Relaxed `2.0`.
- **Paragraph-spacing states:** Tight `0.75em`, Standard `1.2em`, Airy `1.8em`.
- **Measure states:** Narrow `60ch`, Standard `72ch`, Wide `92ch`.
- **Font states:** Off, OpenDyslexic, Atkinson Hyperlegible; CSS consumption is currently incomplete as recorded in Section 8.
- **Persistence:** preferences merge over defaults from `localStorage.alget_reading_prefs`; invalid scalar options fall back during CSS application.

### Read-aloud toolbar

- **Structure:** labelled `role="group"` with Play/Pause/Resume, Stop, and a polite screen-reader status.
- **Idle:** primary button says Play; Stop is disabled at 50% opacity with not-allowed cursor; status is “Reading stopped.”
- **Speaking:** primary button and accessible name change to Pause; Stop is enabled; status is “Reading section aloud.”
- **Paused:** primary button and accessible name change to Resume; Stop remains enabled; status is “Reading paused.”
- **Unsupported:** the toolbar is not rendered when browser `speechSynthesis` is unavailable.
- **Lifecycle:** section/content changes and unmount cancel speech and return the UI to idle.
- **Interaction:** hover uses the panel surface, keyboard focus uses a two-pixel primary-tinted ring, and buttons retain native disabled semantics.

### Settings dialog

- **Structure:** modal dialog with focus trap, labelled title, scrollable 90vh panel, close control, reading controls, and sticky footer.
- **States:** closed/unmounted; open; backdrop dismissal; Escape dismissal; control selection; reset; API-key saved feedback. Reading preferences apply instantly and persist independently of the footer save action.
- **Accessibility:** `role="dialog"`, `aria-modal`, labelled heading, explicit close name, trapped focus, and keyboard dismissal.

## 6. Motion & Interaction

- Reader interactive blocks enter only under `prefers-reduced-motion: no-preference` with opacity plus `translateY(8px)` over 420ms using `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- Controls inside reader breakouts transition background, border, color, box-shadow, and transform over 180ms; enabled press feedback translates down 1px.
- Section forward/back transitions use 280ms and `cubic-bezier(0.16, 1, 0.3, 1)`.
- Under `prefers-reduced-motion: reduce`, animation and transition duration clamps to 0.01ms, scroll behavior becomes auto, and hover/focus transforms are neutralized.
- Every keyboard-focusable element receives a 2px `--ath-primary` outline at 2px offset unless it supplies a more specific visible ring. Motion must communicate state or navigation; do not add decorative animation.

## 7. Depth & Surface

ALGET uses a mixed depth strategy already present in the frontend: cream/dark tonal shifts establish base hierarchy, whisper-thin semantic borders establish component edges, and layered contact-plus-ambient shadows elevate cards and modal chrome. Light `--ath-shadow` combines `0 1px 2px rgba(27, 34, 31, 0.05)` with `0 22px 50px rgba(27, 34, 31, 0.11)`; `--ath-shadow-soft` uses the same contact cue with `0 10px 28px rgba(27, 34, 31, 0.07)`. Dark mode uses stronger single ambient shadows. Glass/editorial surfaces use the semantic translucent surface, a 22px backdrop blur, a softened line border, and `--ath-shadow-soft`. This is existing material behavior; it is not a request to increase blur, radius, or elevation.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA for the reader and its controls: semantic structure, keyboard reachability, visible focus, native disabled state, and non-color-only selected states are required.
- User reading preferences must remain meaningful from 100-150% scale, Compact/Standard/Relaxed line spacing, Tight/Standard/Airy paragraph spacing, and 60/72/92ch measures.
- Text-spacing compatibility follows WCAG 1.4.12: content must remain readable and unclipped when an external override requests line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em. Long tokens must wrap; wide tables may scroll inside their wrapper; controls and text must not overlap or be truncated.
- The 72ch Standard measure and 1.2em Standard paragraph spacing are preserved. Desktop/tablet reader rhythm must remain 18px at 100% and 1.7 Standard line-height. Mobile baseline remains 16px while preference inheritance is repaired in a separately approved task.
- Light/dark theme switching, `prefers-reduced-motion`, polite speech status, focus trapping, radio names/values, and responsive reading order are contractual behavior.

### Accepted debt

| Item | Location | Affected users / reason accepted | Owner / exit condition |
|---|---|---|---|
| Mobile paragraph preference inheritance | `frontend/src/index.css` `@media (max-width: 720px)` | Users selecting 112-150% or Compact/Standard/Relaxed see paragraphs forced to 16px/1.82 at mobile widths. Accepted only because this extraction task cannot change product code. | Reader hardening task: retain the 16px base through `calc(1rem * --reading-font-scale)` and consume `--reading-line-height`; verify at 375/720/721/768/1280. |
| Dyslexia option selector mismatch | `frontend/src/lib/readingPrefs.js` and `frontend/src/index.css` | The preference layer toggles `.font-opendyslexic`/`.font-atkinson`, while CSS consumes `.font-dyslexic`; selected fonts and spacing may not apply. Accepted as pre-existing, out-of-scope behavior. | A separately approved accessibility repair must align each option with its intended family and verify computed font/spacing. |
| Legacy raw colors and utility-specific tints | Existing components and specialist diagrams | Some surfaces bypass `--ath-*`, so theme fidelity and contrast are not guaranteed uniformly. This task is documentation only and must not silently consolidate them. | Consolidate only through an approved, tested design-system migration. |
| Native speech synthesis variability | `ReadingNarrative.jsx` read-aloud toolbar | Voice availability, pronunciation, and browser support vary; unsupported browsers intentionally omit the toolbar. | Revisit only if a product requirement adopts a controlled narration service or additional fallback. |

No new debt, color direction, font, spacing token, component, or breakpoint is authorized by this document.
