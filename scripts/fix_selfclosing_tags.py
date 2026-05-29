"""Convert self-closing custom interactive tags <tag .../> to <tag ...></tag>.
HTML5 custom elements are not void; self-closing makes the parser nest following
siblings as children (which mapped components drop). Quote-aware scan so /> or >
inside attribute values is ignored. Usage: python scripts/fix_selfclosing_tags.py [glob]
"""
import sys, glob, re

TAGS = [
    'parameter-explorer', 'step-reveal', 'sequence-builder', 'branching-scenario',
    'concept-map', 'self-explain', 'inline-check', 'interactive-quiz',
    'dynamic-scenario', 'artifact-studio', 'worked-example', 'concept-diagram',
    'remotion-clip', 'youtube-embed',
    # diagram tags (also non-void custom elements; self-closing swallows siblings)
    'torque-diagram', 'kinematics-diagram', 'micro-turbulence-diagram',
    'fluid-dynamics-diagram', 'cellular-solid-diagram', 'hierarchical-structure-diagram',
    'directional-adhesion-diagram', 'gecko-adhesion-diagram', 'structural-color-diagram',
    'self-healing-diagram', 'swarm-diagram', 'constructivism-diagram', 'cognitivism-diagram',
    'behaviorism-diagram', 'formative-summative-diagram', 'rubric-design-diagram',
    'feedback-models-diagram', 'aeroacoustics-diagram',
]
TAGSET = set(TAGS)
open_re = re.compile(r'<(' + '|'.join(re.escape(t) for t in TAGS) + r')(?=[\s/>])')


def convert(text):
    out = []
    i = 0
    n = len(text)
    changed = 0
    while i < n:
        m = open_re.search(text, i)
        if not m:
            out.append(text[i:])
            break
        out.append(text[i:m.start()])
        tag = m.group(1)
        j = m.end()
        quote = None
        # scan to the end of the tag, respecting quotes
        while j < n:
            c = text[j]
            if c == '\\':  # skip escaped char (e.g. \" inside a double-quoted attr)
                j += 2
                continue
            if quote:
                if c == quote:
                    quote = None
                j += 1
                continue
            if c in ("'", '"'):
                quote = c
                j += 1
                continue
            if c == '>':
                # determine self-closing
                selfclose = text[j - 1] == '/'
                inner = text[m.start():j + 1]
                if selfclose:
                    # strip trailing '/' before '>'
                    inner = inner[:-2].rstrip()
                    if inner.endswith('/'):
                        inner = inner[:-1].rstrip()
                    out.append(inner + '></' + tag + '>')
                    changed += 1
                else:
                    out.append(inner)
                j += 1
                break
            j += 1
        else:
            out.append(text[m.start():])
            break
        i = j
    return ''.join(out), changed


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else 'frontend/content/*/*/*.mdx'
    total_files = total_conv = 0
    for f in glob.glob(pattern):
        t = open(f, encoding='utf-8').read()
        nt, c = convert(t)
        if c:
            open(f, 'w', encoding='utf-8', newline='\n').write(nt)
            total_files += 1
            total_conv += c
    print(f'files changed: {total_files} | tags converted: {total_conv}')


if __name__ == '__main__':
    main()
