import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPatientAccessRecord, normalizePatientPermissions } from "@carecircle/shared";
import { env } from "./env";
import { getState, resetState } from "./store";
import { createServer } from "./server";
import { persistenceService } from "./services/persistence";

const authHeader = async (_app: ReturnType<typeof createServer>) => {
  const state = getState();
  const viewer = state.users.find((user) => user.email === "demo@carecircle.ai");
  const patient = state.patients[0];
  const access =
    state.patientAccess.find((record) => record.userId === viewer?.id && record.patientId === patient?.id) ??
    (viewer && patient
      ? buildPatientAccessRecord({
          id: `access_${viewer.id}_${patient.id}`,
          patientId: patient.id,
          userId: viewer.id,
          email: viewer.email,
          name: viewer.name,
          accessRole: "primary_caregiver",
          accessLevel: "full_access",
          permissions: normalizePatientPermissions("primary_caregiver", "full_access"),
          invitedBy: viewer.id,
          joinStatus: "active",
          inviteToken: `invite_${viewer.id}`,
          createdAt: patient.createdAt,
          acceptedAt: patient.createdAt,
          lastActive: viewer.lastLogin,
        })
      : null);

  if (!viewer || !patient || !access) {
    throw new Error("Unable to build a deterministic demo auth header for tests.");
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const token = jwt.sign({
    viewerId: viewer.id,
    viewer,
    patient,
    access,
    capabilities: access.capabilities,
    mode: "demo",
    expiresAt,
  }, env.jwtSecret, {
    expiresIn: "1h",
  });

  return { Authorization: `Bearer ${token}` };
};

describe("CareCircle API", () => {
  beforeEach(() => {
    resetState();
    vi.restoreAllMocks();
  });

  it("returns health information", async () => {
    const app = createServer();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe("carecircle-api");
  });

  it("returns bootstrap payload with seeded patient data", async () => {
    const app = createServer();
    const response = await request(app).get("/api/bootstrap").set(await authHeader(app));

    expect(response.status).toBe(200);
    expect(response.body.patient.preferredName).toBe("Ellie");
    expect(response.body.data.medications).toHaveLength(5);
    expect(response.body.data.careJournal.length).toBeGreaterThanOrEqual(14);
  });

  it("returns a printable emergency card pdf", async () => {
    const app = createServer();
    const response = await request(app).get("/api/emergency/card/pdf").set(await authHeader(app));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("carecircle-emergency-card.pdf");
    expect(response.body).toBeTruthy();
  });

  it("rejects blank medication submissions with a helpful message", async () => {
    const app = createServer();
    const response = await request(app).post("/api/medications").set(await authHeader(app)).send({
      name: "   ",
      doseAmount: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please enter a medication name and dose before saving.");
  });

  it("updates an existing medication log when the same dose slot is logged twice", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const medication = getState().medications[0];
    const scheduledTime = "2030-01-01T08:00:00.000Z";
    const persistSpy = vi.spyOn(persistenceService, "persistMedicationLog");

    const firstResponse = await request(app)
      .post(`/api/medications/${medication.id}/log`)
      .set(headers)
      .send({ scheduledTime, status: "taken" });

    const secondResponse = await request(app)
      .post(`/api/medications/${medication.id}/log`)
      .set(headers)
      .send({ scheduledTime, status: "missed" });

    const matchingLogs = getState().medicationLogs.filter(
      (log) => log.medicationId === medication.id && log.patientId === getState().patients[0].id && log.scheduledTime === scheduledTime,
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.log.id).toBe(firstResponse.body.log.id);
    expect(secondResponse.body.log.status).toBe("missed");
    expect(secondResponse.body.log.takenAt).toBeNull();
    expect(matchingLogs).toHaveLength(1);
    expect(persistSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects blank care journal submissions with a helpful message", async () => {
    const app = createServer();
    const response = await request(app).post("/api/journal").set(await authHeader(app)).send({
      date: "   ",
      entryBody: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please add the date and what happened before saving this care note.");
  });

  it("rejects blank appointment submissions with a helpful message", async () => {
    const app = createServer();
    const response = await request(app).post("/api/appointments").set(await authHeader(app)).send({
      doctorName: "   ",
      appointmentDate: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please enter the doctor's name and appointment date before saving.");
  });

  it("rejects empty vitals submissions with a helpful message", async () => {
    const app = createServer();
    const response = await request(app).post("/api/vitals").set(await authHeader(app)).send({
      date: "2026-03-26",
      notes: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please add the date and at least one reading or note before saving.");
  });

  it("rejects blank task submissions with a helpful message", async () => {
    const app = createServer();
    const response = await request(app).post("/api/tasks").set(await authHeader(app)).send({
      title: "   ",
      dueDate: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please enter a task title and due date before saving.");
  });

  it("rejects blank appointment follow-up notes with a helpful message", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const appointmentsResponse = await request(app).get("/api/appointments").set(headers);
    const appointmentId = appointmentsResponse.body.appointments[0].id;

    const response = await request(app).post(`/api/appointments/${appointmentId}/follow-up`).set(headers).send({
      notes: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please write what was discussed before saving follow-up notes.");
  });

  it("updates patient access permissions through settings access management", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const bootstrapResponse = await request(app).get("/api/bootstrap").set(headers);
    const accessRecord = bootstrapResponse.body.patientAccess.find((record: { accessRole: string; id: string; permissions: { canLogVitals: boolean } }) => record.accessRole === "family_member");

    expect(accessRecord).toBeTruthy();

    const response = await request(app)
      .patch(`/api/settings/access/${accessRecord.id}`)
      .set(headers)
      .send({
        permissions: {
          ...accessRecord.permissions,
          canLogVitals: true,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.access.permissions.canLogVitals).toBe(true);
  });

  it("persists notification preference updates through settings", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const persistUserSpy = vi.spyOn(persistenceService, "persistUser");

    const response = await request(app)
      .patch("/api/settings/notifications")
      .set(headers)
      .send({
        medicationReminders: false,
        weeklySummaryDay: "Friday",
      });

    expect(response.status).toBe(200);
    expect(response.body.notificationPreferences.medicationReminders).toBe(false);
    expect(response.body.notificationPreferences.weeklySummaryDay).toBe("Friday");
    expect(persistUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          medicationReminders: false,
          weeklySummaryDay: "Friday",
        }),
      }),
    );
  });

  it("persists display preference updates through settings", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const persistSettingsSpy = vi.spyOn(persistenceService, "persistSettings");

    const response = await request(app)
      .patch("/api/settings/display")
      .set(headers)
      .send({
        fontSize: "large",
        highContrast: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.settings.display.fontSize).toBe("large");
    expect(response.body.settings.display.highContrast).toBe(true);
    expect(persistSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        display: expect.objectContaining({
          fontSize: "large",
          highContrast: true,
        }),
      }),
    );
  });

  it("preserves an invited secondary caregiver role on login", async () => {
    const app = createServer();
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "james@carecircle.ai",
      password: "Demo1234",
    });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.session.access.accessRole).toBe("secondary_caregiver");

    const bootstrapResponse = await request(app)
      .get("/api/bootstrap")
      .set({ Authorization: `Bearer ${loginResponse.body.session.token}` });

    expect(bootstrapResponse.status).toBe(200);
    expect(bootstrapResponse.body.viewerAccess.accessRole).toBe("secondary_caregiver");
    expect(bootstrapResponse.body.capabilities).not.toContain("manage_family");
  });

  it("persists care chat sessions and messages when sending an AI chat prompt", async () => {
    const app = createServer();
    const headers = await authHeader(app);
    const persistSessionSpy = vi.spyOn(persistenceService, "persistChatSession");
    const persistMessageSpy = vi.spyOn(persistenceService, "persistChatMessage");

    const sessionResponse = await request(app)
      .post("/api/care-chat/sessions")
      .set(headers)
      .send({ title: "Medication question" });

    expect(sessionResponse.status).toBe(201);
    expect(persistSessionSpy).toHaveBeenCalledWith(expect.objectContaining({ id: sessionResponse.body.session.id }));

    const messageResponse = await request(app)
      .post(`/api/care-chat/sessions/${sessionResponse.body.session.id}/messages`)
      .set(headers)
      .send({ content: "What meds are due today?" });

    expect(messageResponse.status).toBe(201);
    expect(messageResponse.body.userMessage.content).toBe("What meds are due today?");
    expect(messageResponse.body.assistantMessage.role).toBe("assistant");
    expect(persistMessageSpy).toHaveBeenCalledTimes(2);
  });
});
