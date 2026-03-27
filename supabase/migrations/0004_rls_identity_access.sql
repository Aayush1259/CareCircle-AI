create or replace function public.current_app_user_id()
returns text
stable
security definer
as $$
declare
  v_user_id text;
begin
  select u.id
  into v_user_id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;

  return v_user_id;
end;
$$ language plpgsql;

create or replace function public.is_patient_owner(p_patient_id text)
returns boolean
stable
security definer
as $$
begin
  return exists (
    select 1
    from public.patients p
    where p.id = p_patient_id
      and p.owner_id = public.current_app_user_id()
  );
end;
$$ language plpgsql;

create or replace function public.has_patient_access(p_patient_id text)
returns boolean
stable
security definer
as $$
begin
  return public.is_patient_owner(p_patient_id) or exists (
    select 1
    from public.patient_access pa
    where pa.patient_id = p_patient_id
      and pa.user_id = public.current_app_user_id()
      and pa.join_status = 'active'
  );
end;
$$ language plpgsql;

create or replace function public.get_patient_role(p_patient_id text)
returns text
stable
security definer
as $$
declare
  v_role text;
begin
  if public.is_patient_owner(p_patient_id) then
    return 'primary_caregiver';
  end if;

  select pa.member_role
  into v_role
  from public.patient_access pa
  where pa.patient_id = p_patient_id
    and pa.user_id = public.current_app_user_id()
    and pa.join_status = 'active'
  limit 1;

  return v_role;
end;
$$ language plpgsql;

create or replace function public.has_patient_permission(p_patient_id text, p_permission text)
returns boolean
stable
security definer
as $$
begin
  if public.is_patient_owner(p_patient_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.patient_access pa
    where pa.patient_id = p_patient_id
      and pa.user_id = public.current_app_user_id()
      and pa.join_status = 'active'
      and coalesce((pa.permissions ->> p_permission)::boolean, false) = true
  );
end;
$$ language plpgsql;

alter table public.patient_access enable row level security;
alter table public.audit_log enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.weekly_summaries enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select
using (id = public.current_app_user_id());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update
using (id = public.current_app_user_id())
with check (id = public.current_app_user_id());

drop policy if exists users_select_shared_care_circle on public.users;
create policy users_select_shared_care_circle on public.users
for select
using (
  id = public.current_app_user_id()
  or exists (
    select 1
    from public.patient_access self_access
    join public.patient_access other_access
      on self_access.patient_id = other_access.patient_id
    where self_access.user_id = public.current_app_user_id()
      and self_access.join_status = 'active'
      and other_access.user_id = users.id
      and other_access.join_status = 'active'
  )
  or exists (
    select 1
    from public.patients p
    where p.owner_id = users.id
      and public.has_patient_access(p.id)
  )
);

drop policy if exists patients_select_shared on public.patients;
create policy patients_select_shared on public.patients
for select
using (public.has_patient_access(id));

drop policy if exists patients_insert_owner on public.patients;
create policy patients_insert_owner on public.patients
for insert
with check (owner_id = public.current_app_user_id());

drop policy if exists patients_update_owner on public.patients;
create policy patients_update_owner on public.patients
for update
using (public.is_patient_owner(id))
with check (public.is_patient_owner(id));

drop policy if exists patient_access_select on public.patient_access;
create policy patient_access_select on public.patient_access
for select
using (
  user_id = public.current_app_user_id()
  or public.is_patient_owner(patient_id)
);

drop policy if exists patient_access_insert on public.patient_access;
create policy patient_access_insert on public.patient_access
for insert
with check (public.is_patient_owner(patient_id));

drop policy if exists patient_access_update on public.patient_access;
create policy patient_access_update on public.patient_access
for update
using (
  public.is_patient_owner(patient_id)
  or user_id = public.current_app_user_id()
);

drop policy if exists patient_access_delete on public.patient_access;
create policy patient_access_delete on public.patient_access
for delete
using (public.is_patient_owner(patient_id));

drop policy if exists documents_select_secure on public.documents;
create policy documents_select_secure on public.documents
for select
using (
  case public.get_patient_role(patient_id)
    when 'primary_caregiver' then true
    when 'secondary_caregiver' then visible_to_secondary = true
    when 'doctor' then visible_to_doctor = true
    when 'family_member' then visible_to_family = true
    else false
  end
);

drop policy if exists documents_insert_secure on public.documents;
create policy documents_insert_secure on public.documents
for insert
with check (
  public.is_patient_owner(patient_id)
  or public.has_patient_permission(patient_id, 'can_upload_documents')
);

drop policy if exists documents_delete_secure on public.documents;
create policy documents_delete_secure on public.documents
for delete
using (public.is_patient_owner(patient_id));

drop policy if exists clinical_notes_select_secure on public.clinical_notes;
create policy clinical_notes_select_secure on public.clinical_notes
for select
using (
  doctor_id = public.current_app_user_id()
  or (
    public.has_patient_access(patient_id)
    and public.get_patient_role(patient_id) in ('primary_caregiver', 'secondary_caregiver')
    and is_visible_to_caregiver = true
  )
  or (
    public.has_patient_access(patient_id)
    and public.get_patient_role(patient_id) = 'family_member'
    and is_visible_to_family = true
  )
);

drop policy if exists clinical_notes_insert_secure on public.clinical_notes;
create policy clinical_notes_insert_secure on public.clinical_notes
for insert
with check (
  doctor_id = public.current_app_user_id()
  and public.get_patient_role(patient_id) = 'doctor'
  and public.has_patient_permission(patient_id, 'can_add_clinical_notes')
);

drop policy if exists clinical_notes_update_secure on public.clinical_notes;
create policy clinical_notes_update_secure on public.clinical_notes
for update
using (doctor_id = public.current_app_user_id())
with check (doctor_id = public.current_app_user_id());

drop policy if exists audit_log_select_secure on public.audit_log;
create policy audit_log_select_secure on public.audit_log
for select
using (
  public.is_patient_owner(patient_id)
  or actor_id = public.current_app_user_id()
);

drop policy if exists weekly_summaries_select_secure on public.weekly_summaries;
create policy weekly_summaries_select_secure on public.weekly_summaries
for select
using (
  public.get_patient_role(patient_id) in ('primary_caregiver', 'secondary_caregiver')
);

drop policy if exists weekly_summaries_insert_secure on public.weekly_summaries;
create policy weekly_summaries_insert_secure on public.weekly_summaries
for insert
with check (public.is_patient_owner(patient_id));
