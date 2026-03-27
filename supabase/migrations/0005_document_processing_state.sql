alter table public.documents
  add column if not exists processing_status text not null default 'ready'
    check (processing_status in ('queued', 'processing', 'ready', 'failed'));

alter table public.documents
  add column if not exists processing_error text;

alter table public.documents
  add column if not exists low_confidence boolean not null default false;

update public.documents
set
  processing_status = case when coalesce(is_processed, false) then 'ready' else 'queued' end,
  low_confidence = coalesce(low_confidence, false)
where processing_status is null or low_confidence is null;
