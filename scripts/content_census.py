"""Quick prose word-count census across all section MDX bodies."""
import glob, statistics, re, os
from collections import defaultdict

courses = defaultdict(list)
gold = None
for f in glob.glob('frontend/content/*/*/*.mdx'):
    norm = f.replace(os.sep, '/')
    course = norm.split('frontend/content/')[1].split('/')[0]
    txt = open(f, encoding='utf-8').read()
    body = re.sub(r'<[^>]+>', ' ', txt)
    body = re.sub(r'```[\s\S]*?```', ' ', body)
    wc = len(body.split())
    courses[course].append((norm, wc))
    if norm.endswith('statics/01/01.mdx'):
        gold = wc

print(f"GOLD (statics/01/01): {gold} words\n")
print(f"{'course':<22}{'n':>4}{'min':>7}{'median':>8}{'max':>7}{'<800':>7}{'<1200':>7}")
for c in sorted(courses):
    wcs = sorted(w for _, w in courses[c])
    n = len(wcs)
    lt800 = sum(1 for w in wcs if w < 800)
    lt1200 = sum(1 for w in wcs if w < 1200)
    print(f"{c:<22}{n:>4}{wcs[0]:>7}{int(statistics.median(wcs)):>8}{wcs[-1]:>7}{lt800:>7}{lt1200:>7}")

allw = [w for v in courses.values() for _, w in v]
tot = len(allw)
print(f"\nTOTAL sections: {tot} | overall median: {int(statistics.median(allw))} | <1200w: {sum(1 for w in allw if w<1200)} | <800w: {sum(1 for w in allw if w<800)}")
