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

# 01/01 new_callout: Liang inline
patch(B + '01/01.mdx', [
 ("Critical edtech studies: a summarizer trained on majority-register prose may flatten or misread multilingual students' contributions, quietly making their threads \"the ones that did not matter.\"",
  "Critical edtech studies: a summarizer trained on majority-register prose may flatten or misread multilingual students' contributions, quietly making their threads \"the ones that did not matter.\" This is a documented harm pattern, not a hypothetical: Liang et al. (2023) found GPT detectors misclassify non-native English writers' text as AI-generated at far higher rates than native writers' text, a disparate-error cost borne by multilingual students."),
], 'cat531/01/01 Liang callout')

# 01/02 evidence: attribute + modernize references
patch(B + '01/02.mdx', [
 ("- [TPACK](https://en.wikipedia.org/wiki/Technological_pedagogical_content_knowledge). https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- critical edtech studies. https://doi.org/10.4324/9781315670160",
  "- Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge: A framework for teacher knowledge. Teachers College Record. https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- Selwyn, N. (2016). Is technology good for education? (critical edtech studies). https://doi.org/10.4324/9781315670160\n- Ning, Y., et al. (2024). Teachers' AI-TPACK: Exploring the relationship between knowledge elements. Sustainability, 16(3). https://doi.org/10.3390/su16030978"),
], 'cat531/01/02 refs')

# 01/05 evidence x2: multilingual access anchor + illustrative-composite labels
patch(B + '01/05.mdx', [
 ("- **Learner composition.** Number of multilingual learners, students with IEP or 504 accommodations, reading-level spread. A text-only, fast-typing interaction model advantages some compositions and disadvantages others.",
  "- **Learner composition.** Number of multilingual learners, students with IEP or 504 accommodations, reading-level spread. A text-only, fast-typing interaction model advantages some compositions and disadvantages others; research on multilingual learners frames such interface and language demands as an access-and-equity variable, not a footnote (Grapin et al., 2023)."),
 ("Apply the comparison to a new claim: a vendor says its math-fluency game \"improved scores in a pilot of 200 students.\" A teacher is tempted to adopt it for her two sections.",
  "Apply the comparison to a new claim: a vendor says its math-fluency game \"improved scores in a pilot of 200 students\" (an illustrative composite of typical vendor pilot claims). A teacher is tempted to adopt it for her two sections. Setting-dependence of this kind is well documented at national scale: the growth-mindset experiment of Yeager et al. (2019) found the intervention worked only where peer norms supported it, the same context-moderates-effect logic this section teaches."),
], 'cat531/01/05 x2')

# 01/06 new_callout: FERPA/COPPA after Decision Rule
patch(B + '01/06.mdx', [
 ("3. **Revision check:** Did you log the deviation and route the evidence to whoever can change the policy?",
  "3. **Revision check:** Did you log the deviation and route the evidence to whoever can change the policy?\n\n**Privacy note before routing data upward.** A named-student deviation log and routing data are education records under FERPA, and for students under 13 the vendor side is governed by COPPA, whose amended rule was finalized in 2025 with compliance dates in 2026. Between the finalized COPPA amendments and the wave of state student-data-privacy and school-AI guidance, check your district's current policy before exporting named-student gap data beyond the building."),
], 'cat531/01/06 callout')

# 01/07 evidence x2: NBPTS anchor + portfolio reference
patch(B + '01/07.mdx', [
 ("Move the portfolio setup into a high-stakes context: a National Board or licensure portfolio where an external assessor scores entries blind, with no access to you.",
  "Move the portfolio setup into a high-stakes context: a National Board or licensure portfolio where an external assessor scores entries blind, with no access to you. This is literally how the NBPTS process works: candidates submit standards-based evidence (student work samples, video, teaching exhibits) scored against the Five Core Propositions by assessors who never meet them."),
], 'cat531/01/07 transfer')

# 01/07 references: find the refs block separately below
raw = open(B + '01/07.mdx', 'rb').read()
txt = raw.decode('utf-8-sig')
anchor = "- teacher professional judgment. https://doi.org/10.1177/002205741319300304"
if anchor in txt:
    nl = '\r\n' if '\r\n' in txt else '\n'
    txt = txt.replace(anchor, anchor + nl +
      "- NBPTS, Five Core Propositions and portfolio instructions. https://www.nbpts.org/certification/five-core-propositions/" + nl +
      "- Klenowski, V., Askew, S., & Carnell, E. (2005). Portfolios for learning, assessment and professional development in higher education. Assessment & Evaluation in Higher Education. https://doi.org/10.1080/02602930500352816", 1)
    out = txt.encode('utf-8')
    if raw.startswith(b'\xef\xbb\xbf'):
        out = b'\xef\xbb\xbf' + out
    open(B + '01/07.mdx', 'wb').write(out)
    results.append(('OK', 'cat531/01/07 refs', ''))
else:
    results.append(('SKIP', 'cat531/01/07 refs', anchor[:50]))

