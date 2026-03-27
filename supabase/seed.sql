insert into users (id, email, name, role, phone, created_at, last_login, notification_preferences)
values
  (
    'user_sarah',
    'demo@carecircle.ai',
    'Sarah Martinez',
    'caregiver',
    '(555) 111-2233',
    now() - interval '90 days',
    now(),
    '{"medicationReminders":true,"appointment24h":true,"appointment1h":true,"weeklySummary":true,"weeklySummaryDay":"Sunday","aiInsightAlerts":true,"familyActivityUpdates":true}'::jsonb
  ),
  ('user_james', 'james@carecircle.ai', 'James Martinez', 'family_member', '(555) 333-8899', now() - interval '70 days', now() - interval '1 day', '{}'::jsonb),
  ('user_maria', 'maria@carecircle.ai', 'Maria Lopez', 'family_member', '(555) 777-4455', now() - interval '55 days', now() - interval '1 day', '{}'::jsonb)
on conflict (id) do nothing;

insert into patients (
  id, user_id, owner_id, name, preferred_name, date_of_birth, primary_diagnosis, secondary_conditions,
  primary_doctor_name, primary_doctor_phone, hospital_preference, insurance_provider, insurance_id,
  blood_type, allergies, mobility_level
)
values (
  'patient_ellie', 'user_sarah', 'user_sarah', 'Eleanor "Ellie" Martinez', 'Ellie', '1948-04-18', 'Type 2 Diabetes',
  array['Hypertension', 'Early-stage Alzheimer''s', 'Arthritis'],
  'Dr. Robert Chen', '(555) 234-5678', 'Riverside Medical Center', 'UnitedHealthcare', 'UHC-7823941',
  'A+', array['Penicillin', 'Sulfa drugs'], 'Uses a cane for longer distances'
)
on conflict (id) do nothing;

insert into medications (
  id, patient_id, name, generic_name, dose_amount, dose_unit, frequency, times_of_day,
  start_date, prescribing_doctor, purpose, instructions, pill_color, pill_shape,
  refill_date, pharmacy_name, pharmacy_phone, is_active
)
values
  ('med_metformin', 'patient_ellie', 'Metformin', 'Metformin', '500', 'mg', 'twice', array['morning', 'evening'], current_date - 120, 'Dr. Robert Chen', 'Helps keep blood sugar steadier throughout the day.', 'Take with meals to reduce stomach upset.', 'white', 'round', current_date + 6, 'Riverside Pharmacy', '(555) 400-1020', true),
  ('med_lisinopril', 'patient_ellie', 'Lisinopril', 'Lisinopril', '10', 'mg', 'once', array['morning'], current_date - 150, 'Dr. Robert Chen', 'Helps control blood pressure and protect the kidneys.', 'Take at the same time every morning.', 'pink', 'oval', current_date + 12, 'Riverside Pharmacy', '(555) 400-1020', true),
  ('med_donepezil', 'patient_ellie', 'Donepezil', 'Donepezil', '5', 'mg', 'once', array['bedtime'], current_date - 45, 'Dr. Robert Chen', 'Supports memory and daily thinking tasks.', 'Take in the evening. Watch for vivid dreams.', 'yellow', 'round', current_date + 15, 'Riverside Pharmacy', '(555) 400-1020', true),
  ('med_aspirin', 'patient_ellie', 'Aspirin', 'Aspirin', '81', 'mg', 'once', array['morning'], current_date - 365, 'Dr. Robert Chen', 'Supports heart health.', 'Take with breakfast and water.', 'orange', 'round', current_date + 20, 'Riverside Pharmacy', '(555) 400-1020', true),
  ('med_vitd', 'patient_ellie', 'Vitamin D3', 'Vitamin D3', '1000', 'IU', 'once', array['morning'], current_date - 180, 'Dr. Robert Chen', 'Supports bone health and strength.', 'Take with breakfast.', 'clear', 'softgel', current_date + 30, 'Riverside Pharmacy', '(555) 400-1020', true)
