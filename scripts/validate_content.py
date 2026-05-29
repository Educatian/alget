#!/usr/bin/env python3
"""Validate the alget content layer against the canonical JSON Schemas.

Schemas live in frontend/content/_schema/v1/ (draft 2020-12), a versioned
namespace (see frontend/content/_schema/README.md for the migration policy).
This validator pins to schema major version v1. This validator
walks every section's meta / practice / misconceptions file, validates each
against its schema, and additionally runs cross-file structural checks that
JSON Schema alone cannot express:

  * duplicate problem ids within a practice file
  * multiple_choice correct_index out of options range
  * meta.practice_ids referencing problem ids that do not exist
  * practice.misconception_id referencing misconception ids that do not exist
    (reported as a soft warning, not a hard error)

It also runs CORPUS-LEVEL checks that span sections:

  * prerequisite graph integrity over meta.prereq_section_ids: dangling target
    (no meta file at that 'course/chapter/section' slug), self-reference, and
    cycle detection via topological sort (all HARD errors)
  * constructive-alignment soft-check: once practice_ids are populated AND a
    learning-objective linkage convention is present, flag any learning
    objective with no assessing practice item (soft warning only)

The prerequisite-target slug format is the one the backend engine keys on in
backend/server.py `_find_concept_origin`: "course/chapter/section", where
`course` is the top-level content directory, `chapter` is the chapter directory,
and `section` is the *.meta.json filename stem (e.g. "statics/01/01"). Course
content agents MUST populate prereq_section_ids using exactly this slug form.

If the `jsonschema` package is installed it is used for schema validation;
otherwise a small stdlib-only validator (sufficient for the constructs these
schemas use) is used so the check runs in CI with no extra dependency.

Exit code is non-zero when any HARD error is found.

Usage:  python scripts/validate_content.py
"""
from __future__ import annotations

import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(ROOT, "frontend", "content")
# Schemas live under a versioned namespace; this validator pins to v1.
# A future breaking change introduces _schema/v2/ and a migrator, and this
# pin is bumped deliberately (see frontend/content/_schema/README.md).
SCHEMA_VERSION = "v1"
SCHEMA_DIR = os.path.join(CONTENT_DIR, "_schema", SCHEMA_VERSION)


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------
# Schema validation: prefer jsonschema, fall back to a tiny stdlib validator.
# --------------------------------------------------------------------------
try:
    import jsonschema  # type: ignore

    _HAVE_JSONSCHEMA = True
except Exception:  # pragma: no cover - depends on environment
    _HAVE_JSONSCHEMA = False


def _type_ok(value, types):
    if isinstance(types, str):
        types = [types]
    for t in types:
        if t == "object" and isinstance(value, dict):
            return True
        if t == "array" and isinstance(value, list):
            return True
        if t == "string" and isinstance(value, str):
            return True
        if t == "integer" and isinstance(value, int) and not isinstance(value, bool):
            return True
        if t == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if t == "boolean" and isinstance(value, bool):
            return True
        if t == "null" and value is None:
            return True
    return False


