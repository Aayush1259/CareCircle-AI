import { Link } from "react-router-dom";
import { CalendarDays, ClipboardCheck, HeartHandshake, MessageCircle, Pill, ShieldAlert } from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";
import { resolveViewerRole, roleLabel } from "@/lib/roles";

export const FamilyHomePage = () => {
  const { bootstrap } = useAppData();
  if (!bootstrap) return null;

  const { viewer, patient, dashboard, data } = bootstrap;
  const viewerRole = resolveViewerRole(viewer.role, bootstrap.viewerAccess?.accessRole);
  const permissions = bootstrap.permissions;
  const activeTasks = data.tasks.filter((task) => task.status !== "done");
  const upcomingAppointments = data.appointments.slice(0, 2);
  const activity = data.activityEvents.slice(0, 4);
  const messagePreview = data.familyMessages.slice(0, 2);
  const permissionTier = bootstrap.viewerAccess?.accessLevel.replaceAll("_", " ") ?? "view only";
  const quickLinks = [
    permissions?.canViewFamily ? { icon: MessageCircle, label: "Check family chat", to: "/family" } : null,
    permissions?.canViewMedications ? { icon: Pill, label: permissions.canLogMedications ? "Log medications" : "Review medications", to: "/medications" } : null,
    permissions?.canViewTasks ? { icon: ClipboardCheck, label: permissions.canCompleteTasks ? "Update tasks" : "View tasks", to: "/tasks" } : null,
    permissions?.canViewEmergency ? { icon: ShieldAlert, label: "Open emergency info", to: "/emergency" } : null,
  ].filter(Boolean) as Array<{ icon: typeof MessageCircle; label: string; to: string }>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <p className="eyebrow">Family view</p>
          <h1 className="responsive-title-lg mt-2 text-textPrimary">A simpler space for helping out.</h1>
        </div>
        <Badge tone="brand">{roleLabel(viewerRole)}</Badge>
      </div>

      <Card className="hero-shell hero-card-pad overflow-hidden text-white shadow-calm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="glass-chip border-white/15 bg-white/12 text-white/82">Family hub</span>
            <h2 className="hero-headline mt-4">{patient.preferredName ?? patient.name}</h2>
            <p className="hero-body-copy mt-3 max-w-2xl text-white/84">
              Keep up with the essentials, share updates, and jump into the spaces that matter most.
            </p>
          </div>
          <div className="hero-action-row w-full sm:w-auto lg:max-w-md lg:justify-end">
            <Link to="/medications" className="glass-panel inline-flex min-h-[46px] items-center justify-center rounded-[1.35rem] px-4 py-3 text-[0.92rem] font-semibold text-brandDark transition hover:bg-white/92 sm:min-h-[50px] sm:w-auto sm:text-[0.95rem]">
              Medications
            </Link>
            <Link to="/family" className="glass-panel inline-flex min-h-[46px] items-center justify-center rounded-[1.35rem] px-4 py-3 text-[0.92rem] font-semibold text-brandDark transition hover:bg-white/92 sm:min-h-[50px] sm:w-auto sm:text-[0.95rem]">
              Family chat
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <Pill className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Meds today</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-textPrimary sm:text-3xl">
            {dashboard.medicationProgress.taken} of {dashboard.medicationProgress.total}
          </p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">taken today</p>
          <div className="mt-4">
            <ProgressBar value={dashboard.medicationProgress.adherenceScore} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <ClipboardCheck className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Open tasks</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-textPrimary sm:text-3xl">{activeTasks.length}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">items still in motion</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CalendarDays className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Next visit</span>
          </div>
          <p className="mt-4 text-lg font-bold text-textPrimary sm:text-xl">{dashboard.nextAppointment?.doctorName ?? "No visit scheduled"}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">
            {dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "Add a visit when one is booked."}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <HeartHandshake className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Family activity</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-textPrimary sm:text-3xl">{activity.length}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">recent updates</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card>
          <SectionHeader title="What you can do here" description="This view keeps the work focused and easy to scan." />
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map(({ icon: Icon, label, to }) => (
              <Link key={label} to={to} className="os-shell-soft rounded-[1.6rem] p-4 transition hover:bg-brandSoft/35 sm:rounded-[2rem] sm:p-5">
                <Icon className="h-5 w-5 text-brandDark" />
                <p className="mt-3 text-[0.95rem] font-semibold text-textPrimary sm:text-base">{label}</p>
              </Link>
            ))}
          </div>
          <div className="section-well mt-5 rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-textPrimary sm:text-sm sm:normal-case sm:tracking-normal">Permissions</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-textSecondary sm:text-sm">
              You currently have {permissionTier} access for this patient, so CareCircle only shows the spaces you are invited to use.
            </p>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Recent updates" description="A short timeline of the latest activity." />
          <div className="space-y-3">
            {activity.length ? (
              activity.map((event) => (
                <div key={event.id} className="rounded-[1.6rem] border border-borderColor/80 p-4 sm:rounded-[2rem] sm:p-5">
                  <p className="text-[0.95rem] font-semibold leading-6 text-textPrimary sm:text-base">
                    {event.actorName} {event.description}
                  </p>
                  <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">{relativeTime(event.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Nothing recent" description="Once people start logging updates, they'll show up here." />
            )}
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-borderColor/80 p-4 sm:rounded-[2rem] sm:p-5">
            <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Family messages</p>
            <div className="mt-3 space-y-3">
              {messagePreview.length ? (
                messagePreview.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[0.85rem] font-semibold text-textPrimary sm:text-sm">{message.userName}</p>
                    <p className="mt-1 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">{message.messageText}</p>
                  </div>
                ))
              ) : (
                <p className="text-[0.85rem] text-textSecondary sm:text-sm">No family messages yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Upcoming appointments" description="The next check-ins are easy to prepare for." />
        <div className="grid gap-3 lg:grid-cols-2">
          {upcomingAppointments.map((appointment) => (
            <div key={appointment.id} className="rounded-[1.6rem] border border-borderColor/80 p-4 sm:rounded-[2rem] sm:p-5">
              <p className="text-[0.98rem] font-bold text-textPrimary sm:text-lg">{appointment.doctorName}</p>
              <p className="text-[0.85rem] text-textSecondary sm:text-sm">{appointment.specialty}</p>
              <p className="mt-2 text-[0.88rem] text-textPrimary sm:text-sm">
                {formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}
              </p>
              <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">{appointment.clinicName}</p>
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-[1.2rem] border border-borderColor bg-surface px-4 py-3 text-[0.9rem] font-semibold text-textPrimary shadow-sm transition hover:bg-slate-50 sm:min-h-12 sm:rounded-2xl sm:text-[0.95rem]"
                >
                  Get Directions
                </a>
                <Link to="/appointments" className="inline-flex min-h-[46px] items-center justify-center rounded-[1.2rem] bg-brandSoft px-4 py-3 text-[0.9rem] font-semibold text-brandDark shadow-sm transition hover:bg-brandSoft/80 sm:min-h-12 sm:rounded-2xl sm:text-[0.95rem]">
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
