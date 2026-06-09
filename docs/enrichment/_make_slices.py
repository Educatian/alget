"""Split _recovered_sections.json into per-(course,chapter) slice files for workflow agents.

- apply_<course>_<ch>.json  : confirmed accuracy_fix/currency_update (any pri) + other confirmed types (high pri only)
- verify_<course>_<ch>.json : unverified/no-status accuracy_fix/currency_update, high priority only
"""
import json, os, collections

base = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(base, "_recovered_sections.json"), encoding="utf-8"))
outdir = os.path.join(base, "_slices")
os.makedirs(outdir, exist_ok=True)

apply_slices = collections.defaultdict(list)
verify_slices = collections.defaultdict(list)
stats = collections.Counter()

for key, entry in data.items():
    course, ch, sec = key.split("/")
    ops = entry.get("final_opportunities") or entry.get("opportunities") or []
    apply_ops, verify_ops = [], []
    for op in ops:
        v = op.get("verified")
        t = op.get("type")
        pri = op.get("priority")
        if v == "confirmed":
            if t in ("accuracy_fix", "currency_update") or pri == "high":
                apply_ops.append(op)
                stats[f"{course} apply"] += 1
            else:
                stats[f"{course} confirmed-deferred"] += 1
        elif v == "refuted":
            stats[f"{course} refuted-skip"] += 1
        else:  # unverified or gap-stage (no verified field)
            if t in ("accuracy_fix", "currency_update") and pri == "high":
                verify_ops.append(op)
                stats[f"{course} verify"] += 1
            else:
                stats[f"{course} unverified-deferred"] += 1
    rec = {
        "section_key": key,
        "section_title": entry.get("section_title"),
        "dir": f"frontend/content/{course}-supplement/{ch}",
        "section_file_base": sec,
    }
    if apply_ops:
        apply_slices[(course, ch)].append({**rec, "opportunities": apply_ops})
    if verify_ops:
        verify_slices[(course, ch)].append({**rec, "opportunities": verify_ops})

manifest = {"apply": [], "verify": []}
for (course, ch), sections in sorted(apply_slices.items()):
    fn = f"apply_{course}_{ch}.json"
    json.dump(sections, open(os.path.join(outdir, fn), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    n = sum(len(s["opportunities"]) for s in sections)
    manifest["apply"].append({"file": f"docs/enrichment/_slices/{fn}", "course": course,
                              "chapter": ch, "sections": len(sections), "ops": n})
for (course, ch), sections in sorted(verify_slices.items()):
    fn = f"verify_{course}_{ch}.json"
    json.dump(sections, open(os.path.join(outdir, fn), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    n = sum(len(s["opportunities"]) for s in sections)
    manifest["verify"].append({"file": f"docs/enrichment/_slices/{fn}", "course": course,
                               "chapter": ch, "sections": len(sections), "ops": n})

json.dump(manifest, open(os.path.join(outdir, "_manifest.json"), "w", encoding="utf-8"), indent=1)
for k, v in sorted(stats.items()):
    print(f"{k}: {v}")
print("\nmanifest:")
for kind in ("apply", "verify"):
    for m in manifest[kind]:
        print(f"  {kind} {m['course']}/{m['chapter']}: {m['sections']} sections, {m['ops']} ops")
