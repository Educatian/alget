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


# cat100/01/03: modify-path misconception + practice item
add_misc('01/03', {
 "id": "cat100_supplement_1_3_accept_or_reject_only",
 "pattern": "accept_or_reject_only",
 "description": "Treating every tutor or AI suggestion as a binary accept-or-reject and skipping the modify path that trims an overreaching suggestion down to a defensible claim.",
 "trigger": "learner logs only accepted and rejected suggestions and never records a modified one",
 "feedback": "Many suggestions are directionally right but overreach. The third move is modify: keep the direction, trim the claim to what you can defend, and log the change. A log with no modified rows usually means overreaching suggestions were swallowed whole or discarded wholesale.",
 "rail_action": "represent"
})
add_prob('01/03', {
 "id": "cat100_supplement_1_3_ethobot_cat100_orientation_modify_path",
 "type": "multiple_choice",
 "concept_id": "ai_supported_learning",
 "stem": "The tutor suggests replacing your resume line 'helped organize the volunteer program' with 'managed the entire volunteer program.' You coordinated one of its three committees. Which log entry is right?",
 "options": [
  "Accept: the tutor's version is stronger and recruiters like strong verbs.",
  "Reject: the suggestion touched your wording, so the whole idea is unusable.",
  "Modify: keep the stronger verb but trim to the defensible scope, e.g. 'coordinated one of three committees in the volunteer program,' and log what you changed and why.",
  "Accept now, and plan to soften it if anyone asks."
 ],
 "correct_index": 2,
 "explanation": "The suggestion is directionally right (the original undersells) but overreaches (you did not manage the entire program). The modify move keeps the improvement while keeping the claim defensible, and the log records the trim so a reviewer can see the judgment, not just the outcome.",
 "misconception_id": "cat100_supplement_1_3_accept_or_reject_only",
 "difficulty": "medium",
 "concept_ids": ["ai_supported_learning"]
}, add_to_meta=True)

# cat100/01/08: fix-without-recheck misconception + practice item
add_misc('01/08', {
 "id": "cat100_supplement_1_8_module_1_readiness_studio_fix_without_recheck",
 "pattern": "gap_marked_pass_without_reinspection",
 "description": "Marking a checklist row 'pass' as soon as a fix is intended or applied, without re-inspecting the actual artifact to confirm the fix took effect.",
 "trigger": "learner flips a flagged row to pass right after making a change, with no re-check on the artifact itself",
 "feedback": "A fix is a claim until you re-inspect. Re-open the setting, the page, or the document and confirm the gap is actually closed on the artifact; only then does the row earn its pass. Inspect, fix, re-inspect is one loop, not two steps.",
 "rail_action": "practice"
})
add_prob('01/08', {
 "id": "cat100_supplement_1_8_module_1_readiness_studio_recheck",
 "type": "multiple_choice",
 "concept_id": "evidence_based_revision",
 "stem": "Your readiness checklist flagged 'no two-factor authentication' as a gap. You just walked through your account's 2FA setup screens. Can you mark the privacy row 'pass'?",
 "options": [
  "Yes; you performed the fix, so the gap is closed.",
  "Not yet: re-open the account's security settings and confirm 2FA is actually showing as enabled before the row earns its pass.",
  "Yes, as long as you note the date you made the change.",
  "No; privacy rows can never be marked pass."
 ],
 "correct_index": 1,
 "explanation": "The distinctive failure of checklist work is fixing a gap and forgetting to re-inspect it. Setup flows fail silently (an unconfirmed code, an unsaved toggle), so the loop closes only when the artifact itself shows the fixed state. Inspect, fix, re-inspect.",
 "misconception_id": "cat100_supplement_1_8_module_1_readiness_studio_fix_without_recheck",
 "difficulty": "easy",
 "concept_ids": ["evidence_based_revision"]
}, add_to_meta=True)

# cat100/02/01: modesty misconception
add_misc('02/01', {
 "id": "cat100_supplement_2_1_modesty_buries_evidence",
 "pattern": "modesty_buries_evidence",
 "description": "Believing that omitting or softening a real, defensible achievement is more honest or humble than stating it.",
 "trigger": "learner deletes or hedges a truthful quantified accomplishment because it sounds like bragging",
 "feedback": "The standard is truthful and specific, not quiet. If you can defend the fact against a reference check, state it plainly with its number and scope; hiding a real result is not honesty, it is lost evidence.",
 "rail_action": "represent"
})

# cat100/02/02: blend-is-deliverable misconception
add_misc('02/02', {
 "id": "cat100_supplement_2_2_blend_is_deliverable",
 "pattern": "merged_output_as_deliverable",
 "description": "Treating a smooth merge of both AI tools' outputs as the deliverable, instead of the critique log that records the comparison and the decisions.",
 "trigger": "learner submits blended, polished text with no comparison or decision trace",
 "feedback": "The deliverable is the log: the agreement, conflict, and unique buckets, the tie-breaks against the posting or rubric, and what you accepted or rejected from each tool. A merged paragraph hides exactly the judgment the assignment exists to show.",
 "rail_action": "represent"
})

