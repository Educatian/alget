# ALGET Bio-Inspired Engineering SSCI Study Design and Qualtrics Specification

Date: 2026-08-25
Status: **internal technical specification ready / human-subjects activation hold**

This document is the single operational specification for turning the ALGET Bio-Inspired Engineering textbook into a defensible intervention study. It does not authorize recruitment, consent, enrollment, survey activation, production migration, or outcome access.

## 1. Bounded contribution and primary claim

The confirmatory contribution is the incremental effect of transparent, bounded adaptive agentic support relative to fixed practice-only support when both arms receive the same intelligent textbook, required content, target study time, and Unity simulations. The first trial does not estimate the effect of Unity itself and does not support claims that ALGET is universally superior across engineering courses or institutions.

Primary estimand: the intention-to-treat adjusted mean difference in immediate Form B concept-and-transfer score between randomized arms, controlling for Form A baseline score and the preregistered randomization stratum.

Primary model: `post_score ~ treatment + pre_score + C(randomization_stratum)`, with heteroskedasticity-robust uncertainty and section dependence handled as prespecified from the achieved section structure. Post-treatment engagement, support uptake, and simulation telemetry do not enter the primary model.

## 2. Design and sample

- Two-arm, 1:1 individually randomized, concealed permuted-block trial within course section and frozen baseline-score band.
- Intervention duration: 6–8 instructional weeks.
- Retention window: 3–4 weeks after the immediate posttest.
- Measurement pilot: 30–50 learners, not used for confirmatory efficacy claims.
- Confirmatory operational target: 300 recruited learners, approximately 255 complete cases with 15% attrition.
- Current design-matched simulation: 82.79% point power for `d = 0.30`, baseline `R² = .36`, section ICC `.05`, 10 moderately unequal sections, and 15% attrition; Monte Carlo 95% interval 82.04%–83.52%.
- More conservative multi-site target: approximately 379 recruits for `d = 0.25`; the final target must be recalculated from pilot variance, reliability, attrition, and achieved section structure before registration.

Randomization is generated outside learner control. The authoritative assignment schedule is independent of ALGET usage; randomized zero-event participants remain in the ITT roster.

## 3. Measurement schedule

| Time | Qualtrics project | Required content | Target burden |
|---|---|---|---:|
| Pre | Candidate Pre Survey/Form A | IRB consent, eligibility, Study ID, demographics, prior exposure, GESE, 12 selected-response items, 3 constructed-transfer tasks | 30–35 min |
| Modules | ALGET pulse | Paas mental effort, technical interruption, bounded process events | <30 sec/module |
| Immediate post | Candidate Post Survey + Form B Posttest | GESE, manipulation check, UES-SF, SUS, exploratory reliance/effort, 12 selected-response items, 3 constructed-transfer tasks | 35–45 min |
| Delayed | Candidate Form C Retention | 12 selected-response items, 3 constructed-transfer tasks | 20–25 min |
| Compensation | Separate Gift-Card Contact | Study ID, authorization, full name, email, optional phone, delivery preference, completed milestone | 3–5 min |
| Interview subsample | Separate approved protocol | purposive arm/gain/uptake sampling; optional recording choice | 30–40 min |

The primary outcome is not a survey attitude scale. It is the linked Form B engineering concept-and-transfer score, including blinded constructed-response scoring. UES-SF and SUS are secondary/descriptive experience outcomes. Treatment-differentiation items check whether the two support conditions were actually distinguishable.

## 4. Instrument validity sequence

1. Six to eight content experts review relevance, engineering accuracy, mechanism mapping, distractors, and transfer demands.
2. Three to five measurement/learning-science experts review construct coverage, fairness, response-process risk, parallel-form equivalence, accessibility, and scoring rules.
3. Eight to twelve students complete think-aloud and retrospective cognitive interviews across prior exposure, course level, device, and accessibility routes.
4. A 30–50 learner pilot estimates burden, missingness, item difficulty/discrimination, distractor behavior, confidence calibration, preliminary reliability, and constructed-score agreement.
5. At least 20% of constructed responses are independently double-scored, oversampling borderline cases. ICC(A,1) and criterion quadratic-weighted kappas below .75 trigger retraining/rescoring; .80 or higher is the operating target.
6. Final wording, keys, form-linking rule, scoring rule, baseline bands, and minimum effect of interest are frozen before confirmatory preregistration.

The pilot is too small for stable IRT, DIF, or broad measurement-invariance claims. Demographic subgroup effects are exploratory unless separately powered and preregistered.

## 5. Consent and privacy contract

- The pre-survey begins with the participant-facing IRB draft in `docs/ENGINEERING_RECRUITMENT_AND_CONSENT_DRAFT.md`; exact PI, compensation, retention, protocol, and contact values remain placeholders until IRB approval.
- No-consent, under-18, and ineligible paths end before outcome items. Unless approved otherwise, the nonconsent path does not retain a screening record.
- Outcome forms contain random Study ID and no direct identifiers.
- Demographics are collected once at pre: age band, gender identity, combined race/ethnicity multi-select, parent bachelor's-degree status, year in program, and broad major category. Every item includes “Prefer not to answer.”
- Names and contact details are collected only in the separate restricted compensation project after an approved pre/post/interview milestone. Gift-card eligibility is not based on score, condition, opinion, support acceptance, or AI-use pattern.
- Qualtrics Survey Flow declares `study_id`, `wave`, and `cohort` Embedded Data before all blocks. The visible Study ID acts as a confirmation; mismatches are quarantined by the analysis builder.
- Direct PII, raw chat, raw CER/reflection text, raw final designs, device fingerprints, full IP addresses, and demographic fields are excluded from telemetry and learner-model features.
- Public outputs suppress small cells under the IRB-approved disclosure rule.

