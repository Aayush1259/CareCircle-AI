create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  auth_user_id uuid unique,
  email text not null unique,
  name text not null,
  role text not null check (role in ('caregiver', 'family_member', 'admin')),
  phone text,
  photo_url text,
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now(),
  notification_preferences jsonb not null default '{}'::jsonb
);

create table if not exists patients (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  preferred_name text,
  date_of_birth date not null,
  photo_url text,
  primary_diagnosis text not null,
  secondary_conditions text[] not null default '{}',
  primary_doctor_name text not null,
  primary_doctor_phone text not null,
  hospital_preference text,
  insurance_provider text,
  insurance_id text,
  blood_type text,
  allergies text[] not null default '{}',
  mobility_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists medications (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  name text not null,
  brand_name text,
  generic_name text,
  dose_amount text not null,
  dose_unit text not null,
  frequency text not null,
  times_of_day text[] not null default '{}',
  start_date date not null,
  end_date date,
  prescribing_doctor text,
  purpose text,
  instructions text,
  pill_color text,
  pill_shape text,
  refill_date date,
  pharmacy_name text,
  pharmacy_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists medication_logs (
  id text primary key,
  medication_id text not null references medications(id) on delete cascade,
  patient_id text not null references patients(id) on delete cascade,
  scheduled_time timestamptz not null,
  taken_at timestamptz,
  status text not null check (status in ('taken', 'missed', 'skipped')),
  notes text,
  logged_by text,
  created_at timestamptz not null default now()
);

create table if not exists care_journal (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  date date not null,
  time text not null,
  entry_title text not null,
  entry_body text not null,
  mood int not null,
  pain_level int not null,
  tags text[] not null default '{}',
  severity text not null check (severity in ('low', 'medium', 'high', 'emergency')),
  follow_up_needed boolean not null default false,
  follow_up_note text,
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null check (file_type in ('PDF', 'image')),
  document_category text not null,
  upload_date date not null,
  document_date date,
  ai_summary jsonb not null default '{}'::jsonb,
  ai_action_items text[] not null default '{}',
  is_processed boolean not null default false,
  extracted_text text
);

create table if not exists appointments (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  doctor_name text not null,
  specialty text not null,
  clinic_name text,
  appointment_date date not null,
  appointment_time text not null,
  duration_minutes int not null default 30,
  address text,
  phone text,
  video_link text,
  purpose text,
  notes text,
  questions_to_ask text[] not null default '{}',
  status text not null,
  reminder_sent boolean not null default false,
  follow_up_summary text,
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  invited_by text not null references users(id),
  user_id text references users(id),
  name text not null,
  email text not null,
  phone text,
  relationship text,
  role text not null,
  permissions text not null,
  join_status text not null,
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  photo_url text,
  last_active timestamptz
);

create table if not exists tasks (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  created_by text not null references users(id),
  assigned_to text not null,
  title text not null,
  description text,
  category text not null,
  priority text not null,
  due_date date not null,
  due_time text,
  recurrence text not null,
  status text not null,
  ai_suggested boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists emergency_protocols (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  protocol_type text not null,
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  responder_notes jsonb not null default '[]'::jsonb,
  important_numbers jsonb not null default '[]'::jsonb,
  last_updated timestamptz not null default now(),
  pdf_url text,
  share_token text not null unique
);

create table if not exists health_vitals (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  logged_by text not null references users(id),
  date date not null,
  time text not null,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  heart_rate int,
  blood_glucose int,
  weight numeric(6,2),
  temperature numeric(4,1),
  oxygen_saturation int,
  pain_level int,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists ai_insights (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  insight_type text not null,
  title text not null,
  body text not null,
  action_recommended text,
  generated_at timestamptz not null default now(),
  is_read boolean not null default false,
  is_dismissed boolean not null default false
);

create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  patient_id text not null references patients(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists chat_sessions (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  patient_id text not null references patients(id) on delete cascade,
  user_id text references users(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_events (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  actor_name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_reactions (
  id text primary key,
  event_id text not null references activity_events(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  user_id text primary key references users(id) on delete cascade,
  display jsonb not null default '{}'::jsonb,
  help_links jsonb not null default '[]'::jsonb
);

alter table users enable row level security;
alter table patients enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table care_journal enable row level security;
alter table documents enable row level security;
alter table appointments enable row level security;
alter table family_members enable row level security;
alter table tasks enable row level security;
alter table emergency_protocols enable row level security;
alter table health_vitals enable row level security;
alter table ai_insights enable row level security;
alter table notifications enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table activity_events enable row level security;
alter table activity_reactions enable row level security;
alter table app_settings enable row level security;

