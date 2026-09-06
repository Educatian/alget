# ALGET Engineering Intervention Study Protocol

Version: 2.3 review package, 2026-08-25
Primary course: Bio-Inspired Design
Parent IRB protocol: 25-12-9258, expedited initial approval dated 2026-01-13; no continuing review required
Decision status: current IRB evidence covers the earlier 60-person general ALGET study only; expanded Bio-Inspired randomized scope requires an approved amendment or authoritative missing approval artifact before implementation

Operational SSCI/Qualtrics crosswalk: `docs/ENGINEERING_SSCI_STUDY_DESIGN_AND_QUALTRICS_SPEC_2026-08-25.md`.

## 1. Readiness decision

ALGET passes the software release gate, automated tests, topic-aligned primary-source checks, and privacy-oriented event architecture checks. Public or research release still requires an explicit project ownership/license decision and asset-permission record. Parent protocol 25-12-9258 received initial expedited approval on 2026-01-13, but the currently archived approval/stamped consent and the current eProtocol approved-protocol row document only the earlier approximately 60-person general ALGET study. They do not evidence the proposed 300-person Bio-Inspired randomized adaptive-versus-fixed design, gift-card contact process, delayed test, detailed Unity telemetry, or revised data systems. Recruitment therefore requires either an approved amendment covering the complete proposed scope or an authoritative expanded-scope approval artifact that can be archived and reconciled line-for-line with Candidate v2.3. See `research/IRB_SCOPE_AND_AMENDMENT_AUDIT_2026-08-25.md` and `research/evidence/irb_scope_reconciliation_2026-08-25.json`.

The next research stage is a 30 to 50 learner feasibility and measurement pilot after the approved instrument/consent version is reconciled and all operational QA gates pass. A full efficacy study begins only after all gates in Section 12 pass. Staff/expert review and synthetic-response QA may proceed immediately in the inactive Candidate v2.3 projects.

## 2. Research questions

1. Does adaptive, agentic support improve immediate and delayed bio-inspired engineering concept and transfer performance relative to the same textbook and simulations with fixed support?
2. Does adaptive support improve confidence calibration and design-revision quality?
3. Which logged learning processes explain when support is helpful, without conditioning the primary treatment estimate on post-treatment variables?
4. How do learners experience the usability, engagement, workload, transparency, trust, and appropriate reliance of the system?

## 3. Design and causal contrast

Use a two-arm, individually randomized, blocked trial within participating course sections.

| Element | Arm A: adaptive agentic support | Arm B: fixed support comparison |
|---|---|---|
| Textbook, readings, practice, Unity labs | Identical | Identical |
| Content exposure and study time | Identical targets | Identical targets |
| Hints and prompts | Selected from a bounded, logged policy using prior responses and calibration | One prespecified practice-only prompt in every section |
| Agent debate and recommendation | Visible, bounded, and source-linked | No adaptive policy call and no generative chat surface |
| Instructor access and grading | Identical | Identical |

Randomize 1:1 after the pretest using concealed permuted blocks within course section and a pilot-frozen baseline-score band. Generate the schedule with `research/prepare_engineering_randomization.py`, retain the raw seed outside the repository, preregister its SHA-256 fingerprint, and import only the domain-separated Study ID hash into the service-role allocation table. The authenticated claim function accepts no learner-controlled user, seed, stratum, block, or arm parameter. Keep allocation hidden from outcome scorers. Students may know which support they receive, so measure treatment differentiation with four post-study manipulation-check items.

The estimand is the effect of the full transparent adaptive-support package relative to fixed practice-only support. It is not a pure test of personalization holding every support type and dose constant. Report delivered support and content length by arm so the bundled contrast is explicit.

Do not use a Unity versus no-Unity contrast in this first trial. Holding the simulations constant isolates the incremental effect of adaptive agentic support. A later study may compare Unity to a functionally equivalent 2D simulator.

## 4. Participants and timeline

- Population: undergraduate engineering or bioengineering learners enrolled in a course that can use the ten-module Bio-Inspired Design sequence.
- Intervention: 6 to 8 instructional weeks.
- Measurement: pretest before randomization, brief module checks, immediate posttest, and retention test 3 to 4 weeks later.
- Exclusions: duplicate enrollment, no consent, no baseline measure, or verified technical inability to access any assigned materials. Preserve all randomized participants in the intention-to-treat analysis when outcome data exist.
- Compensation: use equal compensation by arm and avoid performance-contingent payment. The exact gift-card amount, eligibility milestones, delivery timing, funding source, duplicate-payment controls, and tax language must match the approved IRB and institutional policy before activation.

