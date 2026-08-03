# ALGET agentic AI research development plan

Status: implementation plan  
Planning horizon: 16 weeks to first defensible pilot, 12 months to multi-course study  
Product boundary: AI may propose, explain, adapt, and coordinate within an approved course policy. It may not autonomously publish, grade, enroll, message learners, or change policy.

## 1. Research identity

ALGET should be studied as a **bounded artificial-agency learning environment**, not merely as a generative textbook or chatbot. Its distinctive research object is the redistribution of initiative and epistemic work among the learner, instructor, peers, and persistent AI agents.

The platform must make three characteristics experimentally observable:

1. **Interactivity:** an agent responds to learner, instructor, source, and group evidence.
2. **Bounded autonomy:** an agent may initiate a support move only within an instructor-approved policy, intervention ceiling, cooldown, and role boundary.
3. **Adaptability:** later actions change from prior evidence, while the learner or instructor can inspect, modify, reject, pause, or undo the recommendation.

The primary scholarly contribution is therefore not “AI generated a module.” It is evidence about when bounded artificial agency improves learning, regulation, and collaboration, when it creates dependency or cognitive load, and how human approval changes those effects.

## 2. Theory-to-feature-to-measurement model

| Construct | Product manipulation | Process evidence | Outcome evidence | Main risk |
|---|---|---|---|---|
| Learner agency | Inspect/accept/modify/reject/ask-why controls | decision sequence, modification depth, response latency | ownership, critical evaluation, transfer | passive acceptance |
| Teacher agency | source approval, policy editing, publish gate, intervention review | correction count, policy changes, review rationale | trust calibration, workload, adoption intention | rubber-stamp approval |
| Epistemic agency | evidence challenge, counterexample, source comparison | claim-source inspection, contradiction resolution | evidence-aligned artifact, delayed transfer | answer outsourcing |
| Self-regulated learning | plan-monitor-reflect loop, learner-controlled goals | plan revisions, help timing, reflection completion | calibration, persistence, strategy quality | excessive nudging |
| Co-regulation/SSRL | Peer Pulse, Evidence Echo, Your Cue, optional evidence comparison | cue exposure, mutual uptake, evidence exchange sequence | shared regulation quality, participation equity | social pressure or distraction |
| Appropriate trust | provenance, confidence boundary, “why this action,” uncertainty | source opens, rejection after warning, reliance pattern | calibrated trust, error detection | over-trust/under-trust |
| Adaptive support | readiness-based action proposal with cooldown and ceiling | trigger, proposed action, suppression, learner choice | mastery/transfer gain per intervention | intervention fatigue |

Every dashboard and publication claim must distinguish process evidence from learning outcomes. Clicks, time-on-page, chat volume, and cue exposure are not learning gains.

## 3. Core research questions and hypotheses

### RQ1 — Bounded agency versus reactive assistance

Does a persistent, policy-bounded agent improve learning and regulation compared with the same model used only as a reactive question-answering tool?

- H1a: bounded-agent learners will produce stronger evidence-aligned artifacts and delayed transfer than reactive-chat learners.
- H1b: bounded-agent learners will show more productive planning, monitoring, and revision sequences.
- H1c: excessive or poorly timed agent initiative will increase dismissal and support fatigue.

### RQ2 — Human approval and teacher agency

How does inspect/modify/reject control affect instructors’ trust, workload, and ownership of AI-generated course materials?

- H2a: explanation plus source evidence will improve calibrated acceptance, not indiscriminate acceptance.
- H2b: editable rationales and diff-based review will reduce correction time across repeated module-generation cycles.
- H2c: an approval button without an active critique prompt will produce rubber-stamping; this must be measured explicitly.

### RQ3 — Epistemic co-agency

When does the learner reason with, through, and against AI rather than copy its output?

- H3a: requiring a claim–evidence judgment before revealing a tutor synthesis will improve source inspection and error detection.
- H3b: visible uncertainty and counterevidence prompts will increase justified rejection and revision.
- H3c: answer-first tutoring will increase short-term completion but reduce delayed transfer and ownership.

### RQ4 — Passive social cues and SSRL

Can low-pressure, de-identified social cues initiate productive co-regulation without requiring a public discussion board?

