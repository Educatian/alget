# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
B = 'frontend/content/cat100-supplement/'


def add_misc(sec, obj):
    p = B + sec + '.misconceptions.json'
    d, f = read_json_preserve(p)
    if any(x['id'] == obj['id'] for x in d['misconceptions']):
        print('skip dup misc', obj['id']); return
    d['misconceptions'].append(obj)
    write_json_preserve(p, d, f)


def add_prob(sec, obj, add_to_meta=True):
    p = B + sec + '.practice.json'
    d, f = read_json_preserve(p)
    if any(x['id'] == obj['id'] for x in d['problems']):
        print('skip dup prob', obj['id']); return
    d['problems'].append(obj)
    write_json_preserve(p, d, f)
    if add_to_meta:
        mp = B + sec + '.meta.json'
        m, fm = read_json_preserve(mp)
        if 'practice_ids' in m and obj['id'] not in m['practice_ids']:
            m['practice_ids'].append(obj['id'])
            write_json_preserve(mp, m, fm)


# 05/02 op4: two named-in-text misconceptions
add_misc('05/02', {
 "id": "cat100_supplement_5_2_slide_structure_before_decoration_minimalism_means_structure",
 "pattern": "minimalism_means_structure",
 "description": "Equating fewer words with a structured slide, as if cutting the title to a short topic word were the same as making it an assertion.",
 "trigger": "learner cuts a title down to a three-word topic label and calls the slide structured",
 "feedback": "A short title is not the goal; a claim is. 'Results' is shorter than the assertion, but it states no point a reader could agree or disagree with. Structure means the title asserts the finding and the bullets prove it, at any length.",
 "rail_action": "represent"
})
add_misc('05/02', {
 "id": "cat100_supplement_5_2_slide_structure_before_decoration_beautiful_redesign_loses_claim",
 "pattern": "beautiful_redesign_loses_claim",
 "description": "Accepting an AI or template redesign that demotes the headline claim to a small caption while centering a beautiful image.",
 "trigger": "learner accepts a redesign that centers an image and shrinks or buries the assertion",
 "feedback": "Before accepting a redesign, check what happened to the claim. A layout that turns your assertion into a caption has traded the argument for decoration; reject or modify the suggestion so the claim stays the headline.",
 "rail_action": "ask"
})

# 06/06 op1: portfolio-evidence practice item + misconception
add_misc('06/06', {
 "id": "cat100_supplement_6_6_screenshot_or_claim_replaces_live_artifact",
 "pattern": "screenshot_or_claim_replaces_live_artifact",
 "description": "Treating a screenshot or a bare claim as sufficient portfolio evidence when the live published URL is the strongest, checkable evidence.",
 "trigger": "portfolio lists 'Built a website' with no link, or shows only a screenshot of the page",
 "feedback": "A reviewer trusts what they can open. Link the live URL and name what the artifact shows ('my CAT 100 data story, published at <URL>, with a working evidence link'); a screenshot can rot quietly and a claim cannot be checked at all.",
 "rail_action": "represent"
})
add_prob('06/06', {
 "id": "cat100_supplement_6_6_resume_and_reflection_page_live_evidence",
 "type": "multiple_choice",
 "concept_id": "evidence_based_revision",
 "stem": "Your GitHub Pages portfolio lists a project as 'Built a website.' Which revision gives a reviewer verifiable evidence?",
 "options": [
  "Add a stylish screenshot of the homepage next to the claim.",
  "Link the live URL and state what it shows: 'My CAT 100 data story (live at the linked page) with the published chart and source note.'",
  "Change the wording to 'Built a professional, responsive website.'",
  "Move the claim higher on the page so it is seen first."
 ],
 "correct_index": 1,
 "explanation": "On a published portfolio, the strongest evidence is the live artifact itself: a working link a reviewer can open plus a sentence naming what it demonstrates. A screenshot is unverifiable and ages; adjectives inflate without proving; placement changes salience, not evidence.",
 "misconception_id": "cat100_supplement_6_6_screenshot_or_claim_replaces_live_artifact",
 "difficulty": "medium",
 "concept_ids": ["evidence_based_revision"]
})

