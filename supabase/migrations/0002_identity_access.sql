create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.generate_text_id(prefix text default 'id')
returns text as $$
begin
  return prefix || '_' || encode(gen_random_bytes(8), 'hex');
end;
$$ language plpgsql;

create or replace function public.generate_token(token_length integer default 24)
returns text as $$
begin
  return encode(gen_random_bytes(token_length), 'hex');
end;
$$ language plpgsql;

create or replace function public.default_access_permissions(p_member_role text, p_level text default null)
returns jsonb as $$
declare
  normalized_role text := coalesce(p_member_role, 'family_member');
  normalized_level text := coalesce(p_level, 'view_only');
begin
  if normalized_role = 'primary_caregiver' then
    return jsonb_build_object(
      'can_view_medications', true,
      'can_log_medications', true,
      'can_view_journal', true,
      'can_add_journal', true,
      'can_view_vitals', true,
      'can_view_vitals_raw', true,
      'can_log_vitals', true,
      'can_view_documents', true,
      'can_upload_documents', true,
      'can_view_appointments', true,
      'can_add_appointments', true,
      'can_view_tasks', true,
      'can_complete_tasks', true,
      'can_add_tasks', true,
      'can_view_insurance', true,
      'can_view_emergency_protocol', true,
      'can_generate_emergency_protocol', true,
      'can_chat', true,
      'can_view_ai_insights', true,
      'can_export_data', true,
      'can_add_clinical_notes', false
    );
  end if;

  if normalized_role = 'secondary_caregiver' then
    return jsonb_build_object(
      'can_view_medications', true,
      'can_log_medications', true,
      'can_view_journal', true,
      'can_add_journal', true,
      'can_view_vitals', true,
      'can_view_vitals_raw', true,
      'can_log_vitals', true,
      'can_view_documents', true,
      'can_upload_documents', true,
      'can_view_appointments', true,
      'can_add_appointments', true,
      'can_view_tasks', true,
      'can_complete_tasks', true,
      'can_add_tasks', true,
      'can_view_insurance', false,
      'can_view_emergency_protocol', true,
      'can_generate_emergency_protocol', false,
      'can_chat', true,
      'can_view_ai_insights', true,
      'can_export_data', false,
      'can_add_clinical_notes', false
    );
  end if;

  if normalized_role = 'doctor' then
    return jsonb_build_object(
      'can_view_medications', true,
      'can_log_medications', false,
      'can_view_journal', true,
      'can_add_journal', false,
      'can_view_vitals', true,
      'can_view_vitals_raw', true,
      'can_log_vitals', false,
      'can_view_documents', true,
      'can_upload_documents', false,
      'can_view_appointments', true,
      'can_add_appointments', false,
      'can_view_tasks', false,
      'can_complete_tasks', false,
      'can_add_tasks', false,
      'can_view_insurance', false,
      'can_view_emergency_protocol', true,
      'can_generate_emergency_protocol', false,
      'can_chat', false,
      'can_view_ai_insights', true,
      'can_export_data', false,
      'can_add_clinical_notes', true
    );
  end if;

  if normalized_level = 'full_access' then
    return jsonb_build_object(
      'can_view_medications', true,
      'can_log_medications', true,
      'can_view_journal', true,
      'can_add_journal', true,
      'can_view_vitals', true,
      'can_view_vitals_raw', true,
      'can_log_vitals', true,
      'can_view_documents', true,
      'can_upload_documents', true,
      'can_view_appointments', true,
      'can_add_appointments', true,
      'can_view_tasks', true,
      'can_complete_tasks', true,
      'can_add_tasks', true,
      'can_view_insurance', false,
      'can_view_emergency_protocol', true,
      'can_generate_emergency_protocol', false,
      'can_chat', true,
      'can_view_ai_insights', true,
      'can_export_data', false,
      'can_add_clinical_notes', false
    );
  end if;

  if normalized_level = 'can_log' then
    return jsonb_build_object(
      'can_view_medications', true,
      'can_log_medications', true,
      'can_view_journal', true,
      'can_add_journal', true,
      'can_view_vitals', true,
      'can_view_vitals_raw', false,
      'can_log_vitals', true,
      'can_view_documents', false,
      'can_upload_documents', false,
      'can_view_appointments', true,
      'can_add_appointments', false,
      'can_view_tasks', true,
      'can_complete_tasks', true,
      'can_add_tasks', false,
      'can_view_insurance', false,
      'can_view_emergency_protocol', false,
      'can_generate_emergency_protocol', false,
      'can_chat', true,
      'can_view_ai_insights', false,
      'can_export_data', false,
      'can_add_clinical_notes', false
    );
  end if;

  return jsonb_build_object(
    'can_view_medications', false,
    'can_log_medications', false,
    'can_view_journal', true,
    'can_add_journal', false,
    'can_view_vitals', true,
    'can_view_vitals_raw', false,
    'can_log_vitals', false,
    'can_view_documents', false,
    'can_upload_documents', false,
    'can_view_appointments', true,
    'can_add_appointments', false,
    'can_view_tasks', true,
    'can_complete_tasks', false,
    'can_add_tasks', false,
    'can_view_insurance', false,
    'can_view_emergency_protocol', false,
    'can_generate_emergency_protocol', false,
    'can_chat', true,
    'can_view_ai_insights', false,
    'can_export_data', false,
    'can_add_clinical_notes', false
  );