- H4a: Evidence Echo followed by optional evidence comparison will increase shared monitoring and evidence quality.
- H4b: Peer Pulse alone may increase social presence but should not be expected to improve learning.
- H4c: mutual opt-in and dismissible cues will preserve participation equity better than forced posting.

### RQ5 — Adaptive orchestration

Which agent action is appropriate for which learner state, and when should the system intentionally do nothing?

- H5a: a constrained policy using mastery, calibration, evidence alignment, time, and prior interventions will outperform mastery-only triggering.
- H5b: suppression decisions will be as important as intervention decisions for preserving learner agency.
- H5c: policy effects will vary by prior knowledge, accessibility needs, age/technology confidence, and course context.

## 4. Target agent architecture

### 4.1 Course-authoring agents

- **Curriculum agent:** maps approved source material to objectives, concepts, module order, and prerequisites.
- **Reading agent:** creates bounded reading sections without changing claims beyond the source evidence.
- **Activity/simulation agent:** proposes active-learning and simulation tasks aligned to objectives.
- **Assessment agent:** creates formative items and rubrics grounded in retrieved passages.
- **Tutor policy agent:** drafts allowed intents, response style, citation behavior, misconception prompts, and escalation rules.
- **Social orchestration agent:** proposes module-specific cue rules, mutual opt-in logic, evidence-comparison prompts, and participation protections.
- **Critique/validation agent:** checks alignment, unsupported claims, duplication, reading load, accessibility, citation traceability, and policy compliance.

All outputs enter a versioned shadow draft. The instructor reviews a structured diff, source evidence, agent rationale, warnings, and expected learner-facing changes before publication.

### 4.2 Learner-runtime agents

- **Tutor:** answers only from the approved course corpus, exposes sources, expresses uncertainty, and escalates unsupported requests.
- **Metacognitive coach:** prompts planning, monitoring, calibration, and reflection without supplying the final answer.
- **Assessment coach:** selects or generates a formative check from approved concepts and uses attempt evidence to choose feedback depth.
- **Evidence coach:** asks the learner to connect claims, excerpts, and counterevidence.
- **Social facilitator:** exposes sparse, de-identified cues and initiates an optional evidence-comparison round only after mutual participation.
- **Study planner:** proposes a bounded weekly plan that the learner can modify, approve, pause, or cancel.

### 4.3 Instructor-runtime agents

- **Evidence brief agent:** summarizes cohort patterns without causal language or unnecessary identities.
- **Intervention agent:** proposes re-teaching or resource changes and waits for instructor approval.
- **Quality drift agent:** flags citation failures, repeated learner confusion, item malfunction, subgroup disparity, and model-version changes.
- **Research operations agent:** checks consent state, event completeness, export safety, condition fidelity, and stop rules; it never changes study assignments.

### 4.4 Orchestrator and policy engine

The orchestrator must use a deterministic state machine around probabilistic model outputs:

```text
observe -> qualify evidence -> select eligible tools -> propose -> policy check
        -> explain -> human/learner decision -> execute low-risk action -> audit
        -> evaluate outcome -> adapt or suppress next action
```

Required controls:

- default-deny tool registry;
- course and role scope on every tool;
- explicit approval owner;
- per-session intervention ceiling and cooldown;
- confidence/evidence threshold;
- emergency pause and model rollback;
- idempotency key for state-changing calls;
- immutable decision and model-version ledger;
- no hidden cross-course memory;
- “no intervention” as a valid, logged decision.

## 5. Development workstreams

### WS1 — Experimental condition framework (P0)

Build a versioned assignment system that can vary agent behavior without maintaining separate applications.

Required entities:

- `research_studies`: protocol version, owner, status, IRB/ethics reference, dates.
- `research_conditions`: condition key, feature flags, agent policy, model version, content version.
- `research_participants`: pseudonymous participant, course, condition, consent status; identity mapping stored separately.
- `research_assignments`: assignment method, stratum, timestamp, immutable condition snapshot.
- `research_exposure_sessions`: actual features delivered, deviations, device/accessibility state.

Minimum conditions for the first controlled pilot:

1. `reader_only`: approved reading and non-agentic assessment.
2. `reactive_tutor`: learner opens the tutor; the tutor never initiates.
3. `bounded_agent`: policy-qualified tutor/metacognitive/social moves may be proposed.

Acceptance criteria:

