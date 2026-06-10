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


def add_prob(sec, obj, add_to_meta=False):
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


# 04/01 op3: knowledge-bound-decorative misconception
add_misc('04/01', {
 "id": "cat100_supplement_4_1_knowledge_bound_is_decorative",
 "pattern": "knowledge_bound_decorative",
 "description": "Writing a decorative knowledge bound like 'be accurate' or 'you know all of math' instead of naming a real, checkable source the AI must work from.",
 "trigger": "persona's KNOWLEDGE BOUND contains a quality adjective rather than a named source such as 'use the Grade 3 standards I paste'",
 "feedback": "A bound controls the model only if it names a checkable source ('use the standards I paste below'). 'Be accurate' is decoration; the model still invents, and you have no way to test compliance. Name the source, then you can verify every claim against it.",
 "rail_action": "represent"
})

# 04/04 op0: disproportionate-tone misconception + repoint ai_boundary
add_misc('04/04', {
 "id": "cat100_supplement_4_4_disproportionate_tone",
 "pattern": "urgency_to_seem_responsible",
 "description": "Adding alarming or urgent wording ('this is urgent and serious') to seem diligent, which fails the proportion check by alarming the reader without adding a fact.",
 "trigger": "the wording's intensity exceeds the actual stakes of the message",
 "feedback": "Concreteness, not intensity, is what makes a message land. The proportion check asks whether the tone matches the stakes: a routine reminder written as an emergency costs you credibility and buries the one fact and the one action the reader needs.",
 "rail_action": "explain"
})

# 04/06 op0: REJECT practice item + misconception
add_misc('04/06', {
 "id": "cat100_supplement_4_6_reject_not_logged",
 "pattern": "unrequested_addition_accepted",
 "description": "Accepting (or silently omitting) an unrequested AI addition instead of logging it as REJECTED with a reason, which inflates the artifact and hides a judgment call.",
 "trigger": "the AI volunteers an extra line or claim you did not ask for and it ships, or disappears, without a log row",
 "feedback": "Unrequested additions are decisions too. A confident-sounding extra line that you did not ask for gets its own log row: REJECT, with the reason. Silent omission hides the judgment; silent acceptance inflates the artifact. The log exists to show both.",
 "rail_action": "explain"
})
add_prob('04/06', {
 "id": "cat100_supplement_4_6_reflection_on_teacher_judgment_reject_row",
 "type": "multiple_choice",
 "concept_id": "ai_supported_learning",
 "stem": "While you compile your decision log, the AI offers to add a confident-sounding summary line you did not ask for: 'Overall, my judgments consistently outperformed the AI's suggestions.' What is the strongest log entry?",
 "options": [
  "ACCEPT it; a confident summary polishes the log.",
  "OVERRIDE it by toning the wording down slightly.",
  "REJECT it, with the reason: an unrequested self-congratulatory summary would hide the actual accept/override ratio the log exists to show.",
  "Leave it out silently; unrequested suggestions do not belong in the log."
 ],
 "correct_index": 2,
 "explanation": "The log's evidence is the pattern of decisions, including rejections. A flattering summary you did not ask for is itself a suggestion that must be judged, and it fails: it asserts a conclusion the rows may not support. Logging the rejection, with its reason, is what makes the judgment visible; silent omission erases the decision.",
 "misconception_id": "cat100_supplement_4_6_reject_not_logged",
 "difficulty": "hard",
 "concept_ids": ["ai_supported_learning"]
}, add_to_meta=True)

# 04/07 op1: replace ai_boundary with genuine AI-boundary item; op2: rename_as_proof misconception
add_misc('04/07', {
 "id": "cat100_supplement_4_7_rename_as_proof",
 "pattern": "overwrite_passed_off_as_revision",
 "description": "Renaming or keeping only the final file and claiming it proves revision happened, when no before/after evidence exists.",
 "trigger": "a claim of revision is backed by a single saved version",
 "feedback": "Save both versions (persona_v1.txt and persona_v2.txt) or drop the claim. A single final file, whatever it is named, cannot back 'I revised it'; the evidence of revision is the pair a reviewer can compare.",
 "rail_action": "represent"
})
add_misc('04/07', {
 "id": "cat100_supplement_4_7_unverified_ai_claim_kept",
 "pattern": "unverifiable_ai_claim_in_evidence",
 "description": "Keeping an AI-suggested claim in the evidence package when its source cannot be verified.",
 "trigger": "an AI-drafted statistic or citation enters the manifest without a verification row",
 "feedback": "Every AI suggestion that touches the evidence package gets a decision-log row: accepted with its verified source, or rejected with the reason it could not be verified. An unverifiable statistic is rejected, not softened.",
 "rail_action": "ask"
})

p = B + '04/07.practice.json'
d, f = read_json_preserve(p)
for pr in d['problems']:
    if pr['id'].endswith('ai_boundary'):
        pr['stem'] = "Your AI tutor suggests strengthening your evidence package with the line 'studies show 90% of students improve.' You search and cannot find a credible source. What belongs in your decision log?"
        pr['options'] = [
         "Add the line anyway; the tutor is usually right.",
         "Record it as REJECTED, with the reason that the statistic could not be verified, and keep the row in the log.",
         "Soften it to 'many students improve' so no source is needed.",
         "Delete the suggestion from the log so the package stays clean."
        ]
        pr['correct_index'] = 1
        pr['explanation'] = "The decision log is where AI suggestions meet evidence. A statistic with no verifiable source cannot enter the package in any wording; softening it just hides the same unverified claim. The defensible move is a logged rejection with its reason, which is itself evidence of your verification work (it ties to the 02_factcheck row)."
        pr['misconception_id'] = "cat100_supplement_4_7_unverified_ai_claim_kept"
        print('04/07 ai_boundary replaced')
write_json_preserve(p, d, f)
print('ch04 batch done')
