# ALGET CW Severity & Consolidation Guide

## Aggregating the 5-Expert Results

---

## 1. Consolidation Workflow

```
Phase 1 (Independent)        Phase 2 (Consolidation)        Phase 3 (Reporting)
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ E1 Step Sheet│─┐        │ Coordinator  │          │ Final Report │
│ E2 Step Sheet│─┤  ───▶  │ Pre-fills    │  ───▶    │ + Priority   │
│ E3 Step Sheet│─┤        │ Master Table │          │   Matrix     │
│ E4 Step Sheet│─┤        │ + Discussion │          │              │
│ E5 Step Sheet│─┘        └──────────────┘          └──────────────┘
```

---

## 2. Severity Scale Guidelines (0–4)

### 2.1 Basic Definitions

| Rating | Label | General Criteria (Nielsen) | ALGET Learning Context Criteria |
|--------|-------|----------------------------|---------------------------------|
| **0** | None | Not a usability problem | No impact on learning or usage. |
| **1** | Cosmetic | Fix if extra time exists | Visual/wording issue. No impact on learning. |
| **2** | Minor | Low priority. User can bypass | Slight hesitation. Learner can still achieve goals. |
| **3** | Major | High priority. Causes struggle | Disrupts learning flow. Core feedback missed or misunderstood. |
| **4** | Critical | Must fix before release | Prevents learning. Severe misconception risk. |

### 2.2 Decision Matrix

**The distinction between 3 and 4 is the most critical:**

| Question | 3 (Major) | 4 (Critical) |
|----------|-----------|--------------|
| Can the learner recover alone? | Yes, but with effort/delay | No, permanent block |
| Learning goals achieved? | Partially | Not achieved |
| Risk of misconception? | Low | High (System teaches wrong concept) |
| Frequency? | Affects some learners | Affects almost all learners |

---

## 3. Master Consolidation Table (For Coordinator)

### 3.1 Structure

> The master table merges all issues across all tasks.

| Issue ID | Task | Step | Issue Statement | E1 Sev | E2 Sev | E3 Sev | E4 Sev | E5 Sev | #Flagged | Avg Severity | Priority Score | Dominant Type | Agreed Fix |
|----------|------|------|-----------------|--------|--------|--------|--------|--------|----------|--------------|----------------|---------------|------------|
| I-01 | | | | | | | | | /5 | | | | |
| I-02 | | | | | | | | | /5 | | | | |

### 3.2 Priority Score Calculation

```
Priority Score = Average Severity × Number of Experts Flagged (out of 5)
```

| Priority Score | Classification | Required Action |
|----------------|----------------|-----------------|
| 0 – 4.9 | Low | Backlog. Fix if time permits. |
| 5.0 – 9.9 | Medium | Fix in the next iteration cycle. |
| 10.0 – 14.9 | High | Must fix in current iteration. |
| 15.0 – 20.0 | Critical | Fix immediately. Block release. |

**Example**: An issue is flagged by 4 experts, with an average severity of 3.5.
→ Priority = 3.5 $\times$ 4 = **14.0** (High)

---

## 4. Disagreement Resolution Protocol

### 4.1 What Constitutes Disagreement?

- **High Disagreement**: Severity variance $\ge$ 2 for the same issue (e.g., E1 gives 1, E2 gives 4).
- **Partial Detection**: Only 1 or 2 experts flagged an issue.

### 4.2 Resolution Steps (During Session)

1. **High Disagreement Items** $\rightarrow$ Discuss
   - Each expert explains their rationale (2-minute limit).
   - Group aims for consensus. If none, use the median score.

2. **Partial Detection Items** $\rightarrow$ Coordinator Judgement
   - 1 expert only: Log as an "Edge case" with naturally low priority.
   - 2 experts: Add to discussion list to determine if others missed a critical flaw.

### 4.3 Measuring Inter-Rater Agreement (Optional)

For academic reporting validity:

- **Percent Agreement**: Proportion of issues found by multiple vs single experts.
- **Fleiss' Kappa** (Optional): Statistical measure for multiple raters.
  - $\kappa$ < 0.20: Poor
  - 0.21–0.40: Fair
  - 0.41–0.60: Moderate
  - 0.61–0.80: Substantial
  - 0.81–1.00: Almost Perfect

---

## 5. Problem Type Analysis

### 5.1 Type Aggregation

| Problem Type | Code | T1 Count | T2 Count | T3 Count | T4 Count | Total | % |
|--------------|------|----------|----------|----------|----------|-------|---|
| Goal | G | | | | | | |
| Find | F | | | | | | |
| Understand | U | | | | | | |
| Feedback | FB | | | | | | |
| Nav/Search | NS | | | | | | |
| Learning | L | | | | | | |
| **Total** | | | | | | | |

### 5.2 Interpreting Dominant Breakdown Patterns

| Dominant Pattern | Meaning | Implication |
|------------------|---------|-------------|
| **High `Find` problems** | UI labels/locations are counter-intuitive. | Redesign Information Architecture (IA) / labels. |
| **High `Goal` problems** | Learners don't know what they are supposed to do. | Improve onboarding and explicitly state learning objectives. |
| **High `Feedback` problems**| System response is unclear after an action. | Improve AI response structure and system loading states. |
| **High `Learning` problems**| UI works, but educational value is lost. | Re-prompt AI for better pedagogy; fix learning pathway connections. |

---

## 6. Categorizing Fixes (Quick Wins vs. Structural)

### 6.1 Criteria

| Category | Criteria | Examples |
|----------|----------|----------|
| **Quick Win** | Fixable in 1-2 days. Minor code/text changes. | Renaming a button, adding a tooltip, CSS formatting. |
| **Structural Fix** | Requires logic or architectural redesign. | Changing the AI prompting strategy, redesigning the scaffolding flow. |

---

## 7. Report Structure Template

```text
1. Introduction
   1.1 ALGET System Overview
   1.2 Evaluation Goals

2. Method
   2.1 Cognitive Walkthrough Protocol
   2.2 Expert Panel Composition
   2.3 Task Design
   2.4 Learning Add-on Framework (L1–L3)
   2.5 Severity Scale & Priority Calculation

3. Results
   3.1 Issue Summary by Task
   3.2 Problem Type Distribution
   3.3 Severity Distribution
   3.4 Priority Matrix
   3.5 Inter-Rater Agreement

4. Discussion
   4.1 Usability Findings
   4.2 Learning Support Findings (L1–L3)
   4.3 AI/Intelligent Features Findings
   4.4 Limitations (e.g., Live vs Demo mode variations)

5. Recommendations
   5.1 Quick Wins
   5.2 Structural Fixes

6. Appendices
   A. Expert Step Sheets (raw data)
   B. Master Consolidation Table
```

---

*Version: v2.0 (English) | Date: 2026-02-28*
