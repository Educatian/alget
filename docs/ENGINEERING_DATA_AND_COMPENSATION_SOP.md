# ALGET Engineering Study Data and Compensation SOP

Version: 1.0 development draft, 2026-08-15
Status: **PROPOSED-STUDY OPERATIONAL HOLD - expanded scope approval/amendment, approved values, and restricted roles are required before launch**

## Purpose

This SOP separates consent/contact/payment records from research outcomes and process telemetry for the Bio-Inspired Design intervention. It governs Study ID creation, account invitation, Qualtrics exports, ALGET/Unity logging, compensation, analytic data construction, access review, incident handling, retention, and destruction.

## Required operating decisions

- Protocol number and approval date: `25-12-9258; initial approval 2026-01-13 for the earlier approximately 60-person general ALGET scope; expanded Bio-Inspired randomized scope not evidenced in the current eProtocol/stamped record`
- Data owner/PI: `Dr. Jewoong Moon`
- Restricted linkage administrators: `[PENDING NAMES/ROLES]`
- Compensation staff: `[PENDING NAMES/ROLES]`
- Outcome scorers: `[PENDING NAMES/ROLES]`
- Analysis/model staff: `[PENDING NAMES/ROLES]`
- Gift-card amount, milestones, timing, funding, tax treatment, and unclaimed-card procedure: `[PENDING]`
- Contact/payment ledger retention and destruction date: `[PENDING]`
- Consent records, outcome data, telemetry, interview data, and code retention: `[PENDING BY RECORD CLASS]`
- Approved storage locations and backup region: `[PENDING/VERIFY]`

## Data zones

| Zone | Contents | Direct identifiers | Permitted roles | Research export |
|---|---|---:|---|---|
| Q1: Qualtrics contact/compensation | name, email, requested milestone, manual verification/payment status | Yes | linkage administrator, compensation staff | Never directly |
| Q2: Qualtrics outcomes | consent/eligibility flags, Study ID, privacy-minimized demographics, item responses, scores, surveys, constructed responses | No direct contact fields; Study ID and demographics are linkable quasi-identifiers | approved research staff; blinded scorers receive minimum fields | Analysis-specific hash; no `PII_*`; small-cell controls |
| S1: Supabase account/roster | Auth email, user UUID, random Study ID, invitation status, inviter | Yes/linkable | accountable operator; learner's own row | Never directly |
| S2: ALGET/Unity research events | pseudonymous actor/link hash, assigned arm, section/event/time, derived process fields | No | service-role exporter; approved data staff | Allow-listed view only |
| A1: Analysis dataset | assignment, baseline/outcomes, derived survey and process features | No | analysis team | Approved de-identified release only |
| M1: Model artifacts | fitted objects, aggregate metrics, model card, artifact hashes, deidentified predictions | No participant hash in OOF export | model team | No operational deployment before governance approval |

## Study ID and account procedure

1. Generate a random RFC 4122 UUIDv4. Never derive it from name, initials, birth date, student ID, email, phone, or course performance.
2. Normalize only by lowercase and surrounding-whitespace removal.
3. Use `sha256("alget-study-link-v1:" + normalized_study_id)` for database schedule/linkage. Keep the raw Study ID in the restricted roster and approved Qualtrics record only.
4. Generate the visible account alias and password independently from the Study ID. Do not embed Study ID fragments in either.
5. Provision the schedule row before invitation. The invitation function must reject a Study ID without a schedule row.
6. Only an accountable admin/course-admin service operation may create the research roster row. Learner self-enrollment is denied.
7. The authenticated claim RPC accepts no user, arm, seed, block, ratio, or stratum parameter. Repeated claims must return the original assignment.

## Qualtrics operating procedure

1. Keep all five projects inactive through approval and QA.
2. Configure no-consent, under-18, and ineligible endings in the pre-survey; configure declined-contact authorization in the separate gift-card form before its PII block.
3. Verify pre/post/posttest/retention contain no `PII_*` fields. The gift form collects only `PII_FULL_NAME` and `PII_EMAIL`; phone number and delivery-preference fields are prohibited because fulfillment is email-only. Mark both PII questions sensitive/restricted in the authenticated UI when the brand permits it, and restrict collaborators, reports, and exports. The 2026-08-25 API attempt to set `DataVisibility.Private` was rejected with `403 / QMST_2.1`; until a brand admin enables that control, the project must remain owner-only with no collaborators and exports restricted to the named compensation operator.
4. Configure the 12 selected-response items on each A/B/C form as one point each. Do not auto-score constructed responses. Hide scores and correctness feedback until retention is complete.
5. Run all eligible/ineligible, consent/nonconsent, mobile, duplicate, partial-completion, scoring, redirect, and export paths with synthetic identities.
6. Export gift-form PII fields to Q1, manually compare Study ID and requested milestone with the authoritative completion record, reconcile duplicates and corrections, and prove Q2/A1 were produced from outcome forms that never collected `PII_*` fields.
7. Replace raw Study ID with an analysis-specific domain-separated hash before A1 when required by the approved plan.
8. Export and fingerprint the final inactive QSFs after UI configuration. Do not edit a live instrument without approved amendment/change control.

## Demographic-data procedure

