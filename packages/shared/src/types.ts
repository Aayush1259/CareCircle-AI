export type UserRole = "caregiver" | "family_member" | "doctor" | "admin";
export type FamilyRole =
  | "primary_caregiver"
  | "secondary_caregiver"
  | "family"
  | "emergency_contact";
export type PermissionLevel = "view_only" | "can_log" | "full_access";
export type PatientAccessRole = FamilyRole | "doctor";
export type PatientAccessLevel = PermissionLevel | "clinical_access";
export type PatientCapability =
  | "view_dashboard"
  | "view_medications"
  | "log_medications"
  | "view_journal"
  | "log_journal"
  | "view_documents"
  | "upload_documents"
  | "view_appointments"
  | "manage_appointments"
  | "view_vitals"
  | "log_vitals"
  | "view_family"
  | "manage_family"
  | "view_tasks"
  | "manage_tasks"
  | "view_emergency"
  | "share_emergency"
  | "edit_patient"
  | "export_data"
  | "add_clinical_notes"
  | "accept_invites";
export type Frequency =
  | "once"
  | "twice"
  | "three_times"
  | "four_times"
  | "as_needed";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "bedtime";
export type MedicationLogStatus = "taken" | "missed" | "skipped";
export type JournalSeverity = "low" | "medium" | "high" | "emergency";
export type DocumentCategory =
  | "medical_record"
  | "insurance"
  | "prescription"
  | "discharge_summary"
  | "lab_result"
  | "other";
export type AppointmentStatus =
  | "upcoming"
  | "completed"
  | "cancelled"
  | "rescheduled";
export type TaskCategory =
  | "medical"
  | "personal_care"
  | "household"
  | "administrative"
  | "emotional_support"
  | "errands"
  | "other";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";
export type TaskStatus = "todo" | "in_progress" | "done" | "overdue";
export type EmergencyType =
  | "fall"
  | "cardiac"
  | "diabetic_emergency"
  | "allergic_reaction"
  | "confusion"
  | "general"
  | "high_fever"
  | "medication_error"
  | "breathing_difficulty"
  | "seizure"
  | "custom";
export type InsightType = "pattern" | "warning" | "positive_trend" | "suggestion";
export type NotificationType =
  | "medication_reminder"
  | "appointment"
  | "task_due"
  | "ai_alert"
  | "family_update";
export type ActivityType =
  | "medication_logged"
  | "journal_added"
  | "appointment_scheduled"
  | "document_uploaded"
  | "vital_logged"
  | "task_updated"
  | "task_completed"
  | "message_sent"
  | "invite_sent"
  | "patient_updated";
export type ThemeMode = "teal" | "blue" | "purple";
export type FontScale = "normal" | "large" | "extra_large";
export type DashboardMode = "detailed" | "simplified";
export type FeedbackSubject = "bug_report" | "feature_request" | "general_feedback" | "other";
export type AuditActionType =
  | "auth_signup"
  | "auth_login"
  | "auth_logout"
  | "invite_sent"
  | "invite_accepted"
  | "invite_resend"
  | "invite_cancel"
  | "profile_updated"
  | "patient_updated"
  | "notification_updated"
  | "display_updated"
  | "feedback_submitted"
  | "export_csv"
  | "export_documents_zip"
  | "emergency_share_link"
  | "emergency_share_email"
  | "document_uploaded"
  | "document_accessed"
  | "document_reprocessed"
  | "document_deleted"
  | "access_denied";

export interface NotificationPreferences {
  medicationReminders: boolean;
  medicationReminderTime: string;
  appointment24h: boolean;
  appointment1h: boolean;
  weeklySummary: boolean;
  weeklySummaryDay: string;
  aiInsightAlerts: boolean;
  familyActivityUpdates: boolean;
  timezone: string;
}

export interface UserRecord {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  photoUrl?: string;
  licenseNumber?: string;
  createdAt: string;
  lastLogin: string;
  notificationPreferences: NotificationPreferences;
}

