# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
results = []


def patch(p, edits, label):
    raw = open(p, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    nl = '\r\n' if '\r\n' in txt else '\n'
    for old, new in edits:
        new = new.replace('\n', nl)
        if old not in txt:
            results.append(('SKIP', label, old[:55]))
            continue
        txt = txt.replace(old, new, 1)
    out = txt.encode('utf-8')
    if bom:
        out = b'\xef\xbb\xbf' + out
    open(p, 'wb').write(out)
    results.append(('OK', label, ''))


B = 'frontend/content/cat531-supplement/'

# 03/01: feedback-loop citation in practice explanation
pp = B + '03/01.practice.json'
d, f = read_json_preserve(pp)
for pr in d['problems']:
    if 'reading-recommendation app' in pr.get('stem', ''):
        if 'feedback loop' not in pr['explanation']:
            pr['explanation'] = ("Tools embed design and data assumptions that shape outcomes independent of teacher use. "
                                 "A recommender trained on past borrowing data inherits and amplifies those patterns; the "
                                 "recommender-systems fairness literature documents exactly this feedback-loop bias, where "
                                 "yesterday's popular choices steer today's exposure (Wang et al., 2022, ACM TOIS survey on "
                                 "recommender fairness). Naming the built-in assumption is the AI-literacy move.")
            results.append(('OK', 'cat531/03/01 practice explanation', ''))
write_json_preserve(pp, d, f)

# 03/02: hidden-cost callout (the Liang grounding is already present -> logged as already-applied)
patch(B + '03/02.mdx', [
 ("## Decision Rule",
  "**Hidden cost of the process-evidence move.** Submitting student work to a commercial detector or generative-AI service is itself a data-disclosure decision: the essays are education records (FERPA), under-13 contexts add COPPA, whose amended rule was finalized in 2025 with compliance through 2026, and version-history-as-evidence is a form of process surveillance whose burden falls unevenly on students with less private time, hardware, or connectivity. Choose process evidence with the same datafication lens you point at the detector.\n\n## Decision Rule"),
], 'cat531/03/02 hidden-cost callout')

# 03/03: policy-floor callout after Decision Rule list
patch(B + '03/03.mdx', [
 ("If the vendor cannot provide subgroup data, treat the absence as a finding: a tool whose fairness cannot be audited has not earned access to students.",
  "If the vendor cannot provide subgroup data, treat the absence as a finding: a tool whose fairness cannot be audited has not earned access to students.\n\n**Policy floor.** These checks sit above a legal minimum, not instead of one: FERPA already gives families access, consent, and amendment rights over education records, and the amended COPPA Rule (final rule 2025, compliance dates through April 2026) now treats biometric identifiers as protected personal information for children under 13. Meeting the law is the floor; the stakes-proportional evidence bar this section teaches is the professional standard on top of it."),
], 'cat531/03/03 policy floor')

# 03/05: prevalence callout
patch(B + '03/05.mdx', [
 ("## Core Concept",
  "**How common is this already?** Pew Research Center reported in January 2025 that about a quarter of U.S. teens had used ChatGPT for schoolwork, double the 2023 share, so the input-privacy exposure this section teaches is a present-tense, mainstream behavior, not an edge case.\n\n## Core Concept"),
], 'cat531/03/05 prevalence')

# 03/08: Learn Your Way connect-to-practice sentence
patch(B + '03/08.mdx', [
 ("## Transfer Case",
  "## Transfer Case\n\nThe same integrated weighing applies to the most advanced adaptive systems shipping today: Google's Learn Your Way (launched September 2025), an AI-personalized textbook that rewrites content to a reader's level and interests and reported an 11-point recall gain in a small randomized study, still faces the same adopt-or-decline judgment, what the lift costs in privacy, equity of access, and displaced cognitive work, before the test-score number can settle anything."),
], 'cat531/03/08 Learn Your Way')

# 04/02: attribute references
patch(B + '04/02.mdx', [
 ("- [AI and education datafication](https://doi.org/10.1080/17439884.2020.1686017)",
  "- Perrotta, C., & Selwyn, N. (2019). Deep learning goes to school: Toward a relational understanding of AI in education. Learning, Media and Technology. https://doi.org/10.1080/17439884.2020.1686017"),
], 'cat531/04/02 refs')

# 04/04: recent-evidence callout
patch(B + '04/04.mdx', [
 ("Privacy law treats children differently for a reason, and a defensible policy memo has to honor that difference in its design, not just its tone.",
  "Privacy law treats children differently for a reason, and a defensible policy memo has to honor that difference in its design, not just its tone. The stakes are documented, not rhetorical: breaches and enforcement actions against edtech vendors (including FTC actions over children's data practices) have repeatedly exposed student records collected under classroom defaults, and the amended COPPA Rule finalized in 2025 tightened what vendors may collect and retain from children under 13."),
], 'cat531/04/04 callout')

# 04/05: agreement-statistics scaffold
patch(B + '04/05.mdx', [
 ("Third, test for agreement and tighten where it fails. If you imagine a colleague applying your definitions and suspect they would code a turn differently, the definition is too loose. The fix is to sharpen the criterion until the disagreement disappears, which is the practical meaning of reliability.",
  "Third, test for agreement and tighten where it fails. If you imagine a colleague applying your definitions and suspect they would code a turn differently, the definition is too loose. The fix is to sharpen the criterion until the disagreement disappears, which is the practical meaning of reliability. The simplest formal check is percent agreement (you and a colleague agree on N of M coded turns); formal studies report a chance-corrected statistic such as Cohen's kappa (Cohen, 1960) because two raters can agree by luck on a small code set. The imagine-a-colleague move is the practical floor for a single teacher; the named statistics are where the same idea goes when stakes rise."),
], 'cat531/04/05 agreement scaffold')

# 04/07: NY facial-recognition anchor
patch(B + '04/07.mdx', [
 ("## Core Concept",
  "**This scenario has a real precedent.** In September 2023 the New York State Education Department barred public schools from purchasing or using facial-recognition technology, citing unproven safety benefits and documented misidentification of people of color; FERPA already treats the underlying images of identifiable students as education records. The proportionality test this section teaches is the same one that decision applied.\n\n## Core Concept"),
], 'cat531/04/07 NYSED anchor')

for r in results:
    print(*r)
