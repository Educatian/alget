# ALGET Advanced Orchestration Decision

Date: 2026-05-05

## Decision

Do **not** add LangChain as a broad dependency right now.

The A+ path is to keep ALGET's existing FastAPI + specialist-agent architecture and add targeted advanced orchestration where it directly improves research quality:

1. Typed state transitions for multi-agent support workflows.
2. Evidence-aware adaptive recommendation.
3. Retrieval evaluation and reranking.
4. Tool-call traces that are reproducible enough for a methods section.

## Why LangChain Is Not the Immediate Fix

ALGET already has:

- A FastAPI backend.
- A multi-agent orchestration layer.
- RAG service hooks.
- Supabase persistence and RLS.
- Research telemetry, assignment, RCT views, item responses, and intervention traces.

Adding LangChain only as a wrapper would increase dependency surface without solving the current A+ blockers:

- It would not create pilot/RCT evidence.
- It would not validate learner artifacts semantically.
- It would not make the Perusall-like layer competitive by itself.
- It would not guarantee better adaptive policy quality than the current explicit scoring code.

## What To Add Instead

### Immediate Priority: Evidence-Informed Recommender

Implemented in this pass:

- Perusall-style annotation events now write adaptive signals.
- ArtifactStudio traces now write adaptive signals.
- `AdaptiveTelemetrySummary` now includes annotation and artifact evidence.
- `build_adaptive_recommendation()` now scores annotation friction, annotation momentum, artifact quality, artifact completeness, and artifact gap.
- The strict QA gate now requires the annotation/artifact recommender loop.

### Next Advanced Layer

If the system needs more formal orchestration, use a graph/state-machine layer rather than generic chains:

- State nodes: `read`, `annotate`, `diagnose`, `artifact_trace`, `recommend`, `support`, `revise`, `evaluate`.
- Edges: evidence-triggered transitions with explicit guards.
- Outputs: event-level state transition logs for reproducibility.

This can be implemented locally first. A LangGraph-style dependency becomes useful only if local orchestration becomes hard to maintain.

### Retrieval Layer

A LlamaIndex/LangChain retriever is justified only after adding:

- Retrieval test sets.
- Citation faithfulness checks.
- Reranking metrics.
- Source coverage reporting.

Until then, improving the current `rag_service.py` evaluation harness is higher value than swapping frameworks.

## A+ Criterion

The project should add a new orchestration framework only when it improves one of these measurable outcomes:

- Better recommendation correctness against labeled traces.
- Better retrieval precision/faithfulness.
- Lower support-content leakage or hallucination.
- More reproducible intervention state transitions.
- Better pilot outcomes for learning, calibration, or artifact revision quality.

Framework adoption is not a publication claim. The claim must remain outcome- and evidence-centered.

