# ALGET pilot data-collection plan

Status: implementation-ready draft

## Purpose

Run one course pilot to evaluate whether source-grounded intelligent textbook
support improves reading-to-evidence work without making learner data or AI
autonomy the intervention. The pilot is observational-first: every generated
action remains behind learner or instructor approval.

## Research questions

1. Do learners move from reading to evidence-based responses more consistently
   when the reader offers bounded tutor and formative-assessment cues?
2. Which passive social cues (Peer Pulse, Evidence Echo, Your Cue) are noticed,
   dismissed, or acted on?
3. Does instructor review of generated modules reduce correction burden while
   preserving source fidelity?
4. Are engagement and mastery signals interpretable without storing raw
   learner writing?

## Pilot shape

- One instructor-owned course and one published module.
- 5–10 learners, 2–3 weeks, one baseline reading task and one ALGET task.
- No grades or high-stakes decisions are automated.
- Instructor approves every generated module, tutor policy, assessment, and
  social-dynamics rule before learner visibility.

## Minimum event dictionary

All events use `event_type`, `course_id`, `section_id`, `actor_id` (pseudonymous
in exports), `occurred_at`, and a `payload` restricted to derived values.

| Event | Derived payload | Outcome family |
|---|---|---|
| `section_opened` | mode, device_class | exposure |
| `section_completed` | elapsed_bucket | completion |
| `evidence_echo_opened` | source_count | social cue |
| `peer_pulse_seen` | peer_count_bucket | social cue |
| `your_cue_selected` | cue_type | social cue |
| `social_round_started` | activity_type | connection |
| `social_evidence_compared` | evidence_submitted, rubric_score | SS RL |
| `tutor_opened` | intent | support |
| `tutor_source_opened` | citation_id | grounding |
| `assessment_submitted` | score, attempt_bucket | formative |
| `artifact_trace_submitted` | quality_score, trace_complete | transfer |
| `instructor_reviewed_draft` | decision, correction_count | governance |
| `module_published` | version, source_count | release |

Raw notes, raw prompts, email addresses, names, and document bodies are never
included in the research export. Free text remains user-owned and is deleted or
redacted before any research analysis.

## Roles and deliverables

- **Instructor:** course source, consent context, approval decisions, weekly
  interpretation memo.
- **Research/data lead:** protocol, codebook, de-identification, quality checks,
  analysis plan.
- **Engineering/analytics lead:** event instrumentation, dashboard queries,
  export manifest, deployment checks.
- **ALGET owner:** product changes, release gate, incident response, final data
  access approval.

## Analysis and stop rules

- Report counts, completion proportions, cue exposure-to-action rates, median
  time buckets, assessment score change, and instructor correction counts.
- Do not infer learning gains from engagement alone; compare baseline and pilot
  evidence artifacts where consent allows.
- Pause collection if consent is unclear, a raw-text field appears in export,
  an unauthorised role can read cohort data, or a generated citation cannot be
  traced to an approved source.

## Release checklist

- [ ] Instructor and learner consent/notice approved.
- [ ] Course and module IDs assigned; no fallback `cohort` identifier.
- [ ] Event schema and export manifest versioned.
- [ ] RLS and instructor course scoping smoke-tested.
- [ ] Source-grounding and approval gates pass.
- [ ] Pilot dashboard and rollback contact confirmed.
