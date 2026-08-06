alter table public.technician_certifications
  add column if not exists evidence_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-files', 'certificate-files', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "managers_view_certificate_files" on storage.objects;
drop policy if exists "managers_upload_certificate_files" on storage.objects;
drop policy if exists "managers_delete_certificate_files" on storage.objects;

create policy "managers_view_certificate_files"
on storage.objects for select to authenticated
using (bucket_id = 'certificate-files' and (select private.is_manager()));

create policy "managers_upload_certificate_files"
on storage.objects for insert to authenticated
with check (bucket_id = 'certificate-files' and (select private.is_manager()));

create policy "managers_delete_certificate_files"
on storage.objects for delete to authenticated
using (bucket_id = 'certificate-files' and (select private.is_manager()));
