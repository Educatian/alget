# Backend Agent Architecture Handoff

## Overview

The `OrchestratorAgent` (`backend/agents/orchestrator.py`) has been completely refactored from a static pipeline into a dynamic **Intent-Based Router**.

Other agents (such as Frontend integration agents or Testing agents) should be aware of this new architecture when interacting with the `/orchestrate` endpoint.

> **IMPORTANT**: All agents and developers should read `SYSTEM_DESIGN_HISTORY.md` to understand the full evolutionary context of ALGET, including the pivot to Bio-Inspired Design, the Orchestrator intent routing, the iterative debate loops, and the Hybrid Context Memory Architecture.

## The Synergy Workflow

When a query is passed to `OrchestratorAgent.orchestrate(query, grade_level, interest, current_bio_context)`, the Orchestrator first classifies the intent of the user using an LLM call.

Based on the intent, it routes the execution to one of three synergized pipelines:

### 1. Intent: "learn" (Default)

**Trigger:** The student is asking a question about how something works, or wants to learn a new concept.
**Pipeline Execution:**

1. `BiologyAgent`: Extracts the fundamental biological mechanism.
2. `EngineeringAgent`: Translates the biology into an engineering application based on the student's interest.
3. `ValidationAgent`: Cross-checks the engineering application against the biological facts for accuracy, using a strict, analytical configuration (temperature=0.3).
4. `TutorAgent`: Synthesizes the results from the previous 3 agents into a cohesive, encouraging pedagogical response.
**Returns:** A dictionary containing `biology_context`, `engineering_application`, `validation_critique` (which contains `is_valid`, `score`, `critique`, `suggestions`), and `summary`.

**Validation UI Note:** If `validation_critique["is_valid"]` is false, frontend agents might want to visually flag the engineering application or show the `suggestions` to the user to highlight the AI's correction process.

### 2. Intent: "evaluate"

**Trigger:** The student is proposing a design, sharing an idea, or asking for feedback on their work.
**Pipeline Execution:**

- `EvaluatorAgent`: Assesses the design using the Janine Benyus (Biomimicry) persona.
**Returns:** A dictionary containing the `evaluation` (strengths, areas for improvement, janine_feedback, score).

### 3. Intent: "brainstorm"

**Trigger:** The student is asking for ideas, activities, or ways to brainstorm.
**Pipeline Execution:**

- `ActivityAgent`: Generates lateral thinking prompts and guiding questions based on the biological context.
**Returns:** A dictionary containing the `activity` (title, prompt, guiding questions, example idea).

## Important Implementation Details for Other Agents

- **JSON Structured Data:** All specialized sub-agents (`BiologyAgent`, `EngineeringAgent`, etc.) have been configured to return **structured JSON** to the Orchestrator.
- **Error Handling:** If the Gemini API fails or returns malformed JSON, the agents will return a dictionary with an `"error"` key. The frontend/API layer should gracefully handle this.
- **Dependencies:** All agents depend on the `google-genai` SDK and the `gemini-2.0-flash` model.

## Next Recommended Steps for UI/Frontend Agents

- Update the `server.py` FastAPI endpoints to handle the new `current_bio_context` parameter and pass it to the Orchestrator.
- Update the Streamlit/React frontend to dynamically render the UI based on the `intent` returned in the Orchestrator's response dictionary. (e.g. show a "Janine Benyus Feedback" card if intent is `evaluate`).
