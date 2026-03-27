import {
  buildFamilyMemberFromAccessRecord,
  buildDemoSnapshot,
  buildPatientAccessRecord,
  derivePatientAccessLevel,
  normalizePatientAccessRole,
  normalizePatientPermissions,
  type ActivityEventRecord,
  type ActivityReactionRecord,
  type AIInsightRecord,
  type AppSettingsRecord,
  type AppSnapshot,
  type AppointmentRecord,
  type CareJournalRecord,
  type ChatMessageRecord,
  type ChatSessionRecord,
  type DocumentAIAnalysis,
  type DocumentRecord,
  type EmergencyProtocolRecord,
  type FamilyMessageRecord,
  type HealthVitalsRecord,
  type MedicationLogRecord,
  type MedicationRecord,
  type NotificationRecord,
  type NotificationPreferences,
  type PatientAccessLevel,
  type PatientAccessRecord,
  type PatientPermissionSet,
  type PatientRecord,
  type SecurityAuditRecord,
  type TaskRecord,
  type UserRecord,
  type UserRole,
} from "@carecircle/shared";
import { env } from "../env";
import { supabaseAdmin } from "./supabase";

const defaultNotificationPreferences = (): NotificationPreferences => ({
  medicationReminders: true,
  medicationReminderTime: "08:00",
  appointment24h: true,
  appointment1h: true,
  weeklySummary: true,
  weeklySummaryDay: "Sunday",
  aiInsightAlerts: true,
  familyActivityUpdates: true,
  timezone: "America/Los_Angeles",
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const opt = (value: unknown) => (typeof value === "string" && value ? value : undefined);
const bool = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const arr = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeRole = (role?: string): UserRole => {
  if (role === "family_member" || role === "doctor" || role === "admin") return role;
  return "caregiver";
};

const normalizeAuthUserId = (value?: string) => {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
};

const upsert = async (table: string, row: Record<string, unknown>, onConflict = "id") => {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from(table).upsert(row, { onConflict });
  if (error) throw new Error(`Unable to persist ${table}: ${error.message}`);
};

const removeById = async (table: string, id: string) => {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) throw new Error(`Unable to delete ${table}: ${error.message}`);
};

const isMissingColumnError = (error: unknown, columnName: string) =>
  error instanceof Error &&
  new RegExp(`column .*${columnName}|${columnName}.*does not exist`, "i").test(error.message);

const mapDocumentSummary = (value: unknown): DocumentAIAnalysis => {
  const source = isObject(value) ? value : {};
  return {
    summary: str(source.summary, "CareCircle will summarize this document after processing."),
    actionItems: Array.isArray(source.actionItems)
      ? source.actionItems.filter((item): item is string => typeof item === "string")
      : [],
    importantDates: Array.isArray(source.importantDates)
      ? source.importantDates.filter(
          (item): item is { date: string; description: string } =>
            isObject(item) && typeof item.date === "string" && typeof item.description === "string",
        )
      : [],
    medicalTerms: Array.isArray(source.medicalTerms)
      ? source.medicalTerms.filter(
          (item): item is { term: string; plainEnglish: string } =>
            isObject(item) && typeof item.term === "string" && typeof item.plainEnglish === "string",
        )
      : [],
    doctorQuestions: Array.isArray(source.doctorQuestions)
      ? source.doctorQuestions.filter((item): item is string => typeof item === "string")
      : [],
    documentType: str(source.documentType, "Document"),
    severityFlag:
      source.severityFlag === "urgent" || source.severityFlag === "review_needed"
        ? source.severityFlag
        : "normal",
  };
};

const mapPermissions = (memberRole: string, accessLevel: PatientAccessLevel, value: unknown): PatientPermissionSet => {
  const source = isObject(value) ? value : {};
  return normalizePatientPermissions(normalizePatientAccessRole(memberRole), accessLevel, {
    canViewMedications: bool(source.canViewMedications ?? source.can_view_medications),
    canManageMedications: bool(source.canManageMedications ?? source.can_manage_medications),
    canLogMedications: bool(source.canLogMedications ?? source.can_log_medications),
    canViewJournal: bool(source.canViewJournal ?? source.can_view_journal),
    canLogJournal: bool(source.canLogJournal ?? source.can_add_journal ?? source.can_log_journal),
    canViewDocuments: bool(source.canViewDocuments ?? source.can_view_documents),
    canUploadDocuments: bool(source.canUploadDocuments ?? source.can_upload_documents),
    canViewAppointments: bool(source.canViewAppointments ?? source.can_view_appointments),
    canManageAppointments: bool(source.canManageAppointments ?? source.can_add_appointments ?? source.can_manage_appointments),
    canViewVitals: bool(source.canViewVitals ?? source.can_view_vitals),
    canViewVitalsRaw: bool(source.canViewVitalsRaw ?? source.can_view_vitals_raw),
    canLogVitals: bool(source.canLogVitals ?? source.can_log_vitals),
    canViewFamily: bool(source.canViewFamily ?? source.can_chat ?? source.can_view_family),
    canManageFamily: bool(source.canManageFamily ?? source.can_manage_family),
    canViewTasks: bool(source.canViewTasks ?? source.can_view_tasks),
    canManageTasks: bool(source.canManageTasks ?? source.can_add_tasks ?? source.can_manage_tasks),
    canCompleteTasks: bool(source.canCompleteTasks ?? source.can_complete_tasks),
    canViewEmergency: bool(source.canViewEmergency ?? source.can_view_emergency_protocol ?? source.can_view_emergency),
    canShareEmergency: bool(source.canShareEmergency ?? source.can_generate_emergency_protocol ?? source.can_share_emergency),
    canEditPatient: bool(source.canEditPatient ?? source.can_edit_patient),
    canExportData: bool(source.canExportData ?? source.can_export_data),
    canAddClinicalNotes: bool(source.canAddClinicalNotes ?? source.can_add_clinical_notes),
    canAcceptInvites: bool(source.canAcceptInvites ?? source.can_accept_invites),
    canViewInsurance: bool(source.canViewInsurance ?? source.can_view_insurance),
    canViewAiInsights: bool(source.canViewAiInsights ?? source.can_view_ai_insights),
    canViewAuditLog: bool(source.canViewAuditLog ?? source.can_view_audit_log),
  });
};

const mapUser = (row: Record<string, unknown>): UserRecord => ({
  id: str(row.id),
  authUserId: str(row.auth_user_id),
  email: str(row.email),
  name: str(row.name),
  role: normalizeRole(str(row.role, "caregiver")),
  phone: opt(row.phone),
  photoUrl: opt(row.photo_url),
  licenseNumber: opt(row.license_number),
  createdAt: str(row.created_at, new Date().toISOString()),
  lastLogin: str(row.last_login, new Date().toISOString()),
  notificationPreferences:
    isObject(row.notification_preferences)
      ? { ...defaultNotificationPreferences(), ...(row.notification_preferences as Partial<NotificationPreferences>) }
      : defaultNotificationPreferences(),
});

const mapPatient = (row: Record<string, unknown>): PatientRecord => ({
  id: str(row.id),
  userId: str(row.owner_id ?? row.user_id),
  name: str(row.name ?? row.full_name),
  preferredName: opt(row.preferred_name),
  dateOfBirth: str(row.date_of_birth),
  photoUrl: opt(row.photo_url),
  primaryDiagnosis: str(row.primary_diagnosis),
  secondaryConditions: arr(row.secondary_conditions),
  primaryDoctorName: str(row.primary_doctor_name),
  primaryDoctorPhone: str(row.primary_doctor_phone),
  hospitalPreference: str(row.hospital_preference),
  insuranceProvider: str(row.insurance_provider),
  insuranceId: str(row.insurance_id),
  bloodType: str(row.blood_type),
  allergies: arr(row.allergies),
  mobilityLevel: str(row.mobility_level),
  createdAt: str(row.created_at, new Date().toISOString()),
  updatedAt: str(row.updated_at, new Date().toISOString()),
});

const mapMedication = (row: Record<string, unknown>): MedicationRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  name: str(row.name),
  brandName: opt(row.brand_name),
  genericName: opt(row.generic_name),
  doseAmount: str(row.dose_amount),
  doseUnit: str(row.dose_unit, "mg"),
  frequency: str(row.frequency, "once") as MedicationRecord["frequency"],
  timesOfDay: arr(row.times_of_day) as MedicationRecord["timesOfDay"],
  startDate: str(row.start_date),
  endDate: opt(row.end_date) ?? null,
  prescribingDoctor: str(row.prescribing_doctor),
  purpose: str(row.purpose),
  instructions: str(row.instructions),
  pillColor: str(row.pill_color),
  pillShape: str(row.pill_shape),
  refillDate: str(row.refill_date),
  pharmacyName: str(row.pharmacy_name),
  pharmacyPhone: str(row.pharmacy_phone),
  isActive: bool(row.is_active, true),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapMedicationLog = (row: Record<string, unknown>): MedicationLogRecord => ({
  id: str(row.id),
  medicationId: str(row.medication_id),
  patientId: str(row.patient_id),
  scheduledTime: str(row.scheduled_time),
  takenAt: opt(row.taken_at) ?? null,
  status: str(row.status, "taken") as MedicationLogRecord["status"],
  notes: opt(row.notes),
  loggedBy: str(row.logged_by),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapJournal = (row: Record<string, unknown>): CareJournalRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.user_id),
  date: str(row.date),
  time: str(row.time),
  entryTitle: str(row.entry_title),
  entryBody: str(row.entry_body),
  mood: Number(row.mood ?? 3),
  painLevel: Number(row.pain_level ?? 0),
  tags: arr(row.tags),
  severity: str(row.severity, "low") as CareJournalRecord["severity"],
  followUpNeeded: bool(row.follow_up_needed),
  followUpNote: opt(row.follow_up_note),
  createdAt: str(row.created_at, new Date().toISOString()),
  aiAnalysis: isObject(row.ai_analysis)
    ? {
        summary: str(row.ai_analysis.summary),
        doctorFlags: arr(row.ai_analysis.doctorFlags ?? row.ai_analysis.doctor_flags),
        actionSteps: arr(row.ai_analysis.actionSteps ?? row.ai_analysis.action_steps),
        questions: arr(row.ai_analysis.questions),
      }
    : undefined,
});

