# NotebookLM Audio Overview × Remotion: Short Lecture Pipeline

*A technical feasibility assessment for combining Google NotebookLM's natural-sounding two-host podcast narration with Remotion programmatic video to produce short, in-textbook lecture clips.*

---

## Pilot Status (2026-04-27)

**Phase 1 pilot: live.** One bio-inspired clip — *Directional Adhesion: How Geckos Stick* (`bio_inspired/directional_adhesion`, 45s @ 30fps) — is registered, embedded in `frontend/content/bio-inspired/01/03.mdx`, and renders via `@remotion/player`'s `<Player>` inside the textbook reader.

- **Composition**: `frontend/src/animations/bio_inspired/DirectionalAdhesion.jsx` — uses `useCurrentFrame()` from `'remotion'`; SVG-only (no external assets); four phases (intro / shear engagement / peel release / contrast vs. isotropic).
- **Player wrapper**: `frontend/src/components/RemotionClip.jsx` — mounts `<Player>` with the registered composition; emits `remotion_clip_play / pause / finished` telemetry.
- **MDX surface**: authors use `<remotion-clip name="..."></remotion-clip>` — wired in `ReadingNarrative.jsx`'s components map and lazy-imported (RemotionClip ships as its own ~52kB-gzipped chunk, only loaded when a section uses the tag).
- **Audio (NotebookLM)**: not yet attached. The pilot is **silent visual-only** — Tier-A workflow below produces the MP3, then the composition will gain an `<Audio>` track. This is the next pilot increment.
- **Render-to-MP4**: not yet wired. Adding `@remotion/cli` + `@remotion/bundler` + a `remotion render` script enables MP4 export; in-app preview via `<Player>` works without them.

---

## TL;DR

**Yes, it works.** Three production tiers exist depending on scale and budget, ranging from a manual "download the MP3 and drop it into Remotion" workflow that anyone can run today, to a fully automated NotebookLM Enterprise API + Whisper alignment + Remotion render pipeline. ALGET's research-grade context fits the middle tier best: third-party automation for source ingestion + manual review for pedagogical fidelity + Remotion for the visual track. Trade-offs are documented below; the most binding constraint is **voice/style control** (NotebookLM hosts are personable but not configurable per course persona), not technical integration.

---

## 1. The Stack

The minimum viable pipeline:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ALGET section  │───▶│   NotebookLM    │───▶│  Audio Overview │
│  (.mdx + meta)  │    │  (sources)      │    │  (MP3 + script) │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Whisper /      │    │   Remotion      │    │   Final clip    │
│  forced align   │◀───│   composition   │◀───│  (MP3 + viz)    │
│  (word timing)  │    │  (synced)       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

Each box maps to a real, tested tool in 2025-2026:

- **NotebookLM** — Google's research-tool-turned-AI-workspace; *Audio Overview* generates two-host conversational narration from your sources.
- **Whisper / forced alignment** — OpenAI Whisper or `whisperX` with `WhisperTimestamped` produces word-level start/end timing for subtitle sync.
- **Remotion** — React-native programmatic video; `<Audio>` + `<Sequence>` + animations all on one timeline.

---

## 2. Three Production Tiers

### Tier A — Manual (works today, zero cost)

**Workflow:**
1. Author uploads the section's `.mdx`, the `.meta.json` learning objectives, and any reference papers into a NotebookLM notebook.
2. Triggers Audio Overview, optionally uses *Customize* to steer the hosts toward the lesson's tone.
3. Downloads the MP3 + transcript.
4. Runs Whisper on the MP3 to produce word-level timestamps.
5. Imports MP3 + JSON timing into a Remotion composition; React components animate in sync with timed cues.

**Pros.** Zero API setup. Highest narrative quality (NotebookLM hosts are surprisingly good). Works for ALGET researchers/instructors on day 1.

**Cons.** Manual every clip. Slow. No automation across a 60-section catalog.

