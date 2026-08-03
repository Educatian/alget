# ALGET Content-Trust Verification Report

> **Remediation update — 2026-07-30:** All 12 originally flagged atoms have now
> been repaired in the active corpus. The Dynamics answer keys, CAT 100 Excel
> example, dates/attributions, stray MDX tags, triangular-load wording, and
> citation identifiers were corrected. The Selwyn identifier had propagated to
> 40 CAT 531 files (41 occurrences), not one section as originally reported; all
> are now normalized to the 2014 Routledge ebook record
> `https://doi.org/10.4324/9781315886350`. Content schemas now require
> machine-auditable learning-objective coverage through stable IDs and explicit
> practice mappings. The original report below is retained as audit history.

**Date:** 2026-05-28
**Scope:** Full content corpus across 8 courses (statics, dynamics, bio-inspired, ai-ethics, inst-design, ail606-supplement, cat531-supplement, cat100-supplement). MDX worked examples (`\boxed{}`) and `.practice.json` problems (`final_answer`/`expected_value`), plus all named citations, incidents, laws/standards, and embedded media.

---

## Overall Trust Verdict

**Conditionally shippable — NOT ready to deploy until 6 ERROR + 4 MISATTRIBUTED items are fixed.**

The good news, and it is substantial: **every numeric worked example and every quantitative answer key across the math-heavy courses recomputes correctly within tolerance.** Statics (all 14 sections), the dynamics MDX worked examples, all of bio-inspired's parameter-explorer numerics, the ai-ethics fairness/DP/scale arithmetic, and the inst-design IRT/ROI/Bloom computations were independently re-derived in Python and matched. That is the core academic credibility of the platform, and it is sound.

The problems are concentrated and well-bounded:

1. **Two physics answer-key errors in dynamics `03/03.practice.json`** are real and must be fixed. The hoop rolling-speed answer (5.94 m/s) is not just wrong, it is *physically impossible* (it exceeds the frictionless sliding limit), so a strong student will catch it and lose trust in the answer key. The total-KE answer (36 J vs correct 27 J) is a double-count error.

2. **One worked example in cat100 `03/05` is internally self-contradictory** — the "known-answer verification" row, which is the entire pedagogical point of the section, does not cohere with its own displayed table and references a column that doesn't exist. This is embarrassing in a section teaching verification.

3. **Two rendering/publishability defects** — stray `</content>`/`</invoke>` LLM artifacts at the end of bio-inspired `04/01.mdx` (may break MDX build), and they should be caught by a build before deploy.

4. **Two fabricated/unverifiable DOIs** in the supplement courses (ail606 cognitive-load DOI is non-existent; cat531 critical-edtech DOI does not resolve) — these are real citation-integrity risks, propagated across all 64 sections in the ail606 case.

5. **Several MISATTRIBUTED items** (crumple-zone patent year, Mariner 1 framed as a rotational-dynamics failure, Hawking quote dated to a 2014 BBC interview instead of the 2015 Reddit AMA, an Indonesian YouTube video mislabeled as an English Excel tutorial) — each is a real thing attributed to the wrong source/date, the kind of error a domain expert reviewer will flag.

**Must-fix before deploy:** all 6 ERROR and 4 MISATTRIBUTED items below. **Fix before publication (citation integrity):** the 1 HALLUCINATED + 1 UNSUPPORTED DOI. **Recommended:** run an MDX build to catch the stray-tag class of defect platform-wide.

No flagged item undermines the substantive technical instruction. The corpus is fundamentally trustworthy; it needs a tight cleanup pass on a short, enumerated list, not a rebuild.

---

## Totals

| Metric | Count |
|---|---|
| Atoms checked | 419 |
| Atoms flagged | 12 |
| Courses with zero flags | 1 (inst-design) |

### Per-course

| Course | Checked | Flagged |
|---|---|---|
| statics | 62 | 2 |
| dynamics | 118 | 4 |
| bio-inspired | 63 | 1 |
| ai-ethics | 52 | 1 |
| inst-design | 38 | 0 |
| ail606-supplement | 14 | 1 |
| cat531-supplement | 14 | 1 |
| cat100-supplement | 58 | 2 |

---

## By-Verdict Breakdown (flagged atoms only)