- assignment is reproducible and course-scoped;
- condition flags are snapshotted, not read from a mutable global setting;
- participants cannot infer another participant’s condition;
- instructors see aggregate condition fidelity but not research-only labels that could alter teaching unless required;
- every session records intended versus delivered treatment.

### WS2 — Agent decision ledger and process tracing (P0)

Extend the current workflow audit model with research-safe decision traces.

For each agent cycle store:

- pseudonymous actor, course, module, section, session;
- agent role, goal, eligible tools, selected tool/action;
- evidence feature vector using derived values only;
- policy version, model ID/version, prompt-template version, retrieval-index version;
- proposed action and alternatives;
- whether the action was suppressed and why;
- explanation shown to the user;
- user decision: inspect, accept, modify, reject, dismiss, ask why;
- execution result, latency bucket, cost bucket, error class;
- proximal outcome window and next-state summary.

Do not export raw prompts, private notes, emails, names, complete document text, or unrestricted model reasoning. Store concise, structured rationales intended for audit rather than hidden chain-of-thought.

### WS3 — Source-grounded epistemic interaction (P0/P1)

Upgrade citation verification from a generation quality label into a learner-visible and measurable workflow.

Features:

- claim-level evidence chips with source, passage locator, license, retrieval timestamp, and verification state;
- “show supporting passage,” “show counterevidence,” and “report mismatch” actions;
- instructor source-coverage heatmap;
- tutor abstention when retrieval evidence is insufficient;
- contradiction set for intentionally competing or incomplete sources;
- assessment items that require evidence selection or error detection before synthesis;
- immutable source hash linking each published section, tutor answer, and assessment item to the approved corpus.

Verification metrics:

- citation precision on a manually coded sample;
- unsupported-claim and abstention rates;
- learner source-open and claim-revision sequences;
- error-detection accuracy using seeded but ethically disclosed evaluation items;
- instructor correction rate and time per generated section.

### WS4 — Learner agency interaction contract (P1)

Standardize every agent recommendation as a reusable `AgentProposalCard`:

- recommendation and bounded goal;
- evidence used and missing evidence;
- why now / why not another action;
- expected effort and estimated duration;
- inspect, accept, modify, reject, dismiss, and pause controls;
- “do this myself” non-AI path;
- undo where technically possible;
- no urgency language unless the course policy explicitly defines it.

New measures:

- acceptance ratio is reported with modification and inspection depth;
- `agency_index` is a transparent composite only for exploration, never a grade;
- retain raw component measures so researchers can challenge the composite;
- detect repeated uninspected acceptance as a possible dependency signal, not proof of dependency.

### WS5 — Adaptive intervention engine (P1)

Build the policy engine around five state families:

1. mastery evidence;
2. metacognitive calibration;
3. evidence alignment;
4. engagement friction and support fatigue;
5. social reasoning opportunity.

Candidate actions: continue, advance, retrieve prerequisite, worked example, self-explanation, evidence comparison, formative check, tutor invitation, learner reflection, or no action.

Implementation sequence:

- begin with deterministic rules and logged thresholds;
- support instructor-authored policy templates;
- run policies in shadow mode before learner exposure;
- compare proposed decisions against instructor review;
- add contextual bandit or learned policy only after sufficient, consented data and offline safety evaluation;
- never optimize directly for clicks, time-on-task, or chat volume;
- optimize a constrained objective including learning evidence, calibration, agency preservation, equity, fatigue, and cost.

### WS6 — Social regulation engine (P1)

Extend the existing Social Learning rail into a stateful, passive-to-collaborative sequence:

```text
private cue -> de-identified peer signal -> evidence echo -> mutual opt-in
             -> bounded comparison round -> private reflection -> close
```

Design rules:

- Peer Pulse communicates presence only; it does not rank peers.
- Evidence Echo shares a question, claim, or source pointer, not raw learner text by default.
- Your Cue remains one-tap, private by default, and dismissible.
- Optional Connection requires mutual opt-in and course permission.
- A social round has a defined goal, timebox, turn structure, evidence prompt, closure, and exit.
- The agent may balance turn-taking or surface contrasting evidence but may not impersonate a peer.
- Small-cell suppression prevents re-identification.

