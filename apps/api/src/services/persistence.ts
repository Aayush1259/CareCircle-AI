import type { DocumentAIAnalysis, DocumentRecord, NotificationPreferences, UserRecord, UserRole } from "@carecircle/shared";
import { getState } from "../store";
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

const normalizeDocumentSummary = (value: unknown): DocumentAIAnalysis => {
  const summary = typeof value === "object" && value !== null ? (value as Partial<DocumentAIAnalysis>) : {};

  return {
    summary: summary.summary ?? "CareCircle will summarize this document after processing.",
    actionItems: Array.isArray(summary.actionItems) ? summary.actionItems.filter((item): item is string => typeof item === "string") : [],
    importantDates: Array.isArray(summary.importantDates)
      ? summary.importantDates.filter(
          (item): item is { date: string; description: string } =>
            typeof item === "object" &&
            item !== null &&
            typeof item.date === "string" &&
            typeof item.description === "string",
        )
      : [],
    medicalTerms: Array.isArray(summary.medicalTerms)
      ? summary.medicalTerms.filter(
          (item): item is { term: string; plainEnglish: string } =>
            typeof item === "object" &&
            item !== null &&
            typeof item.term === "string" &&
            typeof item.plainEnglish === "string",
        )
      : [],
    doctorQuestions: Array.isArray(summary.doctorQuestions)
      ? summary.doctorQuestions.filter((item): item is string => typeof item === "string")
      : [],
    documentType: summary.documentType ?? "Document",
    severityFlag:
      summary.severityFlag === "urgent" || summary.severityFlag === "review_needed"
        ? summary.severityFlag
        : "normal",
  };
};

const mapUserRowToRecord = (row: Record<string, unknown>): UserRecord => ({
  id: String(row.id),
  authUserId: typeof row.auth_user_id === "string" ? row.auth_user_id : "",
  email: String(row.email),
  name: String(row.name),
  role: normalizeRole(typeof row.role === "string" ? row.role : undefined),
  phone: typeof row.phone === "string" && row.phone ? row.phone : undefined,
  photoUrl: typeof row.photo_url === "string" && row.photo_url ? row.photo_url : undefined,
  licenseNumber: typeof row.license_number === "string" && row.license_number ? row.license_number : undefined,
  createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  lastLogin: typeof row.last_login === "string" ? row.last_login : new Date().toISOString(),
  notificationPreferences:
    typeof row.notification_preferences === "object" && row.notification_preferences !== null
      ? { ...defaultNotificationPreferences(), ...(row.notification_preferences as Partial<NotificationPreferences>) }
      : defaultNotificationPreferences(),
});

const mapDocumentRowToRecord = (row: Record<string, unknown>): DocumentRecord => ({
  id: String(row.id),
  patientId: String(row.patient_id),
  userId: String(row.user_id),
  fileName: String(row.file_name),
  fileUrl: typeof row.file_url === "string" ? row.file_url : "",
  storagePath: typeof row.file_storage_path === "string" && row.file_storage_path ? row.file_storage_path : undefined,
  fileType: row.file_type === "image" ? "image" : "PDF",
  documentCategory: String(row.document_category) as DocumentRecord["documentCategory"],
  uploadDate: String(row.upload_date),
  documentDate: typeof row.document_date === "string" ? row.document_date : String(row.upload_date),
  aiSummary: normalizeDocumentSummary(row.ai_summary),
  aiActionItems: Array.isArray(row.ai_action_items)
    ? row.ai_action_items.filter((item): item is string => typeof item === "string")
    : [],
  isProcessed: Boolean(row.is_processed),
  extractedText: typeof row.extracted_text === "string" && row.extracted_text ? row.extracted_text : undefined,
});

export const persistenceService = {
  async loadUserByAuthIdentity(authUserId: string | null | undefined, email: string) {
    if (!supabaseAdmin) return null;

    if (authUserId) {
      const { data, error } = await supabaseAdmin.from("users").select("*").eq("auth_user_id", authUserId).maybeSingle();
      if (error) {
        throw new Error(`Unable to load user profile by auth ID: ${error.message}`);
      }
      if (data) {
        return mapUserRowToRecord(data);
      }
    }

    const { data, error } = await supabaseAdmin.from("users").select("*").eq("email", email).maybeSingle();
    if (error) {
      throw new Error(`Unable to load user profile by email: ${error.message}`);
    }
    return data ? mapUserRowToRecord(data) : null;
  },

  async persistUser(viewer: UserRecord) {
    if (!supabaseAdmin) return;

    const { error } = await supabaseAdmin.from("users").upsert(
      {
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
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Unable to persist user profile: ${error.message}`);
    }
  },

  async loadDocumentsForPatient(patientId: string) {
    if (!supabaseAdmin) return [];

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("upload_date", { ascending: false });

    if (error) {
      throw new Error(`Unable to load documents from Supabase: ${error.message}`);
    }

    return (data ?? []).map((row) => mapDocumentRowToRecord(row));
  },

  async hydrateDocumentsForPatient(patientId: string) {
    const documents = await this.loadDocumentsForPatient(patientId);
    if (!documents.length) return;

    const state = getState();
    const merged = new Map<string, DocumentRecord>();
    state.documents
      .filter((document) => document.patientId !== patientId)
      .forEach((document) => merged.set(document.id, document));
    documents.forEach((document) => merged.set(document.id, document));
    state.documents = Array.from(merged.values()).sort((left, right) => right.uploadDate.localeCompare(left.uploadDate));
  },

  async persistDocument(document: DocumentRecord) {
    if (!supabaseAdmin) return;

    const { error } = await supabaseAdmin.from("documents").upsert(
      {
        id: document.id,
        patient_id: document.patientId,
        user_id: document.userId,
        file_name: document.fileName,
        file_url: document.fileUrl,
        file_storage_path: document.storagePath ?? null,
        file_type: document.fileType,
        document_category: document.documentCategory,
        upload_date: document.uploadDate,
        document_date: document.documentDate,
        ai_summary: document.aiSummary,
        ai_action_items: document.aiActionItems,
        is_processed: document.isProcessed,
        extracted_text: document.extractedText ?? null,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Unable to persist document metadata: ${error.message}`);
    }
  },

  async deleteDocument(document: DocumentRecord) {
    if (!supabaseAdmin) return;

    if (document.storagePath) {
      const { error: storageError } = await supabaseAdmin.storage.from(env.storageBucket).remove([document.storagePath]);
      if (storageError) {
        throw new Error(`Unable to remove stored file: ${storageError.message}`);
      }
    }

    const { error } = await supabaseAdmin.from("documents").delete().eq("id", document.id);
    if (error) {
      throw new Error(`Unable to delete document metadata: ${error.message}`);
    }
  },
};
