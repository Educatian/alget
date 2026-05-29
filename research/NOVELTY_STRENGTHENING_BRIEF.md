# ALGET Novelty-Strengthening Design Brief

Date: 2026-05-28
Status: synthesis brief consolidating internal repo audit + external lineage map + frontier/competitor gap
Purpose: pin the single defensible contribution, resolve the old-vs-new framing tension, and convert it into prioritized, lineage-aware implementation moves that steer Phase 2 (content) and Phase 3 (feature) work.

---

## 1. Novelty thesis

**The single most defensible contribution.** ALGET is the first *deployed, multi-course intelligent textbook that closes the adaptive loop on artifact-mediated learning evidence*: social-annotation signals, scored before/after artifact-revision features, and BKT/telemetry learner state are fused into a single support-selection policy that emits an auditable, persisted decision record (candidate actions, selected action, rejected actions, `reason_codes`, evidence snapshot) reused as RCT-analyzable data.

Stated crisply for defense:

> ALGET shifts the **unit of adaptation** from response correctness and page progress to the learner's **artifact-revision episode** (claim, cited evidence, AI-suggestion accept/reject/modify, revision delta), and makes the adaptive decision **falsifiable and reusable** by persisting the evidence-to-decision mapping as research data inside one deployed system.

This is an **integration + methods/infrastructure** contribution, framed as design-based research, not a single-feature first and not an outcome-superiority claim.

### What is explicitly NOT claimed (the boundary vs prior work)

The following are table stakes and must NOT be foregrounded as novelty. Each has direct, named prior art:

- **Not** "an adaptive / personalized e-textbook." Brusilovsky/Sosnovsky adaptive e-textbooks, Mastery Grids, adaptive sequencing, open learner models predate ALGET ~10 years. ALGET's own benchmark audit already rejects this framing.
- **Not** "BKT / knowledge tracing." Library-grade (pyBKT); heterogeneous-activity KT on reading logs already published (Thaker & Brusilovsky). ALGET's synthetic Brier 0.105 / ECE 0.015-0.021 / AUC 0.92 cannot support any learner-modeling novelty claim.
- **Not** "social / Perusall-style annotation with typed reactions + heatmaps." Blobstein 2025 (emoji-hashtag taxonomy + heatmap + BERT prediction, n=1,800), Perusall + BJET 2024 analytics evidence.
- **Not** "automatic question/feedback generation or exemplars on learner text." QG-Net, OpenStax AQG, iTELL (Morris 2025). The 192 generated exemplars/packets are content *volume*, not contribution; the readiness report itself says stop increasing volume.
- **Not** "rubric + before/after revision scoring as a mechanism." iRULER (QWK=.68), Autorubric, RubricRAG, Reflect-and-Revise, Revision Assistant lineage, LAK 2025 human-AI essay scoring cover it.
- **Not** "explainable / why-this recommendation." XRec (EMNLP 2024), education explanation-effect studies, open learner models. ALGET's delta is the *persisted, faithful, RCT-reusable* decision record, not the existence of an explanation.
- **Not** "a multi-agent LLM tutor / a panel beats a single oracle." IntelliCode (orchestrator + 6 agents + centralized learner model), "Beyond the AI Tutor" (peer-agent configs), Evidence-Decision-Feedback adaptive scaffolding (arXiv 2602.01415) pre-empt the architecture and the Society-of-Mind framing.
- **Not** "the first AI-augmented textbook" or "the first with efficacy evidence." Google's Learn Your Way (2025) already published a 60-student RCT (immediate p=0.03, 3-day retention p=0.03). Any efficacy claim must rest on ALGET's OWN trial.

### Resolving the old-vs-new framing tension

ALGET carries two unreconciled framings in its own docs:

