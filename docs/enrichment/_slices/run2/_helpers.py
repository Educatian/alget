"""Shared helpers for the 2026-06-10 enrichment run: format-preserving JSON IO."""
import json, re

def read_json_preserve(path):
    raw = open(path, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    text = raw.decode('utf-8-sig')
    crlf = '\r\n' in text
    trailing_nl = text.endswith('\n')
    m = re.search(r'\n(\s+)"', text)
    indent = len(m.group(1).replace('\r', '')) if m else 2
    data = json.loads(text)
    return data, {'bom': bom, 'crlf': crlf, 'trailing_nl': trailing_nl, 'indent': indent}

def write_json_preserve(path, data, fmt):
    text = json.dumps(data, ensure_ascii=False, indent=fmt.get('indent', 2))
    if fmt['trailing_nl']:
        text += '\n'
    if fmt['crlf']:
        text = text.replace('\n', '\r\n')
    raw = text.encode('utf-8')
    if fmt['bom']:
        raw = b'\xef\xbb\xbf' + raw
    open(path, 'wb').write(raw)

def mdx_learning_targets(path):
    txt = open(path, encoding='utf-8-sig').read()
    m = re.search(r'^## Learning Targets\s*\n(.*?)(?=^## )', txt, re.S | re.M)
    if not m:
        return None
    return [re.sub(r'^[-*]\s+', '', l).strip()
            for l in m.group(1).strip().splitlines()
            if l.strip().startswith(('-', '*'))]

def section_base(section_key):
    course, ch, sec = section_key.split('/')
    return f'frontend/content/{course}-supplement/{ch}/{sec}'

BOILER = ['shows a defensible decision',
          'Distinguish artifact polish from evidence-based revision',
          'Document a bounded AI/software support move',
          'Use feedback, support requests, and revision notes']