# cat100/03/04: Grand Total practice item
add_prob('03/04', {
 "id": "cat100_supplement_3_4_pivot_tables_as_summaries_grand_total",
 "type": "multiple_choice",
 "concept_id": "cat100_supplement_pivot_tables_as_summaries",
 "stem": "Your pivot shows West 1,200, East 550, South 150, Grand Total 1,900. A teammate reports 'our top region sold 1,900.' What is wrong?",
 "options": [
  "Nothing; 1,900 is the West total.",
  "1,900 is the all-data Grand Total across every region; the top region is West at 1,200. Quoting the Grand Total as one category is a category error.",
  "The pivot needs refreshing before any number can be quoted.",
  "1,900 is the order count, not the sales total."
 ],
 "correct_index": 1,
 "explanation": "The Grand Total row sums every category, so it can never be read as the value of one region. The top region is the largest category row (West, 1,200). Reading 1,900 as a region's sales is the Grand-Total-as-category error.",
 "misconception_id": "cat100_supplement_3_4_pivot_tables_as_summaries_grand_total_misread",
 "difficulty": "medium",
 "concept_ids": ["cat100_supplement_pivot_tables_as_summaries"]
}, add_to_meta=True)

# cat100/03/05: two misconceptions + privacy practice item
add_misc('03/05', {
 "id": "cat100_supplement_3_5_error_absence_equals_correct",
 "pattern": "error_absence_equals_correct",
 "description": "Treating the disappearance of the red error code as proof the formula is now correct.",
 "trigger": "learner applies a fix, sees #DIV/0! or #REF! vanish, and copies the formula down without checking a value",
 "feedback": "A fix can replace an error with a wrong number; silence is not correctness. Verify the repaired formula on a known-answer row (one you can compute by hand) before trusting or copying it.",
 "rail_action": "represent"
})
add_misc('03/05', {
 "id": "cat100_supplement_3_5_pasting_sensitive_data_to_ai",
 "pattern": "pasting_sensitive_data_to_ai",
 "description": "Pasting classmates' names, grades, or other private values into an AI tool to get formula help.",
 "trigger": "learner pastes a real data range containing personal information into a chat prompt",
 "feedback": "The tool needs the formula, the error, and the intended behavior, not the people's data. Describe the structure ('column B has scores, some blank') or use dummy values; the debugging prompt works exactly as well without the private cells.",
 "rail_action": "ask"
})
add_prob('03/05', {
 "id": "cat100_supplement_3_5_ai_help_for_excel_debugging_privacy_boundary",
 "type": "multiple_choice",
 "concept_id": "ai_supported_learning",
 "stem": "Your gradebook formula returns #VALUE! and you want AI help. The sheet contains classmates' names and scores. What belongs in the prompt?",
 "options": [
  "A screenshot of the whole sheet, so the AI has full context.",
  "The formula, the error code, and a description of the data's structure with dummy values; the names and real scores stay out.",
  "The names column only, since scores are the sensitive part.",
  "Nothing; AI tools may never be used on coursework files."
 ],
 "correct_index": 1,
 "explanation": "The four-part debugging prompt needs the formula, the wrong result, the suspected cause, and the desired behavior. None of those requires real people's data. Describing the structure or substituting dummy values gets the same quality of help without exposing private information.",
 "misconception_id": "cat100_supplement_3_5_pasting_sensitive_data_to_ai",
 "difficulty": "easy",
 "concept_ids": ["ai_supported_learning"]
}, add_to_meta=True)

# cat100/03/07 op1: percent-base misconception
add_misc('03/07', {
 "id": "cat100_supplement_3_7_narrating_a_data_finding_percent_base_error",
 "pattern": "wrong_base_for_percent_change",
 "description": "Computing percentage change against the wrong denominator, such as dividing the gap by the sum of both values or by the new value instead of the old.",
 "trigger": "learner reports a percentage change that does not equal (new - old) / old",
 "feedback": "Percentage change is (new - old) divided by the OLD value: (700 - 500) / 500 = 40%. Dividing by 1,000 (the sum) or by 700 (the new value) produces a different, wrong number that misstates the finding.",
 "rail_action": "represent"
})

# cat100/03/08 op1: polish-before-reconcile + integration misconceptions
add_misc('03/08', {
 "id": "cat100_supplement_3_8_module_3_data_story_studio_polish_before_reconcile",
 "pattern": "format_before_reconcile",
 "description": "Spending formatting effort on a polished slide before running the three-way match, which makes a wrong story look more credible.",
 "trigger": "learner styles the chart and headline before confirming headline, pivot cell, and bar height agree",
 "feedback": "Reconcile first, format last. A crisp chart can still carry a stale-pivot mismatch, and polish makes the wrong number more persuasive, not more correct. Run the headline=pivot=bar check, then style.",
 "rail_action": "represent"
})
add_misc('03/08', {
 "id": "cat100_supplement_3_8_module_3_data_story_studio_integration_assumed",
 "pattern": "integration_assumed_from_parts",
 "description": "Assuming that because each pipeline stage (clean, pivot, chart, narrate) worked alone, the assembled pipeline works together.",
 "trigger": "learner skips end-to-end checks after assembling individually verified stages",
 "feedback": "Integration introduces failures no single stage could: a refreshed pivot feeding a stale chart, a headline written from an earlier draft. Verify the assembled story end to end, not just each part in isolation.",
 "rail_action": "explain"
})
print('batch A done')
