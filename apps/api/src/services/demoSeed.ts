import { buildDemoSnapshot, demoAccounts, demoPassword } from "@carecircle/shared";
import type { UserRecord } from "@carecircle/shared";
import { featureFlags } from "../env";
import { persistenceService } from "./persistence";
import { supabaseAdmin } from "./supabase";

const upsertDemoRow = async (table: string, row: Record<string, unknown>, onConflict = "id") => {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from(table).upsert(row, { onConflict });
  if (error) {
    throw new Error(`Unable to seed ${table}: ${error.message}`);
  }
};

const findAuthUserByEmail = async (email: string) => {
  if (!supabaseAdmin) return null;

  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`Unable to list demo auth users: ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }

    if (!data.nextPage) {
      return null;
    }
    page = data.nextPage;
  }
};

const ensureDemoAuthUser = async (viewer: UserRecord) => {
  if (!supabaseAdmin) return viewer.authUserId;

  const metadata = {
    full_name: viewer.name,
    role: viewer.role,
    license_number: viewer.licenseNumber ?? null,
  };

  const existing = await findAuthUserByEmail(viewer.email);
  if (existing) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) {
      throw new Error(`Unable to update demo auth user ${viewer.email}: ${error.message}`);
    }
    return data.user?.id ?? existing.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: viewer.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user?.id) {
    throw new Error(`Unable to create demo auth user ${viewer.email}: ${error?.message ?? "Unknown error"}`);
  }

  return data.user.id;
};

export const initializeSupabaseDemoSeed = async () => {
  if (!featureFlags.supabaseEnabled || !supabaseAdmin) return;

  const snapshot = buildDemoSnapshot();
  const seededAccountIds = new Set(demoAccounts.map((account) => account.id));
  const demoUsers = snapshot.users.filter((viewer) => seededAccountIds.has(viewer.id));

  for (const viewer of demoUsers) {
    viewer.authUserId = await ensureDemoAuthUser(viewer);
    await persistenceService.persistUser(viewer);
  }

  for (const patient of snapshot.patients) {
    await persistenceService.persistPatient(patient);
  }

  for (const access of snapshot.patientAccess.filter((record) => seededAccountIds.has(record.userId ?? ""))) {
    await persistenceService.persistPatientAccess(access);
  }

  await Promise.all(snapshot.medications.map((record) => persistenceService.persistMedication(record)));
  await Promise.all(snapshot.medicationLogs.map((record) => persistenceService.persistMedicationLog(record)));
  await Promise.all(snapshot.careJournal.map((record) => persistenceService.persistJournalEntry(record)));
  await Promise.all(snapshot.documents.map((record) => persistenceService.persistDocument(record)));
  await Promise.all(snapshot.appointments.map((record) => persistenceService.persistAppointment(record)));
  await Promise.all(snapshot.healthVitals.map((record) => persistenceService.persistVital(record)));
  await Promise.all(snapshot.tasks.map((record) => persistenceService.persistTask(record)));
  await Promise.all(snapshot.activityEvents.map((record) => persistenceService.persistActivityEvent(record)));
  await Promise.all(snapshot.activityReactions.map((record) => persistenceService.persistActivityReaction(record)));
  await Promise.all(snapshot.settings.map((record) => persistenceService.persistSettings(record)));
  await Promise.all(snapshot.securityAuditLogs.map((record) => persistenceService.persistAuditLog(record)));

  await Promise.all(
    snapshot.emergencyProtocols.map((record) =>
      upsertDemoRow("emergency_protocols", {
        id: record.id,
        patient_id: record.patientId,
        protocol_type: record.protocolType,
        title: record.title,
        steps: record.steps,
        responder_notes: record.responderNotes,
        important_numbers: record.importantNumbers,
        last_updated: record.lastUpdated,
        pdf_url: record.pdfUrl ?? null,
        share_token: record.shareToken,
      }),
    ),
  );

  await Promise.all(
    snapshot.aiInsights.map((record) =>
      upsertDemoRow("ai_insights", {
        id: record.id,
        patient_id: record.patientId,
        insight_type: record.insightType,
        title: record.title,
        body: record.body,
        action_recommended: record.actionRecommended,
        generated_at: record.generatedAt,
        is_read: record.isRead,
        is_dismissed: record.isDismissed,
      }),
    ),
  );

  await Promise.all(
    snapshot.notifications.map((record) =>
      upsertDemoRow("notifications", {
        id: record.id,
        user_id: record.userId,
        patient_id: record.patientId,
        type: record.type,
        title: record.title,
        message: record.message,
        is_read: record.isRead,
        scheduled_for: record.scheduledFor,
        sent_at: record.sentAt ?? null,
        created_at: record.createdAt,
      }),
    ),
  );

  await Promise.all(
    [
      ...snapshot.chatSessions,
      {
        id: "family_thread",
        patientId: snapshot.patients[0].id,
        userId: snapshot.users[0].id,
        title: "Family Hub",
        createdAt: snapshot.familyMessages[0]?.createdAt ?? new Date().toISOString(),
        updatedAt: snapshot.familyMessages.at(-1)?.createdAt ?? new Date().toISOString(),
      },
    ].map((record) =>
      upsertDemoRow("chat_sessions", {
        id: record.id,
        patient_id: record.patientId,
        user_id: record.userId,
        title: record.title,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }),
    ),
  );

  await Promise.all(
    snapshot.chatMessages.map((record) =>
      upsertDemoRow("chat_messages", {
        id: record.id,
        session_id: record.sessionId,
        patient_id: record.patientId,
        user_id: record.userId ?? null,
        role: record.role,
        content: record.content,
        created_at: record.createdAt,
      }),
    ),
  );

  await Promise.all(
    snapshot.familyMessages.map((record) => persistenceService.persistFamilyMessage(record, "family_thread")),
  );
};
