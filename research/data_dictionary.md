# ALGET Research Data Dictionary

## Core Tables

| Table | Unit | Purpose |
| --- | --- | --- |
| `interaction_events` | event | Canonical behavior stream for reading, practice, annotation, support, affect, and recommendation traces. |
| `recommendation_decisions` | recommendation | Stores adaptive support decision, candidate actions, learner state, and evidence snapshot. |
| `intervention_traces` | recommendation lifecycle | Tracks whether support was opened, accepted, and associated with immediate/retention reward. |
| `evaluation_runs` | assessment attempt | Stores pre/post/retention scores. |
| `evaluation_responses` | item response | Stores correctness, confidence, latency, and misconception label. |
| `section_annotations` | annotation | Stores social annotation body, type, quote hash, and concept IDs. |
| `annotation_reactions` | reaction | Stores helpful/same-question/resolved reactions. |
| `annotation_replies` | reply | Stores threaded learner replies. |
| `learner_concept_state` | learner-concept | Stores mastery, confidence, forgetting, transfer readiness, and dominant misconception. |

## Privacy Rules

- Export `user_id` as `P001`, `P002`, etc.
- Keep raw annotation text local to the research DB.
- For publication exports, use quote hash, annotation type, and length unless a quoted passage has explicit consent.
- Do not export raw chat text by default; export counts, lengths, support type, and coded labels.

## Derived Variables

| Variable | Definition |
| --- | --- |
| `post_pre_gain` | post score minus pre score. |
| `retention_post_drift` | retention score minus post score. |
| `support_acceptance_rate` | accepted intervention traces / recommended traces. |
| `annotation_density` | annotations per section page view. |
| `quote_overlap_degree` | number of peers with same quote hash in a section. |
| `artifact_revision_quality` | 0-16 rubric score from artifact trace. |
| `calibration_error` | absolute confidence-performance mismatch or ECE depending on analysis level. |
