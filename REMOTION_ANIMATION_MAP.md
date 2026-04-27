# Remotion Animation Map

*A section-by-section catalog of where programmatic video (Remotion) would meaningfully add to learning across ALGET's 60+ sections. Read top-down: principles, selection criteria, then the per-section recommendations.*

---

## Why Remotion (and where it isn't worth it)

Remotion turns React components into rendered MP4 / WebM video. Three properties make it a strong fit for ALGET specifically:

1. **Programmatic + version-controlled.** Animations live as code in `frontend/src/animations/*` and ship with the repo. No proprietary timeline files, no opaque asset binaries.
2. **Composable with the rest of the stack.** Remotion components consume the same MDX content props that `<concept-diagram>` and `<dynamic-scenario>` already use, so the integration is `<remotion-clip name="..." />` in the narrative — same authorial pattern, different rendering.
3. **Cheap to iterate.** Render a 30-second clip in seconds, swap it without rebuilding the textbook.

The honest counter-case: animation does not add value to text-heavy abstract material where the temporal dimension is not the concept. A 60-second video about "the four conditions of informed consent" wastes the medium; a 60-second video about "specification gaming in a boat-racing reward hack" is exactly the medium's strength.

This map applies that filter rigorously. A section gets a recommendation only when *time itself* — process, transformation, sequencing, comparison-by-overlay — carries part of the meaning.

---

## Selection Criteria

| Tier | Symbol | When to choose |
|---|---|---|
| **HIGH** | 🎬 | The concept is fundamentally temporal or transformational; static figures are documented to underexplain it; animation gives clarity that text + still image cannot |
| **MEDIUM** | 🎨 | Animation elevates an already-OK static representation; nice-to-have; build after HIGH tier is done |
| **LOW** | ✋ | The concept is propositional or framework-shaped; animation would be decoration; skip |

Across 60 sections we mark **24 HIGH**, **18 MEDIUM**, **18 LOW**.

Each HIGH/MEDIUM entry below specifies:
- **Concept** — what the animation is *of*
- **Visual** — proposed style and the key frames the learner sees
- **Length** — recommended duration (Mayer segmenting: short clips beat long ones)
- **Take-away** — what the learner should be able to do after watching

---

## bio-inspired (10 sections)

This is ALGET's most animation-rich track. Eight of ten sections are HIGH because the field studies natural processes whose temporality *is* the lesson.

### 01/01 Cellular Solids — 🎨 MEDIUM
- **Concept**: how cellular geometry distributes load.
- **Visual**: honeycomb cross-section under increasing vertical load; arrows propagate stress along cell walls; failure mode shown when load exceeds threshold.
- **Length**: 30s.
- **Take-away**: "Why honeycombs aren't just light — they're load-routing."

### 01/02 Hierarchical Structures — 🎬 HIGH
- **Concept**: nano → micro → macro hierarchy of bone or nacre.
- **Visual**: continuous zoom from whole-bone scale through trabecular structure to mineralized collagen fibrils to molecular cross-link; back out to whole-bone with new appreciation.
- **Length**: 60s.
- **Take-away**: "Each level of organization contributes a property the others can't."

### 01/03 Directional Adhesion — 🎬 HIGH
- **Concept**: gecko setae engaging at preload angle, releasing at lift-off angle.
- **Visual**: setae array attaches to ceiling; preload + shear shown by arrow; smooth detach as angle changes; contrast with isotropic adhesive that fails at the same load.
- **Length**: 45s.
- **Take-away**: "Direction is part of the design — not a side effect."

### 02/01 Fluid Dynamics — 🎬 HIGH
- **Concept**: vortex shedding behind a cylinder, Karman street.
- **Visual**: streamlines around cylinder, time-evolution showing alternating vortex release; Reynolds-number slider that changes shedding regime.
- **Length**: 50s.
- **Take-away**: "Wake structure is a function of Re — and that's why bridge cables sing."