end;
$$ language plpgsql;

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('caregiver', 'family_member', 'doctor', 'admin'));

alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists license_number text;
alter table public.users add column if not exists license_state text;
alter table public.users add column if not exists specialty text;
alter table public.users add column if not exists hospital_affiliation text;
alter table public.users add column if not exists is_license_verified boolean not null default false;
alter table public.users add column if not exists email_verified boolean not null default false;
alter table public.users add column if not exists phone_verified boolean not null default false;
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users add column if not exists terms_accepted_at timestamptz;
alter table public.users add column if not exists privacy_accepted_at timestamptz;

update public.users
set updated_at = coalesce(updated_at, created_at, now());

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

alter table public.patients add column if not exists owner_id text references public.users(id);
alter table public.patients add column if not exists allow_secondary_export boolean not null default false;
alter table public.patients add column if not exists show_insurance_to_secondary boolean not null default false;
alter table public.patients add column if not exists allow_family_vitals_raw boolean not null default false;

update public.patients
set owner_id = coalesce(owner_id, user_id)
where owner_id is null;

create index if not exists idx_patients_owner_id on public.patients(owner_id);

create table if not exists public.patient_access (
  id text primary key default public.generate_text_id('access'),
  patient_id text not null references public.patients(id) on delete cascade,
  user_id text references public.users(id) on delete cascade,
  member_role text not null check (member_role in ('primary_caregiver', 'secondary_caregiver', 'family_member', 'doctor')),
  permissions jsonb not null default public.default_access_permissions('family_member', 'view_only'),
  invite_email text not null,
  invite_token text not null unique default public.generate_token(24),
  invite_expires_at timestamptz not null default (now() + interval '7 days'),
  invite_sent_at timestamptz not null default now(),
  invited_by text references public.users(id) on delete set null,
  join_status text not null default 'pending' check (join_status in ('pending', 'active', 'suspended', 'removed')),
  joined_at timestamptz,
  removed_at timestamptz,
  removed_by text references public.users(id) on delete set null,
  removal_reason text,
  invite_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, user_id)
);

drop trigger if exists patient_access_set_updated_at on public.patient_access;
create trigger patient_access_set_updated_at
before update on public.patient_access
for each row execute function public.set_updated_at();

create index if not exists idx_patient_access_patient on public.patient_access(patient_id, join_status);
create index if not exists idx_patient_access_user on public.patient_access(user_id, join_status);
create index if not exists idx_patient_access_invite_token on public.patient_access(invite_token) where join_status = 'pending';

insert into public.patient_access (
  patient_id,
  user_id,
  member_role,
  permissions,
  invite_email,
  invited_by,
  join_status,
  joined_at,
  invite_sent_at
)
select
  p.id,
  p.owner_id,
  'primary_caregiver',
  public.default_access_permissions('primary_caregiver', 'full_access'),
  u.email,
  p.owner_id,
  'active',
  coalesce(p.created_at, now()),
  coalesce(p.created_at, now())
from public.patients p
join public.users u on u.id = p.owner_id
where p.owner_id is not null
on conflict (patient_id, user_id) do update
set
  member_role = excluded.member_role,
  permissions = excluded.permissions,
  invite_email = excluded.invite_email,
  join_status = 'active',
  joined_at = coalesce(public.patient_access.joined_at, excluded.joined_at),
  updated_at = now();

insert into public.patient_access (
  patient_id,
  user_id,
  member_role,
  permissions,
  invite_email,
  invite_token,
  invited_by,
  join_status,
  joined_at,
  invite_sent_at
)
select
  fm.patient_id,
  fm.user_id,
  case
    when fm.role = 'primary_caregiver' then 'primary_caregiver'
    when fm.role = 'secondary_caregiver' then 'secondary_caregiver'
    else 'family_member'
  end,
  public.default_access_permissions(
    case
      when fm.role = 'primary_caregiver' then 'primary_caregiver'
      when fm.role = 'secondary_caregiver' then 'secondary_caregiver'
      else 'family_member'
    end,
    fm.permissions
  ),
  fm.email,
  coalesce(nullif(fm.invite_token, ''), public.generate_token(24)),
  fm.invited_by,
  case when fm.join_status = 'active' then 'active' else 'pending' end,
  case when fm.join_status = 'active' then coalesce(fm.created_at, now()) else null end,
  coalesce(fm.created_at, now())
from public.family_members fm
where coalesce(fm.email, '') <> ''
on conflict (patient_id, user_id) do update
set
  member_role = excluded.member_role,
  permissions = excluded.permissions,
  invite_email = excluded.invite_email,
  join_status = excluded.join_status,
  updated_at = now();
