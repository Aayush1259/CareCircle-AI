import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoSnapshot } from "@carecircle/shared";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { MedicationsPage } from "@/pages/MedicationsPage";
import { VitalsPage } from "@/pages/VitalsPage";

const snapshot = buildDemoSnapshot();
const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/charts", () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  DoughnutChart: () => <div data-testid="doughnut-chart" />,
  LineChart: () => <div data-testid="line-chart" />,
}));

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
    refresh: refreshMock,
    request: requestMock,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("Modal form safeguards", () => {
  beforeEach(() => {
    requestMock.mockReset();
    refreshMock.mockReset();
    requestMock.mockResolvedValue({ questions: [] });
  });

  it("blocks whitespace-only medication submissions client-side", async () => {
    const user = userEvent.setup();

    render(<MedicationsPage />);

    await user.click(screen.getByRole("button", { name: /add medication/i }));

    const nameInput = screen.getByLabelText("Drug name");
    const doseInput = screen.getByLabelText("Dose");
    const saveButton = screen.getByRole("button", { name: /save medication/i });

    expect(saveButton).toHaveAttribute("type", "submit");

    await user.clear(nameInput);
    await user.type(nameInput, "   ");
    await user.clear(doseInput);
    await user.type(doseInput, "   ");
    await user.click(saveButton);

    expect(requestMock).not.toHaveBeenCalled();
  });

  it("keeps the appointment helper button from submitting the whole form", async () => {
    const user = userEvent.setup();

    render(<AppointmentsPage />);

    await user.click(screen.getByRole("button", { name: /add appointment/i }));

    expect(screen.getByRole("button", { name: /save appointment/i })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: /suggest questions/i })).toHaveAttribute("type", "button");
  });

  it("requires at least one vital reading or note before sending vitals", async () => {
    const user = userEvent.setup();

    render(<VitalsPage />);

    await user.click(screen.getByRole("button", { name: /log vitals/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(requestMock).not.toHaveBeenCalled();
  });
});