on conflict (id) do nothing;

insert into medication_logs (id, medication_id, patient_id, scheduled_time, taken_at, status, notes, logged_by)
values
  ('log_001', 'med_metformin', 'patient_ellie', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '8 hours 10 minutes', 'taken', 'Taken with breakfast.', 'user_sarah'),
  ('log_002', 'med_lisinopril', 'patient_ellie', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '8 hours 12 minutes', 'taken', 'Taken with breakfast.', 'user_sarah'),
  ('log_003', 'med_aspirin', 'patient_ellie', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '8 hours 14 minutes', 'taken', 'Taken with breakfast.', 'user_sarah'),
  ('log_004', 'med_vitd', 'patient_ellie', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '8 hours 15 minutes', 'taken', 'Taken with breakfast.', 'user_sarah'),
  ('log_005', 'med_metformin', 'patient_ellie', date_trunc('day', now()) + interval '18 hours', null, 'missed', 'Dose missed after an early bedtime.', 'user_james'),
  ('log_006', 'med_donepezil', 'patient_ellie', date_trunc('day', now()) + interval '21 hours', null, 'missed', 'Dose not logged yet.', 'user_james')
on conflict (id) do nothing;

insert into care_journal (id, patient_id, user_id, date, time, entry_title, entry_body, mood, pain_level, tags, severity, follow_up_needed, follow_up_note, created_at)
values
  ('journal_001', 'patient_ellie', 'user_sarah', current_date - 13, '08:30', 'Morning confusion improved after breakfast', 'Ellie woke up unsure of the day, but after breakfast she felt calmer and more oriented.', 3, 2, array['confusion', 'mood'], 'low', false, null, now() - interval '13 days'),
  ('journal_002', 'patient_ellie', 'user_sarah', current_date - 12, '19:10', 'Skipped part of dinner', 'Ate half her dinner and later accepted yogurt. Appetite seemed lower than usual.', 3, 1, array['appetite'], 'medium', true, 'Watch appetite for 3 more days.', now() - interval '12 days'),
  ('journal_003', 'patient_ellie', 'user_maria', current_date - 11, '14:00', 'Good energy during walk', 'Short walk outside went well. No dizziness and mood was brighter.', 4, 3, array['energy', 'mood'], 'low', false, null, now() - interval '11 days'),
  ('journal_004', 'patient_ellie', 'user_sarah', current_date - 10, '22:15', 'Restless evening', 'Asked repeated questions about going home even though she was at home.', 2, 2, array['confusion', 'behavior', 'sleep'], 'medium', true, 'Mention sundowning at neurology visit.', now() - interval '10 days'),
  ('journal_005', 'patient_ellie', 'user_james', current_date - 9, '07:45', 'Slept through the night', 'Best sleep this week. Cheerful at breakfast.', 4, 1, array['sleep', 'mood'], 'low', false, null, now() - interval '9 days'),
  ('journal_006', 'patient_ellie', 'user_maria', current_date - 8, '16:20', 'Mild knee pain after stairs', 'Left knee pain increased after climbing stairs and improved with rest.', 3, 4, array['pain', 'mobility'], 'medium', false, null, now() - interval '8 days'),
  ('journal_007', 'patient_ellie', 'user_sarah', current_date - 7, '12:40', 'Good lunch appetite', 'Finished a full lunch and drank extra water without prompting.', 4, 1, array['appetite', 'energy'], 'low', false, null, now() - interval '7 days'),
  ('journal_008', 'patient_ellie', 'user_sarah', current_date - 6, '20:05', 'Bathroom urgency before bed', 'Needed the bathroom twice within an hour before bed. No pain reported.', 3, 0, array['bathroom', 'sleep'], 'medium', true, 'Track frequency for doctor if it continues.', now() - interval '6 days'),
  ('journal_009', 'patient_ellie', 'user_james', current_date - 5, '09:10', 'Laughing with family photos', 'Spent 20 minutes with the photo album and recognized Sarah and James immediately.', 5, 1, array['mood', 'behavior'], 'low', false, null, now() - interval '5 days'),
  ('journal_010', 'patient_ellie', 'user_sarah', current_date - 4, '18:50', 'Mild dizziness after standing quickly', 'Stood up from the couch, felt dizzy, then recovered within a minute after sitting.', 3, 1, array['fall', 'energy'], 'medium', true, 'Bring up dizziness at GP appointment.', now() - interval '4 days'),
  ('journal_011', 'patient_ellie', 'user_sarah', current_date - 3, '15:30', 'Calm afternoon nap', 'Had a restful nap and woke with less joint stiffness.', 4, 2, array['sleep', 'pain'], 'low', false, null, now() - interval '3 days'),
  ('journal_012', 'patient_ellie', 'user_maria', current_date - 2, '11:15', 'Needed extra cueing for shower', 'Needed more step-by-step prompting than usual but stayed calm.', 3, 2, array['behavior', 'confusion'], 'medium', false, null, now() - interval '2 days'),
  ('journal_013', 'patient_ellie', 'user_sarah', current_date - 1, '21:00', 'Evening confusion stronger than last week', 'Asked three times if she needed to leave for work. Music helped after 15 minutes.', 2, 1, array['confusion', 'behavior', 'mood'], 'high', true, 'Discuss progression with neurologist.', now() - interval '1 day'),
  ('journal_014', 'patient_ellie', 'user_sarah', current_date, '06:55', 'Slept lightly but morning was smooth', 'She woke twice overnight, but breakfast and medication routine went smoothly.', 3, 2, array['sleep', 'mood'], 'low', false, null, now())
