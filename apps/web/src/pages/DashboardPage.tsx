import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  HeartPulse,
  Pill,
  RefreshCw,
  Sparkles,
  Users as UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";

const quickActions = [
  { icon: Pill, title: "Log Medication", detail: "Review today’s doses", to: "/medications" },
  { icon: HeartPulse, title: "Journal Entry", detail: "Capture observations", to: "/journal" },
  { icon: FileText, title: "Upload Document", detail: "Add a care record", to: "/documents" },
  { icon: CalendarDays, title: "Appointments", detail: "Prepare for next visits", to: "/appointments" },
  { icon: HeartPulse, title: "Log Vitals", detail: "Record new readings", to: "/vitals" },
  { icon: ClipboardCheck, title: "Add Task", detail: "Assign follow-up work", to: "/tasks" },
] as const;

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
          purpose: medication.purpose,
          instructions: medication.instructions,
        })),
      )
      .sort((left, right) => timeOrder.indexOf(left.time) - timeOrder.indexOf(right.time))
      .slice(0, 3);
  }, [data.medications, logsToday]);

  const upcomingAppointments = useMemo(
    () =>
      [...data.appointments]
        .filter((appointment) => appointment.status === "upcoming")
        .sort(
          (left, right) =>
            `${left.appointmentDate}T${left.appointmentTime}`.localeCompare(`${right.appointmentDate}T${right.appointmentTime}`),
        )
        .slice(0, 2),
    [data.appointments],
  );

  const featuredInsight = data.aiInsights[0] ?? null;
  const secondaryInsights = data.aiInsights.slice(1, 4);
  const recentActivity = data.activityEvents.slice(0, 5);

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
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-['Outfit'] text-[0.72rem] font-bold uppercase tracking-[0.28em] text-brand/70">CareCircle Dashboard</p>
          <h1 className="mt-3 font-['Outfit'] text-[1.55rem] font-extrabold tracking-tight text-textPrimary sm:text-[2.35rem]">
            {greeting}, {viewer.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-2xl text-[0.92rem] leading-6 text-textSecondary sm:text-[0.98rem] sm:leading-7">
            Everything important for {patient.preferredName ?? patient.name} is organized below, from medication timing to appointments and family activity.
          </p>
        </div>

        <div className="glass-panel w-full rounded-[1.45rem] px-4 py-3.5 shadow-premium sm:rounded-[1.8rem] sm:px-5 sm:py-4 lg:w-auto">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-brandSoft text-brandDark sm:h-12 sm:w-12 sm:rounded-2xl">
              <UsersIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-['Outfit'] text-[0.98rem] font-bold text-textPrimary sm:text-base">{patient.preferredName ?? patient.name}</p>
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-textSecondary/75 [overflow-wrap:anywhere] sm:text-[0.72rem] sm:tracking-[0.2em]">
                {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years old • {patient.primaryDiagnosis}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="hero-card-pad relative overflow-hidden border-none bg-[linear-gradient(145deg,#4338ca,#6366f1_45%,#818cf8)] text-white shadow-calm">
        <div className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-white/10 blur-[85px]" />
        <div className="absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-white/12 blur-[95px]" />

        <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6">
          <div className="min-w-0">
            <div className="hero-kicker-row">
              <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md sm:gap-2 sm:px-4 sm:py-2 sm:text-[0.68rem] sm:tracking-[0.22em]">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Daily AI Briefing
              </div>
              <p className="text-[0.9rem] font-semibold text-white/70 sm:text-sm">{dashboard.currentDate}</p>
            </div>

            {briefingLoading ? (
              <div className="mt-8 space-y-4">
                <div className="h-5 w-full animate-pulse rounded-full bg-white/15" />
                <div className="h-5 w-11/12 animate-pulse rounded-full bg-white/15" />
                <div className="h-5 w-4/5 animate-pulse rounded-full bg-white/15" />
              </div>
            ) : (
              <p className="hero-story mt-6 max-w-3xl text-white [overflow-wrap:anywhere] sm:mt-8">
                {briefing}
              </p>
            )}

            <div className="hero-action-row">
              <Button
                variant="secondary"
                className="w-full border border-white/20 bg-white/15 px-4 text-white shadow-xl backdrop-blur-md hover:bg-white/24 sm:w-auto"
                onClick={refreshBriefing}
                disabled={briefingLoading}
              >
                <RefreshCw className={`h-4 w-4 ${briefingLoading ? "animate-spin" : ""}`} />
                {briefingLoading ? "Analyzing..." : "Refresh Insights"}
              </Button>
              <Link to="/journal">
                <Button variant="ghost" className="w-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/16 hover:text-white sm:w-auto">
                  Open Care Journal
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/12 bg-white/12 p-3.5 backdrop-blur-xl sm:rounded-[1.7rem] sm:p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-white/16 font-['Outfit'] text-base font-bold text-white sm:h-11 sm:w-11 sm:rounded-[1.1rem] sm:text-lg">
                {(patient.preferredName ?? patient.name)[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate font-['Outfit'] text-base font-bold text-white sm:text-lg">{patient.preferredName ?? patient.name}</p>
                <p className="truncate text-[0.64rem] font-bold uppercase tracking-[0.16em] text-white/70 sm:text-[0.7rem] sm:tracking-[0.18em]">{patient.primaryDiagnosis}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5">
              {[
                {
                  label: "Medication adherence",
                  value: `${dashboard.medicationProgress.adherenceScore}%`,
                  meta: `${dashboard.medicationProgress.taken}/${dashboard.medicationProgress.total} completed`,
                },
                {
                  label: "Tasks due today",
                  value: `${dashboard.tasksDueToday}`,
                  meta: dashboard.tasksDueToday === 1 ? "1 action still pending" : `${dashboard.tasksDueToday} actions still pending`,
                },
                {
                  label: "Next appointment",
                  value: dashboard.nextAppointment ? formatDate(dashboard.nextAppointment.appointmentDate) : "Not scheduled",
                  meta: dashboard.nextAppointment ? `${dashboard.nextAppointment.doctorName} at ${dashboard.nextAppointment.appointmentTime}` : "Add the next visit to keep the plan visible",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.1rem] border border-white/10 bg-slate-950/10 px-3.5 py-3.5 sm:rounded-[1.35rem] sm:px-4 sm:py-4">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/60 sm:text-[0.65rem] sm:tracking-[0.22em]">{item.label}</p>
                  <p className="mt-2 font-['Outfit'] text-lg font-bold text-white sm:text-xl">{item.value}</p>
                  <p className="mt-1 text-[0.82rem] leading-5 text-white/70 sm:text-sm sm:leading-6">{item.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Pill,
            title: "Meds Today",
            value: `${dashboard.medicationProgress.taken}/${dashboard.medicationProgress.total}`,
            note: "Completed doses",
            tone: "brand" as const,
            progress: dashboard.medicationProgress.adherenceScore,
          },
          {
            icon: CalendarDays,
            title: "Next Appointment",
            value: dashboard.nextAppointment?.doctorName ?? "None scheduled",
            note: dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "Add the next visit to keep it visible.",
            tone: "brand" as const,
          },
          {
            icon: ClipboardCheck,
            title: "Tasks Due",
            value: `${dashboard.tasksDueToday}`,
            note: dashboard.tasksDueToday === 1 ? "One follow-up needs attention." : `${dashboard.tasksDueToday} follow-ups still open.`,
            tone: "warning" as const,
          },
          {
            icon: HeartPulse,
            title: "Latest Journal",
            value: dashboard.lastJournalEntry?.entryTitle ?? "No entries yet",
            note: dashboard.lastJournalEntry ? relativeTime(dashboard.lastJournalEntry.createdAt) : "Log one quick note to start the record.",
            tone: "success" as const,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="mesh-card">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-[1rem] bg-brandSoft p-2.5 text-brandDark sm:rounded-[1.2rem] sm:p-3">
                  <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
                </div>
                <Badge tone={item.tone}>{item.title}</Badge>
              </div>
              <p className="mt-5 font-['Outfit'] text-[1.55rem] font-bold tracking-tight text-textPrimary [overflow-wrap:anywhere] sm:text-[1.8rem]">{item.value}</p>
              <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">{item.note}</p>
              {typeof item.progress === "number" ? (
                <div className="mt-4">
                  <ProgressBar value={item.progress} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="mesh-card">
        <SectionHeader
          title="Quick actions"
          description="Move directly into the most common caregiving tasks without hunting through the app."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map(({ icon: Icon, title, detail, to }) => (
            <Link
              key={title}
              to={to}
              className="group rounded-[1.45rem] border border-slate-200/80 bg-white/88 p-4 shadow-[0_14px_30px_-22px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-premium sm:rounded-[1.7rem] sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-[1rem] bg-brandSoft p-2.5 text-brandDark sm:rounded-[1.15rem] sm:p-3">
                  <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-textSecondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>
              <p className="mt-4 font-['Outfit'] text-lg font-bold text-textPrimary sm:mt-5 sm:text-xl">{title}</p>
              <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">{detail}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title="Today's care rhythm" description="The next medication moments that need action or confirmation today." />
          {nextMedications.length ? (
            <div className="space-y-3">
              {nextMedications.map((item) => (
                <div key={item.id} className="rounded-[1.45rem] border border-slate-200/85 bg-white/88 p-4 sm:rounded-[1.7rem] sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="h-4 w-4 rounded-full border border-borderColor" style={{ backgroundColor: item.pillColor || "#6366f1" }} />
                        <p className="font-['Outfit'] text-lg font-bold text-textPrimary sm:text-xl">{item.name}</p>
                        <Badge tone={item.status === "taken" ? "success" : "warning"}>{item.status === "taken" ? "Completed" : "Due"}</Badge>
                      </div>
                      <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-textSecondary sm:text-sm sm:tracking-[0.16em]">{item.dose} • {item.label}</p>
                      <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                        {item.instructions || item.purpose || "Review this medication window and confirm when it is complete."}
                      </p>
                    </div>
                    <Button className="w-full sm:w-auto" variant={item.status === "taken" ? "secondary" : "primary"} onClick={() => void markTaken(item.medicationId)}>
                      {item.status === "taken" ? "Taken" : "Mark taken"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No doses are scheduled right now" description="As medications are added or logged, the daily rhythm will appear here." />
          )}
          <Link to="/medications" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brandDark">
            View all medications
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <SectionHeader title="Upcoming appointments" description="The next visits to prepare for, with quick access to notes and directions." />
          {upcomingAppointments.length ? (
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-[1.45rem] border border-slate-200/85 bg-white/88 p-4 sm:rounded-[1.7rem] sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-['Outfit'] text-lg font-bold text-textPrimary sm:text-xl">{appointment.doctorName}</p>
                      <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-textSecondary sm:text-sm sm:tracking-[0.16em]">{appointment.specialty}</p>
                    </div>
                    <Badge tone="brand">{appointment.appointmentDate === today ? "Today" : appointment.status}</Badge>
                  </div>
                  <div className="mt-4 rounded-[1.15rem] bg-slate-50 px-4 py-3 ring-1 ring-slate-100 sm:rounded-[1.35rem]">
                    <p className="text-[0.85rem] font-semibold text-textPrimary sm:text-sm">{formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}</p>
                    <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">{appointment.clinicName}</p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`} target="_blank" rel="noreferrer">
                      <Button className="w-full sm:w-auto" variant="ghost">Get directions</Button>
                    </a>
                    <Link to="/appointments">
                      <Button className="w-full sm:w-auto" variant="secondary">Prep notes</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No upcoming appointments" description="Once visits are added, they will appear here with fast access to preparation tools." />
          )}
          <Link to="/appointments" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brandDark">
            View all appointments
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card className="mesh-card">
          <SectionHeader title="Recent AI insights" description="Important patterns and nudges surfaced by CareCircle." />
          {featuredInsight ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="rounded-[1.6rem] bg-gradient-to-br from-brandDark to-brand p-5 text-white shadow-calm sm:rounded-[1.9rem] sm:p-6">
                <div className="flex items-center gap-2 text-white/72">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em]">{featuredInsight.insightType.replace("_", " ")}</p>
                </div>
                <p className="mt-5 font-['Outfit'] text-[1.4rem] font-bold leading-tight sm:mt-6 sm:text-2xl">{featuredInsight.title}</p>
                <p className="mt-4 max-w-xl text-[0.85rem] leading-6 text-white/80 sm:text-sm sm:leading-7">{featuredInsight.body}</p>
              </div>
              <div className="space-y-3">
                {secondaryInsights.length ? (
                  secondaryInsights.map((insight) => (
                    <div key={insight.id} className="rounded-[1.35rem] border border-slate-200/80 bg-white/88 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <div className="flex items-center gap-2 text-brandDark">
                        <CheckCircle2 className="h-4 w-4" />
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-textSecondary">{insight.insightType.replace("_", " ")}</p>
                      </div>
                      <p className="mt-3 font-['Outfit'] text-base font-bold text-textPrimary sm:text-lg">{insight.title}</p>
                      <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">{insight.body}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/88 p-4 sm:rounded-[1.5rem] sm:p-5">
                    <p className="font-['Outfit'] text-base font-bold text-textPrimary sm:text-lg">Insight queue is warming up</p>
                    <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                      Keep logging medications, journal notes, and vitals to surface richer support patterns over time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No insights yet" description="They will appear after a week of logging medications, notes, and vitals." />
          )}
        </Card>

        <Card>
          <SectionHeader title="Recent family activity" description="A clean readout of what everyone has updated recently." />
          {recentActivity.length ? (
            <div className="space-y-3">
              {recentActivity.map((event, index) => (
                <div key={event.id} className="flex gap-3.5 rounded-[1.35rem] border border-slate-200/80 bg-white/88 p-4 sm:gap-4 sm:rounded-[1.55rem] sm:p-5">
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-brandSoft font-['Outfit'] font-bold text-brandDark sm:h-10 sm:w-10 sm:rounded-2xl">
                      {event.actorName[0]}
                    </div>
                    {index !== recentActivity.length - 1 ? <div className="mt-3 h-full w-px bg-slate-200" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9rem] font-semibold leading-6 text-textPrimary sm:text-[0.96rem] sm:leading-7">
                      <span className="font-bold">{event.actorName}</span> {event.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[0.82rem] text-textSecondary sm:text-sm">
                      <Clock3 className="h-4 w-4" />
                      {relativeTime(event.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No family updates yet" description="As caregivers log actions and notes, activity will show up here automatically." />
          )}
        </Card>
      </div>
    </div>
  );
};
