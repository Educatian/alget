"""Apply authored learning-objective rewrites to both meta.json and the MDX
Learning Targets block, format-preserving. Usage: python apply_authored_los.py <data.json> <ledger_out.json>"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _helpers import read_json_preserve, write_json_preserve, section_base, BOILER

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))

data = json.load(open(sys.argv[1], encoding='utf-8'))
ledger = []

def replace_mdx_targets(path, new_bullets):
    raw = open(path, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    txt = raw.decode('utf-8-sig')
    nl = '\r\n' if '\r\n' in txt else '\n'
    lines = txt.split(nl)
    try:
        h = lines.index('## Learning Targets')
    except ValueError:
        return False
    i = h + 1
    while i < len(lines) and not lines[i].strip().startswith(('-', '*')):
        if lines[i].strip().startswith('#'):
            return False
        i += 1
    j = i
    while j < len(lines) and lines[j].strip().startswith(('-', '*')):
        j += 1
    lines[i:j] = ['- ' + b for b in new_bullets]
    out = nl.join(lines).encode('utf-8')
    if bom:
        out = b'\xef\xbb\xbf' + out
    open(path, 'wb').write(out)
    return True

for key, spec in data.items():
    base = section_base(key)
    meta, fmt = read_json_preserve(base + '.meta.json')
    los = meta.get('learning_objectives', [])
    n_boiler = sum(1 for lo in los if any(b in lo for b in BOILER))
    if n_boiler < 1:
        ledger.append({'section_key': key, 'type': 'assessment_align', 'action': 'skipped',
                       'note': 'meta LOs no longer templated; anchor mismatch'})
        continue
    if 'lo1_only' in spec:
        new_los = [spec['lo1_only']] + los[1:]
    else:
        new_los = spec['los']
    meta['learning_objectives'] = new_los
    if 'description' in spec:
        meta['description'] = spec['description']
    write_json_preserve(base + '.meta.json', meta, fmt)
    ok = replace_mdx_targets(base + '.mdx', new_los)
    ledger.append({'section_key': key, 'type': 'assessment_align', 'action': 'applied',
                   'note': ('rewrote section-specific LOs in meta'
                            + ('+description' if 'description' in spec else '')
                            + ('+mdx Learning Targets' if ok else '; MDX block NOT found (check!)'))})

json.dump(ledger, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for l in ledger:
    print(l['action'], l['section_key'], '-', l['note'])