const mapDocument = (row: Record<string, unknown>): DocumentRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.user_id ?? row.uploaded_by),
  fileName: str(row.file_name),
  fileUrl: str(row.file_url),
  storagePath: opt(row.file_storage_path),
  fileType: row.file_type === "image" ? "image" : "PDF",
  documentCategory: str(row.document_category, "other") as DocumentRecord["documentCategory"],
  uploadDate: str(row.upload_date),
  documentDate: str(row.document_date, str(row.upload_date)),
  aiSummary: mapDocumentSummary(row.ai_summary),
  aiActionItems: Array.isArray(row.ai_action_items)
    ? row.ai_action_items.filter((item): item is string => typeof item === "string")
    : mapDocumentSummary(row.ai_summary).actionItems,
  isProcessed: bool(row.is_processed),
  extractedText: opt(row.extracted_text),
  processingStatus:
    row.processing_status === "queued" ||
    row.processing_status === "processing" ||
    row.processing_status === "failed"
      ? row.processing_status
      : bool(row.is_processed)
        ? "ready"
        : "queued",
  processingError: opt(row.processing_error),
  isLowConfidence: bool(row.low_confidence),
});

const mapAppointment = (row: Record<string, unknown>): AppointmentRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.user_id),
  doctorName: str(row.doctor_name),
  specialty: str(row.specialty),
  clinicName: str(row.clinic_name),
  appointmentDate: str(row.appointment_date),
  appointmentTime: str(row.appointment_time),
  durationMinutes: Number(row.duration_minutes ?? 30),
  address: str(row.address),
  phone: str(row.phone),
  videoLink: opt(row.video_link),
  purpose: str(row.purpose),
  notes: opt(row.notes),
  questionsToAsk: arr(row.questions_to_ask),
  status: str(row.status, "upcoming") as AppointmentRecord["status"],
  reminderSent: bool(row.reminder_sent),
  createdAt: str(row.created_at, new Date().toISOString()),
  followUpSummary: opt(row.follow_up_summary),
});

