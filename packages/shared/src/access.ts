import type {
  FamilyMemberRecord,
  PatientAccessLevel,
  PatientAccessRecord,
  PatientAccessRole,
  PatientCapability,
  PatientPermissionSet,
  PermissionLevel,
} from "./types";

const permissionKeys: Array<keyof PatientPermissionSet> = [
  "canViewMedications",
  "canManageMedications",
  "canLogMedications",
  "canViewJournal",
  "canLogJournal",
  "canViewDocuments",
  "canUploadDocuments",
  "canViewAppointments",
  "canManageAppointments",
  "canViewVitals",
  "canViewVitalsRaw",
  "canLogVitals",
  "canViewFamily",
  "canManageFamily",
  "canViewTasks",
  "canManageTasks",
  "canCompleteTasks",
  "canViewEmergency",
  "canShareEmergency",
  "canEditPatient",
  "canExportData",
  "canAddClinicalNotes",
  "canAcceptInvites",
  "canViewInsurance",
  "canViewAiInsights",
  "canViewAuditLog",
];

const basePermissions = (): PatientPermissionSet => ({
  canViewMedications: false,
  canManageMedications: false,
  canLogMedications: false,
  canViewJournal: false,
  canLogJournal: false,
  canViewDocuments: false,
  canUploadDocuments: false,
  canViewAppointments: false,
  canManageAppointments: false,
  canViewVitals: false,
  canViewVitalsRaw: false,
  canLogVitals: false,
  canViewFamily: false,
  canManageFamily: false,
  canViewTasks: false,
  canManageTasks: false,
  canCompleteTasks: false,
  canViewEmergency: false,
  canShareEmergency: false,
  canEditPatient: false,
  canExportData: false,
  canAddClinicalNotes: false,
  canAcceptInvites: false,
  canViewInsurance: false,
  canViewAiInsights: false,
  canViewAuditLog: false,
});

export const normalizePatientAccessRole = (value?: PatientAccessRole | string | null): PatientAccessRole => {
  if (value === "doctor" || value === "primary_caregiver" || value === "secondary_caregiver" || value === "emergency_contact") {
    return value;
  }
  return "family_member";
};

const mergePermissions = (...values: Array<Partial<PatientPermissionSet> | null | undefined>): PatientPermissionSet => {
  const nextValue = basePermissions();
  values.forEach((value) => {
    if (!value) return;
    permissionKeys.forEach((key) => {
      if (key in value && typeof value[key] === "boolean") {
        nextValue[key] = Boolean(value[key]);
      }
    });
  });
  return nextValue;
};

