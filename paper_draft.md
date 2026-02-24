# ALGET: A Generative Multi-Agent Architecture for Bio-Inspired Engineering Education

## Abstract

This paper presents the theoretical foundation, architecture, and decision-making process for the ALGET system, a generative AI platform designed for teaching Statics and Dynamics to Mechanical Engineering students through the lens of Bio-Inspired Design (Biomimicry). We introduce a novel multi-agent orchestrated framework, wherein specialized AI agents—including the Orchestrator, Tutor, Evaluator (Janine), and Engineer—collaborate to provide a cohesive learning experience. We justify this architecture through a tripartite research problem linking Cybernetics, the Society of Mind, and the Memex, and we detail the system-level debates that finalized ALGET's stateful context memory architecture.

## 1. Introduction

As generative AI advances, single-agent systems struggle to maintain pedagogical alignment, engineering rigor, and structural consistency simultaneously. Mathematical hallucinations and the loss of conversational context over time frequently derail complex STEM tutoring. The ALGET system leverages a multi-agent framework to solve these challenges. By separating concerns, ALGET ensures that deep biomimicry principles, represented by the "Janine" persona, are balanced against practical engineering application (Engineer) and student scaffolding (Tutor).

## 2. Theoretical Background and Literature Review

The ALGET project represents a significant departure from traditional Generative AI tutoring systems. To fully understand its justification, we must trace the philosophical lineage of its core pillars, which form a self-sustaining **Tripartite Research Problem**.

### 2.1 Vertex A: Bio-Inspired Design (The Epistemological Context)

**Deep Roots**: *General Systems Theory* (Ludwig von Bertalanffy) and *Cybernetics* (Norbert Wiener).
Before Janine Benyus codified Biomimicry into "Life's Principles," Systems Theory and Cybernetics shattered the ontological wall between "natural organisms" and "artificial machines." Wiener demonstrated that both biological and mechanical systems are governed by the same feedback loops and force mechanics.
**The ALGET Application**: This equivalence allows ALGET to computationally map biology to engineering. The system teaches engineering through biology because, at a cybernetic level, they are the exact same systems of force and adaptation.

### 2.2 Vertex B: Multi-Agent AI (The Pedagogical Engine)

**Deep Roots**: *The Society of Mind* (Marvin Minsky) and *Constructivism* (Lev Vygotsky).
Marvin Minsky theorized that human intelligence is an emergent property of a "Society of Mind"—countless specialized agents negotiating with one another. Vygotsky added that learning is a fundamentally social, negotiated process occurring in the Zone of Proximal Development.
**The ALGET Application**: Single-agent LLMs fail pedagogically because they act as monolithic oracles, contradicting both Minsky and Vygotsky. ALGET is a computational realization of the Society of Mind. True intelligent tutoring emerges from internal, hidden debate between the `ValidationAgent` critiquing the `EngineeringAgent`, and the `OrchestratorAgent` dynamically routing to the `ScaffoldingAgent` to ensure Socratic questioning rather than direct answer-giving.

### 2.3 Vertex C: The Intelligent Textbook (The Structural Anchor)

**Deep Roots**: *The Memex* (Vannevar Bush) and *Cognitive Theory of Multimedia Learning* (Richard Mayer).
In 1945, Vannevar Bush conceptualized the *Memex*, allowing readers to build non-linear "associative trails" through knowledge. Later, Richard Mayer proved empirically that multimedia must be carefully segmented to reduce extraneous cognitive load.
**The ALGET Application**: The ALGET Intelligent Textbook abandons the static textbook format. It uses Retrieval-Augmented Generation (RAG) and multi-agent generation to forge a personalized "associative trail" between a student's biological interest and the required engineering syllabus.

## 3. Multi-Agent Decision Making: A Case Study

Translating this theoretical framework into a functional architecture required resolving competing agent priorities. We simulated a system-level debate among the ALGET agents regarding the implementation of four key features: Scaffolding, Context Memory, Evaluator Feedback, and OpenStax integration.

### 3.1 Agent Perspectives

- **The Pedagogical Imperative**: The Tutor agent prioritized Socratic Scaffolding to provide immediate guidance when students face impasses.
- **The Bio-Inspired Imperative**: The Evaluator (Janine) emphasized a Multi-turn Feedback loop, arguing that biomimetic abstraction is inherently iterative.
- **The Engineering Imperative**: The Engineer advocated for grounding the system in textbook rigor.

### 3.2 Architecting for State: The Orchestrator's Resolution

The Orchestrator agent identified a critical structural dependency underlying all proposed features: statefulness. Whether conducting multi-turn biomimetic refinements or Socratic scaffolding, the overarching system must possess persistent conversational context.

The developmental priority was determined to be **Context Memory & History Logging**. Without this foundational infrastructure, agents suffer from "amnesia," preventing coherence across extended interactions.

## 4. Designing Context Memory: Round 2 Debate

Following the decision to prioritize Context Memory, a secondary agent simulated debate resolved the architectural implementation strategy among three approaches: Continuous Text Context Windows, Structured JSON Logs, and Graph-Based Knowledge Retrieval.

### 4.1 Implementation Trade-offs

- **Pedagogical Usability**: The Tutor agent required immediate, straightforward access to conversational history to rapidly diagnose student misconceptions.
- **Analytical Depth**: The Evaluator (Janine) required heavily structured data to algorithmically identify patterns of iterative refinement and bio-inspired design evolution.
- **System Scalability**: The Engineer cautioned against the unwieldy token scaling of continuous text bounds and the high initial complexity of relational graph databases.

### 4.2 Resolution: Hybrid Memory Architecture

The Orchestrator synthesized these requirements into a **Hybrid Structured JSON architecture**. The system logs granular, discrete interactions—including identified intents, extracted entities, and pedagogical states—into structured JSON objects. To accommodate the Tutor's need for fast, holistic context ingestion, the system periodically compresses these JSON arrays into concise, natural language conversational summaries.

## 5. Conclusion and Future Work

The ALGET architecture forms a perfect theoretical triangle, anchoring the *Society of Mind* (Multi-Agent LLMs) within a generative *Memex* (Intelligent Textbook) to teach *Cybernetic equivalents* (Biomimicry). By perfectly balancing these historically rooted vertices and implementing a foundational Hybrid Context Memory, ALGET overcomes the static constraints of traditional education and the computational hallucinations of modern generative AI. Future work will assess the latency impact of synthesizing JSON logs into natural language and explore upgrading to a full graph-based retrieval paradigm.