SSRL process coding should distinguish planning, monitoring, strategy enactment, challenge recognition, adaptation, and reflection. Measure transition sequences and participation balance, not only message counts.

### WS7 — Instructor agency and explainability console (P1)

Add three review surfaces to the instructor workspace:

1. **Generation review:** source-to-objective-to-section alignment, content diff, citation gaps, reading load, assessment coverage.
2. **Runtime policy review:** tutor intents, intervention triggers, cooldown, social rules, accessibility and escalation behavior.
3. **Evidence review:** cohort patterns, uncertainty, subgroup minimum cell sizes, proposed action, alternatives, and causal-claim boundary.

Capture structured instructor actions:

- accepted unchanged;
- accepted after modification;
- rejected for source, pedagogy, accessibility, policy, or context reason;
- deferred due to insufficient evidence;
- rollback after publication.

Measure review time, correction depth, trust calibration using known-quality and known-error cases, and longitudinal reduction in effort.

### WS8 — Research analytics and reproducible export (P1/P2)

Build separate views for operations, instruction, and research.

- **Learner dashboard:** goals, evidence, calibration, next choice; no opaque risk score.
- **Instructor dashboard:** course-scoped patterns and action review; no global roster access.
- **Research dashboard:** condition fidelity, missingness, event version, attrition, safety incidents, and analysis-ready export.

Export package:

- de-identified event parquet/CSV;
- data dictionary and schema version;
- condition and policy snapshots;
- content/source/model manifests;
- consent-filter report;
- exclusion and deviation log;
- reproducible analysis script and environment lockfile;
- README that states which causal claims are and are not supported.

### WS9 — Governance, privacy, safety, and equity (P0 throughout)

- consent and research participation are separate from course access;
- refusal or withdrawal does not remove required instructional access;
- deletion and export requests propagate to research tables and derived caches;
- retention windows are study-specific and enforced automatically;
- small-cell suppression and minimum cohort thresholds protect identity;
- accessibility, age/technology-confidence, language, prior knowledge, and device class are tested as usability moderators when ethically collected;
- subgroup disparities trigger review, not automatic individualized treatment;
- incident workflow includes pause, containment, notification owner, remediation, and documented restart approval;
- model or prompt changes during a study require a versioned amendment and exposure log.

## 6. Event model v2

Keep the current privacy-safe pilot events and add the following versioned families:

| Family | Events | Key derived fields |
|---|---|---|
| Exposure | `condition_assigned`, `condition_exposed`, `treatment_deviation` | condition, policy version, deviation code |
| Agent cycle | `agent_observed`, `agent_proposed`, `agent_suppressed`, `agent_executed` | agent role, action, evidence completeness, reason code |
| Human control | `proposal_inspected`, `proposal_modified`, `proposal_accepted`, `proposal_rejected`, `proposal_undone` | control type, modification depth, reason category |
| Epistemic work | `claim_evidence_opened`, `counterevidence_opened`, `citation_challenged`, `claim_revised` | source count, verification state, revision category |
| Regulation | `goal_set`, `plan_revised`, `calibration_submitted`, `reflection_submitted` | confidence band, strategy category, calibration error |
| Social regulation | current cue events plus `social_plan_shared`, `social_monitoring_signal`, `social_strategy_adapted`, `social_round_closed` | SSRL phase, mutuality, balance bucket |
| Outcome | current assessment/artifact events plus `delayed_transfer_submitted` | rubric version, blinded score, item family |
| Governance | current instructor events plus `policy_changed`, `content_rolled_back`, `incident_opened` | reason category, version, severity |

Event requirements:

- UUID, occurred-at and received-at timestamps;
- schema version and client build;
- stable pseudonymous actor within a study, unlinkable across studies by default;
- course/module/section/session IDs without fallback identifiers;
- allow-listed payload only;
- idempotency key and duplicate handling;
- offline queue with consent-aware flush;
- server-side validation and rejection metrics;
- clock-skew and out-of-order handling;
- tested migration path for every schema revision.

## 7. Study program

### Study 0 — Instrumentation and usability validation

- Participants: 5–8 instructors and 8–12 students representing varied technology confidence.
- Method: cognitive walkthrough, think-aloud, source-verification tasks, accessibility testing, log-to-screen reconstruction.
- Goal: validate that users understand agency, sources, uncertainty, consent, and controls.
- Gate: at least 95% of critical screen actions reconstruct correctly from events; no raw text enters export; all critical tasks work by keyboard.

