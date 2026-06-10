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

# 05/01: ESSA evidence-tier callout
patch(B + '05/01.mdx', [
 ("## Decision Rule",
  "**Popularity outruns evidence.** Instructure/LearnPlatform's EdTech Evidence Report found that only about a third of 2024's forty most-used edtech tools had research meeting any of ESSA's four evidence tiers, and consumer technologies used in classrooms almost never do, so a tool's market position is measurably not a proxy for demonstrated learning impact.\n\n## Decision Rule"),
], 'cat531/05/01 ESSA callout')

# 05/02: Khanmigo case callout
patch(B + '05/02.mdx', [
 ("## Transfer Case",
  "**A live example of the gap.** As of 2025, Khan Academy had not run a randomized controlled trial of its widely promoted Khanmigo AI tutor (citing expense), while independent observers noted vendors marketing generative-AI tutors with little to no evidence that they match human tutoring, exactly the control, sample, and funder questions this section trains you to ask before believing an efficacy claim.\n\n## Transfer Case"),
], 'cat531/05/02 Khanmigo callout')

# 05/03: homework-gap statistic
patch(B + '05/03.mdx', [
 ("- **Equity** asks whether the tool imposes burdens unrelated to ability that fall unevenly across students, such as device ownership, home connectivity, cost, or language. Its population is whoever the tool's hidden requirements exclude.",
  "- **Equity** asks whether the tool imposes burdens unrelated to ability that fall unevenly across students, such as device ownership, home connectivity, cost, or language. Its population is whoever the tool's hidden requirements exclude. The scale is documented: Pew Research finds roughly a third of households with school-age children earning under $30,000 a year lack high-speed home internet (versus about 6% above $75,000), and about a quarter of lower-income teens report being unable to complete homework for lack of a reliable computer or connection (the \"homework gap\")."),
], 'cat531/05/03 homework gap')

# 05/04: AllHere/LAUSD collapse callout
patch(B + '05/04.mdx', [
 ("A tool with a low sticker price but a discontinuable free tier and no data export sits on a **sustainability cliff**: cheap until the day it strands your students' work.",
  "A tool with a low sticker price but a discontinuable free tier and no data export sits on a **sustainability cliff**: cheap until the day it strands your students' work. The cliff is real: in 2024 AllHere, the VC-backed company behind Los Angeles Unified's flagship \"Ed\" chatbot, abruptly furloughed staff mid-contract (about $3M of a five-year deal already spent), leaving the district to wind the tool down while a former engineer raised concerns about how student data had been handled (EdSurge, 2024)."),
], 'cat531/05/04 AllHere')

# 05/05: FERPA/COPPA anchor + MCDA callout
patch(B + '05/05.mdx', [
 ("The fix is **non-compensatory gating**: move the must-have out of the scored rows, apply it as a filter, and remove any tool that fails before computing any totals.",
  "The fix is **non-compensatory gating**: move the must-have out of the scored rows, apply it as a filter, and remove any tool that fails before computing any totals. (The compensatory versus non-compensatory distinction is standard multi-criteria decision analysis, not a course invention; see Cinelli et al., 2020, for the formal taxonomy.)"),
 ("**[AI and education datafication](https://doi.org/10.1080/17439884.2020.1686017)** often supplies a gate of its own: a privacy or data-handling line a high feature score cannot purchase past.",
  "**[AI and education datafication](https://doi.org/10.1080/17439884.2020.1686017)** often supplies a gate of its own: a privacy or data-handling line a high feature score cannot purchase past, typically a signed data-privacy agreement consistent with FERPA (20 U.S.C. 1232g) and, for under-13 students, the amended COPPA Rule, before any student accounts exist."),
], 'cat531/05/05 x2')

# 05/07: Messick/Kane validity anchor
patch(B + '05/07.mdx', [
 ("A reviewer's central move is to ask, for each conclusion, does the evidence offered actually measure this claim?",
  "A reviewer's central move is to ask, for each conclusion, does the evidence offered actually measure this claim? Measurement theory has names for this: construct-irrelevant variance and construct underrepresentation are the two classic validity threats (Messick, 1995), and reviewing a brief this way is a small argument-based validity audit in Kane's (2013) sense, where the conclusion is the proposed interpretation and the reviewer checks whether the offered evidence warrants it."),
], 'cat531/05/07 validity')