- **OLD** (LITERATURE_REVIEW.md, paper_draft.md): "generative multi-agent biomimicry Socratic tutor for statics/dynamics," justified by a tripartite triangle (Wiener Cybernetics + Minsky Society of Mind + Bush Memex) plus the Janine/Benyus biomimicry persona.
- **NEW** (research/*.md, 2026-05-05): "artifact-centered, annotation-informed, closed-loop adaptive intelligent textbook" across 8 courses, grounded in evidence-centered design (Mislevy), situated cognition / cognitive apprenticeship (Brown-Collins-Duguid), authentic assessment (Wiggins), GenAI epistemic agency.

**Recommendation: lead with the NEW framing. Demote the OLD framing to mechanism, not headline.**

1. **Headline = "artifact-centered, annotation-informed, closed-loop adaptive intelligent textbook."** This is the system's own current thesis, it is theoretically literate (ECD gives a real validity argument the cybernetics triangle does not), and it is the only framing the benchmark audit endorses.
2. **Biomimicry / the Janine persona / the cybernetics-Society-of-Mind-Memex triangle are rhetorical positioning, not a tested mechanism.** Adversarial review confirms they "will not survive as a research contribution" and dilute the claim. Decouple them entirely from the novelty argument. The biomimicry content (bio-inspired engineering course) stays as *domain content*, not as the system's theoretical identity.
3. **Multi-agent backend = mechanism, mentioned in the architecture section, never as the contribution.** It is how support is generated; it is architecturally a sibling of IntelliCode. Foregrounding it invites desk-reject as incremental. The agents should be *de-personified per course* (see Move R-2) so they read as a support-generation layer, not a branded mascot.

One framing, one validity argument (ECD), one defensible delta (the fused closed loop + persisted decision provenance). Everything else is mechanism or table stakes.

---

## 2. Research lineage map

| Stream | Arc (origin -> table stakes -> frontier) | ALGET's position |
|---|---|---|
| **Adaptive / personalized e-textbooks & sequencing** | Adaptive hypermedia (Brusilovsky) -> Mastery Grids, adaptive sequencing "What Should I Do Next?" (2015) -> LLM grade/interest personalization (Learn Your Way 2025). | Table stakes. ALGET's reading pane + sequencing + recommendation sit squarely inside Gen-1/2. Not a contribution; must not fail it. |
| **Embedded practice + AQG / worked examples** | QG-Net (L@S 2018), OpenStax AQG -> Bookshelf CoachMe at scale; comprehension efficacy shown (PMC9226369) -> LLM answer-agnostic QG. | Table stakes. ALGET's practice blocks and 192 exemplars are volume, not novelty. |
| **Knowledge tracing / open learner models** | Corbett & Anderson BKT (1995) -> pyBKT, heterogeneous-activity KT on reading logs (Thaker & Brusilovsky), OLM surfacing -> deep KT, BKT fairness w.r.t. reading ability (EDM 2025). | Table stakes, currently BELOW frontier (BKT not DKT; synthetic calibration only). ALGET's contribution is NOT the tracer; it is using learner state as ONE of three fused inputs to the policy. |
| **Social / collaborative annotation** | CSCL/social reading -> Perusall + BJET/RLT analytics; Blobstein 2025 typed taxonomy + heatmap + BERT (n=1,800) -> annotation as a comprehension predictor (Computers & Education 2023, NSF highlight-semantics). | Table stakes *as a feature*. The open gap: prior work uses annotation as an OFFLINE predictor. ALGET feeds annotation type/quote-overlap INTO the live policy. This is the strongest unclaimed opening. |
| **Learning analytics / efficacy norms** | Dashboards-in-courseware -> RCT norm; AI-adaptive meta-analysis g approx 0.70 (Wang et al. 2024); Learn Your Way 60-student RCT is the current efficacy bar. | Below norm until a trial runs. ALGET's RCT-ready persisted decisions are the right *move*; they must produce an actual trial. |
| **LLM-augmented / agentic textbooks** | LLM tutoring -> multi-agent pipelines (IntelliCode; LLM-agents-for-education survey), metacognitive scaffolding-cue generation (Durg et al. iTextbooks 2025), Evidence-Decision-Feedback scaffolding (arXiv 2602.01415); deployed RAG Socratic tutors (SocraticAI, RAGMan, NotebookLM-physics, LPITutor). | Architecturally prior-arted. ALGET's multi-agent + RAG Socratic tutor is its single biggest "just another LLM tutor" exposure. Demote to mechanism; differentiate ONLY via the artifact-evidence-driven, persisted closed loop. |

**Home venue and field anchors:** AIED Workshop on Intelligent Textbooks (iTextbooks, 2019-2025+); IJAIED "Intelligent Textbooks" editorial/collection (2024, doi 10.1007/s40593-024-00451-9); the 4 reading/ PDFs are all from the 2025 IJAIED special issue (Sosnovsky/Brusilovsky/Lan editorial; Morris iTELL; Blobstein emoji-annotation; Sovrano YAI4Edu KG-QA). Position and publish here.

---

## 3. Frontier gaps

### Table stakes ALGET must NOT fail (or reviewers desk-reject)
- **Deployment evidence + an actual efficacy trial.** RAG Socratic tutors are now *deployed in courses with preliminary outcomes*; Learn Your Way has an RCT. A deployed textbook claiming adaptivity with synthetic-only validation is below field norm. The protocol.md trial (2 arms: practice-only vs annotation-adaptive; RQ1-4; deterministic sha256 assignment; mixed-effects ITT; 0-16 artifact rubric) must be executed.
- **Real rubric reliability on real revisions.** The bar is iRULER-style QWK approx .68 human-vs-LLM agreement. ALGET currently logs trace *completeness metadata and field lengths*, not scored before/after states.
- **Annotation taxonomy + threaded replies + group heatmaps.** Blobstein-level social-annotation features are baseline; current ALGET annotation UI lacks grouping/threads/scoring/taxonomy.
- **Faithful explanations.** `reason_codes` exist and persist (server.py emits `annotation_friction`, `artifact_quality_gap`, `artifact_annotation_momentum`, `low_mastery`, etc., persisted at line ~1233), but faithfulness (do reason_codes match the features that actually drove the choice?) is unverified.
- **Privacy/RLS hardening** for artifact/annotation raw text before deployment.

### The open frontier ALGET can occupy
- **Annotation-INTO-policy fusion.** No located system feeds social-annotation signals into a live support-selection policy; prior work stops at offline prediction. ALGET already weights `annotation_friction` (+0.14 on explain), `annotation_momentum` (+0.10 on practice), `artifact_gap` (+0.12 on explain) into candidate scoring (server.py ~960-1023). The frontier delta requires an **ablation** showing these features *change which support fires*, not just that they are logged.
- **Cross-signal closed loop in ONE deployed system.** Jointly conditioning on {BKT/telemetry state + scored artifact-revision features + annotation signals + confidence} -> evidence-logged policy. Each input has a neighbor; the *configuration* in one deployed multi-course textbook is unclaimed.
- **Decision provenance as reusable RCT data.** Persisting candidate/selected/rejected actions + evidence snapshot + reason_codes, exposed as RCT/mediator views, is a trustworthy-adaptivity-auditing methods contribution distinct from XRec post-hoc text explanations - *if* validated with real decisions and a faithfulness check.
- **The Learn Your Way gap.** The strongest generative textbook explicitly LACKS knowledge tracing, performance-based adaptive sequencing, and tutoring dialogue. ALGET can claim the union the current SOTA generative textbook does not have.
- **AI-feedback judgeability as a first-class learning variable.** Logging accept/reject/modify/defer + rationale ("did the learner reject weak AI feedback?") is only lightly touched (Sovrano measures explanation quality, not learner judgment of it). Timely under GenAI epistemic-agency framing.

---

## 4. Reinforcing moves (prioritized)

Each move is tagged REFRAME (sharpens an existing backlog item by doing it the specific way that manifests the novelty) or NEW. The discipline: do the backlog item so it *fuses signals into the adaptive policy and makes the evidence visible*, not as generic polish.

### P0 - directly constitute the defensible delta

**R-1. Scored before/after artifact states feeding the policy** (REFRAME ranks 26, 17) - P0
Backlog 26 (artifact specialization) and 17 (difficulty) become novelty when each course gets >=2 specialized artifact tools that capture *rubric-scored* before/after states AND export `artifact_quality`/`artifact_gap` as live policy inputs (already wired in server.py but currently fed metadata, not scores). Without scored revisions the unit-of-adaptation claim is rhetorical. Sharpens vs lineage: iRULER scores revisions standalone; ALGET couples the sub-scores back into recommendation. Report QWK vs human raters to clear the iRULER .68 bar.

**R-2. Annotation taxonomy + quote-hash overlap wired into the recommender, with an ablation** (REFRAME ranks 14-16, 22) - P0
Backlog 14-16 (prereq/concept graph) and 22 (wire authored misconceptions into feedback) become novelty when annotation type (question/confusion/insight/connection/evidence/critique) and quote-section overlap *alter the next support move* and the authored misconceptions are matched against annotation/artifact text to drive feedback. This is literally RQ4. Sharpens vs lineage: Blobstein/Computers&Education stop at offline prediction; the delta is demonstrated causal influence on support selection via an ablation (annotation-on vs annotation-off routing). De-persona the agents here (backlog 24) so the routing reads as a policy, not a mascot.

**R-3. Faithful, persisted decision provenance exposed as RCT/mediator views** (REFRAME ranks 25, 24) - P0
Backlog 25 (server-side decision persistence) becomes a methods contribution when each decision persists candidate actions + selected + rejected + evidence snapshot + reason_codes, AND a **faithfulness check** confirms reason_codes match the features that actually drove the choice. De-personifying agents per course (24) keeps the record course-comparable. Sharpens vs lineage: distinguishes ALGET from XRec post-hoc explanations and from Evidence-Decision-Feedback (arXiv 2602.01415) by making the loop falsifiable and reusable as data.

### P1 - make the contribution visible and testable

**R-4. Learner-facing "why this support now" panel + instructor rejected-actions view** (REFRAME rank 28) - P1
Backlog 28 (metacognitive prompts) becomes novelty when the already-emitted reason_codes become *visible affordances*: learners see why support fired and can contest it; instructors see rejected actions + evidence snapshots. Turns logged provenance into an interaction. Surfaces the AI-feedback-judgeability variable.

**R-5. AI Feedback Judgment Gate as a logged learning variable** (NEW) - P1
Per EXPERT_REVIEW_SYNTHESIS: accept/modify/reject/defer + rationale as a first-class evidence field (expand trace from 5 to 8 fields: initial draft, claim, evidence, accepted move, rejected/modified suggestion, AI-feedback judgment rationale, revised product, transfer constraint). Sharpens vs lineage: only lightly touched by the PDFs; directly operationalizes GenAI epistemic agency. Guard against the expert-flagged cognitive-overload risk (progressive disclosure, not an 8-field wall).

**R-6. Run the pilot defined in protocol.md** (NEW) - P1
Two arms (practice-only vs annotation-adaptive), pre/post/retention, real event exports, calibration on real data, artifact-revision reliability. This is the gate from "B+ system paper" to "A empirical contribution." Everything above is necessary scaffolding for this; nothing else moves the novelty without it.

### P2 - differentiation and credibility hardening

**R-7. Course-differentiated supplements via signature artifact tools** (REFRAME rank 19) - P2
Backlog 19 (differentiate 192 supplements) becomes novelty when differentiation is *discipline-specific work-product scoring* (AIL606 storyboard/usability; CAT531 transcript/policy/equity decision-map; CAT100 resume/spreadsheet/GitHub-Pages evidence checks), which the generic rubric-LLM papers do not address. Otherwise the 192 are volume.

**R-8. Cross-domain generalizability analytics** (NEW) - P2
Use the 256 sections across 8 heterogeneous courses as deployment-at-breadth evidence: show the fused policy behaves coherently across engineering vs education domains. Weak-but-supportive for generalizability; only meaningful paired with R-6 data.

**Sequencing note.** R-1, R-2, R-3 are the contribution; build them first. R-4, R-5 make it visible/testable. R-6 proves it. R-7, R-8 broaden it. Do NOT add content volume (readiness report's explicit instruction).

---

## 5. One-line framing for the paper abstract

> ALGET is a deployed multi-course intelligent textbook that shifts the unit of adaptation from response correctness to the learner's artifact-revision episode, fusing social-annotation, scored artifact-revision, and knowledge-tracing signals into a single support-selection policy whose evidence-to-decision mapping is persisted as faithful, RCT-analyzable provenance.