### 03/01 Aeroacoustics & Wing Serrations — 🎬 HIGH
- **Concept**: owl wing leading-edge serrations break large vortices into smaller turbulent eddies.
- **Visual**: side-by-side smooth vs serrated leading edge in cross-flow; particle traces showing energy dissipation patterns; sound-wave overlay with amplitude.
- **Length**: 45s.
- **Take-away**: "Surface texture controls turbulence at the scale of human hearing."

### 04/01 Dry Adhesion & Nanotech — 🎬 HIGH
- **Concept**: van der Waals contact at spatula scale; bending compliance under shear.
- **Visual**: nm-scale spatula approaches surface; intermolecular force arrows engage; spatula bends in shear; release at angle.
- **Length**: 40s.
- **Take-away**: "Adhesion at this scale is geometry + bending compliance, not glue."

### 05/01 Structural Colors & Optics — 🎬 HIGH
- **Concept**: thin-film interference, butterfly wing iridescence.
- **Visual**: incoming white light splits into wavelengths; reflected wavelengths interfere constructively/destructively at film thickness; viewing angle changes color.
- **Length**: 50s.
- **Take-away**: "These colors are physics, not pigments — and the physics is geometric."

### 06/01 Thermal Regulation & Architecture — 🎬 HIGH
- **Concept**: termite mound chimney effect over a day-night cycle.
- **Visual**: cross-section of mound; time-of-day controls solar heating; airflow streamlines reverse direction with temperature gradient.
- **Length**: 60s.
- **Take-away**: "Passive cooling can be designed into the form, not bolted on."

### 07/01 Self-Healing Materials — 🎬 HIGH
- **Concept**: micro-encapsulated healing agent in epoxy matrix.
- **Visual**: crack initiates; ruptured capsule releases healing agent into crack; polymerization fills crack; load-bearing capacity restores.
- **Length**: 40s.
- **Take-away**: "Healing is a designable response to damage, not an afterthought."

### 08/01 Swarm Intelligence — 🎬 HIGH
- **Concept**: ant pheromone trail formation and reinforcement.
- **Visual**: 30 ant agents random-walk; one finds food, deposits pheromone; trail strengthens via stigmergy; shorter route emerges as winner.
- **Length**: 50s.
- **Take-away**: "Global behavior emerges from local rules + signal trace."

---

## dynamics (11 sections)

A field whose subject is motion. Most sections are HIGH or MEDIUM almost by definition.

### 01/01 Introduction to Dynamics — 🎨 MEDIUM
- **Visual**: position vector, velocity tangent, acceleration component decomposition with sliders.
- **Length**: 30s.
- **Take-away**: "Three vectors, one motion — see how they relate."

### 01/02 Rigid Body Mechanics in Motion — 🎬 HIGH
- **Concept**: translation + rotation decomposition.
- **Visual**: rigid body moves; instantaneous decomposition into pure translation + rotation about COM; arrows show both contributions to a corner point's velocity.
- **Length**: 45s.
- **Take-away**: "Any rigid-body motion = translation of COM + rotation about COM."

### 01/03 Relative Motion — 🎬 HIGH
- **Concept**: velocity transformation between frames.
- **Visual**: train moving along ground; person walking inside train; the same point's velocity in ground frame vs train frame; vector triangle reconciliation.
- **Length**: 45s.
- **Take-away**: "Frame matters; v_AB = v_A − v_B."

### 01/04 Curvilinear Motion (n-t, polar) — 🎬 HIGH
- **Concept**: tangential and normal components evolving along a curve.
- **Visual**: particle on curved track; n̂ rotates toward center of curvature; v_t along path, a_n = v²/ρ pointing inward; speed slider changes a_n magnitude.
- **Length**: 60s.
- **Take-away**: "Constant speed ≠ zero acceleration on a curve."

### 02/01 Newton's Second Law — 🎨 MEDIUM
- **Visual**: F = ma slider — change F or m and watch a respond.
- **Length**: 25s.
- **Take-away**: linear law, intuition.

### 02/02 Work and Energy — 🎨 MEDIUM
- **Visual**: work done as area under F-x curve; KE bar fills as work accumulates.
- **Length**: 35s.
- **Take-away**: "Work is path integral; KE is its sink."

