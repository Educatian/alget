# Instructional Design Course Benchmark

This benchmark uses the current local course library as the comparison set. The closest internal comparators are:

- `dynamics`: strongest current benchmark for full learning-loop completeness
- `bio-inspired`: strongest benchmark for narrative richness and embedded scenario/quiz storytelling

The goal is not to mimic either course exactly, but to identify where `inst-design` is structurally weaker than a well-rounded adaptive textbook.

## Course-Level Comparison

| Course | Sections | Avg words | Avg headings | Avg quizzes/section | Avg scenarios/section | Avg diagrams/section | Practice coverage | Misconception coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inst-design | 12 | 919.7 | 6.9 | 1.08 | 1.25 | 1.50 | 0% | 0% |
| dynamics | 9 | 952.7 | 17.3 | 2.00 | 1.00 | 0.44 | 100% | 77.8% |
| bio-inspired | 10 | 856.9 | 6.7 | 1.20 | 1.00 | 1.00 | 0% | 0% |

## What The Comparison Means

`inst-design` is already healthy in three areas:

- Narrative length is competitive with the strongest local course.
- Scenario and quiz embedding is already comparable to other polished courses.
- Visual anchors are present across the course.

`inst-design` is weak in the areas that make the system truly adaptive:

- There are no practice banks in any section.
- There are no misconception banks in any section.
- Several sections have weaker structure or scanability than the course average.

In other words: the course reads well, but it still behaves more like a smart article library than a complete intelligent textbook.

## Section-Level Crawl Table

| Section | Words | Headings | Lists | Quiz count | Scenario count | Diagram count | Practice | Misconceptions | Benchmark reading |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 01/01 | 1431 | 7 | 14 | 1 | 3 | 4 | No | No | Rich flagship section; missing only assessment and remediation assets |
| 01/02 | 1124 | 5 | 9 | 1 | 2 | 2 | No | No | Strong content body; needs practice and misconception coverage |
| 01/03 | 719 | 7 | 19 | 1 | 1 | 1 | No | No | Slightly thin compared with top sections; still structurally healthy |
| 02/01 | 1056 | 7 | 6 | 1 | 1 | 2 | No | No | Good body and structure; missing learning-loop assets |
| 02/02 | 878 | 5 | 5 | 1 | 1 | 2 | No | No | Adequate body; should gain practice and misconception layers |
| 02/03 | 1013 | 5 | 2 | 1 | 1 | 1 | No | No | Content is solid but scanability is weak due to sparse list cues |
| 03/01 | 934 | 8 | 3 | 1 | 1 | 1 | No | No | Near target; mostly lacks practice and misconception assets |
| 04/01 | 827 | 9 | 12 | 1 | 1 | 1 | No | No | Well structured; missing assessment/remediation |
| 05/01 | 774 | 15 | 11 | 2 | 1 | 1 | No | No | Interaction-rich section; should be one of the easiest to complete |
| 06/01 | 763 | 5 | 4 | 1 | 1 | 1 | No | No | Borderline thin, but acceptable once practice/remediation are added |
| 07/01 | 830 | 4 | 9 | 1 | 1 | 1 | No | No | Structurally shallow; highest-priority rewrite inside this course |
| 08/01 | 687 | 6 | 3 | 1 | 1 | 1 | No | No | Thinnest ending section; needs more depth and stronger closure work |

## Where To Reinforce

### Tier 1: Add the missing adaptive-learning layer everywhere

These are course-wide deficits, not isolated defects.

| Need | Scope | Why it matters |
| --- | --- | --- |
| Practice banks | All 12 sections | Without practice, the learner cannot convert conceptual understanding into observable performance |
| Misconception banks | All 12 sections | Without misconception tagging, the support rail has weak evidence for targeted remediation |

### Tier 2: Fix the structurally weakest sections

| Section | Why it stands out | Recommended reinforcement |
| --- | --- | --- |
| 07/01 | Only 4 headings; flagged as high-priority in the audit | Add one more conceptual subdivision, a comparison block, and a practice set tied to WCAG/UDL tradeoffs |
| 08/01 | Thinnest section in the course at 687 words | Expand future-facing cases, add one more scenario branch, and attach a summative practice bank |
| 01/03 | Slightly thin relative to course leaders | Add a short worked comparison or decision rubric so learners can test theory selection |
| 02/03 | Strong word count but poor scanability with only 2 list cues | Add a clearer framework list, method table, and structured practice prompts |

### Tier 3: Convert strong narrative sections into strong instructional sections

These are already content-rich, so the right move is not rewriting them from scratch.

| Section | Current strength | Best next move |
| --- | --- | --- |
| 01/01 | Excellent overview, multiple scenarios, multiple diagrams | Add a theory-selection practice bank and misconception set |
| 02/01 | Clear diagnostic framing | Add case-based practice items with distractors around analysis mistakes |
| 05/01 | Strong interaction density | Add adult-learning misconception patterns and application tasks |

## Recommended Build Order

1. Build a reusable `inst-design` practice template for all sections.
2. Add misconception banks alongside each new practice set.
3. Expand `07/01` and `08/01` before touching already strong sections.
4. After that, backfill `01/03` and `02/03` for clarity and scanability.

## Practical Interpretation

Compared with `dynamics`, `inst-design` does **not** have a narrative problem. It has an assessment and remediation problem.

Compared with `bio-inspired`, `inst-design` already has comparable embedded storytelling and interaction, but it still shares the same biggest weakness:

- no formal practice layer
- no misconception layer

That makes the reinforcement plan straightforward:

- do **not** start with a full rewrite
- start with practice and misconception coverage across the course
- then strengthen the few sections that are structurally thinner than the rest
