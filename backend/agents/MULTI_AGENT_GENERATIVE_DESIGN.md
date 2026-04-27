# ALGET Multi-Agent Generative Architecture

*A design document for the next-tier strengthening of the Generative Intelligent Textbook (GIT) pipeline. Builds on the existing 12-agent system without replacing it.*

---

## Why Generative ≠ Adaptive

Most "intelligent textbooks" stop at adaptive routing — given a learner state, surface a different fixed asset. ALGET's commitment is to **generate new learning material on demand, grounded in canonical content, validated by independent peers, and traceable to its sources**. That requires a different architectural posture: not one large model deciding everything, but a panel of specialists whose outputs check each other.

This document specifies the **Generative Pipeline** — the subset of the multi-agent architecture that produces new learner-facing artifacts (explanations, reframes, practice problems, simulations, illustrations, modules, retention quizzes, worked examples) in response to a specific learner moment.

---

## 1. Existing Pipeline (Recap)

```
┌─────────────────────────────────────────────────────────────────┐
│  OrchestratorAgent  (intent classifier + router)                │
└─────────────────────────────────────────────────────────────────┘
                              │
   ┌────────────┬────────────┬┴───────────┬────────────┬───────────┐
   ▼            ▼            ▼            ▼            ▼           ▼
Biology   Engineering  Validation     Tutor      Activity   Simulation
Agent       Agent        Agent       Agent        Agent       Agent
                              │
                   (Debate Loop, max 2 revisions
                    short-circuited on schema_error)
                              │
   ┌────────────┬────────────┬┴───────────┬────────────┬───────────┐
   ▼            ▼            ▼            ▼            ▼
Evaluator   Illustration  Scaffolding  Assessment   Curriculum
 Agent         Agent         Agent       Agent         Agent
```

All twelve agents:
- Use `agents/config.py` for centralized model + temperature.
- Are validated through `agents/schema_gate.py` (Pydantic models with deterministic fallback).
- Log structured outputs through `loggingService` for research telemetry.

---

## 2. Gaps Identified for the Generative Tier

| Gap | Current Coverage | What's Missing |
|---|---|---|
| **Targeted practice generation** | Static `practice.json` per section | No agent generates new practice tuned to a learner's *current* gap |
| **Just-in-time explanation** | TutorAgent.synthesize doubles for explanation | No dedicated short-form explanation agent for the rail's *Explain* tab |
| **Independent critique** | ValidationAgent only operates inside the bio-inspired debate loop | No general-purpose critique of generative outputs across other courses |
| **Retention-quiz generation** | None | Spaced retrieval needs week-old-content-aware quiz items |
| **Misconception detection** | Embedded in static `*.misconceptions.json`; not generative | No agent that reads a learner response and infers which misconception fired |
| **Worked example pair** | Sweller-grounded but absent | No agent generates a worked example + isomorphic *you-try* pair |

We address gaps 1, 2, and 3 in this iteration; gaps 4-6 are the next iteration.

---

## 3. New Agents (This Iteration)

### 3.1 PracticeGenerationAgent

**Role.** Generates a single targeted practice item *on demand*, using:
- The current section's content (RAG-grounded)
- The learner's mastery snapshot for the section's concepts
- The most-frequent misconception types observed in that learner so far
- The desired Bloom level (passed from orchestrator)

**Input.**
```python
{
    "section_content": str,       # narrative excerpt
    "concept_id": str,            # the gap concept
    "learner_state": dict,        # forgetting_risk, calibration_drift, dominant_misconception
    "bloom_level": str,           # one of: remember, understand, apply, analyze, evaluate, create
    "history": list,
}
```

**Output (Pydantic-gated).**
```python
{
    "stem": str,
    "options": List[{"text": str, "is_correct": bool, "misconception_id": Optional[str]}],
    "concept_id": str,
    "bloom_level": str,
    "explanation": str,           # rationale shown after answer
    "rationale_for_choice": str,  # why these distractors target this learner
}
```

**Why a separate agent.** Practice generation has different prompt commitments than synthesis or scaffolding: the generator must **construct distractors that map to specific misconceptions**, not just plausible wrong answers. Mixing this with TutorAgent.synthesize entangles two different objectives.

### 3.2 ExplanationAgent

**Role.** Produces a *short, plain-language* re-expression of a concept for the IntelRail Explain tab. Distinct from TutorAgent.synthesize, which produces a *cohesive narrative wrap*.

**Input.**
```python
{
    "concept_id": str,
    "section_content": str,
    "learner_state": dict,        # so explanation can address the dominant misconception
    "target_length": str,         # short | medium | long
    "history": list,
}
```

**Output.**
```python
{
    "explanation": str,
    "key_terms": List[str],       # technical terms used; can be Glossary-linked
    "addresses_misconception": Optional[str],
}
```

**Why a separate agent.** The Explain tab's job is *just-in-time clarity*, not synthesis. Mixing it with the TutorAgent leads to over-long, encouragement-heavy outputs that don't fit the rail's UX. ExplanationAgent runs at a slightly cooler temperature (0.5 vs Tutor's 0.7) to favor precision over voice.

### 3.3 CritiqueAgent

**Role.** A general-purpose critique of any generative output, available outside the bio-inspired debate loop. Acts as a second opinion on PracticeGenerationAgent and ExplanationAgent outputs (and any other generative agent that opts in).

**Input.**
```python
{
    "agent_name": str,            # who produced the output
    "output_payload": dict,       # the generated artifact
    "ground_truth_excerpts": List[str],   # RAG'd sources
    "rubric": str,                # what to check (factuality, level-appropriateness, alignment)
}
```