# 01/08 evidence: transfer literature
patch(B + '01/08.mdx', [
 ("The deep point is that transfer, not coverage, is the evidence of learning.",
  "The deep point is that transfer, not coverage, is the evidence of learning; the learning sciences make the same distinction, from Gick and Holyoak's (1983) analogical-transfer experiments to Barnett and Ceci's (2002) far-transfer taxonomy, where applying a principle to a genuinely new problem, not re-running the trained case, is what demonstrates understanding."),
], 'cat531/01/08 transfer evidence')

# 02/01 evidence x2: engagement-proxy anchor + real datafication case
patch(B + '02/01.mdx', [
 ("The most common error is to read engagement metrics (taps, logins, time-on-task) as evidence of learning.",
  "The most common error is to read engagement metrics (taps, logins, time-on-task) as evidence of learning; the learning-analytics literature itself warns that behavioral engagement proxies such as clickstream and time-on-task do not equate to learning outcomes (Bergdahl et al., 2024)."),
 ("| Data exposure | Responses stay in the room and disappear | Responses are stored, scored, and may be retained or profiled by a vendor under FERPA's \"school official\" exception (34 CFR § 99.31(a)(1)(i)(B)); outright sale or disclosure of identifiable records without consent is restricted |",
  "| Data exposure | Responses stay in the room and disappear | Responses are stored, scored, and may be retained or profiled by a vendor under FERPA's \"school official\" exception (34 CFR § 99.31(a)(1)(i)(B)); outright sale or disclosure of identifiable records without consent is restricted. The concern is concrete enough that New York State banned facial-recognition technology in schools in 2023 after a statewide privacy review |"),
], 'cat531/02/01 x2')

# 02/05 evidence: name TPACK authors, swap wiki links to DOI
patch(B + '02/05.mdx', [
 ("[TPACK](https://en.wikipedia.org/wiki/Technological_pedagogical_content_knowledge) and critical edtech studies add a caution:",
  "[TPACK](https://doi.org/10.1111/j.1467-9620.2006.00684.x) (Mishra & Koehler, 2006) and critical edtech studies (Selwyn) add a caution:"),
 ("- [TPACK](https://en.wikipedia.org/wiki/Technological_pedagogical_content_knowledge). https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- critical edtech studies. https://doi.org/10.4324/9781315670160",
  "- Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge: A framework for teacher knowledge. Teachers College Record. https://doi.org/10.1111/j.1467-9620.2006.00684.x\n- Selwyn, N. (2016). Is technology good for education? (critical edtech studies). https://doi.org/10.4324/9781315670160\n- Ning, Y., et al. (2024). Teachers' AI-TPACK: Exploring the relationship between knowledge elements. Sustainability, 16(3). https://doi.org/10.3390/su16030978"),
], 'cat531/02/05 x2')

# 02/06 new_callout: audit the tool's aggregate claims
patch(B + '02/06.mdx', [
 ("## Transfer Case",
  "**When the noticer is a tool.** If TeachGen@i (or any analytics dashboard) reports an aggregate pattern (\"engagement dropped in period 3\"), the noticing discipline extends to the tool's claim itself. Ask the same two questions you ask of your own impressions: is the AI's \"pattern\" a verifiable description or a vendor verdict, and does the class-level aggregate hide a subgroup the disaggregated tickets would reveal? Algorithmic-fairness research in education shows aggregate metrics routinely mask subgroup differences (Kizilcec & Lee, 2022), so describe-versus-verdict and moment-versus-pattern apply to machine noticing too.\n\n## Transfer Case"),
], 'cat531/02/06 callout')

# 02/07 evidence: Kofinas
patch(B + '02/07.mdx', [
 ("\"Uses formative assessment to revise instruction\" is not demonstrated by a polished plan; it is demonstrated by data you collected, the revision you made because of it, and what changed afterward.",
  "\"Uses formative assessment to revise instruction\" is not demonstrated by a polished plan; it is demonstrated by data you collected, the revision you made because of it, and what changed afterward. The generative-AI era makes this concrete: empirical work finds markers cannot reliably distinguish GenAI-assisted from unassisted student work (Kofinas et al., 2025, BJET), which is exactly why product polish fails as competency evidence and the inspectable warrant and measured outcome must carry the weight."),
], 'cat531/02/07 Kofinas')

# 02/08 accessibility: alt + linear framing for two-column note
patch(B + '02/08.mdx', [
 ("![Module 2 Teaching Plan Studio textbook visual](/course-art/deep-exemplars/cat531-supplement/02-08-module-2-teaching-plan-studio.png)",
  "![Four-step workflow for the Module 2 studio: Artifact (Ethobot transcript annotation) feeds Evidence (rubric, peer note, or usability trace), which feeds a Decision (accept, reject, or modify AI/software output), which feeds Revision (document visible change and limitation). Concept tags below name Design Tension Studio, TeachGen@i, Ethobot 3.2, classroom policy interpretation, and equity-oriented edtech evaluation.](/course-art/deep-exemplars/cat531-supplement/02-08-module-2-teaching-plan-studio.png)"),
 ("As you read, keep a two-column note: in the left column write each component of the plan; in the right column write the sentence explaining how it serves the single objective.",
  "As you read, keep a two-column note (in linear terms: for each component of the plan, pair it with the sentence explaining how it serves the single objective): in the left column write each component; in the right column write its objective-serving sentence."),
], 'cat531/02/08 a11y x2')

for r in results:
    print(*r)
