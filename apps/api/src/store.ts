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
  const currentState = resolveState();
  const today = todayIso().slice(0, 10);
  const todaysLogs = currentState.medicationLogs.filter((log) => sameDay(log.scheduledTime, today));
  const taken = todaysLogs.filter((log) => log.status === "taken").length;
  const total = todaysLogs.length;
  const nextAppointment = currentState.appointments
    .filter((appointment) => appointment.status === "upcoming")
    .sort((a, b) =>
      `${a.appointmentDate}T${a.appointmentTime}`.localeCompare(`${b.appointmentDate}T${b.appointmentTime}`),
    )[0];
  const lastJournalEntry = [...currentState.careJournal].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const tasksDueToday = currentState.tasks.filter((task) => task.dueDate === today && task.status !== "done").length;

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

export const getBootstrapPayload = (): BootstrapPayload => ({
  viewer: getViewer(),
  patient: getPatient(),
  viewerAccess: getViewerAccess(),
  patientAccess: resolveState().patientAccess,
  capabilities: getViewerCapabilities(),
  permissions: getViewerAccess()?.permissions ?? null,
  dashboard: getDashboardSummary(),
  appConfig: {
    googleAuthEnabled: false,
  },
  data: {
    users: resolveState().users,
    patients: resolveState().patients,
    patientAccess: resolveState().patientAccess,
    medications: resolveState().medications,
    medicationLogs: resolveState().medicationLogs,
    careJournal: resolveState().careJournal,
    documents: resolveState().documents,
    appointments: resolveState().appointments,
    familyMembers: buildBootstrapFamilyMembers(),
    familyMessages: getFamilyMessages(),
    tasks: resolveState().tasks,
    emergencyProtocols: resolveState().emergencyProtocols,
    healthVitals: resolveState().healthVitals,
    aiInsights: resolveState().aiInsights,
    notifications: resolveState().notifications,
    chatSessions: resolveState().chatSessions,
    chatMessages: resolveState().chatMessages,
    activityEvents: resolveState().activityEvents,
    activityReactions: resolveState().activityReactions,
    settings: resolveState().settings,
    securityAuditLogs: resolveState().securityAuditLogs,
  },
});

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
