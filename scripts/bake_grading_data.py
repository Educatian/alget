#!/usr/bin/env python3
"""Bake grading data into the static content snapshot so the Cloudflare Worker
can grade practice problems with NO backend:

  1. Solver problems (solver_id + params, no static answer) -> run the Python
     reference solver once and inject expected_value / expected_unit /
     tolerance / steps, and retype to "numeric" so the Worker grades them
     against a static key.
  2. Attach each section's misconceptions (from <sec>.misconceptions.json) onto
     the snapshot section as a `misconceptions` list, so wrong-MCQ remediation
     still works client/worker-side.

Run AFTER scripts/export_static_content.mjs. Requires the backend deps on PATH
(run from repo root; imports backend/solvers).
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = os.path.join(ROOT, "frontend", "public", "api", "book")
CONTENT = os.path.join(ROOT, "frontend", "content")
sys.path.insert(0, os.path.join(ROOT, "backend"))

import solvers as solver_registry  # noqa: E402

baked_solvers = 0
attached_misc = 0
failed = []


def bake_section(course, chapter, section):
    global baked_solvers, attached_misc
    snap_path = os.path.join(SNAP, course, chapter, section)
    if not os.path.isfile(snap_path):
        return
    with open(snap_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    changed = False

    # 1. Solver answers
    practice = data.get("practice") or {}
    for prob in practice.get("problems", []) or []:
        sid = prob.get("solver_id")
        if sid and prob.get("expected_value") is None:
            try:
                res = solver_registry.run_solver(sid, prob.get("params") or {})
            except Exception as e:  # noqa: BLE001
                res = None
                failed.append(f"{course}/{chapter}/{section} {sid}: {e}")
            if res and res.get("expected_value") is not None:
                prob["expected_value"] = res.get("expected_value")
                prob["expected_unit"] = res.get("expected_unit", "")
                prob["tolerance"] = res.get("tolerance", 0.02)
                if res.get("steps"):
                    prob["steps"] = res.get("steps")
                # Retype so the worker's numeric grader handles it.
                if prob.get("type") not in ("numeric", "step_based"):
                    prob["type"] = "numeric"
                baked_solvers += 1
                changed = True

    # 2. Misconceptions sidecar
    misc_path = os.path.join(CONTENT, course, chapter, f"{section}.misconceptions.json")
    if os.path.isfile(misc_path):
        try:
            with open(misc_path, "r", encoding="utf-8") as fh:
                misc = json.load(fh)
            # File may be a list or {"misconceptions": [...]}.
            misc_list = misc.get("misconceptions") if isinstance(misc, dict) else misc
            if misc_list:
                data["misconceptions"] = misc_list
                attached_misc += 1
                changed = True
        except Exception as e:  # noqa: BLE001
            failed.append(f"{course}/{chapter}/{section} misconceptions: {e}")

    if changed:
        with open(snap_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh)


def main():
    for course in sorted(os.listdir(SNAP)):
        cdir = os.path.join(SNAP, course)
        if not os.path.isdir(cdir):
            continue
        for chapter in sorted(os.listdir(cdir)):
            chdir = os.path.join(cdir, chapter)
            if not os.path.isdir(chdir):
                continue
            for section in sorted(os.listdir(chdir)):
                if os.path.isfile(os.path.join(chdir, section)):
                    bake_section(course, chapter, section)

    print(f"baked {baked_solvers} solver answers, attached {attached_misc} misconception sets")
    if failed:
        print(f"{len(failed)} issues:")
        for f in failed[:20]:
            print("  ", f)


if __name__ == "__main__":
    main()
