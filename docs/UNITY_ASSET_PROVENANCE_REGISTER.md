# Unity Asset Provenance Register

Status: **inventory complete; redistribution clearance not complete**
Audit date: 2026-08-15
Evidence: `research/evidence/unity_asset_provenance_2026-08-15.json`

This register is a release-control record, not legal advice. It deliberately does not infer ownership or grant reuse rights from a file being present in a local project.

## Current inventory

| Project | Fingerprinted media/binary assets | Current clearance state |
|---|---:|---|
| FinGripLabUnity | 47 | Pending |
| GeckoGripLabUnity | 12 | Pending |
| PineMorphLabUnity | 12 | Pending |
| TrabeculaLabUnity | 5 | Pending |
| **Total** | **76** | **Public redistribution blocked** |

The audit found no `LICENSE`, `LICENCE`, `OFL.txt`, or `COPYING` file adjacent to these Unity projects. Classification is therefore fail-closed:

- 74 project media/model assets: creator, owner, creation method, and any generative-AI/tool provenance must be confirmed;
- one `NotoSansKR-VF.ttf`: the likely upstream family and SIL Open Font License 1.1 are identified, but the exact binary source and required notice copy are not yet verified;
- one TextMesh Pro package binary: package provenance and redistribution record remain pending.

## Required row-level evidence before release

For every inventory row, add or link a record containing:

1. creator and current rights holder;
2. original source URL or controlled source file;
3. creation/acquisition date;
4. tool and, where applicable, generative-model name/version and human review statement;
5. exact license or written permission;
6. attribution/notice text and placement requirement;
7. modification history;
8. permission to redistribute in the intended public/research package; and
9. the matching SHA-256 from the machine-readable inventory.

Do not mark `redistribution_cleared=true` merely because an asset was created for this project, appears in a Unity build, or was downloaded from a site that allows viewing. Project code/content licensing must be selected only after this register and the corresponding ownership records are complete.