# 06/01: Illuminate-style breach callout
patch(B + '06/01.mdx', [
 ("## Opening Case",
  "## Opening Case\n\nThe stakes here are documented: the 2022 Illuminate Education breach exposed records, including disability and disciplinary data, of millions of students across thousands of districts, the kind of harm that classroom-level data minimization exists to limit."),
], 'cat531/06/01 breach callout')

# 06/02: disparate-error boundary callout
patch(B + '06/02.mdx', [
 ("## Transfer Case",
  "**When the value meets a biased tool.** Suppose your disclosed value is \"AI gives every student fast feedback,\" but the auto-feedback or detection tool performs measurably worse on multilingual or AAVE writers (Liang et al., 2023, documented exactly this disparate false-positive pattern for non-native English writers). The value as stated silently shifts burden onto those students, which forces a boundary: \"I check tool error rates by subgroup before trusting AI feedback.\" A disclosed value without that boundary is a promise the tool cannot keep equitably.\n\n## Transfer Case"),
], 'cat531/06/02 boundary callout')

# 06/05: fix references attribution (incl. bad Selwyn DOI)
patch(B + '06/05.mdx', [
 ("- [TPACK](https://en.wikipedia.org/wiki/Technological_pedagogical_content_knowledge). https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- critical edtech studies. https://doi.org/10.4324/9781315670160\n- [AI and education datafication](https://doi.org/10.1080/17439884.2020.1686017)",
  "- Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge: A framework for teacher knowledge. Teachers College Record. https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- Selwyn, N. (2016). Is technology good for education? Polity Press. ISBN 9780745696461.\n- Perrotta, C., & Selwyn, N. (2019). Deep learning goes to school: Toward a relational understanding of AI in education. Learning, Media and Technology. https://doi.org/10.1080/17439884.2020.1686017"),
], 'cat531/06/05 refs')

# 06/08: name scholars in text + refresh references
patch(B + '06/08.mdx', [
 ("critical edtech studies checks that the equity commitment survives into the plan and reflection rather than being announced and abandoned; datafication checks that the memo's promises match what the tool actually does.",
  "critical edtech studies (Selwyn) checks that the equity commitment survives into the plan and reflection rather than being announced and abandoned; datafication (Perrotta & Selwyn, 2019) checks that the memo's promises match what the tool actually does."),
 ("- [TPACK](https://en.wikipedia.org/wiki/Technological_pedagogical_content_knowledge). https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- critical edtech studies. https://doi.org/10.4324/9781315670160\n- [AI and education datafication](https://doi.org/10.1080/17439884.2020.1686017)",
  "- Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge: A framework for teacher knowledge. Teachers College Record. https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- Selwyn, N. (2016). Is technology good for education? Polity Press. ISBN 9780745696461.\n- Perrotta, C., & Selwyn, N. (2019). Deep learning goes to school: Toward a relational understanding of AI in education. Learning, Media and Technology. https://doi.org/10.1080/17439884.2020.1686017\n- Ning, Y., et al. (2024). Teachers' AI-TPACK: Exploring the relationship between knowledge elements. Sustainability, 16(3). https://doi.org/10.3390/su16030978"),
], 'cat531/06/08 x2')

# 07/01: FERPA/COPPA parenthetical in Transfer Case
patch(B + '07/01.mdx', [
 ("Take the same deepfake lesson to a different placement: a one-to-one laptop school, but with a strict district policy banning any tool that uploads student-created media to an outside server.",
  "Take the same deepfake lesson to a different placement: a one-to-one laptop school, but with a strict district policy banning any tool that uploads student-created media to an outside server (such policies track the real privacy regime: FERPA permits disclosing education records to third-party vendors without consent only under the narrow school-official exception, and the amended COPPA Rule, with compliance dates through April 2026, adds obligations for under-13 data including biometrics)."),
], 'cat531/07/01 privacy parenthetical')

# Also fix the possibly-wrong Selwyn DOI pairing introduced earlier in 01/02 and 02/05
for sec in ['01/02', '02/05']:
    patch(B + sec + '.mdx', [
     ("- Selwyn, N. (2016). Is technology good for education? (critical edtech studies). https://doi.org/10.4324/9781315670160",
      "- Selwyn, N. (2016). Is technology good for education? Polity Press. ISBN 9780745696461."),
    ], f'cat531/{sec} Selwyn DOI fix')

for r in results:
    print(*r)