export const defaultPatientPermissions = (
  accessRole: PatientAccessRole,
  accessLevel: PatientAccessLevel,
): PatientPermissionSet => {
  const normalizedRole = normalizePatientAccessRole(accessRole);

  if (normalizedRole === "doctor" || accessLevel === "clinical_access") {
    return mergePermissions(basePermissions(), {
      canViewMedications: true,
      canViewJournal: true,
      canViewDocuments: true,
      canViewAppointments: true,
      canViewVitals: true,
      canViewVitalsRaw: true,
      canViewEmergency: true,
      canAddClinicalNotes: true,
      canViewAiInsights: true,
    });
  }

  if (normalizedRole === "emergency_contact") {
    return mergePermissions(basePermissions(), {
      canViewEmergency: true,
    });
  }

  if (normalizedRole === "primary_caregiver" || accessLevel === "full_access") {
    return mergePermissions(basePermissions(), {
      canViewMedications: true,
      canManageMedications: true,
      canLogMedications: true,
      canViewJournal: true,
      canLogJournal: true,
      canViewDocuments: true,
      canUploadDocuments: true,
      canViewAppointments: true,
      canManageAppointments: true,
      canViewVitals: true,
      canViewVitalsRaw: true,
      canLogVitals: true,
      canViewFamily: true,
      canManageFamily: true,
      canViewTasks: true,
      canManageTasks: true,
      canCompleteTasks: true,
      canViewEmergency: true,
      canShareEmergency: true,
      canEditPatient: true,
      canExportData: true,
      canAcceptInvites: true,
      canViewInsurance: true,
      canViewAiInsights: true,
      canViewAuditLog: true,
    });
  }

  if (normalizedRole === "secondary_caregiver") {
    return mergePermissions(basePermissions(), {
      canViewMedications: true,
      canManageMedications: true,
      canLogMedications: true,
      canViewJournal: true,
      canLogJournal: true,
      canViewDocuments: true,
      canUploadDocuments: true,
      canViewAppointments: true,
      canManageAppointments: true,
      canViewVitals: true,
      canViewVitalsRaw: true,
      canLogVitals: true,
      canViewFamily: true,
      canViewTasks: true,
      canManageTasks: true,
      canCompleteTasks: true,
      canViewEmergency: true,
      canViewAiInsights: true,
    });
  }

  if (accessLevel === "can_log") {
    return mergePermissions(basePermissions(), {
      canViewMedications: true,
      canLogMedications: true,
      canViewJournal: true,
      canLogJournal: true,
      canViewAppointments: true,
      canViewVitals: true,
      canLogVitals: true,
      canViewFamily: true,
      canViewTasks: true,
      canCompleteTasks: true,
    });
  }

  if (accessLevel === "can_coordinate") {
    return mergePermissions(basePermissions(), {
      canViewMedications: true,
      canViewJournal: true,
      canViewAppointments: true,
      canViewVitals: true,
      canViewFamily: true,
      canViewTasks: true,
      canCompleteTasks: true,
    });
  }

  return mergePermissions(basePermissions(), {
    canViewMedications: true,
    canViewJournal: true,
    canViewAppointments: true,
    canViewVitals: true,
    canViewTasks: true,
    canViewFamily: true,
  });
};

export const capabilitiesFromPermissions = (
  permissions: PatientPermissionSet,
  accessRole: PatientAccessRole,
): PatientCapability[] => {
  const normalizedRole = normalizePatientAccessRole(accessRole);
  const capabilities: PatientCapability[] = ["view_dashboard"];

  if (permissions.canViewMedications) capabilities.push("view_medications");
  if (permissions.canManageMedications) capabilities.push("manage_medications");
  if (permissions.canLogMedications) capabilities.push("log_medications");
  if (permissions.canViewJournal) capabilities.push("view_journal");
  if (permissions.canLogJournal) capabilities.push("log_journal");
  if (permissions.canViewDocuments) capabilities.push("view_documents");
  if (permissions.canUploadDocuments) capabilities.push("upload_documents");
  if (permissions.canViewAppointments) capabilities.push("view_appointments");
  if (permissions.canManageAppointments) capabilities.push("manage_appointments");
  if (permissions.canViewVitals) capabilities.push("view_vitals");
  if (permissions.canLogVitals) capabilities.push("log_vitals");
  if (permissions.canViewFamily) capabilities.push("view_family");
  if (permissions.canManageFamily || permissions.canAcceptInvites || normalizedRole === "primary_caregiver") {
    capabilities.push("manage_family");
  }
  if (permissions.canViewTasks) capabilities.push("view_tasks");
  if (permissions.canManageTasks) capabilities.push("manage_tasks");
  if (permissions.canCompleteTasks) capabilities.push("complete_tasks");
  if (permissions.canViewEmergency) capabilities.push("view_emergency");
  if (permissions.canShareEmergency) capabilities.push("share_emergency");
  if (permissions.canEditPatient) capabilities.push("edit_patient");
  if (permissions.canExportData) capabilities.push("export_data");
  if (permissions.canAddClinicalNotes) capabilities.push("add_clinical_notes");
  if (permissions.canAcceptInvites) capabilities.push("accept_invites");
  if (permissions.canViewInsurance) capabilities.push("view_insurance");
  if (permissions.canViewAiInsights) capabilities.push("view_ai_insights");
  if (permissions.canViewAuditLog) capabilities.push("view_audit_log");

  return Array.from(new Set(capabilities));
};

