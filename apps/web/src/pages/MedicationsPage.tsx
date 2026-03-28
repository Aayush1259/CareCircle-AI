import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Lock, Phone, Sparkles, TrendingUp, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import type { MedicationLogRecord, MedicationLogStatus, MedicationRecord, TimeOfDay } from "@carecircle/shared";
import { BarChart, DoughnutChart } from "@/components/charts";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { resolveViewerRole } from "@/lib/roles";
import { hasText, trimmedText } from "@/lib/validation";

const tabs = ["Today's Schedule", "All Medications", "Interaction Checker", "Refill Tracker"] as const;
const scheduleSections = ["morning", "afternoon", "evening", "bedtime"] as const;
const scheduleLabels: Record<(typeof scheduleSections)[number], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  bedtime: "Bedtime",
};
const scheduleHours: Record<(typeof scheduleSections)[number], number> = {
  morning: 8,
  afternoon: 13,
  evening: 18,
  bedtime: 21,
};
const emptyMedicationForm = {
  name: "",
  doseAmount: "",
  doseUnit: "mg",
  frequency: "once",
  purpose: "",
  instructions: "",
  refillDate: "",
  pharmacyName: "",
  pharmacyPhone: "",
};

type DoseSlotStatus = MedicationLogStatus | "pending";

const timesOfDayForFrequency = (frequency: (typeof emptyMedicationForm)["frequency"]): TimeOfDay[] => {
  if (frequency === "twice") return ["morning", "evening"];
  if (frequency === "three_times") return ["morning", "afternoon", "evening"];
  if (frequency === "four_times") return [...scheduleSections];
  return ["morning"];
};

const buildScheduledTime = (dateIso: string, timeOfDay: TimeOfDay) => {
  const value = new Date(`${dateIso}T12:00:00`);
  value.setHours(scheduleHours[timeOfDay], 0, 0, 0);
  return value.toISOString();
};

const buildSlotKey = (medicationId: string, scheduledTime: string) => `${medicationId}:${scheduledTime}`;

