# Supabase Engineering Study Migration Reconciliation

Audit date: 2026-08-15
Linked project: `tyyjkkykcggukfbkwpia`

## Decision

Do not run `supabase db push --linked` against the production project. The local and remote migration histories are divergent, no database branch exists, and the three engineering-study migrations are local-only. Production therefore remains unchanged.

## Observed history

Remote-only versions:

- `20260730082816` through `20260730224138` (10 migrations)

Local-only versions:

- `20260531234000`, `20260601050500`, `20260601062500`
- `20260730090000` through `20260730224500` (10 migrations)
- `20260804000000`
- `20260815000000`, `20260815010000`, `20260815020000`

Matched versions:

- `20260801000000`, `20260802000000`, `20260803000000`, `20260803010000`

The remote schema has the base `experiments`, `experiment_arms`, `experiment_assignments`, `cohort_learners`, and `interaction_events` tables with RLS enabled. It has no engineering-study relation or function. The deployed `experiment_assignments` table also lacks the course, stratum, seed-hash, ratio, and assignment-version columns used by the study claim contract; the local study migration now adds these as nullable, backward-compatible columns.

## Fetched-SQL equivalence result

The remote migration bodies were fetched read-only into a separate temporary project and compared with the repository using whitespace-insensitive diffs.

| Remote authoritative version | Local counterpart | Result |
|---|---|---|
| `20260730082816` | `20260730090000` | Same admin control-plane SQL; remote has a trailing standalone semicolon |
| `20260730210623` | `20260730100000` | Same agentic runtime SQL; remote has a trailing standalone semicolon |
| `20260730210630` | `20260730110000` | Same faculty partnership SQL; remote has a trailing standalone semicolon |
| `20260730210728` | `20260730210706` | Same RPC ACL hardening |
| `20260730210800` | `20260730210745` | Same faculty-table ACL hardening |
| `20260730221538` | `20260730220826` | Same course-access hardening; local also drops one truncated legacy constraint name |
| `20260730221617` | `20260730221604` | Same legacy-constraint cleanup |
| `20260730221734` | `20260730221716` | Same legacy-view/admin hardening |
| `20260730223403` | `20260730223213` | Same learner-invitation SQL |
| `20260730224138` | `20260730224500` | Formatting-only difference; same signup trigger/policy/ACL behavior |

The four matched `20260801*`–`20260803*` migrations are also logically identical after whitespace/blank-line normalization.

The three older local-only migrations are not merely speculative: their tables/views exist remotely and their source tables have RLS. Their history rows are missing because they predate the tracked remote migration sequence. In contrast, `20260804000000` is genuinely pending: its three private validation/guard functions and two triggers are absent. All three engineering-study migrations are also genuinely pending.

## Safe reconciliation sequence

1. Create a clean reconciliation branch or clone; do not edit history in the active dirty worktree.
2. Run `supabase migration fetch --linked` there and preserve the fetched remote SQL exactly. This audit completed that read-only fetch and recorded the mapping above.
3. Keep remote-applied version numbers and fetched SQL authoritative. Replace the ten timestamp-divergent local counterparts in the reconciliation branch; preserve the extra truncated-constraint cleanup as a new idempotent follow-up migration.
4. Never run `migration repair` merely to make the list look aligned. For the three foundational local versions, obtain explicit approval and archive the object/RLS evidence before marking them applied.
5. Keep `20260804000000` and `20260815*` pending; they represent real schema changes, not history repairs.
6. Make `supabase migration list --linked` show no unexplained local-only or remote-only historical versions before adding the three `20260815*` study migrations.
7. Apply the reconciled chain to an isolated staging project or paid preview branch first.
8. Run the Supabase security and performance advisors, then execute the role matrix: anonymous, ordinary authenticated, treatment learner, comparison learner, instructor, ALGET operator, and service role.
9. Set the three server-only `ALGET_STAGING_SUPABASE_*` environment variables and run `python scripts/qa_engineering_study_staging.py --acknowledge-staging`. The harness refuses project `tyyjkkykcggukfbkwpia`, creates synthetic fixtures only, and cleans them in a `finally` block.
10. Verify schedule import, no-argument claim, retry idempotence, wrong-roster denial, self-enrollment denial, crossover denial, service-role-only export, one-row-per-event behavior, malformed numeric tolerance, category hashing, and exclusion of nonstudy/other-course/free-text events.
11. Archive migration output, advisor output, policy/function/grant queries, the generated `research/evidence/engineering_staging_rls_qa.json`, and synthetic reconciliation counts before any production change.

## Study-migration security contract

- `engineering_study_allocation_schedule`: RLS enabled; no public, anonymous, or authenticated table privileges; service role only.
- `claim_engineering_study_assignment()`: no caller arguments; authenticated execution; `SECURITY DEFINER` with empty search path and fully qualified extension calls.
- `engineering_sim_event_export`: `security_invoker`; Bio-Inspired research-cohort and target-experiment scoped; one assignment join per event; prediction/result labels domain-separated and hashed; constraint state derived as a boolean; malformed numerics become null; input values, direct identifiers, and free response excluded; service-role-only select.
- Research roster: invitation-bound; learners cannot create Bio-Inspired research rows; ordinary instructors cannot read the restricted research roster.

## Current remote advisories

The remote project reports 12 security warnings and 177 performance notices. None names an engineering-study object because those objects are not deployed. Existing warnings include mutable function search paths, an extension in `public`, exposed security-definer functions, and leaked-password protection. They must be triaged separately from the study migration before confirmatory activation.
