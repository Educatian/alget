# ALGET LMS class readiness audit

Date: 2026-09-04
Scope: Introduction to LMS-style online class, 28–30 undergraduates, 120–180
minutes, learning-analytics-primary with qualitative reflection. This is a
platform/readiness audit, not authorization to collect research data.

## Executive status

The platform wiring is now coherent for a controlled pilot: Pages serves
validated reading JSON, the Cloudflare Worker owns AI and unload telemetry, and
the learner dashboard can explain derived evidence with a learner-controlled
next step. The repository now includes a reviewable “Introduction to LMS”
class exemplar and a local, privacy-safe export-join contract. A class-specific
artifact brief, consent/retention language, and production export approval
still need instructor/research-owner sign-off. Do not claim a causal or
long-term learning effect from this pilot.

## Minimum class contract

**120-minute base**

1. 10 min: LMS orientation and learner goal.
2. 20 min: read the interaction/presence section.
3. 15 min: sequence/match check and confidence report.
4. 25 min: branching or dynamic LMS design decision.
5. 25 min: one artifact task and one revision decision.
6. 15 min: learner dashboard explanation and optional next move.
7. 10 min: exit ticket (claim, evidence, next revision).

**180-minute extension**

Add 20 minutes of asynchronous/synchronous comparison, 20 minutes for a
second artifact revision or peer evidence comparison, 10 minutes of retention
planning, and 10 minutes for an instructor debrief. These are time-boxes, not
research conditions; an instructor must approve the final schedule.

**One concrete task**

Design a one-week LMS activity for a familiar topic. Submit a short rationale
that names (a) the learning objective, (b) the learner-content/instructor/peer
interaction choice, (c) one evidence source or observation that supports the
choice, and (d) one revision after the embedded check. ALGET may scaffold and
score derived rubric dimensions; the learner remains the author and decision
maker.

**Provisional research questions**

- RQ1 (primary, descriptive): What learning evidence is visible in the
  sequence, decision, retrieval, artifact-revision, and dashboard-choice path?
- RQ2 (qualitative complement): How do learners explain, accept, modify, or
  reject an agent's evidence-grounded next-step suggestion?

These questions support process description in a small convenience sample, not
an estimate of durable or causal learning impact. Any novelty claim remains
provisional until a targeted literature review and preregistration.

## Artifact / log / reflection linkage

| Artifact element | Runtime evidence | Student reflection |
|---|---|---|
| Objective and interaction choice | `sequence_check`, `branch_choice` | Why the mode and interaction fit |
| Source/evidence rationale | `artifact_studio_trace` score-derived fields | Which evidence changed the claim |
| Revision decision | before/after quality dimensions and judgment | Accept, modify, reject, or defer and why |
| AI support episode | `analytics_coach_request/response` metadata, tutor trace | What the explanation clarified or failed to clarify |
| Next action | learner-selected concept review or no action | Why the learner accepted or declined |

Raw learner writing is not part of the Worker unload payload or score mirror.
Exports must use the approved research views and include the limitation that
clicks and presence are proxies, not direct measures of learning.

## Course evidence and provenance

The local course contract is stored in `frontend/src/lib/lmsClassExemplar.js`
as `LMS_CLASS_CONFIG`. Each field is labelled so a proposed learning design
cannot be mistaken for an email-confirmed fact:

| Field | Status | Boundary |
|---|---|---|
| LTPS 210 title and interest in hands-on LMS exploration, interaction, and critical evaluation | Confirmed from the instructor email thread (paraphrased; 2026-07-30 and 2026-08-11) | The thread asks for assignment/activity/evaluation ideas; it does not authorize data collection. |
| Instructor display label `연지정` | User-stated | The email sender label `Jung, Yeonji` is kept as a separate verification note; no address or identity mapping is stored. |
| 28–30 undergraduates, online, 120–180 minutes; three-session sequence | User-stated | Dates, synchronous split, language, and grading weights remain open. |
| ALGET reading → retrieval → artifact → analytics explanation → learner choice → follow-up → reflection | Proposed | Requires instructor/research-owner review before a real class. |
| Existing LMS plus optional platform comparison | Email-confirmed interest, exact scope proposed | DataSandbox files, credentials, student data, and its separate project schedule are intentionally not imported into this fixture. |

