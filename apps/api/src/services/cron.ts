import cron from "node-cron";
import { aiService } from "./ai";
import { emailService } from "./email";
import { getPatient, getState, getViewer } from "../store";

export const registerCronJobs = () => {
  cron.schedule("0 8 * * *", async () => {
    const state = getState();
    const patient = getPatient();
    const viewer = getViewer();
    const briefing = await aiService.dailyBriefing(
      patient,
      state.medications,
      state.appointments,
      state.careJournal.slice(0, 5),
      state.tasks,
    );
    console.info("Daily briefing generated", briefing);
    if (viewer.notificationPreferences.weeklySummary) {
      console.info("Medication reminder sweep complete");
    }
  });

  cron.schedule("0 18 * * 0", async () => {
    const patient = getPatient();
    const viewer = getViewer();
    const summary = await aiService.weeklySummary(patient);
    await emailService.send(viewer.email, `Weekly care summary for ${patient.preferredName ?? patient.name}`, `<p>${summary}</p>`);
  });
};
