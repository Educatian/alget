# ALGET UI Accessibility Review (WCAG 2.2 AA + UDL)

This is the durable PR gate for any change that touches the UI. Accessibility in ALGET is a recurring review requirement, not a one-time pass (see `docs/core-beliefs.md` belief 3). Every PR that adds or modifies a React component, a page, a diagram, or an interactive block is reviewed against this checklist. The target is WCAG 2.2 Level AA plus the Universal Design for Learning posture that ALGET's reading experience commits to.

The frontend already ships the tooling that backs several of these items: `eslint-plugin-jsx-a11y` runs in CI (`npx eslint src`), and `@axe-core/playwright` is available for e2e accessibility assertions. Use them; do not rely on visual inspection alone.

How to use this file: copy the checklist into the PR description, check each item, and for anything not applicable write "n/a, <reason>". A reviewer should be able to reproduce each judgment.

---

## Structure and semantics

- [ ] **Real headings, in order.** Section content uses a logical `h1` → `h2` → `h3` hierarchy with no skipped levels. Do not fake a heading with bold text; do not use a heading for visual size only.
- [ ] **Landmarks.** Page regions use the correct landmark roles/elements (`main`, `nav`, `header`, `aside`). There is exactly one `main` per page (the reading body in `BookLayout`).
- [ ] **Semantic elements over `div` soup.** Buttons are `<button>`, links are `<a>`/`<Link>`, lists are lists. A clickable `div` is a defect.
- [ ] **Accessible names.** Every interactive control has an accessible name (visible label, `aria-label`, or `aria-labelledby`). Icon-only controls (lucide-react icons in `IntelRail`, `ChatWidget`, toolbar buttons) must carry a text label.
- [ ] **State exposed to assistive tech.** Toggle/expanded/selected/checked state is conveyed with the right ARIA (`aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current`), not by appearance alone.

## Keyboard operability (no traps)

- [ ] **Everything operable by keyboard.** Every action reachable by mouse is reachable and operable by keyboard alone (Tab/Shift+Tab/Enter/Space/Arrows as appropriate). This explicitly includes `InteractiveQuiz`, `ArtifactStudio`, `DynamicScenario`, `InlineCheck`, the social-annotation surfaces (`HighlightableContent`, `HighlightDiscussion`), `Glossary`, and `KnowledgeGraph`.
- [ ] **No keyboard trap.** Focus can always move out of any widget with the keyboard. Custom widgets that capture keys must release focus on Escape or Tab.
- [ ] **Logical focus order.** Tab order follows reading/visual order. New content inserted into the page does not scramble the sequence.
- [ ] **Skip link.** A "skip to main content" mechanism is present and works.
- [ ] **No focus loss on dynamic updates.** When content swaps (route change, recommendation card appears, quiz advances), focus is moved to a sensible target and never dropped to `body`.

## Visible focus and pointer targets

- [ ] **Visible focus indicator.** Every focusable element shows a clearly visible focus indicator. The indicator's contrast against adjacent colors is at least **3:1**, and it is never removed (`outline: none` without a replacement is a defect).
- [ ] **Focus not obscured.** The focused element is not hidden behind sticky headers, the `IntelRail`, or overlays (WCAG 2.2 Focus Not Obscured).
- [ ] **Target size ≥ 44×44 px.** Pointer targets are at least 44 by 44 CSS pixels, or have sufficient spacing (WCAG 2.2 Target Size AA). Watch annotation handles, diagram hotspots, and compact toolbar icons.
- [ ] **Dragging has an alternative.** Any drag interaction (artifact reordering, diagram manipulation) offers a single-pointer / keyboard alternative (WCAG 2.2 Dragging Movements).

## Color and contrast

- [ ] **Text contrast ≥ 4.5:1** for normal text, **≥ 3:1** for large text (≥ 24px, or ≥ 19px bold).
- [ ] **Non-text contrast ≥ 3:1** for UI component boundaries, icons that convey meaning, focus indicators, and the informative parts of diagrams.
- [ ] **No color-only state.** Correct/incorrect, selected, required, error, and status are never conveyed by color alone. Pair color with text, an icon, a shape, or a pattern. This is the most common failure in quiz feedback and diagram legends.
- [ ] **Themes pass too.** Contrast holds in every shipped theme (`theme.jsx` / `themeContext.js`), including dark mode.

## Text, media, and alternatives

- [ ] **Images and diagrams have alternatives.** Decorative images are `alt=""`. Informative images carry meaningful `alt`. SVG diagrams use `AccessibleSvg` / proper `role="img"` + `aria-label`, or an accompanying text description; a complex diagram has a longer prose equivalent in the section body.
- [ ] **Captions/transcripts.** Any animation, Remotion player, or generated media that carries instructional content has a caption or text equivalent.
- [ ] **Math is readable.** KaTeX output exposes its content to assistive tech (KaTeX emits MathML by default; do not disable it).
- [ ] **Static fallback.** Each interactive block (`InteractiveQuiz`, `ArtifactStudio`, `DynamicScenario`) degrades to a faithful static rendering for print / screen-reader / no-JS contexts. The practice schema already carries `stem`/`statement`/`explanation`/`expected_answer`/`final_answer`, so a degraded-but-complete view is always derivable. `MarkdownBlockFallback` is the contract; verify the fallback actually conveys the item.

## Motion, reflow, and zoom

- [ ] **Reduced motion honored.** Animations (`animations/`, gear/flight diagrams, transitions) respect `prefers-reduced-motion: reduce` and provide a non-animated path. No essential information is conveyed only through motion.
- [ ] **No seizure risk.** Nothing flashes more than three times per second.
- [ ] **200% reflow.** At 200% zoom (and at a 320 CSS-px viewport width equivalent) content reflows to a single column with no loss of content or function and no horizontal scrolling of the reading body (WCAG Reflow). The `IntelRail`/sidebar collapses gracefully.
- [ ] **Text spacing override.** Content survives user text-spacing overrides (line height, paragraph/letter/word spacing) without clipping or overlap.

## Dialogs, overlays, and live regions

- [ ] **Focus-trapped dialogs.** Modal dialogs (`AuthModal`, onboarding, any popover used as a modal) trap focus while open, return focus to the trigger on close, close on Escape, and expose `role="dialog"` + `aria-modal="true"` + an accessible name. Background content is inert.
- [ ] **Radix primitives configured correctly.** Where `@radix-ui/react-popover` / `react-tooltip` are used, confirm they are not suppressing the built-in focus management and that tooltips are not the only way to access essential information.
- [ ] **Live regions for async updates.** Asynchronous status (grading result, adaptive recommendation appearing, toast notifications from `toast.jsx`, chat responses) is announced via an appropriate `aria-live` region. Errors use `role="alert"`.

## Forms and feedback

- [ ] **Labels tied to inputs.** Every input has a programmatically associated label. Placeholder text is not a label.
- [ ] **Errors identified in text.** Validation errors name the field and the problem in text, are associated with the input (`aria-describedby`), and move focus to or announce the first error.
- [ ] **Instructions are perceivable.** Required fields, formats, and constraints are stated in text, not implied by color or position.

---

### Reviewer sign-off

A PR touching the UI is not approvable until every applicable box above is checked or explicitly marked n/a with a reason. If a change cannot meet an item, that is a tracked accessibility defect, not a silent exception.
