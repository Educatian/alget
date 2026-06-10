# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))

results = []


def patch(p, edits, label):
    raw = open(p, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    nl = '\r\n' if '\r\n' in txt else '\n'
    ok = True
    for old, new in edits:
        new = new.replace('\n', nl)
        if old not in txt:
            results.append(('SKIP', label, old[:60]))
            ok = False
            continue
        txt = txt.replace(old, new, 1)
    out = txt.encode('utf-8')
    if bom:
        out = b'\xef\xbb\xbf' + out
    open(p, 'wb').write(out)
    if ok:
        results.append(('OK', label, ''))


B = 'frontend/content/cat100-supplement/'
REF = "- [NACE career readiness](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined)"

# 06/02 callout + SC 1.1.1 anchor
patch(B + '06/02.mdx', [
 ("If you cannot pass all three by reading the source, the page may look done but is not done.",
  "If you cannot pass all three by reading the source, the page may look done but is not done.\n\n**You do not have to catch every issue by eye.** Run your HTML through the [W3C Markup Validation Service](https://validator.w3.org/) for structure, and a browser accessibility audit (Lighthouse in Chrome/Edge DevTools, or axe DevTools) to flag images with missing alt text. Treat their reports as evidence in your revision trace."),
 ("[WCAG accessibility](https://www.w3.org/TR/WCAG22/) guidelines treat missing alt text on informative images as a failure, which is why this is not optional polish.",
  "[WCAG 2.2](https://www.w3.org/TR/WCAG22/) treats missing alt text on informative images as a failure of Success Criterion 1.1.1 (Non-text Content), a Level A criterion, which is why this is not optional polish."),
], 'cat100/06/02 x2')

# 06/03 case-sensitivity evidence
patch(B + '06/03.mdx', [
 ("3. **Entry-file check:** Is there a lowercase `index.html` at the level GitHub will serve? The root URL looks for `index.html`; a file named `Index.HTML` returns a 404 on case-sensitive servers.",
  "3. **Entry-file check:** Is there a lowercase `index.html` at the level GitHub will serve? The root URL looks for `index.html`; a file named `Index.HTML` returns a 404 on case-sensitive servers (see [GitHub's Pages 404 troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)). Note that a local preview on Windows or macOS may not surface the case bug, because those filesystems are case-insensitive by default; it only fails once published."),
], 'cat100/06/03')

# 06/04 alt text + Actions-tab scaffold
patch(B + '06/04.mdx', [
 ("![Publishing With GitHub Pages textbook visual](/course-art/deep-exemplars/cat100-supplement/06-04-publishing-with-github-pages.png)",
  "![Four-step workflow for this section: Artifact (GitHub Pages file tree) feeds Evidence (rubric, peer note, or usability trace), which feeds a Decision (accept, reject, or modify AI/software output), which feeds Revision (document visible change and limitation). Concept tags below name digital citizenship, Excel data storytelling, resume evidence, GitHub Pages, and privacy and account safety.](/course-art/deep-exemplars/cat100-supplement/06-04-publishing-with-github-pages.png)"),
 ("\"I pushed and nothing changed\" is usually \"the build has not completed and your browser is showing a cached copy.\"",
  "\"I pushed and nothing changed\" is usually \"the build has not completed and your browser is showing a cached copy.\" You can watch the wait instead of guessing: the repo's Actions tab shows the deploy workflow run (yellow = running, green = done, red = failed), and Settings > Pages reports \"Your site was last deployed\" with a timestamp."),
], 'cat100/06/04 x2')

# 06/05 CORS evidence
patch(B + '06/05.mdx', [
 ("Reject a fix that cannot apply (a CORS server config has nothing to do with a same-folder local image) or that is out of scope (rewriting everything to fix one tag).",
  "Reject a fix that cannot apply (a same-folder image loaded by a relative path is same-origin, so [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS), which governs cross-origin requests, does not apply) or that is out of scope (rewriting everything to fix one tag)."),
 (REF, REF + "\n- MDN Web Docs: Cross-Origin Resource Sharing (CORS). https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"),
], 'cat100/06/05 x2')

# 06/06 NACE evidence callout
patch(B + '06/06.mdx', [
 ("The measured result is what makes it concrete; even an approximate number (\"about twenty minutes\") beats no number.",
  "The measured result is what makes it concrete; even an approximate number (\"about twenty minutes\") beats no number. Employer surveys back the move: NACE's Job Outlook reporting shows hiring has shifted toward skills-based evaluation, with employers looking for evidence of skills through specific examples rather than role titles."),
], 'cat100/06/06')

# 06/07 three items: lychee option, NACE/ISTE naming, cybervetting callout
patch(B + '06/07.mdx', [
 ("He then runs the specificity and trigger checks by rewriting the survivors into a dated routine: trigger on the first day of each quarter, then four named steps (replace the oldest project card, export the current resume to assets/resume.pdf, click every nav and project link and fix any 404, open the live URL on a phone to confirm layout).",
  "He then runs the specificity and trigger checks by rewriting the survivors into a dated routine: trigger on the first day of each quarter, then four named steps (replace the oldest project card, export the current resume to assets/resume.pdf, click every nav and project link and fix any 404, open the live URL on a phone to confirm layout). Manual clicking is the floor; at scale, an automated link checker such as the open-source [lychee](https://github.com/lycheeverse/lychee) CLI or the W3C Link Checker produces a report a reviewer can confirm was actually run."),
 ("This is [ISTE digital citizenship](https://iste.org/standards/students) in its quiet form: maintaining what you publish is part of publishing responsibly, and a neglected site misleads the people who rely on it. [NACE career readiness](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined) frames the routine as professionalism;",
  "This is ISTE's Standard 1.2 Digital Citizen ([ISTE Standards for Students, 2024 edition](https://iste.org/standards/students)) in its quiet form: maintaining what you publish is part of publishing responsibly, and a neglected site misleads the people who rely on it. The NACE competency in play is [Professionalism](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined), one of the eight Career Readiness Competencies;"),
 ("## Opening Case",
  "## Opening Case\n\nEmployers do look: large majorities of recruiters report researching candidates online before hiring (CareerBuilder/Harris Poll surveys), and the \"cybervetting\" research literature confirms online-presence checks are a routine part of selection, so a stale or broken professional site is seen, not hypothetical."),
], 'cat100/06/07 x3')

# 06/08 leaked-secret order scaffold
patch(B + '06/08.mdx', [
 ("3. **History check:** Is the repo clean across its whole history, not just the latest snapshot? A secret in an old commit still fails privacy.",
  "3. **History check:** Is the repo clean across its whole history, not just the latest snapshot? A secret in an old commit still fails privacy.\n\nIf the history check fails, fix in this order: (1) revoke or rotate the key at the provider immediately, because bots probe public repos for credentials within minutes and anyone who saw the repo may already hold it; (2) purge it from history (git filter-repo or BFG Repo-Cleaner, or for a small personal repo simply recreate the repo clean; see [GitHub's removing-sensitive-data guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)); (3) re-verify the whole history. Purging history without rotating the key leaves the stolen credential alive."),
], 'cat100/06/08')

# 07/01 accessibility: alt + prose restatement
patch(B + '07/01.mdx', [
 ("![File Organization for Coursework textbook visual](/course-art/deep-exemplars/cat100-supplement/07-01-file-organization-for-coursework.png)",
  "![Four-step workflow for this section: Artifact (resume before-after revision) feeds Evidence (rubric, peer note, or usability trace), which feeds a Decision (accept, reject, or modify AI/software output), which feeds Revision (document visible change and limitation). Concept tags below name digital citizenship, Excel data storytelling, resume evidence, GitHub Pages, and privacy and account safety.](/course-art/deep-exemplars/cat100-supplement/07-01-file-organization-for-coursework.png)"),
], 'cat100/07/01 alt')

# 07/02 hedge + implementation intentions
patch(B + '07/02.mdx', [
 ("Most missed deadlines are not caused by forgetting a date. They are caused by confusing a due time with a work time.",
  "A common pattern behind missed deadlines is not forgetting a date but confusing a due time with a work time."),
 ("The system's value is catching the collision before it becomes a missed deadline.",
  "The system's value is catching the collision before it becomes a missed deadline. The work-block move is also one of the best-evidenced habits in the goal literature: forming a specific if-then plan for when and where you will act (an \"implementation intention\") reliably raises goal attainment, with a medium-to-large effect across 94 studies (Gollwitzer & Sheeran, 2006)."),
 (REF, REF + "\n- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38. https://doi.org/10.1016/s0065-2601(06)38002-1"),
], 'cat100/07/02 x2')

# 07/03 Microsoft references
patch(B + '07/03.mdx', [
 (REF, REF + "\n- Microsoft Support: Switch between relative, absolute, and mixed references (Excel). https://support.microsoft.com/en-us/office/switch-between-relative-absolute-and-mixed-references-dfec08cd-ae65-4f56-839e-5f0d8d0baca9\n- Microsoft Support: Save a workbook as a template (.xltx). https://support.microsoft.com/en-us/office/save-a-workbook-as-a-template-58c6625a-2c0b-4446-9689-ad8baec39e1e"),
], 'cat100/07/03')

# 07/04 hallucination evidence
patch(B + '07/04.mdx', [
 ("So every factual element (the greeting name, the deadline, the course number, the specific ask) gets checked against a real source before sending. Fluency is not evidence of accuracy.",
  "So every factual element (the greeting name, the deadline, the course number, the specific ask) gets checked against a real source before sending. Fluency is not evidence of accuracy; the hallucination research literature treats confidently stated false names and dates as a structural property of language models, not an occasional bug (Huang et al., 2024), which is why verification is structural, not optional."),
 (REF, REF + "\n- Huang, L., et al. (2024). A survey on hallucination in large language models: Principles, taxonomy, challenges, and open questions. ACM TOIS. https://doi.org/10.1145/3703155"),
], 'cat100/07/04 x2')

# 07/05 two items: recycle-bin citation + AI bulk-action callout
patch(B + '07/05.mdx', [
 ("## Transfer Case",
  "## Transfer Case\n\n**When the actor is an AI agent.** The same three checks apply when an AI assistant or agent proposes a bulk action (delete, move, send, overwrite), plus one more gate: require a dry-run preview of exactly what it would do before it acts, never grant an agent irreversible permissions without a current backup, and log the proposal in your accepted/modified/rejected note. A rejected bulk-delete suggestion, with the reason, is exactly the kind of entry that proves the judgment stayed with you."),
 (REF, REF + "\n- Microsoft Support: How to bypass the Recycle Bin when deleting files (Shift+Delete is permanent). https://support.microsoft.com/en-us/topic/how-to-bypass-the-recycle-bin-when-deleting-files-c343f9ef-1934-1bdb-9766-2d418d4cfe34\n- Microsoft Support: Restore a previous version of a file stored in OneDrive. https://support.microsoft.com/en-us/office/restore-a-previous-version-of-a-file-stored-in-onedrive-159cad6d-d76e-4981-88ef-de6e96c93893"),
], 'cat100/07/05 x2')

# 07/06 two items: coordination citation + AI-in-shared-doc callout
patch(B + '07/06.mdx', [
 ("Group work fails far more often from missing norms than from missing effort.",
  "Group work fails far more often from missing norms than from missing effort; coordination research has formalized this as \"process loss,\" where a group's actual output falls short of its potential because of unmanaged dependencies among members' work, which is exactly what shared norms manage (Malone & Crowston, 1994)."),
 ("## Transfer Case",
  "**When the collaborator is an AI.** If an assistant (Copilot in Word, Gemini in Google Docs) proposes changes to a shared group file, route its edits through suggesting mode, Track Changes, or comments so teammates can accept or reject them like any other edit, and disclose AI-generated contributions in the group's AI-use note. The norms do not change because the editor is a tool; they exist precisely so every change has a reviewable author.\n\n## Transfer Case"),
 (REF, REF + "\n- Malone, T. W., & Crowston, K. (1994). The interdisciplinary study of coordination. ACM Computing Surveys. https://doi.org/10.1145/174666.174668"),
], 'cat100/07/06 x3')

# 07/07 planning fallacy
patch(B + '07/07.mdx', [
 ("People are bad at estimating where their time goes, and they fix the wrong things as a result.",
  "People are bad at estimating where their time goes, and they fix the wrong things as a result; this is the well-documented planning fallacy, the systematic underestimation of how long tasks take (Buehler, Griffin, & Ross, 1994), which is why this section says measure, do not estimate."),
 (REF, REF + "\n- Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the \"planning fallacy\": Why people underestimate their task completion times. Journal of Personality and Social Psychology, 67(3). https://doi.org/10.1037/0022-3514.67.3.366"),
], 'cat100/07/07 x2')

# 07/08 index-document references
patch(B + '07/08.mdx', [
 ("A student finishes a workflow write-up, pushes the files to GitHub, and visits the site URL, only to see a 404. The HTML is perfect, but the file is named `home.html`, and a web server looks for `index.html` at the root by default.",
  "A student finishes a workflow write-up, pushes the files to GitHub, and visits the site URL, only to see a 404. The HTML is perfect, but the file is named `home.html`, and a web server looks for `index.html` at the root by default (GitHub Pages documents that it looks for `index.html`, `index.md`, or `README.md` as the entry file; the same convention is Apache's `DirectoryIndex index.html` default)."),
 (REF, REF + "\n- GitHub Docs: Creating a GitHub Pages site (entry file conventions). https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site\n- Apache HTTP Server: DirectoryIndex directive. https://httpd.apache.org/docs/2.4/mod/mod_dir.html"),
], 'cat100/07/08 x2')

# 08/01 secret-leak evidence + replace Tufte
patch(B + '08/01.mdx', [
 ("But in a public GitHub repository, automated bots scrape new commits for exactly these strings within minutes.",
  "But in a public GitHub repository, automated bots scrape new commits for exactly these strings within minutes; researchers who planted honeytoken AWS keys saw exploitation in about 30 minutes on average (Meli et al., 2019), and GitHub reported detecting 39 million leaked secrets in 2024, which is why push protection is now on by default."),
 ("- data-ink and visual evidence. https://www.edwardtufte.com/tufte/books_vdqi",
  "- Meli, M., McNiece, M. R., & Reaves, B. (2019). How bad can it Git? Characterizing secret leakage in public GitHub repositories. NDSS. https://doi.org/10.14722/ndss.2019.23418\n- GitHub Blog: Next evolution of push protection (39M secrets detected in 2024). https://github.blog/security/application-security/next-evolution-github-advanced-security/"),
], 'cat100/08/01 x2')

# 08/02 data-ink citation
patch(B + '08/02.mdx', [
 ("This connects to the data-ink principle: a slide that is mostly decoration buries the one number that matters, so the storyboard plans the evidence first and the styling last.",
  "This connects to the data-ink principle (Tufte's data-ink ratio: maximize the ink that shows the data, erase the rest; The Visual Display of Quantitative Information): a slide that is mostly decoration buries the one number that matters, so the storyboard plans the evidence first and the styling last."),
 ("- data-ink and visual evidence. https://www.edwardtufte.com/tufte/books_vdqi",
  "- Tufte, E. R. The Visual Display of Quantitative Information (data-ink ratio). https://www.edwardtufte.com/tufte/books_vdqi"),
], 'cat100/08/02 x2')

# 08/03 Barnett & Ceci
patch(B + '08/03.mdx', [
 ("The intellectual core is the difference between near transfer and far transfer.",
  "The intellectual core is the difference between near transfer and far transfer, a distinction that follows Barnett and Ceci's (2002) taxonomy of the dimensions along which a learned skill must travel to a new context."),
 (REF, REF + "\n- Barnett, S. M., & Ceci, S. J. (2002). When and where do we apply what we learn? A taxonomy for far transfer. Psychological Bulletin, 128(4). https://doi.org/10.1037/0033-2909.128.4.612"),
], 'cat100/08/03 x2')

# 08/05 feedback literacy
patch(B + '08/05.mdx', [
 ("## Common Misreadings",
  "**The research name for this skill is feedback literacy.** Carless and Boud (2018) define student feedback literacy around exactly these moves: appreciating feedback, making judgments about it, managing the affect it stirs, and taking selective action, which includes rejecting a suggestion with a reason when it would damage the work.\n\n## Common Misreadings"),
 (REF, REF + "\n- Carless, D., & Boud, D. (2018). The development of student feedback literacy: Enabling uptake of feedback. Assessment & Evaluation in Higher Education. https://doi.org/10.1080/02602938.2018.1463354"),
], 'cat100/08/05 x2')

# 08/06 triage evidence
patch(B + '08/06.mdx', [
 ("## Common Misreadings",
  "**Why severity-first ordering has evidence behind it.** Research on multiple-goal pursuit shows people systematically misallocate scarce time across competing deadlines (Ballard, Vancouver, & Neal, 2018), and software-engineering triage practice orders defect work by severity for the same reason: under a fixed budget, correctness failures cost more than cosmetic ones.\n\n## Common Misreadings"),
 (REF, REF + "\n- Ballard, T., Vancouver, J. B., & Neal, A. (2018). On the pursuit of multiple goals with different deadlines. Journal of Applied Psychology. https://doi.org/10.1037/apl0000304"),
], 'cat100/08/06 x2')

# 08/07 build-lag callout
patch(B + '08/07.mdx', [
 ("| Access | Link is public | Open it in an incognito or signed-out window and confirm no 404 |",
  "| Access | Link is public | Open it in an incognito or signed-out window and confirm no 404 |\n\nA signed-out 404 can also mean the GitHub Pages build has not finished yet (Pages publishes via a build workflow and can lag a minute or two after a push). Wait for the build to report success under the repo's Actions tab or Pages settings, then re-run the incognito test; the live URL is the source of truth."),
], 'cat100/08/07')

# 08/08 goal-setting evidence
patch(B + '08/08.mdx', [
 ("## Core Concept",
  "## Core Concept\n\n**The three moves below are each evidence-backed.** Specific, difficult goals outperform vague \"do your best\" intentions (Locke & Latham, 2002); attaching a concrete if-then plan for when and where you will act raises follow-through (Gollwitzer's implementation intentions); and sequencing learning so each task builds on verified prerequisite skill is the core of modern instructional-design models such as 4C/ID (van Merrienboer & Sweller)."),
 (REF, REF + "\n- Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation. American Psychologist, 57(9). https://doi.org/10.1037/0003-066X.57.9.705"),
], 'cat100/08/08 x2')

for r in results:
    print(*r)