**Recommended for:** the **22 HIGH-tier Remotion targets** identified in `REMOTION_ANIMATION_MAP.md`. Hand-authored is fine when output count is manageable.

---

### Tier B — Third-party automation (works with playwright tools)

Two notable open-source tools in 2025:

- **`israelbls/notebooklm-podcast-automator`** — FastAPI + Playwright; uploads sources, triggers Audio Overview, retrieves the audio file. Built specifically for the bypass case where NotebookLM Enterprise API is not available.
- **Apify `clearpath/notebooklm-api`** — managed actor that does the same plus citation export.

**Workflow:**
1. ALGET backend (or a small worker) calls the automator with `(section_mdx, references)`.
2. Automator drives a headless NotebookLM session, generates the Audio Overview, returns the MP3 + transcript.
3. Audio + transcript handed to a `whisperx` job for word-timing.
4. Remotion render queue (`remotion render` CLI) produces the MP4.

**Pros.** Scales to dozens of clips with light human oversight. No Google Cloud Enterprise contract needed.

**Cons.** Third-party automation can break with NotebookLM UI changes. Rate-limited by the per-account quota (currently ~3 audio overviews/day on free tier). Depends on tooling that lives outside Google's official surface.

**Recommended for:** **batch generation of MEDIUM-tier sections** where the volume justifies automation but Enterprise pricing doesn't.

---

### Tier C — NotebookLM Enterprise API (Google Cloud, paid)

Google Cloud Enterprise tier exposes a real REST API for Audio Overview generation alongside the standard notebook-and-sources endpoints. The Enterprise API is documented at `docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview` and supports:

- `audioOverviews.create` — generates an audio overview for a notebook.
- Source management (text, URL, file) via the same notebook-sources API.
- Quota and SLA appropriate for production workloads.

**Workflow:** The same as Tier B but using official Google Cloud credentials, no headless browser.

**Pros.** Production-grade SLA. No fragility of headless automation. Single-tenant rate limits negotiable.

**Cons.** Requires Google Cloud Enterprise contract; per-call cost; over-spec for a small ed-tech research deployment.

**Recommended for:** if ALGET ever hits institutional scale (multi-campus, paid LMS integration). Skip until then.

---

## 3. Audio-to-Visual Synchronization

The visual layer is where Remotion shines. Three sync mechanisms, in increasing precision:

### 3.1 Section-level cues (coarse)

Every Audio Overview ships with a transcript. Markup the transcript with `[CUE: zoom_in]` style tags by hand or via prompt-shaped LLM pass. Remotion's `<Sequence from={frame}>` consumes those cue offsets:

```jsx
<Audio src={mp3} />
<Sequence from={0} durationInFrames={300}>
    <TitleCard text="What is van der Waals adhesion?" />
</Sequence>
<Sequence from={300} durationInFrames={600}>
    <SetaeAnimation />
</Sequence>
```

Sufficient for most short clips. 1-2 hours of authoring per 60s clip.

### 3.2 Word-level timestamps (fine)

WhisperX or whisper_timestamped produces a JSON like:

```json
{ "segments": [
    { "start": 12.3, "end": 12.6, "word": "setae" },
    { "start": 12.6, "end": 12.9, "word": "are" },
    ...
]}
```

Remotion picks specific words to drive specific animation frames. When the host says "setae" at second 12.3, the setae diagram pops in. When they say "shear", the angle slider rotates.

This is what makes the output feel like a real lecture: animations *land on* the words they illustrate, not on adjacent silence.

### 3.3 Sentence-attention overlays (medium)

A middle ground for the typical case: highlight current sentence as the host speaks. Implementation is a `<Text>` component that consumes the segment list and uses `useCurrentFrame()` to determine which span is "live."

```jsx
const frame = useCurrentFrame()
const currentTime = frame / fps
const activeSegment = segments.find(s => currentTime >= s.start && currentTime <= s.end)
```

Cheap, robust, and reads as a captioned podcast with the right segment highlighted. Compatible with WCAG accessibility — captions are first-class.

