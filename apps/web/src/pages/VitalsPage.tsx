import { useMemo, useState } from "react";
import { Activity, Lock, Sparkles, TrendingUp, Heart, Thermometer, Droplets, Weight, Wind, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    const activeColor = "#6366f1";
    const surfaceColor = "rgba(99, 102, 241, 0.05)";

    if (tab === "Blood Pressure") {
      return {
        labels,
        datasets: [
          {
            label: "Systolic",
            data: [...vitals].reverse().map((item) => item.bloodPressureSystolic),
            borderColor: activeColor,
            backgroundColor: surfaceColor,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            borderWidth: 3,
          },
          {
            label: "Diastolic",
            data: [...vitals].reverse().map((item) => item.bloodPressureDiastolic),
            borderColor: "#10b981",
            tension: 0.4,
            pointRadius: 4,
            borderWidth: 2,
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
          borderColor: activeColor,
          backgroundColor: surfaceColor,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          borderWidth: 3,
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
    setIsAnalyzing(true);
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
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 sm:space-y-7 lg:space-y-9"
    >
      {trendOnlyView ? (
        <Card className="relative overflow-hidden rounded-[1.55rem] border-amber-100 bg-amber-50/50 p-4 shadow-sm sm:rounded-[1.85rem] sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-amber-100 text-amber-700 sm:h-11 sm:w-11">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-['Outfit'] text-[1rem] font-bold text-amber-900 sm:text-[1.08rem]">Selective Insight Mode</p>
              <p className="mt-1 max-w-2xl text-[0.86rem] leading-relaxed text-amber-900/70 sm:text-[0.92rem]">
                Exact readings are currently hidden based on the care permissions. You can still monitor consistent logging frequency to ensure the team is maintaining the routine.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Blood Pressure", value: latest?.bloodPressureSystolic ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}` : "--", unit: "mmHg", icon: Activity, tone: "brand" as const, status: "Normal" },
            { label: "Blood Sugar", value: latest?.bloodGlucose ?? "--", unit: "mg/dL", icon: Droplets, tone: "warning" as const, status: "Stable" },
            { label: "Heart Rate", value: latest?.heartRate ?? "--", unit: "bpm", icon: Heart, tone: "success" as const, status: "Resting" },
            { label: "Weight", value: latest?.weight ?? "--", unit: "lbs", icon: Weight, tone: "brand" as const, status: "Steady" },
            { label: "Temperature", value: latest?.temperature ?? "--", unit: "°F", icon: Thermometer, tone: "neutral" as const, status: "Normal" },
            { label: "O2 Saturation", value: latest?.oxygenSaturation ?? "--", unit: "%", icon: Wind, tone: "success" as const, status: "Strong" },
          ].map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="group rounded-[1.55rem] p-4 shadow-calm transition-shadow hover:shadow-md sm:rounded-[1.8rem] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] transition-colors sm:h-12 sm:w-12 ${
                    item.tone === 'brand' ? 'bg-brandSoft text-brand' :
                    item.tone === 'warning' ? 'bg-amber-50 text-amber-600' :
                    item.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    <item.icon className="h-5 w-5 transition-transform group-hover:scale-110 sm:h-5.5 sm:w-5.5" />
                  </div>
                  <Badge tone={item.tone} className="rounded-full px-2.5 py-1 text-[0.54rem] tracking-[0.16em] sm:text-[0.58rem]">{item.status}</Badge>
                </div>
                <div className="mt-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-textSecondary/78 sm:text-[0.74rem]">{item.label}</p>
                  <div className="mt-1.5 flex items-end gap-1.5">
                    <p className="font-['Outfit'] text-[1.8rem] font-bold leading-none text-textPrimary sm:text-[2rem]">{item.value}</p>
                    <span className="pb-1 text-[0.8rem] font-semibold text-textSecondary/58 sm:text-[0.86rem]">{item.unit}</span>
                  </div>
                  <p className="mt-2 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-textSecondary/65 sm:text-[0.68rem]">
                    Last recorded {latest ? formatDate(latest.date) : "N/A"}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.28fr_0.72fr] lg:gap-6">
        <Card className="rounded-[1.8rem] border-none bg-white p-4 shadow-premium sm:rounded-[2.15rem] sm:p-5 lg:p-6">
          <SectionHeader
            title="Biometric Trends"
            titleClassName="responsive-title-lg"
            description="A historical view of progress toward health goals."
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {canViewAiInsights && (
                  <Button variant="secondary" className="w-full rounded-[1rem] border border-brand/10 px-4 sm:w-auto" onClick={analyzeReadings} disabled={isAnalyzing}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isAnalyzing ? "Processing..." : "AI Intelligence"}
                  </Button>
                )}
                {canLogVitals && <Button onClick={() => setModalOpen(true)} className="w-full rounded-[1rem] px-4 sm:w-auto">Log vitals</Button>}
              </div>
            }
          />
          <div className="mt-5 sm:mt-6">
            <div className="flex snap-x gap-2 overflow-x-auto pb-4 scrollbar-none sm:gap-2.5 sm:pb-5">
              {vitalTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`shrink-0 snap-start whitespace-nowrap rounded-full px-3.5 py-2 text-[0.76rem] font-bold transition-all duration-300 sm:px-4 sm:py-2.5 sm:text-[0.82rem] ${
                    tab === item
                      ? "bg-brand text-white shadow-brand shadow-lg"
                      : "border border-slate-100 bg-slate-50 text-textSecondary hover:bg-white hover:shadow-sm"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="relative mt-2 h-[240px] sm:mt-3 sm:h-[290px] lg:h-[320px]">
              <LineChart
                data={chartConfig}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#1e293b',
                      titleFont: { family: 'Outfit', weight: 'bold' },
                      padding: 12,
                      cornerRadius: 12,
                    }
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { weight: 600 } } },
                    y: { border: { dash: [4, 4] }, grid: { color: 'rgba(0,0,0,0.05)' } }
                  }
                }}
              />
            </div>
          </div>
        </Card>

        <div className="space-y-4 sm:space-y-5">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="relative overflow-hidden rounded-[1.6rem] border-none bg-brand p-4 text-white shadow-premium sm:rounded-[1.9rem] sm:p-5">
                  <div className="relative z-10">
                    <div className="mb-4 flex items-center gap-3 sm:mb-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[0.95rem] bg-white/20 backdrop-blur-md sm:h-10 sm:w-10">
                        <Sparkles className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                      </div>
                      <h3 className="font-['Outfit'] text-[1.15rem] font-bold sm:text-[1.3rem]">Health Insight</h3>
                    </div>
                    <p className="font-['Inter'] text-[0.9rem] font-medium leading-relaxed text-white/90 sm:text-[0.95rem]">
                      "{analysis.overall_summary}"
                    </p>
                    <div className="mt-5 space-y-3 sm:mt-6">
                      {analysis.positive_trends.slice(0, 2).map((trend, idx) => (
                        <div key={idx} className="flex gap-3 rounded-[1rem] border border-white/10 bg-white/10 p-3 text-[0.84rem] backdrop-blur-sm sm:text-[0.88rem]">
                          <TrendingUp className="h-4 w-4 shrink-0 text-emerald-300" />
                          <span className="font-medium text-white/90">{trend}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Activity className="absolute -bottom-6 -right-6 h-28 w-28 -rotate-12 text-white/5 sm:h-36 sm:w-36" />
                </Card>
              </motion.div>
            ) : (
              <Card className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.6rem] border-dashed bg-slate-50/50 p-5 text-center sm:min-h-[250px] sm:rounded-[1.9rem]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white shadow-sm sm:h-14 sm:w-14">
                  <Sparkles className="h-6 w-6 text-brand sm:h-7 sm:w-7" />
                </div>
                <h3 className="font-['Outfit'] text-[1.1rem] font-bold text-textPrimary sm:text-[1.2rem]">Contextual Intelligence</h3>
                <p className="mt-2 max-w-xs text-[0.86rem] leading-relaxed text-textSecondary sm:text-[0.9rem]">
                  Connect the dots across weeks of data. Tap "AI Intelligence" to generate a clinical-grade summary of recent trends.
                </p>
              </Card>
            )}
          </AnimatePresence>

          {analysis?.doctor_alerts.length ? (
            <Card className="rounded-[1.6rem] border-red-100 bg-red-50/30 p-4 sm:rounded-[1.9rem] sm:p-5">
              <div className="mb-3 flex items-center gap-3 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-['Outfit'] text-[1rem] font-bold sm:text-[1.05rem]">Watch Areas</h3>
              </div>
              <ul className="space-y-2.5">
                {analysis.doctor_alerts.map((alert, i) => (
                  <li key={i} className="flex gap-2 text-[0.84rem] font-medium leading-relaxed text-red-900/80 sm:text-[0.88rem]">
                    <span className="text-red-300">•</span>
                    {alert}
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="rounded-[1.6rem] border-emerald-100 bg-emerald-50/30 p-4 sm:rounded-[1.9rem] sm:p-5">
              <div className="mb-3 flex items-center gap-3 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-['Outfit'] text-[1rem] font-bold sm:text-[1.05rem]">Stable Baseline</h3>
              </div>
              <p className="text-[0.84rem] font-medium leading-relaxed text-emerald-900/70 sm:text-[0.88rem]">
                No acute variances detected in the latest readings. Ellie's vitals remain within the parameters established by the primary care physician.
              </p>
            </Card>
          )}
        </div>
      </div>

      <Card className="rounded-[1.8rem] border-none bg-white p-4 shadow-calm sm:rounded-[2.15rem] sm:p-5 lg:p-6">
        <SectionHeader
          title="Physician Benchmarks"
          titleClassName="font-['Outfit'] text-[1.25rem] font-bold sm:text-[1.45rem]"
          description="General reference ranges. Always prioritize Ellie's specific clinical targets."
        />
        <div className="mt-5 overflow-x-auto sm:mt-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-textSecondary sm:pb-4 sm:text-[0.66rem]">Vital Metric</th>
                <th className="pb-3 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-textSecondary sm:pb-4 sm:text-[0.66rem]">Target Range</th>
                <th className="pb-3 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-textSecondary sm:pb-4 sm:text-[0.66rem]">Goal Orientation</th>
              </tr>
            </thead>
            <tbody className="text-[0.84rem] font-medium sm:text-[0.9rem]">
              <tr className="border-b border-slate-50">
                <td className="py-4 font-bold text-textPrimary sm:py-5">Blood Pressure</td>
                <td className="py-4 text-textSecondary sm:py-5">Below 130/80 mmHg</td>
                <td className="py-4 sm:py-5"><Badge tone="brand">Consistent Baseline</Badge></td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-4 font-bold text-textPrimary sm:py-5">Blood Sugar (Fasting)</td>
                <td className="py-4 text-textSecondary sm:py-5">80-130 mg/dL</td>
                <td className="py-4 sm:py-5"><Badge tone="success">Optimal Stability</Badge></td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-4 font-bold text-textPrimary sm:py-5">O2 Saturation</td>
                <td className="py-4 text-textSecondary sm:py-5">95% or higher</td>
                <td className="py-4 sm:py-5"><Badge tone="success">Healthy Respiration</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen && canLogVitals} title="Log vitals" onClose={() => setModalOpen(false)}>
        <form className="grid gap-6 p-2" onSubmit={(e) => { e.preventDefault(); void logVitals(); }}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Date">
              <Input required type="date" value={form.date} className="h-12 rounded-xl" onChange={(e) => setForm({...form, date: e.target.value})} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} className="h-12 rounded-xl" onChange={(e) => setForm({...form, time: e.target.value})} />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Blood pressure systolic">
              <Input value={form.bloodPressureSystolic} className="h-12 rounded-xl" placeholder="120" onChange={(e) => setForm({...form, bloodPressureSystolic: e.target.value})} />
            </Field>
            <Field label="Blood pressure diastolic">
              <Input value={form.bloodPressureDiastolic} className="h-12 rounded-xl" placeholder="80" onChange={(e) => setForm({...form, bloodPressureDiastolic: e.target.value})} />
            </Field>
            <Field label="Blood Sugar">
              <Input value={form.bloodGlucose} className="h-12 rounded-xl" placeholder="100" onChange={(e) => setForm({...form, bloodGlucose: e.target.value})} />
            </Field>
            <Field label="Heart rate">
              <Input value={form.heartRate} className="h-12 rounded-xl" placeholder="70" onChange={(e) => setForm({...form, heartRate: e.target.value})} />
            </Field>
            <Field label="Weight">
              <Input value={form.weight} className="h-12 rounded-xl" placeholder="149" onChange={(e) => setForm({...form, weight: e.target.value})} />
            </Field>
            <Field label="Temperature">
              <Input value={form.temperature} className="h-12 rounded-xl" placeholder="98.4" onChange={(e) => setForm({...form, temperature: e.target.value})} />
            </Field>
            <Field label="O2 saturation">
              <Input value={form.oxygenSaturation} className="h-12 rounded-xl" placeholder="98" onChange={(e) => setForm({...form, oxygenSaturation: e.target.value})} />
            </Field>
            <Field label="Pain level">
              <Input value={form.painLevel} className="h-12 rounded-xl" placeholder="0 to 10" onChange={(e) => setForm({...form, painLevel: e.target.value})} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} className="min-h-[100px] rounded-xl" placeholder="E.g. Feeling a bit tired today, or extra water intake..." onChange={(e) => setForm({...form, notes: e.target.value})} />
          </Field>
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button type="button" variant="ghost" className="px-8" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="px-8 shadow-brand/10 shadow-lg">Save</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
