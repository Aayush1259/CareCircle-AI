import cors, { type CorsOptions } from "cors";
import express from "express";
import multer from "multer";
import type {
  AppointmentRecord,
  CareJournalRecord,
  DocumentRecord,
  FamilyMessageRecord,
  FamilyMemberRecord,
  FeedbackSubject,
  HealthVitalsRecord,
  MedicationLogRecord,
  MedicationRecord,
  TaskRecord,
} from "@carecircle/shared";
import { env, featureFlags } from "./env";
import {
  addActivity,
  addFamilyMessage,
  addFeedbackRecord,
  addPendingEmailUpdate,
  getBootstrapPayload,
  getDashboardSummary,
  getFamilyMessages,
  getPendingEmailUpdateByToken,
  getPatient,
  getState,
  getViewer,
  nextId,
  updateFamilyMessage,
} from "./store";
import { aiService } from "./services/ai";
import { authService } from "./services/auth";
import { documentService } from "./services/documents";
import { emailService } from "./services/email";
import { exportService } from "./services/export";
import { registerCronJobs } from "./services/cron";
import { supabaseAdmin } from "./services/supabase";

const asyncHandler =
  <T extends express.RequestHandler>(handler: T): express.RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

let cronRegistered = false;
const publicApiPaths = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/session",
]);

const trimmedText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

const hasText = (value: unknown) => trimmedText(value).length > 0;

const optionalText = (value: unknown) => trimmedText(value);

const optionalStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

const optionalNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const nextValue = trimmedText(value);
  if (!nextValue) return undefined;

  const parsed = Number(nextValue);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const sendValidationError = (response: express.Response, message: string) => {
  response.status(400).json({ message });
};

const createDocumentUrl = async (file?: Express.Multer.File) => {
  if (!file) return "/demo/uploaded-document";
  if (!supabaseAdmin) return `/uploads/${Date.now()}-${file.originalname}`;

  const filePath = `documents/${getViewer().id}/${Date.now()}-${file.originalname}`;
  await supabaseAdmin.storage.from(env.storageBucket).upload(filePath, file.buffer, {
    upsert: true,
    contentType: file.mimetype,
  });
  const { data } = supabaseAdmin.storage.from(env.storageBucket).getPublicUrl(filePath);
  return data.publicUrl;
};

const getBearerToken = (request: express.Request) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
};

const normalizeOrigin = (origin?: string) => {
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, "");
  }
};

const isLoopbackOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin?: string) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  if (env.frontendOrigins.includes(normalizedOrigin)) return true;
  return isLoopbackOrigin(normalizedOrigin) && env.frontendOrigins.some((item) => isLoopbackOrigin(item));
};