---

## 4. Limitations and Workarounds

### 4.1 Voice / persona control

NotebookLM's two hosts are charming but **not configurable to course-specific personas** (BigAL, Janine Benyus, the domain Tutor). The hosts always sound like the NotebookLM hosts.

**Workarounds:**
- Accept the constraint. The hosts' voice is high-quality; the persona problem is mostly aesthetic.
- For pedagogically critical clips (e.g., Janine Benyus evaluator persona), use **ElevenLabs** instead — supply a custom voice clone + a script written by ALGET's TutorAgent. Trade conversational naturalness for persona fidelity. This is Tier D below.
- Mix: use NotebookLM for general explanation clips (Tier A/B), ElevenLabs for persona-specific clips.

### 4.2 Length

NotebookLM Audio Overviews default to 5-30 minutes. ALGET's plan is 30-90 second clips. Two paths:

- **Customize prompt** — ask for a "1-minute, single-host, focused on this concept" version. Quality acceptable.
- **Edit and clip** — manual trim of the longer overview to 60s. Quality higher; cost a few minutes per clip.

### 4.3 Length control of NotebookLM audio is approximate

Customize accepts hints like "short, focused, 1 minute" but does not guarantee duration. Expect ±20%.

### 4.4 No turn-by-turn control

The two hosts are dialogic; you don't get to dictate "host A says X then host B says Y." For a structured lesson where pedagogical sequencing matters (Gagné's nine events, for example), this can stray from the intended order.

**Workaround:** preface the source documents with a one-paragraph "what to cover in order" instruction. NotebookLM tends to honor the structure.

### 4.5 No real-time generation

Audio Overview generation takes 2-5 minutes per clip. Not a live-tutor surface; this is for *pre-rendered* short lectures embedded in the textbook, not on-demand.

---

## 5. Alternative: Tier D — Fully Programmatic

If voice control and persona fidelity are required, a fully programmatic path exists today:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  ALGET TutorAgent   │───▶│ ElevenLabs / Cartesia│───▶│  Per-character WAV  │
│  (script generated) │    │  (custom voice)      │    │   + word timing     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                                                │
                                                                ▼
                                                       ┌─────────────────────┐
                                                       │ Remotion (synced)   │
                                                       └─────────────────────┘
