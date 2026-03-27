import { useMemo, useState } from "react";
import { Activity, Lock, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { LineChart } from "@/components/charts";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { resolveViewerRole } from "@/lib/roles";
import { hasText, parseNumberInput, trimmedText } from "@/lib/validation";

const vitalTabs = ["Blood Pressure", "Blood Sugar", "Heart Rate", "Weight", "Temperature"] as const;

export const VitalsPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [tab, setTab] = useState<(typeof vitalTabs)[number]>("Blood Pressure");
  const [modalOpen, setModalOpen] = useState(false);
  const [analysis, setAnalysis] = useState<{
    overall_summary: string;
    vital_by_vital_analysis: string[];
    doctor_alerts: string[];
    positive_trends: string[];
  } | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    heartRate: "",
    bloodGlucose: "",
    weight: "",
    temperature: "",
    oxygenSaturation: "",
    painLevel: "",
    notes: "",
  });

  if (!bootstrap) return null;

  const viewerRole = resolveViewerRole(bootstrap.viewer.role, bootstrap.viewerAccess?.accessRole);
  const capabilities =
    bootstrap.capabilities ??
    (viewerRole === "family_member"
      ? ["view_vitals"]
      : ["log_vitals", "view_ai_insights"]);
  const canLogVitals = capabilities.includes("log_vitals");
  const canViewAiInsights = capabilities.includes("view_ai_insights");
  const canViewRawVitals = bootstrap.permissions?.canViewVitalsRaw ?? false;
  const trendOnlyView = viewerRole === "family_member" && !canViewRawVitals;
  const vitals = bootstrap.data.healthVitals;
  const latest = vitals[0];

  const chartConfig = useMemo(() => {
    const labels = [...vitals].reverse().map((item) => formatDate(item.date));
    if (tab === "Blood Pressure") {
      return {
        labels,
        datasets: [
          {
            label: "Systolic",
            data: [...vitals].reverse().map((item) => item.bloodPressureSystolic),
            borderColor: "#0d9488",
            backgroundColor: "rgba(13, 148, 136, 0.08)",
            fill: true,
          },
          {
            label: "Diastolic",
            data: [...vitals].reverse().map((item) => item.bloodPressureDiastolic),
            borderColor: "#2563eb",
          },
        ],
      };
    }
    const keyMap = {
      "Blood Sugar": "bloodGlucose",
      "Heart Rate": "heartRate",
      Weight: "weight",
      Temperature: "temperature",
    } as const;
    const key = keyMap[tab];
    return {
      labels,
      datasets: [
        {
          label: tab,
          data: [...vitals].reverse().map((item) => item[key]),
          borderColor: "#0d9488",
          backgroundColor: "rgba(13, 148, 136, 0.08)",
          fill: true,
        },
      ],
    };
  }, [tab, vitals]);

  const logVitals = async () => {
    const date = trimmedText(form.date);
    const notes = trimmedText(form.notes);
    const payload = {
      date,
      time: trimmedText(form.time),
      bloodPressureSystolic: parseNumberInput(form.bloodPressureSystolic),
      bloodPressureDiastolic: parseNumberInput(form.bloodPressureDiastolic),
      heartRate: parseNumberInput(form.heartRate),
      bloodGlucose: parseNumberInput(form.bloodGlucose),
      weight: parseNumberInput(form.weight),
      temperature: parseNumberInput(form.temperature),
      oxygenSaturation: parseNumberInput(form.oxygenSaturation),
      painLevel: parseNumberInput(form.painLevel),
      notes,
    };
    const hasAnyReading = [
      payload.bloodPressureSystolic,
      payload.bloodPressureDiastolic,
      payload.heartRate,
      payload.bloodGlucose,
      payload.weight,
      payload.temperature,
      payload.oxygenSaturation,
      payload.painLevel,
    ].some((value) => value !== undefined);

    if (!hasText(date) || (!hasAnyReading && !hasText(notes))) {
      toast.error("Please add the date and at least one reading or note before saving.");
      return;
    }

    try {
      await request("/vitals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Vitals saved.");
      setModalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const analyzeReadings = async () => {
    try {
      const result = await request<{
        overall_summary: string;
        vital_by_vital_analysis: string[];
        doctor_alerts: string[];
        positive_trends: string[];
      }>("/vitals/analyze", {
        method: "POST",
      });
      setAnalysis(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {trendOnlyView ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-900">This account has trend-only vitals access.</p>
              <p className="mt-1 text-sm text-amber-900/80">
                Exact readings stay hidden until the primary caregiver enables raw vitals. You can still see when readings were logged and whether the care team is keeping up.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Blood Pressure", value: `${latest?.bloodPressureSystolic}/${latest?.bloodPressureDiastolic}`, detail: formatDate(latest?.date), tone: "brand" as const },
            { label: "Blood Sugar", value: latest?.bloodGlucose, detail: `${formatDate(latest?.date)} | mg/dL`, tone: "warning" as const },
            { label: "Heart Rate", value: latest?.heartRate, detail: `${formatDate(latest?.date)} | bpm`, tone: "success" as const },
            { label: "Weight", value: latest?.weight, detail: `${formatDate(latest?.date)} | lbs`, tone: "brand" as const },
            { label: "Temperature", value: latest?.temperature, detail: `${formatDate(latest?.date)} | F`, tone: "neutral" as const },
            { label: "O2 Saturation", value: latest?.oxygenSaturation, detail: `${formatDate(latest?.date)} | %`, tone: "success" as const },
          ].map((item) => (
            <Card key={item.label}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-textSecondary">{item.label}</p>
                <Badge tone={item.tone === "neutral" ? "neutral" : item.tone}>{item.tone === "warning" ? "Watch" : "Steady"}</Badge>
              </div>
              <p className="mt-3 text-3xl font-bold text-textPrimary">{item.value ?? "--"}</p>
              <p className="mt-1 text-sm text-textSecondary">{item.detail}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <SectionHeader
          title="Trend charts"
          description={
            trendOnlyView
              ? "This role can only confirm that vitals were logged, not see exact values."
              : "Normal-looking trends are shaded in soft color so they are easy to scan."
          }
          action={
            <div className="flex flex-wrap gap-2">
              {canViewAiInsights ? (
                <Button variant="secondary" onClick={analyzeReadings}>
                  <Sparkles className="h-4 w-4" />
                  Analyze my readings
                </Button>
              ) : null}
              {canLogVitals ? <Button onClick={() => setModalOpen(true)}>Log vitals</Button> : null}
            </div>
          }
        />
        {trendOnlyView ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-borderColor bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-textSecondary">Recent readings</p>
              <p className="mt-3 text-3xl font-bold text-textPrimary">{vitals.length}</p>
              <p className="mt-1 text-sm text-textSecondary">entries logged for the active patient</p>
            </div>
            <div className="rounded-3xl border border-borderColor bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-textSecondary">Last reading</p>
              <p className="mt-3 text-2xl font-bold text-textPrimary">{latest ? formatDate(latest.date) : "--"}</p>
              <p className="mt-1 text-sm text-textSecondary">Exact values remain private in this view</p>
            </div>
            <div className="rounded-3xl border border-borderColor bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-textSecondary">What you can do</p>
              <p className="mt-3 text-sm text-textSecondary">
                Watch for new readings to appear here and ask the primary caregiver if you need exact numbers enabled.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {vitalTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === item ? "bg-brand text-white" : "border border-borderColor bg-surface text-textSecondary transition hover:bg-slate-50"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <LineChart
              data={chartConfig}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "bottom" },
                },
              }}
            />
          </>
        )}
      </Card>

      {canViewAiInsights && analysis ? (
        <Card>
          <SectionHeader title="AI vitals analysis" description="Plain-language trends, without alarm unless something truly stands out." />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-brandSoft p-5">
              <p className="font-semibold text-textPrimary">Overall summary</p>
              <p className="mt-3 text-textSecondary">{analysis.overall_summary}</p>
            </div>
            <div className="rounded-3xl bg-red-50 p-5">
              <p className="font-semibold text-red-700">What the doctor should know</p>
              <ul className="mt-3 space-y-2 text-sm text-red-700/80">
                {analysis.doctor_alerts.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-borderColor p-5">
              <p className="font-semibold text-textPrimary">Vital-by-vital notes</p>
              <ul className="mt-3 space-y-2 text-sm text-textSecondary">
                {analysis.vital_by_vital_analysis.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-800">Positive trends</p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-800/80">
                {analysis.positive_trends.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      {!trendOnlyView ? (
        <Card>
          <SectionHeader
            title="Normal range reference"
            description="A calm reminder of what most common ranges usually look like."
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-textSecondary">
                  <th className="pb-3 pr-4">Vital</th>
                  <th className="pb-3 pr-4">Typical range</th>
                  <th className="pb-3 pr-4">Note</th>
                </tr>
              </thead>
              <tbody className="text-textPrimary">
                <tr><td className="py-2 pr-4">Blood pressure</td><td className="py-2 pr-4">Below 130/80 is often a common goal</td><td className="py-2 pr-4">Follow the doctor's target for Ellie.</td></tr>
                <tr><td className="py-2 pr-4">Blood sugar</td><td className="py-2 pr-4">Often 80-180 mg/dL depending on timing</td><td className="py-2 pr-4">Targets vary by age and health conditions.</td></tr>
                <tr><td className="py-2 pr-4">O2 saturation</td><td className="py-2 pr-4">95% or higher</td><td className="py-2 pr-4">Lower numbers can need attention.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Modal open={modalOpen && canLogVitals} title="Log vitals" onClose={() => setModalOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void logVitals();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood pressure systolic">
              <Input value={form.bloodPressureSystolic} placeholder="Example: 128" onChange={(event) => setForm((current) => ({ ...current, bloodPressureSystolic: event.target.value }))} />
            </Field>
            <Field label="Blood pressure diastolic">
              <Input value={form.bloodPressureDiastolic} placeholder="Example: 76" onChange={(event) => setForm((current) => ({ ...current, bloodPressureDiastolic: event.target.value }))} />
            </Field>
            <Field label="Blood sugar">
              <Input value={form.bloodGlucose} placeholder="Example: 124" onChange={(event) => setForm((current) => ({ ...current, bloodGlucose: event.target.value }))} />
            </Field>
            <Field label="Heart rate">
              <Input value={form.heartRate} placeholder="Example: 72" onChange={(event) => setForm((current) => ({ ...current, heartRate: event.target.value }))} />
            </Field>
            <Field label="Weight">
              <Input value={form.weight} placeholder="Example: 149" onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} />
            </Field>
            <Field label="Temperature">
              <Input value={form.temperature} placeholder="Example: 98.4" onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} />
            </Field>
            <Field label="O2 saturation">
              <Input value={form.oxygenSaturation} placeholder="Example: 98" onChange={(event) => setForm((current) => ({ ...current, oxygenSaturation: event.target.value }))} />
            </Field>
            <Field label="Pain level">
              <Input value={form.painLevel} placeholder="0 to 10" onChange={(event) => setForm((current) => ({ ...current, painLevel: event.target.value }))} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} placeholder="Anything else you want to remember about this reading?" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">
              <Activity className="h-4 w-4" />
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