def _mini_validate(value, schema, path, errors):
    """A minimal draft-2020-12 validator covering the constructs the alget
    schemas use: type, required, properties, additionalProperties, enum,
    const, items, minItems, minLength, minimum, pattern, if/then, anyOf, allOf,
    and $ref to local $defs (resolved via the closure in validate_against)."""
    if "$ref" in schema:
        target = _RESOLVE_REF(schema["$ref"])
        _mini_validate(value, target, path, errors)
        return

    if "type" in schema and not _type_ok(value, schema["type"]):
        errors.append(f"{path}: expected type {schema['type']}, got {type(value).__name__}")
        return

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}, got {value!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in allowed values {schema['enum']}")
    if "pattern" in schema and isinstance(value, str):
        if not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match pattern {schema['pattern']}")
    if "minLength" in schema and isinstance(value, str) and len(value) < schema["minLength"]:
        errors.append(f"{path}: string shorter than {schema['minLength']}")
    if "minimum" in schema and isinstance(value, (int, float)) and value < schema["minimum"]:
        errors.append(f"{path}: {value} < minimum {schema['minimum']}")

    if isinstance(value, dict):
        for req in schema.get("required", []):
            if req not in value:
                errors.append(f"{path}: missing required property '{req}'")
        props = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in props:
                    errors.append(f"{path}: additional property '{key}' not allowed")
        for key, subschema in props.items():
            if key in value:
                _mini_validate(value[key], subschema, f"{path}.{key}", errors)

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: fewer than {schema['minItems']} items")
        if "items" in schema:
            for i, item in enumerate(value):
                _mini_validate(item, schema["items"], f"{path}[{i}]", errors)

    for sub in schema.get("allOf", []):
        _mini_validate(value, sub, path, errors)

    if "anyOf" in schema:
        if not any(not _collect(value, sub, path) for sub in schema["anyOf"]):
            errors.append(f"{path}: does not satisfy any of the allowed shapes (anyOf)")

    if "if" in schema:
        if not _collect(value, schema["if"], path):
            if "then" in schema:
                _mini_validate(value, schema["then"], path, errors)
        elif "else" in schema:
            _mini_validate(value, schema["else"], path, errors)


def _collect(value, schema, path):
    """Return list of errors (used to test if/anyOf branches non-destructively)."""
    errs = []
    _mini_validate(value, schema, path, errs)
    return errs


# _RESOLVE_REF is rebound per-schema inside validate_against (closure over $defs).
_RESOLVE_REF = None


def validate_against(instance, schema, label):
    """Validate `instance` against `schema`, returning a list of error strings."""
    if _HAVE_JSONSCHEMA:
        validator = jsonschema.Draft202012Validator(schema)
        return [
            f"{label}: {e.message} (at {'/'.join(str(p) for p in e.absolute_path) or 'root'})"
            for e in validator.iter_errors(instance)
        ]
    # stdlib fallback
    global _RESOLVE_REF
    defs = schema.get("$defs", {})

    def resolve(ref):
        # only local "#/$defs/Name" refs are used
        name = ref.split("/")[-1]
        return defs[name]

    _RESOLVE_REF = resolve
    errors = []
    _mini_validate(instance, schema, label, errors)
    return errors


# --------------------------------------------------------------------------
# Cross-file structural checks.
# --------------------------------------------------------------------------
def cross_checks(section_label, meta, practice, misc):
    hard, soft = [], []

    problems = (practice or {}).get("problems", []) if isinstance(practice, dict) else []
    problem_ids = [p.get("id") for p in problems if isinstance(p, dict)]

    # duplicate problem ids
    dups = [pid for pid, n in collections.Counter(problem_ids).items() if pid and n > 1]
    for d in dups:
        hard.append(f"{section_label} [practice]: duplicate problem id '{d}'")

    # multiple_choice correct_index bounds
    for p in problems:
        if isinstance(p, dict) and p.get("type") == "multiple_choice":
            opts = p.get("options")
            ci = p.get("correct_index")
            if isinstance(opts, list) and isinstance(ci, int):
                if ci < 0 or ci >= len(opts):
                    hard.append(
                        f"{section_label} [practice]: correct_index {ci} out of range "
                        f"for {len(opts)} options (problem '{p.get('id')}')"
                    )

    # meta.practice_ids -> must reference existing problem ids
    if isinstance(meta, dict):
        for pid in meta.get("practice_ids", []) or []:
            if pid not in problem_ids:
                hard.append(
                    f"{section_label} [meta]: practice_ids references nonexistent "
                    f"problem id '{pid}'"
                )

    # practice.misconception_id -> existing misconception id (soft warning)
    misc_ids = set()
    if isinstance(misc, dict):
        misc_ids = {m.get("id") for m in misc.get("misconceptions", []) if isinstance(m, dict)}
    for p in problems:
        if isinstance(p, dict):
            mid = p.get("misconception_id")
            if mid and mid not in misc_ids:
                soft.append(
                    f"{section_label} [practice]: misconception_id '{mid}' "
                    f"(problem '{p.get('id')}') not found in misconceptions file"
                )

    return hard, soft


# --------------------------------------------------------------------------
# Corpus-level checks (span multiple sections).
# --------------------------------------------------------------------------
def prereq_graph_checks(section_metas):
    """Validate the prerequisite graph built from meta.prereq_section_ids.

    `section_metas` maps section slug ('course/chapter/section') -> meta dict.
    The slug form mirrors backend/server.py `_find_concept_origin`, which is the
    canonical key the adaptive engine uses to route prerequisite remediation.

    Returns (hard, soft). Hard errors:
      * dangling edge      -> prereq target slug has no meta in the corpus
      * self-reference     -> a section lists itself as its own prerequisite
      * cycle              -> the prereq graph is not a DAG (topological sort fails)
    The graph is empty today (all prereq_section_ids == []), so this yields zero
    errors until the course agents populate edges.
    """
    hard, soft = [], []
    known = set(section_metas)

    # adjacency: section -> list of prereq sections it depends on
    adj = {}
    for slug, meta in section_metas.items():
        targets = []
        if isinstance(meta, dict):
            raw = meta.get("prereq_section_ids") or []
            if isinstance(raw, list):
                for t in raw:
                    if not isinstance(t, str):
                        hard.append(
                            f"{slug} [meta]: prereq_section_ids entry is not a string ({t!r})"
                        )
                        continue
                    if t == slug:
                        hard.append(
                            f"{slug} [meta]: prereq_section_ids references itself"
                        )
                        continue
                    if t not in known:
                        hard.append(
                            f"{slug} [meta]: prereq_section_ids references nonexistent "
                            f"section slug '{t}' (expected form 'course/chapter/section')"
                        )
                        continue
                    targets.append(t)
        adj[slug] = targets

    # cycle detection via Kahn topological sort over the resolvable subgraph
    indeg = {n: 0 for n in adj}
    for n, deps in adj.items():
        for d in deps:
            # edge d -> n means "d is a prerequisite of n"; n depends on d
            indeg[n] += 1
    # Kahn: repeatedly remove nodes with no outstanding prerequisites.
    remaining = dict(adj)
    resolved = set()
    progress = True
    while progress:
        progress = False
        for n in list(remaining):
            if all(d in resolved for d in remaining[n]):
                resolved.add(n)
                del remaining[n]
                progress = True
    if remaining:
        cyc = sorted(remaining)
        hard.append(
            "prereq graph: cycle detected among sections "
            f"{cyc[:8]}{' ...' if len(cyc) > 8 else ''} "
            "(prereq_section_ids must form a DAG)"
        )

    return hard, soft


def alignment_checks(section_label, meta, practice):
    """Constructive-alignment soft-check.

    Fires only when (a) practice_ids are populated for the section AND (b) a
    learning-objective linkage convention is present, so it produces no false
    positives on the current corpus (LOs are plain strings with no id linkage and
    most sections have empty practice_ids). Two linkage conventions are accepted:

      * learning_objectives entries are objects carrying an `id`, and practice
        problems carry `learning_objective_id` / `learning_objective_ids` / `lo_id`.
      * meta carries an explicit `lo_practice_map` dict {lo_id: [problem_id, ...]}.

    When linkage exists, any learning objective with no assessing practice item is
    flagged as a soft warning (never a hard error).
    """
    soft = []
    if not isinstance(meta, dict):
        return soft
    practice_ids = meta.get("practice_ids") or []
    if not practice_ids:
        return soft  # nothing assessed yet -> alignment not yet auditable

    los = meta.get("learning_objectives") or []
    # collect structured LO ids, if any
    lo_ids = [lo.get("id") for lo in los if isinstance(lo, dict) and lo.get("id")]

    explicit_map = meta.get("lo_practice_map")
    if isinstance(explicit_map, dict) and lo_ids:
        for lo_id in lo_ids:
            mapped = explicit_map.get(lo_id) or []
            if not mapped:
                soft.append(
                    f"{section_label} [alignment]: learning objective '{lo_id}' has "
                    f"no assessing practice item (lo_practice_map)"
                )
        return soft

    # otherwise look for per-problem LO references in the practice file
    problems = (practice or {}).get("problems", []) if isinstance(practice, dict) else []
    assessed = set()
    have_links = False
    for p in problems:
        if not isinstance(p, dict):
            continue
        refs = []
        for key in ("learning_objective_id", "lo_id"):
            v = p.get(key)
            if isinstance(v, str):
                refs.append(v)
        for key in ("learning_objective_ids", "lo_ids"):
            v = p.get(key)
            if isinstance(v, list):
                refs.extend(x for x in v if isinstance(x, str))
        if refs:
            have_links = True
            assessed.update(refs)

    if have_links and lo_ids:
        for lo_id in lo_ids:
            if lo_id not in assessed:
                soft.append(
                    f"{section_label} [alignment]: learning objective '{lo_id}' has "
                    f"no assessing practice item"
                )
    return soft


# --------------------------------------------------------------------------
# Driver.
# --------------------------------------------------------------------------
def main():
    practice_schema = load_json(os.path.join(SCHEMA_DIR, "practice.schema.json"))
    meta_schema = load_json(os.path.join(SCHEMA_DIR, "meta.schema.json"))
    misc_schema = load_json(os.path.join(SCHEMA_DIR, "misconceptions.schema.json"))

    # discover sections: any *.meta.json defines a section
    metas = []
    for dirpath, _dirs, files in os.walk(CONTENT_DIR):
        if os.sep + "_schema" in dirpath:
            continue
        for f in files:
            if f.endswith(".meta.json"):
                metas.append(os.path.join(dirpath, f))
    metas.sort()

    hard_errors, soft_errors = [], []
    n_sections = 0
    section_metas = {}  # slug 'course/chapter/section' -> meta dict (for corpus checks)

    for meta_path in metas:
        n_sections += 1
        base = meta_path[: -len(".meta.json")]
        rel = os.path.relpath(base, CONTENT_DIR).replace(os.sep, "/")
        practice_path = base + ".practice.json"
        misc_path = base + ".misconceptions.json"

        meta = practice = misc = None

        for path, schema, kind in (
            (meta_path, meta_schema, "meta"),
            (practice_path, practice_schema, "practice"),
            (misc_path, misc_schema, "misconceptions"),
        ):
            if not os.path.exists(path):
                hard_errors.append(f"{rel} [{kind}]: file missing")
                continue
            try:
                data = load_json(path)
            except Exception as exc:
                hard_errors.append(f"{rel} [{kind}]: invalid JSON ({exc})")
                continue
            if kind == "meta":
                meta = data
            elif kind == "practice":
                practice = data
            else:
                misc = data
            hard_errors.extend(validate_against(data, schema, f"{rel} [{kind}]"))

        h, s = cross_checks(rel, meta, practice, misc)
        hard_errors.extend(h)
        soft_errors.extend(s)

        # constructive-alignment soft-check (no-op until practice_ids + LO links exist)
        soft_errors.extend(alignment_checks(rel, meta, practice))

        # record for corpus-level prereq graph check (slug == rel == course/chapter/section)
        if isinstance(meta, dict):
            section_metas[rel] = meta

    # corpus-level: prerequisite graph integrity (dangling / self-ref / cycle)
    gh, gs = prereq_graph_checks(section_metas)
    hard_errors.extend(gh)
    soft_errors.extend(gs)

    # ---------------------------------------------------------------- report
    backend = "jsonschema" if _HAVE_JSONSCHEMA else "stdlib-fallback"
    print(f"alget content validator  (engine: {backend})")
    print(f"sections scanned : {n_sections}")
    print(f"hard errors      : {len(hard_errors)}")
    print(f"soft warnings    : {len(soft_errors)}")

    if hard_errors:
        print("\n--- HARD ERRORS ---")
        for e in hard_errors:
            print("  ERROR  " + e)
    if soft_errors:
        print("\n--- SOFT WARNINGS (non-blocking) ---")
        for e in soft_errors:
            print("  warn   " + e)

    if hard_errors:
        print(f"\nFAILED: {len(hard_errors)} hard error(s).")
        return 1
    print("\nOK: all sections valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
