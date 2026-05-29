# ALGET Core Beliefs

These are the values ALGET optimizes for. They are deliberately few and deliberately opinionated. When a design decision is ambiguous, resolve it in favor of the belief, not the convenience. Each belief is load-bearing somewhere in the codebase, so each one names where it is realized.

---

## 1. The artifact is the unit of adaptation

Most intelligent textbooks treat a graded item attempt as the atom of adaptation. ALGET treats the learner's evolving artifact as the unit. A learner revises a design or an argument, the revision is scored against a rubric, and the before/after quality and the after-minus-before delta become first-class signals in the support-move decision.

This is why the adaptive policy fuses three families rather than one: knowledge-tracing/telemetry, scored artifact-revision, and social annotation (see `ARCHITECTURE.md` section 3 and `backend/knowledge_tracing.py`). Removing the artifact and annotation families would collapse ALGET back into a conventional item-response tutor. We do not do that; the artifact-mediated, closed-loop adaptivity is the contribution.

## 2. Every adaptive decision must carry a faithful provenance

An adaptive system that cannot honestly explain why it acted is not trustworthy and is not researchable. ALGET persists, for every recommendation, the candidate actions, the selected action, the rejected actions, the action scores, the reason codes, and the evidence snapshot that drove the choice (`decision_record` in `backend/server.py`).

Faithfulness is enforced in code, not promised in prose. `REASON_CODE_FEATURES` declares which features each reason code may cite, and `reason_codes_are_faithful` asserts that every emitted reason code maps to a feature actually present in the evidence snapshot before the response is returned. A reason code can never appear without backing evidence. The annotation ablation flag genuinely removes annotation-derived codes, which is what makes the RQ4 study honest.

## 3. Accessibility and UDL are a gate, not a phase

A one-time accessibility pass decays. ALGET turns Universal Design for Learning and WCAG 2.2 AA into a recurring PR gate: `.review/ui.md` is the checklist every UI-touching change is reviewed against (keyboard operability with no traps, visible focus, contrast, no color-only state, alternatives and captions, reduced-motion, 200% reflow, focus-trapped dialogs, 44px targets). Interactive blocks are expected to degrade to a faithful static rendering for print, screen readers, and no-JS contexts. UDL is treated as a correctness property of the reading experience, not a nice-to-have.

## 4. Content is validated before it merges

Authored content is code. A malformed practice file, an out-of-range answer key, a dangling concept reference, or a prerequisite cycle is a defect that must be caught before release, the same way a failing test is. ALGET wires `validate_content.py`, `lint_boilerplate.py`, and `lint_duplication.py` as blocking CI steps (see `.github/workflows/ci.yml` and `CONTRIBUTING.md`). The schemas in `frontend/content/_schema/` are the single source of truth for what valid content is; `CONTENT_MODEL.md` is their prose mirror. "Validate before publish" is the stance; the baseline is 256 sections at 0 hard errors and we keep it there.

## 5. Novelty over volume

ALGET does not try to out-scale mature systems on course count, LMS integration surface, or analytics ops. At eight courses and 256 sections, the credible move is to be rigorous and distinctive rather than large. We adopt the governance and content-rigor patterns of the reference systems (documented architecture, exhaustive content spec, versioned schemas, an a11y gate, validate-before-publish) and we invest the remaining effort in the one thing none of the references attempt: in-system, artifact-mediated, closed-loop adaptivity with faithful provenance. Anything that adds operational weight without reinforcing that thesis is deferred or rejected; the reasoning is recorded in `research/CONFORMANCE_PLAN.md`.
