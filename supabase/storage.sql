insert into storage.buckets (id, name, public)
values ('carecircle-documents', 'carecircle-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can view documents"
on storage.objects for select
to authenticated
using (bucket_id = 'carecircle-documents');

create policy "Authenticated users can upload documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'carecircle-documents');

create policy "Service role can manage documents"
on storage.objects for all
to service_role
using (bucket_id = 'carecircle-documents')
with check (bucket_id = 'carecircle-documents');