export interface PatientRecord {
  id: string;
  userId: string;
  name: string;
  preferredName?: string;
  dateOfBirth: string;
  photoUrl?: string;
  primaryDiagnosis: string;
  secondaryConditions: string[];
  primaryDoctorName: string;
  primaryDoctorPhone: string;
  hospitalPreference: string;
  insuranceProvider: string;
  insuranceId: string;
  bloodType: string;
  allergies: string[];
  mobilityLevel: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientAccessRecord {
  id: string;
  patientId: string;
  userId?: string;
  email: string;
  name: string;
  accessRole: PatientAccessRole;
  accessLevel: PatientAccessLevel;
  capabilities: PatientCapability[];
  invitedBy: string;
  joinStatus: "pending" | "active" | "revoked";
  inviteToken: string;
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string;
  lastActive?: string;
}

export interface MedicationRecord {
  id: string;
  patientId: string;
  name: string;
  brandName?: string;
  genericName?: string;
  doseAmount: string;
  doseUnit: string;
  frequency: Frequency;
  timesOfDay: TimeOfDay[];
  startDate: string;
  endDate?: string | null;
  prescribingDoctor: string;
  purpose: string;
  instructions: string;
  pillColor: string;
  pillShape: string;
  refillDate: string;
  pharmacyName: string;
  pharmacyPhone: string;
  isActive: boolean;
  createdAt: string;
}

export interface MedicationLogRecord {
  id: string;
  medicationId: string;
  patientId: string;
  scheduledTime: string;
  takenAt?: string | null;
  status: MedicationLogStatus;
  notes?: string;
  loggedBy: string;
  createdAt: string;
}

export interface CareJournalRecord {
  id: string;
  patientId: string;
  userId: string;
  date: string;
  time: string;
  entryTitle: string;
  entryBody: string;
  mood: number;
  painLevel: number;
  tags: string[];
  severity: JournalSeverity;
  followUpNeeded: boolean;
  followUpNote?: string;
  createdAt: string;
  isNew?: boolean;
  aiAnalysis?: {
    summary: string;
    doctorFlags: string[];
    actionSteps: string[];
    questions: string[];
  };
}

export interface DocumentAIAnalysis {
  summary: string;
  actionItems: string[];
  importantDates: Array<{ date: string; description: string }>;
  medicalTerms: Array<{ term: string; plainEnglish: string }>;
  doctorQuestions: string[];
  documentType: string;
  severityFlag: "normal" | "review_needed" | "urgent";
}

export interface DocumentRecord {
  id: string;
  patientId: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  fileType: "PDF" | "image";
  documentCategory: DocumentCategory;
  uploadDate: string;
  documentDate: string;
  aiSummary: DocumentAIAnalysis;
  aiActionItems: string[];
  isProcessed: boolean;
  extractedText?: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  userId: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  address: string;
  phone: string;
  videoLink?: string;
  purpose: string;
  notes?: string;
  questionsToAsk: string[];
  status: AppointmentStatus;
  reminderSent: boolean;
  createdAt: string;
  followUpSummary?: string;
}

export interface FamilyMemberRecord {
  id: string;
  patientId: string;
  invitedBy: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  relationship: string;
  role: FamilyRole;
  permissions: PermissionLevel;
  joinStatus: "pending" | "active";
  inviteToken: string;
  createdAt: string;
  photoUrl?: string;
  lastActive?: string;
  acceptedAt?: string;
}

export interface TaskRecord {
  id: string;
  patientId: string;
  createdBy: string;
  assignedTo: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
  recurrence: TaskRecurrence;
  status: TaskStatus;
  aiSuggested: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface EmergencyProtocolRecord {
  id: string;
  patientId: string;
  protocolType: EmergencyType;
  title: string;
  steps: string[];
  responderNotes: string[];
  importantNumbers: Array<{ label: string; phone: string }>;
  lastUpdated: string;
  pdfUrl?: string;
  shareToken: string;
}

export interface HealthVitalsRecord {
  id: string;
  patientId: string;
  loggedBy: string;
  date: string;
  time: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  bloodGlucose?: number;
  weight?: number;
  temperature?: number;
  oxygenSaturation?: number;
  painLevel?: number;
  notes?: string;
  createdAt: string;
}

export interface AIInsightRecord {
  id: string;
  patientId: string;
  insightType: InsightType;
  title: string;
  body: string;
  actionRecommended: string;
  generatedAt: string;
  isRead: boolean;
  isDismissed: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  patientId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  scheduledFor: string;
  sentAt?: string;
  createdAt: string;
}

export interface ChatSessionRecord {
  id: string;
  patientId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  patientId: string;
  userId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface FamilyMessageRecord {
  id: string;
  patientId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  messageText: string;
  createdAt: string;
  isPinned: boolean;
}

export interface ActivityEventRecord {
  id: string;
  patientId: string;
  userId: string;
  type: ActivityType;
  actorName: string;
  description: string;
  createdAt: string;
}

export interface ActivityReactionRecord {
  id: string;
  eventId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface DisplayPreferences {
  fontSize: FontScale;
  colorTheme: ThemeMode;
  dashboardLayout: DashboardMode;
  highContrast: boolean;
}

export interface AppSettingsRecord {
  userId: string;
  display: DisplayPreferences;
  helpLinks: Array<{ title: string; url: string }>;
  updatedAt?: string;
}

export interface FeedbackRecord {
  id: string;
  subject: FeedbackSubject;
  message: string;
  replyEmail?: string;
  userId: string;
  createdAt: string;
}

export interface SecurityAuditRecord {
  id: string;
  patientId: string;
  userId: string;
  userName: string;
  action: AuditActionType;
  resourceType: string;
  resourceId?: string;
  outcome: "allowed" | "blocked";
  detail: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PendingEmailUpdateRecord {
  id: string;
  userId: string;
  nextEmail: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
}

export interface AuthSession {
  token: string;
  viewer: UserRecord;
  patient: PatientRecord;
  access: PatientAccessRecord | null;
  capabilities: PatientCapability[];
  mode: "demo" | "supabase";
  expiresAt: string;
}

export interface DashboardSummary {
  greetingName: string;
  currentDate: string;
  dailyBriefing: string;
  medicationProgress: {
    taken: number;
    total: number;
    adherenceScore: number;
  };
  nextAppointment?: AppointmentRecord;
  tasksDueToday: number;
  lastJournalEntry?: CareJournalRecord;
}

export interface AppSnapshot {
  users: UserRecord[];
  patients: PatientRecord[];
  patientAccess: PatientAccessRecord[];
  medications: MedicationRecord[];
  medicationLogs: MedicationLogRecord[];
  careJournal: CareJournalRecord[];
  documents: DocumentRecord[];
  appointments: AppointmentRecord[];
  familyMembers: FamilyMemberRecord[];
  familyMessages: FamilyMessageRecord[];
  tasks: TaskRecord[];
  emergencyProtocols: EmergencyProtocolRecord[];
  healthVitals: HealthVitalsRecord[];
  aiInsights: AIInsightRecord[];
  notifications: NotificationRecord[];
  chatSessions: ChatSessionRecord[];
  chatMessages: ChatMessageRecord[];
  activityEvents: ActivityEventRecord[];
  activityReactions: ActivityReactionRecord[];
  settings: AppSettingsRecord[];
  securityAuditLogs: SecurityAuditRecord[];
  activeUserId: string;
  activePatientId: string;
}

export interface BootstrapPayload {
  viewer: UserRecord;
  patient: PatientRecord;
  viewerAccess: PatientAccessRecord | null;
  patientAccess: PatientAccessRecord[];
  capabilities: PatientCapability[];
  dashboard: DashboardSummary;
  data: Omit<AppSnapshot, "activeUserId" | "activePatientId">;
}
