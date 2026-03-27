alter table public.documents add column if not exists file_storage_path text;
alter table public.documents add column if not exists visible_to_doctor boolean not null default true;
alter table public.documents add column if not exists visible_to_secondary boolean not null default true;
alter table public.documents add column if not exists visible_to_family boolean not null default false;
alter table public.documents add column if not exists notes text;

alter table public.care_journal add column if not exists is_shared_with_doctor boolean not null default false;
alter table public.care_journal add column if not exists is_family_note boolean not null default false;
alter table public.care_journal add column if not exists is_clinical_note boolean not null default false;

create table if not exists public.audit_log (
  id text primary key default public.generate_text_id('audit'),
  patient_id text references public.patients(id) on delete set null,
  actor_id text references public.users(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id text,
  outcome text not null default 'allowed' check (outcome in ('allowed', 'blocked')),
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_patient on public.audit_log(patient_id, created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id, created_at desc);
create index if not exists idx_audit_log_action on public.audit_log(action, created_at desc);

create table if not exists public.clinical_notes (
  id text primary key default public.generate_text_id('clinical'),
  patient_id text not null references public.patients(id) on delete cascade,
  doctor_id text not null references public.users(id) on delete cascade,
  doctor_name text not null,
  doctor_specialty text,
  note_type text not null default 'general' check (note_type in ('general', 'diagnosis', 'prescription_note', 'lab_interpretation', 'referral', 'follow_up', 'progress')),
  title text,
  content text not null,
  clinical_impression text,
  recommendations text,
  related_appointment_id text references public.appointments(id) on delete set null,
  is_visible_to_caregiver boolean not null default true,
  is_visible_to_family boolean not null default false,
  ai_suggested_content text,
  doctor_reviewed_ai boolean not null default false,
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists clinical_notes_set_updated_at on public.clinical_notes;
create trigger clinical_notes_set_updated_at
before update on public.clinical_notes
for each row execute function public.set_updated_at();

create or replace function public.populate_clinical_note_doctor_identity()
returns trigger as $$
begin
  select u.name, u.specialty
  into new.doctor_name, new.doctor_specialty
  from public.users u
  where u.id = new.doctor_id;

  if new.doctor_name is null then
    raise exception 'Doctor profile not found for clinical note';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists clinical_notes_set_doctor_identity on public.clinical_notes;
create trigger clinical_notes_set_doctor_identity
before insert on public.clinical_notes
for each row execute function public.populate_clinical_note_doctor_identity();

create index if not exists idx_clinical_notes_patient on public.clinical_notes(patient_id, created_at desc);
create index if not exists idx_clinical_notes_doctor on public.clinical_notes(doctor_id, created_at desc);

create table if not exists public.weekly_summaries (
  id text primary key default public.generate_text_id('weekly'),
  patient_id text not null references public.patients(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary_text text,
  data_snapshot jsonb not null default '{}'::jsonb,
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, week_start)
);

create index if not exists idx_weekly_summaries_patient on public.weekly_summaries(patient_id, week_start desc);