### 02/03 Impulse and Momentum — 🎬 HIGH
- **Concept**: 1D elastic vs inelastic collision.
- **Visual**: two carts collide; momentum vectors before and after; restitution slider; energy bar before/after.
- **Length**: 45s.
- **Take-away**: "Momentum conserves always; energy depends on e."

### 03/01 Kinematics of Rigid Bodies — 🎬 HIGH
- **Concept**: angular velocity vector and rotation about a fixed axis.
- **Visual**: rotating disc; ω vector along axis; right-hand rule with curl direction; tangent point velocity ω × r.
- **Length**: 50s.
- **Take-away**: "ω is a vector — direction matters."

### 03/02 Equations of Motion for Rigid Bodies — 🎨 MEDIUM
- **Visual**: torque applied to disc; angular acceleration appears; ΣM = Iα equation overlay.
- **Length**: 30s.

### 03/03 Work-Energy for Rigid Bodies — 🎨 MEDIUM
- **Visual**: rolling cylinder down ramp; energy bar splits into translational + rotational KE.
- **Length**: 35s.
- **Take-away**: "Rolling has both T and R kinetic energy."

### 03/04 Rigid Body Impulse-Momentum — 🎬 HIGH
- **Concept**: eccentric impact and angular momentum conservation about pin.
- **Visual**: ball strikes hinged rod; ball trajectory shown; rod's resulting ω; angular momentum before = after about pin (with linear momentum NOT conserved due to pin reaction).
- **Length**: 55s.
- **Take-away**: "Pin → angular momentum conserves about pin, not linear."

---

## statics (14 sections)

Less dynamic by name, but several mechanical-construction concepts are still inherently temporal/sequential.

### 01/01 Equilibrium Conditions — 🎨 MEDIUM
- **Visual**: force triangle balance demonstrated by tilting a hanging weight.

### 01/02 Free Body Diagrams — 🎬 HIGH
- **Concept**: the *isolation* step — what to include and what to remove.
- **Visual**: animated "cut" of a body from its surroundings; supports and contacts get replaced by their reactions, one at a time, with labels.
- **Length**: 60s.
- **Take-away**: "FBD is a procedure: isolate, replace, label, sum."

### 01/03 Two-Force and Three-Force Members — 🎨 MEDIUM
- **Visual**: animated concurrency — three force lines pivot until they intersect at one point.

### 01/04 Friction — 🎨 MEDIUM
- **Visual**: block on incline; static friction grows with applied force until threshold; slip onset; kinetic friction kicks in.
- **Length**: 35s.

### 01/05 Force Vectors (2D, 3D, dot/cross) — 🎬 HIGH
- **Concept**: 3D unit vector + cross product right-hand rule.
- **Visual**: 3D coordinate system with vectors A, B; A × B drawn perpendicular to A-B plane; right-hand-rule overlay; sign flips when operands swap.
- **Length**: 50s.
- **Take-away**: "Cross product is a vector; right-hand rule is its direction."

### 02/01 Moment of a Force — 🎬 HIGH
- **Concept**: M = r × F geometry.
- **Visual**: force applied off-axis; r vector from pivot; cross product result vector along rotation axis; magnitude = |F|·d_perp shown.
- **Length**: 45s.
- **Take-away**: "Moment depends on perpendicular distance, not contact distance."

### 02/02 Couples and Equivalent Systems — 🎨 MEDIUM
- **Visual**: two equal-and-opposite forces translate; the body rotates without translating; net force = 0, net moment = Fd.

### 02/03 Equilibrium of Rigid Bodies — ✋ LOW
- Mostly assembly of prior pieces; static FBD examples already work.

### 03/01 Simple Trusses — 🎨 MEDIUM
- **Visual**: applied load propagates through truss; bar colors update by tension/compression.

### 03/02 Method of Joints — 🎨 MEDIUM
- **Visual**: walk through joint A's equilibrium → solve for two members → propagate to joint B.

