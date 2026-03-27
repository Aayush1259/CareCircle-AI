import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildDemoSnapshot } from "@carecircle/shared";

const snapshot = buildDemoSnapshot();

vi.mock("@/context/AppDataContext", () => ({
  useAppData: () => ({
    session: {
      token: "demo-token",
      viewer: snapshot.users[0],
      patient: snapshot.patients[0],
      mode: "demo",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    bootstrap: {
      viewer: snapshot.users[0],
      patient: snapshot.patients[0],
      dashboard: {
        greetingName: "Sarah",
        currentDate: "Thursday, March 26",
        dailyBriefing: "Ellie has medications and appointments to keep in view today.",
        medicationProgress: {
          taken: 3,
          total: 5,
          adherenceScore: 60,
        },
        nextAppointment: snapshot.appointments[0],
        tasksDueToday: 2,
        lastJournalEntry: snapshot.careJournal[0],
      },
      data: {
        users: snapshot.users,
        patients: snapshot.patients,
        medications: snapshot.medications,
        medicationLogs: snapshot.medicationLogs,
        careJournal: snapshot.careJournal,
        documents: snapshot.documents,
        appointments: snapshot.appointments,
        familyMembers: snapshot.familyMembers,
        tasks: snapshot.tasks,
        emergencyProtocols: snapshot.emergencyProtocols,
        healthVitals: snapshot.healthVitals,
        aiInsights: snapshot.aiInsights,
        notifications: snapshot.notifications,
        chatSessions: snapshot.chatSessions,
        chatMessages: snapshot.chatMessages,
        activityEvents: snapshot.activityEvents,
        activityReactions: snapshot.activityReactions,
        settings: snapshot.settings,
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    request: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("App", () => {
  it("renders the dashboard route", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/AI Briefing/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick actions/i)).toBeInTheDocument();
  });
});
