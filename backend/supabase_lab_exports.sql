-- Lab CSV uploads (2026-10-28). Run once in the Supabase SQL editor.
--
-- Participants upload the CSV that a Simulation Lab exports (per-trial physics results
-- that the lab does not send to ALGET). Files live in a private bucket, one folder per
-- account: <user id>/<lab>-<time>.csv. Participants can add files to their own folder
-- only; they cannot list, read, change or delete files. Staff (is_alget_operator) can read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-exports', 'lab-exports', false, 2097152,
        array['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "lab_exports_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lab-exports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "lab_exports_staff_read"
on storage.objects for select to authenticated
using (bucket_id = 'lab-exports' and public.is_alget_operator());

-- Check: the bucket is private and both policies exist.
select id, public, file_size_limit from storage.buckets where id = 'lab-exports';
select policyname, cmd from pg_policies where tablename = 'objects' and policyname like 'lab_exports_%';