# 08/02 op0: accept-AI-reorder misconception + LO3 practice item
add_misc('08/02', {
 "id": "cat100_supplement_8_2_accept_all_ai_suggestions",
 "pattern": "accept_ai_reorder_without_reason",
 "description": "Accepting an AI's proposed slide order or framing without checking it against the audience question the deck must answer.",
 "trigger": "learner accepts the AI's reordering (such as opening with the resume) without testing it against the named audience's question",
 "feedback": "An AI reorder is a suggestion, not a decision. Test it against the audience question first; if the suggested opening answers a question this audience is not asking, reject it and record the reason, as with the rejected 'open with the resume' suggestion.",
 "rail_action": "explain"
})
add_prob('08/02', {
 "id": "cat100_supplement_8_2_professional_story_across_artifacts_ai_log",
 "type": "multiple_choice",
 "concept_id": "ai_supported_learning",
 "stem": "For a hiring-manager audience, an AI suggests opening your professional story deck with your full resume slide. Your log reads: 'Rejected: the manager's question is can this person do the job we posted; the opening must answer that with the strongest matching artifact, not a document they already have.' What makes this a strong bounded-AI move?",
 "options": [
  "It rejects the AI, and rejecting AI suggestions is always the safer call.",
  "It records the decision and ties the reason to the named audience's question, so a reviewer can audit why the suggestion failed.",
  "It is polite to the AI while still ignoring it.",
  "It shows the deck was made without AI involvement."
 ],
 "correct_index": 1,
 "explanation": "A bounded AI move is not about accepting or rejecting per se; it is about the documented judgment. The log names the suggestion, the call, and a reason anchored in the audience question, which is exactly what lets someone else verify the decision was principled rather than reflexive.",
 "misconception_id": "cat100_supplement_8_2_accept_all_ai_suggestions",
 "difficulty": "medium",
 "concept_ids": ["ai_supported_learning"]
})

# 08/05 op0: Modify practice item + misconception
add_misc('08/05', {
 "id": "cat100_supplement_8_5_modify_collapsed_to_accept_or_reject",
 "pattern": "modify_collapsed_to_accept_or_reject",
 "description": "Treating a Modify case as a binary accept/reject, either implementing a flawed fix verbatim or discarding the genuine need underneath it.",
 "trigger": "learner accepts a suggestion whose fix violates a constraint, or rejects it outright even though the underlying need is real",
 "feedback": "When a suggestion names a real need but proposes the wrong fix, the strongest log entry is Modify: implement the underlying intent a better way and record why the proposed version failed. Accept ships the flaw; reject loses the need.",
 "rail_action": "represent"
})
add_prob('08/05', {
 "id": "cat100_supplement_8_5_feedback_integration_log_modify_case",
 "type": "multiple_choice",
 "concept_id": "evidence_based_revision",
 "stem": "A peer suggests: 'Add a total row at the bottom of your budget table.' The need is real (readers want the total), but the table scrolls and a bottom row disappears off-screen. What is the strongest log entry?",
 "options": [
  "Accept: implement it exactly as suggested, at the bottom.",
  "Reject: the suggestion conflicts with the scrolling table, so the idea is unusable.",
  "Modify: place the total where it stays visible (a pinned summary line above the table), and record that the suggestion's need was real but its placement failed the visibility constraint.",
  "Not loggable: formatting choices do not belong in a feedback log."
 ],
 "correct_index": 2,
 "explanation": "This is the Modify case: a genuine underlying need (show the total) attached to a fix that violates a constraint (a bottom row scrolls out of view). Accepting ships the flaw, rejecting loses the need; modifying implements the intent a better way and the log records the diagnosis, which is the demanding part of the judgment.",
 "misconception_id": "cat100_supplement_8_5_modify_collapsed_to_accept_or_reject",
 "difficulty": "hard",
 "concept_ids": ["evidence_based_revision"]
})

# 08/07 op0: AI-confirms-complete misconception + repoint ai_boundary
add_misc('08/07', {
 "id": "cat100_supplement_8_7_ai_confirms_complete",
 "pattern": "trust_ai_completeness_claim",
 "description": "Treating an AI tool's claim that the submission is complete as verification, rather than running each test yourself.",
 "trigger": "learner accepts an AI 'everything is done' confirmation without opening files or testing links",
 "feedback": "An AI cannot open your exported PDF or load your link signed out. Let it draft the checklist, but verify every row against the real artifact yourself; the recipient's environment is the only test that counts.",
 "rail_action": "represent"
})
p = B + '08/07.practice.json'
d, f = read_json_preserve(p)
for pr in d['problems']:
    if pr['id'].endswith('ai_boundary') and pr.get('misconception_id', '').endswith('untested_link'):
        pr['misconception_id'] = "cat100_supplement_8_7_ai_confirms_complete"
        print('08/07 ai_boundary repointed')
write_json_preserve(p, d, f)
print('batch E done')