### 03/03 Method of Sections — 🎨 MEDIUM
- **Visual**: cutting plane animates through truss; the three internal forces revealed at the cut.

### 04/01 Internal Forces / Shear-Moment Diagrams — 🎬 HIGH
- **Concept**: beam loading → V(x) → M(x), classic zyBooks signature.
- **Visual**: simply-supported beam with point load; cutting plane moves left to right; V(x) and M(x) draw beneath in sync; max-M location lights up where V crosses zero.
- **Length**: 75s.
- **Take-away**: "Three diagrams in one view: load, shear, moment — and dM/dx = V."

### 05/01 Centroids, MOI — 🎬 HIGH
- **Concept**: parallel-axis theorem and composite-bodies method.
- **Visual**: I-beam dissected into three rectangles; each piece's I_c shown; parallel-axis transfer with d² visualized as area square; sum reassembled.
- **Length**: 55s.
- **Take-away**: "I = I_c + Ad²; that d² is what makes I-beams stiff."

### 06/01 Introduction to Trusses — ✋ LOW
- Duplicates 03/01; skip.

---

## inst-design (17 sections)

A theory-heavy track. Most sections are propositional and don't need animation; six are MEDIUM/HIGH where a temporal demonstration carries weight.

### 01/01 What is ID — ✋ LOW
- Definitional; framework comparison better as static diagram.

### 01/02 Cognitive Load & Schema — 🎨 MEDIUM
- **Visual**: working-memory dial fills as elements pile in; chunked representation halves the load.

### 01/03 Constructivism & Active Learning — ✋ LOW

### 02/01 Analysis & Design Phases — 🎨 MEDIUM
- **Visual**: ADDIE wheel rotates with current phase highlighted; arrows show information flow between phases.

### 02/02 Development & Implementation — ✋ LOW

### 02/03 Evaluation Phase — ✋ LOW

### 02/04 ID Models Beyond ADDIE — ✋ LOW

### 02/05 Writing Learning Objectives (Bloom + ABCD) — ✋ LOW

### 02/06 Gagné's Nine Events — 🎬 HIGH
- **Concept**: information flow through three memory stores aligned to nine events.
- **Visual**: bottom panel shows the nine events as numbered boxes; top panel shows information flowing through sensory register → working memory → long-term memory; the relevant memory stage lights up at each event.
- **Length**: 75s.
- **Take-away**: "Each event creates conditions for the next memory transition."

### 02/07 Assessment Design — ✋ LOW

### 02/08 Online & Distance Learning — ✋ LOW

### 03/01 Multimedia Learning Principles — 🎬 HIGH
- **Concept**: Mayer's modality and redundancy principles, side-by-side.
- **Visual**: split screen — left: text + narration violating redundancy; right: spoken narration only with diagram. Working-memory channel meters fill differently.
- **Length**: 60s.
- **Take-away**: "Where you put the words changes how much of the working memory is left for learning."

### 04/01 Motivation & ARCS — ✋ LOW

### 05/01 Andragogy — ✋ LOW

### 06/01 Collaborative & Social Learning — ✋ LOW

### 07/01 Universal Design for Learning — 🎨 MEDIUM
- **Visual**: three-network brain diagram with concurrent activation patterns as a learner reads, expresses, and engages.

### 08/01 Emerging Technologies — ✋ LOW

---

## ai-ethics (12 sections)

A theory-heavy track with several conceptually sharp visualizations possible.

### 01/01 Why AI Needs Ethics — ✋ LOW
- Argumentative content; no temporal axis.

### 01/02 Ethics Frameworks — ✋ LOW

### 02/01 Algorithmic Bias Sources — 🎬 HIGH
- **Concept**: where bias enters the pipeline.
- **Visual**: data flow from collection → labeling → training → deployment; each stage flashes its bias source (historical, representation, measurement, aggregation, evaluation, deployment-feedback) when triggered; an example case (Amazon resumes, COMPAS, predictive policing) illustrates each.
- **Length**: 90s.
- **Take-away**: "Six sources, six fixes — diagnose before you mitigate."