```

**Pros.**
- Voice matches course persona (BigAL, Janine, etc.).
- Script is auditable — generated by an existing schema-gated agent.
- Word-level timing is native (ElevenLabs returns timing JSON).
- No dependency on NotebookLM's UI/API.

**Cons.**
- Less "natural" than NotebookLM's two-host conversational flow.
- ElevenLabs costs ~$0.18/min of audio at production tier.
- Dialogic feel is harder to achieve.

**Recommended hybrid.** Use NotebookLM's voices for the **majority of the catalog** (general explanations, transitions, engaging hooks). Use ElevenLabs voices for the **persona-load-bearing clips** (e.g., the Janine Benyus evaluator clip, the BigAL "Roll Tide" intro). This gets the best of both.

---

## 6. ALGET-Specific Recommendation

A practical, low-risk integration plan for ALGET:

### Phase 1 (1-2 weeks): pilot a single clip
- Pick one HIGH-tier section from `REMOTION_ANIMATION_MAP.md` — recommend `bio-inspired/01/03 Directional Adhesion`.
- Tier A workflow: manual NotebookLM upload + download + Whisper + Remotion.
- Build the `RemotionClip` component with `<Audio src=...>` + `<Sequence>` cue-based animations.
- Validate with one external reviewer that the clip improves comprehension over the static section.

### Phase 2 (2-4 weeks): hand-author the 8 bio-inspired HIGH clips
- Bio-inspired is the densest HIGH-tier track and the most natural fit.
- Eight clips × ~3 days authoring each = ~5 weeks calendar time.
- Establish a `frontend/src/animations/` directory with composition modules per clip.

### Phase 3 (4-6 weeks): batch the dynamics + statics HIGH clips with Tier B automation
- Set up `notebooklm-podcast-automator` as a worker.
- Author cue tags via a small ALGET script (Whisper alignment + manual review).
- Render through Remotion CLI to MP4 + WebM.

### Phase 4 (research milestone): the persona-critical clips via ElevenLabs/Tier D
- Janine Benyus evaluator clip(s) — must sound like Janine.
- BigAL signature welcome clip for bio-inspired only.

### Phase 5 (long-term): integrate into the tutor flow
- Floating chat: "Show me a 60-second video of this." → On-demand generation via Tier C.
- Researcher dashboard: clip-watch telemetry as part of `interaction_events`.

The phased plan respects the existing schema-gated multi-agent architecture: clip generation becomes another **GenerativeAgent** family in the `MULTI_AGENT_GENERATIVE_DESIGN.md` design. A future `VideoLectureAgent` would call `notebooklm.create_audio_overview()` + `whisper.align()` + `remotion.render()` and ship the resulting clip back through the same content_audits + intervention_traces telemetry that the rest of the system uses.

---

## 7. Cost Envelope (rough)

| Item | Tier A (manual) | Tier B (automator) | Tier C (Enterprise) | Tier D (ElevenLabs) |
|---|---|---|---|---|
| Per-clip generation | 30 min author | 5 min author + automation | API call ~30 s | API call ~30 s |
| Per-clip cost | $0 | $0 | TBD (Enterprise) | $0.18/min × clip length |
| Voice quality | very good | very good | very good | configurable / custom voice |
| Persona control | none | none | none | full |
| Word-level timing | needs Whisper | needs Whisper | needs Whisper | native |
| Throughput | 1-2 / day | 5-10 / day | unlimited | unlimited |

For ALGET's 22 HIGH-tier clips: Tier A pilot (1-2 clips) → Tier B for the bulk (~$5 in compute over the run) is the right path. Reserve Tier D for the 2-3 persona-load-bearing clips.

---

## 8. Risks and Open Questions

- **NotebookLM ToS for downstream redistribution.** Audio Overview output is OK for personal/educational use; redistributing as a commercial product needs review with Google's terms. Educational research deployment likely fine but check with the institution's legal.
- **Voice unfamiliarity.** ALGET learners may notice if the same two NotebookLM hosts narrate every clip. Consider rotating Tier B with Tier D to add variety.
- **Mobile playback.** Remotion-rendered MP4s are standard codec; play fine in mobile browsers. Test on the deployment Vercel build.
- **Captions and accessibility.** WCAG 2.1 requires captions for educational video. Word-level timing from Whisper is high-quality input for caption files.
- **Research-data telemetry.** Time-on-clip, replay frequency, and pause-points are all useful signals; instrument via `loggingService.logEvent('clip_play', {...})` on `<Player>` events.

---

## 9. Verdict

**The pipeline is real, ships today, and integrates cleanly with ALGET's existing architecture.** The biggest constraint is voice/persona control rather than any technical block. A practical six-week production schedule for the bio-inspired HIGH-tier clips is achievable with Tier A → B automation. The result is short, conversational, animated micro-lectures embedded directly in the textbook narrative — consistent with the *generative intelligent textbook* commitment that distinguishes ALGET from a static digital textbook.

---

Sources:
- [NotebookLM Enterprise — Manage audio overview API (Google Cloud)](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview)
- [`israelbls/notebooklm-podcast-automator` (GitHub)](https://github.com/israelbls/notebooklm-podcast-automator)
- [Apify `clearpath/notebooklm-api`](https://apify.com/clearpath/notebooklm-api)
- [Generate Audio Overview in NotebookLM (Help Center)](https://support.google.com/notebooklm/answer/16212820)
- [Remotion documentation](https://www.remotion.dev/)
- [WhisperX (word-level alignment)](https://github.com/m-bain/whisperX)
- [ElevenLabs API](https://elevenlabs.io/docs)
