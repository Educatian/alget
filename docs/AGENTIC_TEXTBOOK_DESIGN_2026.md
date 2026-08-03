# ALGET agentic intelligent textbook design — 2026 release baseline

This is the implementation-facing design contract derived from `research/AGENTIC_INTELLIGENT_TEXTBOOK_FUTURE_DIRECTIONS_2026.md`. The design goal is bounded agency: agents prepare evidence-backed options; instructors and learners retain consequential decisions.

## Experience model

```text
source -> shadow draft -> evidence/quality review -> human approval -> publish
   |                                                        |
   +-> runtime package (tutor, analytics, social cues) <---+
                                                            |
learner read -> reflect -> check -> practice -> finish -> evidence trace
```

### Reader

- Hybrid pagination is the default affordance for long-form work: the learner may keep continuous scroll or switch to five bounded pages (`Read`, `Explore`, `Reflect`, `Practice`, `Finish`).
- The header carries only section identity, time, status, and workflow. Objectives and evidence provenance are collapsed disclosures, so the page does not become a stack of panels.
- `EvidenceTrail` appears only when a generated section carries source context. It links to canonical HTTPS sources, shows licence links when available, and says “context attached” rather than claiming that every sentence was independently verified.
- The adaptive rail is secondary. BigAL, social cues, and peer signals open on demand and do not interrupt the reading column.

### Social learning rail

The rail has four low-pressure moves:

1. **Peer Pulse** — de-identified, section-scoped signal that readers paused here.
2. **Evidence Echo** — a shared question or evidence link, not a forum feed.
3. **Your Cue** — one-tap `Need an example`, `I am pausing here`, or `Worth revisiting`.
4. **Optional Connection** — mutual opt-in only; no learner identity is exposed by the cue itself.

The rail is instrumented with `social_evidence_opened`, `social_connection_requested`, and cue events. Clicks are not treated as learning gains.

### Instructor workspace

The instructor sees a course-scoped evidence brief, source revision/hash, generated sections, tutor/analytics/social runtime package, and a publish gate. The workspace must never enumerate the global ingestion queue for an assigned instructor. A PDF or Google Doc remains invisible to learners until explicit approval.

### Admin governance

Admin controls expose role, source, agent stage, approval state, policy thresholds, emergency pause, and audit events. High-risk operations (publish, grade, message, enrollment, policy change) are unavailable to autonomous execution.

### Roadmap governance

The control plane also exposes the long-horizon contracts needed for an institutional pilot: a versioned model registry, incident intake and ordered containment, privacy export/delete confirmation, a preregistration-ready evaluation manifest, and Caliper/OneRoster/CASE adapters. These are deliberately separate from learner reading so a standards or governance failure cannot silently change the learning experience.

## Component and contract map

| Design contract | Code surface | Verification |
|---|---|---|
| Course-scoped ingestion reads | `frontend/src/lib/facultyPartnershipService.js`, `supabase/migrations/20260801000000_openstax_reference_index.sql` | Faculty workspace test + RLS review |
| Human-gated publication | `frontend/src/lib/facultyPartnershipService.js`, `FacultyPartnershipWorkspace.jsx` | faculty component test |
| Source provenance disclosure | `EvidenceTrail.jsx`, `loadPublishedCourseSection` | `EvidenceTrail.test.jsx`, faculty service test |
| Learner-controlled reading mode | `ReadingPane.jsx` | reader unit/e2e checks |
| Passive social learning | `SocialLearningRail.jsx`, `useSocialPresence` | social rail/e2e checks |
| Bounded adaptive policy | `AdaptationDesignStudio.jsx`, `agenticLmsService.js` | agentic service and admin tests |
| Roadmap governance contracts | `RoadmapGovernancePanel.jsx`, `roadmapRuntimeService.js`, `backend/roadmap_runtime.py` | roadmap unit/API/Worker tests |
| Institutional interoperability | LTI 1.3, Caliper, OneRoster, CASE endpoints and Supabase roadmap migration | release-readiness contract checks |
| Content/reference completeness | `scripts/validate_content.py`, `scripts/standardize_course_references.py` | content gate and release readiness |

## Release acceptance checklist

- [x] Every generated course has a source hash, warnings, section-level runtime package, and references where RAG found a match.
- [x] A learner can inspect sources without leaving the reader context, and no unsafe URL is rendered.
- [x] A learner can complete the section without using the AI rail or social rail.
- [x] Instructor source and mastery reads are course-scoped; no browser `sessionStorage` value grants instructor access.
- [x] No model response can publish, grade, message, enroll, or change policy.
- [x] Empty telemetry is labeled as missing evidence, not as success.
- [x] Model versions, agent decisions, privacy requests, incidents, and evaluation manifests are auditable and course-scoped in local/API contracts.
- [x] LTI 1.3, Caliper, OneRoster, and CASE payloads pass contract validation before institutional export.
- [x] Content schema, reference/image manifests, frontend tests/lint/build, backend tests, worker tests, and release readiness pass.
- [x] Live Supabase migration history, RLS contracts, sensitive anonymous ACL revokes, and anonymous route refusal are verified against the deployed project.
- [x] Authenticated PDF/Google Docs import contract is covered by a hermetic Worker integration test: instructor role succeeds with a private shadow draft, learner role is rejected, and no automatic publication is possible.
- [x] Model-backed formative assessment has a deterministic, evidence-labelled fallback when the provider returns malformed JSON; the fallback path is covered by a Worker integration test and the deployed smoke checks still return two questions.
- [x] A live authenticated PDF/Google Docs smoke completed against the deployed Worker with a short-lived course-admin pilot session (credential not stored in the repository or CI): Google Docs returned a 6-section `shadow_draft` and PDF returned a 7-section `shadow_draft` for `faculty-pilot-smoke`. Re-run with `scripts/faculty_authenticated_smoke.mjs` and source-specific environment variables when rotating the pilot session.
