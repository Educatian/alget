-- PostgreSQL truncates identifiers at 63 bytes. The original generated UNIQUE
-- constraint therefore used this shortened name and survived the hardening
-- migration's defensive drop.
alter table public.instructor_evidence_briefs
drop constraint if exists instructor_evidence_briefs_course_id_period_start_period_en_key;
