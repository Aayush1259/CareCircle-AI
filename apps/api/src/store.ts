import {
  buildDemoSnapshot,
  type AppSnapshot,
  type BootstrapPayload,
  type DashboardSummary,
  type FamilyMessageRecord,
  type FeedbackRecord,
  type PendingEmailUpdateRecord,
} from "@carecircle/shared";

let state = buildDemoSnapshot();
let familyMessages: FamilyMessageRecord[] = [
  {
    id: "family_message_001",
    patientId: state.activePatientId,
    userId: "user_james",
    userName: "James Martinez",
    messageText: "I can handle the pharmacy pickup on Friday.",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    isPinned: true,
  },
  {
    id: "family_message_002",
    patientId: state.activePatientId,
    userId: "user_sarah",
    userName: "Sarah Martinez",
    messageText: "Please keep an eye on evening confusion this week so I can tell the neurologist.",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    isPinned: false,
  },
];
let feedbackRecords: FeedbackRecord[] = [];
let pendingEmailUpdates: PendingEmailUpdateRecord[] = [];

const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

const todayIso = () => new Date().toISOString();

export const getState = () => state;

export const resetState = () => {
  state = buildDemoSnapshot();
  familyMessages = [
    {
      id: "family_message_001",
      patientId: state.activePatientId,
      userId: "user_james",
      userName: "James Martinez",
      messageText: "I can handle the pharmacy pickup on Friday.",
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      isPinned: true,
    },
    {
      id: "family_message_002",
      patientId: state.activePatientId,
      userId: "user_sarah",
      userName: "Sarah Martinez",
      messageText: "Please keep an eye on evening confusion this week so I can tell the neurologist.",
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      isPinned: false,
    },
  ];
  feedbackRecords = [];
  pendingEmailUpdates = [];
  return state;
};

export const replaceState = (nextState: AppSnapshot) => {
  state = nextState;
  return state;
};

export const getViewer = () => {
  const viewer = state.users.find((user) => user.id === state.activeUserId);
  if (!viewer) {
    throw new Error("Active viewer not found.");
  }
  return viewer;
};

export const getViewerById = (userId: string) => state.users.find((user) => user.id === userId);

export const setActiveUser = (userId: string) => {
  state.activeUserId = userId;
  return getViewer();
};

export const getPatient = () => {
  const patient = state.patients.find((item) => item.id === state.activePatientId);
  if (!patient) {
    throw new Error("Active patient not found.");
  }
  return patient;
};

export const getDashboardSummary = (): DashboardSummary => {
  const viewer = getViewer();
  const patient = getPatient();
  const today = todayIso().slice(0, 10);
  const todaysLogs = state.medicationLogs.filter((log) => sameDay(log.scheduledTime, today));
  const taken = todaysLogs.filter((log) => log.status === "taken").length;
  const total = todaysLogs.length;
  const nextAppointment = state.appointments
    .filter((appointment) => appointment.status === "upcoming")
    .sort((a, b) =>
      `${a.appointmentDate}T${a.appointmentTime}`.localeCompare(`${b.appointmentDate}T${b.appointmentTime}`),
    )[0];
  const lastJournalEntry = [...state.careJournal].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const tasksDueToday = state.tasks.filter((task) => task.dueDate === today && task.status !== "done").length;

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
  dashboard: getDashboardSummary(),
  data: {
    users: state.users,
    patients: state.patients,
    medications: state.medications,
    medicationLogs: state.medicationLogs,
    careJournal: state.careJournal,
    documents: state.documents,
    appointments: state.appointments,
    familyMembers: state.familyMembers,
    familyMessages: getFamilyMessages(),
    tasks: state.tasks,
    emergencyProtocols: state.emergencyProtocols,
    healthVitals: state.healthVitals,
    aiInsights: state.aiInsights,
    notifications: state.notifications,
    chatSessions: state.chatSessions,
    chatMessages: state.chatMessages,
    activityEvents: state.activityEvents,
    activityReactions: state.activityReactions,
    settings: state.settings,
  },
});

export const nextId = (prefix: string) => {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
};

export const getFamilyMessages = () => familyMessages;

export const addFamilyMessage = (message: FamilyMessageRecord) => {
  familyMessages.push(message);
  return message;
};

export const updateFamilyMessage = (messageId: string, updates: Partial<FamilyMessageRecord>) => {
  const message = familyMessages.find((item) => item.id === messageId);
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
  state.activityEvents.unshift({
    id: nextId("activity"),
    patientId: state.activePatientId,
    userId: input.userId,
    type: input.type,
    actorName: input.actorName,
    description: input.description,
    createdAt: new Date().toISOString(),
  });
};
