# -*- coding: utf-8 -*-
"""Scope 3: fix generic storyboard artifact labels left in ail606 ch04 meta/mdx."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
B = 'frontend/content/ail606-supplement/04/'
OLD = 'storyboard frame sequence with narration, signaling, and reader-action notes'

SPECS = {
 '02': {
   'artifact': 'principle-to-feature traceability matrix with named processing demands',
   'short': 'principle-to-feature traceability matrix',
   'desc': 'AIL 606 textbook section connecting principle-to-feature traceability to a traceability matrix that maps one controlling principle to one feature with its processing demand named, reader notes, support moments, and revision evidence.',
 },
 '05': {
   'artifact': 'WCAG 2.2 accessibility audit with per-criterion findings and reproducible fixes',
   'short': 'WCAG accessibility audit',
   'desc': 'AIL 606 textbook section connecting accessibility and WCAG checks to a WCAG 2.2 audit in which every change cites a success criterion and a reproducible result, reader notes, support moments, and revision evidence.',
 },
 '06': {
   'artifact': 'AI-authoring prompt specification with pedagogy audit and accept/reject log',
   'short': 'AI-authoring prompt specification',
   'desc': 'AIL 606 textbook section connecting AI-assisted authoring to a prompt specification that fixes every instructional decision, a pedagogy audit of the generated code, and a log of accepted and rejected suggestions, reader notes, support moments, and revision evidence.',
 },
}

# 04/01: prose mention + meta description
raw = open(B + '01.mdx', 'rb').read()
bom = raw.startswith(b'\xef\xbb\xbf')
txt = raw.decode('utf-8-sig')
old1 = 'Apply three tests before the storyboard frame sequence leaves the cover panel:'
assert old1 in txt
txt = txt.replace(old1, 'Apply three tests before the cover panel is allowed to anchor the rest of the design draft:', 1)
out = txt.encode('utf-8')
if bom:
    out = b'\xef\xbb\xbf' + out
open(B + '01.mdx', 'wb').write(out)
m, fm = read_json_preserve(B + '01.meta.json')
if OLD in m['description']:
    m['description'] = 'AIL 606 textbook section connecting problem statement and learner profile to a cover panel that names a located performance gap, its conditions, a measurable target, and the decision-bearing learner-profile attributes, reader notes, support moments, and revision evidence.'
    write_json_preserve(B + '01.meta.json', m, fm)
print('04/01 done')

for sec, spec in SPECS.items():
    p = B + sec + '.mdx'
    raw = open(p, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    n0 = txt.count(OLD)
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
    m, fm = read_json_preserve(B + sec + '.meta.json')
    if OLD in m['description']:
        m['description'] = spec['desc']
        write_json_preserve(B + sec + '.meta.json', m, fm)
    print(f'04/{sec}: mdx {n0} -> {n1}; meta desc updated')

# Sweep remaining ch04 meta files for the generic label in descriptions/LOs
import glob, json
for mp in sorted(glob.glob(B + '*.meta.json')):
    m, fm = read_json_preserve(mp)
    hits = (OLD in m.get('description', '')) + sum(OLD in lo for lo in m.get('learning_objectives', []))
    if hits:
        print('REMAINING generic label in', mp, hits)