### Study 1 — Feasibility pilot

- One course, 5–10 learners, 2–3 weeks.
- Within-person baseline reading followed by ALGET module.
- Outcomes: event completeness, source fidelity, instructor correction burden, cue uptake, formative artifact quality, support fatigue.
- Claims: feasibility and process description only; no causal learning claim.

### Study 2 — Micro-randomized trial

- Randomize eligible moments to no cue, metacognitive cue, tutor invitation, or evidence cue.
- Eligibility and cooldown are preregistered.
- Proximal outcome: meaningful evidence action within a defined window.
- Include burden and dismissal as negative outcomes.
- Use cluster-robust or multilevel analysis by learner and section.

### Study 3 — Course-level comparative trial

- Conditions: reader-only, reactive tutor, bounded agent.
- Prefer section- or class-level cluster randomization to reduce contamination.
- Primary outcome: blinded rubric score on evidence-aligned transfer artifact.
- Secondary outcomes: delayed transfer, calibration error, agency/ownership, cognitive load, trust calibration, participation equity, instructor time.
- Analyze intention-to-treat first; report exposure and treatment-on-treated only as secondary.

### Study 4 — Longitudinal teacher-AI co-design

- Multiple instructors across repeated authoring cycles.
- Examine policy evolution, review burden, trust repair, content drift, and professional agency.
- Combine interaction logs, structured review reasons, interviews, and version histories.

## 8. Analysis plan

### Primary quantitative models

- multilevel models with learners nested in sections/courses;
- pre/post and delayed-transfer models controlling for prespecified baseline measures;
- sequence analysis or process mining for regulatory and agent-decision pathways;
- calibration error and Brier-style measures for confidence versus performance;
- participation inequality and mutuality metrics for social rounds;
- survival/time-to-event analysis for persistence or disengagement where appropriate;
- heterogeneous-effect estimates treated as exploratory unless preregistered and adequately powered.

### Qualitative and mixed methods

- code instructor modifications and rejection rationales;
- code learner AI interaction for evaluation, challenge, revision, delegation, and dependency signals;
- stimulated-recall interviews using selected interaction traces;
- joint displays connecting process pathways with artifact quality and user interpretation;
- negative-case analysis for learners harmed, distracted, or underserved by agent initiative.

### Validity safeguards

- preregister primary outcome, exclusion, timing window, and model before confirmatory analysis;
- freeze condition, content, model, prompt, and policy manifests;
- blind artifact raters to condition;
- double-code a sample and report reliability;
- distinguish intent-to-treat, actual exposure, and voluntary uptake;
- publish null effects, incidents, and unintended outcomes;
- do not infer mastery from engagement telemetry.

## 9. Delivery roadmap

### Weeks 1–2 — Protocol and architecture freeze

- finalize constructs, RQs, hypotheses, primary outcome, study condition definitions;
- create ADR for artificial-agency boundaries;
- specify research tables, event v2, consent separation, retention, and stop rules;
- create threat model and data-flow diagram;
- define instructor and learner usability test scripts.

Exit gate: approved protocol draft, data dictionary, condition manifest, and security/privacy review.

### Weeks 3–5 — Experimental infrastructure

- implement study/condition/assignment/exposure tables and RLS;
- implement immutable condition snapshots;
- extend event validation, offline queue, idempotency, consent filter, and export view;
- add admin study configuration with no direct learner-identifying export;
- add automated migration, RLS, and event-contract tests.

Exit gate: synthetic participants can be assigned and reconstructed end-to-end without identity leakage.

### Weeks 6–8 — Agency and epistemic features

- build `AgentProposalCard` and instrument all control actions;
- add why-now, alternatives, missing-evidence, and suppression explanations;
- implement claim-level evidence inspection, counterevidence, mismatch report, and tutor abstention;
- add source and model manifests to published runtime packages;
- run adversarial citation and prompt-injection tests.

Exit gate: every recommendation is inspectable, editable/rejectable where relevant, auditable, and safely suppressible.

### Weeks 9–10 — Adaptive and social orchestration

- implement deterministic adaptive state features and shadow-mode policy evaluation;
- add social-round state machine, mutual opt-in, small-cell suppression, and closure;
- instrument SSRL phase events and intervention fatigue;
- add course-level instructor controls and emergency pause.

