# ALGET CW Expert Step Sheet Template

## Cognitive Walkthrough for Intelligent Textbook

---

## Document Control

| Item | Details |
|------|---------|
| **Study / Course** | Mechanical Engineering (Dynamics & Bio-Design) – ALGET Prototype |
| **Prototype** | _(URL / Figma / Build Link)_ |
| **Version / Date** | v3.0 (English) / 2026-02-28 |
| **Evaluator Name** | |
| **Evaluator ID** | E__ (E1–E5) |
| **Evaluator Type** | ☐ UX/HCI ☐ Learning Sciences ☐ Domain SME (Dynamics/Bio-Design) ☐ EdTech/AI ☐ Target Learner |
| **Evaluation Date** | |
| **Duration** | Start: _____ End: _____ Total: _____ min |

---

## A. Evaluation Assumptions

### A1. Target Learner Persona (Novice Simulation)

> All evaluators must **simulate** the following learner during the walkthrough.

| Attribute | Profile |
|-----------|---------|
| **Learner Type** | Undergraduate Mechanical Engineering Student (2nd year) |
| **Prior Knowledge** | General physics and calculus. (Emphasis on understanding concepts over complex derivations - ALGET Tutor provides scaffolding for advanced Navier-Stokes or aerodynamic theory). |
| **Digital Literacy** | Medium (Used Canvas/LMS; minimal AI tool exposure). |
| **AI Tool Exp.** | Uses ChatGPT occasionally. Never used an 'AI Textbook' |
| **Context** | Doing assignments on Rigid Body Kinematics & Avian Aerodynamics. |
| **Motivation** | Mixed (Curiosity + Deadline pressure). |

### A2. ALGET's "Intelligent" Features Scope

Check the features that are **actually working** in this prototype:

- [x] Hints/Scaffolding — Tutor Agent
- [x] Generative AI Tutor Feedback — Multi-Agent
- [x] Metacognitive Support — Evaluator's reflective feedback
- [x] Interactive Simulation — Simulation Agent
- [ ] Adaptive Learning Pathways
- [ ] Diagnostic Placement
- [ ] Learning Analytics Dashboard

### A3. AI Response Protocol

Evaluation Mode: ☐ Demo Mode (Cached responses)  ☐ Live Mode (Real-time Generation)

- Demo Mode is recommended to ensure all 5 experts evaluate identical outputs for comparability.
- If using Live Mode, note it as a limitation and score the 'AI Output Quality' per task.

---

## B. Task List Summary

> Refer to `04_Task_Definitions.md` for detailed task steps.

| Task ID | Task Name | Core Action |
|---------|-----------|----------|
| T1 | First Session & Dynamics Navigation | Dashboard → Navigate to Section 1.2 |
| T2 | Dynamics Lab Inquiry & AI Interpretation | Prompt input → Interpret Synthesis |
| T3 | Interpreting Scaffolding in Bio-Inspired Design | Use Tutor question + Evaluator critique |
| T4 | Operating Interactive Biomimetic Simulations | Manipulate simulation → Concept link |

---

## C. Severity Scale (0–4)

| Rating | Label | Criteria |
|--------|-------|------|
| **0** | None | Not a problem |
| **1** | Cosmetic | Fix if there is time |
| **2** | Minor | Slight frustration. Learning continues |
| **3** | Major | Learning flow broken. Core feedback missed |
| **4** | Critical | Learning impossible. Severe misconception risk |

---

## D. Step Sheet — Walkthrough Tables

> **Copy and paste the tables below for EACH Task (T1–T4).**

### [Task T__ : _________________________ ]

**Scenario**: _(1-3 sentence scenario)_

**Precondition**: _(Start state)_

**Success Criterion**: _(Definition of success)_

---

#### Step 0: First Impression Capture

Upon loading the first screen, observe for 3 seconds — What do you think this system is for?
Impression Memo: _____________________________________________

#### Step-by-Step Walkthrough Table

| Step # | Learner Sub-goal | Correct UI Action | UI Cues Expected | Likely Wrong Action |
|--------|------------------|-------------------|------------------|---------------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

#### CW Analysis Table (per Step)

| Step# | Q1 Goal(Y/N) | Q2 Find(Y/N) | Q3 Understand(Y/N) | Q4 Feedback(Y/N) | L1 Objectives(Y/N) | L2 Engagement(Y/N) | L3 Cog. Load(Y/N) | L4 Scaffolding(Y/N) |
|-------|--------------|--------------|--------------------|------------------|--------------------|--------------------|-------------------|---------------------|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |

#### Intelligent Features Analysis Table (per Step)

| Step# | L5 Adaptivity(Y/N) | L6 Transparency(Y/N) | L7 Metacog(Y/N)* | L8 Flow(Y/N) |
|-------|--------------------|----------------------|-----------------------|--------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

- **L7 Metacognition (Engineering Context)**: Does the system prompt the user to verify their own boundary conditions, units, or modeling assumptions before giving the answer?

#### Issue Log

| Step# | Issue Description | Wrong Action | Type | Sev(0-4) | Evidence | Fix Idea |
|-------|-------------------|--------------|------|----------|----------|----------|
| | | | | | | |
| | | | | | | |

_Type codes: Goal / Find / Understand / Feedback / Nav-Search / Learning_

#### AI Output Quality (Per Task, if using Live Mode)

| Criteria | Score (1–5) | Notes |
|----------|-------------|-------|
| Relevance | | |
| Accuracy | | |
| Helpfulness| | |
| Latency | ☐Good ☐Slow ☐Very Slow | |

#### Content Accuracy (E3: Domain SME ONLY)

Factual correctness of AI-generated engineering content and biological fidelity:

| Step# | Content Element | Accurate? (Y/N) | Error Description |
|-------|-----------------|-----------------|-------------------|
| | | | |

---

## E. Task Summary (Complete after each task)

### Task T__ Summary

| Item | Details |
|------|------|
| **Fragile Steps (Top 1–3)** | Step **: / Step**: / Step __: |
| **Dominant Breakdown** | ☐ Goal ☐ Find ☐ Understand ☐ Feedback ☐ Nav/Search ☐ Learning |
| **Learnability Risk** | ☐ Low ☐ Medium ☐ High |
| **Priority Fixes (Sev 3–4)** | 1. / 2. / 3. |

---

## F. Overall Summary (Complete at end)

### F1. Recurring Problem Patterns

| Pattern | Relevant Tasks | Frequency |
|---------|-----------|------|
| (e.g., Finding problems recurrent) | | |

### F2. Most Critical Flaw in Learning Support

_(Free text)_

### F3. Issues with AI/Intelligent Features

_(Are the AI recommendations/feedback logical to the learner?)_

### F4. Quick Wins vs Structural Fixes

| Quick Wins (Immediate fix) | Structural Fixes (IA/Logic redesign) |
|----------------------------|--------------------------------------|
| 1. | 1. |

### F5. Additional Comments

_(Free text)_

---
_Thank you for completing this worksheet. Please submit it to the Coordinator._
_Version: v3.0 (English) | Date: 2026-02-28_