on conflict (id) do nothing;

insert into documents (id, patient_id, user_id, file_name, file_url, file_type, document_category, upload_date, document_date, ai_summary, ai_action_items, is_processed, extracted_text)
values
  ('document_001', 'patient_ellie', 'user_sarah', 'lab-results-march.pdf', '/demo/lab-results-march.pdf', 'PDF', 'lab_result', current_date - 18, current_date - 20, '{"summary":"Recent labs show blood sugar control is a little above goal, kidney function looks stable, and vitamin D remains mildly low.","actionItems":["Ask whether any diabetes medication changes are needed.","Keep tracking morning blood sugar readings."],"importantDates":[{"date":"2026-03-31","description":"Discuss labs at GP visit"}],"medicalTerms":[{"term":"A1C","plainEnglish":"A 3-month average of blood sugar."}],"doctorQuestions":["Is her A1C close enough to goal for her age?"],"documentType":"Lab results","severityFlag":"review_needed"}'::jsonb, array['Discuss A1C trend at next appointment.', 'Continue morning glucose log.'], true, 'A1C 7.4, eGFR stable, Vitamin D mildly low'),
  ('document_002', 'patient_ellie', 'user_sarah', 'insurance-eob-february.pdf', '/demo/insurance-eob-february.pdf', 'PDF', 'insurance', current_date - 12, current_date - 13, '{"summary":"This insurance statement explains what was billed for Ellies last emergency room visit and what the plan paid.","actionItems":["Check the remaining balance before the due date."],"importantDates":[{"date":"2026-04-05","description":"Payment due date on statement"}],"medicalTerms":[{"term":"EOB","plainEnglish":"A summary of what insurance paid and what may still be owed."}],"doctorQuestions":[],"documentType":"Explanation of benefits","severityFlag":"normal"}'::jsonb, array['Check billing balance before due date.'], true, 'Explanation of benefits'),
  ('document_003', 'patient_ellie', 'user_sarah', 'er-discharge-summary.pdf', '/demo/er-discharge-summary.pdf', 'PDF', 'discharge_summary', current_date - 40, current_date - 42, '{"summary":"Ellie was seen after a dizzy spell. The team did not find a stroke or heart attack.","actionItems":["Bring discharge paperwork to the next GP visit."],"importantDates":[{"date":"2026-03-31","description":"Bring summary to GP appointment"}],"medicalTerms":[{"term":"Orthostatic","plainEnglish":"Related to changes when standing up."}],"doctorQuestions":["Could any medications be contributing to dizziness?"],"documentType":"ER discharge summary","severityFlag":"review_needed"}'::jsonb, array['Review dizziness plan with doctor.'], true, 'Discharge summary after dizziness episode')