## 6. Qualtrics implementation and QA

The local Candidate v2.3 package is the instrument of record for review. The five older inactive Qualtrics projects are structurally defective: pre/post contain unprotected direct PII, assessment scoring is absent, and posttest/retention integrity endings are incomplete. They must not be activated or silently overwritten.

After expert/cognitive decisions, create new inactive replacement projects and verify:

1. consent, age, enrollment, contact authorization, and integrity endings;
2. top-of-flow Embedded Data for `study_id`, `wave`, and `cohort`;
3. forced-response and intentional nonresponse options;
4. Form A/B/C 0–12 selected-response scoring with no respondent answer feedback;
5. private/restricted PII fields and compensation-only collaborator permissions;
6. anonymized/default metadata settings consistent with the approved IRB plan;
7. desktop/mobile layout, keyboard and screen-reader behavior;
8. valid, nonconsent, ineligible, partial, duplicate, tampered-ID, mobile, and retention paths;
9. zero direct PII in outcome exports and zero outcome/free-text content in compensation exports;
10. inactive QSF re-export, screenshots, project IDs, hashes, tester/date, and deviation log.

Do not pass names, emails, phone numbers, treatment assignment, or secrets in survey URLs. The random UUID Study ID is pseudonymous and is accepted only from the invitation-bound ALGET route and then checked against the restricted roster.

## 7. Unity and intelligent-textbook process evidence

All four Unity WebGL applications are embedded at curriculum-relevant points: structural grip/load paths, trabecular cellular solids, dry adhesion, and passive thermal morphing. Thirteen authored guided labs use prediction → manipulate → observe → explain → reflect framing. The textbook supplies pre-lab questions, bounded hints, evidence prompts, constraint/trade-off reflection, and post-lab transfer prompts.

The canonical event schema records only allow-listed process fields: source app, anonymous session, UTC time, event, opportunity index, progress, bounded inputs, prediction, confidence, result/constraint categories, revision attempt, final-design indicator, and competency. Raw learner-authored text is discarded at the telemetry boundary.

Model extraction remains exploratory and retrospective. The baseline-only and telemetry-fused models use learner-grouped cross-validation and report ROC AUC, Brier score, log loss, and calibration error. Protected demographics are prohibited features. No model may drive grades, compensation, eligibility, or live adaptive decisions without pre-decision features, future-cohort/external validation, subgroup-harm review, governance approval, and a deployment-specific model card.

## 8. Confirmatory and exploratory analyses

Confirmatory order:

1. immediate posttest;
2. delayed retention/transfer;
3. blinded design-rubric score;
4. confidence calibration.

Report adjusted differences, standardized effects, 95% confidence intervals, and exact p values. Preserve ITT. Use complete-case analysis plus prespecified multiple-imputation and inverse-probability-weighted sensitivity analyses. Control the false discovery rate within exploratory families. Treat mediation, usage, sequence, telemetry, interviews, and subgroup analyses as exploratory unless explicitly powered and preregistered.

## 9. SSCI-oriented reporting crosswalk

The protocol and manuscript package will use:

- CONSORT 2025 for the randomized-trial report and participant-flow diagram;
- SPIRIT 2025 for protocol completeness and the enrolment/intervention/assessment schedule;
- CONSORT-EHEALTH for platform version, access, usage, attrition, and digital-intervention reporting;
- TIDieR for replicable descriptions of both adaptive and fixed-support conditions;
- SPIRIT-AI/CONSORT-AI by analogy for intended AI use, model/version, inputs/outputs, human–AI interaction, errors, and change control;
- APA JARS-Quant and JARS-REC for statistical, demographic, race/ethnicity, and culture reporting;
- AERA/APA/NCME Standards for Educational and Psychological Testing for validity evidence and score-use limits;
- WWC Version 5.0 principles for attrition, baseline equivalence, analytic alignment, and transparent education-effect estimates.

Primary sources:

- https://www.bmj.com/content/389/bmj-2024-081123
- https://www.bmj.com/content/389/bmj-2024-081477
- https://www.jmir.org/2011/4/e126
- https://www.bmj.com/content/348/bmj.g1687
- https://www.nature.com/articles/s41591-020-1037-7
- https://www.nature.com/articles/s41591-020-1034-x
- https://www.apa.org/pubs/journals/resources/apa-style-jars
- https://www.apa.org/science/programs/testing/standards
- https://ies.ed.gov/ncee/wwc/Handbooks

## 10. Go/no-go decision

Internal technical readiness requires all local structural, privacy, analysis, frontend, browser, Unity, and reproducibility checks to pass. Human-subjects activation additionally requires documented IRB approval, instrument permissions, expert review, cognitive interviews, pilot evidence, inactive Qualtrics UI/scoring/privacy/synthetic QA, hosted staging RLS/event reconciliation, final version fingerprints, registered preregistration, a secured sample, named study roles, and an explicit go decision.

Until every external gate passes, the correct status is: **review-ready and technically testable, not recruitment-ready**.
