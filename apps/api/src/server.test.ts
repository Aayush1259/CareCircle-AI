import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetState } from "./store";
import { createServer } from "./server";

const authHeader = async (app: ReturnType<typeof createServer>) => {
  const loginResponse = await request(app).post("/api/auth/login").send({
    email: "demo@carecircle.ai",
    password: "Demo1234",
  });

  return { Authorization: `Bearer ${loginResponse.body.session.token}` };
};

describe("CareCircle API", () => {
  beforeEach(() => {
    resetState();
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
});