on conflict (id) do nothing;

insert into appointments (id, patient_id, user_id, doctor_name, specialty, clinic_name, appointment_date, appointment_time, duration_minutes, address, phone, purpose, questions_to_ask, status, reminder_sent)
values
  ('appointment_001', 'patient_ellie', 'user_sarah', 'Dr. Robert Chen', 'Geriatrician', 'Riverside Medical Center', current_date + 5, '10:30', 40, '1200 Riverside Drive, Riverside, CA', '(555) 234-5678', 'Routine follow-up for blood pressure, diabetes, and appetite changes', array['Should we be worried about the recent dizziness?', 'Do we need to adjust anything for appetite changes?'], 'upcoming', false),
  ('appointment_002', 'patient_ellie', 'user_sarah', 'Dr. Hannah Scott', 'Neurologist', 'Neurology Partners', current_date + 21, '14:00', 50, '98 Willow Street, Riverside, CA', '(555) 900-2222', 'Memory follow-up and evening confusion review', array['Are there new strategies for sundowning?', 'Should we adjust Donepezil timing?'], 'upcoming', false)
on conflict (id) do nothing;

insert into patient_access (
  id, patient_id, user_id, member_role, permissions, invite_email, invite_token, invited_by,
  join_status, joined_at, invite_sent_at, created_at, updated_at
)
values
  (
    'access_001',
    'patient_ellie',
    'user_sarah',
    'primary_caregiver',
    public.default_access_permissions('primary_caregiver', 'full_access'),
    'demo@carecircle.ai',
    'invite_001',
    'user_sarah',
    'active',
    now() - interval '90 days',
    now() - interval '90 days',
    now() - interval '90 days',
    now() - interval '1 day'
  ),
  (
    'access_002',
    'patient_ellie',
    'user_james',
    'secondary_caregiver',
    public.default_access_permissions('secondary_caregiver', 'can_log'),
    'james@carecircle.ai',
    'invite_002',
    'user_sarah',
    'active',
    now() - interval '70 days',
    now() - interval '70 days',
    now() - interval '70 days',
    now() - interval '1 day'
  ),
  (
    'access_003',
    'patient_ellie',
    'user_maria',
    'family_member',
    public.default_access_permissions('family_member', 'can_log'),
    'maria@carecircle.ai',
    'invite_003',
    'user_sarah',
    'active',
    now() - interval '55 days',
    now() - interval '55 days',
    now() - interval '55 days',
    now() - interval '1 day'
  )
on conflict (patient_id, user_id) do update
set
  member_role = excluded.member_role,
  permissions = excluded.permissions,
  invite_email = excluded.invite_email,
  join_status = excluded.join_status,
  joined_at = excluded.joined_at,
  updated_at = excluded.updated_at;

insert into tasks (id, patient_id, created_by, assigned_to, title, description, category, priority, due_date, due_time, recurrence, status, ai_suggested)
values
  ('task_001', 'patient_ellie', 'user_sarah', 'user_sarah', 'Bring dizziness notes to GP visit', 'Summarize when dizziness happened and what helped.', 'medical', 'high', current_date + 4, '18:00', 'none', 'todo', true),
  ('task_002', 'patient_ellie', 'user_sarah', 'user_james', 'Pick up Metformin refill', 'Call the pharmacy first to confirm it is ready.', 'errands', 'urgent', current_date + 5, '12:00', 'none', 'in_progress', false),
  ('task_003', 'patient_ellie', 'user_sarah', 'user_maria', 'Restock low-sugar snacks', 'Buy yogurt, applesauce, and crackers for the week.', 'household', 'medium', current_date + 1, '17:00', 'weekly', 'todo', true),
  ('task_004', 'patient_ellie', 'user_sarah', 'user_sarah', 'Schedule podiatry follow-up', 'Check whether the diabetic foot exam is due this spring.', 'administrative', 'medium', current_date - 1, '15:00', 'none', 'overdue', false)