Unknowns are explicit in `LMS_CLASS_CONFIG.unknowns`: exact schedule and
modality split, instruction language, required comparator list, grading weights,
and any consent/IRB or research-data procedure.

## Participant slots and synthetic QA

`LMS_CLASS_ROSTER` reserves 30 local slots (`participant-01` through
`participant-30`) for this course/cohort only. All start inactive; activating a
slot is a roster operation, never authentication. A real learner must continue
to use the existing signed-in account or invitation-bound access token, and no
student-name mapping or account creation is part of this work.

The two local fixtures prove isolation and the complete agent loop:

- `intro-lms-weak` → `participant-01` / `synthetic-session-01`, two low-mastery
  concepts, distinct explanation prefix, learner decision and reason-length
  metadata, then weakest-concept follow-up.
- `intro-lms-ready` → `participant-02` / `synthetic-session-02`, strong mastery,
  a separate explanation prefix, and a retention-check recommendation.

Fixture events use course, cohort, participant, session, and section keys. The
export helper retains only bounded decision/result fields and reason length;
private reason text and raw answers are dropped. Session storage is used only
for local QA trace inspection and is never a production export source.

## Current implementation vs. remaining work

**Implemented and verified locally**

- static JSON response/content-type and shape validation in the reader;
- Worker-owned `/log-events` with token/RLS boundary and canonical mirror;
- privacy-safe telemetry for sequence, branching, and dynamic-scenario moves;
- learner-facing dashboard evidence explanation with AI/local fallback,
  observed-concept/timestamp context, and learner accept/modify/decline control;
- faculty shadow → ready → human-approved publish path;
- reviewable `intro-lms-exemplar-v1` class preview at `/class/lms-exemplar`,
  mapped to the existing `inst-design/02/08` reading module;
- pure `buildLmsClassExportJoin()` contract helper that drops raw event prose
  and keeps only approved keys plus derived artifact scores;
- local browser smoke: preview → reader, sequence-match completion,
  learner-dashboard BigAL explanation, keyboard tab order, responsive
  390px layout, and axe accessibility scan (0 violations);
- local synthetic QA: weak/ready fixtures keep participant/session scope
  isolated, restore roster/qualitative state after refresh, render agent
  responses without raw Markdown markers or machine course IDs, and join the
  completed decision/follow-up into behavior plus qualitative export rows;
- existing tutor hint ladder, formative RAG assessment route, artifact scoring,
  and event/export schemas.

**Still required before a real LMS class**

- instructor/research-owner review and sign-off of the exemplar module,
  artifact rubric, consent language, and retention period;
- run a test Supabase session through `/log-events` after Worker deployment;
- align export fields, consent language, and retention period with the approved
  protocol;
- redeploy Pages snapshots after review and verify live content versions;
- repeat the browser/accessibility smoke pass against the deployed class entry
  path after Pages/Worker release (local pass is not production evidence).

## Deployment evidence and limits

On 2026-09-04 the live Pages site returned valid JSON for sampled authored and
published sections, and the live Worker `/health` and `/agentic/tools` routes
were ready. The live Pages snapshots had different `content_version` values
from the dirty local snapshots for sampled sections, so deployment drift is
confirmed. No deployment, database migration, recruitment, or real participant
collection was performed in this work.

The separate Bio-Inspired RCT remains governed by its strict assignment and
study-mode contract. It must not be used as evidence for the ordinary LMS
class, and no intervention/comparison claim is made here.

## Local qualitative and roster gates

`lmsQualitativeArtifactStore.js` is a local QA implementation of the future
private artifact boundary. A scoped artifact links the participant key,
session, section, observed-evidence snapshot, decision, reason text, modified
proposal, reflection, and follow-up result. General telemetry still receives
only decision enums and reason length. The qualitative export deliberately
requires the learner owner or an instructor/admin requester and removes the
owner auth ID before export. Production storage, consent, IRB approval, and
retention policy remain deployment gates.

`lmsParticipantRoster.js` persists only local course-scoped roster bindings.
Activation requires an authenticated user ID and exact course/cohort scope;
the participant number alone is rejected. Learners can list/read only their
own active binding; an instructor/admin can read bound slots in this course.
The synthetic QA path is explicit (`synthetic: true`) and cannot be used by a
real account. No Supabase migration or operational credential was changed.
