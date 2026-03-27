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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Clinical view</p>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">A clearer clinical snapshot.</h1>
        </div>
        <Badge tone="brand">{roleLabel(viewerRole)}</Badge>
      </div>

      <Card className="overflow-hidden bg-gradient-to-r from-slate-950 to-brandDark text-white shadow-calm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Patient overview</p>
            <h2 className="mt-2 text-3xl font-bold">{patient.preferredName ?? patient.name}</h2>
            <p className="mt-2 text-base leading-7 text-white/85">
              {calcAge(patient.dateOfBirth)} years old - {patient.primaryDiagnosis}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/journal" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 py-3 text-[0.95rem] font-semibold text-brandDark shadow-sm transition hover:bg-white/95">
              Open journal
            </Link>
            <Link to="/appointments" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 py-3 text-[0.95rem] font-semibold text-brandDark shadow-sm transition hover:bg-white/95">
              Upcoming visits
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <Stethoscope className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Primary doctor</span>
          </div>
          <p className="mt-4 text-xl font-bold text-textPrimary">{patient.primaryDoctorName}</p>
          <p className="mt-1 text-sm text-textSecondary">{patient.primaryDoctorPhone}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CalendarDays className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Next visit</span>
          </div>
          <p className="mt-4 text-xl font-bold text-textPrimary">{dashboard.nextAppointment?.doctorName ?? "None scheduled"}</p>
          <p className="mt-1 text-sm text-textSecondary">
            {dashboard.nextAppointment
              ? `${formatDate(dashboard.nextAppointment.appointmentDate)} at ${dashboard.nextAppointment.appointmentTime}`
              : "No visit is queued yet."}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <HeartPulse className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Vitals captured</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{data.healthVitals.length}</p>
          <p className="mt-1 text-sm text-textSecondary">recent readings</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <Activity className="h-5 w-5 text-brandDark" />
            <span className="text-sm font-semibold text-textSecondary">Active meds</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-textPrimary">{data.medications.filter((item) => item.isActive).length}</p>
          <p className="mt-1 text-sm text-textSecondary">current list</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title="Clinical snapshots" description="Quick access to the most useful patient context." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-brandSoft/55 p-4">
              <p className="text-sm font-semibold text-textPrimary">Blood type</p>
              <p className="mt-1 text-2xl font-bold text-brandDark">{patient.bloodType}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-textPrimary">Allergies</p>
              <p className="mt-1 text-sm leading-7 text-textSecondary">{patient.allergies.join(", ") || "None listed"}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-textPrimary">Mobility</p>
              <p className="mt-1 text-sm leading-7 text-textSecondary">{patient.mobilityLevel}</p>
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
                <div key={entry.id} className="rounded-3xl border border-borderColor p-4">
                  <p className="font-semibold text-textPrimary">{entry.entryTitle}</p>
                  <p className="mt-1 text-sm text-textSecondary">{relativeTime(entry.createdAt)}</p>
                  <p className="mt-2 text-sm leading-7 text-textSecondary">{entry.entryBody}</p>
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
                <div key={vital.id} className="rounded-3xl border border-borderColor p-4">
                  <p className="font-semibold text-textPrimary">
                    {vital.date} · {vital.time}
                  </p>
                  <p className="mt-1 text-sm text-textSecondary">
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
              <Link key={label} to={to} className="rounded-3xl border border-borderColor bg-surface p-4 transition hover:bg-brandSoft/35">
                <Icon className="h-5 w-5 text-brandDark" />
                <p className="mt-3 text-base font-semibold text-textPrimary">{label}</p>
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-3xl bg-brandSoft/55 p-4">
            <p className="text-sm font-semibold text-textPrimary">Clinical access</p>
            <p className="mt-1 text-sm text-textSecondary">
              This view keeps the focus on review, monitoring, and note-taking so the interface stays calm.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
