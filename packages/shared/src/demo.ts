import type {
  ActivityEventRecord,
  ActivityReactionRecord,
  AIInsightRecord,
  AppSettingsRecord,
  AppSnapshot,
  AppointmentRecord,
  CareJournalRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  DocumentRecord,
  EmergencyProtocolRecord,
  FamilyMemberRecord,
  FamilyMessageRecord,
  HealthVitalsRecord,
  MedicationLogRecord,
  MedicationRecord,
  NotificationRecord,
  PatientAccessRecord,
  PatientRecord,
  SecurityAuditRecord,
  TaskRecord,
  UserRecord,
} from "./types";
import { buildPatientAccessRecord } from "./access";

const now = new Date();

const isoDate = (offsetDays = 0) => {
  const value = new Date(now);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

const isoDateTime = (offsetDays = 0, hour = 9, minute = 0) => {
  const value = new Date(now);
  value.setDate(value.getDate() + offsetDays);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

const uid = (prefix: string, index: number) => `${prefix}_${String(index).padStart(3, "0")}`;

export const buildDemoSnapshot = (): AppSnapshot => {
  const viewer: UserRecord = {
    id: "user_sarah",
    authUserId: "auth_demo_sarah",
    email: "demo@carecircle.ai",
    name: "Sarah Martinez",
    role: "caregiver",
    phone: "(555) 111-2233",
    createdAt: isoDateTime(-90, 8),
    lastLogin: isoDateTime(0, 7, 45),
    notificationPreferences: {
      medicationReminders: true,
      medicationReminderTime: "08:00",
      appointment24h: true,
      appointment1h: true,
      weeklySummary: true,
      weeklySummaryDay: "Sunday",
      aiInsightAlerts: true,
      familyActivityUpdates: true,
      timezone: "America/Los_Angeles",
    },
  };

  const users: UserRecord[] = [
    viewer,
    {
      id: "user_james",
      authUserId: "auth_demo_james",
      email: "james@carecircle.ai",
      name: "James Martinez",
      role: "family_member",
      phone: "(555) 333-8899",
      createdAt: isoDateTime(-75, 11),
      lastLogin: isoDateTime(-1, 18, 12),
      notificationPreferences: viewer.notificationPreferences,
    },
    {
      id: "user_maria",
      authUserId: "auth_demo_maria",
      email: "maria@carecircle.ai",
      name: "Maria Lopez",
      role: "family_member",
      phone: "(555) 777-4455",
      createdAt: isoDateTime(-60, 13),
      lastLogin: isoDateTime(-1, 9, 5),
      notificationPreferences: viewer.notificationPreferences,
    },
    {
      id: "user_doctor",
      authUserId: "auth_demo_doctor",
      email: "doctor@carecircle.ai",
      name: "Dr. Robert Chen",
      role: "doctor",
      licenseNumber: "MED-48291",
      phone: "(555) 234-5678",
      createdAt: isoDateTime(-80, 10),
      lastLogin: isoDateTime(-2, 14, 15),
      notificationPreferences: viewer.notificationPreferences,
    },
    {
      id: "user_hannah",
      authUserId: "auth_demo_hannah",
      email: "hannah@carecircle.ai",
      name: "Dr. Hannah Scott",
      role: "doctor",
      licenseNumber: "MED-91542",
      phone: "(555) 900-2222",
      createdAt: isoDateTime(-79, 13),
      lastLogin: isoDateTime(-3, 9, 45),
      notificationPreferences: viewer.notificationPreferences,
    },
  ];

  const patient: PatientRecord = {
    id: "patient_ellie",
    userId: viewer.id,
    name: 'Eleanor "Ellie" Martinez',
    preferredName: "Ellie",
    dateOfBirth: "1948-04-18",
    primaryDiagnosis: "Type 2 Diabetes",
    secondaryConditions: ["Hypertension", "Early-stage Alzheimer's", "Arthritis"],
    primaryDoctorName: "Dr. Robert Chen",
    primaryDoctorPhone: "(555) 234-5678",
    hospitalPreference: "Riverside Medical Center",
    insuranceProvider: "UnitedHealthcare",
    insuranceId: "UHC-7823941",
    bloodType: "A+",
    allergies: ["Penicillin", "Sulfa drugs"],
    mobilityLevel: "Uses a cane for longer distances",
    createdAt: isoDateTime(-90, 8),
    updatedAt: isoDateTime(-1, 16),
  };

  const medicationSeeds: Array<{
    id: string;
    name: string;
    doseAmount: string;
    doseUnit: string;
    timesOfDay: MedicationRecord["timesOfDay"];
    purpose: string;
    instructions: string;
    pillColor: string;
    pillShape: string;
    refillInDays: number;
  }> = [
    { id: "med_metformin", name: "Metformin", doseAmount: "500", doseUnit: "mg", timesOfDay: ["morning", "evening"], purpose: "Helps keep blood sugar steadier throughout the day.", instructions: "Take with meals to reduce stomach upset.", pillColor: "white", pillShape: "round", refillInDays: 6 },
    { id: "med_lisinopril", name: "Lisinopril", doseAmount: "10", doseUnit: "mg", timesOfDay: ["morning"], purpose: "Helps control blood pressure and protect the kidneys.", instructions: "Take at the same time every morning.", pillColor: "pink", pillShape: "oval", refillInDays: 12 },
    { id: "med_donepezil", name: "Donepezil", doseAmount: "5", doseUnit: "mg", timesOfDay: ["bedtime"], purpose: "Supports memory and daily thinking tasks.", instructions: "Take in the evening. Watch for vivid dreams.", pillColor: "yellow", pillShape: "round", refillInDays: 15 },
    { id: "med_aspirin", name: "Aspirin", doseAmount: "81", doseUnit: "mg", timesOfDay: ["morning"], purpose: "Supports heart health.", instructions: "Take with breakfast and water.", pillColor: "orange", pillShape: "round", refillInDays: 20 },
    { id: "med_vitd", name: "Vitamin D3", doseAmount: "1000", doseUnit: "IU", timesOfDay: ["morning"], purpose: "Supports bone health and strength.", instructions: "Take with breakfast.", pillColor: "clear", pillShape: "softgel", refillInDays: 30 },
  ];

  const medications: MedicationRecord[] = medicationSeeds.map(({ id, name, doseAmount, doseUnit, timesOfDay, purpose, instructions, pillColor, pillShape, refillInDays }, index) => ({
    id,
    patientId: patient.id,
    name,
    genericName: name,
    doseAmount,
    doseUnit,
    frequency: timesOfDay.length === 2 ? "twice" : "once",
    timesOfDay,
    startDate: isoDate(-90 - index * 10),
    prescribingDoctor: "Dr. Robert Chen",
    purpose,
    instructions,
    pillColor,
    pillShape,
    refillDate: isoDate(refillInDays),
    pharmacyName: "Riverside Pharmacy",
    pharmacyPhone: "(555) 400-1020",
    isActive: true,
    createdAt: isoDateTime(-90 - index * 10, 8),
  }));

  const hourMap = { morning: 8, afternoon: 13, evening: 18, bedtime: 21 } as const;
  const medicationLogs: MedicationLogRecord[] = [
    ...medications.flatMap((medication, medIndex) =>
      medication.timesOfDay.map((timeOfDay, timeIndex) => {
        const taken = !(medication.id === "med_donepezil" && timeOfDay === "bedtime");
        return {
          id: uid("log", medIndex * 3 + timeIndex + 1),
          medicationId: medication.id,
          patientId: patient.id,
          scheduledTime: isoDateTime(0, hourMap[timeOfDay], 0),
          takenAt: taken ? isoDateTime(0, hourMap[timeOfDay], 10) : null,
          status: taken ? ("taken" as const) : ("missed" as const),
          notes: taken ? "Taken with no issues." : "Dose missed after an early bedtime.",
          loggedBy: taken ? "Sarah Martinez" : "James Martinez",
          createdAt: isoDateTime(0, hourMap[timeOfDay], 5),
        };
      }),
    ),
    ...Array.from({ length: 8 }).map((_, index) => ({
      id: uid("history_log", index + 1),
      medicationId: medications[index % medications.length].id,
      patientId: patient.id,
      scheduledTime: isoDateTime(-(index + 1), index % 2 === 0 ? 8 : 18, 0),
      takenAt: isoDateTime(-(index + 1), index % 2 === 0 ? 8 : 18, 8),
      status: "taken" as const,
      notes: "Logged on time.",
      loggedBy: index % 2 === 0 ? "Sarah Martinez" : "Maria Lopez",
      createdAt: isoDateTime(-(index + 1), index % 2 === 0 ? 8 : 18, 5),
    })),
  ];

  const journalSeeds = [
    [-13, "08:30", "Morning confusion improved after breakfast", "Ellie woke up unsure of the day, but after breakfast she felt calmer and more oriented.", 3, 2, ["confusion", "mood"], "low", false, ""],
    [-12, "19:10", "Skipped part of dinner", "Ate half her dinner and later accepted yogurt. Appetite seemed lower than usual.", 3, 1, ["appetite"], "medium", true, "Watch appetite for 3 more days."],
    [-11, "14:00", "Good energy during walk", "Short walk outside went well. No dizziness and mood was brighter.", 4, 3, ["energy", "mood"], "low", false, ""],
    [-10, "22:15", "Restless evening", "Asked repeated questions about going home even though she was at home.", 2, 2, ["confusion", "behavior", "sleep"], "medium", true, "Mention sundowning at neurology visit."],
    [-9, "07:45", "Slept through the night", "Best sleep this week. Cheerful at breakfast.", 4, 1, ["sleep", "mood"], "low", false, ""],
    [-8, "16:20", "Mild knee pain after stairs", "Left knee pain increased after climbing stairs and improved with rest.", 3, 4, ["pain", "mobility"], "medium", false, ""],
    [-7, "12:40", "Good lunch appetite", "Finished a full lunch and drank extra water without prompting.", 4, 1, ["appetite", "energy"], "low", false, ""],
    [-6, "20:05", "Bathroom urgency before bed", "Needed the bathroom twice within an hour before bed. No pain reported.", 3, 0, ["bathroom", "sleep"], "medium", true, "Track frequency for doctor if it continues."],
    [-5, "09:10", "Laughing with family photos", "Spent 20 minutes with the photo album and recognized Sarah and James immediately.", 5, 1, ["mood", "behavior"], "low", false, ""],
    [-4, "18:50", "Mild dizziness after standing quickly", "Stood up from the couch, felt dizzy, then recovered within a minute after sitting.", 3, 1, ["fall", "energy"], "medium", true, "Bring up dizziness at GP appointment."],
    [-3, "15:30", "Calm afternoon nap", "Had a restful nap and woke with less joint stiffness.", 4, 2, ["sleep", "pain"], "low", false, ""],
    [-2, "11:15", "Needed extra cueing for shower", "Needed more step-by-step prompting than usual but stayed calm.", 3, 2, ["behavior", "confusion"], "medium", false, ""],
    [-1, "21:00", "Evening confusion stronger than last week", "Asked three times if she needed to leave for work. Music helped after 15 minutes.", 2, 1, ["confusion", "behavior", "mood"], "high", true, "Discuss progression with neurologist."],
    [0, "06:55", "Slept lightly but morning was smooth", "She woke twice overnight, but breakfast and medication routine went smoothly.", 3, 2, ["sleep", "mood"], "low", false, ""],
  ] as const;

  const careJournal: CareJournalRecord[] = journalSeeds.map(
    ([offsetDays, time, entryTitle, entryBody, mood, painLevel, tags, severity, followUpNeeded, followUpNote], index) => ({
      id: uid("journal", index + 1),
      patientId: patient.id,
      userId: index % 3 === 0 ? viewer.id : index % 2 === 0 ? "user_maria" : "user_james",
      date: isoDate(offsetDays),
      time,
      entryTitle,
      entryBody,
      mood,
      painLevel,
      tags: [...tags],
      severity,
      followUpNeeded,
      followUpNote: followUpNote || undefined,
      createdAt: isoDateTime(offsetDays, Number(time.slice(0, 2)), Number(time.slice(3, 5))),
      isNew: offsetDays >= -2,
    }),
  );

  const documents: DocumentRecord[] = [
    {
      id: uid("document", 1),
      patientId: patient.id,
      userId: viewer.id,
      fileName: "lab-results-march.pdf",
      fileUrl: "/demo/lab-results-march.pdf",
      fileType: "PDF",
      documentCategory: "lab_result",
      uploadDate: isoDate(-18),
      documentDate: isoDate(-20),
      aiSummary: {
        summary: "Recent labs show blood sugar control is a little above goal, kidney function looks stable, and vitamin D remains mildly low.",
        actionItems: ["Ask whether any diabetes medication changes are needed.", "Keep tracking morning blood sugar readings."],
        importantDates: [{ date: isoDate(5), description: "Discuss labs at GP visit" }],
        medicalTerms: [
          { term: "A1C", plainEnglish: "A 3-month average of blood sugar." },
          { term: "eGFR", plainEnglish: "A measure of how well the kidneys are filtering." },
        ],
        doctorQuestions: ["Is her A1C close enough to goal for her age?", "Should we change how often we check blood sugar?"],
        documentType: "Lab results",
        severityFlag: "review_needed",
      },
      aiActionItems: ["Discuss A1C trend at next appointment.", "Continue morning glucose log."],
      isProcessed: true,
      extractedText: "A1C 7.4, eGFR stable, Vitamin D mildly low",
    },
    {
      id: uid("document", 2),
      patientId: patient.id,
      userId: viewer.id,
      fileName: "insurance-eob-february.pdf",
      fileUrl: "/demo/insurance-eob-february.pdf",
      fileType: "PDF",
      documentCategory: "insurance",
      uploadDate: isoDate(-12),
      documentDate: isoDate(-13),
      aiSummary: {
        summary: "This insurance statement explains what was billed for Ellie's last emergency room visit and what the plan paid. There may be a remaining balance to confirm.",
        actionItems: ["Call insurance if the ER observation fee looks unfamiliar.", "Check whether the patient balance was already paid."],
        importantDates: [{ date: isoDate(10), description: "Payment due date on statement" }],
        medicalTerms: [{ term: "EOB", plainEnglish: "A summary of what insurance paid and what may still be owed." }],
        doctorQuestions: [],
        documentType: "Explanation of benefits",
        severityFlag: "normal",
      },
      aiActionItems: ["Check billing balance before due date."],
      isProcessed: true,
      extractedText: "Explanation of Benefits, emergency department, patient responsibility",
    },
    {
      id: uid("document", 3),
      patientId: patient.id,
      userId: viewer.id,
      fileName: "er-discharge-summary.pdf",
      fileUrl: "/demo/er-discharge-summary.pdf",
      fileType: "PDF",
      documentCategory: "discharge_summary",
      uploadDate: isoDate(-40),
      documentDate: isoDate(-42),
      aiSummary: {
        summary: "Ellie was seen after a dizzy spell. The team did not find a stroke or heart attack and recommended hydration, slow position changes, and PCP follow-up.",
        actionItems: ["Keep monitoring dizziness when she stands up.", "Bring discharge paperwork to the next GP visit."],
        importantDates: [{ date: isoDate(5), description: "Bring summary to GP appointment" }],
        medicalTerms: [
          { term: "Orthostatic", plainEnglish: "Related to changes when standing up." },
          { term: "Disposition", plainEnglish: "The plan for what happens after the visit." },
        ],
        doctorQuestions: ["Could any medications be contributing to dizziness?", "Should we change anything in her morning routine?"],
        documentType: "ER discharge summary",
        severityFlag: "review_needed",
      },
      aiActionItems: ["Review dizziness plan with doctor."],
      isProcessed: true,
      extractedText: "Discharge summary after dizziness episode",
    },
  ];

  const appointments: AppointmentRecord[] = [
    {
      id: uid("appointment", 1),
      patientId: patient.id,
      userId: viewer.id,
      doctorName: "Dr. Robert Chen",
      specialty: "Geriatrician",
      clinicName: "Riverside Medical Center",
      appointmentDate: isoDate(5),
      appointmentTime: "10:30",
      durationMinutes: 40,
      address: "1200 Riverside Drive, Riverside, CA",
      phone: "(555) 234-5678",
      purpose: "Routine follow-up for blood pressure, diabetes, and appetite changes",
      questionsToAsk: [
        "Should we be worried about the recent dizziness?",
        "Is her evening confusion getting worse than expected?",
        "Do we need to adjust anything for appetite changes?",
      ],
      status: "upcoming",
      reminderSent: false,
      createdAt: isoDateTime(-14, 15),
    },
    {
      id: uid("appointment", 2),
      patientId: patient.id,
      userId: viewer.id,
      doctorName: "Dr. Hannah Scott",
      specialty: "Neurologist",
      clinicName: "Neurology Partners",
      appointmentDate: isoDate(21),
      appointmentTime: "14:00",
      durationMinutes: 50,
      address: "98 Willow Street, Riverside, CA",
      phone: "(555) 900-2222",
      purpose: "Memory follow-up and evening confusion review",
      questionsToAsk: ["Are there new strategies for sundowning?", "Should we adjust Donepezil timing?"],
      status: "upcoming",
      reminderSent: false,
      createdAt: isoDateTime(-7, 10),
    },
  ];

  const familyMemberSeeds: Array<{
    id: string;
    userId?: string;
    name: string;
    email: string;
    phone: string;
    relationship: string;
    role: FamilyMemberRecord["role"];
    permissions: FamilyMemberRecord["permissions"];
    lastActive: string;
  }> = [
    { id: "family_001", userId: viewer.id, name: "Sarah", email: "demo@carecircle.ai", phone: "(555) 111-2233", relationship: "Daughter", role: "primary_caregiver", permissions: "full_access", lastActive: isoDateTime(0, 7, 45) },
    { id: "family_002", userId: "user_james", name: "James", email: "james@carecircle.ai", phone: "(555) 333-8899", relationship: "Son", role: "secondary_caregiver", permissions: "can_log", lastActive: isoDateTime(-1, 18, 12) },
    { id: "family_003", userId: "user_maria", name: "Maria", email: "maria@carecircle.ai", phone: "(555) 777-4455", relationship: "Home health aide", role: "family", permissions: "can_log", lastActive: isoDateTime(-1, 9, 5) },
    { id: "family_004", name: "Alyssa", email: "alyssa@carecircle.ai", phone: "(555) 222-3344", relationship: "Granddaughter", role: "family", permissions: "view_only", lastActive: isoDateTime(-1, 14, 30) },
  ];

  const familyMembers: FamilyMemberRecord[] = familyMemberSeeds.map(({ id, userId, name, email, phone, relationship, role, permissions, lastActive }, index) => ({
    id,
    patientId: patient.id,
    invitedBy: viewer.id,
    userId,
    name,
    email,
    phone,
    relationship,
    role,
    permissions,
    joinStatus: "active" as const,
    inviteToken: `invite_${index + 1}`,
    createdAt: isoDateTime(-90 + index * 15, 12),
    lastActive,
  }));

  const patientAccess: PatientAccessRecord[] = [
    buildPatientAccessRecord({
      id: "access_001",
      patientId: patient.id,
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      accessRole: "primary_caregiver",
      accessLevel: "full_access",
      invitedBy: viewer.id,
      joinStatus: "active",
      inviteToken: "invite_001",
      createdAt: isoDateTime(-90, 8),
      acceptedAt: isoDateTime(-90, 8, 15),
      lastActive: isoDateTime(0, 7, 45),
    }),
    buildPatientAccessRecord({
      id: "access_002",
      patientId: patient.id,
      userId: "user_james",
      email: "james@carecircle.ai",
      name: "James Martinez",
      accessRole: "secondary_caregiver",
      accessLevel: "can_log",
      invitedBy: viewer.id,
      joinStatus: "active",
      inviteToken: "invite_002",
      createdAt: isoDateTime(-75, 11),
      acceptedAt: isoDateTime(-74, 8, 30),
      lastActive: isoDateTime(-1, 18, 12),
    }),
    buildPatientAccessRecord({
      id: "access_003",
      patientId: patient.id,
      userId: "user_maria",
      email: "maria@carecircle.ai",
      name: "Maria Lopez",
      accessRole: "family",
      accessLevel: "can_log",
      invitedBy: viewer.id,
      joinStatus: "active",
      inviteToken: "invite_003",
      createdAt: isoDateTime(-60, 13),
      acceptedAt: isoDateTime(-59, 9, 10),
      lastActive: isoDateTime(-1, 9, 5),
    }),
    buildPatientAccessRecord({
      id: "access_004",
      patientId: patient.id,
      userId: "user_doctor",
      email: "doctor@carecircle.ai",
      name: "Dr. Robert Chen",
      accessRole: "doctor",
      accessLevel: "clinical_access",
      invitedBy: viewer.id,
      joinStatus: "active",
      inviteToken: "invite_004",
      createdAt: isoDateTime(-80, 10),
      acceptedAt: isoDateTime(-79, 15, 0),
      lastActive: isoDateTime(-2, 14, 15),
    }),
    buildPatientAccessRecord({
      id: "access_005",
      patientId: patient.id,
      userId: "user_hannah",
      email: "hannah@carecircle.ai",
      name: "Dr. Hannah Scott",
      accessRole: "doctor",
      accessLevel: "clinical_access",
      invitedBy: viewer.id,
      joinStatus: "active",
      inviteToken: "invite_005",
      createdAt: isoDateTime(-78, 13),
      acceptedAt: isoDateTime(-76, 8, 45),
      lastActive: isoDateTime(-3, 9, 45),
    }),
    buildPatientAccessRecord({
      id: "access_006",
      patientId: patient.id,
      email: "alyssa@carecircle.ai",
      name: "Alyssa",
      accessRole: "family",
      accessLevel: "view_only",
      invitedBy: viewer.id,
      joinStatus: "pending",
      inviteToken: "invite_006",
      createdAt: isoDateTime(-1, 14, 30),
      updatedAt: isoDateTime(-1, 14, 35),
    }),
  ];

  const taskSeeds: Array<{
    createdBy: string;
    assignedTo: string;
    title: string;
    description: string;
    category: TaskRecord["category"];
    priority: TaskRecord["priority"];
    dueOffset: number;
    dueTime: string;
    recurrence: TaskRecord["recurrence"];
    status: TaskRecord["status"];
    aiSuggested: boolean;
  }> = [
    { createdBy: viewer.id, assignedTo: viewer.id, title: "Bring dizziness notes to GP visit", description: "Summarize when dizziness happened and what helped.", category: "medical", priority: "high", dueOffset: 4, dueTime: "18:00", recurrence: "none", status: "todo", aiSuggested: true },
    { createdBy: viewer.id, assignedTo: "user_james", title: "Pick up Metformin refill", description: "Call the pharmacy first to confirm it is ready.", category: "errands", priority: "urgent", dueOffset: 5, dueTime: "12:00", recurrence: "none", status: "in_progress", aiSuggested: false },
    { createdBy: viewer.id, assignedTo: "user_maria", title: "Restock low-sugar snacks", description: "Buy yogurt, applesauce, and crackers for the week.", category: "household", priority: "medium", dueOffset: 1, dueTime: "17:00", recurrence: "weekly", status: "todo", aiSuggested: true },
    { createdBy: viewer.id, assignedTo: viewer.id, title: "Schedule podiatry follow-up", description: "Check whether the diabetic foot exam is due this spring.", category: "administrative", priority: "medium", dueOffset: -1, dueTime: "15:00", recurrence: "none", status: "overdue", aiSuggested: false },
  ];

  const tasks: TaskRecord[] = taskSeeds.map(({ createdBy, assignedTo, title, description, category, priority, dueOffset, dueTime, recurrence, status, aiSuggested }, index) => ({
    id: uid("task", index + 1),
    patientId: patient.id,
    createdBy,
    assignedTo,
    title,
    description,
    category,
    priority,
    dueDate: isoDate(dueOffset),
    dueTime,
    recurrence,
    status,
    aiSuggested,
    createdAt: isoDateTime(-index - 1, 10),
  }));

  const emergencySeeds: Array<{
    protocolType: EmergencyProtocolRecord["protocolType"];
    title: string;
    steps: string[];
    responderNotes: string[];
    importantNumbers: Array<{ label: string; phone: string }>;
  }> = [
    {
      protocolType: "fall",
      title: "Fall Response",
      steps: ["Stay calm and ask what hurts.", "Do not rush to lift her right away.", "Check for bleeding or head injury.", "Call 911 if moving feels unsafe.", "If safe, help her roll to her side first."],
      responderNotes: ["Age 78 with diabetes, hypertension, early Alzheimer's, arthritis.", "Recent dizziness episode six weeks ago."],
      importantNumbers: [{ label: "Emergency", phone: "911" }, { label: "Primary Doctor", phone: "(555) 234-5678" }, { label: "Sarah", phone: "(555) 111-2233" }, { label: "James", phone: "(555) 333-8899" }],
    },
    {
      protocolType: "diabetic_emergency",
      title: "Low or High Blood Sugar",
      steps: ["Check blood sugar right away if possible.", "If low and awake, give 15 grams of fast sugar.", "Recheck in 15 minutes.", "If not improving or hard to wake, call 911.", "Bring medication list and recent readings."],
      responderNotes: ["Current diabetes medication: Metformin 500 mg twice daily.", "Allergies: Penicillin, Sulfa drugs."],
      importantNumbers: [{ label: "Emergency", phone: "911" }, { label: "Primary Doctor", phone: "(555) 234-5678" }],
    },
    {
      protocolType: "confusion",
      title: "Confusion or Disorientation Episode",
      steps: ["Use a calm voice and short sentences.", "Reduce noise and move to a familiar space.", "Offer water and check bathroom needs.", "Look for fever, pain, or new symptoms.", "Call the doctor if this is much worse than usual."],
      responderNotes: ["Evening confusion has increased this week.", "Music and reassurance usually help."],
      importantNumbers: [{ label: "Primary Doctor", phone: "(555) 234-5678" }, { label: "Neurology Partners", phone: "(555) 900-2222" }],
    },
  ];

  const emergencyProtocols: EmergencyProtocolRecord[] = emergencySeeds.map(({ protocolType, title, steps, responderNotes, importantNumbers }, index) => ({
    id: uid("protocol", index + 1),
    patientId: patient.id,
    protocolType,
    title,
    steps,
    responderNotes,
    importantNumbers,
    lastUpdated: isoDateTime(-index - 1, 9),
    shareToken: `share_${protocolType}_ellie`,
  }));

  const healthVitals: HealthVitalsRecord[] = Array.from({ length: 14 }).map((_, index) => ({
    id: uid("vital", index + 1),
    patientId: patient.id,
    loggedBy: index % 2 === 0 ? viewer.id : "user_maria",
    date: isoDate(-13 + index),
    time: "08:15",
    bloodPressureSystolic: 126 + (index % 4) * 2,
    bloodPressureDiastolic: 74 + (index % 3) * 2,
    heartRate: 70 + (index % 5),
    bloodGlucose: 118 + (index % 5) * 6,
    weight: 149 - (index % 3) * 0.2,
    temperature: 98.2 + (index % 2) * 0.1,
    oxygenSaturation: 97 + (index % 2),
    painLevel: 2 + (index % 3),
    notes: index === 9 ? "Mild dizziness earlier in the day." : "Routine morning reading.",
    createdAt: isoDateTime(-13 + index, 8, 15),
  }));

  const insightSeeds: Array<{
    insightType: AIInsightRecord["insightType"];
    title: string;
    body: string;
    actionRecommended: string;
    offsetDays: number;
    isRead: boolean;
  }> = [
    { insightType: "pattern", title: "Evening confusion is appearing more often", body: "Entries this week suggest bedtime confusion is stronger than it was 2 weeks ago.", actionRecommended: "Bring two recent examples to the neurology visit.", offsetDays: 0, isRead: false },
    { insightType: "positive_trend", title: "Morning blood sugar has stayed steady", body: "The last 7 readings have stayed in a similar range without major spikes.", actionRecommended: "Keep the breakfast routine consistent.", offsetDays: -1, isRead: true },
    { insightType: "suggestion", title: "Refill reminder is approaching", body: "Metformin refill is due in less than a week.", actionRecommended: "Call Riverside Pharmacy by Friday.", offsetDays: 0, isRead: false },
  ];

  const aiInsights: AIInsightRecord[] = insightSeeds.map(({ insightType, title, body, actionRecommended, offsetDays, isRead }, index) => ({
    id: uid("insight", index + 1),
    patientId: patient.id,
    insightType,
    title,
    body,
    actionRecommended,
    generatedAt: isoDateTime(offsetDays, 7, index * 8),
    isRead,
    isDismissed: false,
  }));

  const notificationSeeds: Array<{
    type: NotificationRecord["type"];
    title: string;
    message: string;
    isRead: boolean;
    offsetDays: number;
    hour: number;
    minute: number;
  }> = [
    { type: "medication_reminder", title: "Bedtime medication missed", message: "Donepezil was not logged last night.", isRead: false, offsetDays: 0, hour: 8, minute: 0 },
    { type: "appointment", title: "GP visit coming up", message: "Dr. Robert Chen is scheduled in 5 days at 10:30 AM.", isRead: false, offsetDays: 0, hour: 8, minute: 5 },
    { type: "task_due", title: "1 overdue task needs attention", message: "Schedule the podiatry follow-up when you have a quiet moment.", isRead: true, offsetDays: -1, hour: 17, minute: 0 },
  ];

  const notifications: NotificationRecord[] = notificationSeeds.map(({ type, title, message, isRead, offsetDays, hour, minute }, index) => ({
    id: uid("notification", index + 1),
    userId: viewer.id,
    patientId: patient.id,
    type,
    title,
    message,
    isRead,
    scheduledFor: isoDateTime(offsetDays, hour, minute),
    createdAt: isoDateTime(offsetDays, hour, minute),
  }));

  const chatSessions: ChatSessionRecord[] = [
    {
      id: uid("chat_session", 1),
      patientId: patient.id,
      userId: viewer.id,
      title: "Helping with evening confusion",
      createdAt: isoDateTime(-2, 21, 10),
      updatedAt: isoDateTime(-2, 21, 20),
    },
    {
      id: uid("chat_session", 2),
      patientId: patient.id,
      userId: viewer.id,
      title: "Questions for Dr. Chen",
      createdAt: isoDateTime(-1, 8, 15),
      updatedAt: isoDateTime(-1, 8, 25),
    },
  ];

  const chatMessageSeeds: Array<{
    sessionId: string;
    userId?: string;
    role: ChatMessageRecord["role"];
    content: string;
    offsetDays: number;
    hour: number;
    minute: number;
  }> = [
    { sessionId: uid("chat_session", 1), userId: viewer.id, role: "user", content: "Dad seems more confused at night. Is that common?", offsetDays: -2, hour: 21, minute: 11 },
    { sessionId: uid("chat_session", 1), role: "assistant", content: "Yes, that can happen and many families call it sundowning. It often helps to keep evenings calm, bright, and predictable, and it is worth mentioning to the neurologist.", offsetDays: -2, hour: 21, minute: 12 },
    { sessionId: uid("chat_session", 2), userId: viewer.id, role: "user", content: "What should I ask at next week's appointment?", offsetDays: -1, hour: 8, minute: 20 },
    { sessionId: uid("chat_session", 2), role: "assistant", content: "Bring up the recent dizziness, stronger evening confusion, and appetite changes. You may also want to ask whether any medication timing changes could help.", offsetDays: -1, hour: 8, minute: 22 },
  ];

  const chatMessages: ChatMessageRecord[] = chatMessageSeeds.map(({ sessionId, userId, role, content, offsetDays, hour, minute }, index) => ({
    id: uid("chat_message", index + 1),
    sessionId,
    patientId: patient.id,
    userId,
    role,
    content,
    createdAt: isoDateTime(offsetDays, hour, minute),
  }));

  const familyMessages: FamilyMessageRecord[] = [
    {
      id: uid("family_message", 1),
      patientId: patient.id,
      userId: "user_james",
      userName: "James Martinez",
      messageText: "I can handle the pharmacy pickup on Friday.",
      createdAt: isoDateTime(-2, 10, 15),
      isPinned: true,
    },
    {
      id: uid("family_message", 2),
      patientId: patient.id,
      userId: viewer.id,
      userName: viewer.name,
      messageText: "Please keep an eye on evening confusion this week so I can tell the neurologist.",
      createdAt: isoDateTime(-1, 19, 40),
      isPinned: false,
    },
  ];

  const activitySeeds: Array<{
    userId: string;
    type: ActivityEventRecord["type"];
    actorName: string;
    description: string;
    offsetDays: number;
    hour: number;
    minute: number;
  }> = [
    { userId: viewer.id, type: "document_uploaded", actorName: "You", description: "uploaded a new document", offsetDays: -2, hour: 14, minute: 0 },
    { userId: "user_james", type: "medication_logged", actorName: "James", description: "marked Mom's 8 PM medication as taken", offsetDays: -1, hour: 20, minute: 10 },
    { userId: viewer.id, type: "journal_added", actorName: "Sarah", description: "added a care journal entry", offsetDays: -1, hour: 21, minute: 0 },
    { userId: "user_maria", type: "task_completed", actorName: "Maria", description: "completed a grocery task", offsetDays: -3, hour: 16, minute: 5 },
  ];

  const activityEvents: ActivityEventRecord[] = activitySeeds.map(({ userId, type, actorName, description, offsetDays, hour, minute }, index) => ({
    id: uid("activity", index + 1),
    patientId: patient.id,
    userId,
    type,
    actorName,
    description,
    createdAt: isoDateTime(offsetDays, hour, minute),
  }));

  const activityReactions: ActivityReactionRecord[] = [
    { id: uid("reaction", 1), eventId: uid("activity", 2), userId: viewer.id, emoji: "heart", createdAt: isoDateTime(-1, 20, 25) },
    { id: uid("reaction", 2), eventId: uid("activity", 3), userId: "user_james", emoji: "thanks", createdAt: isoDateTime(-1, 21, 10) },
  ];

  const securityAuditLogs: SecurityAuditRecord[] = [
    {
      id: uid("audit", 1),
      patientId: patient.id,
      userId: viewer.id,
      userName: viewer.name,
      action: "auth_login",
      resourceType: "session",
      outcome: "allowed",
      detail: "Signed in to CareCircle and loaded the patient workspace.",
      createdAt: isoDateTime(0, 7, 45),
    },
    {
      id: uid("audit", 2),
      patientId: patient.id,
      userId: viewer.id,
      userName: viewer.name,
      action: "invite_sent",
      resourceType: "patient_access",
      resourceId: "family_004",
      outcome: "allowed",
      detail: "Sent a family invite to Alyssa.",
      createdAt: isoDateTime(-1, 14, 35),
    },
    {
      id: uid("audit", 3),
      patientId: patient.id,
      userId: "user_james",
      userName: "James Martinez",
      action: "export_csv",
      resourceType: "patient_export",
      outcome: "blocked",
      detail: "Exporting the patient dataset is reserved for the primary caregiver.",
      createdAt: isoDateTime(-1, 18, 20),
      metadata: { requiredCapability: "export_data" },
    },
    {
      id: uid("audit", 4),
      patientId: patient.id,
      userId: "user_doctor",
      userName: "Dr. Robert Chen",
      action: "document_uploaded",
      resourceType: "documents",
      outcome: "allowed",
      detail: "Reviewed the most recent lab summary for the appointment.",
      createdAt: isoDateTime(-2, 14, 20),
    },
    {
      id: uid("audit", 5),
      patientId: patient.id,
      userId: viewer.id,
      userName: viewer.name,
      action: "patient_updated",
      resourceType: "patient_profile",
      outcome: "allowed",
      detail: "Updated the patient profile and emergency contact details.",
      createdAt: isoDateTime(-1, 16, 0),
    },
  ];

  const settings: AppSettingsRecord[] = [
    {
      userId: viewer.id,
      display: {
        fontSize: "normal",
        colorTheme: "teal",
        dashboardLayout: "detailed",
        highContrast: false,
      },
      updatedAt: isoDateTime(-1, 16),
      helpLinks: [
        { title: "How to use the dashboard", url: "https://www.loom.com/share/carecircle-dashboard" },
        { title: "Uploading a document", url: "https://www.loom.com/share/carecircle-documents" },
        { title: "Inviting family members", url: "https://www.loom.com/share/carecircle-family" },
      ],
    },
  ];

  return {
    users,
    patients: [patient],
    medications,
    medicationLogs,
    careJournal,
    documents,
    appointments,
    familyMembers,
    familyMessages,
    tasks,
    emergencyProtocols,
    healthVitals,
    aiInsights,
    notifications,
    chatSessions,
    chatMessages,
    activityEvents,
    activityReactions,
    settings,
    patientAccess,
    securityAuditLogs,
    activeUserId: viewer.id,
    activePatientId: patient.id,
  };
};
