# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))


def patch(p, edits):
    raw = open(p, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    nl = '\r\n' if '\r\n' in txt else '\n'
    for old, new in edits:
        new = new.replace('\n', nl)
        assert old in txt, (p, old[:70])
        txt = txt.replace(old, new, 1)
    out = txt.encode('utf-8')
    if bom:
        out = b'\xef\xbb\xbf' + out
    open(p, 'wb').write(out)
    print('patched', p)


B = 'frontend/content/cat100-supplement/05/'
REF = "- [NACE career readiness](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined)"

# 05/01 evidence near "covers more" + fix Tufte ref link
patch(B + '01.mdx', [
 ("A second misreading is believing a longer, more detailed deck is safer because it \"covers more.\" Coverage is the opposite of purpose. Every extra slide spends the audience's limited attention and dilutes the one action you want.",
  "A second misreading is believing a longer, more detailed deck is safer because it \"covers more.\" Coverage is the opposite of purpose. Every extra slide spends the audience's limited attention and dilutes the one action you want. Multimedia-learning research has measured this: removing extraneous material improves learning (Mayer's coherence principle, median effect around d = 0.7), and adding interesting-but-irrelevant detail can make understanding worse, the classic \"when presenting more material results in less understanding\" finding (Mayer, Heiser, & Lonn, 2001)."),
 ("- data-ink and visual evidence. https://www.edwardtufte.com/tufte/books_vdqi",
  "- [Tufte's data-ink principle (visual evidence)](https://www.edwardtufte.com/tufte/books_vdqi)\n- Mayer, R. E., Heiser, J., & Lonn, S. (2001). Cognitive constraints on multimedia learning: When presenting more material results in less understanding. Journal of Educational Psychology, 93(1). https://doi.org/10.1037/0022-0663.93.1.187"),
])
# 05/03 evidence + disclosure callout
patch(B + '03.mdx', [
 ("The first misreading is \"the image looks professional, so it must be right.\" Visual polish and factual correctness are unrelated in generated images; the model optimizes for plausible appearance, not for matching your data.",
  "The first misreading is \"the image looks professional, so it must be right.\" Visual polish and factual correctness are unrelated in generated images; the model optimizes for plausible appearance, not for matching your data. Cognitive research explains why the trap works: a photo that provides no real evidence still inflates belief in the claim beside it (Cardwell et al., 2016), and information that is easier to process simply feels truer (Reber & Unkelbach, 2010)."),
 (REF, REF + "\n- Cardwell, B. A., Henkel, L. A., Garry, M., Newman, E. J., & Foster, J. L. (2016). Nonprobative photos rapidly lead people to believe claims about their own past. Memory & Cognition. https://doi.org/10.3758/s13421-016-0603-1\n- Reber, R., & Unkelbach, C. (2010). The epistemic status of processing fluency as source for judgments of truth. Review of Philosophy and Psychology. https://doi.org/10.1007/s13164-010-0039-7"),
 ("## Artifact Studio",
  "**On-slide disclosure.** If a generated image stays on the slide, give it a brief on-slide note naming the tool and that the image was AI-generated (for example, \"Diagram generated with [tool, version], checked against the source data\"). That public note is distinct from your internal critique log, and it is the same authorship honesty the course's NACE/ISTE framing already asks of your writing.\n\n## Artifact Studio"),
])
# 05/05 pace evidence
patch(B + '05.mdx', [
 ("You can hit a perfect 140 wpm by speaking in a flat monotone, which the coach rewards and a human finds unbearable.",
  "You can hit a perfect 140 wpm by speaking in a flat monotone, which the coach rewards and a human finds unbearable. (The numbers themselves are well-grounded: Microsoft's Speaker Coach guidance puts a comfortable English presentation rate at roughly 100-165 wpm, so 140 sits mid-range and 190 reads as rushed, and speech research shows listening comprehension declines as word rate climbs well past conversational speed; Foulke, 1968; Griffiths, 1992.)"),
 (REF, REF + "\n- Foulke, E. (1968). Listening comprehension as a function of word rate. Journal of Communication. https://doi.org/10.1111/j.1460-2466.1968.tb00070.x\n- Griffiths, R. (1992). Speech rate and listening comprehension: Further evidence of the relationship. TESOL Quarterly. https://doi.org/10.2307/3587015"),
])
# 05/06 copyright sources
patch(B + '06.mdx', [
 ("Public-domain government data (like BLS releases) is broadly reusable but still must be cited so the audience can verify it.",
  "Public-domain government data (like BLS releases) is broadly reusable, because works of the U.S. federal government are not subject to copyright ([17 U.S.C. 105](https://www.law.cornell.edu/uscode/text/17/105)), but it still must be cited so the audience can verify it."),
 (REF, REF + "\n- 17 U.S.C. 105: Copyright protection unavailable for U.S. government works (Cornell LII). https://www.law.cornell.edu/uscode/text/17/105\n- Creative Commons, CC BY 4.0 license deed. https://creativecommons.org/licenses/by/4.0/"),
])
# 05/07 evidence: CVD prevalence caveat + AA note
patch(B + '07.mdx', [
 ("Status dots that mean \"red equals risk\" are invisible to the roughly one in twelve men with color vision deficiency.",
  "Status dots that mean \"red equals risk\" are invisible to the roughly one in twelve men with color vision deficiency (about 8% of men of Northern European descent; prevalence is lower in Asian and African populations)."),
 ("[WCAG](https://www.w3.org/TR/WCAG22/) sets a minimum contrast ratio of 4.5:1 for normal text (3:1 for large text).",
  "[WCAG](https://www.w3.org/TR/WCAG22/) sets a minimum contrast ratio of 4.5:1 for normal text (3:1 for large text); these are the Level AA thresholds, the conformance level institutions typically target (WebAIM)."),
])
# 05/08 callout
patch(B + '08.mdx', [
 ("## Transfer Case",
  "**Why order-before-polish has evidence behind it.** Mayer's coherence and signaling principles say to cut extraneous detail and cue the essential structure, and cognitive load theory names the cost of ignoring that order: decoration added before the message is settled creates extraneous processing that competes with the message for working memory (Mayer & Fiorella, 2014).\n\n## Transfer Case"),
 (REF, REF + "\n- Mayer, R. E., & Fiorella, L. (2014). Principles for reducing extraneous processing in multimedia learning. Cambridge Handbook of Multimedia Learning. https://doi.org/10.1017/cbo9781139547369.015"),
])

# 05/07 assessment_align: contrast-threshold misconception + practice item
mp = B + '07.misconceptions.json'
d, f = read_json_preserve(mp)
if not any(x['id'].endswith('contrast_threshold_confusion') for x in d['misconceptions']):
    d['misconceptions'].append({
     "id": "cat100_supplement_5_7_contrast_threshold_confusion",
     "pattern": "contrast_threshold_confusion",
     "description": "Applying the 4.5:1 normal-text threshold to large display headings, or assuming a large title needs no contrast check at all.",
     "trigger": "learner over-corrects a 40pt title against 4.5:1, or skips checking it because 'big text is always readable'",
     "feedback": "Large text (18pt and up, or 14pt bold) uses the 3:1 threshold under WCAG AA. That is a lower bar, not no bar: a pale-gray 40pt title can still fail 3:1. Check the ratio with the right threshold for the text size.",
     "rail_action": "represent"
    })
    write_json_preserve(mp, d, f)
    print('05/07 misconception added')
pp = B + '07.practice.json'
dp, fp = read_json_preserve(pp)
if not any(x['id'].endswith('large_text_threshold') for x in dp['problems']):
    dp['problems'].append({
     "id": "cat100_supplement_5_7_accessibility_in_design_large_text_threshold",
     "type": "multiple_choice",
     "concept_id": "evidence_based_revision",
     "stem": "Your 40pt slide title is a light color and you want to verify its contrast. Which WCAG AA threshold applies?",
     "options": [
      "4.5:1, the same as body text.",
      "3:1, the large-text threshold (text 18pt and up, or 14pt bold).",
      "No threshold; large text is exempt from contrast checks.",
      "7:1, because titles matter more."
     ],
     "correct_index": 1,
     "explanation": "WCAG AA sets 4.5:1 for normal text and 3:1 for large text, defined as 18pt and up (or 14pt bold). A 40pt title is large text, so 3:1 applies; that is a lower bar, not an exemption, and a pale title can still fail it. (7:1 is the AAA normal-text level, not the AA title rule.)",
     "misconception_id": "cat100_supplement_5_7_contrast_threshold_confusion",
     "difficulty": "medium",
     "concept_ids": ["evidence_based_revision"]
    })
    write_json_preserve(pp, dp, fp)
    mp2 = B + '07.meta.json'
    m, fm = read_json_preserve(mp2)
    if 'practice_ids' in m:
        m['practice_ids'].append("cat100_supplement_5_7_accessibility_in_design_large_text_threshold")
        write_json_preserve(mp2, m, fm)
    print('05/07 practice item added')
