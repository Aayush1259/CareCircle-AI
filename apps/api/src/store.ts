import { AsyncLocalStorage } from "node:async_hooks";
import {
  buildFamilyMemberFromAccessRecord,
  buildPatientAccessRecord,
  buildDemoSnapshot,
  normalizePatientPermissions,
  type PatientAccessRecord,
  type AppSnapshot,
  type BootstrapPayload,
  type DashboardSummary,
  type FamilyMessageRecord,
  type FeedbackRecord,
  type PendingEmailUpdateRecord,
  type SecurityAuditRecord,
} from "@carecircle/shared";

let state = buildDemoSnapshot();
let feedbackRecords: FeedbackRecord[] = [];
let pendingEmailUpdates: PendingEmailUpdateRecord[] = [];
interface RequestScopeValue {
  snapshot?: AppSnapshot;
  viewerId?: string;
  patientId?: string;
}

const requestScope = new AsyncLocalStorage<RequestScopeValue>();

const resolveScope = () => requestScope.getStore();
const resolveState = () => resolveScope()?.snapshot ?? state;
const resolveViewerId = () => resolveScope()?.viewerId ?? resolveState().activeUserId;
const resolvePatientId = () => resolveScope()?.patientId ?? resolveState().activePatientId;
const stateProxy = new Proxy({} as AppSnapshot, {
  get(_target, property) {
    return resolveState()[property as keyof AppSnapshot];
  },
  set(_target, property, value) {
    resolveState()[property as keyof AppSnapshot] = value as never;
    return true;
  },
});

const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

const todayIso = () => new Date().toISOString();

const redactFamilyMedication = (record: AppSnapshot["medications"][number]) => ({
  ...record,
  brandName: undefined,
  genericName: undefined,
  purpose: "",
  instructions: "",
  pharmacyName: "",
  pharmacyPhone: "",
});