const mapTask = (row: Record<string, unknown>): TaskRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  createdBy: str(row.created_by),
  assignedTo: str(row.assigned_to),
  title: str(row.title),
  description: str(row.description),
  category: str(row.category, "other") as TaskRecord["category"],
  priority: str(row.priority, "medium") as TaskRecord["priority"],
  dueDate: str(row.due_date),
  dueTime: opt(row.due_time),
  recurrence: str(row.recurrence, "none") as TaskRecord["recurrence"],
  status: str(row.status, "todo") as TaskRecord["status"],
  aiSuggested: bool(row.ai_suggested),
  completedAt: opt(row.completed_at),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapVital = (row: Record<string, unknown>): HealthVitalsRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  loggedBy: str(row.logged_by),
  date: str(row.date),
  time: str(row.time),
  bloodPressureSystolic: typeof row.blood_pressure_systolic === "number" ? row.blood_pressure_systolic : undefined,
  bloodPressureDiastolic: typeof row.blood_pressure_diastolic === "number" ? row.blood_pressure_diastolic : undefined,
  heartRate: typeof row.heart_rate === "number" ? row.heart_rate : undefined,
  bloodGlucose: typeof row.blood_glucose === "number" ? row.blood_glucose : undefined,
  weight: typeof row.weight === "number" ? row.weight : undefined,
  temperature: typeof row.temperature === "number" ? row.temperature : undefined,
  oxygenSaturation: typeof row.oxygen_saturation === "number" ? row.oxygen_saturation : undefined,
  painLevel: typeof row.pain_level === "number" ? row.pain_level : undefined,
  notes: opt(row.notes),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapSettings = (row: Record<string, unknown>): AppSettingsRecord => ({
  userId: str(row.user_id),
  display: isObject(row.display)
    ? {
        fontSize: str(row.display.fontSize ?? row.display.font_size, "normal") as AppSettingsRecord["display"]["fontSize"],
        colorTheme: str(row.display.colorTheme ?? row.display.color_theme, "teal") as AppSettingsRecord["display"]["colorTheme"],
        dashboardLayout: str(row.display.dashboardLayout ?? row.display.dashboard_layout, "detailed") as AppSettingsRecord["display"]["dashboardLayout"],
        highContrast: bool(row.display.highContrast ?? row.display.high_contrast),
      }
    : { fontSize: "normal", colorTheme: "teal", dashboardLayout: "detailed", highContrast: false },
  helpLinks: Array.isArray(row.help_links)
    ? row.help_links.filter(
        (item): item is { title: string; url: string } =>
          isObject(item) && typeof item.title === "string" && typeof item.url === "string",
      )
    : [],
});

const mapActivity = (row: Record<string, unknown>): ActivityEventRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.user_id),
  type: str(row.type, "patient_updated") as ActivityEventRecord["type"],
  actorName: str(row.actor_name),
  description: str(row.description),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapReaction = (row: Record<string, unknown>): ActivityReactionRecord => ({
  id: str(row.id),
  eventId: str(row.event_id),
  userId: str(row.user_id),
  emoji: str(row.emoji),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapAudit = (row: Record<string, unknown>): SecurityAuditRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.actor_id ?? row.user_id),
  userName: str(row.actor_name ?? row.user_name),
  action: str(row.action, "profile_updated") as SecurityAuditRecord["action"],
  resourceType: str(row.resource_type ?? row.target_table),
  resourceId: opt(row.resource_id ?? row.target_id),
  outcome: str(row.outcome, "allowed") as SecurityAuditRecord["outcome"],
  detail: str(row.detail),
  createdAt: str(row.created_at, new Date().toISOString()),
  metadata: isObject(row.metadata) ? (row.metadata as Record<string, string | number | boolean>) : undefined,
});

const mapEmergencyProtocol = (row: Record<string, unknown>): EmergencyProtocolRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  protocolType: str(row.protocol_type, "general") as EmergencyProtocolRecord["protocolType"],
  title: str(row.title),
  steps: arr(row.steps),
  responderNotes: arr(row.responder_notes),
  importantNumbers: Array.isArray(row.important_numbers)
    ? row.important_numbers.filter(
        (item): item is { label: string; phone: string } =>
          isObject(item) && typeof item.label === "string" && typeof item.phone === "string",
      )
    : [],
  lastUpdated: str(row.last_updated, new Date().toISOString()),
  pdfUrl: opt(row.pdf_url),
  shareToken: str(row.share_token),
});

