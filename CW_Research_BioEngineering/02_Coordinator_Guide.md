# ALGET CW Coordinator Guide

## Cognitive Walkthrough for Intelligent Textbook Prototyping

---

## Document Control

| Item | Details |
|------|---------|
| **Study / Course** | Mechanical Engineering – ALGET Intelligent Textbook Prototyping |
| **Prototype** | ALGET: Generative Multi-Agent Architecture for Engineering Education |
| **Version / Date** | v3.0 (English) / 2026-02-28 |
| **Coordinator** | _(Insert Name)_ |

---

## 1. Study Objective

To evaluate the **Learnability and Pedagogical Usability** of the ALGET Intelligent Textbook prototype using a 5-expert Cognitive Walkthrough. This study aims to identify and prioritize core usability and learning friction points prior to beta release.

---

## 2. Research Scope: ALGET System Overview

### What is ALGET?

- **Multi-Agent Intelligent Textbook** for Mechanical Engineering
- Teaches via two modules: **Dynamics** and **Bio-Inspired Design**
- Features 4 AI Agents: Orchestrator, Tutor, Evaluator, Simulation Agent

### Core Features (Evaluation Scope)

| Feature | Description | Relevant Agent |
|---------|-------------|----------------|
| **Generative Bio-Design Lab** | Student prompt → AI synthesizes biological theories into engineering application | Orchestrator |
| **Scaffolding** | Socratic questioning for step-by-step guidance | Tutor |
| **Validation & Critique** | Feedback based on Engineering and Physics frameworks | Evaluator |
| **Scenario Modeling** | Learner personas, context analysis, application models | Simulation Agent |
| **Interactive Simulations** | Interactive HTML-based simulations | Simulation Agent |
| **Content Navigation** | Browsing the textbook modules on Bio-Inspired Design | System |

### "Intelligent" Feature Checklist (For Section A2 of Step Sheet)

- [x] Hints / Scaffolding — Tutor Agent
- [x] Generative AI Tutor Feedback — Multi-Agent
- [x] Learning Analytics / Progress Dashboard — _(Verify if in prototype)_
- [ ] Adaptive Learning Pathways — _(Planned for future)_
- [ ] Diagnostic Placement
- [x] Metacognitive Support — Evaluator's reflective feedback

---

## 3. Expert Panel Composition

| ID | Expert Type | Primary Focus Area | Status |
|----|-------------|--------------------|--------|
| E1 | UX/HCI Expert | Interface usability, navigation, IA | ☐ Pending |
| E2 | Learning Sciences / ID | Learning goals, feedback design, CTML | ☐ Pending |
| E3 | Domain SME (Mechanical Engineering) | Content accuracy, aerodynamic theories | ☐ Pending |
| E4 | EdTech / AI Systems | AI feedback logic, scaffolding, latency | ☐ Pending |
| E5 | Target Learner Rep | Novice mindset, motivation, digital literacy | ☐ Pending |

---

## 4. Operational Timeline

### Phase 0: Preparation (Coordinator Tasks)

| Step | Action | Deliverable | Est. Time |
|------|--------|-------------|-----------|
| 0.1 | Verify prototype access (URL / Build) | Confirmed access | 30m |
| 0.2 | Recruit 5 Experts & confirm schedule | Signed Consent Forms | 1 week |
| 0.3 | Finalize Task Definitions (`04_Task_Definitions.md`) | 4 Locked Tasks | 1h |
| 0.4 | Distribute Step Sheets (`03_Expert_Step_Sheet_Enhanced.docx`) | Digital/Print forms | 30m |
| 0.5 | Distribute Expert Briefing (`06_Expert_Briefing.md`) | Email / Slack | 30m |

### Phase 1: Independent Evaluation (Each Expert)

| Step | Action | Est. Time |
|------|--------|-----------|
| 1.1 | Read Briefing & Target Persona | 15m |
| 1.2 | Complete Step Sheet for Tasks 1–4 sequentially (spanning Dynamics & Bio-Design) | 60–90m |
| 1.3 | Write Task Summaries | 15–20m |
| 1.4 | Write Overall Summary | 10m |
| **Total** | | **~1.5–2 hours** |

### Phase 2: Consolidation Session (Coordinator + All Experts)

| Step | Action | Est. Time |
|------|--------|-----------|
| 2.1 | Pre-aggregate 5 sheets into Master Table (Coordinator) | 2h (pre-work) |
| 2.2 | Group discussion to resolve Disagreements (Delta $\ge$ 2) | 60–90m |
| 2.3 | Finalize Priority Scores (AvgSeverity $\times$ #Flagged) | 30m |
| **Total** | | **2h (prep) + 1.5h (live)** |

---

## 5. AI Response Protocol (CRITICAL)

Because ALGET uses Generative AI, responses may vary between evaluations.
The Coordinator must decide and communicate ONE of the following modes to all experts:

**Option A: Demo Mode (Highly Recommended for Research Rigor)**

- The prototype uses a cached/seeded backend.
- All 5 experts evaluate the EXACT same AI outputs.
- Ensures perfect comparability across evaluators.

**Option B: Live Mode (Ecological Validity)**

- Experts query the live AI backend.
- Outputs will vary.
- **Requirement**: Evaluators must fill out the "AI Output Quality" matrix in the Step Sheet to account for response variability and latency.

---

## 6. Coordinator Checklist

### Pre-Evaluation

- [ ] Prototype URL verified and stable.
- [ ] 5 Experts secured + Consent forms signed.
- [ ] AI Protocol (Demo vs Live) decided and communicated.
- [ ] Task Definitions verified (start states and success criteria are perfectly clear).
- [ ] Expert Briefing sent at least 48 hours prior.

### During Evaluation

- [ ] Ensure experts evaluate independently (no cross-talk).
- [ ] Stand by for technical issues. _Do not answer UI questions._ Say: "Please evaluate based only on what the prototype provides."

### Post-Evaluation

- [ ] Collect 5 Step Sheets and 5 Post-Evaluation Surveys.
- [ ] Schedule Consolidation Session.
- [ ] Pre-fill the Master Consolidation Table to identify discussion points.

---

_Version: v2.0 (English) | Date: 2026-02-28_