on conflict (id) do nothing;

insert into emergency_protocols (id, patient_id, protocol_type, title, steps, responder_notes, important_numbers, share_token)
values
  ('protocol_001', 'patient_ellie', 'fall', 'Fall Response', '["Stay calm and ask what hurts.","Do not rush to lift her right away.","Check for bleeding or head injury.","Call 911 if moving feels unsafe.","If safe, help her roll to her side first."]'::jsonb, '["Age 78 with diabetes, hypertension, early-stage Alzheimer''s, arthritis.","Recent dizziness episode six weeks ago."]'::jsonb, '[{"label":"Emergency","phone":"911"},{"label":"Primary Doctor","phone":"(555) 234-5678"}]'::jsonb, 'share_fall_ellie'),
  ('protocol_002', 'patient_ellie', 'diabetic_emergency', 'Low or High Blood Sugar', '["Check blood sugar right away if possible.","If low and awake, give 15 grams of fast sugar.","Recheck in 15 minutes.","If not improving or hard to wake, call 911.","Bring medication list and recent readings."]'::jsonb, '["Current diabetes medication: Metformin 500 mg twice daily.","Allergies: Penicillin, Sulfa drugs."]'::jsonb, '[{"label":"Emergency","phone":"911"},{"label":"Primary Doctor","phone":"(555) 234-5678"}]'::jsonb, 'share_diabetes_ellie'),
  ('protocol_003', 'patient_ellie', 'confusion', 'Confusion or Disorientation Episode', '["Use a calm voice and short sentences.","Reduce noise and move to a familiar space.","Offer water and check bathroom needs.","Look for fever, pain, or new symptoms.","Call the doctor if this is much worse than usual."]'::jsonb, '["Evening confusion has increased this week.","Music and reassurance usually help."]'::jsonb, '[{"label":"Primary Doctor","phone":"(555) 234-5678"},{"label":"Neurology Partners","phone":"(555) 900-2222"}]'::jsonb, 'share_confusion_ellie')
on conflict (id) do nothing;

insert into health_vitals (id, patient_id, logged_by, date, time, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, blood_glucose, weight, temperature, oxygen_saturation, pain_level, notes)
select
  'vital_' || lpad(gs::text, 3, '0'),
  'patient_ellie',
  case when gs % 2 = 0 then 'user_sarah' else 'user_maria' end,
  current_date - (14 - gs),
  '08:15',
  126 + (gs % 4) * 2,
  74 + (gs % 3) * 2,
  70 + (gs % 5),
  118 + (gs % 5) * 6,
  149 - (gs % 3) * 0.2,
  98.2 + (gs % 2) * 0.1,
  97 + (gs % 2),
  2 + (gs % 3),
  case when gs = 10 then 'Mild dizziness earlier in the day.' else 'Routine morning reading.' end
from generate_series(1, 14) gs
on conflict (id) do nothing;

insert into ai_insights (id, patient_id, insight_type, title, body, action_recommended, generated_at, is_read, is_dismissed)
values
  ('insight_001', 'patient_ellie', 'pattern', 'Evening confusion is appearing more often', 'Entries this week suggest bedtime confusion is stronger than it was 2 weeks ago.', 'Bring two recent examples to the neurology visit.', now(), false, false),
  ('insight_002', 'patient_ellie', 'positive_trend', 'Morning blood sugar has stayed steady', 'The last 7 readings have stayed in a similar range without major spikes.', 'Keep the breakfast routine consistent.', now() - interval '1 day', true, false),
  ('insight_003', 'patient_ellie', 'suggestion', 'Refill reminder is approaching', 'Metformin refill is due in less than a week.', 'Call Riverside Pharmacy by Friday.', now(), false, false)
on conflict (id) do nothing;