const mapInsight = (row: Record<string, unknown>): AIInsightRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  insightType: str(row.insight_type, "suggestion") as AIInsightRecord["insightType"],
  title: str(row.title),
  body: str(row.body),
  actionRecommended: str(row.action_recommended),
  generatedAt: str(row.generated_at, new Date().toISOString()),
  isRead: bool(row.is_read),
  isDismissed: bool(row.is_dismissed),
});

const mapNotification = (row: Record<string, unknown>): NotificationRecord => ({
  id: str(row.id),
  userId: str(row.user_id),
  patientId: str(row.patient_id),
  type: str(row.type, "family_update") as NotificationRecord["type"],
  title: str(row.title),
  message: str(row.message),
  isRead: bool(row.is_read),
  scheduledFor: str(row.scheduled_for, str(row.created_at, new Date().toISOString())),
  sentAt: opt(row.sent_at),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const mapChatSession = (row: Record<string, unknown>): ChatSessionRecord => ({
  id: str(row.id),
  patientId: str(row.patient_id),
  userId: str(row.user_id),
  title: str(row.title, "Care Chat"),
  createdAt: str(row.created_at, new Date().toISOString()),
  updatedAt: str(row.updated_at, str(row.created_at, new Date().toISOString())),
});

const mapChatMessage = (row: Record<string, unknown>): ChatMessageRecord => ({
  id: str(row.id),
  sessionId: str(row.session_id),
  patientId: str(row.patient_id),
  userId: opt(row.user_id),
  role: str(row.role, "assistant") === "user" ? "user" : "assistant",
  content: str(row.content),
  createdAt: str(row.created_at, new Date().toISOString()),
});

const redactFamilyMedication = (record: MedicationRecord): MedicationRecord => ({
  ...record,
  brandName: undefined,
  genericName: undefined,
  purpose: "",
  instructions: "",
  pharmacyName: "",
  pharmacyPhone: "",
});

const redactFamilyVital = (record: HealthVitalsRecord): HealthVitalsRecord => ({
  ...record,
  bloodPressureSystolic: undefined,
  bloodPressureDiastolic: undefined,
  heartRate: undefined,
  bloodGlucose: undefined,
  weight: undefined,
  temperature: undefined,
  oxygenSaturation: undefined,
  painLevel: undefined,
});

export const persistenceService = {
  async loadUserByAuthIdentity(authUserId: string | null | undefined, email: string) {
    if (!supabaseAdmin) return null;
    if (authUserId) {
      const { data, error } = await supabaseAdmin.from("users").select("*").eq("auth_user_id", authUserId).maybeSingle();
      if (error) throw new Error(`Unable to load user profile by auth ID: ${error.message}`);
      if (data) return mapUser(data);
    }
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("email", email).maybeSingle();
    if (error) throw new Error(`Unable to load user profile by email: ${error.message}`);
    return data ? mapUser(data) : null;
  },

  async persistUser(viewer: UserRecord) {
    await upsert("users", {
      id: viewer.id,
      auth_user_id: normalizeAuthUserId(viewer.authUserId),
      email: viewer.email,
      name: viewer.name,
      role: viewer.role,
      phone: viewer.phone ?? null,
      photo_url: viewer.photoUrl ?? null,
      license_number: viewer.licenseNumber ?? null,
      last_login: viewer.lastLogin,
      notification_preferences: viewer.notificationPreferences,
    });
  },

  async loadRequestSnapshot(viewerId: string, requestedPatientId?: string | null): Promise<AppSnapshot> {
    const snapshot = buildDemoSnapshot();
    if (!supabaseAdmin) {
      snapshot.activeUserId = viewerId;
      if (requestedPatientId) snapshot.activePatientId = requestedPatientId;
      return snapshot;
    }

    const [{ data: viewerRow, error: viewerError }, { data: ownedRows, error: ownedError }, { data: sharedAccessRows, error: sharedError }] =
      await Promise.all([
        supabaseAdmin.from("users").select("*").eq("id", viewerId).maybeSingle(),
        supabaseAdmin.from("patients").select("*").eq("owner_id", viewerId),
        supabaseAdmin.from("patient_access").select("*").eq("user_id", viewerId).eq("join_status", "active"),
      ]);

    if (viewerError) throw new Error(`Unable to load viewer: ${viewerError.message}`);
    if (!viewerRow) throw new Error("Signed-in user profile could not be found.");
    if (ownedError) throw new Error(`Unable to load owned patients: ${ownedError.message}`);
    if (sharedError) throw new Error(`Unable to load patient access: ${sharedError.message}`);

    const viewer = mapUser(viewerRow);
    const ownedPatients = (ownedRows ?? []).map((row) => mapPatient(row));
    const sharedIds = Array.from(new Set((sharedAccessRows ?? []).map((row) => str(row.patient_id))));
    const extraIds = sharedIds.filter((id) => !ownedPatients.some((patient) => patient.id === id));
    const sharedPatients = extraIds.length
      ? await (async () => {
          const { data, error } = await supabaseAdmin.from("patients").select("*").in("id", extraIds);
          if (error) throw new Error(`Unable to load shared patients: ${error.message}`);
          return (data ?? []).map((row) => mapPatient(row));
        })()
      : [];
    const patients = [...ownedPatients, ...sharedPatients];
    const patient =
      patients.find((item) => item.id === requestedPatientId) ??
      patients[0];
    if (!patient) throw new Error("This account does not have access to any patients yet.");

    const [
      accessResult,
      medicationResult,
      logResult,
      journalResult,
      documentResult,
      appointmentResult,
      taskResult,
      vitalResult,
      activityResult,
      reactionResult,
      settingsResult,
      auditResult,
      emergencyResult,
      insightResult,
      notificationResult,
      sessionResult,
      messageResult,
    ] = await Promise.all([
      supabaseAdmin.from("patient_access").select("*").eq("patient_id", patient.id),
      supabaseAdmin.from("medications").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("medication_logs").select("*").eq("patient_id", patient.id).order("scheduled_time", { ascending: false }),
      supabaseAdmin.from("care_journal").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("documents").select("*").eq("patient_id", patient.id).order("upload_date", { ascending: false }),
      supabaseAdmin.from("appointments").select("*").eq("patient_id", patient.id).order("appointment_date", { ascending: true }),
      supabaseAdmin.from("tasks").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("health_vitals").select("*").eq("patient_id", patient.id).order("date", { ascending: false }),
      supabaseAdmin.from("activity_events").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("activity_reactions").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("app_settings").select("*").eq("user_id", viewerId).maybeSingle(),
      supabaseAdmin.from("audit_log").select("*").or(`patient_id.eq.${patient.id},actor_id.eq.${viewerId}`).order("created_at", { ascending: false }).limit(25),
      supabaseAdmin.from("emergency_protocols").select("*").eq("patient_id", patient.id).order("last_updated", { ascending: false }),
      supabaseAdmin.from("ai_insights").select("*").eq("patient_id", patient.id).order("generated_at", { ascending: false }),
      supabaseAdmin.from("notifications").select("*").eq("patient_id", patient.id).eq("user_id", viewerId).order("created_at", { ascending: false }),
      supabaseAdmin.from("chat_sessions").select("*").eq("patient_id", patient.id).order("updated_at", { ascending: false }),
      supabaseAdmin.from("chat_messages").select("*").eq("patient_id", patient.id).order("created_at", { ascending: true }),
    ]);

    const failures = [
      accessResult,
      medicationResult,
      logResult,
      journalResult,
      documentResult,
      appointmentResult,
      taskResult,
      vitalResult,
      activityResult,
      reactionResult,
      auditResult,
      emergencyResult,
      insightResult,
      notificationResult,
      sessionResult,
      messageResult,
    ].find((result) => result.error);
    if (failures?.error) throw new Error(failures.error.message);
    if (settingsResult.error) throw new Error(settingsResult.error.message);

    const rawAccessRows = accessResult.data ?? [];
    const rosterUserIds = Array.from(
      new Set([viewerId, patient.userId, ...rawAccessRows.map((row) => opt(row.user_id)).filter(Boolean)]),
    );
    const rosterUsersById = new Map<string, UserRecord>();
    if (rosterUserIds.length) {
      const { data: rosterRows, error: rosterError } = await supabaseAdmin.from("users").select("*").in("id", rosterUserIds);
      if (rosterError) throw new Error(`Unable to load care team users: ${rosterError.message}`);
      (rosterRows ?? []).forEach((row) => {
        const mapped = mapUser(row);
        rosterUsersById.set(mapped.id, mapped);
      });
    }

    const viewerAccessRow = rawAccessRows.find((row) => str(row.user_id) === viewerId);
    const viewerRole = str(viewerAccessRow?.member_role ?? (patient.userId === viewerId ? "primary_caregiver" : "family_member"));
    const viewerLevel = derivePatientAccessLevel(viewerRole, mapPermissions(viewerRole, "view_only", viewerAccessRow?.permissions));
    const patientAccess = rawAccessRows.map((row) => {
      const role = str(row.member_role, "family_member");
      const memberUser = rosterUsersById.get(opt(row.user_id) ?? "");
      const level = derivePatientAccessLevel(role, mapPermissions(role, "view_only", row.permissions));
      const joinStatusValue = str(row.join_status, "pending");
      return buildPatientAccessRecord({
        id: str(row.id),
        patientId: str(row.patient_id),
        userId: opt(row.user_id),
        email: memberUser?.email ?? str(row.invite_email ?? row.email),
        name: memberUser?.name ?? str(row.invite_email ?? row.email),
        accessRole: normalizePatientAccessRole(role),
        accessLevel: level,
        permissions: mapPermissions(role, level, row.permissions),
        invitedBy: str(row.invited_by ?? patient.userId),
        joinStatus:
          joinStatusValue === "active"
            ? "active"
            : joinStatusValue === "pending"
              ? "pending"
              : "revoked",
        inviteToken: str(row.invite_token),
        createdAt: str(row.created_at, new Date().toISOString()),
        updatedAt: opt(row.updated_at),
        acceptedAt: opt(row.joined_at),
        lastActive: memberUser?.lastLogin ?? opt(row.updated_at),
      });
    });
    const viewerAccess =
      patientAccess.find((record) => record.userId === viewerId) ??
      buildPatientAccessRecord({
        id: `access_${viewerId}_${patient.id}`,
        patientId: patient.id,
        userId: viewerId,
        email: viewer.email,
        name: viewer.name,
        accessRole: patient.userId === viewerId ? "primary_caregiver" : normalizePatientAccessRole(viewerRole),
        accessLevel: patient.userId === viewerId ? "full_access" : viewerLevel,
        permissions:
          patient.userId === viewerId
            ? normalizePatientPermissions("primary_caregiver", "full_access")
            : mapPermissions(viewerRole, viewerLevel, viewerAccessRow?.permissions),
        invitedBy: patient.userId,
        joinStatus: "active",
        inviteToken: `access_${viewerId}`,
        createdAt: patient.createdAt,
      });

    snapshot.activeUserId = viewer.id;
    snapshot.activePatientId = patient.id;
    snapshot.users = rosterUsersById.size ? Array.from(rosterUsersById.values()) : [viewer];
    snapshot.patients = [
      viewerAccess.permissions.canViewInsurance ? patient : { ...patient, insuranceProvider: "", insuranceId: "" },
    ];
    snapshot.patientAccess = patientAccess.length ? patientAccess : [viewerAccess];
    snapshot.medications = viewerAccess.permissions.canViewMedications
      ? ((medicationResult.data ?? []).map((row) => mapMedication(row)).map((item) =>
          viewerAccess.accessRole === "family_member" ? redactFamilyMedication(item) : item,
        ))
      : [];
    snapshot.medicationLogs = viewerAccess.permissions.canViewMedications
      ? (logResult.data ?? []).map((row) => mapMedicationLog(row))
      : [];
    snapshot.careJournal = viewerAccess.permissions.canViewJournal
      ? (journalResult.data ?? [])
          .map((row) => mapJournal(row))
          .filter((entry) =>
            viewerAccess.accessRole === "family_member"
              ? entry.userId === viewer.id || entry.userId === patient.userId
              : true,
          )
      : [];
    snapshot.documents = viewerAccess.permissions.canViewDocuments
      ? (documentResult.data ?? []).map((row) => mapDocument(row))
      : [];
    snapshot.appointments = viewerAccess.permissions.canViewAppointments
      ? (appointmentResult.data ?? []).map((row) => mapAppointment(row)).filter((item) =>
          viewerAccess.accessRole === "doctor" ? item.doctorName === viewer.name : true,
        )
      : [];
    const derivedFamilyMembers = snapshot.patientAccess
      .map((record) =>
        buildFamilyMemberFromAccessRecord(record, {
          photoUrl: rosterUsersById.get(record.userId ?? "")?.photoUrl,
          lastActive: rosterUsersById.get(record.userId ?? "")?.lastLogin ?? record.lastActive,
        }),
      )
      .filter((record): record is NonNullable<typeof record> => Boolean(record));
    const owner = rosterUsersById.get(patient.userId);
    if (owner && !derivedFamilyMembers.some((record) => record.userId === owner.id)) {
      const ownerRecord = buildPatientAccessRecord({
        id: `access_${owner.id}_${patient.id}`,
        patientId: patient.id,
        userId: owner.id,
        email: owner.email,
        name: owner.name,
        accessRole: "primary_caregiver",
        accessLevel: "full_access",
        permissions: normalizePatientPermissions("primary_caregiver", "full_access"),
        invitedBy: owner.id,
        joinStatus: "active",
        inviteToken: `owner_${patient.id}`,
        createdAt: patient.createdAt,
        acceptedAt: patient.createdAt,
        lastActive: owner.lastLogin,
      });
      const ownerFamilyMember = buildFamilyMemberFromAccessRecord(ownerRecord, {
        photoUrl: owner.photoUrl,
        lastActive: owner.lastLogin,
        acceptedAt: patient.createdAt,
      });
      if (ownerFamilyMember) {
        derivedFamilyMembers.unshift(ownerFamilyMember);
      }
    }
    snapshot.familyMembers = viewerAccess.permissions.canViewFamily && viewerAccess.accessRole !== "doctor"
      ? derivedFamilyMembers
      : [];
    snapshot.tasks = viewerAccess.accessRole === "doctor" || !viewerAccess.permissions.canViewTasks
      ? []
      : (taskResult.data ?? []).map((row) => mapTask(row)).filter((item) =>
          viewerAccess.accessRole === "family_member" ? item.assignedTo === viewer.id : true,
        );
    snapshot.healthVitals = viewerAccess.permissions.canViewVitals
      ? (vitalResult.data ?? []).map((row) => mapVital(row)).map((item) =>
          viewerAccess.permissions.canViewVitalsRaw || viewerAccess.accessRole !== "family_member"
            ? item
            : redactFamilyVital(item),
        )
      : [];
    snapshot.activityEvents = viewerAccess.permissions.canViewFamily && viewerAccess.accessRole !== "doctor"
      ? (activityResult.data ?? []).map((row) => mapActivity(row))
      : [];
    snapshot.activityReactions = viewerAccess.permissions.canViewFamily && viewerAccess.accessRole !== "doctor"
      ? (reactionResult.data ?? []).map((row) => mapReaction(row))
      : [];
    snapshot.settings = settingsResult.data ? [mapSettings(settingsResult.data)] : [];
    snapshot.securityAuditLogs = viewerAccess.permissions.canViewAuditLog
      ? (auditResult.data ?? []).map((row) => mapAudit(row))
      : (auditResult.data ?? []).map((row) => mapAudit(row)).filter((row) => row.userId === viewer.id);

    const chatSessions = (sessionResult.data ?? []).map((row) => mapChatSession(row));
    const chatMessages = (messageResult.data ?? []).map((row) => mapChatMessage(row));
    const familySession = chatSessions.find((record) => record.title === "Family Hub");
    const familySessionId = familySession?.id ?? "";
    snapshot.familyMessages =
      viewerAccess.permissions.canViewFamily && viewerAccess.accessRole !== "doctor"
        ? (messageResult.data ?? [])
            .filter((row) => str(row.session_id) === familySessionId && str(row.role, "user") === "user")
            .map((row) => {
              const messageUserId = str(row.user_id);
              const messageUser = rosterUsersById.get(messageUserId);
              return {
                id: str(row.id),
                patientId: str(row.patient_id),
                userId: messageUserId,
                userName: messageUser?.name ?? "CareCircle member",
                userAvatarUrl: messageUser?.photoUrl,
                messageText: str(row.content),
                createdAt: str(row.created_at, new Date().toISOString()),
                isPinned: bool(row.is_pinned),
              };
            })
        : [];
    snapshot.emergencyProtocols = viewerAccess.permissions.canViewEmergency
      ? (emergencyResult.data ?? []).map((row) => mapEmergencyProtocol(row))
      : [];
    snapshot.aiInsights = viewerAccess.permissions.canViewAiInsights
      ? (insightResult.data ?? []).map((row) => mapInsight(row))
      : [];
    snapshot.notifications = (notificationResult.data ?? []).map((row) => mapNotification(row));
    snapshot.chatSessions =
      viewerAccess.permissions.canViewAiInsights && viewerAccess.accessRole !== "doctor"
        ? chatSessions.filter((record) => record.id !== familySessionId && record.userId === viewer.id)
        : viewerAccess.permissions.canViewAiInsights
          ? chatSessions.filter((record) => record.id !== familySessionId)
          : [];
    const visibleChatSessionIds = new Set(snapshot.chatSessions.map((record) => record.id));
    snapshot.chatMessages = snapshot.chatSessions.length
      ? chatMessages.filter((record) => visibleChatSessionIds.has(record.sessionId))
      : [];
    return snapshot;
  },

  async hydrateDocumentsForPatient(_patientId: string) {},

  async persistPatientAccess(record: PatientAccessRecord) {
    const row = {
      id: record.id,
      patient_id: record.patientId,
      user_id: record.userId ?? null,
      member_role: record.accessRole,
      permissions: {
        can_view_medications: record.permissions.canViewMedications,
        can_manage_medications: record.permissions.canManageMedications,
        can_log_medications: record.permissions.canLogMedications,
        can_view_journal: record.permissions.canViewJournal,
        can_add_journal: record.permissions.canLogJournal,
        can_view_documents: record.permissions.canViewDocuments,
        can_upload_documents: record.permissions.canUploadDocuments,
        can_view_appointments: record.permissions.canViewAppointments,
        can_add_appointments: record.permissions.canManageAppointments,
        can_view_vitals: record.permissions.canViewVitals,
        can_view_vitals_raw: record.permissions.canViewVitalsRaw,
        can_log_vitals: record.permissions.canLogVitals,
        can_chat: record.permissions.canViewFamily,
        can_view_tasks: record.permissions.canViewTasks,
        can_add_tasks: record.permissions.canManageTasks,
        can_complete_tasks: record.permissions.canCompleteTasks,
        can_view_emergency_protocol: record.permissions.canViewEmergency,
        can_generate_emergency_protocol: record.permissions.canShareEmergency,
        can_edit_patient: record.permissions.canEditPatient,
        can_export_data: record.permissions.canExportData,
        can_add_clinical_notes: record.permissions.canAddClinicalNotes,
        can_accept_invites: record.permissions.canAcceptInvites,
        can_view_insurance: record.permissions.canViewInsurance,
        can_view_ai_insights: record.permissions.canViewAiInsights,
        can_view_audit_log: record.permissions.canViewAuditLog,
      },
      invite_email: record.email,
      invite_token: record.inviteToken,
      invited_by: record.invitedBy,
      join_status: record.joinStatus === "revoked" ? "removed" : record.joinStatus,
      joined_at: record.acceptedAt ?? null,
      updated_at: record.updatedAt ?? new Date().toISOString(),
      created_at: record.createdAt,
    };
    await upsert("patient_access", row, record.userId ? "patient_id,user_id" : "invite_token");
  },

  async deletePatientAccess(id: string) {
    await removeById("patient_access", id);
  },

  async persistPatient(patient: PatientRecord) {
    await upsert("patients", {
      id: patient.id,
      owner_id: patient.userId,
      user_id: patient.userId,
      name: patient.name,
      preferred_name: patient.preferredName ?? null,
      date_of_birth: patient.dateOfBirth,
      photo_url: patient.photoUrl ?? null,
      primary_diagnosis: patient.primaryDiagnosis,
      secondary_conditions: patient.secondaryConditions,
      primary_doctor_name: patient.primaryDoctorName,
      primary_doctor_phone: patient.primaryDoctorPhone,
      hospital_preference: patient.hospitalPreference,
      insurance_provider: patient.insuranceProvider,
      insurance_id: patient.insuranceId,
      blood_type: patient.bloodType,
      allergies: patient.allergies,
      mobility_level: patient.mobilityLevel,
      updated_at: patient.updatedAt,
    });
  },

  async persistMedication(record: MedicationRecord) {
    await upsert("medications", {
      id: record.id,
      patient_id: record.patientId,
      name: record.name,
      brand_name: record.brandName ?? null,
      generic_name: record.genericName ?? null,
      dose_amount: record.doseAmount,
      dose_unit: record.doseUnit,
      frequency: record.frequency,
      times_of_day: record.timesOfDay,
      start_date: record.startDate,
      end_date: record.endDate ?? null,
      prescribing_doctor: record.prescribingDoctor,
      purpose: record.purpose,
      instructions: record.instructions,
      pill_color: record.pillColor,
      pill_shape: record.pillShape,
      refill_date: record.refillDate,
      pharmacy_name: record.pharmacyName,
      pharmacy_phone: record.pharmacyPhone,
      is_active: record.isActive,
      created_at: record.createdAt,
    });
  },

  async deleteMedication(id: string) {
    await removeById("medications", id);
  },

  async persistMedicationLog(record: MedicationLogRecord) {
    await upsert("medication_logs", {
      id: record.id,
      medication_id: record.medicationId,
      patient_id: record.patientId,
      scheduled_time: record.scheduledTime,
      taken_at: record.takenAt ?? null,
      status: record.status,
      notes: record.notes ?? null,
      logged_by: record.loggedBy,
      created_at: record.createdAt,
    });
  },

  async persistJournalEntry(record: CareJournalRecord) {
    await upsert("care_journal", {
      id: record.id,
      patient_id: record.patientId,
      user_id: record.userId,
      date: record.date,
      time: record.time,
      entry_title: record.entryTitle,
      entry_body: record.entryBody,
      mood: record.mood,
      pain_level: record.painLevel,
      tags: record.tags,
      severity: record.severity,
      follow_up_needed: record.followUpNeeded,
      follow_up_note: record.followUpNote ?? null,
      ai_analysis: record.aiAnalysis ?? null,
      created_at: record.createdAt,
    });
  },

  async persistDocument(record: DocumentRecord) {
    await upsert("documents", {
      id: record.id,
      patient_id: record.patientId,
      user_id: record.userId,
      file_name: record.fileName,
      file_url: record.fileUrl,
      file_storage_path: record.storagePath ?? null,
      file_type: record.fileType,
      document_category: record.documentCategory,
      upload_date: record.uploadDate,
      document_date: record.documentDate,
      ai_summary: record.aiSummary,
      ai_action_items: record.aiActionItems,
      is_processed: record.isProcessed,
      extracted_text: record.extractedText ?? null,
      processing_status: record.processingStatus,
      processing_error: record.processingError ?? null,
      low_confidence: record.isLowConfidence ?? false,
    });
  },

  async deleteDocument(record: DocumentRecord) {
    if (supabaseAdmin && record.storagePath) {
      const { error } = await supabaseAdmin.storage.from(env.storageBucket).remove([record.storagePath]);
      if (error) throw new Error(`Unable to remove stored file: ${error.message}`);
    }
    await removeById("documents", record.id);
  },

  async persistAppointment(record: AppointmentRecord) {
    await upsert("appointments", {
      id: record.id,
      patient_id: record.patientId,
      user_id: record.userId,
      doctor_name: record.doctorName,
      specialty: record.specialty,
      clinic_name: record.clinicName,
      appointment_date: record.appointmentDate,
      appointment_time: record.appointmentTime,
      duration_minutes: record.durationMinutes,
      address: record.address,
      phone: record.phone,
      video_link: record.videoLink ?? null,
      purpose: record.purpose,
      notes: record.notes ?? null,
      questions_to_ask: record.questionsToAsk,
      status: record.status,
      reminder_sent: record.reminderSent,
      follow_up_summary: record.followUpSummary ?? null,
      created_at: record.createdAt,
    });
  },

  async deleteAppointment(id: string) {
    await removeById("appointments", id);
  },

  async persistVital(record: HealthVitalsRecord) {
    await upsert("health_vitals", {
      id: record.id,
      patient_id: record.patientId,
      logged_by: record.loggedBy,
      date: record.date,
      time: record.time,
      blood_pressure_systolic: record.bloodPressureSystolic ?? null,
      blood_pressure_diastolic: record.bloodPressureDiastolic ?? null,
      heart_rate: record.heartRate ?? null,
      blood_glucose: record.bloodGlucose ?? null,
      weight: record.weight ?? null,
      temperature: record.temperature ?? null,
      oxygen_saturation: record.oxygenSaturation ?? null,
      pain_level: record.painLevel ?? null,
      notes: record.notes ?? null,
      created_at: record.createdAt,
    });
  },

  async persistTask(record: TaskRecord) {
    await upsert("tasks", {
      id: record.id,
      patient_id: record.patientId,
      created_by: record.createdBy,
      assigned_to: record.assignedTo,
      title: record.title,
      description: record.description,
      category: record.category,
      priority: record.priority,
      due_date: record.dueDate,
      due_time: record.dueTime ?? null,
      recurrence: record.recurrence,
      status: record.status,
      ai_suggested: record.aiSuggested,
      completed_at: record.completedAt ?? null,
      created_at: record.createdAt,
    });
  },

  async deleteTask(id: string) {
    await removeById("tasks", id);
  },

  async persistFamilyMessage(record: FamilyMessageRecord, sessionId: string) {
    await upsert("chat_sessions", {
      id: sessionId,
      patient_id: record.patientId,
      user_id: record.userId,
      title: "Family Hub",
      created_at: record.createdAt,
      updated_at: record.createdAt,
    });

    const baseRow = {
      id: record.id,
      session_id: sessionId,
      patient_id: record.patientId,
      user_id: record.userId,
      role: "user",
      content: record.messageText,
      created_at: record.createdAt,
    };

    try {
      await upsert("chat_messages", {
        ...baseRow,
        is_pinned: record.isPinned,
      });
    } catch (error) {
      if (!isMissingColumnError(error, "is_pinned")) {
        throw error;
      }
      await upsert("chat_messages", baseRow);
    }
  },

  async persistActivityEvent(record: ActivityEventRecord) {
    await upsert("activity_events", {
      id: record.id,
      patient_id: record.patientId,
      user_id: record.userId,
      type: record.type,
      actor_name: record.actorName,
      description: record.description,
      created_at: record.createdAt,
    });
  },

  async persistActivityReaction(record: ActivityReactionRecord) {
    await upsert("activity_reactions", {
      id: record.id,
      event_id: record.eventId,
      user_id: record.userId,
      emoji: record.emoji,
      created_at: record.createdAt,
    });
  },

  async persistSettings(record: AppSettingsRecord) {
    await upsert("app_settings", {
      user_id: record.userId,
      display: record.display,
      help_links: record.helpLinks,
    }, "user_id");
  },

  async persistAuditLog(record: SecurityAuditRecord) {
    await upsert("audit_log", {
      id: record.id,
      patient_id: record.patientId,
      actor_id: record.userId,
      actor_name: record.userName,
      action: record.action,
      resource_type: record.resourceType,
      resource_id: record.resourceId ?? null,
      outcome: record.outcome,
      detail: record.detail,
      metadata: record.metadata ?? {},
      created_at: record.createdAt,
    });
  },
};
