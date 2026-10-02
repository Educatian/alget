"""Generate personal Study IDs for the research study.

Usage:
    python generate_study_ids.py --basic 100 --bio 80 --out <folder>

Writes two files into <folder> (keep it OUTSIDE the git repo, e.g. UA OneDrive):
  study_ids_key.csv       study_id, track, name, email, invited_on, notes
                          -> the research team's private key; fill in name/email
                             when you email each participant their ID.
  study_ids_insert.sql    loads the IDs (no names) into public.study_invites;
                          run once in the Supabase SQL editor.
Re-running creates new, different IDs; existing ones are skipped on insert.
"""
import argparse
import csv
import pathlib
import secrets

from study_enrollment import ID_ALPHABET, STUDY_ID_PATTERN, STUDY_TRACKS


def new_id(prefix: str) -> str:
    chars = "".join(secrets.choice(ID_ALPHABET) for _ in range(8))
    return f"{prefix}-{chars[:4]}-{chars[4:]}"


def generate(counts: dict[str, int]) -> list[tuple[str, str]]:
    seen, rows = set(), []
    for track, n in counts.items():
        while sum(1 for _, t in rows if t == track) < n:
            sid = new_id(STUDY_TRACKS[track]["prefix"])
            if sid not in seen:
                seen.add(sid)
                rows.append((sid, track))
    assert all(STUDY_ID_PATTERN.match(s) for s, _ in rows)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--basic", type=int, default=0)
    ap.add_argument("--bio", type=int, default=0)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = generate({"basic": args.basic, "bio": args.bio})

    with open(out / "study_ids_key.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["study_id", "track", "name", "email", "invited_on", "notes"])
        w.writerows([sid, track, "", "", "", ""] for sid, track in rows)

    values = ",\n".join(f"  ('{sid}', '{track}')" for sid, track in rows)
    (out / "study_ids_insert.sql").write_text(
        "insert into public.study_invites (study_id, track) values\n"
        f"{values}\non conflict (study_id) do nothing;\n", encoding="utf-8")
    print(f"{len(rows)} IDs written to {out}")


if __name__ == "__main__":
    main()
