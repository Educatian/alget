# Contributing to ALGET

Start by reading `ARCHITECTURE.md` (the layer map and the validation gate) and `docs/core-beliefs.md` (the values ALGET optimizes for). If you are authoring content, `CONTENT_MODEL.md` is the contract. If you are touching the UI, `.review/ui.md` is the accessibility gate every PR is reviewed against.

This document defines the merge gate: the set of checks that must pass before any change can land.

---

## The merge gate

CI (`.github/workflows/ci.yml`) runs three jobs as **blocking** steps. A change cannot merge unless all three pass. Run them locally before opening a PR.

### 1. Content validation

Authored content is code; malformed content must not merge.

```bash
python scripts/validate_content.py
python scripts/lint_boilerplate.py
python scripts/lint_duplication.py
```

- `validate_content.py` validates every section's `meta` / `practice` / `misconceptions` file against the JSON Schemas in `frontend/content/_schema/`, and runs the cross-file and corpus-level checks (duplicate problem ids, `correct_index` bounds, `practice_ids`/`misconception_id` reference integrity, prerequisite-graph DAG). It uses `jsonschema` when installed and a stdlib fallback otherwise. Non-zero exit on any hard error. (CI installs `jsonschema` so the richer engine runs.)
- `lint_boilerplate.py` fails if generated filler boilerplate survives in any section MDX.
- `lint_duplication.py` bounds practice-stem and misconception duplication across the supplement courses.

Current baseline: **256 sections, 0 hard errors, 0 soft warnings**; both linters pass.

### 2. Frontend

```bash
cd frontend
npm ci
npx vitest run
npx eslint src
npx vite build
```

Unit tests (vitest), lint (eslint, including `eslint-plugin-jsx-a11y`), and a production build must all pass.

### 3. Backend

```bash
pip install -r backend/requirements.txt
pip install pytest
python -m pytest \
  backend/test_eval.py \
  backend/test_misconceptions.py \
  backend/test_support_policy.py \
  backend/test_agent_persona.py
```

These four pinned modules cover evaluation, the misconception loader/contract, the support-move policy core (including the faithfulness invariant), and agent persona behavior. `pytest` is installed explicitly because it is a dev-only dependency and is not pinned in `backend/requirements.txt`.

---

## Before you open a PR

- [ ] All three gate sections above pass locally.
- [ ] If you changed content, `validate_content.py` is still at 0 hard errors. Author against `CONTENT_MODEL.md` and the schemas in `frontend/content/_schema/`.
- [ ] If you changed the UI, you walked `.review/ui.md` and pasted the checklist into the PR with each item checked or marked n/a.
- [ ] If you changed the adaptive policy, the faithfulness invariant still holds (`reason_codes_are_faithful`) and `backend/test_support_policy.py` passes.
- [ ] No em-dashes in user-facing prose.

## Working notes

- Do not edit the JSON Schemas casually. A backward-incompatible schema change requires a version bump and a migration note; see the schema versioning policy in `CONTENT_MODEL.md`.
- Persistence to Supabase is best-effort and off the critical path. A feature must not break when the persistence backend is unavailable.
- Keep modules small and bounded. ALGET deliberately favors a single React SPA plus a service-separated FastAPI backend over a fragmented stack; see the deferred/rejected list in `research/CONFORMANCE_PLAN.md`.