insert into notifications (id, user_id, patient_id, type, title, message, is_read, scheduled_for)
values
  ('notification_001', 'user_sarah', 'patient_ellie', 'medication_reminder', 'Bedtime medication missed', 'Donepezil was not logged last night.', false, now()),
  ('notification_002', 'user_sarah', 'patient_ellie', 'appointment', 'GP visit coming up', 'Dr. Robert Chen is scheduled in 5 days at 10:30 AM.', false, now()),
  ('notification_003', 'user_sarah', 'patient_ellie', 'task_due', '1 overdue task needs attention', 'Schedule the podiatry follow-up when you have a quiet moment.', true, now() - interval '1 day')
on conflict (id) do nothing;

insert into chat_sessions (id, patient_id, user_id, title, created_at, updated_at)
values
  ('chat_session_001', 'patient_ellie', 'user_sarah', 'Helping with evening confusion', now() - interval '2 days', now() - interval '2 days'),
  ('chat_session_002', 'patient_ellie', 'user_sarah', 'Questions for Dr. Chen', now() - interval '1 day', now() - interval '1 day'),
  ('family_thread', 'patient_ellie', 'user_sarah', 'Family Hub', now() - interval '1 day', now())
on conflict (id) do nothing;

insert into chat_messages (id, session_id, patient_id, user_id, role, content, created_at)
values
  ('chat_message_001', 'chat_session_001', 'patient_ellie', 'user_sarah', 'user', 'Dad seems more confused at night. Is that common?', now() - interval '2 days'),
  ('chat_message_002', 'chat_session_001', 'patient_ellie', null, 'assistant', 'Yes, that can happen and many families call it sundowning.', now() - interval '2 days'),
  ('chat_message_003', 'chat_session_002', 'patient_ellie', 'user_sarah', 'user', 'What should I ask at next week''s appointment?', now() - interval '1 day'),
  ('chat_message_004', 'chat_session_002', 'patient_ellie', null, 'assistant', 'Bring up dizziness, stronger evening confusion, and appetite changes.', now() - interval '1 day'),
  ('chat_message_005', 'family_thread', 'patient_ellie', 'user_james', 'user', 'I can pick up the Metformin refill on Friday.', now() - interval '12 hours'),
  ('chat_message_006', 'family_thread', 'patient_ellie', 'user_maria', 'user', 'I will restock the low-sugar snacks tomorrow afternoon.', now() - interval '6 hours')
on conflict (id) do nothing;

insert into activity_events (id, patient_id, user_id, type, actor_name, description, created_at)
values
  ('activity_001', 'patient_ellie', 'user_sarah', 'document_uploaded', 'You', 'uploaded a new document', now() - interval '2 days'),
  ('activity_002', 'patient_ellie', 'user_james', 'medication_logged', 'James', 'marked Mom''s 8 PM medication as taken', now() - interval '1 day'),
  ('activity_003', 'patient_ellie', 'user_sarah', 'journal_added', 'Sarah', 'added a care journal entry', now() - interval '1 day'),
  ('activity_004', 'patient_ellie', 'user_maria', 'task_completed', 'Maria', 'completed a grocery task', now() - interval '3 days')
on conflict (id) do nothing;

insert into activity_reactions (id, event_id, user_id, emoji, created_at)
values
  ('reaction_001', 'activity_002', 'user_sarah', 'heart', now() - interval '1 day'),
  ('reaction_002', 'activity_003', 'user_james', 'thanks', now() - interval '1 day')
on conflict (id) do nothing;

insert into app_settings (user_id, display, help_links)
values
  (
    'user_sarah',
    '{"fontSize":"normal","colorTheme":"teal","dashboardLayout":"detailed","highContrast":false}'::jsonb,
    '[{"title":"How to use the dashboard","url":"https://www.loom.com/share/carecircle-dashboard"},{"title":"Uploading a document","url":"https://www.loom.com/share/carecircle-documents"},{"title":"Inviting family members","url":"https://www.loom.com/share/carecircle-family"}]'::jsonb
  )
on conflict (user_id) do nothing;

