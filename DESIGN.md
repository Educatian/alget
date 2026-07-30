# ALGET Design System

This contract records the visual and interaction system that exists in the tracked ALGET frontend as of 2026-07-30. Product code remains the runtime authority when this document and the implementation differ. The editable design-system companion is [ALGET Unified UI System & QA](https://www.figma.com/design/A7fzj3TaoyDNZzMK4dy3GD).

## 1. Atmosphere & Identity

ALGET is an editorial intelligent textbook: calm cream reading surfaces, ink-like text, restrained botanical green controls, and warm amber emphasis make long study sessions feel more like a modern academic book than an application dashboard. The signature is the transition from a narrow, centered prose column to wide interactive textbook material without losing reading position or typographic continuity. The tracked palette is cream/green/amber, not navy/cyan; navy/cyan wording from earlier planning is stale and must not be used to introduce new tokens.

## 2. Color

### Semantic palette

All shared surfaces should consume the existing `--ath-*` roles. Raw colors already embedded in legacy or specialist diagrams are implementation debt, not permission to add new shared palette values.

| Role | Token | Light value | Dark value | Existing use |
|---|---|---:|---:|---|
| Canvas | `--ath-background` | `#f5f5ef` | `#08090b` | Page background and inverse control text |
| Translucent surface | `--ath-surface` | `rgba(255, 255, 252, 0.86)` | `rgba(17, 19, 23, 0.86)` | Glass/editorial panels |
| Strong surface | `--ath-surface-strong` | `rgba(255, 255, 252, 0.96)` | `rgba(22, 25, 30, 0.96)` | Modal and elevated reading chrome |
| Panel | `--ath-panel` | `#fdfdf9` | `#111318` | Controls and cards |
| Muted panel | `--ath-panel-muted` | `#eceee7` | `#181b21` | Secondary bands and disabled/resting areas |
| Divider | `--ath-line` | `rgba(32, 38, 36, 0.085)` | `rgba(204, 214, 220, 0.10)` | Borders and rules |
| Strong divider | `--ath-line-strong` | `rgba(20, 27, 24, 0.16)` | `rgba(219, 232, 239, 0.18)` | Emphasized boundaries |
| Primary action | `--ath-primary` | `#1f624c` | `#5fae8c` | Links, selected controls, focus, key icons |
| Primary emphasis | `--ath-primary-deep` | `#123e31` | `#3f8a6a` | Strong prose and primary gradients |
| Primary tint | `--ath-primary-soft` | `#dcece3` | `#1c3329` | Soft selected/related surfaces |
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

- Desktop/tablet above 720px: `.reading-narrative` and its paragraphs are `calc(1.0625rem * --reading-font-scale)`, giving 17px at 100%. Standard line spacing is 1.58 in persisted preferences; the CSS fallback is 1.56.
- Mobile at 720px and below: the baseline is `calc(1rem * --reading-font-scale)` and continues to consume `--reading-line-height`, so learner preferences remain active.
- H1 is `clamp(2rem, 3.4vw, 3.2rem)`, H2 is `clamp(1.55rem, 2.2vw, 2.05rem)`, H3 is `clamp(1.28rem, 2vw, 1.55rem)`, and H4 is an uppercase 0.9rem sans label.
- Paragraphs use pretty wrapping and lists inherit the live reader line-height above 720px. Long tokens wrap rather than forcing horizontal page overflow.

## 4. Spacing & Layout

### Spacing basis

The shared spacing basis is 4px. Existing tokens are `--ath-space-1` through `--ath-space-8`: 4, 8, 12, 16, 24, 32, 48, and 64px. `--ath-section-gap` is 20px and `--ath-gutter` is `clamp(16px, 2.5vw, 24px)`. Reader paragraph spacing defaults to `0.72rem`; persisted options are Tight `0.55em`, Standard `0.85em`, and Airy `1.25em`.

### Widths and responsive contract

| Surface/state | Existing width or rule |
|---|---|
| App shell | `--ath-container-app: 64rem` |
| Marketing shell | `--ath-container-marketing: 80rem` |
| Focused flow | `--ath-container-focus: 48rem` |
| Reading shell | `--ath-container-reading: 80rem` |
| Standard prose measure | `--reading-width: 68ch` |
| Reader options | Narrow `60ch`, Standard `68ch`, Wide `82ch` |
| Reader breakout | `--reading-breakout: 74rem` |

The article fills `min(--reading-breakout, 100%)`; direct prose, list, blockquote, heading, and read-aloud children remain centered at the selected reading measure. Tables, figures, preformatted content, worked examples, and interactive blocks use the wider breakout lane. Table wrappers scroll horizontally instead of clipping.

The affected breakpoint matrix is exact:

| Width | Contract |
|---:|---|
| `<=720px` | Mobile reader baseline: 16px narrative/paragraph text while font-scale and line-height preferences continue to inherit. |
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
- **Line-spacing states:** Compact `1.42`, Standard `1.58`, Relaxed `1.75`.
- **Paragraph-spacing states:** Tight `0.55em`, Standard `0.85em`, Airy `1.25em`.
- **Measure states:** Narrow `60ch`, Standard `68ch`, Wide `82ch`.
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

ALGET uses a restrained depth strategy: tonal shifts establish hierarchy, semantic rules explain interaction, and elevation is reserved for floating chrome. Light `--ath-shadow` combines `0 1px 2px rgba(27, 34, 31, 0.03)` with `0 12px 30px rgba(27, 34, 31, 0.055)`; `--ath-shadow-soft` uses `0 1px 2px rgba(27, 34, 31, 0.02)` with `0 6px 16px rgba(27, 34, 31, 0.028)`. Dashboards and textbook interactions should prefer open-flow rules, vertical accents, or tonal bands over nested outlined cards.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA for the reader and its controls: semantic structure, keyboard reachability, visible focus, native disabled state, and non-color-only selected states are required.
- User reading preferences must remain meaningful from 100-150% scale, Compact/Standard/Relaxed line spacing, Tight/Standard/Airy paragraph spacing, and 60/72/92ch measures.
- Text-spacing compatibility follows WCAG 1.4.12: content must remain readable and unclipped when an external override requests line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em. Long tokens must wrap; wide tables may scroll inside their wrapper; controls and text must not overlap or be truncated.
- The 68ch Standard measure and 0.85em persisted Standard paragraph spacing are preserved. Desktop/tablet reader rhythm remains 17px at 100% and 1.58 Standard line-height; the mobile baseline remains 16px while inheriting learner preferences.
- Light/dark theme switching, `prefers-reduced-motion`, polite speech status, focus trapping, radio names/values, and responsive reading order are contractual behavior.

### Accepted debt

| Item | Location | Affected users / reason accepted | Owner / exit condition |
|---|---|---|---|
| Legacy raw colors and utility-specific tints | Existing components and specialist diagrams | Some surfaces bypass `--ath-*`, so theme fidelity and contrast are not guaranteed uniformly. This task is documentation only and must not silently consolidate them. | Consolidate only through an approved, tested design-system migration. |
| Native speech synthesis variability | `ReadingNarrative.jsx` read-aloud toolbar | Voice availability, pronunciation, and browser support vary; unsupported browsers intentionally omit the toolbar. | Revisit only if a product requirement adopts a controlled narration service or additional fallback. |

No new debt, color direction, font, spacing token, component, or breakpoint is authorized by this document.