const formatScheduledTime = (scheduledTime: string) =>
  new Date(scheduledTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const adherenceTone = (score: number): "success" | "warning" | "danger" =>
  score >= 85 ? "success" : score >= 60 ? "warning" : "danger";

const adherenceCopy = (score: number) => {
  if (score >= 85) return "On track";
  if (score >= 60) return "Needs attention";
  return "At risk";
};

const doseStatusTone = (status: DoseSlotStatus): "success" | "warning" | "danger" =>
  status === "taken" ? "success" : status === "missed" ? "danger" : "warning";

const doseStatusLabel = (status: DoseSlotStatus) => {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  if (status === "skipped") return "Skipped";
  return "Waiting";
};

const refillProgress = (daysRemaining: number) => Math.max(8, Math.min(100, 100 - Math.max(daysRemaining, 0) * 6));

const refillTone = (daysRemaining: number): "danger" | "warning" | "brand" =>
  daysRemaining <= 3 ? "danger" : daysRemaining <= 7 ? "warning" : "brand";

const isMedicationScheduledOn = (medication: MedicationRecord, dateIso: string) =>
  medication.startDate <= dateIso && (!medication.endDate || medication.endDate >= dateIso);

export const MedicationsPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Today's Schedule");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [filter, setFilter] = useState("active");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [interactionResult, setInteractionResult] = useState<Array<{ title: string; severity: string; explanation: string; next_steps: string }> | null>(null);
  const [form, setForm] = useState(emptyMedicationForm);
  const [saveBusy, setSaveBusy] = useState(false);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [loggingSlotKey, setLoggingSlotKey] = useState<string | null>(null);
  const [updatingMedicationId, setUpdatingMedicationId] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMedication, setReminderMedication] = useState<MedicationRecord | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderSaving, setReminderSaving] = useState(false);

  if (!bootstrap) return null;

  const { data } = bootstrap;
  const viewerRole = resolveViewerRole(bootstrap.viewer.role, bootstrap.viewerAccess?.accessRole);
  const capabilities =
    bootstrap.capabilities ??
    (viewerRole === "family_member"
      ? ["view_medications"]
      : ["manage_medications", "log_medications", "view_ai_insights"]);
  const canManageMedications = capabilities.includes("manage_medications");
  const canLogMedications = capabilities.includes("log_medications");
  const canViewAiInsights = capabilities.includes("view_ai_insights");
  const canSeeMedicationDetails = viewerRole !== "family_member";
  const availableTabs = tabs.filter((item) => {
    if (item === "Interaction Checker") return canViewAiInsights;
    if (item === "Refill Tracker") return canSeeMedicationDetails;
    return true;
  });

  useEffect(() => {
    if (!availableTabs.includes(tab)) setTab(availableTabs[0]);
  }, [availableTabs, tab]);

  const today = new Date().toISOString().slice(0, 10);
  const activeMedications = data.medications
    .filter((medication) => medication.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
  const visibleMedications =
    filter === "active"
      ? data.medications.filter((item) => item.isActive)
      : filter === "inactive"
        ? data.medications.filter((item) => !item.isActive)
        : data.medications;

  const latestLogsBySlot = useMemo(() => {
    const nextMap = new Map<string, MedicationLogRecord>();
    [...data.medicationLogs]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .forEach((log) => nextMap.set(buildSlotKey(log.medicationId, log.scheduledTime), log));
    return nextMap;
  }, [data.medicationLogs]);

  const todaySlots = useMemo(
    () =>
      activeMedications
        .filter((medication) => isMedicationScheduledOn(medication, today))
        .flatMap((medication) =>
          medication.timesOfDay.map((timeOfDay) => {
            const scheduledTime = buildScheduledTime(today, timeOfDay);
            const log = latestLogsBySlot.get(buildSlotKey(medication.id, scheduledTime));
            return {
              id: buildSlotKey(medication.id, scheduledTime),
              medication,
              timeOfDay,
              scheduledTime,
              log,
              status: (log?.status ?? "pending") as DoseSlotStatus,
            };
          }),
        )
        .sort((left, right) => {
          const sectionDifference = scheduleSections.indexOf(left.timeOfDay) - scheduleSections.indexOf(right.timeOfDay);
          return sectionDifference !== 0 ? sectionDifference : left.medication.name.localeCompare(right.medication.name);
        }),
    [activeMedications, latestLogsBySlot, today],
  );

  const todayAdherence = useMemo(() => {
    const taken = todaySlots.filter((slot) => slot.status === "taken").length;
    const missed = todaySlots.filter((slot) => slot.status === "missed").length;
    const total = todaySlots.length;
    return {
      taken,
      missed,
      remaining: Math.max(total - taken - missed, 0),
      total,
      score: total === 0 ? 100 : Math.round((taken / total) * 100),
    };
  }, [todaySlots]);

  const weeklySeries = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const iso = date.toISOString().slice(0, 10);
        const logs = data.medicationLogs.filter((log) => log.scheduledTime.slice(0, 10) === iso);
        const taken = logs.filter((log) => log.status === "taken").length;
        const missed = logs.filter((log) => log.status === "missed").length;
        const total = logs.length;
        return {
          label: date.toLocaleDateString("en-US", { weekday: "short" }),
          dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: total === 0 ? 0 : Math.round((taken / total) * 100),
          taken,
          missed,
          total,
        };
      }),
    [data.medicationLogs],
  );

  const weeklyAverage = Math.round(weeklySeries.reduce((sum, item) => sum + item.score, 0) / Math.max(weeklySeries.length, 1));
  const bestDay = weeklySeries.reduce(
    (best, item) => (item.score > best.score ? item : best),
    weeklySeries[0] ?? { label: "N/A", dateLabel: "", score: 0, taken: 0, missed: 0, total: 0 },
  );
  const steadyDays = weeklySeries.filter((item) => item.score >= 80).length;
  const yesterdayScore = weeklySeries[weeklySeries.length - 2]?.score ?? todayAdherence.score;
  const scoreDelta = todayAdherence.score - yesterdayScore;
  const nextPendingDose = todaySlots.find((slot) => slot.status === "pending");

  const closeModal = () => {
    setModalOpen(false);
    setEditingMedicationId(null);
    setForm(emptyMedicationForm);
    setSaveBusy(false);
  };

  const openCreateModal = () => {
    setEditingMedicationId(null);
    setForm(emptyMedicationForm);
    setModalOpen(true);
  };

  const openEditModal = (medication: MedicationRecord) => {
    setEditingMedicationId(medication.id);
    setForm({
      name: medication.name,
      doseAmount: medication.doseAmount,
      doseUnit: medication.doseUnit,
      frequency: medication.frequency,
      purpose: medication.purpose,
      instructions: medication.instructions,
      refillDate: medication.refillDate,
      pharmacyName: medication.pharmacyName,
      pharmacyPhone: medication.pharmacyPhone,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const name = trimmedText(form.name);
    const doseAmount = trimmedText(form.doseAmount);
    if (!hasText(name) || !hasText(doseAmount)) {
      toast.error("Please enter a medication name and dose before saving.");
      return;
    }
    setSaveBusy(true);
    try {
      await request(editingMedicationId ? `/medications/${editingMedicationId}` : "/medications", {
        method: editingMedicationId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          name,
          doseAmount,
          purpose: trimmedText(form.purpose),
          instructions: trimmedText(form.instructions),
          refillDate: trimmedText(form.refillDate),
          pharmacyName: trimmedText(form.pharmacyName),
          pharmacyPhone: trimmedText(form.pharmacyPhone),
          timesOfDay: timesOfDayForFrequency(form.frequency),
        }),
      });
      toast.success(editingMedicationId ? "Medication updated." : "Medication saved.");
      closeModal();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const logDose = async (slot: { id: string; medication: MedicationRecord; scheduledTime: string; status: DoseSlotStatus }, status: MedicationLogStatus) => {
    if (slot.status === status) return;
    setLoggingSlotKey(slot.id);
    try {
      await request(`/medications/${slot.medication.id}/log`, {
        method: "POST",
        body: JSON.stringify({ scheduledTime: slot.scheduledTime, status }),
      });
      toast.success(status === "taken" ? "Dose marked as taken." : "Dose marked as missed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoggingSlotKey(null);
    }
  };

  const checkInteractions = async () => {
    setInteractionLoading(true);
    try {
      const result = await request<{ interactions: Array<{ title: string; severity: string; explanation: string; next_steps: string }> }>(
        "/medications/interactions",
        { method: "POST", body: JSON.stringify({ medicationIds: selectedIds }) },
      );
      setInteractionResult(result.interactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setInteractionLoading(false);
    }
  };

  const toggleMedicationActive = async (medication: MedicationRecord, nextIsActive: boolean) => {
    setUpdatingMedicationId(medication.id);
    try {
      await request(`/medications/${medication.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextIsActive }),
      });
      toast.success(nextIsActive ? "Medication reactivated." : "Medication deactivated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingMedicationId(null);
    }
  };

  const openReminderModal = (medication: MedicationRecord) => {
    setReminderMedication(medication);
    setReminderEnabled(bootstrap.viewer.notificationPreferences.medicationReminders);
    setReminderTime(bootstrap.viewer.notificationPreferences.medicationReminderTime);
    setReminderOpen(true);
  };

  const closeReminderModal = () => {
    setReminderOpen(false);
    setReminderMedication(null);
    setReminderSaving(false);
  };

  const saveReminderSettings = async () => {
    const nextTime = trimmedText(reminderTime);
    if (reminderEnabled && !hasText(nextTime)) {
      toast.error("Please choose a reminder time.");
      return;
    }
    setReminderSaving(true);
    try {
      await request("/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          medicationReminders: reminderEnabled,
          medicationReminderTime: nextTime,
        }),
      });
      toast.success(reminderEnabled ? `Medication reminders are on for ${nextTime}.` : "Medication reminders are turned off.");
      closeReminderModal();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setReminderSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-brandSoft/90 via-emerald-50 to-white" />
          <SectionHeader title="Today's adherence" description="A calmer view of what is done, what is late, and what still needs attention." />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <div className="relative mx-auto h-[280px] w-full max-w-[280px]">
              <DoughnutChart
                data={{
                  labels: todayAdherence.total ? ["Taken", "Missed", "Remaining"] : ["No doses scheduled"],
                  datasets: [
                    {
                      data: todayAdherence.total
                        ? [todayAdherence.taken, todayAdherence.missed, todayAdherence.remaining]
                        : [1],
                      backgroundColor: todayAdherence.total ? ["#0d9488", "#ef4444", "#d1fae5"] : ["#e2e8f0"],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  cutout: "72%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      displayColors: false,
                      backgroundColor: "#0f172a",
                      padding: 12,
                    },
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <Badge tone={adherenceTone(todayAdherence.score)}>{adherenceCopy(todayAdherence.score)}</Badge>
                <p className="mt-4 text-5xl font-black tracking-tight text-textPrimary">{todayAdherence.score}%</p>
                <p className="mt-1 text-sm font-semibold text-textSecondary">
                  {todayAdherence.taken} of {todayAdherence.total} doses logged
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Taken", value: todayAdherence.taken, tone: "success" as const, helper: "Completed today" },
                  { label: "Remaining", value: todayAdherence.remaining, tone: "warning" as const, helper: "Still open" },
                  { label: "Missed", value: todayAdherence.missed, tone: "danger" as const, helper: "Needs follow-up" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[28px] border border-borderColor/70 bg-white/90 p-4 shadow-sm">
                    <Badge tone={item.tone}>{item.label}</Badge>
                    <p className="mt-4 text-3xl font-black text-textPrimary">{item.value}</p>
                    <p className="mt-1 text-sm text-textSecondary">{item.helper}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[28px] border border-borderColor/70 bg-slate-50/80 p-5">
                <div className="flex items-start gap-3">
                  {scoreDelta >= 0 ? (
                    <TrendingUp className="mt-1 h-5 w-5 text-emerald-700" />
                  ) : (
                    <AlertCircle className="mt-1 h-5 w-5 text-amber-700" />
                  )}
                  <div>
                    <p className="font-semibold text-textPrimary">
                      {scoreDelta >= 0 ? `Up ${Math.abs(scoreDelta)} points from yesterday` : `Down ${Math.abs(scoreDelta)} points from yesterday`}
                    </p>
                    <p className="mt-1 text-sm text-textSecondary">
                      {nextPendingDose
                        ? `Next dose window: ${nextPendingDose.medication.name} at ${formatScheduledTime(nextPendingDose.scheduledTime)}.`
                        : "Every scheduled dose has a status for today."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Reminder time",
                    value: bootstrap.viewer.notificationPreferences.medicationReminderTime,
                    helper: bootstrap.viewer.notificationPreferences.medicationReminders ? "Reminders enabled" : "Reminders are off",
                  },
                  { label: "Active meds", value: String(activeMedications.length), helper: "Currently on the plan" },
                  {
                    label: "Today",
                    value: todayAdherence.total ? `${todayAdherence.total} doses` : "Nothing due",
                    helper: "Scheduled windows",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] bg-brandSoft/45 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brandDark/75">{item.label}</p>
                    <p className="mt-2 text-lg font-bold text-textPrimary">{item.value}</p>
                    <p className="mt-1 text-sm text-textSecondary">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 rounded-full bg-brandSoft/60 blur-3xl" />
          <SectionHeader
            title="Weekly adherence"
            description={
              viewerRole === "family_member"
                ? "Recent logged doses in a cleaner weekly view."
                : "A seven-day view that makes the trend easy to scan."
            }
            action={canManageMedications ? <Button onClick={openCreateModal}>Add medication</Button> : undefined}
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="h-[300px] rounded-[28px] border border-borderColor/70 bg-white/90 p-4">
              <BarChart
                data={{
                  labels: weeklySeries.map((item) => item.label),
                  datasets: [
                    {
                      label: "Adherence",
                      data: weeklySeries.map((item) => item.score),
                      borderRadius: 18,
                      backgroundColor: weeklySeries.map((item) =>
                        item.score >= 85 ? "#0d9488" : item.score >= 60 ? "#f59e0b" : "#f97316",
                      ),
                      maxBarThickness: 34,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: "#64748b", font: { weight: 700 } },
                    },
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        stepSize: 20,
                        color: "#64748b",
                        callback: (value) => `${value}%`,
                      },
                      grid: {
                        color: "rgba(148, 163, 184, 0.2)",
                      },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      displayColors: false,
                      backgroundColor: "#0f172a",
                      padding: 12,
                      callbacks: {
                        title: (items) => {
                          const item = weeklySeries[items[0]?.dataIndex ?? 0];
                          return item ? `${item.label} | ${item.dateLabel}` : "Adherence";
                        },
                        label: (item) => `${weeklySeries[item.dataIndex].score}% adherence`,
                        afterLabel: (item) => {
                          const day = weeklySeries[item.dataIndex];
                          return `Taken ${day.taken}/${day.total || 0} logged doses`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>

            <div className="grid gap-3">
              {[
                { label: "Weekly average", value: `${weeklyAverage}%`, helper: "Across the last 7 days" },
                { label: "Best day", value: `${bestDay.label} ${bestDay.score}%`, helper: bestDay.dateLabel || "No recent logs" },
                { label: "Steady days", value: `${steadyDays}/7`, helper: "Days at 80% or higher" },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-borderColor/70 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textSecondary">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-textPrimary">{item.value}</p>
                  <p className="mt-1 text-sm text-textSecondary">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {viewerRole === "family_member" ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-900">Family medication access is intentionally limited.</p>
              <p className="mt-1 text-sm text-amber-900/80">
                You can follow the daily schedule{canLogMedications ? " and log doses you were invited to help with" : ""}, but refill details,
                medication purpose, and interaction analysis stay with caregivers and clinicians.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="rounded-full border border-borderColor bg-white p-1 shadow-sm">
        <div className={availableTabs.length <= 2 ? "flex flex-wrap gap-2" : "flex snap-x gap-2 overflow-x-auto scrollbar-thin"}>
          {availableTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                tab === item ? "bg-brand text-white shadow-calm" : "text-textSecondary hover:bg-slate-50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {tab === "Today's Schedule" ? (
        <Card>
          <SectionHeader title="Today's schedule" description="Log each dose window directly, without losing track of what is still pending." />
          <div className="space-y-4">
            {todaySlots.length === 0 ? (
              <EmptyState
                title="No doses scheduled today"
                description="Once medications are added, each dose window will appear here with quick logging buttons."
              />
            ) : (
              scheduleSections
                .map((section) => ({
                  section,
                  slots: todaySlots.filter((slot) => slot.timeOfDay === section),
                }))
                .filter((group) => group.slots.length > 0)
                .map(({ section, slots }) => (
                  <div key={section} className="rounded-[30px] border border-borderColor/70 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">{scheduleLabels[section]}</p>
                        <p className="mt-1 text-sm text-textSecondary">
                          {slots.length} scheduled dose{slots.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge tone={slots.every((slot) => slot.status === "taken") ? "success" : "warning"}>
                        {slots.filter((slot) => slot.status === "taken").length}/{slots.length} done
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      {slots.map((slot) => {
                        const isLogging = loggingSlotKey === slot.id;
                        return (
                          <div key={slot.id} className="rounded-[26px] border border-borderColor/70 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-lg font-bold text-textPrimary">{slot.medication.name}</p>
                                  <Badge tone={doseStatusTone(slot.status)}>{doseStatusLabel(slot.status)}</Badge>
                                </div>
                                <p className="mt-2 text-sm text-textSecondary">
                                  {slot.medication.doseAmount}
                                  {slot.medication.doseUnit} | {formatScheduledTime(slot.scheduledTime)}
                                </p>
                                <p className="mt-2 text-sm text-textSecondary">
                                  {canSeeMedicationDetails
                                    ? slot.medication.instructions || slot.medication.purpose || "No extra instructions saved."
                                    : "Dose details are simplified in family view."}
                                </p>
                                {slot.log ? (
                                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-textSecondary">
                                    Logged by the care team {slot.log.takenAt ? `at ${formatScheduledTime(slot.log.takenAt)}` : "for follow-up"}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {canLogMedications ? (
                                  <>
                                    <Button
                                      variant={slot.status === "taken" ? "primary" : "secondary"}
                                      onClick={() => void logDose(slot, "taken")}
                                      disabled={isLogging || slot.status === "taken"}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      {slot.status === "taken" ? "Taken" : isLogging ? "Saving..." : "Mark taken"}
                                    </Button>
                                    <Button
                                      variant={slot.status === "missed" ? "danger" : "ghost"}
                                      onClick={() => void logDose(slot, "missed")}
                                      disabled={isLogging || slot.status === "missed"}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      {slot.status === "missed" ? "Missed" : isLogging ? "Saving..." : "Mark missed"}
                                    </Button>
                                  </>
                                ) : viewerRole === "family_member" ? (
                                  <Button variant="ghost" disabled title="Ask the primary caregiver to enable medication logging for this account.">
                                    <Lock className="h-4 w-4" />
                                    Schedule only
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>
      ) : null}

      {tab === "All Medications" ? (
        <Card>
          <SectionHeader
            title="All medications"
            description={
              canSeeMedicationDetails
                ? "Purpose, refill timing, and the details that keep errors down."
                : "Family view shows the schedule and dose only. Clinical and pharmacy details stay hidden."
            }
            action={
              <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full sm:w-[180px]">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </Select>
            }
          />
          <div className="space-y-4">
            {visibleMedications.length === 0 ? (
              <EmptyState
                title="No medications in this filter"
                description="Switch filters or add a medication to start building the care plan."
              />
            ) : visibleMedications.map((medication) => {
              const daysRemaining = Math.ceil((new Date(medication.refillDate).getTime() - Date.now()) / 86400000);
              const actionBusy = updatingMedicationId === medication.id;
              return (
                <div key={medication.id} className="rounded-[30px] border border-borderColor/70 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-textPrimary">
                          {medication.name} {medication.doseAmount}
                          {medication.doseUnit}
                        </p>
                        <Badge tone={medication.isActive ? "brand" : "neutral"}>
                          {medication.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge tone={refillTone(daysRemaining)}>
                          {daysRemaining <= 0 ? "Refill overdue" : `Refill in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`}
                        </Badge>
                      </div>
                      {canSeeMedicationDetails ? (
                        <>
                          <p className="mt-2 text-sm text-textSecondary">{medication.purpose || "No purpose saved yet."}</p>
                          <p className="mt-3 text-sm text-textSecondary">{medication.instructions || "No instructions saved yet."}</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-textSecondary">Caregiver-managed medication details are hidden in family view.</p>
                      )}
                    </div>

                    {canSeeMedicationDetails ? (
                      <div className="space-y-3 lg:min-w-[230px]">
                        <div className="rounded-[24px] bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-textSecondary">Refill date</p>
                          <p className="mt-2 text-lg font-bold text-textPrimary">{formatDate(medication.refillDate)}</p>
                          <div className="mt-3">
                            <ProgressBar value={refillProgress(daysRemaining)} />
                          </div>
                        </div>
                        {canManageMedications ? (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="ghost" onClick={() => openEditModal(medication)} disabled={actionBusy}>
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => void toggleMedicationActive(medication, !medication.isActive)}
                              disabled={actionBusy}
                            >
                              {actionBusy
                                ? "Saving..."
                                : medication.isActive
                                  ? "Deactivate"
                                  : "Reactivate"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {tab === "Interaction Checker" ? (
        <Card>
          <SectionHeader title="Interaction checker" description="Pick any two or more medications and let CareCircle explain the result in plain English." />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div className="space-y-3">
              <div className="rounded-[24px] bg-slate-50 p-4 text-sm text-textSecondary">
                {selectedIds.length === 0
                  ? "Choose at least two medications to compare."
                  : `${selectedIds.length} medication${selectedIds.length === 1 ? "" : "s"} selected.`}
              </div>
              {activeMedications.map((medication) => {
                const selected = selectedIds.includes(medication.id);
                return (
                  <button
                    key={medication.id}
                    type="button"
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      selected ? "border-brand bg-brandSoft" : "border-borderColor bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setInteractionResult(null);
                      setSelectedIds((current) =>
                        current.includes(medication.id)
                          ? current.filter((item) => item !== medication.id)
                          : [...current, medication.id],
                      );
                    }}
                  >
                    <p className="font-semibold text-textPrimary">{medication.name}</p>
                    <p className="mt-1 text-sm text-textSecondary">
                      {medication.doseAmount}
                      {medication.doseUnit}
                    </p>
                  </button>
                );
              })}
              <Button className="w-full" onClick={checkInteractions} disabled={selectedIds.length < 2 || interactionLoading}>
                <Sparkles className="h-4 w-4" />
                {interactionLoading ? "Checking..." : "Check interactions"}
              </Button>
            </div>
            <div className="space-y-3">
              {interactionResult === null ? (
                <div className="rounded-[28px] border border-dashed border-borderColor p-8 text-center text-textSecondary">
                  Select medications, then tap "Check interactions."
                </div>
              ) : interactionResult.length === 0 ? (
                <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
                  <p className="font-semibold">No known issues in this combination.</p>
                  <p className="mt-2 text-sm text-emerald-900/80">
                    CareCircle did not flag a major interaction for the selected medications in this quick check.
                  </p>
                </div>
              ) : (
                interactionResult.map((item) => (
                  <div key={item.title} className="rounded-[28px] border border-borderColor bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.severity === "severe" ? "danger" : item.severity === "moderate" ? "warning" : "success"}>
                        {item.severity}
                      </Badge>
                      <p className="font-bold text-textPrimary">{item.title}</p>
                    </div>
                    <p className="mt-3 text-sm text-textSecondary">{item.explanation}</p>
                    <p className="mt-3 text-sm font-semibold text-brandDark">{item.next_steps}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Refill Tracker" ? (
        <Card>
          <SectionHeader title="Refill tracker" description="Keep refills from turning into emergencies." />
          <div className="space-y-3">
            {activeMedications.length === 0 ? (
              <EmptyState
                title="No refill items yet"
                description="Active medications with refill dates will show up here with pharmacy and reminder actions."
              />
            ) : [...activeMedications]
              .sort((a, b) => a.refillDate.localeCompare(b.refillDate))
              .map((medication) => {
                const daysRemaining = Math.ceil((new Date(medication.refillDate).getTime() - Date.now()) / 86400000);
                const reminderEnabled = bootstrap.viewer.notificationPreferences.medicationReminders;
                const pharmacyPhone = hasText(medication.pharmacyPhone) ? medication.pharmacyPhone.replaceAll(/[^0-9]/g, "") : "";
                return (
                  <div key={medication.id} className="grid gap-3 rounded-[30px] border border-borderColor/70 bg-white p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-textPrimary">{medication.name}</p>
                        <Badge tone={refillTone(daysRemaining)}>
                          {daysRemaining <= 0 ? "Urgent refill" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-textSecondary">{medication.pharmacyName || "Pharmacy not saved yet"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">{formatDate(medication.refillDate)}</p>
                      <div className="mt-2">
                        <ProgressBar value={refillProgress(daysRemaining)} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pharmacyPhone ? (
                        <a href={`tel:${pharmacyPhone}`}>
                          <Button variant="ghost">
                            <Phone className="h-4 w-4" />
                            Call pharmacy
                          </Button>
                        </a>
                      ) : (
                        <Button variant="ghost" disabled>
                          <Phone className="h-4 w-4" />
                          No pharmacy phone
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => openReminderModal(medication)}>
                        <BellRing className="h-4 w-4" />
                        {reminderEnabled ? "Reminder settings" : "Set reminder"}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      ) : null}

      <Modal
        open={modalOpen && canManageMedications}
        title={editingMedicationId ? "Edit medication" : "Add medication"}
        onClose={closeModal}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void handleSave();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
            <Field label="Drug name">
              <Input
                required
                value={form.name}
                placeholder="Example: Lisinopril"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Dose">
              <Input
                required
                value={form.doseAmount}
                placeholder="10"
                onChange={(event) => setForm((current) => ({ ...current, doseAmount: event.target.value }))}
              />
            </Field>
            <Field label="Unit">
              <Select value={form.doseUnit} onChange={(event) => setForm((current) => ({ ...current, doseUnit: event.target.value }))}>
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="mL">mL</option>
                <option value="tablet">tablet</option>
                <option value="capsule">capsule</option>
                <option value="drops">drops</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Frequency" hint="The schedule below updates automatically from this choice.">
              <Select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as typeof current.frequency }))}>
                <option value="once">Once daily</option>
                <option value="twice">Twice daily</option>
                <option value="three_times">Three times daily</option>
                <option value="four_times">Four times daily</option>
                <option value="as_needed">As needed</option>
              </Select>
            </Field>
            <Field label="Refill date">
              <Input
                type="date"
                value={form.refillDate}
                onChange={(event) => setForm((current) => ({ ...current, refillDate: event.target.value }))}
              />
            </Field>
          </div>

          <div className="rounded-[26px] border border-borderColor/70 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textSecondary">Dose schedule preview</p>
            <p className="mt-2 text-sm font-semibold text-textPrimary">
              {form.frequency === "as_needed"
                ? "As-needed medications keep one quick-log window in the schedule."
                : timesOfDayForFrequency(form.frequency).map((timeOfDay) => scheduleLabels[timeOfDay]).join(", ")}
            </p>
          </div>

          <Field label="Purpose">
            <Input
              value={form.purpose}
              placeholder="What is this medication helping with?"
              onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
            />
          </Field>

          <Field label="Instructions">
            <Textarea
              value={form.instructions}
              placeholder="Example: Take with breakfast and a full glass of water."
              onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pharmacy name">
              <Input
                value={form.pharmacyName}
                placeholder="Example: CarePlus Pharmacy"
                onChange={(event) => setForm((current) => ({ ...current, pharmacyName: event.target.value }))}
              />
            </Field>
            <Field label="Pharmacy phone">
              <Input
                value={form.pharmacyPhone}
                placeholder="(555) 123-4567"
                onChange={(event) => setForm((current) => ({ ...current, pharmacyPhone: event.target.value }))}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={saveBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveBusy}>
              {saveBusy ? "Saving..." : editingMedicationId ? "Save changes" : "Save medication"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={reminderOpen && reminderMedication !== null}
        title="Medication reminders"
        onClose={closeReminderModal}
      >
        <div className="space-y-4">
          <div className="rounded-[26px] border border-borderColor/70 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-textPrimary">{reminderMedication?.name}</p>
            <p className="mt-1 text-sm text-textSecondary">
              Choose whether reminders are on, and when the daily medication prompt should arrive.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-[26px] border border-borderColor/70 bg-white p-4">
            <div>
              <p className="font-semibold text-textPrimary">Medication reminders</p>
              <p className="mt-1 text-sm text-textSecondary">
                Turn alerts on so caregivers see the same reminder rhythm each day.
              </p>
            </div>
            <Toggle checked={reminderEnabled} onChange={setReminderEnabled} disabled={reminderSaving} aria-label="Toggle medication reminders" />
          </div>

          <Field
            label="Reminder time"
            hint={reminderEnabled ? "This updates the shared medication reminder time for the signed-in account." : "Turn reminders on to pick a delivery time."}
          >
            <Input type="time" value={reminderTime} disabled={!reminderEnabled || reminderSaving} onChange={(event) => setReminderTime(event.target.value)} />
          </Field>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeReminderModal} disabled={reminderSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveReminderSettings()} disabled={reminderSaving}>
              {reminderSaving ? "Saving..." : "Save reminders"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
