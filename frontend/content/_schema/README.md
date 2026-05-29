# Content schema namespace

This directory holds the canonical JSON Schemas (draft 2020-12) that every
authored section file is validated against. The schemas are the contract for the
content layer under `frontend/content/`: one schema per authored file kind.

## Layout

```
_schema/
  README.md            <- this file
  v1/
    meta.schema.json            (*.meta.json)
    practice.schema.json        (*.practice.json)
    misconceptions.schema.json  (*.misconceptions.json)
```

Schemas live under a versioned subfolder (`v1/`) rather than at the top level.
Each schema carries a versioned identity:

- `$id` is namespaced with the major version, e.g.
  `alget://schema/v1/practice.schema.json`.
- `schemaVersion` carries the full semantic version, e.g. `"1.0.0"`.

The current contract is **v1 (1.0.0)**. It is the same accepted shape the corpus
already conforms to (256 sections, 0 hard errors); moving the files into `v1/`
and stamping the version is namespacing only, not a shape change.

## Versioning

The schema set follows semantic versioning, with the major version pinned by the
directory name (`v1/`):

- **Patch** (`1.0.0 -> 1.0.1`) — wording/`description` clarifications, comments,
  or constraint fixes that do not change which documents are accepted or
  rejected. Bump `schemaVersion`; stay in `v1/`.
- **Minor** (`1.0.0 -> 1.1.0`) — strictly **additive** changes: new optional
  properties, a new permitted `type` variant, a looser constraint. Existing valid
  content stays valid. Bump `schemaVersion`; stay in `v1/`.
- **Major** (`1.x -> 2.0.0`) — any **breaking** change: a newly required field, a
  removed/renamed property, a tightened constraint, or a changed accepted shape.
  This gets its own `v2/` folder and `$id` namespace (`alget://schema/v2/...`).

## Forward-migration policy

New **minor** versions are additive and backward-compatible, so existing content
keeps validating unchanged and only the `schemaVersion` is bumped within the same
`vN/` folder. A **breaking** change is never made in place: it gets a new
`v(N+1)/` folder plus a one-shot content migrator (a script that rewrites every
authored file from the old shape to the new one), and validators are repinned to
the new version only after the corpus has been migrated and re-validates clean.
Validators always pin to exactly one major version (`scripts/validate_content.py`
sets `SCHEMA_VERSION = "v1"` and loads schemas from `_schema/v1/`), so a new major
version can land alongside the old one without silently changing what the active
validator enforces; the pin is moved deliberately as part of the migration.
