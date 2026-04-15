import { Link } from "react-router-dom";
import { Activity, CalendarDays, FileText, HeartPulse, Shield, Stethoscope } from "lucide-react";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { calcAge, formatDate, relativeTime } from "@/lib/format";
import { resolveViewerRole, roleLabel } from "@/lib/roles";

export const DoctorHomePage = () => {
  const { bootstrap } = useAppData();
  if (!bootstrap) return null;

  const { viewer, patient, dashboard, data } = bootstrap;
  const viewerRole = resolveViewerRole(viewer.role, bootstrap.viewerAccess?.accessRole);
  const recentVitals = data.healthVitals.slice(0, 3);
  const recentNotes = data.careJournal.slice(0, 3);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <p className="eyebrow">Clinical view</p>
          <h1 className="responsive-title-lg mt-2 text-textPrimary">A clearer clinical snapshot.</h1>
        </div>
        <Badge tone="brand">{roleLabel(viewerRole)}</Badge>
      </div>

      <Card className="hero-shell hero-card-pad overflow-hidden bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(55,48,163,0.94),rgba(99,102,241,0.9))] text-white shadow-calm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="glass-chip border-white/15 bg-white/10 text-white/80">Patient overview</span>
            <h2 className="hero-headline mt-4">{patient.preferredName ?? patient.name}</h2>
            <p className="hero-body-copy mt-3 text-white/84">
              {calcAge(patient.dateOfBirth)} years old - {patient.primaryDiagnosis}
            </p>
          </div>
          <div className="hero-action-row w-full sm:w-auto lg:max-w-md lg:justify-end">
            <Link to="/journal" className="glass-panel inline-flex min-h-[46px] items-center justify-center rounded-[1.35rem] px-4 py-3 text-[0.92rem] font-semibold text-brandDark transition hover:bg-white/92 sm:min-h-[50px] sm:w-auto sm:text-[0.95rem]">
              Open journal
            </Link>
            <Link to="/appointments" className="glass-panel inline-flex min-h-[46px] items-center justify-center rounded-[1.35rem] px-4 py-3 text-[0.92rem] font-semibold text-brandDark transition hover:bg-white/92 sm:min-h-[50px] sm:w-auto sm:text-[0.95rem]">
              Upcoming visits
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <Stethoscope className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Primary doctor</span>
          </div>
          <p className="mt-4 text-lg font-bold text-textPrimary sm:text-xl">{patient.primaryDoctorName}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">{patient.primaryDoctorPhone}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CalendarDays className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Next visit</span>
          </div>
          <p className="mt-4 text-lg font-bold text-textPrimary sm:text-xl">{dashboard.nextAppointment?.doctorName ?? "None scheduled"}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">
            {dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "No visit is queued yet."}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <HeartPulse className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Vitals captured</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-textPrimary sm:text-3xl">{data.healthVitals.length}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">recent readings</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <Activity className="h-5 w-5 text-brandDark" />
            <span className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-textSecondary sm:text-sm sm:normal-case sm:tracking-normal">Active meds</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-textPrimary sm:text-3xl">{data.medications.filter((item) => item.isActive).length}</p>
          <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">current list</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title="Clinical snapshots" description="Quick access to the most useful patient context." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="section-well rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-textPrimary sm:text-sm sm:normal-case sm:tracking-normal">Blood type</p>
              <p className="mt-2 text-xl font-bold text-brandDark sm:text-2xl">{patient.bloodType}</p>
            </div>
            <div className="section-well rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-textPrimary sm:text-sm sm:normal-case sm:tracking-normal">Allergies</p>
              <p className="mt-2 text-[0.88rem] leading-6 text-textSecondary sm:text-sm sm:leading-7">{patient.allergies.join(", ") || "None listed"}</p>
            </div>
            <div className="section-well rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
              <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-textPrimary sm:text-sm sm:normal-case sm:tracking-normal">Mobility</p>
              <p className="mt-2 text-[0.88rem] leading-6 text-textSecondary sm:text-sm sm:leading-7">{patient.mobilityLevel}</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Read-only care context"
            description="The doctor view keeps the emphasis on review and notes, not caregiver controls."
          />
          <div className="space-y-3">
            {recentNotes.length ? (
              recentNotes.map((entry) => (
                <div key={entry.id} className="rounded-[1.6rem] border border-borderColor/80 p-4 sm:rounded-[2rem] sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">{entry.entryTitle}</p>
                  <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">{relativeTime(entry.createdAt)}</p>
                  <p className="mt-2 text-[0.88rem] leading-6 text-textSecondary sm:text-sm sm:leading-7">{entry.entryBody}</p>
                </div>
              ))
            ) : (
              <EmptyState title="No notes yet" description="Once the caregiver logs entries, they'll appear here for review." />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title="Recent vitals" description="The latest readings stay easy to scan." />
          <div className="space-y-3">
            {recentVitals.length ? (
              recentVitals.map((vital) => (
                <div key={vital.id} className="rounded-[1.6rem] border border-borderColor/80 p-4 sm:rounded-[2rem] sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">
                    {vital.date} · {vital.time}
                  </p>
                  <p className="mt-1 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                    BP {vital.bloodPressureSystolic ?? "--"}/{vital.bloodPressureDiastolic ?? "--"}, HR {vital.heartRate ?? "--"}, Glucose{" "}
                    {vital.bloodGlucose ?? "--"}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="No vital readings" description="Vitals will appear here once they're logged." />
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Quick links" description="Jump to the parts clinicians usually need first." />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: FileText, label: "Care journal", to: "/journal" },
              { icon: HeartPulse, label: "Vitals", to: "/vitals" },
              { icon: CalendarDays, label: "Appointments", to: "/appointments" },
              { icon: Shield, label: "Emergency", to: "/emergency" },
            ].map(({ icon: Icon, label, to }) => (
              <Link key={label} to={to} className="os-shell-soft rounded-[1.6rem] p-4 transition hover:bg-brandSoft/35 sm:rounded-[2rem] sm:p-5">
                <Icon className="h-5 w-5 text-brandDark" />
                <p className="mt-3 text-[0.95rem] font-semibold text-textPrimary sm:text-base">{label}</p>
              </Link>
            ))}
          </div>
          <div className="section-well mt-5 rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-textPrimary sm:text-sm sm:normal-case sm:tracking-normal">Clinical access</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-textSecondary sm:text-sm">
              This view keeps the focus on review, monitoring, and note-taking so the interface stays calm.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
