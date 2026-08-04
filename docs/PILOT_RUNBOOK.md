# ALGET controlled pilot runbook

Status: ready for a one-course, observational pilot

This runbook turns `DATA_COLLECTION_PILOT_PLAN.md` into an operator sequence.
It is intentionally conservative: no learner-facing content is published until
an authorized instructor approves the generated draft, and no raw learner text
is exported for research.

## Go/no-go gate

Start the pilot only when all six items are true:

- the instructor has approved the consent/notice language and the course owner;
- the course has a stable lowercase `course_id` (never the fallback `cohort`);
- the source is viewable by the instructor and its hash is recorded;
- the generated draft, citations, tutor policy, assessment, and social rules are
  reviewed in shadow mode;
- the deployed smoke, migration, RLS, and release-readiness checks are green;
- a named rollback contact can retire the module and pause collection.

## Day 0 — provision and approve

1. Sign in as an approved `instructor`, `course_admin`, or `admin`. Do not use
   a client-side role flag or a long-lived token.
2. Create or assign one course shell to the instructor. Confirm the course key
   in the admin view and in the instructor roster; do not reuse another course's
   identifier.
3. Import one syllabus or source document through **Shadow pilot**. For a
   command-line production check, use the short-lived-token helper documented in
   `FACULTY_PARTNERSHIP_PIPELINE.md`:

   ```powershell
   node scripts/faculty_authenticated_smoke.mjs
   ```

   Set `ALGET_INSTRUCTOR_TOKEN` and only the source variable needed for the
   check (`ALGET_GOOGLE_DOC_URL` or `ALGET_PDF_PATH`). Never commit or paste the
   token into a ticket, log, or repository file.

4. Inspect the shadow draft's source hash, section objectives, references,
   warnings, formative assessment, tutor configuration, and social-cue rules.
   Correct unsupported or off-topic claims before approval.
5. In the **Pilot readiness** release gate, resolve all seven checks. If the
   draft contains review notes, use **Acknowledge review notes** only after the
   instructor has inspected them. The gate must show `7/7 checks` before the
   approval or publish action becomes available.
6. Approve the draft, then publish exactly one module. Verify the published URL
   in a signed-out learner session and confirm that the source remains course-
   scoped.

## Day 0 — baseline and learner enrollment

- Record one baseline reading-to-evidence task before exposing the ALGET module.
- Invite 5–10 consented learners from the instructor roster panel.
- Verify that an invited learner can read only the assigned course and cannot
  open instructor, admin, roster, mastery, or research-export routes.
- Give learners a short notice explaining the tutor, formative assessment,
  passive social cues, data minimization, and withdrawal path.

## Weeks 1–3 — operate and inspect

Collect only the derived event fields in `DATA_COLLECTION_PILOT_PLAN.md`.
Review the dashboard once per week for:

- section completion and time buckets;
- exposure-to-action rates for Peer Pulse, Evidence Echo, and Your Cue;
- tutor source-open rate and formative-assessment attempts;
- evidence-trace quality and instructor correction count;
- missing telemetry, unexpected role access, or ungrounded citations.

The instructor writes a weekly interpretation memo. Engagement alone is not a
learning-gain claim; compare baseline and ALGET evidence artifacts only when the
consent protocol permits it.

## Stop and rollback rules

Pause the pilot immediately if any of the following occurs:

- consent or withdrawal status is unclear;
- a raw note, prompt, email, name, or document body appears in a research export;
- an unauthorized role can read roster, mastery, pilot, or export data;
- a citation cannot be traced to an approved source;
- an agent proposes automatic messaging, grading, enrollment, publication, or
  policy changes.

The rollback sequence is: pause agentic interventions, retire the published
module, preserve the audit trail, revoke the affected invite or session, and
open an incident note with the course key, version, timestamp, and derived event
IDs only.

## Closeout package

At the end of the pilot, archive:

1. the consent/notice version and course/module IDs;
2. the source hash and instructor correction log;
3. the versioned event dictionary and de-identified export manifest;
4. baseline versus ALGET evidence-artifact summaries;
5. cue uptake, support, formative, and completion summaries;
6. the instructor interpretation memo and any rollback/incident record.

No raw learner writing or source-document body belongs in the research export.
