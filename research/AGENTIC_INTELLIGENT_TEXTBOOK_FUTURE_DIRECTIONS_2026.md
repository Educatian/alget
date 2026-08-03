---
type: research-scan
topic: "Agentic AI intelligent textbooks and instructor-led learning design, 2026-2029"
date: 2026-08-02
n_sources: 10
tier_distribution: {1: 6, 2: 0, 3: 2, 4: 0, 5: 2}
---

# Agentic AI intelligent textbook: 1-3 year direction scan

## Scope and decision rule

This scan asks what should change in an instructor-controlled intelligent textbook over the next one to three years. Sources were selected for direct relevance to higher education, teacher/learner agency, learning outcomes, collaborative agents, learning analytics, and responsible AI governance. A finding is treated as a product requirement only when it is supported by an empirical study, a systematic review/meta-analysis, or an official policy/standards source.

## 1. Strong peer-reviewed sources

1. **Chen and Cheung (2025), Educational Research Review.** A systematic review and meta-analysis of 57 studies (97 estimates) found positive effects of generative AI on academic achievement, affective-motivational outcomes, language skills, and higher-order thinking, but no significant aggregate effect on metacognition. Effects varied with learner, tool, role, rule, and context. **Design implication:** measure transfer, metacognitive calibration, and evidence use separately; do not collapse everything into a single mastery score. https://doi.org/10.1016/j.edurev.2025.100737

2. **Xia et al. (2026), Teaching in Higher Education.** A mixed-methods study found that GenAI supported learning agency and self-regulated learning propensities, while also producing excessive reliance and uncritical reproduction of AI content. **Design implication:** every agent suggestion needs an inspect, accept, modify, reject, and explain path. https://doi.org/10.1080/13562517.2026.2649818

3. **Kahn et al. (2025), Learning, Media and Technology.** A sequential mixed-methods study of university teachers argues that teacher agency is relational: teachers and students need shared rules and dialogue when LLMs change how knowledge is produced. **Design implication:** instructor policy, source approval, and learner AI-use disclosure belong in the same course workflow. https://doi.org/10.1080/17439884.2025.2575993

4. **de Araujo et al. (2025), International Journal of Artificial Intelligence in Education.** A collaborative conversational agent increased several productive dialogue moves but did not improve knowledge acquisition in the study; the authors warn that timing and agent presence can add cognitive load. **Design implication:** social cues must be sparse, contextual, learner-dismissible, and evaluated on learning outcomes rather than message counts. https://doi.org/10.1007/s40593-025-00469-7

5. **Röhl (2025), British Journal of Sociology of Education.** The paper frames algorithmic teaching tools as redistributing professional agency across task selection, assessment, and diagnostics. **Design implication:** the system may recommend and stage work, but release, grading, communication, and policy changes remain human actions with an audit trail. https://doi.org/10.1080/01425692.2025.2495625

6. **Buntins et al. (2026), British Journal of Educational Technology invited commentary.** Agency is described as a system property of human-AI configurations, observable in micro-decisions such as accepting, transforming, or rejecting an AI output. **Design implication:** log those decisions as first-class evidence, not only model prompts and final answers. https://doi.org/10.1111/bjet.70060

## 2. Official policy and standards sources

7. **OECD (2025), Education Spotlights No. 20.** The policy paper asks education systems to reassess which competencies, learning experiences, and content ordering remain valuable when AI capabilities change quickly. **Design implication:** the textbook should foreground judgment, verification, reflection, and transfer, while letting instructors revise objectives and activity rules without rebuilding the platform. https://doi.org/10.1787/ca56c7d6-en

8. **OECD (2026), Digital Education Outlook 2026.** The outlook presents teacher-AI teaming as a bounded continuum and warns against unreviewed AI feedback becoming a substitute for teacher judgment. **Design implication:** expose autonomy level, approval owner, evidence, and rollback at the point of action. https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-digital-education-outlook-2026_940e0dd8/062a7394-en.pdf

9. **European Commission (2026), Guidelines on the ethical use of AI and data in teaching and learning for educators.** The updated guidance responds to the growth of GenAI and the EU AI Act, emphasizing ethical use, data protection, high-quality content, and educator capacity. **Design implication:** privacy, licensing, accessibility, and human review must be visible in the authoring and release path rather than hidden in documentation. https://op.europa.eu/en/publication-detail/-/publication/f692aa0b-17a7-11f1-8870-01aa75ed71a1/

