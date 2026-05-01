insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', true)
on conflict do nothing;

drop policy if exists "Public read print files" on storage.objects;
create policy "Public read print files"
on storage.objects for select
using (bucket_id = 'print-files');

drop policy if exists "Service role write print files" on storage.objects;
create policy "Service role write print files"
on storage.objects for insert
with check (bucket_id = 'print-files' and auth.role() = 'service_role');

drop policy if exists "Service role update print files" on storage.objects;
create policy "Service role update print files"
on storage.objects for update
using (bucket_id = 'print-files' and auth.role() = 'service_role')
with check (bucket_id = 'print-files' and auth.role() = 'service_role');
