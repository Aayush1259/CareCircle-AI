import type { PatientAccessRole, PatientCapability, UserRole } from "@carecircle/shared";

export const resolveViewerRole = (
  userRole?: UserRole | null,
  accessRole?: PatientAccessRole | null,
): UserRole | PatientAccessRole | null =>
  accessRole ?? userRole ?? null;

export const roleHomePath = (role?: UserRole | PatientAccessRole | null) => {
  if (role === "family_member") return "/family-home";
  if (role === "doctor") return "/doctor-home";
  return "/dashboard";
};

export const roleLabel = (role?: UserRole | PatientAccessRole | null) => {
  if (role === "family_member") return "Family member";
  if (role === "doctor") return "Healthcare provider";
  if (role === "secondary_caregiver") return "Secondary caregiver";
  if (role === "primary_caregiver") return "Primary caregiver";
  if (role === "family") return "Family member";
  // fallback for legacy admin enum
  if (role === "admin") return "Admin";
  return "Caregiver";
};

export const roleDescription = (role?: UserRole | PatientAccessRole | null) => {
  if (role === "family_member") return "A simpler view for helpers who stay informed and pitch in.";
  if (role === "doctor") return "A focused clinical view for reviewing care and making notes.";
  if (role === "secondary_caregiver") return "A supportive caregiver role with managed access.";
  if (role === "primary_caregiver") return "Full access and management of the care circle.";
  if (role === "admin") return "Administrative access for managing the demo.";
  return "Caregiver access.";
};

export const canDo = (capability?: PatientCapability, capabilities: PatientCapability[] = []) => {
  if (!capability) return true;
  return capabilities.includes(capability);
};

export const roleAllowedPaths = (
  role?: UserRole | PatientAccessRole | null,
  capabilities: PatientCapability[] = [],
) => {
  const paths = new Set<string>(["/settings", "/care-chat"]);

  if (role === "family_member") {
    paths.add("/family-home");
    if (canDo("view_medications", capabilities)) paths.add("/medications");
    if (canDo("view_tasks", capabilities)) paths.add("/tasks");
    if (canDo("view_family", capabilities)) paths.add("/family");
    if (canDo("view_emergency", capabilities)) paths.add("/emergency");
    if (canDo("view_appointments", capabilities)) paths.add("/appointments");
    if (canDo("view_journal", capabilities)) paths.add("/journal");
    if (canDo("view_vitals", capabilities)) paths.add("/vitals");
    return Array.from(paths);
  }

  if (role === "doctor") {
    paths.add("/doctor-home");
    if (canDo("view_journal", capabilities)) paths.add("/journal");
    if (canDo("view_documents", capabilities)) paths.add("/documents");
    if (canDo("view_appointments", capabilities)) paths.add("/appointments");
    if (canDo("view_vitals", capabilities)) paths.add("/vitals");
    if (canDo("view_emergency", capabilities)) paths.add("/emergency");
    return Array.from(paths);
  }

  // Dashboard role (primary, secondary, or admin)
  paths.add("/dashboard");
  if (canDo("view_medications", capabilities)) paths.add("/medications");
  if (canDo("view_journal", capabilities)) paths.add("/journal");
  if (canDo("view_documents", capabilities)) paths.add("/documents");
  if (canDo("view_appointments", capabilities)) paths.add("/appointments");
  if (canDo("view_vitals", capabilities)) paths.add("/vitals");
  if (canDo("view_family", capabilities)) paths.add("/family");
  if (canDo("view_tasks", capabilities)) paths.add("/tasks");
  if (canDo("view_emergency", capabilities)) paths.add("/emergency");
  return Array.from(paths);
};
