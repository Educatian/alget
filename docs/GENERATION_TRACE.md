# Generation Trace Contract

ALGET attaches a `generation_trace` object to learner-facing AI explanations,
reframes, tutor replies, formative assessments, and rubric-based feedback. The
contract is additive: clients that do not understand it can ignore it.

## Required interpretation

- `context_attached` means the model received the listed context. It does not
  mean every generated claim was verified or entailed by that context.
- `claim_level_citations: false` must remain visible in the learner UI until a
  claim-to-source verification pipeline exists.
- `review.status` distinguishes agent or deterministic checks from human review.
- `output_hash` identifies the exact generated payload without writing that
  payload into the generic event log.
- source excerpts may remain in the response and chat-history record, but the
  telemetry event persists source ids and hashes only.

## Version 1 shape

```json
{
  "schema_version": "generation-trace-v1",
  "trace_id": "uuid",
  "generated_at": "ISO-8601",
  "provider": "openrouter",
  "model": "google/gemini-2.5-flash",
  "prompt_version": "bigal-tutor-hint-ladder-v2",
  "output_hash": "sha256",
  "section_id": "course/chapter/section",
  "content_version": "sha256-or-null",
  "source_status": "context_attached",
  "sources": [
    {
      "source_id": "course/chapter/section",
      "kind": "course_section",
      "title": "Section title",
      "locator": "course/chapter/section",
      "excerpt": "Short context excerpt",
      "verification_status": "context_attached"
    }
  ],
  "verification": {
    "status": "context_attached",
    "claim_level_citations": false
  },
  "review": { "status": "not_human_reviewed" },
  "limitations": ["Human-readable limitation"]
}
```

## Current surfaces

- BigAL tutor chat: response trace is saved with section chat history.
- Intel Rail Explain/Reframe: trace is visible beside the generated support.
- Knowledge Check: one trace describes generated items; a separate trace
  describes AI rubric feedback.
- `generation_trace` telemetry persists privacy-safe identifiers, configuration,
  source ids, and hashes for research audits.

## Next contract version

`generation-trace-v2` should only ship when retrieval returns stable source
chunk ids and a verifier can record claim-level entailment. Do not relabel
attached prompt context as a citation to simulate that capability.