## 5. Outcomes

### Primary outcome

Immediate posttest score from a parallel-form concept and near/far-transfer assessment, estimated with baseline adjustment. The assessment must include scored engineering reasoning and design trade-off items, not only recognition questions.

### Key secondary outcomes

- Delayed retention and transfer score at 3 to 4 weeks.
- Blindly scored design rationale using mechanism accuracy, evidence alignment, constraint reasoning, and transfer quality.
- Confidence calibration error linked to objective item correctness.

### Exploratory outcomes

- Engagement, usability, trust and distrust, mental effort, support uptake, and help-seeking.
- Simulation design-process quality: normalized opportunity completion, prediction accuracy, calibration, redesign trajectory, constraint resolution, and final competency evidence.
- Heterogeneous effects by baseline knowledge only when preregistered and adequately powered.
- Mediation or process analyses are exploratory and must not replace the intention-to-treat estimate.

## 6. Measurement plan

Use `research/measures/engineering_study_instruments.md` as the administration and scoring codebook. Use `research/measures/bio_inspired_assessment_blueprint.json` to develop three linked forms. The forms remain marked `development_only` until review is complete.

The Qualtrics package now contains concrete A, B, and C development forms. Each contains 12 selected-response items and three constructed-transfer tasks, with balanced correct-answer positions within each selected-response form. Balanced keys do not establish form equivalence. The design-team audit in `research/measures/bio_inspired_parallel_form_audit.json` currently finds only 2 of 12 selected-response families at the same provisional cognitive-demand level across A/B/C and finds that six structure/swarm prompts do not explicitly elicit the evidence-alignment criterion. Parallel-form status is therefore on HOLD until revision, expert review, cognitive interviews, and pilot linking are complete.

The `research/measures/qualtrics_candidate_v2/` package implements a complete candidate correction: 27 of 45 assessment instances are revised, all 36 selected-response items are mapped to 12 A/B/C families at one provisional high cognitive-demand level, each family has an explicit cognitive operation and correct-answer rationale, all 108 distractors carry item-specific misconception hypotheses, and all nine constructed prompts elicit the four scored dimensions. Candidate v2.3 removes direct identifiers from all outcome forms, reserves them for the separate gift-card project, adds a privacy-minimized pre-survey demographic profile linked by random Study ID, supplies a fail-closed participant-facing consent draft, and declares `study_id`, `wave`, and `cohort` as top-of-flow Embedded Data in every form. Its 17/17 structural pass is not expert, response-process, or psychometric evidence. Five uniquely named inactive Candidate v2.3 cloud review projects were created on 2026-08-25 without modifying the five historical HOLD projects. They remain inactive pending approved-version reconciliation, scoring configuration, gift-card PII restriction, scientific validation, and synthetic mobile/duplicate/completion/export QA.

Constructed responses use `research/measures/ENGINEERING_CONSTRUCTED_RESPONSE_SCORING_MANUAL.md` and its aligned fieldwork schema. The task total is the sum of mechanism accuracy, evidence alignment, constraint/trade-off reasoning, and transfer justification (0–3 each). At least 20% are independently double-scored; total-score ICC(A,1) and criterion quadratic-weighted kappas below .75 trigger retraining and rescoring, with .80 or higher as the operating target. Adjudicated scores are excluded from reliability estimates.

Required validation sequence:

1. Six to eight bio-inspired design, mechanical engineering, or bioengineering subject-matter experts rate relevance and accuracy.
2. Three to five learning-science or measurement experts rate construct coverage, fairness, and scoring clarity.
3. Eight to twelve students complete cognitive interviews.
4. Thirty to fifty learners complete a measurement pilot for difficulty, discrimination, missingness, timing, and scoring reliability.
5. Revise and freeze the item bank before preregistration. Record all retired items and reasons.

## 7. Sample size

The current operational planning recommendation is **300 recruited learners** for a target standardized effect of 0.30, two-sided alpha of .05, baseline outcome R-squared of .36, section ICC of .05, 10 moderately unequal sections, and 15% attrition. This yields about 255 complete cases. In 10,000 fixed-seed Monte Carlo replications of the planned blocked individual randomization and HC3 ANCOVA, estimated power was 82.8% (Monte Carlo 95% interval 82.0% to 83.5%). This is a planning value, not a final preregistered target.

| Target effect | Complete total | Recruited with 15% attrition | Interpretation |
|---:|---:|---:|---|
| 0.25 | 322 | 379 | Conservative, preferred for a durable multi-site study |
| 0.30 | 224 | 264 | Normal-approximation screening value; not the operational target |
| 0.35 | 165 | 195 | Acceptable only with a justified minimum effect |
| 0.40 | 126 | 149 | Detects only a comparatively large effect |