Exit gate: policy simulations show no high-risk autonomous action; treatment condition is faithfully delivered.

### Weeks 11–12 — Research dashboards and exports

- implement condition fidelity, missingness, incident, and version dashboards;
- generate analysis-ready package with dictionary and manifests;
- add blinded artifact scoring workflow and inter-rater reliability export;
- test deletion/withdrawal propagation.

Exit gate: an independent analyst can reproduce the pilot dataset from documented exports.

### Weeks 13–14 — Usability and dry run

- conduct Study 0 with technology-confident and technology-anxious personas/users;
- complete keyboard, screen reader, mobile, low-bandwidth, and error-recovery checks;
- reconcile UI actions with event traces;
- fix comprehension, accessibility, and data-quality failures.

Exit gate: no critical usability failure, no unlogged consequential action, and no forbidden field in export.

### Weeks 15–16 — Pilot launch

- apply final migrations and verify production RLS;
- freeze study manifests and tag release;
- onboard instructor, publish one approved module, enroll consented participants;
- run baseline and ALGET tasks;
- monitor daily safety/data-quality checks and weekly instructor interpretation memos.

Exit gate: feasibility report with limitations, incidents, fidelity, missingness, and go/no-go decision for Study 2.

## 10. Definition of research-ready

ALGET is research-ready only when all of the following are true:

- the intervention can be described and reproduced from versioned manifests;
- artificial initiative is distinguishable from reactive assistance in both UI and logs;
- every consequential action has a human owner and audit event;
- intended condition and actual exposure can be compared;
- content, source, prompt, model, policy, and client versions are frozen per exposure;
- consent, withdrawal, deletion, and course participation are correctly separated;
- research export contains no raw text or direct identifier;
- missingness, duplication, offline events, and treatment deviations are visible;
- primary outcomes measure learning, calibration, agency, or collaboration—not engagement alone;
- instructors and learners can complete essential work without AI;
- pilot claims are limited to what the study design supports.

## 11. Immediate engineering backlog

1. Add study/condition/assignment/exposure migrations and RLS.
2. Define `agent-decision-v2` and `pilot-events-v2` JSON schemas.
3. Add agent proposal/suppression ledger and model/prompt/retrieval version fields.
4. Create shared `AgentProposalCard` with inspect/modify/reject/why/undo controls.
5. Add claim-level evidence and counterevidence interactions.
6. Add shadow-mode adaptive policy evaluation and instructor comparison view.
7. Implement social-round state machine and SSRL phase logging.
8. Create research operations dashboard for fidelity, missingness, incidents, and consent-safe export.
9. Add synthetic end-to-end study test and production RLS smoke.
10. Write Study 0 protocol, consent language, scoring rubric, and preregistration-ready evaluation manifest.

The first build slice should include items 1–4 because they make every later feature experimentally identifiable. Adaptive intelligence without condition assignment and decision tracing would create product behavior but weak research evidence.

## 12. Literature-to-design rationale

- Human–AI collaboration can distribute complementary feedback roles, supporting the separation of agent capability and human accountability: https://doi.org/10.1016/j.caeo.2024.100183
- Expert agents can increase interaction and ownership while still producing uncritical agreement, motivating explicit critique and modification controls: https://doi.org/10.1016/j.caeo.2025.100325
- Domain-specific explanations can influence teacher trust and acceptance, motivating explanation-level experiments rather than treating transparency as binary: https://doi.org/10.1007/s40593-025-00486-6
- SSRL research distinguishes self-, co-, and shared regulation and supports phase-specific process measurement: https://doi.org/10.1080/00461520.2012.748006
- A game-based SSRL intervention improved participation and attitudes without a between-group learning-performance difference, reinforcing separate process and outcome measures: https://doi.org/10.1080/10494820.2020.1857783
- A randomized learning-analytics dashboard study found intermediate-performance effects but no overall final-exam or pass effect, warning against equating dashboard use with learning: https://doi.org/10.1007/s10734-020-00560-z
- Process-oriented GenAI literacy research highlights iterative practice, metacognition, and critical evaluation, supporting longitudinal interaction traces: https://doi.org/10.1016/j.caeai.2025.100465

