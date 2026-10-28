# TAMU AI Literacy preview: learning-event codebook

Events from the TAMU preview (static build with `VITE_TAMU_ACCOUNTS=true`) are stored one row per
event in the D1 database `alget-tamu-events` (table `events`, see
`cloudflare/tamu-tutor-worker/migrations/0001_events.sql`). Export them with
`node cloudflare/tamu-tutor-worker/scripts/export_events.mjs --out <folder outside the repo>`, which
writes `events.csv` and `sequences.csv` (one ordered event-name sequence per session, ready for
sequential pattern mining).

## Row fields

| Field | Meaning |
|---|---|
| `student_id` | Roster ID (`TAMU-001` …), taken from the session, never from the browser |
| `session_id` | One per sign-in or page load (UUID) |
| `seq` | Order within the session, from 1; `(session_id, seq)` is unique |
| `client_ts` / `server_ts` | Browser time of the action / time the batch arrived (ISO 8601) |
| `event` | Event name (below) |
| `section_id` | `ai-literacy/CC/SS` when the action belongs to a section |
| `target` | Item, element, clip or concept the action is about |
| `data` | JSON details. Typed text is never stored: text fields record only their length. |

## Events

| Event | Target | Key `data` fields | Emitted by |
|---|---|---|---|
| `session_start` | | user agent, screen, language, timezone | sign-in / page load |
| `session_end` | | `total_events` | sign-out |
| `route_view` | path | `from` | any page change |
| `page_view` | | `referrer_section` | opening a section |
| `tab_hidden` / `tab_visible` | | `path` | leaving / returning to the tab |
| `scroll` | | `depth_percent` (10 % steps) | reading |
| `time_on_task` | | `duration_ms` | leaving a section |
| `click` | element id or label | element, role, label, `repeat_count`, x, y | any click |
| `rage_click` | element | `clicks`, `window_ms` | 3+ clicks on one element within 1 s |
| `input_commit` | field name | choice value, or `{length}` for typed text | form fields |
| `lesson_video_play` / `_pause` / `_finished` | | `video`, `at_s` | lecture clips |
| `video_quiz_shown` | checkpoint id | `video`, `at_s` | in-clip check-in appears |
| `video_quiz_answer` | checkpoint id | `choice`, `correct`, `attempt` | check-in answered |
| `video_quiz_continue` / `video_quiz_skip` | checkpoint id | `attempts` | leaving a check-in |
| `video_quiz_rewatch` | checkpoint id | `from_s`, `attempts` | "Rewatch this part" |
| `inline_quiz_answer` | concept | correctness | inline quiz in the reading |
| `practice_question_shown` | item id | | practice |
| `practice_answer` | item id | correctness, attempt, choice | practice |
| `hint_rung` | item id | `rung`, `kind` (reread / mixup / eliminate / ai), `tutor_status` | hint ladder |
| `stuck_event` | item id | `reason` (2 wrong in a row, idle 90 s) | practice |
| `intervention_shown` | item id | `trigger`, `misconceptions`, `options` | tutor check-in appears |
| `intervention_choice` | item id | `option` (tutor_notes / rewatch / hint / dismiss) | tutor check-in answered |
| `tutor_notes_request` / `_shown` / `_error` / `_jump` | note no. | `origin`, note kinds, `cached` | tutor annotations on the reading |
| `adaptation_recommendation` | review / practice / apply / next | `level` (lowest concept mastery) | next-step panel |
| `adaptation_choice` | recommendation | `choice` | next-step panel |
| `activity_feedback_request` | activity id | `revision`, `words`, `self_met` (criteria the learner ticked) | written activity |
| `activity_feedback_received` | activity id | `revision`, `ready`, `met`, mark kinds, `overclaimed` (calibration) | written activity |
| `activity_feedback_error` | activity id | `error` | written activity |
| `activity_revise_start` | activity id | `after_round` | written activity |
| `highlight_create` / `_update` / `_delete` | highlight id | text and note lengths, tag | annotation |
| `shared_highlight_view` | – | count of classmates, colour-tag counts, start offset, length (first hover per passage per visit) | social annotation |
| `live_class_open` | – | online, in this section, reading anywhere (opening the live class list) | social presence |
| `live_class_jump` | section opened | classmates reading it | social presence |
| `ai_explain` | | `mode`, `status`, `quote_length` | "Explain this passage" |
| `read_aloud` | | `text_length` | read aloud |
| `notebook_open` / `_jump` / `_export` | | scope, tag, counts | notebook |
| `review_start` | | due concepts, item count | spaced review |
| `knowledge_graph_view` / `_node_open` | concept | status, `p_known` | brain network |
| `reader_settings_change` | setting names | new values | "Aa" reader settings |
| `search_result_open` | section | `query_length`, `rank` | search |
| `sim_*` | lab id | lab-specific | 3D labs (energy-sketchbook) |
| `client_error` | kind | message | errors |

Mouse-movement paths (`pointer_path`) are not recorded in the TAMU preview.