These table values use a normal approximation for a baseline-adjusted two-arm contrast. The design-matched simulation in `research/power/ENGINEERING_POWER_SIMULATION_REPORT.md` found 76.4% power at 264 recruits, 79.7% at 280, and 82.8% at 300. Recalculate with the pilot variance, baseline correlation, section structure, form reliability, and actual attrition before preregistration.

Avoid cluster randomization for a single-site first study. With 25 learners per class and ICC = .05, the design effect is 2.20, so a 0.30-effect design would need about 493 complete observations before attrition and enough independent course sections to estimate clustering. If contamination forces cluster assignment, use a multi-site design and power on the number of clusters, not only individuals.

## 8. Analysis plan

Primary model:

`post_score ~ treatment + pre_score + C(randomization_stratum)`

- Report adjusted mean difference, 95% confidence interval, standardized effect, and exact p value.
- Use heteroskedasticity-robust standard errors and account for section clustering if residual dependence remains.
- Analyze randomized participants by assigned condition.
- Handle missing posttests with a prespecified multiple-imputation sensitivity analysis and report complete-case and inverse-probability-weighted sensitivity estimates.
- Use a gatekeeping order: immediate posttest, retention, design-rubric score, calibration. Treat all other tests as exploratory and control the false discovery rate within exploratory families.
- Blind rubric scorers to condition. Double-score at least 20% and report an appropriate reliability coefficient.
- Do not remove low-usage participants from the primary analysis. A complier analysis may be reported as secondary with explicit assumptions.
- Read arm and stratum from the authoritative concealed allocation schedule, not from Unity or ALGET usage. A randomized participant with zero events remains in the ITT roster.
- Describe the sample using age band, gender identity, combined race/ethnicity, parent bachelor's-degree status, year in program, and broad major category. Do not add these variables to the primary model merely because they were collected. Any treatment-by-demographic interaction must be preregistered, multiplicity-controlled, and supported by adequate cell sizes; otherwise report it as exploratory with uncertainty.
- Protect small cells in tables and public outputs. Suppress cells below the IRB-approved threshold and do not publish cross-tabulations that permit reconstruction. Never label suppressed categories as a generic “other”; combine categories only with a documented analytic rationale and retain the original self-reported values in the restricted research dataset.

Learner-model development is exploratory and separate from the confirmatory treatment-effect analysis. The retrospective model compares baseline-only and telemetry-fused prediction of end-of-course mastery using learner-grouped stratified cross-validation. Because full-intervention aggregates occur after early support decisions, these models cannot drive live adaptation. Live use requires features frozen at a documented pre-decision cutoff, a future target, a held-out later cohort or external site, calibration and subgroup-harm review, a model card, and explicit governance approval.

## 9. Fidelity and contamination

Log condition assignment, support eligibility, recommendation, display, acceptance or rejection, response latency, and fallback reason. Compare delivered-support dose and content length by arm. Survey four treatment-differentiation items at posttest. Ask instructors to avoid distributing screenshots or condition-specific instructions across groups. Record any class-level deviations.

## 10. Ethics, privacy, and AI governance

- Verify that the current IRB approval/eProtocol record and stamped consent cover the exact live protocol, instruments, compensation, and data systems before recruitment or production data collection.
- Use pseudonymous study IDs. Keep the re-identification key outside ALGET and restrict it to designated study staff.
- Export only allow-listed, derived event fields through security-invoker database views.
- Do not export chat text, CER text, final-design free text, names, email, device fingerprints, or full IP addresses.
- Explain that AI recommendations may be wrong and do not determine grades.
- Provide an equivalent non-AI learning path for students who decline research participation when instruction requires ALGET.
- Freeze model, prompt, content, and policy versions for each cohort. Log approved changes and conduct drift checks.
- Store learner-model artifacts with input and artifact fingerprints. Do not include participant hashes in out-of-fold prediction exports, and do not use the model for grades, eligibility, compensation, or disciplinary decisions.

### Qualtrics identity and gift-card records

The original development QSFs and currently provisioned drafts implement the investigator's request for full name and contact information at both pretest and posttest. Authenticated UI/API QA showed that those fields are in the same response record as outcomes and are not private in the live drafts, so the statement that they are “stored separately” is not true for those projects. Candidate v2.3 resolves this by collecting names/contact only in the separate gift-card project and linking pre/post milestones by random Study ID. It also receives `study_id`, `wave`, and `cohort` from the invitation-bound ALGET route and treats the visible Study ID as a confirmation field; mismatches are quarantined before analysis. The pre-survey keeps demographic responses in the pseudonymous outcome record under that Study ID; these are sensitive quasi-identifiers, not direct contact fields and not anonymous data.