**Output.**
```python
{
    "passes": bool,
    "score": int,                 # 0-10
    "issues": List[str],
    "suggested_revisions": List[str],
}
```

**Why a separate agent.** ValidationAgent is specialized for biology↔engineering analogical fidelity. CritiqueAgent generalizes the second-opinion pattern: any course, any artifact. This is what makes the architecture *systematically* defensible against single-LLM hallucination, not only in bio-inspired debate.

---

## 4. Orchestrator Changes

### 4.1 New intent flows

Two new intent paths added to OrchestratorAgent:

- **intent="practice"** — calls PracticeGenerationAgent with learner state. Optionally pipes the output through CritiqueAgent for a quality check before return.
- **intent="explain"** — calls ExplanationAgent. Optionally pipes through CritiqueAgent.

These join the existing intents (learn, evaluate, brainstorm, illustrate, simulate, help) and use the same response normalization in `server.py`.

### 4.2 Critique-as-quality-gate

For high-stakes generative outputs, the orchestrator runs CritiqueAgent as a quality gate:

```
PracticeGenerationAgent → CritiqueAgent.review
                              │
                  ┌──────────┴───────────┐
                  ▼                       ▼
              passes=True              passes=False
                  │                       │
              return                   regenerate (max 1 attempt)
                                          │
                                  use whichever has higher score
```

This is the same shape as the existing Biology→Engineering→Validation debate loop, generalized.

### 4.3 No regression to existing pipeline

The existing 12 agents are unchanged. The new agents are *additions*. The bio-inspired debate loop still runs ValidationAgent (specialized to bio↔eng analogical fidelity). The new CritiqueAgent runs in parallel for non-bio generative outputs.

---

## 5. Schema-Gate Models

Three new Pydantic models in `agents/schema_gate.py`:

```python
class PracticeOption(BaseModel):
    text: str
    is_correct: bool
    misconception_id: Optional[str] = None


class PracticeOutput(BaseModel):
    stem: str
    options: List[PracticeOption]
    concept_id: str
    bloom_level: str
    explanation: str
    rationale_for_choice: str = ""


class ExplanationOutput(BaseModel):
    explanation: str
    key_terms: List[str] = Field(default_factory=list)
    addresses_misconception: Optional[str] = None


class CritiqueOutput(BaseModel):
    passes: bool
    score: conint(ge=0, le=10)
    issues: List[str] = Field(default_factory=list)
    suggested_revisions: List[str] = Field(default_factory=list)
```

Each has a deterministic fallback dict for use when the agent fails (auth error, JSON parse error, validation error). This preserves the architecture's resilience guarantee: a generative pipeline failure produces a structured no-op, never a crash.

---

## 6. Why This Strengthens "Generative" Specifically

The strengthening is not about more agents for their own sake. It addresses three specific weaknesses in the prior generative posture:

**Weakness 1: Practice generation was static.** Adaptive routing chose from a fixed bank. New PracticeGenerationAgent generates *novel* items per learner gap, with misconception-aware distractors. This closes the loop between mastery diagnosis and practice content — the textbook can now write the question that exposes exactly what you don't know.

**Weakness 2: Explain tab was not first-class.** TutorAgent doubled for it. Outputs were too long and too narrative-shaped for the IntelRail's UX. ExplanationAgent is purpose-built for *short, plain, just-in-time* clarification, with explicit awareness of which misconception the learner is operating under.

**Weakness 3: Quality control was bio-inspired-only.** ValidationAgent's debate loop only fired for bio-inspired course intents. CritiqueAgent generalizes the pattern: any generative artifact in any course can be reviewed by an independent agent before reaching the learner.

The combined effect is that **every generative output** the textbook produces — practice item, explanation, simulation, illustration, narrative — passes through at least one independent critique before reaching the learner. This is the architectural property that makes ALGET *generatively* defensible, not only adaptively.

---

## 7. Implementation Sequence

1. ✅ Pydantic models in `schema_gate.py` (this iteration).
2. ✅ `practice_generation_agent.py`, `explanation_agent.py`, `critique_agent.py` (this iteration).
3. ✅ Orchestrator wiring for `intent="practice"` and `intent="explain"` (this iteration).
4. ✅ `agents/config.py` entries for the three new agents (this iteration).
5. Next iteration: RetentionQuizAgent, MisconceptionDetectorAgent, WorkedExamplePairAgent.
6. Next iteration: CritiqueAgent quality-gate wired into all generative outputs (currently only practice + explanation pipe through it).

---

## 8. Telemetry

Each new agent's output is logged through `researchService.evaluateSupportContent` and the `content_audits` table, so generative quality across courses can be tracked over time. The CritiqueAgent's score becomes a research-grade signal of generative reliability — over a cohort, declining critique scores indicate prompt drift or model regression.

---

## 9. Open Questions for Future Iterations

- **When to bypass critique for cost.** Critique adds a Gemini call. For very common patterns, a cached critique may suffice. Investigate.
- **Multi-agent retention scheduling.** Should the spaced-retrieval scheduler itself be agent-driven (a *PacingAgent* that integrates BKT + forgetting curves)? Likely yes; specify next iteration.
- **Cross-course concept threading.** Should PracticeGenerationAgent draw from related concepts in *other* ALGET courses for transfer-effect items? Open.

---

*This document is a living spec. Changes to it must be paired with code changes in `agents/` and a regression test in `test_e2e_orchestrate.py`. The architecture's defense — what makes it research-grade — is that it stays accountable to itself.*
