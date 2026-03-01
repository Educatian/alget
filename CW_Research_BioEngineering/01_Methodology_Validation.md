# Cognitive Walkthrough Methodology Validation Report

## ALGET Intelligent Textbook Prototype Evaluation

---

## 1. Research Question

> **"Is it methodologically sound to conduct a Cognitive Walkthrough (CW) for the ALGET Intelligent Textbook prototype using a 5-expert panel?"**

**Conclusion: ✅ Yes** — Validated by the following literature review.

---

## 2. Literature Review Summary

### 2.1 Number of Experts: 3–5 is the Standard

| Reference | Detail | Implication |
|-----------|--------|-------------|
| **Wharton et al. (1994)** | Authors of the original CW method suggest a basic protocol where 3–5 UX experts evaluate the interface independently and then aggregate results. | 5 experts is the upper bound and the optimal number to capture diverse perspectives without redundancy. |
| **Nielsen (1994)** — Heuristic Evaluation | Finding 75–80% of usability problems requires 3 "double experts" (UX + domain) or 5 regular UX experts. | The same logic applies to CW; 5 evaluators provide an optimal issue discovery rate. |
| **NN/g Workshop Method** | Validates both team CWs (2–5 working together) and individual CWs (3–5 working independently then consolidating). | The independent-then-consolidated approach is better suited for academic reporting (enables inter-rater analysis). |

### 2.2 Suitability of CW for e-Learning/Educational Technology

| Reference | Detail |
|-----------|--------|
| **Blackmon et al. (2002)** — Cognitive Walkthrough for the Web (CWW) | Expanded CW for web/exploratory systems. Added "Information Scent" evaluation using LSA. Since ALGET is web-based, incorporating the CWW Nav/Search perspective is highly appropriate. |
| **Benson et al. (2002)** | Expanded Nielsen's 10 heuristics into 15 specifically for e-learning environments. Added criteria for clear learning goals, educational feedback, and learning pathways. → Justifies adding "Learning Add-on (L1–L3)" questions to the standard CW. |
| **Ssemugabi & De Villiers (2007)** | Argued that e-learning usability evaluation must combine "general usability" with "pedagogical usability." → Directly supports this study's dual framework of CW-Q1~Q4 + L1~L3. |

### 2.3 Why CW is Ideal for the Intelligent Textbook

| Characteristic | CW Suitability |
|----------------|----------------|
| **Evaluating Learnability for Novices** (Core aim of CW) | ✅ Perfect match |
| **Prototype Stage Evaluation** (No real users required) | ✅ CW is the most cost-effective method for prototypes and mockups |
| **Multi-Agent Interaction** (Tutor/Janine/Engineer) | ✅ CW's step-by-step analysis is uniquely suited to evaluate complex conversational flows |
| **Adaptive Features** (Branching pathways) | ✅ Can explicitly design branching scenarios per task |

---

## 3. Extension of the CW Design for this Study

### 3.1 Standard CW 4 Questions (Wharton et al., 1994)

| Code | Question | Meaning |
|------|----------|---------|
| **CW-Q1** | Will the user try to achieve the right effect? | **Goal**: Is the user forming the correct goal? |
| **CW-Q2** | Will the user notice that the correct action is available? | **Find**: Can they see the right button/action? |
| **CW-Q3** | Will the user associate the correct action with the desired effect? | **Understand**: Do they understand what the action will do? |
| **CW-Q4** | If the correct action is performed, will the user see that progress is being made? | **Feedback**: Is the system feedback clear? |

### 3.2 Learning Add-ons (e-learning extension, based on Benson/Ssemugabi)

| Code | Question | Rationale |
|------|----------|-----------|
| **L1** | Are the learning objectives/concepts clearly visible? | Educational systems must make "what is being learned" explicit in the UI. |
| **L2** | Does the feedback explain "why this is incorrect" or "what to do next"? | Educational value of formative feedback. |
| **L3** | Does the interface naturally guide the learner to the next learning action? | Continuity of the learning pathway and support for self-regulated learning. |

### 3.3 Severity Scale (Nielsen/NN/g, 0–4)

| Rating | Meaning | Criteria |
|--------|---------|----------|
| 0 | None | Not a usability/learning problem. |
| 1 | Cosmetic | Fix if there is extra time/budget. |
| 2 | Minor | Low priority. Causes slight hesitation. |
| 3 | Major | High priority. Disrupts the learning flow. |
| 4 | Critical | Must fix before release. Prevents learning entirely. |

---

## 4. Recommended Expert Panel Composition (5 Members)

Following the "Double Expert" principle to maximize discovery rate:

| ID | Expert Type | Primary Focus Area | Role Description |
|----|-------------|--------------------|------------------|
| E1 | **UX/HCI Expert** | Interface usability, information architecture | Traditional usability focus (CW-Q1~Q4) |
| E2 | **Learning Sciences / Instructional Designer** | Pedagogical strategies, feedback design | Focuses heavily on Learning Add-ons (L1~L3, L4~L5) |
| E3 | **Domain SME (Mechanical/Bio-Design)** | Content accuracy, aerodynamic models | Verifies academic correctness of AI outputs |
| E4 | **EdTech/AI Systems Expert** | Adaptive logic, conversational UI pacing | Evaluates the "intelligence" of the system |
| E5 | **Target Learner Rep / Junior Engineer** | Digital literacy, motivation | Represents the intended "Novice" baseline |

> **Note**: E5 is not strictly an "expert", but is justified as a proxy for the Novice perspective (an alternative to Wharton's "evaluator simulating the novice" approach).

---

## 5. Operational Protocol: Independent Eval → Consolidation

### Phase 1: Independent Evaluation (1–2 hours per expert)

- Each expert receives the **exact same Task Set and Step Sheet**.
- Evaluates the system independently.
- Scores severity independently.

### Phase 2: Consolidation Session (1–2 hours, led by Coordinator)

- Coordinator pre-aggregates the 5 sheets.
- Group discusses any Disagreements (Score delta $\ge$ 2).
- Final priority is calculated: **Priority = Avg Severity $\times$ # Experts Flagged**

### Phase 3: Reporting

- Complete consolidation matrix.
- Categorize fixes into Quick Wins vs. Structural Fixes.
- Final research report write-up.

---

## 6. Key References

1. Wharton, C., Rieman, J., Lewis, C., & Polson, P. (1994). *The cognitive walkthrough method: A practitioner's guide.* In Nielsen, J. & Mack, R.L. (Eds.), Usability Inspection Methods (pp. 105–140). Wiley.
2. Blackmon, M. H., Polson, P. G., Kitajima, M., & Lewis, C. (2002). *Cognitive Walkthrough for the Web.* Proceedings of CHI 2002. ACM.
3. Benson, L., Elliott, D., Grant, M., Holschuh, D., Kim, B., Kim, H., Lauber, E., Loh, S., & Reeves, T. (2002). *Usability and Instructional Design Heuristics for E-Learning Evaluation.* Proceedings of ED-MEDIA 2002.
4. Ssemugabi, S. & De Villiers, M. R. (2007). *A comparative study of two usability evaluation methods using a web-based e-learning application.* SAICSIT.
5. Nielsen, J. (1994). *Heuristic Evaluation.* In Nielsen, J. & Mack, R.L. (Eds.), Usability Inspection Methods. Wiley.
6. Nielsen, J. (1995). *Severity Ratings for Usability Problems.* NN/g.

---

*Version: v2.0 (English) | Date: 2026-02-28*