const redactFamilyVital = (record: AppSnapshot["healthVitals"][number]) => ({
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

const buildBootstrapFamilyMembers = () => {
  const currentState = resolveState();
  const patient = getPatient();
  const familyMembers = currentState.patientAccess
    .filter((record) => record.patientId === patient.id)
    .map((record) =>
      buildFamilyMemberFromAccessRecord(record, {
        photoUrl: getViewerById(record.userId ?? "")?.photoUrl,
        lastActive: getViewerById(record.userId ?? "")?.lastLogin ?? record.lastActive,
      }),
    )
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  if (!familyMembers.some((record) => record.userId === patient.userId)) {
    const owner = getViewerById(patient.userId);
    if (owner) {
      const ownerAccess = buildPatientAccessRecord({
        id: `access_${patient.userId}_${patient.id}`,
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
      const ownerFamilyMember = buildFamilyMemberFromAccessRecord(ownerAccess, {
        photoUrl: owner.photoUrl,
        lastActive: owner.lastLogin,
        acceptedAt: patient.createdAt,
      });
      if (ownerFamilyMember) {
        familyMembers.unshift(ownerFamilyMember);
      }
    }
  }

  return familyMembers;
};

export const getState = () => stateProxy;

export const runWithRequestScope = <T>(scope: RequestScopeValue, callback: () => T) =>
  requestScope.run(scope, callback);

export const resetState = () => {
  state = buildDemoSnapshot();
  feedbackRecords = [];
  pendingEmailUpdates = [];
  return state;
};

export const replaceState = (nextState: AppSnapshot) => {
  state = nextState;
  return state;
};

export const getViewer = () => {
  const currentState = resolveState();
  const viewer = currentState.users.find((user) => user.id === resolveViewerId());
  if (!viewer) {
    throw new Error("Active viewer not found.");
  }
  return viewer;
};

export const getViewerById = (userId: string) => resolveState().users.find((user) => user.id === userId);

export const getViewerAccess = (): PatientAccessRecord | null =>
  resolveState().patientAccess.find(
    (record) =>
      record.patientId === resolvePatientId() &&
      record.userId === resolveViewerId() &&
      record.joinStatus === "active",
  ) ?? null;

export const getViewerCapabilities = () => getViewerAccess()?.capabilities ?? [];

export const setActiveUser = (userId: string) => {
  state.activeUserId = userId;
  return getViewer();
};

export const getPatient = () => {
  const patient = resolveState().patients.find((item) => item.id === resolvePatientId());
  if (!patient) {
    throw new Error("Active patient not found.");
  }
  return patient;
};

export const getDashboardSummary = (): DashboardSummary => {
  const viewer = getViewer();
  const patient = getPatient();
  const access = getViewerAccess();
  const currentState = resolveState();
  const today = todayIso().slice(0, 10);
  const isFamilyMember = access?.accessRole === "family_member";
  const canViewMedications = Boolean(access?.permissions.canViewMedications);
  const canViewJournal = Boolean(access?.permissions.canViewJournal);
  const canViewAppointments = Boolean(access?.permissions.canViewAppointments);
  const canViewTasks = Boolean(access?.permissions.canViewTasks) && access?.accessRole !== "doctor";

  const todaysLogs = canViewMedications
    ? currentState.medicationLogs.filter(
        (log) => log.patientId === patient.id && sameDay(log.scheduledTime, today),
      )
    : [];
  const taken = todaysLogs.filter((log) => log.status === "taken").length;
  const total = todaysLogs.length;
  const nextAppointment = canViewAppointments
    ? currentState.appointments
        .filter(
          (appointment) =>
            appointment.patientId === patient.id &&
            appointment.status === "upcoming" &&
            (access?.accessRole !== "doctor" || appointment.doctorName === viewer.name),
        )
        .sort((a, b) =>
          `${a.appointmentDate}T${a.appointmentTime}`.localeCompare(`${b.appointmentDate}T${b.appointmentTime}`),
        )[0]
    : undefined;
  const lastJournalEntry = canViewJournal
    ? [...currentState.careJournal]
        .filter(
          (entry) =>
            entry.patientId === patient.id &&
            (!isFamilyMember || entry.userId === viewer.id || entry.userId === patient.userId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  const tasksDueToday = canViewTasks
    ? currentState.tasks.filter(
        (task) =>
          task.patientId === patient.id &&
          task.dueDate === today &&
          task.status !== "done" &&
          (!isFamilyMember || task.assignedTo === viewer.id),
      ).length
    : 0;

  return {
    greetingName: viewer.name.split(" ")[0],
    currentDate: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date()),
    dailyBriefing:
      `${patient.preferredName ?? patient.name} has ${total} medications on the schedule today, ` +
      `${tasksDueToday} task${tasksDueToday === 1 ? "" : "s"} due, and ` +
      `${nextAppointment ? `an upcoming visit with ${nextAppointment.doctorName} on ${nextAppointment.appointmentDate}.` : "no appointments this week."} ` +
      `You are doing a thoughtful job keeping everything steady.`,
    medicationProgress: {
      taken,
      total,
      adherenceScore: total === 0 ? 100 : Math.round((taken / total) * 100),
    },
    nextAppointment,
    tasksDueToday,
    lastJournalEntry,
  };
};

export const getBootstrapPayload = (): BootstrapPayload => {
  const currentState = resolveState();
  const viewer = getViewer();
  const patient = getPatient();
  const viewerAccess = getViewerAccess();
  const capabilities = getViewerCapabilities();
  const permissions = viewerAccess?.permissions ?? null;
  const isFamilyMember = viewerAccess?.accessRole === "family_member";
  const rosterUserIds = new Set(
    [
      viewer.id,
      patient.userId,
      ...currentState.patientAccess
        .filter((record) => record.patientId === patient.id)
        .map((record) => record.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ],
  );
  const patientAccess = currentState.patientAccess.filter((record) => record.patientId === patient.id);
  const medications = permissions?.canViewMedications
    ? currentState.medications
        .filter((item) => item.patientId === patient.id)
        .map((item) => (isFamilyMember ? redactFamilyMedication(item) : item))
    : [];
  const medicationLogs = permissions?.canViewMedications
    ? currentState.medicationLogs.filter((item) => item.patientId === patient.id)
    : [];
  const careJournal = permissions?.canViewJournal
    ? currentState.careJournal
        .filter(
          (entry) =>
            entry.patientId === patient.id &&
            (!isFamilyMember || entry.userId === viewer.id || entry.userId === patient.userId),
        )
    : [];
  const documents = permissions?.canViewDocuments
    ? currentState.documents.filter((item) => item.patientId === patient.id)
    : [];
  const appointments = permissions?.canViewAppointments
    ? currentState.appointments.filter(
        (item) =>
          item.patientId === patient.id &&
          (viewerAccess?.accessRole !== "doctor" || item.doctorName === viewer.name),
      )
    : [];
  const tasks =
    viewerAccess?.accessRole === "doctor" || !permissions?.canViewTasks
      ? []
      : currentState.tasks.filter(
          (item) => item.patientId === patient.id && (!isFamilyMember || item.assignedTo === viewer.id),
        );
  const healthVitals = permissions?.canViewVitals
    ? currentState.healthVitals
        .filter((item) => item.patientId === patient.id)
        .map((item) => (permissions.canViewVitalsRaw || !isFamilyMember ? item : redactFamilyVital(item)))
    : [];
  const activityEvents =
    permissions?.canViewFamily && viewerAccess?.accessRole !== "doctor"
      ? currentState.activityEvents.filter((item) => item.patientId === patient.id)
      : [];
  const visibleEventIds = new Set(activityEvents.map((item) => item.id));
  const activityReactions =
    permissions?.canViewFamily && viewerAccess?.accessRole !== "doctor"
      ? currentState.activityReactions.filter((item) => visibleEventIds.has(item.eventId))
      : [];
  const chatSessions = currentState.chatSessions.filter(
    (item) => item.patientId === patient.id && item.userId === viewer.id,
  );
  const visibleChatSessionIds = new Set(chatSessions.map((item) => item.id));
  const chatMessages =
    capabilities.includes("view_dashboard")
      ? currentState.chatMessages.filter((item) => visibleChatSessionIds.has(item.sessionId))
      : [];

  return {
    viewer,
    patient: permissions?.canViewInsurance ? patient : { ...patient, insuranceProvider: "", insuranceId: "" },
    viewerAccess,
    patientAccess,
    capabilities,
    permissions,
    dashboard: getDashboardSummary(),
    appConfig: {
      googleAuthEnabled: false,
    },
    data: {
      users: currentState.users.filter((user) => rosterUserIds.has(user.id)),
      patients: [permissions?.canViewInsurance ? patient : { ...patient, insuranceProvider: "", insuranceId: "" }],
      patientAccess,
      medications,
      medicationLogs,
      careJournal,
      documents,
      appointments,
      familyMembers:
        permissions?.canViewFamily && viewerAccess?.accessRole !== "doctor" ? buildBootstrapFamilyMembers() : [],
      familyMessages:
        permissions?.canViewFamily && viewerAccess?.accessRole !== "doctor"
          ? getFamilyMessages().filter((item) => item.patientId === patient.id)
          : [],
      tasks,
      emergencyProtocols: permissions?.canViewEmergency
        ? currentState.emergencyProtocols.filter((item) => item.patientId === patient.id)
        : [],
      healthVitals,
      aiInsights: permissions?.canViewAiInsights
        ? currentState.aiInsights.filter((item) => item.patientId === patient.id)
        : [],
      notifications: currentState.notifications.filter((item) => item.userId === viewer.id && item.patientId === patient.id),
      chatSessions,
      chatMessages,
      activityEvents,
      activityReactions,
      settings: currentState.settings.filter((item) => item.userId === viewer.id),
      securityAuditLogs: permissions?.canViewAuditLog
        ? currentState.securityAuditLogs.filter((item) => item.patientId === patient.id).slice(0, 25)
        : currentState.securityAuditLogs.filter((item) => item.userId === viewer.id).slice(0, 25),
    },
  };
};

export const nextId = (prefix: string) => {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
};

export const getFamilyMessages = () => resolveState().familyMessages;

export const addFamilyMessage = (message: FamilyMessageRecord) => {
  resolveState().familyMessages.push(message);
  return message;
};

export const updateFamilyMessage = (messageId: string, updates: Partial<FamilyMessageRecord>) => {
  const message = resolveState().familyMessages.find((item) => item.id === messageId);
  if (!message) return null;
  Object.assign(message, updates);
  return message;
};

export const getFeedbackRecords = () => feedbackRecords;

export const addFeedbackRecord = (feedback: FeedbackRecord) => {
  feedbackRecords.unshift(feedback);
  return feedback;
};

export const addPendingEmailUpdate = (record: PendingEmailUpdateRecord) => {
  pendingEmailUpdates.unshift(record);
  return record;
};

export const addAuditLog = (record: SecurityAuditRecord) => {
  resolveState().securityAuditLogs.unshift(record);
  return record;
};

export const getPendingEmailUpdateByToken = (token: string) =>
  pendingEmailUpdates.find((record) => record.token === token);

export const addActivity = (input: {
  userId: string;
  type:
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
  actorName: string;
  description: string;
}) => {
  const currentState = resolveState();
  const event = {
    id: nextId("activity"),
    patientId: resolvePatientId(),
    userId: input.userId,
    type: input.type,
    actorName: input.actorName,
    description: input.description,
    createdAt: new Date().toISOString(),
  };
  currentState.activityEvents.unshift(event);
  return event;
};
