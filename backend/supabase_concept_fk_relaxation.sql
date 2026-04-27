-- Relax strict concept_id FKs so research-data writes never silently fail
-- when content (.meta.json) references a concept_id that has not been seeded
-- into the concepts table yet. concept_id remains a logical reference; if you
-- want enforcement back later, re-add the FK after a one-time seed pass.

-- learner_concept_state: drop "on delete cascade" FK to concepts(id).
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'learner_concept_state'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%references concepts%'
  loop
    execute format('alter table learner_concept_state drop constraint %I', r.conname);
  end loop;
end $$;

-- evaluation_responses: drop FK as well (was "on delete set null", same risk on insert).
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'evaluation_responses'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%references concepts%'
  loop
    execute format('alter table evaluation_responses drop constraint %I', r.conname);
  end loop;
end $$;

-- Keep an index on the soft reference so analytics joins stay fast.
create index if not exists learner_concept_state_concept_text_idx
  on learner_concept_state(concept_id);

create index if not exists evaluation_responses_concept_text_idx
  on evaluation_responses(concept_id);
