# ALGET CW Expert Briefing

## Please Read Before Starting the Evaluation

---

## 1. Study Introduction

### Title

Evaluating the Learnability and Pedagogical Usability of the ALGET Intelligent Textbook Prototype

### Context

- **Course**: Mechanical Engineering
- **Project**: Intelligent Textbook Prototyping
- **Target**: ALGET (A Generative Multi-Agent Architecture for Engineering Education)

### Prototype Characteristics

This version of ALGET includes two specialized modules for Mechanical Engineering:

1. **Module A (Dynamics)**: Focuses on foundational rigid body mechanics with light biological analogies (e.g., calculating forces using a cheetah's kinematics).
2. **Module B (Bio-Inspired Design)**: Highly focused on transforming deep biological properties (e.g., owl wing aeroacoustics) into complex engineering applications (e.g., drone design).

It uses 4 AI Agents:

- **Orchestrator**: Evaluates intent and routes prompts.
- **Tutor**: Provides Socratic scaffolding and hints.
- **Evaluator**: Evaluates engineering designs against aerodynamic/physics principles.
- **Simulation Agent**: Handles interactive simulations and multimedia content.

---

## 2. What is a Cognitive Walkthrough?

The **Cognitive Walkthrough (CW)** is an inspection method where **experts simulate a novice learner** walking through an interface step-by-step.

### Core Principles

- You do NOT use actual users; you use your expertise to simulate their cognition.
- At every step, you answer 4 core questions (CW-Q1~Q4) with "Y/N" + Rationale.
- For this educational system, we add **8 Learning Experience & Intelligent Features Add-on questions (L1~L8)**.

### The 4 CW Questions

| Code | Question | Layman's Translation |
|------|----------|----------------------|
| **Q1 (Goal)** | Will the user try to achieve the right effect? | "Do they know what they are supposed to do?" |
| **Q2 (Find)** | Will the user notice that the correct action is available? | "Can they see the button/link?" |
| **Q3 (Understand)** | Will the user associate the correct action with the desired effect? | "Do they know what clicking this will do?" |
| **Q4 (Feedback)** | If the correct action is performed, will the user see progress? | "Do they get clear confirmation it worked?" |

### The 8 LXD & Intelligent Features Add-on Questions (Where Applicable)

| Code | Dimension | Question | Layman's Translation |
|------|-----------|----------|----------------------|
| **L1** | LXD: Objectives | Are the learning goals clearly visible? | "Is it obvious what concept is being taught?" |
| **L2** | LXD: Engagement | Does the step promote active cognitive processing? | "Does the user actually have to think, or just click?" |
| **L3** | LXD: Cog. Load | Is the amount of information appropriate? | "Is the screen/feedback overwhelming their capacity?" |
| **L4** | LXD: Scaffolding | Are hints/supports provided contextually? | "Does it guide them without just giving away the answer?" |
| **L5** | Intel: Adaptivity | Does feedback specifically address user input? | "Is the AI actually personalizing the response to them?" |
| **L6** | Intel: Transparency| Is the AI's reasoning logical and transparent? | "Can the learner trust/understand why the AI said that?" |
| **L7** | Intel: Metacognition| Does the system prompt learner reflection? | "Does it make them think about their own understanding?" |
| **L8** | Intel: Flow | Does it naturally connect to the next action? | "Does the system pedagogical flow guide their next step?" |

---

## 3. Your Role

You must simulate the **Target Learner Persona** below.

### Target Learner Persona

| Attribute | Profile |
|-----------|---------|
| **Learner Type** | Undergraduate Mechanical Engineering Student (2nd year) |
| **Prior Knowledge** | General physics and calculus. No exposure to formal biological systems or aerodynamics. |
| **Digital Literacy** | Medium (Used canvas/LMS; minimal AI tool exposure). |
| **AI Experience** | Has tried ChatGPT, but has never used an "AI Textbook." |
| **Context** | Doing a homework assignment on Avian Aerodynamics. |
| **Motivation** | Mixed (Curiosity + Deadline pressure). |

> **CRUCIAL**: Do not evaluate based on what *you* know. Always ask: "Would *this student* know what to do here?"

---

## 4. Evaluation Procedure

### Estimated Time: 1.5 – 2 hours

| Step | Action | Est. Time |
|------|--------|-----------|
| 1 | Read this briefing & fill out the Background Survey | 15m |
| 2 | Start the prototype (URL/Localhost) | 5m |
| 3 | Walk through Tasks T1–T4 using the Step Sheet | 60–90m |
| 4 | Complete the inter-task Summaries | 15m |
| 5 | Complete the Overall Summary & Post-Eval Survey | 15m |

### Golden Rules

1. **Work Independently**: Do not discuss issues with other evaluators yet.
2. **Follow the Happy Path**: The "Correct UI Action" is pre-filled. Evaluate if the student would naturally take that path.
3. **Log Issues**: If "No" to any question, log it in the Issue Log. Assign a Severity (0–4).
4. **Provide Rationale**: Don't just write "Y/N". Provide a 1-sentence "Why".
5. **Screenshots**: Helpful for reference during the consolidation meeting.

---

## 5. Severity Scale (0–4)

| Rating | Label | Criteria |
|--------|-------|----------|
| **0** | None | Not a problem. |
| **1** | Cosmetic | Fix if there is time. |
| **2** | Minor | Slight frustration, but learning continues. |
| **3** | Major | Breaks the learning flow. Critical information missed. |
| **4** | Critical | Prevents task completion. Student gives up or learns the wrong thing. |

> **Pro Tip**: The difference between a 3 and 4 is often "Could this student recover on their own, or do they need external help?"

---

## 6. The 4 Tasks

| Task | Core Action |
|------|-------------|
| **T1** | Dashboard $\rightarrow$ Navigate to Section 2.1 |
| **T2** | Input query in Bio-Design Lab $\rightarrow$ Interpret Synthesized Output |
| **T3** | Read Tutor Scaffolding & AI Critique $\rightarrow$ Determine next step |
| **T4** | Manipulate Interactive Simulation $\rightarrow$ Connect to theory |

---

## 7. Submission Details

- **Submit To**: Coordinator (_________________________)
- **Deadline**: ____________
- **Format**: Completed Word Document / Excel Sheet

**Thank you! Your expert evaluation is critical for ensuring ALGET is pedagogically effective.**

---

*Version: v3.0 (English) | Date: 2026-02-28*