- Store full name, email, phone, delivery preference, and payment status in a restricted compensation project, not in the analytic dataset.
- Keep consent and eligibility in separately gateable pre-survey blocks. Outcome forms contain Study ID only. The separate gift-card form gates its PII block on contact authorization. Unless the IRB explicitly approves retaining a screening log, configure the nonconsent ending not to record the response.
- Grant compensation-project access only to designated payment staff. Course instructors and outcome scorers should receive no PII or payment-status detail.
- Treat the QSF private-data flag only as an import aid. After import, mark PII fields sensitive/restricted and verify collaborator permissions, report access, exports, and synthetic response visibility in the authenticated Qualtrics account.
- If the IRB explicitly requires duplicate pre/post contact capture despite the privacy-separated candidate, treat that as a documented protocol deviation: explain the necessity, restrict the fields, and prove a zero-PII outcome export before launch.
- Never derive Study ID from initials, birth date, phone digits, or other personal facts.
- Collect demographic variables only once at pretest. Use age bands rather than date of birth, broad major categories rather than free text, a combined multi-select race/ethnicity item, and a response-withholding option for every demographic question. Do not collect student number, citizenship/visa status, address, or demographic free text unless a later IRB-approved research question specifically requires it.
- Do not use demographic responses for randomization, adaptive support, learner-model features, grades, eligibility, or compensation. Their approved uses are sample description, generalizability assessment, and prespecified or clearly labeled exploratory equity checks.
- Bind each Study ID to a pre-invited authenticated account through the restricted roster. Never derive an account password or visible alias from the Study ID, and never permit learner-created research roster rows.
- The invitation email may be stored in Supabase Auth and the restricted roster only when the consent and IRB data plan explicitly permit account provisioning. It must remain absent from outcomes, event telemetry, scoring exports, and model artifacts.
- Retain the name-to-ID and payment ledger only for the period required by the IRB, sponsor, tax, and institutional record-retention rules, then securely destroy it.
- Do not withhold earned compensation because of study condition, score, opinion, AI-use pattern, or withdrawal after completion of an approved milestone.
- Keep all imported surveys inactive until consent, compensation, PII separation, termination logic, and permissions are approved and tested.

## 11. SSCI-level contribution strategy

The paper should claim a bounded contribution: the incremental effect and process of transparent adaptive agentic support in an authentic bio-inspired engineering sequence. It should not claim that ALGET as a whole is superior based on one course or one institution.

For a strong international journal submission:

- preregister hypotheses, outcomes, exclusions, power assumptions, and code before outcome access;
- publish a de-identified data dictionary, analysis code, item metadata, and synthetic example data;
- report CONSORT-style participant flow and intervention fidelity;
- distinguish confirmatory, secondary, and exploratory analyses;
- include delayed transfer, not only immediate local-test performance;
- triangulate learning outcomes, process traces, and purposively sampled interviews;
- discuss local-assessment inflation and single-institution generalizability;
- verify the target journal's current Web of Science/SSCI indexing and scope at submission time.

## 12. Go/no-go gates

| Gate | Evidence required | Current status |
|---|---|---|
| Software | frontend, backend, build, release-readiness tests pass | Pass |
| Content | active engineering corpus and citations verified | Primary-source alignment passes; explicit project license/ownership and asset-permission decisions remain pending |
| Unity transport | common schema, parent-origin targeting, receiver source/origin checks | Rebuilt and deployed for four apps; live browser smoke passes; preview event-to-database reconciliation required |
| Data export | pseudonymous allow-listed view and feature-builder tests | Implemented locally; migration deployment required |
| Outcomes | three linked forms pass expert, cognitive, and pilot review | Not passed |
| Surveys | approved versions, permissions, scoring, burden test | Draft complete; permissions check required |
| IRB | expanded Bio-Inspired scope, revised consent, recruitment, and data plan approved and archived | Not passed: current eProtocol/stamped evidence covers the earlier 60-person general ALGET study; amendment or authoritative missing expanded-scope approval artifact required |
| Feasibility | 30 to 50 learner pilot meets completion and missingness thresholds | Not run |
| Confirmatory power | Pilot-recalculated target secured; current operational placeholder is 300 recruits | Not secured |
| Registration | protocol and analysis code time-stamped before outcomes | Not passed |

Confirmatory enrollment is a no-go until every gate except publication is passed.
