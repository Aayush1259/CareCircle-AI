import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Lock, Phone, Sparkles, TrendingUp, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { MedicationLogRecord, MedicationLogStatus, MedicationRecord, TimeOfDay } from "@carecircle/shared";
import { BarChart, DoughnutChart } from "@/components/charts";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { resolveViewerRole } from "@/lib/roles";
import { hasText, trimmedText } from "@/lib/validation";

const tabs = ["Today's Schedule", "All Medications", "Interaction Checker", "Refill Tracker"] as const;
const mobileTabLabels: Record<(typeof tabs)[number], string> = {
  "Today's Schedule": "Today",
  "All Medications": "All meds",
  "Interaction Checker": "Check",
  "Refill Tracker": "Refills",
};
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

  const logDose = async (slot: (typeof todaySlots)[number], status: MedicationLogStatus) => {
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

  const handleSave = async () => {
    const name = trimmedText(form.name);
    const doseAmount = trimmedText(form.doseAmount);
    if (!hasText(name) || !hasText(doseAmount)) {
      toast.error("Please enter a medication name and dose before saving.");
      return;
    }
    setSaveBusy(true);
    try {
      if (editingMedicationId) {
        await request(`/medications/${editingMedicationId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, name, doseAmount }),
        });
        toast.success("Medication updated.");
      } else {
        await request("/medications", {
          method: "POST",
          body: JSON.stringify({ ...form, name, doseAmount, startDate: today }),
        });
        toast.success("Medication added to the plan.");
      }
      closeModal();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 sm:space-y-7 lg:space-y-10"
    >
      <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="relative overflow-hidden rounded-[1.65rem] border-none bg-gradient-to-br from-brand/90 via-brandDark to-brand/80 px-4 py-4 text-white shadow-premium sm:rounded-[2.2rem] sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="relative z-10">
            <p className="font-['Outfit'] text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/82 sm:text-[0.74rem]">Today's Adherence</p>
            <div className="mt-4 grid gap-4 sm:mt-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
              <div className="relative flex h-20 w-20 items-center justify-center self-start sm:h-24 sm:w-24 lg:h-28 lg:w-28">
                <DoughnutChart
                  data={{
                    labels: todayAdherence.total ? ["Taken", "Missed", "Remaining"] : ["No doses scheduled"],
                    datasets: [
                      {
                        data: todayAdherence.total
                          ? [todayAdherence.taken, todayAdherence.missed, todayAdherence.remaining]
                          : [1],
                        backgroundColor: todayAdherence.total ? ["#ffffff", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"] : ["rgba(255,255,255,0.1)"],
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    cutout: "78%",
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[1.55rem] font-['Outfit'] font-bold sm:text-[1.8rem] lg:text-3xl">{todayAdherence.score}%</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-['Outfit'] text-[1.45rem] font-bold tracking-tight sm:text-[1.8rem] lg:text-[2.2rem]">{adherenceCopy(todayAdherence.score)}</h2>
                  <Badge className="border-white/30 bg-white/20 text-white backdrop-blur-md">{todayAdherence.taken}/{todayAdherence.total} doses</Badge>
                </div>
                <p className="mt-2.5 max-w-lg text-[0.92rem] leading-6 text-white/82 font-['Inter'] sm:mt-3 sm:text-[0.98rem] sm:leading-7">
                  {todayAdherence.score >= 90
                    ? "Ellie is maintaining a near-perfect routine today. Consistency is key for stability."
                    : todayAdherence.score >= 70
                      ? "A productive day for care. Just a few final checks to maintain the trend."
                      : "We're seeing a few missed doses. A gentle reminder or check-in might be helpful."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:mt-6 sm:gap-3">
              {[
                { label: "Status", value: scoreDelta >= 0 ? `+${scoreDelta}%` : `${scoreDelta}%`, helper: "vs Yesterday" },
                { label: "Steady Days", value: String(steadyDays), helper: "This week" },
                { label: "Active Plan", value: String(activeMedications.length), helper: "Medications" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.05rem] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-md sm:rounded-[1.25rem] sm:px-4 sm:py-4">
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/60 sm:text-[0.68rem] sm:tracking-[0.18em]">{item.label}</p>
                  <p className="mt-1.5 text-lg font-bold font-['Outfit'] sm:mt-2 sm:text-xl">{item.value}</p>
                  <p className="mt-0.5 text-[0.68rem] text-white/45 sm:mt-1 sm:text-[0.72rem]">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-brandSoft/20 blur-3xl opacity-50" />
        </Card>

        <Card className="flex flex-col justify-between rounded-[1.65rem] border-white/20 bg-white/40 p-4 shadow-calm backdrop-blur-xl sm:rounded-[2.2rem] sm:p-6">
          <div className="flex items-center justify-between">
            <SectionHeader
              title="Next Dose"
              className="p-0 border-none mb-0"
              titleClassName="font-['Outfit'] text-[1.15rem] sm:text-xl"
            />
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] border border-brand/20 bg-brandSoft/30 text-brand sm:h-11 sm:w-11 sm:rounded-[1.1rem]">
              <BellRing className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-3.5 sm:mt-5">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-textSecondary sm:text-[0.72rem] sm:tracking-[0.18em]">
              {nextPendingDose ? `Due at ${formatScheduledTime(nextPendingDose.scheduledTime)}` : "No doses left today"}
            </p>
            <p className="mt-2.5 font-['Outfit'] text-[1.2rem] font-bold text-textPrimary sm:text-[1.55rem] lg:text-3xl">
              {nextPendingDose
                ? `${nextPendingDose.medication.name} ${nextPendingDose.medication.doseAmount}${nextPendingDose.medication.doseUnit}`
                : "All caught up"}
            </p>
            <p className="mt-2 text-[0.88rem] leading-6 font-medium text-textSecondary sm:text-[0.98rem]">
              {nextPendingDose
                ? nextPendingDose.medication.instructions || nextPendingDose.medication.purpose || "Ready to log the next dose."
                : "Every scheduled dose has already been handled for today."}
            </p>
          </div>
          <div className="mt-5 sm:mt-6">
            <div className="grid gap-3">
              <Button
                className="w-full rounded-[1.1rem] py-3.5 text-[0.92rem] shadow-brand shadow-lg sm:rounded-[1.25rem] sm:py-4 sm:text-base"
                onClick={() => nextPendingDose && void logDose(nextPendingDose, "taken")}
                disabled={!nextPendingDose || !canLogMedications || loggingSlotKey === nextPendingDose.id}
              >
                {nextPendingDose ? "I've taken this" : "No action needed"}
              </Button>
              {canManageMedications ? (
                <Button variant="ghost" className="w-full rounded-[1.1rem] sm:rounded-[1.25rem]" onClick={openCreateModal}>
                  Add medication
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex snap-x gap-2.5 overflow-x-auto pb-3 scrollbar-none sm:gap-4 sm:pb-4">
        {availableTabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-[1.15rem] border px-4 py-3 text-[0.76rem] font-bold transition-all duration-300 sm:rounded-2xl sm:px-8 sm:py-4 sm:text-sm ${
              tab === item
                ? "border-brand bg-brand text-white shadow-brand shadow-lg sm:scale-105"
                : "border-borderColor/50 bg-white text-textSecondary hover:bg-slate-50"
            }`}
          >
            <span className="sm:hidden">{mobileTabLabels[item]}</span>
            <span className="hidden sm:inline">{item}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "Today's Schedule" && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <Card className="rounded-[2rem] p-5 sm:rounded-[2.5rem] sm:p-8">
              <SectionHeader
                title="Today's Schedule"
                titleClassName="responsive-title-lg"
                description="Manage each dose window precisely as the day unfolds."
              />

              <div className="mt-6 space-y-8 sm:mt-8 sm:space-y-12">
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
                      <div key={section} className="relative">
                        <div className="sticky top-0 z-20 mb-5 flex items-center justify-between bg-white/80 py-2 backdrop-blur-md sm:mb-6">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <h3 className="font-['Outfit'] text-xl font-bold text-textPrimary sm:text-2xl">{scheduleLabels[section]}</h3>
                            <Badge tone="neutral" className="bg-slate-100">{slots.length} items</Badge>
                          </div>
                          <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:tracking-widest">{section === 'morning' ? '8:00 AM' : section === 'afternoon' ? '1:00 PM' : section === 'evening' ? '6:00 PM' : '9:00 PM'}</span>
                        </div>

                        <div className="grid gap-4">
                          {slots.map((slot, index) => {
                            const isLogging = loggingSlotKey === slot.id;
                            return (
                              <motion.div
                                key={slot.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group flex flex-col gap-4 rounded-[1.3rem] border border-borderColor bg-white p-4 transition-all duration-300 hover:border-brand hover:shadow-premium sm:flex-row sm:items-center sm:gap-6 sm:rounded-[1.5rem] sm:p-6"
                              >
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] transition-colors sm:h-16 sm:w-16 sm:rounded-[1.25rem] ${
                                  slot.status === 'taken' ? 'bg-success/10 text-success' :
                                  slot.status === 'missed' ? 'bg-danger/10 text-danger' : 'bg-brandSoft text-brand'
                                }`}>
                                  {slot.status === 'taken' ? <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" /> :
                                   slot.status === 'missed' ? <XCircle className="h-7 w-7 sm:h-8 sm:w-8" /> : <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-['Outfit'] text-lg font-bold text-textPrimary sm:text-xl">{slot.medication.name}</p>
                                    <Badge tone={doseStatusTone(slot.status)}>{doseStatusLabel(slot.status)}</Badge>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-textSecondary sm:text-base">
                                    {slot.medication.doseAmount}{slot.medication.doseUnit} | {formatScheduledTime(slot.scheduledTime)}
                                  </p>
                                  <p className="mt-2 text-sm text-textSecondary max-w-md">
                                    {canSeeMedicationDetails
                                      ? slot.medication.instructions || slot.medication.purpose || "Regular dose."
                                      : "Dose details are restricted in family view."}
                                  </p>
                                </div>
                                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                                  {canLogMedications ? (
                                    <>
                                      <Button
                                        variant={slot.status === "taken" ? "primary" : "secondary"}
                                        onClick={() => void logDose(slot, "taken")}
                                        disabled={isLogging || slot.status === "taken"}
                                        className="w-full rounded-[1rem] px-5 sm:w-auto sm:rounded-xl sm:px-6"
                                      >
                                        {slot.status === "taken" ? "Done" : "Take"}
                                      </Button>
                                      {slot.status === "pending" && (
                                        <Button
                                          variant="ghost"
                                          onClick={() => void logDose(slot, "missed")}
                                          disabled={isLogging}
                                          className="w-full rounded-[1rem] border border-slate-100 sm:w-auto sm:rounded-xl"
                                        >
                                          Miss
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <Badge tone="neutral" className="px-4 py-2">View Only</Badge>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {tab === "All Medications" && (
          <motion.div
            key="all-meds"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <Card className="rounded-[2rem] p-5 sm:rounded-[2.5rem] sm:p-8">
              <SectionHeader
                title="Active Medications"
                titleClassName="responsive-title-lg"
                description="The complete baseline for current care."
                action={
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 w-full rounded-xl sm:w-[160px]">
                      <option value="active">Active Plan</option>
                      <option value="inactive">Previous</option>
                      <option value="all">Everything</option>
                    </Select>
                    {canManageMedications && <Button onClick={openCreateModal} className="w-full rounded-xl px-6 sm:w-auto">Add medication</Button>}
                  </div>
                }
              />
              <div className="mt-6 grid gap-4 sm:mt-8">
                {visibleMedications.map((medication, index) => {
                  const daysRemaining = Math.ceil((new Date(medication.refillDate).getTime() - Date.now()) / 86400000);
                  return (
                    <motion.div
                      key={medication.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-[1.5rem] border border-borderColor bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:rounded-[2rem] sm:p-6"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-['Outfit'] text-xl font-bold text-textPrimary sm:text-2xl">{medication.name}</p>
                            <Badge tone={medication.isActive ? "brand" : "neutral"}>{medication.isActive ? "Active" : "Paused"}</Badge>
                            <Badge tone={refillTone(daysRemaining)}>
                              {daysRemaining <= 0 ? "Refill Overdue" : `Refill in ${daysRemaining}d`}
                            </Badge>
                          </div>
                          <p className="mt-2 text-base font-medium text-textSecondary sm:text-lg">{medication.doseAmount}{medication.doseUnit} | {medication.frequency.replace('_', ' ')}</p>
                          {canSeeMedicationDetails && (
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-textSecondary sm:text-base">{medication.purpose || "Supporting general health."}</p>
                          )}
                        </div>

                        <div className="flex w-full flex-col items-stretch gap-4 shrink-0 sm:w-auto sm:flex-row sm:items-center">
                          {canSeeMedicationDetails && (
                            <div className="h-20 w-full rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4 sm:w-[200px] sm:rounded-2xl">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-textSecondary mb-2">Refill Progress</p>
                              <ProgressBar value={refillProgress(daysRemaining)} />
                            </div>
                          )}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {canManageMedications && (
                              <>
                                <Button variant="ghost" onClick={() => openEditModal(medication)} className="w-full rounded-xl border border-slate-100 sm:w-auto">Edit</Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => toggleMedicationActive(medication, !medication.isActive)}
                                  className="w-full rounded-xl sm:w-auto"
                                >
                                  {medication.isActive ? "Pause" : "Resume"}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={modalOpen && canManageMedications} title={editingMedicationId ? "Edit medication" : "Add medication"} onClose={closeModal}>
        <form className="grid gap-6 p-2" onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
          <div className="grid gap-6 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label="Drug name">
              <Input required value={form.name} className="h-12 rounded-xl" placeholder="Example: Donepezil" onChange={(e) => setForm({...form, name: e.target.value})} />
            </Field>
            <Field label="Dose">
              <Input required value={form.doseAmount} className="h-12 rounded-xl" placeholder="10" onChange={(e) => setForm({...form, doseAmount: e.target.value})} />
            </Field>
            <Field label="Unit">
              <Select value={form.doseUnit} className="h-12 rounded-xl" onChange={(e) => setForm({...form, doseUnit: e.target.value})}>
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="mL">mL</option>
                <option value="tablet">tablet</option>
                <option value="capsule">capsule</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Frequency">
              <Select value={form.frequency} className="h-12 rounded-xl" onChange={(e) => setForm({...form, frequency: e.target.value as any})}>
                <option value="once">Once daily</option>
                <option value="twice">Twice daily</option>
                <option value="three_times">Three times daily</option>
                <option value="four_times">Four times daily</option>
                <option value="as_needed">As needed</option>
              </Select>
            </Field>
            <Field label="Refill Date">
              <Input type="date" value={form.refillDate} className="h-12 rounded-xl" onChange={(e) => setForm({...form, refillDate: e.target.value})} />
            </Field>
          </div>
          <Field label="Purpose">
            <Input value={form.purpose} className="h-12 rounded-xl" placeholder="What is this helping with?" onChange={(e) => setForm({...form, purpose: e.target.value})} />
          </Field>
          <Field label="Instructions">
            <Textarea value={form.instructions} className="min-h-[120px] rounded-[1.25rem] p-4" placeholder="Example: Take with breakfast..." onChange={(e) => setForm({...form, instructions: e.target.value})} />
          </Field>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" className="px-8" onClick={closeModal} disabled={saveBusy}>Cancel</Button>
            <Button type="submit" className="px-8" disabled={saveBusy}>{saveBusy ? "Saving..." : editingMedicationId ? "Save changes" : "Save medication"}</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
