import { Link } from "react-router-dom";
import { CalendarDays, ClipboardCheck, HeartHandshake, MessageCircle, Pill, ShieldAlert } from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

export const FamilyHomePage = () => {
  const { bootstrap } = useAppData();
  if (!bootstrap) return null;

  const { viewer, patient, dashboard, data } = bootstrap;
  const activeTasks = data.tasks.filter((task) => task.status !== "done");
  const upcomingAppointments = data.appointments.slice(0, 2);
  const activity = data.activityEvents.slice(0, 4);
  const messagePreview = data.familyMessages.slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Family view</p>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">A simpler space for helping out.</h1>
        </div>
        <Badge tone="brand">{roleLabel(viewer.role)}</Badge>
      </div>

      <Card className="overflow-hidden bg-gradient-to-r from-brandDark to-brand text-white shadow-calm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Family hub</p>
            <h2 className="mt-2 text-3xl font-bold">{patient.preferredName ?? patient.name}</h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-white/85">
              Keep up with the essentials, share updates, and jump into the spaces that matter most.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/medications" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 py-3 text-[0.95rem] font-semibold text-brandDark shadow-sm transition hover:bg-white/95">
              Medications
            </Link>
            <Link to="/family" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 py-3 text-[0.95rem] font-semibold text-brandDark shadow-sm transition hover:bg-white/95">
              Family chat
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <Pill className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Meds Today</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">
            {dashboard.medicationProgress.taken} of {dashboard.medicationProgress.total}
          </p>
          <p className="mt-1 text-sm text-textSecondary">taken today</p>
          <div className="mt-4">
            <ProgressBar value={dashboard.medicationProgress.adherenceScore} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <ClipboardCheck className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Open tasks</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{activeTasks.length}</p>
          <p className="mt-1 text-sm text-textSecondary">items still in motion</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CalendarDays className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Next visit</span>
          </div>
          <p className="mt-4 text-xl font-bold text-textPrimary">{dashboard.nextAppointment?.doctorName ?? "No visit scheduled"}</p>
          <p className="mt-1 text-sm text-textSecondary">
            {dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "Add a visit when one is booked."}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <HeartHandshake className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Family activity</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{activity.length}</p>
          <p className="mt-1 text-sm text-textSecondary">recent updates</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card>
          <SectionHeader title="What you can do here" description="This view keeps the work focused and easy to scan." />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: MessageCircle, label: "Check family chat", to: "/family" },
              { icon: Pill, label: "Review medications", to: "/medications" },
              { icon: ClipboardCheck, label: "Update tasks", to: "/tasks" },
              { icon: ShieldAlert, label: "Open emergency info", to: "/emergency" },
            ].map(({ icon: Icon, label, to }) => (
              <Link key={label} to={to} className="rounded-3xl border border-borderColor bg-surface p-4 transition hover:bg-brandSoft/35">
                <Icon className="h-5 w-5 text-brandDark" />
                <p className="mt-3 text-base font-semibold text-textPrimary">{label}</p>
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-3xl bg-brandSoft/55 p-4">
            <p className="text-sm font-semibold text-textPrimary">Permissions</p>
            <p className="mt-1 text-sm text-textSecondary">
              Family members can keep up with updates and help where they're invited to help.
            </p>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Recent updates" description="A short timeline of the latest activity." />
          <div className="space-y-3">
            {activity.length ? (
              activity.map((event) => (
                <div key={event.id} className="rounded-3xl border border-borderColor p-4">
                  <p className="font-semibold text-textPrimary">
                    {event.actorName} {event.description}
                  </p>
                  <p className="mt-1 text-sm text-textSecondary">{relativeTime(event.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Nothing recent" description="Once people start logging updates, they'll show up here." />
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-borderColor p-4">
            <p className="font-semibold text-textPrimary">Family messages</p>
            <div className="mt-3 space-y-3">
              {messagePreview.length ? (
                messagePreview.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-textPrimary">{message.userName}</p>
                    <p className="mt-1 text-sm text-textSecondary">{message.messageText}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-textSecondary">No family messages yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Upcoming appointments" description="The next check-ins are easy to prepare for." />
        <div className="grid gap-3 lg:grid-cols-2">
          {upcomingAppointments.map((appointment) => (
            <div key={appointment.id} className="rounded-3xl border border-borderColor p-4">
              <p className="font-bold text-textPrimary">{appointment.doctorName}</p>
              <p className="text-sm text-textSecondary">{appointment.specialty}</p>
              <p className="mt-2 text-sm text-textPrimary">
                {formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}
              </p>
              <p className="mt-1 text-sm text-textSecondary">{appointment.clinicName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-borderColor bg-surface px-4 py-3 text-[0.95rem] font-semibold text-textPrimary shadow-sm transition hover:bg-slate-50"
                >
                  Get Directions
                </a>
                <Link to="/appointments" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brandSoft px-4 py-3 text-[0.95rem] font-semibold text-brandDark shadow-sm transition hover:bg-brandSoft/80">
                  Prep notes
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
