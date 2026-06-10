# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
B = 'frontend/content/cat531-supplement/'


def add_misc(sec, obj):
    p = B + sec + '.misconceptions.json'
    d, f = read_json_preserve(p)
    if any(x['id'] == obj['id'] for x in d['misconceptions']):
        print('skip dup misc', obj['id']); return
    d['misconceptions'].append(obj)
    write_json_preserve(p, d, f)


def add_prob(sec, obj):
    p = B + sec + '.practice.json'
    d, f = read_json_preserve(p)
    if any(x['id'] == obj['id'] for x in d['problems']):
        print('skip dup prob', obj['id']); return
    d['problems'].append(obj)
    write_json_preserve(p, d, f)
    mp = B + sec + '.meta.json'
    m, fm = read_json_preserve(mp)
    if 'practice_ids' in m and obj['id'] not in m['practice_ids']:
        m['practice_ids'].append(obj['id'])
        write_json_preserve(mp, m, fm)


# 02/04: objective-lowered misconception + retarget calibration
add_misc('02/04', {
 "id": "cat531_supplement_2_4_comparing_ai_suggestions_to_pedagogy_objective_lowered_to_fit_activity",
 "pattern": "objective_quietly_lowered_to_fit_activity",
 "description": "Quietly downgrading the objective verb (explain becomes match, analyze becomes identify) so an appealing AI-suggested activity fits the lesson.",
 "trigger": "teacher rewrites or reinterprets the objective at a lower cognitive level so the engaging activity can stay unchanged",
 "feedback": "Hold the verb fixed and raise the activity to it; never lower the goal to fit the activity. If the activity only produces matching, add the component that forces explaining (a sentence-stem justification, a compare-and-defend step) or replace the activity.",
 "rail_action": "ask"
})
p = B + '02/04.practice.json'
d, f = read_json_preserve(p)
for pr in d['problems']:
    if pr['id'].endswith('calibration'):
        pr['misconception_id'] = "cat531_supplement_2_4_comparing_ai_suggestions_to_pedagogy_objective_lowered_to_fit_activity"
        print('02/04 calibration retargeted')
write_json_preserve(p, d, f)

# 02/05: AI-rewrite-preserves-goal misconception
add_misc('02/05', {
 "id": "cat531_supplement_2_5_adapting_plans_for_learner_variability_ai_rewrite_preserves_goal",
 "pattern": "ai_simplification_assumed_faithful",
 "description": "Assuming an AI text simplification preserved the cognitive demand when it actually stripped out the complexity the objective asked students to analyze.",
 "trigger": "teacher assigns an AI-simplified source without comparing its demand to the original",
 "feedback": "Compare the adapted task's demand to the original before trusting it: easier reading is not the same thinking. If the objective asks students to analyze competing causes and the simplification removed all but one cause, the goal was quietly lowered in disguise.",
 "rail_action": "represent"
})

# 02/07 op3: AI-polish-as-evidence misconception + retarget ai_boundary
add_misc('02/07', {
 "id": "cat531_supplement_2_7_evidence_for_portfolio_entry_ai_polish_mistaken_for_skill",
 "pattern": "ai_polish_mistaken_for_skill_evidence",
 "description": "Treating the polished quality of an AI-assisted artifact as evidence of the competency, when polish is exactly what a tool can fabricate.",
 "trigger": "portfolio entry leans on artifact quality rather than an inspectable warrant and a measured outcome",
 "feedback": "Foreground what a tool cannot fabricate: the warrant linking the artifact to the standard and the measured outcome it produced. A beautiful artifact with no inspectable reasoning is weaker evidence than a rough one with a verifiable warrant.",
 "rail_action": "represent"
})

# 05/07: closure practice item
add_prob('05/07', {
 "id": "cat531_supplement_5_7_peer_review_of_evaluation_briefs_closure",
 "type": "multiple_choice",
 "concept_id": "evidence_based_revision",
 "stem": "A brief concludes 'the discussion tool supports equitable participation for quiet students,' and its evidence is that total posting volume rose 40%. Your review names the construct mismatch. Which specific evidence closes it?",
 "options": [
  "A larger rise in total posts next term, to confirm the trend.",
  "A per-student distribution of posts, showing whether quiet students participate more rather than a few students driving the total.",
  "A restatement of the conclusion with a citation to the vendor's whitepaper.",
  "Screenshots of the busiest discussion threads."
 ],
 "correct_index": 1,
 "explanation": "Total volume is blind to who is posting: three prolific students can produce the whole increase. The construct is equity of participation, so the closing evidence must show the distribution across students. More aggregate volume, restated conclusions, or vivid examples measure activity, not equity.",
 "difficulty": "hard",
 "concept_ids": ["evidence_based_revision"]
})

# 08/06: fallback-equivalence misconception + practice item
add_misc('08/06', {
 "id": "cat531_supplement_8_6_fallback_reaches_lower_target",
 "pattern": "fallback_reaches_lower_target",
 "description": "Offering a non-AI fallback that aims at an easier learning target, treating opt-out students as entitled to less rather than to an equivalent path.",
 "trigger": "fallback task drops the analysis or revision demand that the AI-assisted path requires",
 "feedback": "The fallback must reach the same learning target by other means: equivalent, not lesser. If the AI path asks students to critique and revise an argument, the fallback can use a teacher-provided exemplar to critique and revise, but it cannot downgrade to summarizing.",
 "rail_action": "represent"
})
add_prob('08/06', {
 "id": "cat531_supplement_8_6_ai_use_policies_and_fallbacks_equivalence",
 "type": "multiple_choice",
 "concept_id": "evidence_based_revision",
 "stem": "Your AI-assisted task: students generate an argument draft with a chatbot, then critique and revise it against the rubric. Two families opt out. Which fallback is defensible?",
 "options": [
  "Have opt-out students summarize the textbook chapter instead, since they cannot generate a draft.",
  "Give opt-out students a teacher-provided draft to critique and revise against the same rubric, so they practice the same target without the AI step.",
  "Excuse opt-out students from the assignment.",
  "Require opt-out students to watch classmates use the chatbot."
 ],
 "correct_index": 1,
 "explanation": "The learning target is critiquing and revising an argument against the rubric; the chatbot is only the draft source. A teacher-provided draft preserves the same cognitive work, making the fallback equivalent. Summarizing reaches a lower target, excusal reaches none, and watching others is not doing the work.",
 "misconception_id": "cat531_supplement_8_6_fallback_reaches_lower_target",
 "difficulty": "hard",
 "concept_ids": ["evidence_based_revision"]
})
print('cat531 batch B done')