1. Collect demographics once in the pre-survey after eligibility and Study ID entry: age band, gender identity, combined race/ethnicity with multiple selections, parent bachelor's-degree status, year in program, and broad major category.
2. Every demographic item must offer “Prefer not to answer.” Date of birth, student number, citizenship or visa status, address, and demographic free text are excluded from Candidate v2.4.
3. Treat demographic fields as sensitive quasi-identifiers. They may enter the restricted analytic dataset under an analysis-specific participant hash, but never Q1 compensation exports, ALGET/Unity telemetry, adaptive-policy inputs, learner-model features, grades, eligibility, or payment decisions.
4. Preserve self-reported categories in the restricted dataset. Create a separate disclosure-controlled reporting view, suppressing cells below the IRB-approved threshold and preventing reconstructable cross-tabulations.
5. Use demographics for sample description and generalizability. Treatment-effect heterogeneity is confirmatory only if the exact contrast, coding, minimum cell size, and multiplicity rule are preregistered and powered; otherwise label it exploratory.
6. Verify the final Qualtrics export representation of the multi-select race/ethnicity item during pilot QA before freezing recode syntax.

## ALGET and Unity event procedure

- Accept events only from the exact configured iframe origin and iframe window.
- Permit the shared `bio-design-learning-event/1.0` field allowlist.
- Exclude `detail`, `finalDesign`, chat, CER, reflection, transfer rationale, and other learner-authored text.
- Keep guided-reflection text in session storage only; log completed state, length band, and checkpoint completion.
- In the service-role export, restrict rows to the Bio-Inspired research cohort, Bio-Inspired course, and target experiment.
- Hash prediction/result labels with the domain `alget-sim-category-v1`; export only the derived constraint-violation boolean, not raw constraint labels.
- Convert malformed numeric telemetry to null rather than failing the export. Limit confidence and competency to 0-100.
- Reconcile browser-side accepted events, `interaction_events`, and exported events; document duplicates, retries, rejects, and loss rate.

## Compensation procedure

1. Compensation staff receive only Study ID, name/contact, approved milestone status, amount due, issue date, delivery method, and reconciliation status.
2. Outcome scores, arm, AI-use behavior, recommendation acceptance, interview opinions, and course grade are never payment criteria.
3. Qualtrics never sends a gift card automatically. After a gift-form submission, compensation staff manually verify the approved milestone in the authoritative completion ledger, check duplicate Study ID/email/payment records, and record only the eligibility result without copying outcome data.
4. Send an approved gift card only to the verified `PII_EMAIL` address. Do not collect a phone number or offer text-message delivery.
5. Two-person review is required for bulk issuance or `[INSTITUTIONAL THRESHOLD]`.
6. Record card batch/vendor reference separately from research outcomes. Never place card numbers or redemption codes in ALGET, Qualtrics outcomes, source control, or analysis files.
7. Mark delivery as pending/eligible/issued/failed/reissued/unclaimed using the approved codebook. Reissue only under the approved lost/failed-delivery rule.
8. Provide earned prorated compensation after withdrawal according to the consent form and approved milestone rule.
9. Reconcile total cards and total value to funding records without exposing participant responses.

## Access matrix and quarterly review

| Action | Linkage admin | Compensation staff | Instructor | Blind scorer | Analyst | Model developer | Operator/service role |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read name/contact | Yes | Yes | No | No | No | No | Technical minimum only |
| Read raw Study ID | Yes | Minimum necessary | No | No | No | No | Restricted provisioning only |
| Read assigned arm | No unless operationally required | No | Blinded operational summaries only | No | After lock | After lock if approved | Claim enforcement |
| Read constructed outcomes | No | No | No | Yes | After scoring | Features only if approved | No |
| Read raw event rows | No | No | No | No | Approved data staff | Approved data staff | Service export only |
| Issue gift card | No unless dual role approved | Yes | No | No | No | No | No |

The PI must name individuals for each approved role, prohibit unlisted dual roles, review access at activation and at least quarterly, remove access immediately after role change, and retain an access-review log without secrets.

## Analytic export gate

Before dataset lock, require all of the following:

- zero columns matching `PII_*`, name, email, phone, invitation email, full IP, device fingerprint, raw Study ID, raw chat/reflection/CER/final-design text; approved demographic fields may remain only in the restricted analytic dataset and disclosure-controlled reporting view;
- one authoritative assignment per randomized learner from the concealed allocation schedule, including zero-usage learners;
- one event-export row per accepted canonical event after documented deduplication;
- expected A/B/C scoring totals and blind rubric reconciliation;
- event-count reconciliation by source app, section, learner, and day;
- hashes of every source export, code version, QSF, content version, Unity build, model/policy, and final dataset;
- a signed data-lock record naming the PI, data lead, and analysis lead.

## Incident and deviation procedure

Immediately stop the affected collection/export when there is suspected PII leakage, wrong-arm access, crossover, scoring error, missing/duplicated events beyond threshold, unauthorized collaborator access, or loss of consent/payment records. Preserve logs without copying exposed content, notify the PI/data lead, contain access, assess participant impact, and follow the current UA requirements for reportable new information and amendments. Do not silently repair confirmatory data after outcome access; document and preregister the resolution or sensitivity analysis.

## Retention and destruction

- Do not set a single universal period until UA, IRB, sponsor, tax, and agreement requirements are reconciled by record class.
- Record an exact disposition date and accountable owner for Q1, Q2, S1, S2, A1, M1, consent records, interview recordings/transcripts, payment records, and code.
- Destroy Q1/S1 linkage as early as approved. Verify deletion from primary storage, trash/version history, exports, local downloads, and backups according to institutional capability.
- Retain only the minimum de-identified research record needed for reproducibility and obligations.
- Archive a destruction certificate containing categories, date, method, approver, and exceptions, without participant values.

## Authoritative institutional references

- University of Alabama HRPP Submission Guidance: https://research.ua.edu/offices/compliance/hrpp/review/submission-guidance/
- University of Alabama HRPP Toolkit: https://research.ua.edu/offices/compliance/hrpp/hrpp-toolkit/
- University of Alabama Researcher Responsibilities After IRB Approval: https://research.ua.edu/offices/compliance/hrpp/review/researcher-responsibilities-after-irb-approval/
