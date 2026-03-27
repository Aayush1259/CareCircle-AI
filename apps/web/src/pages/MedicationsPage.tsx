import { useMemo, useState } from "react";
import { CheckCircle2, Phone, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import type { MedicationRecord } from "@carecircle/shared";
import { BarChart, DoughnutChart } from "@/components/charts";
import { Badge, Button, Card, Field, Input, Modal, ProgressBar, SectionHeader, Select } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

const tabs = ["Today's Schedule", "All Medications", "Interaction Checker", "Refill Tracker"] as const;

export const MedicationsPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Today's Schedule");
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("active");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [interactionResult, setInteractionResult] = useState<Array<{ title: string; severity: string; explanation: string; next_steps: string }> | null>(null);
  const [form, setForm] = useState({
    name: "",
    doseAmount: "",
    doseUnit: "mg",
    frequency: "once",
    purpose: "",
    instructions: "",
    refillDate: "",
    pharmacyName: "",
    pharmacyPhone: "",
  });

  if (!bootstrap) return null;

  const { data, dashboard } = bootstrap;
  const today = new Date().toISOString().slice(0, 10);
  const activeMedications = data.medications.filter((medication) => medication.isActive);
  const visibleMedications =
    filter === "active"
      ? data.medications.filter((item) => item.isActive)
      : filter === "inactive"
        ? data.medications.filter((item) => !item.isActive)
        : data.medications;

  const weeklySeries = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const iso = date.toISOString().slice(0, 10);
      const logs = data.medicationLogs.filter((log) => log.scheduledTime.slice(0, 10) === iso);
      const score = logs.length === 0 ? 0 : Math.round((logs.filter((log) => log.status === "taken").length / logs.length) * 100);
      return {
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        score,
      };
    });
  }, [data.medicationLogs]);

  const handleSave = async () => {
    const name = trimmedText(form.name);
    const doseAmount = trimmedText(form.doseAmount);
    if (!hasText(name) || !hasText(doseAmount)) {
      toast.error("Please enter a medication name and dose before saving.");
      return;
    }

    try {
      await request("/medications", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          name,
          doseAmount,
          purpose: trimmedText(form.purpose),
          instructions: trimmedText(form.instructions),
          refillDate: trimmedText(form.refillDate),
          pharmacyName: trimmedText(form.pharmacyName),
          pharmacyPhone: trimmedText(form.pharmacyPhone),
          timesOfDay: form.frequency === "twice" ? ["morning", "evening"] : ["morning"],
        }),
      });
      toast.success("Medication saved.");
      setModalOpen(false);
      setForm({
        name: "",
        doseAmount: "",
        doseUnit: "mg",
        frequency: "once",
        purpose: "",
        instructions: "",
        refillDate: "",
        pharmacyName: "",
        pharmacyPhone: "",
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const markTaken = async (medicationId: string) => {
    try {
      await request(`/medications/${medicationId}/log`, {
        method: "POST",
        body: JSON.stringify({
          scheduledTime: new Date().toISOString(),
          status: "taken",
        }),
      });
      toast.success("Medication marked as taken.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const checkInteractions = async () => {
    try {
      const result = await request<{ interactions: Array<{ title: string; severity: string; explanation: string; next_steps: string }> }>(
        "/medications/interactions",
        {
          method: "POST",
          body: JSON.stringify({ medicationIds: selectedIds }),
        },
      );
      setInteractionResult(result.interactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const logsToday = data.medicationLogs.filter((log) => log.scheduledTime.slice(0, 10) === today);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[0.8fr,1.2fr]">
        <Card>
          <SectionHeader title="Today's adherence" description="A quick pulse check for today." />
          <div className="mx-auto max-w-[240px]">
            <DoughnutChart
              data={{
                labels: ["Taken", "Remaining"],
                datasets: [
                  {
                    data: [dashboard.medicationProgress.adherenceScore, 100 - dashboard.medicationProgress.adherenceScore],
                    backgroundColor: ["#0d9488", "#d1fae5"],
                    borderWidth: 0,
                  },
                ],
              }}
              options={{ cutout: "72%", plugins: { legend: { display: false } } }}
            />
            <div className="-mt-32 flex h-32 flex-col items-center justify-center">
              <p className="text-4xl font-extrabold text-textPrimary">{dashboard.medicationProgress.adherenceScore}%</p>
              <p className="text-sm font-semibold text-textSecondary">today</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Weekly adherence"
            description="Seven days of progress, so trends stay simple."
            action={<Button onClick={() => setModalOpen(true)}>+ Add Medication</Button>}
          />
          <BarChart
            data={{
              labels: weeklySeries.map((item) => item.label),
              datasets: [
                {
                  label: "Adherence",
                  data: weeklySeries.map((item) => item.score),
                  borderRadius: 18,
                  backgroundColor: "#0d9488",
                },
              ],
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                },
              },
              plugins: {
                legend: { display: false },
              },
            }}
          />
        </Card>
      </div>

      <div className="flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === item ? "bg-brand text-white" : "border border-borderColor bg-white text-textSecondary"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Today's Schedule" ? (
        <Card>
          <SectionHeader title="Today's schedule" description="From morning to bedtime, nothing hidden." />
          <div className="space-y-4">
            {(["morning", "afternoon", "evening", "bedtime"] as const).map((section) => (
              <div key={section}>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">{section}</p>
                <div className="space-y-3">
                  {activeMedications
                    .filter((medication) => medication.timesOfDay.includes(section))
                    .map((medication) => {
                      const log = logsToday.find((item) => item.medicationId === medication.id);
                      return (
                        <div key={medication.id} className="flex flex-col gap-3 rounded-3xl border border-borderColor p-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="h-4 w-4 rounded-full border border-borderColor" style={{ backgroundColor: medication.pillColor === "clear" ? "#e2e8f0" : medication.pillColor }} />
                              <p className="text-lg font-bold text-textPrimary">{medication.name}</p>
                            </div>
                            <p className="mt-1 text-sm text-textSecondary">
                              {medication.doseAmount}
                              {medication.doseUnit} - {medication.instructions}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge tone={log?.status === "taken" ? "success" : log?.status === "missed" ? "danger" : "warning"}>
                              {log?.status === "taken" ? "Taken" : log?.status === "missed" ? "Missed" : "Due soon"}
                            </Badge>
                            <Button variant={log?.status === "taken" ? "secondary" : "primary"} onClick={() => markTaken(medication.id)}>
                              <CheckCircle2 className="h-4 w-4" />
                              Mark taken
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "All Medications" ? (
        <Card>
          <SectionHeader
            title="All medications"
            description="Purpose, refill timing, and the details that keep errors down."
            action={
              <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-[180px]">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </Select>
            }
          />
          <div className="space-y-4">
            {visibleMedications.map((medication) => {
              const refillSoon = Math.ceil((new Date(medication.refillDate).getTime() - Date.now()) / 86400000) < 7;
              return (
                <div key={medication.id} className="rounded-3xl border border-borderColor p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-textPrimary">
                        {medication.name} {medication.doseAmount}
                        {medication.doseUnit}
                      </p>
                      <p className="mt-1 text-sm text-textSecondary">{medication.purpose}</p>
                      <p className="mt-3 text-sm text-textSecondary">{medication.instructions}</p>
                    </div>
                    <div className="space-y-3">
                      <Badge tone={refillSoon ? "warning" : "brand"}>
                        Refill {formatDate(medication.refillDate)}
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="ghost">Edit</Button>
                        <Button variant="secondary">Deactivate</Button>
                      </div>
                    </div>
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
          <div className="grid gap-4 lg:grid-cols-[0.7fr,1.3fr]">
            <div className="space-y-3">
              {activeMedications.map((medication) => {
                const selected = selectedIds.includes(medication.id);
                return (
                  <button
                    key={medication.id}
                    type="button"
                    className={`w-full rounded-3xl border px-4 py-4 text-left ${selected ? "border-brand bg-brandSoft" : "border-borderColor"}`}
                    onClick={() =>
                      setSelectedIds((current) =>
                        current.includes(medication.id)
                          ? current.filter((item) => item !== medication.id)
                          : [...current, medication.id],
                      )
                    }
                  >
                    <p className="font-semibold text-textPrimary">{medication.name}</p>
                    <p className="text-sm text-textSecondary">
                      {medication.doseAmount}
                      {medication.doseUnit}
                    </p>
                  </button>
                );
              })}
              <Button className="w-full" onClick={checkInteractions} disabled={selectedIds.length < 2}>
                <Sparkles className="h-4 w-4" />
                Check interactions
              </Button>
            </div>
            <div className="space-y-3">
              {interactionResult?.map((item) => (
                <div key={item.title} className="rounded-3xl border border-borderColor p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone={item.severity === "severe" ? "danger" : item.severity === "moderate" ? "warning" : "success"}>
                      {item.severity}
                    </Badge>
                    <p className="font-bold text-textPrimary">{item.title}</p>
                  </div>
                  <p className="mt-3 text-sm text-textSecondary">{item.explanation}</p>
                  <p className="mt-3 text-sm font-semibold text-brandDark">{item.next_steps}</p>
                </div>
              )) ?? (
                <div className="rounded-3xl border border-dashed border-borderColor p-8 text-center text-textSecondary">
                  Select medications, then tap "Check interactions."
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Refill Tracker" ? (
        <Card>
          <SectionHeader title="Refill tracker" description="Keep refills from turning into emergencies." />
          <div className="space-y-3">
            {[...activeMedications]
              .sort((a, b) => a.refillDate.localeCompare(b.refillDate))
              .map((medication) => {
                const daysRemaining = Math.ceil((new Date(medication.refillDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={medication.id} className="grid gap-3 rounded-3xl border border-borderColor p-4 lg:grid-cols-[1.4fr,0.7fr,0.9fr] lg:items-center">
                    <div>
                      <p className="font-bold text-textPrimary">{medication.name}</p>
                      <p className="text-sm text-textSecondary">{medication.pharmacyName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">{formatDate(medication.refillDate)}</p>
                      <ProgressBar value={Math.max(5, 100 - daysRemaining * 3)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`tel:${medication.pharmacyPhone.replaceAll(/[^0-9]/g, "")}`}>
                        <Button variant="ghost">
                          <Phone className="h-4 w-4" />
                          Call pharmacy
                        </Button>
                      </a>
                      <Button variant="secondary">Set reminder</Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      ) : null}

      <Modal open={modalOpen} title="Add medication" onClose={() => setModalOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void handleSave();
          }}
        >
          <Field label="Drug name">
            <Input required value={form.name} placeholder="Example: Metformin" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dose">
              <Input required value={form.doseAmount} placeholder="500" onChange={(event) => setForm((current) => ({ ...current, doseAmount: event.target.value }))} />
            </Field>
            <Field label="Unit">
              <Select value={form.doseUnit} onChange={(event) => setForm((current) => ({ ...current, doseUnit: event.target.value }))}>
                <option value="mg">mg</option>
                <option value="ml">ml</option>
                <option value="tablet">tablet</option>
                <option value="drops">drops</option>
              </Select>
            </Field>
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}>
                <option value="once">Once daily</option>
                <option value="twice">Twice daily</option>
              </Select>
            </Field>
          </div>
          <Field label="Purpose">
            <Input value={form.purpose} placeholder="Example: Helps with blood pressure" onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} />
          </Field>
          <Field label="Instructions">
            <Input value={form.instructions} placeholder="Example: Take with food" onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Refill date">
              <Input type="date" value={form.refillDate} onChange={(event) => setForm((current) => ({ ...current, refillDate: event.target.value }))} />
            </Field>
            <Field label="Pharmacy name">
              <Input value={form.pharmacyName} placeholder="Example: Riverside Pharmacy" onChange={(event) => setForm((current) => ({ ...current, pharmacyName: event.target.value }))} />
            </Field>
            <Field label="Pharmacy phone">
              <Input value={form.pharmacyPhone} placeholder="Example: (555) 400-1020" onChange={(event) => setForm((current) => ({ ...current, pharmacyPhone: event.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save medication</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
