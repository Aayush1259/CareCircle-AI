import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Pill,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";

const quickActions = [
  { icon: Pill, title: "Log Medication", to: "/medications" },
  { icon: HeartPulse, title: "Journal Entry", to: "/journal" },
  { icon: FileText, title: "Upload Doc", to: "/documents" },
  { icon: CalendarDays, title: "Appointment", to: "/appointments" },
  { icon: HeartPulse, title: "Log Vitals", to: "/vitals" },
  { icon: ClipboardCheck, title: "Add Task", to: "/tasks" },
];

const timeLabels = {
  morning: "8:00 AM",
  afternoon: "12:00 PM",
  evening: "6:00 PM",
  bedtime: "9:00 PM",
} as const;

const timeOrder = ["morning", "afternoon", "evening", "bedtime"] as const;

export const DashboardPage = () => {
  const { bootstrap, refresh, request } = useAppData();
  const [briefing, setBriefing] = useState(bootstrap?.dashboard.dailyBriefing ?? "");
  const [briefingLoading, setBriefingLoading] = useState(false);

  if (!bootstrap) return null;

  const { dashboard, data, patient, viewer } = bootstrap;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const refreshBriefing = async () => {
    try {
      setBriefingLoading(true);
      const response = await request<{ briefing: string }>("/dashboard/briefing", { method: "POST" });
      setBriefing(response.briefing);
      toast.success("Today's briefing is refreshed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not refresh the briefing.");
    } finally {
      setBriefingLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const logsToday = data.medicationLogs.filter((log) => log.scheduledTime.slice(0, 10) === today);
  const nextMedications = useMemo(() => {
    return data.medications
      .filter((medication) => medication.isActive)
      .flatMap((medication) =>
        medication.timesOfDay.map((time) => ({
          id: `${medication.id}-${time}`,
          medicationId: medication.id,
          name: medication.name,
          dose: `${medication.doseAmount}${medication.doseUnit}`,
          time,
          label: timeLabels[time],
          status: logsToday.find((log) => log.medicationId === medication.id)?.status ?? "due",
          pillColor: medication.pillColor,
        })),
      )
      .sort((left, right) => timeOrder.indexOf(left.time) - timeOrder.indexOf(right.time))
      .slice(0, 3);
  }, [data.medications, logsToday]);

  const markTaken = async (medicationId: string) => {
    try {
      await request(`/medications/${medicationId}/log`, {
        method: "POST",
        body: JSON.stringify({ scheduledTime: new Date().toISOString(), status: "taken" }),
      });
      toast.success("Medication marked as taken.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">CareCircle Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-textPrimary">{greeting}, {viewer.name.split(" ")[0]}.</h1>
        </div>
        <div className="rounded-full bg-brandSoft px-4 py-2 text-sm font-semibold text-brandDark">
          {patient.preferredName ?? patient.name} - {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years old
        </div>
      </div>

      <Card className="overflow-hidden bg-gradient-to-r from-brandDark to-brand text-white shadow-calm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">AI Briefing</p>
            <p className="mt-1 text-sm text-white/75">{dashboard.currentDate}</p>
            {briefingLoading ? (
              <div className="mt-5 space-y-3">
                <div className="h-4 w-full rounded-full bg-white/20" />
                <div className="h-4 w-11/12 rounded-full bg-white/20" />
                <div className="h-4 w-4/5 rounded-full bg-white/20" />
              </div>
            ) : (
              <p className="mt-5 text-lg leading-8 text-white/90 [overflow-wrap:anywhere]">{briefing}</p>
            )}
          </div>
          <Button variant="secondary" className="shrink-0 bg-white text-brandDark hover:bg-white/90" onClick={refreshBriefing} disabled={briefingLoading}>
            <RefreshCw className={`h-4 w-4 ${briefingLoading ? "animate-spin" : ""}`} />
            {briefingLoading ? "Asking our AI..." : "Refresh"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <Pill className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Meds Today</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{dashboard.medicationProgress.taken} of {dashboard.medicationProgress.total}</p>
          <p className="mt-1 text-sm text-textSecondary">taken today</p>
          <div className="mt-4">
            <ProgressBar value={dashboard.medicationProgress.adherenceScore} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CalendarDays className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Next Appointment</span>
          </div>
          <p className="mt-4 text-xl font-bold text-textPrimary">{dashboard.nextAppointment?.doctorName ?? "None scheduled"}</p>
          <p className="mt-1 text-sm text-textSecondary">
            {dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "Add the next visit so it stays easy to track."}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <ClipboardCheck className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Tasks Due</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{dashboard.tasksDueToday}</p>
          <p className="mt-1 text-sm text-textSecondary">due today</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <HeartPulse className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Last Journal</span>
          </div>
          <p className="mt-4 text-xl font-bold text-textPrimary">{dashboard.lastJournalEntry?.entryTitle ?? "No entries yet"}</p>
          <p className="mt-1 text-sm text-textSecondary">{dashboard.lastJournalEntry ? relativeTime(dashboard.lastJournalEntry.createdAt) : "Log one quick note today."}</p>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Quick actions" description="Every common caregiving task is one tap away." />
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {quickActions.map(({ icon: Icon, title, to }) => (
            <Link key={title} to={to} className="min-w-[150px] shrink-0 snap-start rounded-3xl border border-borderColor bg-surface p-4 text-center transition hover:border-brand hover:bg-brandSoft/30">
              <Icon className="mx-auto h-6 w-6 text-brandDark" />
              <p className="mt-3 text-base font-semibold text-textPrimary">{title}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title="Today's med schedule" description="The next medication moments that matter most right now." />
          <div className="space-y-3">
            {nextMedications.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-3xl border border-borderColor p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded-full border border-borderColor" style={{ backgroundColor: item.pillColor || "#0D9488" }} />
                  <div>
                    <p className="font-semibold text-textPrimary">{item.name}</p>
                    <p className="text-sm text-textSecondary">{item.dose} - due {item.label}</p>
                  </div>
                </div>
                <Button variant={item.status === "taken" ? "secondary" : "primary"} onClick={() => void markTaken(item.medicationId)}>
                  {item.status === "taken" ? "Taken" : "Mark Taken"}
                </Button>
              </div>
            ))}
          </div>
          <Link to="/medications" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brandDark">
            View all medications
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <SectionHeader title="Upcoming appointments" description="The next visits to prepare for." />
          <div className="space-y-3">
            {data.appointments.slice(0, 2).map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-borderColor p-4">
                <p className="font-bold text-textPrimary">{appointment.doctorName}</p>
                <p className="text-sm text-textSecondary">{appointment.specialty}</p>
                <p className="mt-2 text-sm text-textPrimary">
                  {formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}
                </p>
                <p className="mt-1 text-sm text-textSecondary">{appointment.clinicName}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`} target="_blank" rel="noreferrer">
                    <Button variant="ghost">Get Directions</Button>
                  </a>
                  <Link to="/appointments">
                    <Button variant="secondary">Prep Notes</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <Link to="/appointments" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brandDark">
            View all appointments
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <SectionHeader title="Recent AI insights" description="Patterns and nudges CareCircle has noticed." />
          {data.aiInsights.length ? (
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {data.aiInsights.map((insight) => (
                <div key={insight.id} className="min-w-[260px] snap-start rounded-3xl border border-borderColor bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brandDark" />
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-textSecondary">{insight.insightType.replace("_", " ")}</p>
                  </div>
                  <p className="mt-3 text-lg font-bold text-textPrimary">{insight.title}</p>
                  <p className="mt-2 text-sm text-textSecondary">{insight.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No insights yet" description="They will appear after a week of logging medications, notes, and vitals." />
          )}
        </Card>

        <Card>
          <SectionHeader title="Recent family activity" description="Everyone stays on the same page without extra texting." />
          <div className="space-y-3">
            {data.activityEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-3xl border border-borderColor p-4">
                <p className="font-semibold text-textPrimary">{event.actorName} {event.description}</p>
                <p className="mt-1 text-sm text-textSecondary">{relativeTime(event.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