export const createServer = () => {
  const app = express();
  const state = getState();

  if (!cronRegistered) {
    registerCronJobs();
    cronRegistered = true;
  }

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      console.warn(`Blocked CORS origin: ${origin ?? "unknown"}`);
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "carecircle-api",
      timestamp: new Date().toISOString(),
      features: featureFlags,
    });
  });

  app.post(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const email = trimmedText(request.body?.email);
      const password = trimmedText(request.body?.password);

      if (!hasText(email) || !hasText(password)) {
        sendValidationError(response, "Please enter your email and password.");
        return;
      }

      const session = await authService.login(email, password);
      response.status(201).json({ session });
    }),
  );

  app.get("/api/auth/session", (request, response) => {
    const session = authService.getSessionFromToken(getBearerToken(request));
    if (!session) {
      response.status(401).json({ message: "Please sign in to continue." });
      return;
    }

    response.json({ session });
  });

  app.post("/api/auth/logout", (_request, response) => {
    response.status(204).end();
  });

  app.use((request, response, next) => {
    if (!request.path.startsWith("/api") || publicApiPaths.has(request.path) || request.path.startsWith("/api/public/")) {
      next();
      return;
    }

    const session = authService.getSessionFromToken(getBearerToken(request));
    if (!session) {
      response.status(401).json({ message: "Please sign in to continue." });
      return;
    }

    response.locals.session = session;
    next();
  });

  app.get("/api/bootstrap", (_request, response) => {
    response.json(getBootstrapPayload());
  });

  app.get("/api/meta", (_request, response) => {
    response.json({
      featureFlags,
      viewer: getViewer(),
      patient: getPatient(),
    });
  });

  app.post(
    "/api/uploads/image",
    upload.single("file"),
    asyncHandler(async (request, response) => {
      if (!request.file) {
        sendValidationError(response, "Please choose an image before uploading.");
        return;
      }

      const fileUrl = await createDocumentUrl(request.file);
      response.status(201).json({ fileUrl });
    }),
  );

  app.post(
    "/api/onboarding",
    asyncHandler(async (request, response) => {
      const { account, patient, medication, familyInvite } = request.body as {
        account?: { name: string; email: string; role: "caregiver" | "family_member" };
        patient?: { name: string; dateOfBirth: string; conditions: string[]; doctorName: string; doctorPhone: string };
        medication?: Partial<MedicationRecord>;
        familyInvite?: { name?: string; email: string; relationship?: string };
      };

      if (account?.name && account.email) {
        const viewer = getViewer();
        viewer.name = account.name;
        viewer.email = account.email;
        viewer.role = account.role;
      }

      if (patient?.name && patient.dateOfBirth) {
        const activePatient = getPatient();
        activePatient.name = patient.name;
        activePatient.dateOfBirth = patient.dateOfBirth;
        activePatient.primaryDiagnosis = patient.conditions?.[0] ?? activePatient.primaryDiagnosis;
        activePatient.secondaryConditions = patient.conditions?.slice(1) ?? activePatient.secondaryConditions;
        activePatient.primaryDoctorName = patient.doctorName || activePatient.primaryDoctorName;
        activePatient.primaryDoctorPhone = patient.doctorPhone || activePatient.primaryDoctorPhone;
      }

      if (medication?.name && medication.doseAmount && medication.timesOfDay) {
        state.medications.unshift({
          id: nextId("medication"),
          patientId: getPatient().id,
          name: medication.name,
          brandName: medication.brandName,
          genericName: medication.genericName,
          doseAmount: medication.doseAmount,
          doseUnit: medication.doseUnit ?? "mg",
          frequency: medication.frequency ?? "once",
          timesOfDay: medication.timesOfDay,
          startDate: medication.startDate ?? new Date().toISOString().slice(0, 10),
          endDate: medication.endDate ?? null,
          prescribingDoctor: medication.prescribingDoctor ?? getPatient().primaryDoctorName,
          purpose: medication.purpose ?? "Added during onboarding.",
          instructions: medication.instructions ?? "",
          pillColor: medication.pillColor ?? "white",
          pillShape: medication.pillShape ?? "round",
          refillDate: medication.refillDate ?? new Date().toISOString().slice(0, 10),
          pharmacyName: medication.pharmacyName ?? "Pharmacy pending",
          pharmacyPhone: medication.pharmacyPhone ?? "",
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      if (familyInvite?.email) {
        state.familyMembers.push({
          id: nextId("family"),
          patientId: getPatient().id,
          invitedBy: getViewer().id,
          name: familyInvite.name ?? familyInvite.email.split("@")[0],
          email: familyInvite.email,
          relationship: familyInvite.relationship ?? "Family member",
          role: "family",
          permissions: "can_log",
          joinStatus: "pending",
          inviteToken: nextId("invite"),
          createdAt: new Date().toISOString(),
        } as FamilyMemberRecord);
      }

      response.status(201).json(getBootstrapPayload());
    }),
  );

  app.get("/api/dashboard", (_request, response) => {
    response.json(getDashboardSummary());
  });

  app.post(
    "/api/dashboard/briefing",
    asyncHandler(async (_request, response) => {
      const patient = getPatient();
      const briefing = await aiService.dailyBriefing(
        patient,
        state.medications,
        state.appointments,
        state.careJournal.slice(0, 5),
        state.tasks,
      );
      response.json({ briefing });
    }),
  );

  app.get("/api/medications", (_request, response) => {
    response.json({ medications: state.medications, logs: state.medicationLogs });
  });

  app.post(
    "/api/medications",
    asyncHandler(async (request, response) => {
      const body = request.body as Partial<MedicationRecord>;
      const name = trimmedText(body.name);
      const doseAmount = trimmedText(body.doseAmount);

      if (!hasText(name) || !hasText(doseAmount)) {
        sendValidationError(response, "Please enter a medication name and dose before saving.");
        return;
      }

      const medication: MedicationRecord = {
        id: nextId("medication"),
        patientId: getPatient().id,
        name,
        brandName: optionalText(body.brandName) || undefined,
        genericName: optionalText(body.genericName) || undefined,
        doseAmount,
        doseUnit: optionalText(body.doseUnit) || "mg",
        frequency: body.frequency ?? "once",
        timesOfDay: body.timesOfDay?.length ? body.timesOfDay : ["morning"],
        startDate: optionalText(body.startDate) || new Date().toISOString().slice(0, 10),
        endDate: optionalText(body.endDate) || null,
        prescribingDoctor: optionalText(body.prescribingDoctor) || getPatient().primaryDoctorName,
        purpose: optionalText(body.purpose),
        instructions: optionalText(body.instructions),
        pillColor: optionalText(body.pillColor) || "white",
        pillShape: optionalText(body.pillShape) || "round",
        refillDate: optionalText(body.refillDate) || new Date().toISOString().slice(0, 10),
        pharmacyName: optionalText(body.pharmacyName),
        pharmacyPhone: optionalText(body.pharmacyPhone),
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
      };
      state.medications.unshift(medication);
      addActivity({
        userId: getViewer().id,
        type: "medication_logged",
        actorName: "You",
        description: `added ${medication.name}`,
      });
      const interactions = await aiService.interactionCheck(state.medications.filter((item) => item.isActive));
      response.status(201).json({ medication, interactions });
    }),
  );

  app.patch("/api/medications/:id", (request, response) => {
    const medication = state.medications.find((item) => item.id === request.params.id);
    if (!medication) {
      response.status(404).json({ message: "Medication not found." });
      return;
    }
    const { id, patientId, createdAt, ...updates } = request.body;
    if ("name" in updates && !hasText(updates.name)) {
      sendValidationError(response, "Please enter a medication name before saving changes.");
      return;
    }
    if ("doseAmount" in updates && !hasText(updates.doseAmount)) {
      sendValidationError(response, "Please enter a medication dose before saving changes.");
      return;
    }
    if ("name" in updates) updates.name = trimmedText(updates.name);
    if ("doseAmount" in updates) updates.doseAmount = trimmedText(updates.doseAmount);
    Object.assign(medication, updates);
    response.json({ medication });
  });

  app.delete("/api/medications/:id", (request, response) => {
    const index = state.medications.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ message: "Medication not found." });
      return;
    }
    state.medications.splice(index, 1);
    response.status(204).end();
  });

  app.post("/api/medications/interactions", asyncHandler(async (request, response) => {
    const ids = (request.body?.medicationIds ?? []) as string[];
    const selected = state.medications.filter((medication) => ids.includes(medication.id));
    response.json(await aiService.interactionCheck(selected));
  }));

  app.post("/api/medications/:id/log", (request, response) => {
    const medication = state.medications.find((item) => item.id === request.params.id);
    if (!medication) {
      response.status(404).json({ message: "Medication not found." });
      return;
    }

    const body = request.body as Partial<MedicationLogRecord>;
    const log: MedicationLogRecord = {
      id: nextId("log"),
      medicationId: medication.id,
      patientId: getPatient().id,
      scheduledTime: body.scheduledTime ?? new Date().toISOString(),
      takenAt: body.status === "missed" ? null : new Date().toISOString(),
      status: body.status ?? "taken",
      notes: body.notes ?? "",
      loggedBy: getViewer().name,
      createdAt: new Date().toISOString(),
    };

    state.medicationLogs.unshift(log);
    addActivity({
      userId: getViewer().id,
      type: "medication_logged",
      actorName: "You",
      description: `logged ${medication.name} as ${log.status}`,
    });
    response.status(201).json({ log, dashboard: getDashboardSummary() });
  });

  app.get("/api/journal", (_request, response) => {
    response.json({ entries: state.careJournal });
  });

  app.post("/api/journal", asyncHandler(async (request, response) => {
    const body = request.body as Partial<CareJournalRecord>;
    const date = trimmedText(body.date);
    const entryBody = trimmedText(body.entryBody);

    if (!hasText(date) || !hasText(entryBody)) {
      sendValidationError(response, "Please add the date and what happened before saving this care note.");
      return;
    }

    const entry: CareJournalRecord = {
      id: nextId("journal"),
      patientId: getPatient().id,
      userId: getViewer().id,
      date,
      time: trimmedText(body.time) || new Date().toTimeString().slice(0, 5),
      entryTitle: trimmedText(body.entryTitle) || (await aiService.titleForJournal(entryBody)),
      entryBody,
      mood: body.mood ?? 3,
      painLevel: body.painLevel ?? 0,
      tags: optionalStringArray(body.tags),
      severity: body.severity ?? "low",
      followUpNeeded: body.followUpNeeded ?? false,
      followUpNote: optionalText(body.followUpNote) || undefined,
      createdAt: new Date().toISOString(),
      isNew: true,
    };

    state.careJournal.unshift(entry);
    addActivity({
      userId: getViewer().id,
      type: "journal_added",
      actorName: "You",
      description: "added a care journal entry",
    });
    response.status(201).json({ entry });
  }));

  app.post("/api/journal/analyze-30-days", asyncHandler(async (_request, response) => {
    response.json(await aiService.analyzeJournalPatterns(state.careJournal.slice(0, 30), getPatient()));
  }));

  app.post("/api/journal/:id/analyze", asyncHandler(async (request, response) => {
    const entry = state.careJournal.find((item) => item.id === request.params.id);
    if (!entry) {
      response.status(404).json({ message: "Journal entry not found." });
      return;
    }
    const analysis = await aiService.analyzeJournalEntry(entry, getPatient());
    entry.aiAnalysis = analysis;
    response.json({ analysis });
  }));

  app.get("/api/documents", (_request, response) => {
    response.json({ documents: state.documents });
  });

  app.post(
    "/api/documents/upload",
    upload.single("file"),
    asyncHandler(async (request, response) => {
      const extractedText = await documentService.extractText(request.file);
      const analysis = await aiService.decodeDocument(extractedText);
      const fileUrl = await createDocumentUrl(request.file);
      const body = request.body as { category?: DocumentRecord["documentCategory"]; documentDate?: string };
      const document: DocumentRecord = {
        id: nextId("document"),
        patientId: getPatient().id,
        userId: getViewer().id,
        fileName: request.file?.originalname ?? "uploaded-document",
        fileUrl,
        fileType: request.file?.mimetype.includes("pdf") ? "PDF" : "image",
        documentCategory: body.category ?? "other",
        uploadDate: new Date().toISOString().slice(0, 10),
        documentDate: body.documentDate ?? new Date().toISOString().slice(0, 10),
        aiSummary: {
          summary: analysis.summary,
          actionItems: analysis.action_items,
          importantDates: analysis.important_dates,
          medicalTerms: analysis.medical_terms,
          doctorQuestions: analysis.doctor_questions,
          documentType: analysis.document_type,
          severityFlag: (analysis.severity_flag as "normal" | "review_needed" | "urgent") || "normal",
        },
        aiActionItems: analysis.action_items,
        isProcessed: true,
        extractedText,
      };
      state.documents.unshift(document);
      addActivity({
        userId: getViewer().id,
        type: "document_uploaded",
        actorName: "You",
        description: "uploaded a new document",
      });

      if (analysis.severity_flag === "urgent") {
        await emailService.send(
          state.familyMembers.filter((member) => member.email).map((member) => member.email),
          "CareCircle alert: document needs review",
          "<p>A recently uploaded document may need immediate attention. Please review.</p>",
        );
      }

      response.status(201).json({ document });
    }),
  );

  app.patch("/api/documents/:id", (request, response) => {
    const document = state.documents.find((item) => item.id === request.params.id);
    if (!document) {
      response.status(404).json({ message: "Document not found." });
      return;
    }

    if (hasText(request.body?.documentCategory)) {
      document.documentCategory = request.body.documentCategory;
    }
    if (hasText(request.body?.documentDate)) {
      document.documentDate = trimmedText(request.body.documentDate);
    }

    response.json({ document });
  });

  app.post("/api/documents/:id/reprocess", asyncHandler(async (request, response) => {
    const document = state.documents.find((item) => item.id === request.params.id);
    if (!document) {
      response.status(404).json({ message: "Document not found." });
      return;
    }

    const analysis = await aiService.decodeDocument(document.extractedText ?? document.aiSummary.summary);
    document.aiSummary = {
      summary: analysis.summary,
      actionItems: analysis.action_items,
      importantDates: analysis.important_dates,
      medicalTerms: analysis.medical_terms,
      doctorQuestions: analysis.doctor_questions,
      documentType: analysis.document_type,
      severityFlag: (analysis.severity_flag as "normal" | "review_needed" | "urgent") || "normal",
    };
    document.aiActionItems = analysis.action_items;
    document.isProcessed = true;

    response.json({ document });
  }));

  app.delete("/api/documents/:id", (request, response) => {
    const index = state.documents.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ message: "Document not found." });
      return;
    }

    state.documents.splice(index, 1);
    response.status(204).end();
  });

  app.get("/api/appointments", (_request, response) => {
    response.json({ appointments: state.appointments });
  });

  app.post("/api/appointments", asyncHandler(async (request, response) => {
    const body = request.body as Partial<AppointmentRecord>;
    const doctorName = trimmedText(body.doctorName);
    const appointmentDate = trimmedText(body.appointmentDate);

    if (!hasText(doctorName) || !hasText(appointmentDate)) {
      sendValidationError(response, "Please enter the doctor's name and appointment date before saving.");
      return;
    }

    const appointment: AppointmentRecord = {
      id: nextId("appointment"),
      patientId: getPatient().id,
      userId: getViewer().id,
      doctorName,
      specialty: optionalText(body.specialty),
      clinicName: optionalText(body.clinicName),
      appointmentDate,
      appointmentTime: trimmedText(body.appointmentTime) || "09:00",
      durationMinutes: optionalNumber(body.durationMinutes) ?? 30,
      address: optionalText(body.address),
      phone: optionalText(body.phone),
      videoLink: optionalText(body.videoLink) || undefined,
      purpose: optionalText(body.purpose),
      notes: optionalText(body.notes) || undefined,
      questionsToAsk: optionalStringArray(body.questionsToAsk),
      status: body.status ?? "upcoming",
      reminderSent: false,
      createdAt: new Date().toISOString(),
    };
    state.appointments.unshift(appointment);
    addActivity({
      userId: getViewer().id,
      type: "appointment_scheduled",
      actorName: "You",
      description: `scheduled ${appointment.doctorName}`,
    });
    response.status(201).json({ appointment });
  }));

  app.patch("/api/appointments/:id", (request, response) => {
    const appointment = state.appointments.find((item) => item.id === request.params.id);
    if (!appointment) {
      response.status(404).json({ message: "Appointment not found." });
      return;
    }

    const doctorName = "doctorName" in request.body ? trimmedText(request.body.doctorName) : appointment.doctorName;
    const appointmentDate = "appointmentDate" in request.body ? trimmedText(request.body.appointmentDate) : appointment.appointmentDate;
    if (!hasText(doctorName) || !hasText(appointmentDate)) {
      sendValidationError(response, "Please enter the doctor's name and appointment date before saving.");
      return;
    }

    appointment.doctorName = doctorName;
    appointment.specialty = "specialty" in request.body ? optionalText(request.body.specialty) : appointment.specialty;
    appointment.clinicName = "clinicName" in request.body ? optionalText(request.body.clinicName) : appointment.clinicName;
    appointment.appointmentDate = appointmentDate;
    appointment.appointmentTime = "appointmentTime" in request.body ? optionalText(request.body.appointmentTime) || appointment.appointmentTime : appointment.appointmentTime;
    appointment.durationMinutes = "durationMinutes" in request.body ? optionalNumber(request.body.durationMinutes) ?? appointment.durationMinutes : appointment.durationMinutes;
    appointment.address = "address" in request.body ? optionalText(request.body.address) : appointment.address;
    appointment.phone = "phone" in request.body ? optionalText(request.body.phone) : appointment.phone;
    appointment.purpose = "purpose" in request.body ? optionalText(request.body.purpose) : appointment.purpose;
    appointment.questionsToAsk = "questionsToAsk" in request.body ? optionalStringArray(request.body.questionsToAsk) : appointment.questionsToAsk;
    appointment.status = "status" in request.body ? request.body.status : appointment.status;

    addActivity({
      userId: getViewer().id,
      type: "appointment_scheduled",
      actorName: getViewer().name.split(" ")[0],
      description: `updated ${appointment.doctorName}`,
    });

    response.json({ appointment });
  });

  app.post("/api/appointments/suggest-questions", asyncHandler(async (request, response) => {
    response.json(await aiService.suggestAppointmentQuestions(getPatient(), request.body ?? {}));
  }));

  app.post("/api/appointments/:id/prep-summary-email", asyncHandler(async (request, response) => {
    const appointment = state.appointments.find((item) => item.id === request.params.id);
    if (!appointment) {
      response.status(404).json({ message: "Appointment not found." });
      return;
    }

    const relevantJournal = state.careJournal.slice(0, 3);
    const medications = state.medications.filter((item) => item.isActive);
    const recentVitals = state.healthVitals.slice(0, 3);
    const emailHtml = `
      <h1>Appointment prep summary</h1>
      <p><strong>Patient:</strong> ${getPatient().name}</p>
      <p><strong>Doctor:</strong> ${appointment.doctorName} (${appointment.specialty || "Specialist"})</p>
      <p><strong>When:</strong> ${appointment.appointmentDate} at ${appointment.appointmentTime}</p>
      <p><strong>Purpose:</strong> ${appointment.purpose || "General follow-up"}</p>
      <h2>Questions to ask</h2>
      <ul>${appointment.questionsToAsk.map((item) => `<li>${item}</li>`).join("") || "<li>Add your questions in CareCircle before the visit.</li>"}</ul>
      <h2>Recent journal notes</h2>
      <ul>${relevantJournal.map((entry) => `<li>${entry.entryTitle}: ${entry.entryBody}</li>`).join("")}</ul>
      <h2>Current medications</h2>
      <ul>${medications.map((item) => `<li>${item.name} ${item.doseAmount}${item.doseUnit} - ${item.purpose}</li>`).join("")}</ul>
      <h2>Recent vitals</h2>
      <ul>${recentVitals.map((item) => `<li>${item.date}: BP ${item.bloodPressureSystolic ?? "--"}/${item.bloodPressureDiastolic ?? "--"}, glucose ${item.bloodGlucose ?? "--"}</li>`).join("")}</ul>
    `;

    await emailService.send(getViewer().email, `Prep summary for ${appointment.doctorName}`, emailHtml);
    response.status(201).json({ sentTo: getViewer().email });
  }));

  app.post("/api/appointments/:id/follow-up", asyncHandler(async (request, response) => {
    const appointment = state.appointments.find((item) => item.id === request.params.id);
    if (!appointment) {
      response.status(404).json({ message: "Appointment not found." });
      return;
    }
    const notes = trimmedText(request.body?.notes);
    if (!hasText(notes)) {
      sendValidationError(response, "Please write what was discussed before saving follow-up notes.");
      return;
    }
    appointment.followUpSummary = notes;
    appointment.status = "completed";
    response.json(await aiService.extractAppointmentFollowUp(notes));
  }));

  app.delete("/api/appointments/:id", (request, response) => {
    const index = state.appointments.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ message: "Appointment not found." });
      return;
    }
    state.appointments.splice(index, 1);
    response.status(204).end();
  });

  app.get("/api/vitals", (_request, response) => {
    response.json({ vitals: state.healthVitals });
  });

  app.post("/api/vitals", (request, response) => {
    const body = request.body as Partial<HealthVitalsRecord>;
    const date = trimmedText(body.date);
    const notes = trimmedText(body.notes);
    const vitalValues = {
      bloodPressureSystolic: optionalNumber(body.bloodPressureSystolic),
      bloodPressureDiastolic: optionalNumber(body.bloodPressureDiastolic),
      heartRate: optionalNumber(body.heartRate),
      bloodGlucose: optionalNumber(body.bloodGlucose),
      weight: optionalNumber(body.weight),
      temperature: optionalNumber(body.temperature),
      oxygenSaturation: optionalNumber(body.oxygenSaturation),
      painLevel: optionalNumber(body.painLevel),
    };
    const hasAnyReading = Object.values(vitalValues).some((value) => value !== undefined);

    if (!hasText(date) || (!hasAnyReading && !hasText(notes))) {
      sendValidationError(response, "Please add the date and at least one reading or note before saving.");
      return;
    }

    const vital: HealthVitalsRecord = {
      id: nextId("vital"),
      patientId: getPatient().id,
      loggedBy: getViewer().id,
      date,
      time: trimmedText(body.time) || new Date().toTimeString().slice(0, 5),
      ...vitalValues,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };
    state.healthVitals.unshift(vital);
    addActivity({
      userId: getViewer().id,
      type: "vital_logged",
      actorName: "You",
      description: "logged new vitals",
    });
    response.status(201).json({ vital });
  });

  app.post("/api/vitals/analyze", asyncHandler(async (_request, response) => {
    response.json(await aiService.analyzeVitals(state.healthVitals.slice(0, 30), getPatient()));
  }));

  app.get("/api/family", (_request, response) => {
    response.json({
      familyMembers: state.familyMembers,
      feed: state.activityEvents,
      reactions: state.activityReactions,
      messages: getFamilyMessages(),
    });
  });

  app.post("/api/family/invite", asyncHandler(async (request, response) => {
    const body = request.body as { name?: string; email: string; relationship?: string; role?: FamilyMemberRecord["role"] };
    const email = trimmedText(body.email);
    if (!hasText(email)) {
      sendValidationError(response, "Please enter an email address before sending an invite.");
      return;
    }
    const invite: FamilyMemberRecord = {
      id: nextId("family"),
      patientId: getPatient().id,
      invitedBy: getViewer().id,
      name: trimmedText(body.name) || email.split("@")[0],
      email,
      relationship: body.relationship ?? "Family member",
      role: body.role ?? "family",
      permissions: "can_log",
      joinStatus: "pending",
      inviteToken: nextId("invite"),
      createdAt: new Date().toISOString(),
    };
    state.familyMembers.push(invite);
    addActivity({
      userId: getViewer().id,
      type: "invite_sent",
      actorName: "You",
      description: `invited ${invite.name} to CareCircle`,
    });
    await emailService.send(invite.email, "You have been invited to CareCircle AI", `<p>${getViewer().name} invited you to help care for ${getPatient().name}.</p>`);
    response.status(201).json({ invite });
  }));

  app.post("/api/family/invite/:id/resend", asyncHandler(async (request, response) => {
    const invite = state.familyMembers.find((member) => member.id === request.params.id);
    if (!invite) {
      response.status(404).json({ message: "Invite not found." });
      return;
    }

    invite.createdAt = new Date().toISOString();
    await emailService.send(invite.email, "Your CareCircle invite was resent", `<p>${getViewer().name} resent your invite to help care for ${getPatient().name}.</p>`);
    response.json({ invite });
  }));

  app.delete("/api/family/invite/:id", (request, response) => {
    const index = state.familyMembers.findIndex((member) => member.id === request.params.id && member.joinStatus === "pending");
    if (index === -1) {
      response.status(404).json({ message: "Pending invite not found." });
      return;
    }

    state.familyMembers.splice(index, 1);
    response.status(204).end();
  });

  app.delete("/api/family/members/:id", (request, response) => {
    const index = state.familyMembers.findIndex((member) => member.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ message: "Family member not found." });
      return;
    }

    state.familyMembers.splice(index, 1);
    response.status(204).end();
  });

  app.post("/api/family/feed/:id/reactions", (request, response) => {
    const event = state.activityEvents.find((item) => item.id === request.params.id);
    if (!event) {
      response.status(404).json({ message: "Activity event not found." });
      return;
    }
    const reaction = {
      id: nextId("reaction"),
      eventId: event.id,
      userId: getViewer().id,
      emoji: String(request.body?.emoji ?? "heart"),
      createdAt: new Date().toISOString(),
    };
    state.activityReactions.unshift(reaction);
    response.status(201).json({ reaction });
  });

  app.get("/api/family/messages", (_request, response) => {
    response.json({
      messages: getFamilyMessages(),
      typing: [],
    });
  });

  app.post("/api/family/messages", (request, response) => {
    const messageText = trimmedText(request.body?.content ?? request.body?.messageText);
    if (!hasText(messageText)) {
      sendValidationError(response, "Please write a message before sending it.");
      return;
    }

    const message: FamilyMessageRecord = {
      id: nextId("family_message"),
      patientId: getPatient().id,
      userId: getViewer().id,
      userName: getViewer().name,
      userAvatarUrl: getViewer().photoUrl,
      messageText,
      createdAt: new Date().toISOString(),
      isPinned: false,
    };
    addFamilyMessage(message);
    addActivity({
      userId: getViewer().id,
      type: "message_sent",
      actorName: getViewer().name.split(" ")[0],
      description: "sent a family message",
    });
    response.status(201).json({ message });
  });

  app.patch("/api/family/messages/:id/pin", (request, response) => {
    const message = updateFamilyMessage(request.params.id, {
      isPinned: request.body?.isPinned ?? true,
    });
    if (!message) {
      response.status(404).json({ message: "Family message not found." });
      return;
    }

    response.json({ message });
  });

  app.get("/api/tasks", (_request, response) => {
    response.json({ tasks: state.tasks });
  });

  app.post("/api/tasks", (request, response) => {
    const body = request.body as Partial<TaskRecord>;
    const title = trimmedText(body.title);
    const dueDate = trimmedText(body.dueDate);

    if (!hasText(title) || !hasText(dueDate)) {
      sendValidationError(response, "Please enter a task title and due date before saving.");
      return;
    }

    const task: TaskRecord = {
      id: nextId("task"),
      patientId: getPatient().id,
      createdBy: getViewer().id,
      assignedTo: trimmedText(body.assignedTo) || getViewer().id,
      title,
      description: optionalText(body.description),
      category: body.category ?? "other",
      priority: body.priority ?? "medium",
      dueDate,
      dueTime: trimmedText(body.dueTime) || undefined,
      recurrence: body.recurrence ?? "none",
      status: body.status ?? "todo",
      aiSuggested: body.aiSuggested ?? false,
      createdAt: new Date().toISOString(),
    };
    state.tasks.unshift(task);
    addActivity({
      userId: getViewer().id,
      type: "task_updated",
      actorName: getViewer().name.split(" ")[0],
      description: `added "${task.title}" to the care board`,
    });
    response.status(201).json({ task });
  });

  app.patch("/api/tasks/:id", (request, response) => {
    const task = state.tasks.find((item) => item.id === request.params.id);
    if (!task) {
      response.status(404).json({ message: "Task not found." });
      return;
    }
    const { id, patientId, createdBy, createdAt, ...updates } = request.body;
    if ("title" in updates && !hasText(updates.title)) {
      sendValidationError(response, "Please enter a task title before saving changes.");
      return;
    }
    if ("dueDate" in updates && !hasText(updates.dueDate)) {
      sendValidationError(response, "Please enter a due date before saving changes.");
      return;
    }
    if ("title" in updates) updates.title = trimmedText(updates.title);
    if ("dueDate" in updates) updates.dueDate = trimmedText(updates.dueDate);
    const previousStatus = task.status;
    Object.assign(task, updates);
    if (task.status === "done") {
      task.completedAt = new Date().toISOString();
      addActivity({
        userId: getViewer().id,
        type: "task_completed",
        actorName: getViewer().name.split(" ")[0],
        description: `completed ${task.title}`,
      });
    } else if (previousStatus !== task.status) {
      addActivity({
        userId: getViewer().id,
        type: "task_updated",
        actorName: getViewer().name.split(" ")[0],
        description: `moved "${task.title}" to ${task.status.replaceAll("_", " ")}`,
      });
    }
    response.json({ task });
  });

  app.delete("/api/tasks/:id", (request, response) => {
    const index = state.tasks.findIndex((item) => item.id === request.params.id);
    if (index === -1) {
      response.status(404).json({ message: "Task not found." });
      return;
    }
    state.tasks.splice(index, 1);
    response.status(204).end();
  });

  app.post("/api/tasks/suggestions", asyncHandler(async (_request, response) => {
    response.json(await aiService.suggestTasks(getPatient()));
  }));

  app.get("/api/emergency", (_request, response) => {
    response.json({ protocols: state.emergencyProtocols, patient: getPatient() });
  });

  app.get("/api/emergency/patient-card", (_request, response) => {
    response.json({
      patient: getPatient(),
      medications: state.medications.filter((item) => item.isActive),
      familyMembers: state.familyMembers,
    });
  });

  app.post("/api/emergency/generate", asyncHandler(async (_request, response) => {
    const result = await aiService.generateEmergencyProtocols(getPatient(), state.medications.filter((item) => item.isActive));
    state.emergencyProtocols = result.protocols;
    response.json(result);
  }));

  app.post("/api/emergency/share-link", (request, response) => {
    const protocolId = trimmedText(request.body?.protocolId);
    const protocol =
      state.emergencyProtocols.find((item) => item.id === protocolId) ?? state.emergencyProtocols[0];
    if (!protocol) {
      response.status(404).json({ message: "Emergency protocol not found." });
      return;
    }

    response.json({
      url: `${env.backendUrl}/api/public/emergency/${protocol.shareToken}`,
      protocol,
    });
  });

  app.post("/api/emergency/share-email", asyncHandler(async (request, response) => {
    const selectedIds = Array.isArray(request.body?.familyMemberIds) ? request.body.familyMemberIds : [];
    const recipients = state.familyMembers.filter((member) => selectedIds.includes(member.id));
    if (!recipients.length) {
      sendValidationError(response, "Please choose at least one family member.");
      return;
    }

    const buffer = exportService.buildEmergencyCardPdf(getPatient(), state.medications.filter((item) => item.isActive));
    await emailService.send(
      recipients.map((member) => member.email),
      `Emergency information for ${getPatient().preferredName ?? getPatient().name}`,
      `<p>Attached is the latest CareCircle emergency information for ${getPatient().name}.</p>`,
      {
        attachments: [
          {
            filename: `CareCircle_Emergency_${(getPatient().preferredName ?? getPatient().name).replaceAll(" ", "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
            content: buffer,
          },
        ],
      },
    );

    response.status(201).json({ sent: recipients.length });
  }));

  app.get("/api/emergency/card/pdf", (_request, response) => {
    const buffer = exportService.buildEmergencyCardPdf(getPatient(), state.medications.filter((item) => item.isActive));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", 'attachment; filename="carecircle-emergency-card.pdf"');
    response.send(buffer);
  });

  app.get("/api/emergency/:id/pdf", (request, response) => {
    const protocol = state.emergencyProtocols.find((item) => item.id === request.params.id);
    if (!protocol) {
      response.status(404).json({ message: "Emergency protocol not found." });
      return;
    }
    const buffer = exportService.buildEmergencyProtocolPdf(getPatient(), protocol);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${protocol.title.toLowerCase().replaceAll(" ", "-")}.pdf"`);
    response.send(buffer);
  });

  app.get("/api/public/emergency/:shareToken", (request, response) => {
    const protocol = state.emergencyProtocols.find((item) => item.shareToken === request.params.shareToken);
    if (!protocol) {
      response.status(404).json({ message: "Share link not found." });
      return;
    }
    response.json({ protocol, patient: getPatient() });
  });

  app.get("/api/care-chat/sessions", (_request, response) => {
    response.json({ sessions: state.chatSessions, messages: state.chatMessages });
  });

  app.post("/api/care-chat/sessions", (request, response) => {
    const title = String(request.body?.title ?? "New Conversation");
    const session = {
      id: nextId("chat_session"),
      patientId: getPatient().id,
      userId: getViewer().id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.chatSessions.unshift(session);
    response.status(201).json({ session });
  });

  app.get("/api/care-chat/sessions/:id/messages", (request, response) => {
    response.json({ messages: state.chatMessages.filter((message) => message.sessionId === request.params.id) });
  });

  app.post("/api/care-chat/sessions/:id/messages", asyncHandler(async (request, response) => {
    const session = state.chatSessions.find((item) => item.id === request.params.id);
    if (!session) {
      response.status(404).json({ message: "Chat session not found." });
      return;
    }

    const prompt = String(request.body?.content ?? "");
    const userMessage = {
      id: nextId("chat_message"),
      sessionId: session.id,
      patientId: getPatient().id,
      userId: getViewer().id,
      role: "user" as const,
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    state.chatMessages.push(userMessage);

    const reply = await aiService.careChatReply({
      patient: getPatient(),
      prompt,
      recentJournal: state.careJournal.slice(0, 3),
      medications: state.medications.filter((item) => item.isActive),
    });

    const assistantMessage = {
      id: nextId("chat_message"),
      sessionId: session.id,
      patientId: getPatient().id,
      role: "assistant" as const,
      content: reply,
      createdAt: new Date().toISOString(),
    };
    state.chatMessages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();
    addActivity({
      userId: getViewer().id,
      type: "message_sent",
      actorName: "You",
      description: "sent a care chat message",
    });
    response.status(201).json({ userMessage, assistantMessage });
  }));

  app.post("/api/care-chat/emotional-checkin", asyncHandler(async (request, response) => {
    const feeling = String(request.body?.feeling ?? "");
    const reply = await aiService.emotionalCheckInReply(feeling);
    response.json({ reply });
  }));

  app.get("/api/settings", (_request, response) => {
    response.json({
      viewer: getViewer(),
      patient: getPatient(),
      settings: state.settings.find((item) => item.userId === getViewer().id),
      notifications: state.notifications,
    });
  });

  app.put("/api/settings/profile", asyncHandler(async (request, response) => {
    const viewer = getViewer();
    const name = trimmedText(request.body?.name);
    const phone = trimmedText(request.body?.phone);
    const photoUrl = trimmedText(request.body?.photoUrl);

    if (!hasText(name)) {
      sendValidationError(response, "Please enter your full name before saving.");
      return;
    }

    if (hasText(phone) && !phonePattern.test(phone)) {
      sendValidationError(response, "Please enter a phone number like +1 555-123-4567.");
      return;
    }

    viewer.name = name;
    viewer.phone = phone || undefined;
    viewer.photoUrl = photoUrl || viewer.photoUrl;
    const current = state.settings.find((item) => item.userId === viewer.id);
    if (current) {
      current.updatedAt = new Date().toISOString();
    }

    response.json({ viewer, updatedAt: current?.updatedAt ?? new Date().toISOString() });
  }));

  app.post("/api/settings/profile/email-change/request", asyncHandler(async (request, response) => {
    const email = trimmedText(request.body?.email).toLowerCase();
    if (!emailPattern.test(email)) {
      sendValidationError(response, "Please enter a valid email address.");
      return;
    }

    const token = nextId("email_change");
    addPendingEmailUpdate({
      id: nextId("pending_email"),
      userId: getViewer().id,
      nextEmail: email,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });

    const confirmUrl = `${env.frontendUrl}/settings?confirmEmail=${encodeURIComponent(token)}`;
    await emailService.send(email, "Confirm your CareCircle email change", `<p>Tap below to confirm your new CareCircle email address.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`);
    response.status(201).json({ message: `We sent a confirmation link to ${email}.` });
  }));

  app.post("/api/settings/profile/email-change/confirm", (request, response) => {
    const token = trimmedText(request.body?.token);
    const pending = getPendingEmailUpdateByToken(token);
    if (!pending) {
      response.status(404).json({ message: "That confirmation link is no longer valid." });
      return;
    }

    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      response.status(410).json({ message: "That confirmation link has expired. Please request a new one." });
      return;
    }

    pending.confirmedAt = new Date().toISOString();
    const viewer = getViewer();
    viewer.email = pending.nextEmail;
    response.json({ viewer });
  });

  app.put("/api/settings/patient", (request, response) => {
    const patient = getPatient();
    const name = trimmedText(request.body?.name);
    if (!hasText(name)) {
      sendValidationError(response, "Please enter your loved one's name before saving.");
      return;
    }

    patient.name = name;
    patient.dateOfBirth = trimmedText(request.body?.dateOfBirth) || patient.dateOfBirth;
    patient.photoUrl = trimmedText(request.body?.photoUrl) || patient.photoUrl;
    patient.primaryDiagnosis = trimmedText(request.body?.primaryDiagnosis) || patient.primaryDiagnosis;
    patient.secondaryConditions = optionalStringArray(request.body?.secondaryConditions);
    patient.primaryDoctorName = trimmedText(request.body?.primaryDoctorName) || patient.primaryDoctorName;
    patient.primaryDoctorPhone = trimmedText(request.body?.primaryDoctorPhone) || patient.primaryDoctorPhone;
    patient.hospitalPreference = trimmedText(request.body?.hospitalPreference) || patient.hospitalPreference;
    patient.insuranceProvider = trimmedText(request.body?.insuranceProvider) || patient.insuranceProvider;
    patient.insuranceId = trimmedText(request.body?.insuranceId) || patient.insuranceId;
    patient.bloodType = trimmedText(request.body?.bloodType) || patient.bloodType;
    patient.allergies = optionalStringArray(request.body?.allergies);
    patient.mobilityLevel = trimmedText(request.body?.mobilityLevel) || patient.mobilityLevel;
    patient.updatedAt = new Date().toISOString();

    addActivity({
      userId: getViewer().id,
      type: "patient_updated",
      actorName: getViewer().name.split(" ")[0],
      description: "updated the patient profile",
    });

    response.json({ patient });
  });

  app.patch("/api/settings/notifications", (request, response) => {
    const viewer = getViewer();
    viewer.notificationPreferences = {
      ...viewer.notificationPreferences,
      ...request.body,
    };
    response.json({ notificationPreferences: viewer.notificationPreferences });
  });

  app.patch("/api/settings/display", (request, response) => {
    const current = state.settings.find((item) => item.userId === getViewer().id);
    if (current) {
      current.display = {
        ...current.display,
        ...request.body,
      };
      current.updatedAt = new Date().toISOString();
    }
    response.json({ settings: current });
  });

  app.put("/api/settings", (request, response) => {
    const current = state.settings.find((item) => item.userId === getViewer().id);
    if (current && request.body?.display) {
      current.display = {
        ...current.display,
        ...request.body.display,
      };
      current.updatedAt = new Date().toISOString();
    }
    response.json({ settings: current });
  });

  app.post("/api/settings/feedback", (request, response) => {
    const subject = trimmedText(request.body?.subject) as FeedbackSubject;
    const message = trimmedText(request.body?.message);
    const replyEmail = trimmedText(request.body?.replyEmail);

    if (!hasText(message) || message.length < 100) {
      sendValidationError(response, "Please share at least 100 characters so we can understand the issue.");
      return;
    }

    if (hasText(replyEmail) && !emailPattern.test(replyEmail)) {
      sendValidationError(response, "Please enter a valid reply email address or leave it blank.");
      return;
    }

    const feedback = addFeedbackRecord({
      id: nextId("feedback"),
      subject: (["bug_report", "feature_request", "general_feedback", "other"].includes(subject) ? subject : "general_feedback") as FeedbackSubject,
      message,
      replyEmail: replyEmail || undefined,
      userId: getViewer().id,
      createdAt: new Date().toISOString(),
    });

    response.status(201).json({ feedback });
  });

  app.patch("/api/notifications/:id/read", (request, response) => {
    const notification = state.notifications.find((item) => item.id === request.params.id);
    if (!notification) {
      response.status(404).json({ message: "Notification not found." });
      return;
    }
    notification.isRead = request.body?.isRead ?? true;
    response.json({ notification });
  });

  app.get("/api/settings/export/csv", (_request, response) => {
    const csv = exportService.buildCsv(
      [
        ...state.tasks.map((task) => ({
          type: "task",
          title: task.title,
          date: task.dueDate,
          detail: task.status,
        })),
        ...state.appointments.map((appointment) => ({
          type: "appointment",
          title: appointment.doctorName,
          date: appointment.appointmentDate,
          detail: appointment.purpose,
        })),
        ...state.careJournal.map((entry) => ({
          type: "journal",
          title: entry.entryTitle,
          date: entry.date,
          detail: entry.severity,
        })),
      ],
    );
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", `attachment; filename="CareCircle_Export_${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(csv);
  });

  app.get("/api/settings/export/documents.zip", asyncHandler(async (_request, response) => {
    const zipBuffer = await exportService.buildDocumentsZip(state.documents);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader("Content-Disposition", `attachment; filename="CareCircle_Documents_${new Date().toISOString().slice(0, 10)}.zip"`);
    response.send(zipBuffer);
  }));

  app.delete("/api/settings/account", (_request, response) => {
    response.status(204).end();
  });

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({
      message: "Something went wrong. Please try again in a moment.",
      detail: error.message,
    });
  });

  return app;
};
