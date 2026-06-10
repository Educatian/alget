# -*- coding: utf-8 -*-
"""Reconcile cat531 sections whose apparatus is template-stamped to the DTS map
but whose body teaches a different work-product."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
B = 'frontend/content/cat531-supplement/'
OLD = 'Design Tension Studio map naming a classroom value conflict and negotiated decision'

SECTIONS = {
 '01/07': {
   'artifact': 'portfolio evidence entry (early artifact, later artifact, annotated reasoning delta, and a testable competency claim)',
   'short': 'portfolio evidence entry',
   'lo1': 'Build a portfolio evidence entry that pairs an early and a later artifact, annotates the reasoning delta between them, and states the competency claim as a testable hypothesis.',
   'desc': 'CAT 531 textbook section connecting portfolio evidence setup to a portfolio evidence entry: an early-plus-later artifact growth trace with an annotated reasoning delta and a competency claim stated as a testable hypothesis, reader notes, support moments, and revision evidence.',
 },
 '05/05': {
   'artifact': 'equity-oriented edtech evaluation matrix with gates applied before scored rows',
   'short': 'equity-oriented edtech evaluation matrix',
   'lo1': 'Build an edtech evaluation matrix that applies pass-or-fail gates (privacy, accessibility, equity) before scored criteria, and record eliminated tools rather than averaging a must-have away.',
   'desc': 'CAT 531 textbook section connecting classroom fit matrix to an equity-oriented edtech evaluation matrix with gates applied above scored rows, reader notes, support moments, and revision evidence.',
 },
 '07/03': {
   'artifact': 'technology observation note set (low-inference records, access distribution, and a deleted AI-added claim)',
   'short': 'technology observation note set',
   'lo1': 'Produce a low-inference technology observation note set a second observer could use to reach an independent conclusion, recording who had access and which AI-added claim was deleted and why.',
   'desc': 'CAT 531 textbook section connecting technology observation notes to a low-inference observation note set with access-distribution evidence and a documented deleted AI-added claim, reader notes, support moments, and revision evidence.',
 },
 '07/05': {
   'artifact': 'disaggregated student-voice exit-form trace (collection method, subgroup table, AI-theming check, lesson change, and report-back)',
   'short': 'disaggregated student-voice exit-form trace',
   'lo1': None,  # LO1 already section-specific
   'desc': 'CAT 531 textbook section connecting student voice and feedback to a disaggregated exit-form trace showing the collection method, subgroup table, AI-theming check, the lesson change, and the report-back to students, reader notes, support moments, and revision evidence.',
 },
 '08/07': {
   'artifact': 'evidence-collection checklist row (claim, source, baseline, dimensioned result, disconfirmation, verification path)',
   'short': 'evidence-collection checklist row',
   'lo1': 'Write an auditable evidence-collection checklist row that records the claim, source, baseline, dimensioned result, disconfirmation check, and a verification path a reviewer could follow.',
   'desc': 'CAT 531 textbook section connecting evidence collection checklist to an auditable evidence-collection checklist row with claim, source, baseline, dimensioned result, disconfirmation, and verification path, reader notes, support moments, and revision evidence.',
 },
}

for sec, spec in SECTIONS.items():
    # meta
    mp = B + sec + '.meta.json'
    m, fm = read_json_preserve(mp)
    if spec['lo1'] and OLD in m['learning_objectives'][0]:
        m['learning_objectives'][0] = spec['lo1']
    m['description'] = spec['desc']
    write_json_preserve(mp, m, fm)
    # mdx
    p = B + sec + '.mdx'
    raw = open(p, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    n0 = txt.count(OLD)
    # Learning Targets bullet (mirror of LO1)
    if spec['lo1']:
        txt = txt.replace('- Analyze how the ' + OLD + ' shows a defensible decision in CAT 531.',
                          '- ' + spec['lo1'])
    txt = txt.replace('download the ' + OLD + ' packet', 'download the ' + spec['short'] + ' packet')
    txt = txt.replace('artifact="' + OLD + '"', 'artifact="' + spec['artifact'] + '"')
    txt = txt.replace('compare a weak and strong version of the ' + OLD,
                      'compare a weak and strong version of the ' + spec['short'])
    txt = txt.replace('You are revising the ' + OLD, 'You are revising the ' + spec['short'])
    txt = txt.replace('check that the ' + OLD, 'check that the ' + spec['short'])
    n1 = txt.count(OLD)
    out = txt.encode('utf-8')
    if bom:
        out = b'\xef\xbb\xbf' + out
    open(p, 'wb').write(out)
    print(sec, 'occurrences', n0, '->', n1)
