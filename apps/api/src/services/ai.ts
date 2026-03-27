import OpenAI from "openai";
import type {
  AppointmentRecord,
  CareJournalRecord,
  EmergencyProtocolRecord,
  HealthVitalsRecord,
  MedicationRecord,
  PatientRecord,
  TaskRecord,
} from "@carecircle/shared";
import { env, featureFlags } from "../env";

const openai = featureFlags.openAiEnabled ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

const safeText = async (system: string, input: string, fallback: string) => {
  if (!openai) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
    });
    return response.choices[0]?.message.content?.trim() || fallback;
  } catch {
    return fallback;
  }
};

const safeJson = async <T>(system: string, input: string, fallback: T) => {
  if (!openai) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
    });

    const raw = response.choices[0]?.message.content;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const aiService = {
  async dailyBriefing(patient: PatientRecord, medications: MedicationRecord[], appointments: AppointmentRecord[], journal: CareJournalRecord[], tasks: TaskRecord[]) {
    return safeText(
      "You are a warm, caring AI assistant writing a brief morning update for a family caregiver. Keep it simple, encouraging, and practical.",
      JSON.stringify({ patient, medications, appointments, journal, tasks }),
      `${patient.preferredName ?? patient.name} has ${medications.length} active medications, ${appointments.length} upcoming appointments, and ${tasks.filter((task) => task.status !== "done").length} open tasks. Keep today simple: stay on top of morning medications, note any evening confusion, and bring your recent questions to the next appointment.`,
    );
  },

  async interactionCheck(medications: MedicationRecord[]) {
    return safeJson(
      "Check for drug interactions and return JSON: { interactions: [{ title, severity, explanation, next_steps }] }",
      JSON.stringify(medications),
      {
        interactions: [
          {
            title: "Aspirin and blood pressure medicine",
            severity: "mild",
            explanation: "This combination is commonly used, but it is still smart to watch for dizziness or stomach upset.",
            next_steps: "Keep taking as prescribed and mention any new dizziness or stomach pain to the doctor.",
          },
          {
            title: "Donepezil bedtime timing",
            severity: "mild",
            explanation: "Donepezil can sometimes affect sleep or cause vivid dreams.",
            next_steps: "If nighttime restlessness continues, ask whether the timing should change.",
          },
        ],
      },
    );
  },

  async analyzeJournalEntry(entry: CareJournalRecord, patient: PatientRecord) {
    return safeJson(
      "Analyze the caregiver journal entry. Return JSON with summary, doctorFlags, actionSteps, questions.",
      JSON.stringify({ entry, patient }),
      {
        summary: "This entry suggests a manageable symptom that is worth tracking rather than panicking about.",
        doctorFlags: entry.severity === "high" ? ["Share this pattern with the doctor soon."] : ["Bring this up at the next planned visit if it happens again."],
        actionSteps: ["Write down when it happened.", "Note what helped and how long recovery took."],
        questions: ["Has this symptom become more frequent?", "Could medication timing be affecting this?"],
      },
    );
  },

  async analyzeJournalPatterns(entries: CareJournalRecord[], patient: PatientRecord) {
    return safeJson(
      "Analyze 30 days of caregiver journal entries. Return JSON with patterns, concerns, doctor_topics, positives.",
      JSON.stringify({ entries, patient }),
      {
        patterns: [
          "Evening confusion appears more often than morning confusion.",
          "Appetite is a little variable, but there are several positive meal days too.",
        ],
        concerns: ["Recent dizziness and stronger sundowning deserve a clear update at the next visit."],
        doctor_topics: ["Ask whether evening routines or medication timing could help."],
        positives: ["Morning medication routines look steady, and there are several notes about good mood and engagement."],
      },
    );
  },

  async decodeDocument(text: string) {
    return safeJson(
      "Analyze the medical document text and return JSON with summary, action_items, important_dates, medical_terms, doctor_questions, document_type, severity_flag.",
      text,
      {
        summary: "This document has been translated into plain language for the caregiver.",
        action_items: ["Review the highlighted dates and bring the document to the next appointment if it feels important."],
        important_dates: [{ date: new Date().toISOString().slice(0, 10), description: "Review date" }],
        medical_terms: [{ term: "A1C", plainEnglish: "A longer-term picture of blood sugar." }],
        doctor_questions: ["Is there anything in this document we should act on this week?"],
        document_type: "medical record",
        severity_flag: "review_needed",
      },
    );
  },

  async suggestAppointmentQuestions(patient: PatientRecord, appointment: Partial<AppointmentRecord>) {
    return safeJson(
      "Suggest questions for the doctor visit and return JSON with questions array.",
      JSON.stringify({ patient, appointment }),
      {
        questions: [
          "What changes should we watch most closely before the next visit?",
          "Are there any medications we should rethink because of dizziness or confusion?",
          "What should count as urgent enough to call the office right away?",
          "Would you change anything about hydration, meals, or bedtime routine?",
          "What should we track at home between now and the next appointment?",
        ],
      },
    );
  },

  async extractAppointmentFollowUp(notes: string) {
    return safeJson(
      "Extract medications, appointments, and next steps from the follow-up notes. Return JSON.",
      notes,
      {
        summary: "The visit resulted in a few simple next steps to keep an eye on.",
        medications: [],
        followUps: ["Track symptoms for one more week and bring the log to the next visit."],
      },
    );
  },

  async analyzeVitals(vitals: HealthVitalsRecord[], patient: PatientRecord) {
    return safeJson(
      "Analyze vitals for caregiver-friendly trends. Return JSON with overall_summary, vital_by_vital_analysis, doctor_alerts, positive_trends.",
      JSON.stringify({ vitals, patient }),
      {
        overall_summary: "Most readings are fairly steady. Blood sugar and blood pressure are worth continuing to watch, but there is no dramatic swing in the demo data.",
        vital_by_vital_analysis: [
          "Blood pressure has stayed near the target range most days.",
          "Morning blood sugar is a little above ideal but fairly consistent.",
        ],
        doctor_alerts: ["Mention the occasional dizziness along with the blood pressure log."],
        positive_trends: ["Weight and oxygen levels have stayed stable."],
      },
    );
  },

  async suggestTasks(patient: PatientRecord) {
    return safeJson(
      "Suggest caregiving tasks and return JSON: { tasks: [{ title, description, category, priority, suggestedDueDate, assignedTo }] }",
      JSON.stringify(patient),
      {
        tasks: [
          {
            title: "Prepare three questions for the GP visit",
            description: "Write down dizziness, evening confusion, and appetite notes in one place.",
            category: "medical",
            priority: "high",
            suggestedDueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            assignedTo: "primary caregiver",
          },
          {
            title: "Call the pharmacy about Metformin refill",
            description: "Confirm the refill will be ready before the weekend.",
            category: "administrative",
            priority: "medium",
            suggestedDueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
            assignedTo: "any family member",
          },
        ],
      },
    );
  },

  async generateEmergencyProtocols(patient: PatientRecord, medications: MedicationRecord[]): Promise<{ protocols: EmergencyProtocolRecord[] }> {
    const base = `${patient.preferredName ?? patient.name} is ${new Date().getFullYear() - Number(patient.dateOfBirth.slice(0, 4))} years old with ${[patient.primaryDiagnosis, ...patient.secondaryConditions].join(", ")} and takes ${medications.map((item) => item.name).join(", ")}.`;
    return {
      protocols: [
        {
          id: "generated_fall",
          patientId: patient.id,
          protocolType: "fall",
          title: "Fall Response",
          steps: ["Stay calm.", "Check for serious injury.", "Do not force standing.", "Call 911 if unsafe to move.", "Bring medication list and insurance card."],
          responderNotes: [base, `Allergies: ${patient.allergies.join(", ")}.`],
          importantNumbers: [
            { label: "Emergency", phone: "911" },
            { label: "Primary Doctor", phone: patient.primaryDoctorPhone },
          ],
          lastUpdated: new Date().toISOString(),
          shareToken: "generated_fall_token",
        },
      ],
    };
  },

  async weeklySummary(patient: PatientRecord) {
    return safeText(
      "Write a warm weekly family summary for caregivers.",
      JSON.stringify(patient),
      `This week, ${patient.preferredName ?? patient.name} had a steady medication routine, some encouraging moments with family, and a few symptoms worth bringing to the next visit. Thank you for showing up with patience and care.`,
    );
  },

  async careChatReply(context: { patient: PatientRecord; prompt: string; recentJournal: CareJournalRecord[]; medications: MedicationRecord[] }) {
    return safeText(
      "You are CareCircle, a warm and knowledgeable AI assistant for family caregivers. Keep answers supportive, simple, and non-alarming.",
      JSON.stringify(context),
      "It makes sense to feel stretched thin when the evenings are harder. A calm routine, softer lighting, and simple reassurance often help, and it would be wise to mention the pattern to the doctor if it feels stronger than usual.",
    );
  },

  async emotionalCheckInReply(feeling: string) {
    return safeText(
      "Respond to a caregiver emotional check-in with warmth, validation, and one practical suggestion.",
      feeling,
      "You are carrying a lot, and it makes sense to feel that way. Try to pick one small thing you can hand off this week, even if it is just a pharmacy call or grocery run.",
    );
  },

  async titleForJournal(body: string) {
    return safeText(
      "Write a short, plain-English title for a caregiving journal entry.",
      body,
      "Care note",
    );
  },
};

