import type {
  PatientAccessLevel,
  PatientAccessRecord,
  PatientAccessRole,
  PatientCapability,
} from "./types";

const caregiverCapabilities: PatientCapability[] = [
  "view_dashboard",
  "view_medications",
  "log_medications",
  "view_journal",
  "log_journal",
  "view_documents",
  "upload_documents",
  "view_appointments",
  "manage_appointments",
  "view_vitals",
  "log_vitals",
  "view_family",
  "manage_family",
  "view_tasks",
  "manage_tasks",
  "view_emergency",
  "share_emergency",
  "edit_patient",
  "export_data",
  "add_clinical_notes",
  "accept_invites",
];

const caregiverLogCapabilities: PatientCapability[] = [
  "view_dashboard",
  "view_medications",
  "log_medications",
  "view_journal",
  "log_journal",
  "view_documents",
  "view_appointments",
  "view_vitals",
  "log_vitals",
  "view_family",
  "view_tasks",
  "manage_tasks",
  "view_emergency",
  "share_emergency",
];

const caregiverViewCapabilities: PatientCapability[] = [
  "view_dashboard",
  "view_medications",
  "view_journal",
  "view_documents",
  "view_appointments",
  "view_vitals",
  "view_family",
  "view_tasks",
  "view_emergency",
];

const doctorCapabilities: PatientCapability[] = [
  "view_dashboard",
  "view_medications",
  "view_journal",
  "view_documents",
  "view_appointments",
  "view_vitals",
  "view_emergency",
  "add_clinical_notes",
];

const emergencyCapabilities: PatientCapability[] = ["view_dashboard", "view_emergency"];

export const buildPatientCapabilities = (
  accessRole: PatientAccessRole,
  accessLevel: PatientAccessLevel,
): PatientCapability[] => {
  if (accessRole === "doctor" || accessLevel === "clinical_access") {
    return [...doctorCapabilities];
  }

  if (accessRole === "emergency_contact") {
    return [...emergencyCapabilities];
  }

  if (accessLevel === "full_access" || accessRole === "primary_caregiver") {
    return [...caregiverCapabilities];
  }

  if (accessLevel === "can_log") {
    return [...caregiverLogCapabilities];
  }

  return [...caregiverViewCapabilities];
};

export const buildPatientAccessRecord = (input: {
  id: string;
  patientId: string;
  email: string;
  name: string;
  accessRole: PatientAccessRole;
  accessLevel: PatientAccessLevel;
  invitedBy: string;
  joinStatus: "pending" | "active" | "revoked";
  inviteToken: string;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string;
  lastActive?: string;
  capabilities?: PatientCapability[];
}): PatientAccessRecord => ({
  ...input,
  capabilities: input.capabilities ?? buildPatientCapabilities(input.accessRole, input.accessLevel),
});

export const hasCapability = (
  access: PatientAccessRecord | null | undefined,
  capability: PatientCapability,
) => Boolean(access?.capabilities.includes(capability));

export const canExportPatientData = (access: PatientAccessRecord | null | undefined) =>
  hasCapability(access, "export_data");

export const canShareEmergency = (access: PatientAccessRecord | null | undefined) =>
  hasCapability(access, "share_emergency");

export const canEditPatient = (access: PatientAccessRecord | null | undefined) =>
  hasCapability(access, "edit_patient");

export const canManageFamily = (access: PatientAccessRecord | null | undefined) =>
  hasCapability(access, "manage_family");