10. **UNESCO (2023/2024 edition), Guidance for generative AI in education and research.** The guidance identifies risks to agency, inclusion, equity, privacy, cultural and linguistic diversity, source reliability, and copyright. **Design implication:** retain learner choice, minimize data, show provenance and licence, and provide a non-AI path for every essential learning action. https://unesdoc.unesco.org/ark:/48223/pf0000386693

## 3. Emerging evidence (preprints, not peer-reviewed)

- **Generative Co-Learners (2024).** Proposes AI co-learners to support cognitive and social presence in asynchronous learning. Useful as a design hypothesis for passive peer cues, not as evidence of learning impact. https://arxiv.org/abs/2410.04365
- **GenAIReading (2025).** Explores LLM- and image-generation-augmented interactive digital textbooks. Useful for multimodal and dual-coding hypotheses, but remains a preprint. https://arxiv.org/abs/2503.07463

## 4. 1-3 year trajectory for ALGET

### 0-12 months: governed, evidence-visible course generation

- Source import produces a shadow draft, section-level references, licence metadata, runtime package, and quality warnings.
- Instructor approval is a true release gate; learner visibility, grading, messaging, enrollment, and policy changes cannot be triggered by a model response.
- The reader exposes an optional Evidence Trail with canonical source links and an honest distinction between attached context and claim-level verification.
- Analytics separates mastery, metacognitive calibration, evidence alignment, transfer, and social interaction. Empty evidence remains an empty state.

### 12-24 months: adaptive teacher-AI teaming

- Agents propose bounded plans and interventions from course-scoped evidence, then wait for the accountable instructor or learner to approve.
- Each suggestion supports accept/modify/reject plus a short rationale; decisions become part of the learner/instructor evidence ledger.
- Policy controls expose autonomy level, intervention ceilings, cooldowns, emergency pause, and rollback.
- Social learning uses low-frequency talk moves and passive cues. A cue is only successful when it leads to evidence comparison or improved reasoning, not because a learner clicked it.

### 24-36 months: interoperable, longitudinal learning infrastructure

- Use LTI 1.3, OneRoster, Caliper, and CASE mappings so course objectives, roster scope, and event semantics survive institutional integration.
- Run preregistered, course-level evaluations with comparison conditions and delayed transfer measures. Report harms and null effects, not just engagement.
- Add a teacher-AI capability registry, model/version provenance, cost and latency budgets, incident review, and deletion/export controls.
- Support co-design with instructors and learners so the social and ethical rules are local to a course rather than imposed by a generic chatbot.

## 5. Product decisions now fixed

| Finding | Product rule | Current implementation evidence |
|---|---|---|
| Agency is visible in micro-decisions | Suggestions are reviewable and never silently execute | `docs/AGENTIC_LMS_RUNTIME.md`, `frontend/src/lib/agenticLmsService.js` |
| RAG context is not claim verification | Show attached context and source links without overstating certainty | `frontend/src/components/EvidenceTrail.jsx`, `frontend/src/components/GenerationTrace.jsx` |
| Social agents can add cognitive load | Keep cues passive, contextual, dismissible, and optional | `frontend/src/components/SocialLearningRail.jsx`, `frontend/src/pages/BookLayout.jsx` |
| Teacher agency is relational | Course policy and source approval are instructor-owned | `frontend/src/components/FacultyPartnershipWorkspace.jsx`, Supabase faculty migrations |
| Outcomes are heterogeneous | Keep metacognition, evidence alignment, and mastery as separate signals | `frontend/src/pages/AnalyticsDashboard.jsx`, research service |
| Institutional scale needs durable governance | Persist runtime packages, decision ledgers, model versions, privacy requests, incidents, and evaluation manifests; expose Caliper/OneRoster/CASE contracts | `backend/roadmap_runtime.py`, `cloudflare/llm-proxy/src/index.js`, `supabase/migrations/20260802000000_agentic_roadmap_contracts.sql` |

## 6. Verification boundary

The repository tests prove deterministic contracts and UI behavior. They do **not** prove causal learning gains, institutional interoperability, or that a live Supabase project has applied every migration. Those claims require an authenticated pilot, a migration smoke check, and a preregistered evaluation. The release decision must keep those external gates explicit.