export const buildPatientCapabilities = (
  accessRole: PatientAccessRole,
  accessLevel: PatientAccessLevel,
  permissions?: Partial<PatientPermissionSet> | null,
): PatientCapability[] =>
  capabilitiesFromPermissions(
    mergePermissions(defaultPatientPermissions(accessRole, accessLevel), permissions),
    accessRole,
  );

export const normalizePatientPermissions = (
  accessRole: PatientAccessRole,
  accessLevel: PatientAccessLevel,
  permissions?: Partial<PatientPermissionSet> | null,
): PatientPermissionSet =>
  mergePermissions(defaultPatientPermissions(accessRole, accessLevel), permissions);

export const derivePatientAccessLevel = (
  accessRole: PatientAccessRole,
  permissions: PatientPermissionSet,
): PatientAccessLevel => {
  const normalizedRole = normalizePatientAccessRole(accessRole);
  if (normalizedRole === "doctor") return "clinical_access";
  if (normalizedRole === "primary_caregiver") return "full_access";
  if (normalizedRole === "secondary_caregiver") return "can_log";
  if (permissions.canLogJournal || permissions.canLogMedications || permissions.canLogVitals) return "can_log";
  if (permissions.canCompleteTasks || permissions.canViewFamily) return "can_coordinate";
  return "view_only";
};

export const deriveFamilyPermissionLevel = (
  accessRole: PatientAccessRole,
  permissions: PatientPermissionSet,
): PermissionLevel => {
  const normalizedRole = normalizePatientAccessRole(accessRole);
  if (normalizedRole === "primary_caregiver") return "full_access";
  if (normalizedRole === "secondary_caregiver") return "can_log";
  if (permissions.canLogJournal || permissions.canLogMedications || permissions.canLogVitals) return "can_log";
  if (permissions.canCompleteTasks || permissions.canViewFamily) return "can_coordinate";
  return "view_only";
};

const relationshipLabelForRole = (accessRole: PatientAccessRole) => {
  switch (normalizePatientAccessRole(accessRole)) {
    case "primary_caregiver":
      return "Primary caregiver";
    case "secondary_caregiver":
      return "Secondary caregiver";
    case "emergency_contact":
      return "Emergency contact";
    default:
      return "Family member";
  }
};

export const buildFamilyMemberFromAccessRecord = (
  record: PatientAccessRecord,
  options?: {
    phone?: string;
    photoUrl?: string;
    relationship?: string;
    lastActive?: string;
    acceptedAt?: string;
  },
): FamilyMemberRecord | null => {
  const accessRole = normalizePatientAccessRole(record.accessRole);
  if (accessRole === "doctor" || record.joinStatus === "revoked") return null;

  return {
    id: record.id,
    patientId: record.patientId,
    invitedBy: record.invitedBy,
    userId: record.userId,
    name: record.name,
    email: record.email,
    phone: options?.phone,
    relationship: options?.relationship ?? relationshipLabelForRole(accessRole),
    role: (accessRole === "family" ? "family_member" : accessRole) as FamilyMemberRecord["role"],
    permissions: deriveFamilyPermissionLevel(accessRole, record.permissions),
    joinStatus: record.joinStatus === "active" ? "active" : "pending",
    inviteToken: record.inviteToken,
    createdAt: record.createdAt,
    photoUrl: options?.photoUrl,
    lastActive: options?.lastActive ?? record.lastActive,
    acceptedAt: options?.acceptedAt ?? record.acceptedAt,
  };
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
  permissions?: Partial<PatientPermissionSet> | null;
  capabilities?: PatientCapability[];
}): PatientAccessRecord => {
  const accessRole = normalizePatientAccessRole(input.accessRole);
  const permissions = normalizePatientPermissions(accessRole, input.accessLevel, input.permissions);

  return {
    ...input,
    accessRole,
    permissions,
    capabilities: input.capabilities ?? capabilitiesFromPermissions(permissions, accessRole),
  };
};

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
