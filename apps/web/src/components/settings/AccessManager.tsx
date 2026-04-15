import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldAlert, UserMinus } from "lucide-react";
import toast from "react-hot-toast";
import {
  deriveFamilyPermissionLevel,
  type PatientAccessRecord,
  type PatientPermissionSet,
} from "@carecircle/shared";
import { Button, Card, SectionHeader, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { roleLabel } from "@/lib/roles";

type PermissionItem = {
  key: keyof PatientPermissionSet;
  label: string;
  roles?: PatientAccessRecord["accessRole"][];
};

const permissionGroups: Record<string, { label: string; items: PermissionItem[] }> = {
  medications: {
    label: "Medications",
    items: [
      { key: "canViewMedications", label: "Can view medication schedule", roles: ["secondary_caregiver", "family_member", "doctor"] },
      { key: "canManageMedications", label: "Can edit medication list", roles: ["secondary_caregiver"] },
      { key: "canLogMedications", label: "Can mark medications as taken", roles: ["secondary_caregiver", "family_member"] },
    ],
  },
  journal: {
    label: "Care Journal",
    items: [
      { key: "canViewJournal", label: "Can view journal entries", roles: ["secondary_caregiver", "family_member", "doctor"] },
      { key: "canLogJournal", label: "Can add journal entries", roles: ["secondary_caregiver", "family_member"] },
      { key: "canAddClinicalNotes", label: "Can add clinical notes", roles: ["doctor"] },
    ],
  },
  vitals: {
    label: "Health Vitals",
    items: [
      { key: "canViewVitals", label: "Can view vitals", roles: ["secondary_caregiver", "family_member", "doctor"] },
      { key: "canViewVitalsRaw", label: "Can see exact numbers", roles: ["secondary_caregiver", "family_member", "doctor"] },
      { key: "canLogVitals", label: "Can log vitals", roles: ["secondary_caregiver", "family_member"] },
    ],
  },
  documents: {
    label: "Documents",
    items: [
      { key: "canViewDocuments", label: "Can view documents", roles: ["secondary_caregiver", "doctor"] },
      { key: "canUploadDocuments", label: "Can upload documents", roles: ["secondary_caregiver"] },
    ],
  },
  appointments: {
    label: "Appointments",
    items: [
      { key: "canViewAppointments", label: "Can view appointments", roles: ["secondary_caregiver", "family_member", "doctor"] },
      { key: "canManageAppointments", label: "Can add or update appointments", roles: ["secondary_caregiver"] },
    ],
  },
  family: {
    label: "Family Hub And Tasks",
    items: [
      { key: "canViewFamily", label: "Can join family chat and activity", roles: ["secondary_caregiver", "family_member"] },
      { key: "canViewTasks", label: "Can view tasks", roles: ["secondary_caregiver", "family_member"] },
      { key: "canCompleteTasks", label: "Can complete assigned tasks", roles: ["secondary_caregiver", "family_member"] },
      { key: "canManageTasks", label: "Can create or edit tasks", roles: ["secondary_caregiver"] },
    ],
  },
  sensitive: {
    label: "Emergency And Sensitive Access",
    items: [
      { key: "canViewEmergency", label: "Can view emergency protocol", roles: ["secondary_caregiver", "doctor"] },
      { key: "canShareEmergency", label: "Can regenerate or share emergency tools", roles: ["secondary_caregiver"] },
      { key: "canViewInsurance", label: "Can view insurance details", roles: ["secondary_caregiver"] },
      { key: "canViewAiInsights", label: "Can view AI insights", roles: ["secondary_caregiver", "doctor"] },
    ],
  },
};

const permissionTierLabel = (record: PatientAccessRecord) =>
  record.accessRole === "doctor"
    ? "Clinical access"
    : deriveFamilyPermissionLevel(record.accessRole, record.permissions).replaceAll("_", " ");

export const AccessManager = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [savingRecord, setSavingRecord] = useState<string | null>(null);

  const canManageFamily = bootstrap?.capabilities.includes("manage_family") ?? false;
  const accessRecords = bootstrap?.patientAccess.filter((record) => record.userId !== bootstrap.viewer.id) ?? [];

  if (!canManageFamily) {
    return (
      <Card>
        <SectionHeader title="Team Permissions" description="Only the primary caregiver can change granular access." />
        <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50 p-4 sm:rounded-[2rem] sm:p-5">
          <p className="text-[0.95rem] font-semibold text-amber-900 sm:text-base">This account cannot manage team access.</p>
          <p className="mt-2 text-[0.85rem] text-amber-900/80 sm:text-sm">
            Granular permissions and data access controls are restricted to ensure patient privacy.
          </p>
        </div>
      </Card>
    );
  }

  const togglePermission = async (
    record: PatientAccessRecord,
    permissionKey: keyof PatientPermissionSet,
    value: boolean,
  ) => {
    setSavingRecord(record.id);
    try {
      await request(`/settings/access/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          permissions: {
            ...record.permissions,
            [permissionKey]: value,
          },
        }),
      });
      toast.success("Access updated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update access.");
    } finally {
      setSavingRecord(null);
    }
  };

  const updateJoinStatus = async (record: PatientAccessRecord, status: "active" | "revoked") => {
    setSavingRecord(record.id);
    try {
      await request(`/settings/access/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ joinStatus: status }),
      });
      toast.success(`Access ${status === "revoked" ? "revoked" : "restored"}.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change status.");
    } finally {
      setSavingRecord(null);
    }
  };

  const resendInvite = async (record: PatientAccessRecord) => {
    setSavingRecord(record.id);
    try {
      await request(`/family/invite/${record.id}/resend`, { method: "POST" });
      toast.success("Invite resent.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend invite.");
    } finally {
      setSavingRecord(null);
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Team Permissions"
        description="Manage exactly what each care team member can see and do."
      />
      <div className="grid gap-3">
        {accessRecords.length === 0 ? (
          <p className="text-[0.85rem] text-textSecondary sm:text-sm">You are the only person with access to this record.</p>
        ) : null}

        {accessRecords.map((record) => {
          const isExpanded = expandedRecord === record.id;
          const isRevoked = record.joinStatus === "revoked";

          return (
            <div key={record.id} className="overflow-hidden rounded-[1.7rem] border border-borderColor bg-surface transition-all sm:rounded-[2rem]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-slate-50 sm:p-4"
                onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[0.95rem] font-semibold text-textPrimary sm:text-base">{record.name}</p>
                    {isRevoked ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-red-700 sm:text-xs sm:normal-case sm:tracking-normal">
                        Access Revoked
                      </span>
                    ) : record.joinStatus === "pending" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-amber-700 sm:text-xs sm:normal-case sm:tracking-normal">
                        Pending Invite
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[0.82rem] text-textSecondary sm:text-sm">
                    {record.email} • {roleLabel(record.accessRole)}
                  </p>
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-textSecondary sm:text-xs">
                    {permissionTierLabel(record)}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-textSecondary" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-textSecondary" />
                )}
              </button>

              {isExpanded ? (
                <div className="border-t border-borderColor bg-slate-50 p-3.5 sm:p-4">
                  <div className="mb-5 flex flex-col gap-4 rounded-[1.25rem] bg-white p-4 shadow-sm sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Account status</p>
                      <p className="text-[0.85rem] text-textSecondary sm:text-sm">
                        {isRevoked
                          ? "This user is suspended and cannot access the patient record."
                          : record.joinStatus === "pending"
                            ? "This invite is waiting for the recipient to accept."
                            : "This user has active access."}
                      </p>
                    </div>
                    {isRevoked ? (
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => void updateJoinStatus(record, "active")}
                        disabled={savingRecord === record.id}
                      >
                        Restore Access
                      </Button>
                    ) : (
                      <div className="grid gap-2 sm:flex sm:flex-wrap">
                        {record.joinStatus === "pending" ? (
                          <Button
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => void resendInvite(record)}
                            disabled={savingRecord === record.id}
                          >
                            {savingRecord === record.id ? "Sending..." : "Resend Invite"}
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          className="w-full sm:w-auto"
                          onClick={() => void updateJoinStatus(record, "revoked")}
                          disabled={savingRecord === record.id}
                        >
                          <UserMinus className="h-4 w-4" />
                          {record.joinStatus === "pending" ? "Cancel Invite" : "Revoke Access"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className={`grid gap-4 sm:gap-5 sm:grid-cols-2 ${isRevoked ? "pointer-events-none opacity-50 grayscale" : ""}`}>
                    {Object.entries(permissionGroups).map(([groupKey, group]) => {
                      const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(record.accessRole));
                      if (!visibleItems.length) return null;

                      return (
                        <div key={groupKey} className="space-y-2.5 sm:space-y-3">
                          <p className="text-[0.85rem] font-semibold uppercase tracking-[0.12em] text-textPrimary sm:text-base sm:normal-case sm:tracking-normal">{group.label}</p>
                          <div className="rounded-[1.35rem] border border-borderColor bg-white sm:rounded-2xl">
                            {visibleItems.map((item, index) => (
                              <div
                                key={item.key}
                                className={`flex items-center justify-between gap-3 p-3 ${
                                  index < visibleItems.length - 1 ? "border-b border-borderColor" : ""
                                }`}
                              >
                                <p className="text-[0.82rem] leading-5 text-textPrimary sm:text-sm">{item.label}</p>
                                <Toggle
                                  checked={Boolean(record.permissions[item.key])}
                                  onChange={(value) => void togglePermission(record, item.key, value)}
                                  disabled={savingRecord === record.id}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {record.accessRole === "doctor" && !record.permissions.canViewAuditLog ? (
                    <div className="mt-4 flex items-start gap-3 rounded-[1.35rem] bg-brandSoft/30 p-4 text-brandDark sm:rounded-2xl">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                      <p className="text-[0.85rem] leading-6 sm:text-sm">
                        As a clinical provider, this user can review shared care data and write clinical notes, but they cannot see the
                        family workspace, billing details, or audit logs.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
