# ALGET engineering study fieldwork packet

Date: 2026-08-16
Status: **fieldwork-ready / evidence collection hold**

This packet operationalizes the validation gates for the inactive Candidate v2.3
instrument set. It is a preparation artifact, not evidence that review or pilot
activities have occurred. Do not recruit, activate, or import a candidate form
until the approved protocol, named roles, and IRB/institutional requirements are
documented.

## Instrument set

| Form | Candidate artifact | Purpose |
|---|---|---|
| A pre | `research/measures/qualtrics_candidate_v2/01_ALGET_Engineering_PreSurvey_CandidateV2.qsf` | consent, eligibility, baseline selected-response and constructed tasks |
| B post | `research/measures/qualtrics_candidate_v2/02_ALGET_Engineering_PostSurvey_CandidateV2.qsf` | post-program parallel measures and transfer tasks |
| C posttest | `research/measures/qualtrics_candidate_v2/03_ALGET_BioInspired_PostTest_CandidateV2.qsf` | delayed or follow-up knowledge and transfer checks |
| Contact | `research/measures/qualtrics_candidate_v2/04_ALGET_GiftCard_Contact_CandidateV2.qsf` | restricted compensation contact only |
| Retention | `research/measures/qualtrics_candidate_v2/05_ALGET_BioInspired_RetentionTest_CandidateV2.qsf` | retention and delayed transfer |

All five candidate artifacts remain local and inactive. Keep contact fields in
the separate contact form; never merge them into outcome exports.

## 1. Authority and review setup

Before any participant-facing work, record the approved protocol number, data
owner, restricted linkage roles, compensation rule, retention schedule, storage
locations, adverse-event path, and the version fingerprint of the candidate
forms. Use non-identifying reviewer, session, and participant codes in the
templates. Do not put names, emails, phone numbers, raw recordings, or raw
responses in this repository.

Required setup decisions are listed in
`docs/ENGINEERING_DATA_AND_COMPENSATION_SOP.md` and the full evidence protocol
is `research/measures/ENGINEERING_INSTRUMENT_VALIDATION_PROTOCOL.md`.

## 2. Expert review

Run two independent panels:

1. Six to eight subject-matter reviewers spanning bio-inspired design and the
   relevant structure, materials, fluid/adhesion, thermal/optical, and systems
   domains.
2. Three to five measurement/learning-science reviewers for construct coverage,
   response process, accessibility/fairness, parallel-form equivalence, and
   scoring.

Use `research/measures/fieldwork/ENGINEERING_EXPERT_REVIEW_TEMPLATE.csv`.
Record relevance, accuracy, clarity, fairness, distractor quality, and parallel
form equivalence on the 1–4 scale. Resolve every essential change and factual or
key disagreement. The analysis script reports I-CVI, modified kappa, and
S-CVI/Ave; thresholds flag review and do not silently delete items.

## 3. Cognitive interviews

Run eight to twelve approved sessions after expert review and before the
measurement pilot. Sample across relevant prior exposure, course level, device,
and at least two planned accessibility routes. Use think-aloud plus retrospective
probes about interpretation, distractor elimination, confidence, interface
burden, and whether the intervention cues an answer without understanding.

Use `research/measures/fieldwork/ENGINEERING_COGNITIVE_INTERVIEW_LOG_TEMPLATE.csv`.
Record only de-identified observations. Severity 3 issues pause the affected
item family; material revisions return to targeted cognitive testing.

## 4. Measurement and scoring pilot

Run a 30–50 learner pilot only after wording is frozen for the pilot version and
the approved consent/recruitment process is live. The pilot estimates burden,
missingness, timing, response distributions, distractor behavior, confidence
calibration, and preliminary reliability. It does not support causal efficacy,
stable IRT/DIF/invariance, or automatic credential decisions.

Use the following de-identified templates and scripts:

- `research/measures/fieldwork/ENGINEERING_MEASUREMENT_PILOT_LONG_TEMPLATE.csv` for selected responses;
- `research/measures/fieldwork/ENGINEERING_CONSTRUCTED_SCORE_TEMPLATE.csv` for rubric scoring;
- `research/measures/analyze_engineering_measurement_pilot.py` for diagnostics;
- `research/measures/analyze_engineering_constructed_scores.py` for scoring QA.

Double-score at least 20% of constructed responses, oversampling borderline
cases. Calibrate and independently rescore when reliability is below the
operating target; adjudication cannot replace reliability evidence.

Example analysis commands, using only de-identified files:

```powershell
py research/measures/analyze_engineering_expert_review.py `
  --input <expert-review.csv> `
  --json <expert-review-diagnostics.json>
py research/measures/analyze_engineering_measurement_pilot.py `
  --input <measurement-pilot-long.csv> `
  --json <measurement-pilot-diagnostics.json>
py research/measures/analyze_engineering_constructed_scores.py `
  --input <constructed-scores.csv> `
  --json <constructed-score-diagnostics.json>
```

## 5. Qualtrics and data-path QA

After the review decision, import approved forms as new inactive projects. In
the authenticated UI, verify consent/eligibility endings, required responses,
mobile rendering, accessibility, embedded-data fields, scoring visibility,
signed returns, export tags, and the separation of contact and outcome data.
Submit synthetic identities only. Confirm valid, ineligible, non-consent,
partial, duplicate, mobile, and signed-return paths before any activation
decision.

## 6. Freeze and activation closeout

Attach a de-identified closeout record to the study package only when all of the
following are true:

- expert decisions and measurement disagreements are resolved;
- cognitive findings are dispositioned and material revisions are retested;
- pilot timing, missingness, item behavior, preliminary reliability, and scoring
  QA are documented;
- final QSF, codebook, rubric, content, build, and analysis fingerprints are
  recorded;
- staging migration, assignment, RLS, export, and reconciliation checks pass;
- preregistration is refreshed and registered before confirmatory outcome access;
- a named study lead records the go/no-go decision.

Only then may the approved IDs be configured in a staging build. Production
activation, recruitment, and confirmatory data access remain separate authorized
actions.