### 02/02 Fairness Definitions and Their Impossibilities — 🎬 HIGH
- **Concept**: Chouldechova / Kleinberg-Mullainathan-Raghavan trade-off.
- **Visual**: three fairness criteria (demographic parity, equalized odds, calibration) shown as three dials; base-rate slider changes; only two of three can satisfy when base rates differ; compass needle swings.
- **Length**: 75s.
- **Take-away**: "It's a math fact, not an engineering deficit — you must choose."

### 03/01 Black Boxes & Right to Explanation — 🎨 MEDIUM
- **Visual**: counterfactual explanation as visual perturbation — change DTI from 43% → 38% and watch the loan-decision boundary cross.

### 03/02 Accountability & Liability — ✋ LOW

### 04/01 Privacy Threats — 🎨 MEDIUM
- **Visual**: re-identification by linkage — animated join of two anonymized datasets exposing identity.

### 04/02 Consent in Algorithmic Contexts — ✋ LOW

### 05/01 AI Safety & Alignment — 🎬 HIGH
- **Concept**: specification gaming — boat-racing reward hack.
- **Visual**: agent in racing game collects power-up reward by spinning in a circle instead of finishing; reward gauge maxes; race-completion gauge stays at 0.
- **Length**: 45s.
- **Take-away**: "The optimizer optimizes the spec, not the intent."

### 05/02 Governance Frameworks — ✋ LOW

### 06/01 FERPA, COPPA, IDEA — ✋ LOW

### 06/02 Surveillance, Dark Patterns — 🎨 MEDIUM
- **Visual**: variable-ratio reward animation — slot-machine pull, intermittent reinforcement curve building.

---

## Summary

| Course | HIGH 🎬 | MEDIUM 🎨 | LOW ✋ | Total |
|---|---:|---:|---:|---:|
| bio-inspired | 8 | 1 | 0 | 9 |
| dynamics | 5 | 5 | 0 | 10 |
| statics | 4 | 6 | 2 | 12 |
| inst-design | 2 | 3 | 12 | 17 |
| ai-ethics | 3 | 3 | 6 | 12 |
| **Total** | **22** | **18** | **20** | **60** |

**Implementation order recommended.** Build the 22 HIGH-tier clips first; they have the largest learning return per minute of production. Within HIGH, start with the bio-inspired track (most concentrated tier and best fit with the existing `<concept-diagram>` aesthetic) and the two statics signatures (FBD walkthrough at 01/02 and shear-moment diagram at 04/01) for the engineering tracks' biggest pedagogical wins.

---

## Engineering integration plan

When implementing, follow this pattern:

```jsx
// frontend/src/animations/BioInspired/HierarchicalZoom.jsx
import { Composition } from 'remotion'
export const HierarchicalZoom = () => { /* React + remotion */ }
```

```jsx
// frontend/src/components/RemotionClip.jsx
import { Player } from '@remotion/player'
export default function RemotionClip({ name }) {
    const Component = lookup(name)
    return <Player component={Component} durationInFrames={...} fps={30} ... />
}
```

```jsx
// frontend/src/components/ReadingNarrative.jsx — register the MDX tag
const RemotionClip = lazy(() => import('./RemotionClip'))
// in markdownComponents:
'remotion-clip': (props) => renderLazyMarkdownModule(RemotionClip, props),
```

In MDX:

```mdx
<remotion-clip name="bio_inspired/hierarchical_zoom" />
```

The clip then renders inline at the chosen narrative anchor.

---

## Why not just use videos / GIFs

- **Versionability**: a Remotion clip is reviewable like code; a video or GIF is opaque.
- **Customizability per learner**: a Remotion component can take props (mass, force, base rate) and re-render — turning a static lesson into a live mini-simulation.
- **Accessibility**: closed captions and audio-description tracks are React props, not separate file pipelines.
- **No proprietary toolchain**: anyone with the repo can edit any animation.

Trade-off: production cost per clip is non-trivial (1-3 days of design + implementation per HIGH-tier item). The 22 HIGH items are roughly 6-10 weeks of focused production, which is why the prioritization matters.