| Verdict | Count | Items |
|---|---|---|
| **ERROR** | 6 | statics Hyatt month (02/01); statics triangular-load parenthetical (05/01 practice); dynamics total-KE 36→27 J (03/03 practice); dynamics hoop speed 5.94→3.43 m/s (03/03 practice); bio-inspired stray MDX tags (04/01); cat100 self-contradictory worked example (03/05) |
| **MISATTRIBUTED** | 4 | dynamics crumple-zone patent year (02/03); dynamics Mariner 1 framing (03/02); ai-ethics Hawking epigraph date (05/01); cat100 YouTube embed title/language (03/04) |
| **UNSUPPORTED** | 1 | cat531 "critical edtech studies" DOI (03/03) |
| **HALLUCINATED** | 1 | ail606 cognitive-load DOI, propagated across all 64 sections |

**Not flagged (by design):** well-established facts marked LIKELY (Tacoma Narrows, Forth Bridge, Floridi/Coeckelbergh/Vallor/O'Neil et al. in ai-ethics, US Air Force average-pilot study in inst-design, etc.) and all CORRECT-verified numerics, incidents, and citations.

---

## Ranked Top Fixes (every ERROR / MISATTRIBUTED / HALLUCINATED item)

Ordered by trust impact: physically-impossible/self-contradictory content first, then rendering defects, then citation integrity, then attribution corrections.

### 1. dynamics 03/03.practice.json — hoop rolling speed (ERROR, physically impossible)
- **Issue:** A 3 kg hoop rolling without slipping from rest down h = 1.2 m is stated to reach 5.94 m/s (step 3 `expected_value` and `final_answer`). For a hoop, `v = sqrt(2gh/(1+I_G/(mr^2))) = sqrt(gh) = sqrt(9.81*1.2) = 3.43 m/s`. The stated 5.94 m/s exceeds even the frictionless sliding limit `sqrt(2gh) = 4.85 m/s`, so it is impossible. (Step 1, mgh = 35.316 J, is correct; the error is in solving for v.)
- **Fix:** Change step 3 `expected_value` and `final_answer.value` from 5.94 to **3.43 m/s**.

### 2. dynamics 03/03.practice.json — total kinetic energy (ERROR)
- **Issue:** `rigid_body_total_ke_numeric`: 4 kg body, v_G = 3 m/s, I_G = 0.5 kg·m², ω = 6 rad/s, stated `final_answer` 36 J. Correct: `T = ½mv² + ½I_Gω² = 18 + 9 = 27 J` (givens independent).
- **Fix:** Change `final_answer.value` from 36 to **27 J**.

### 3. cat100 03/05 — self-contradictory verification worked example (ERROR)
- **Issue:** Table shows David in row 3 with Points (B3) = 30, columns A/B/C only. The text then uses `=B4/D4` (no column D exists) and verifies "D3=5, B3=45 → 9.0" — but 45 is Maria's points, not David's; David's value would be 30/5 = 6.0. The known-answer verification, the whole point of the section, does not match its own data.
- **Fix:** Add the missing denominator column (D = ItemCount) and align numbers so the verification row is self-consistent (e.g., David Points 45, ItemCount 5 → 9.0), or correct the verification to David's displayed Points of 30.

### 4. statics 02/01.mdx — Hyatt Regency collapse month (ERROR + internal inconsistency)
- **Issue:** "In February 1981, the Kansas City Hyatt Regency walkways collapsed..." Correct date is **July 17, 1981** (Wikipedia/Britannica/NIST). Death toll (114) and redesigned hanger-rod cause are correct. Section 04/01 already states "July 17, 1981", so this is also an internal contradiction.
- **Fix:** Change "In February 1981" to "On July 17, 1981."

### 5. statics 05/01.practice.json — triangular-load centroid parenthetical (ERROR)
- **Issue:** Correct option says equivalent force acts "at 2L/3 from the zero end (the centroid of a triangle with apex at the zero end)." Self-contradictory: an apex (peak w0) at the zero end gives centroid at L/3, not 2L/3. The numeric (2L/3 from zero end) is correct and corresponds to the peak at the FAR end.
- **Fix:** Reword to "(centroid of a triangle whose apex/peak is at the far end)" or drop the "apex at the zero end" phrase. Numeric answer unchanged.

### 6. bio-inspired 04/01.mdx — stray MDX closing tags (ERROR, rendering defect)
- **Issue:** File terminates with literal `</content>` (line 260) and `</invoke>` (line 261) after the final `</interactive-quiz>` — LLM tool-call/wrapper artifacts that may break the MDX build.
- **Fix:** Delete lines 260–261; file should end at line 259 with `></interactive-quiz>`. Recommend an MDX build check across the corpus to catch any similar artifacts.

### 7. ail606-supplement — fabricated cognitive-load DOI (HALLUCINATED, all 64 sections)
- **Issue:** Reference "cognitive load theory" with DOI `10.1016/j.learninstruc.2009.12.009` does not resolve (doi.org 404 + Crossref `works` 404). Non-existent DOI, propagated across all 64 sections. (Companion Mayer DOI `10.1017/CBO9781139164603` resolves fine.)
- **Fix:** Replace with a real CLT citation + valid DOI, e.g. Sweller, Ayres & Kalyuga (2011), *Cognitive Load Theory* (Springer), `10.1007/978-1-4419-8126-4`; or Paas, Renkl & Sweller (2003), *Educational Psychologist* 38(1), `10.1207/S15326985EP3801_1`. Update in the shared reference block so all 64 sections are corrected.

### 8. dynamics 02/03.mdx — Mercedes crumple-zone patent year (MISATTRIBUTED)
- **Issue:** "The 1959 Mercedes-Benz crumple-zone patent..." Béla Barényi's patent (DBP 854.157) was filed 23 Jan 1951, granted 28 Aug 1952. 1959 is the production debut (W111), not the patent year.
- **Fix:** Refer to the early-1950s/1952 patent, e.g. "patented by Mercedes-Benz in 1952 and first produced in 1959."

### 9. dynamics 03/02.mdx — Mariner 1 framed as rotational-dynamics failure (MISATTRIBUTED)
- **Issue:** Mariner 1 is described as a torque/inertia-balance ("rotational dynamics") failure that tumbled out of control. Actual cause (22 Jul 1962): a guidance equation/coding error (missing overbar) plus an Atlas guidance-antenna hardware fault; the Range Safety Officer destroyed the vehicle ~290 s into flight. Not a rigid-body inertia mismatch.
- **Fix:** Replace with a genuine rotational-dynamics failure (e.g., Explorer 1's flat-spin from energy dissipation about a non-principal axis, or a documented satellite nutation/spin-instability case), or remove the Mariner 1 attribution.

### 10. cat100 03/04 — YouTube embed title/language mismatch (MISATTRIBUTED)
- **Issue:** `<youtube-embed id="aA4AG1LCG0M" title="Easily Learn Pivot Tables in Microsoft Excel">` — that video ID is actually "Mudah Belajar Pivot Tabel" (Indonesian, 2017). Displayed English title is fabricated; language is wrong for an English-language CAT 100 course.
- **Fix:** Replace with a real English Excel pivot-table tutorial (update the id), or correct the displayed title to the actual video title; confirm language suitability.

### 11. ai-ethics 05/01.mdx — Hawking epigraph misdated (MISATTRIBUTED)
- **Issue:** Quote ("The real risk with AI isn't malice but competence...") is genuinely Hawking's and correctly worded, but attributed to "BBC interview, 2014." It is from his October 2015 Reddit AMA; the Dec 2014 BBC interview said something different ("could spell the end of the human race").
- **Fix:** Re-attribute to "Stephen Hawking (Reddit AMA, October 2015)."

### 12. cat531-supplement 03/03 — unresolvable "critical edtech studies" DOI (UNSUPPORTED)
- **Issue:** Reference DOI `10.4324/9781315670160` does not resolve (Crossref `works` 404, doi.org 404); no matching Routledge title found for ISBN 9781315670160. The 10.4324 prefix is genuinely Routledge, but this identifier cannot be located. (Other three DOIs in the list verified OK.)
- **Fix:** Replace with a real, resolvable critical-edtech source DOI (e.g., a verified Selwyn or Williamson title) or remove the broken DOI; confirm the intended book/ISBN before deploy. *(Lower urgency than the HALLUCINATED ail606 DOI since it is single-section and the prefix is legitimate, but still a citation-integrity blocker for publication.)*

---

## Notes / Non-Blocking Observations

- **inst-design** has zero flags; all numerics recompute and all attributions verified. The 08/01 parameter-explorer uses a crude linear effect-size→percentile approximation, but the prose states the correct 97.7th percentile, so it is not flagged.
- **Supplement courses (cat100/cat531/ail606)** are largely qualitative/scenario-based; their hypothetical illustrative figures ("92% accurate," etc.) are explicitly framed as non-empirical and are not verifiable atoms.
- **Scope clarification:** inst-design and the supplements contain no EU AI Act / NIST RMF / Kleinberg / Chouldechova / COMPAS atoms — those live only in the ai-ethics course and were verified there.
