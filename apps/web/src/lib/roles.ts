import type { UserRole } from "@carecircle/shared";

export const roleHomePath = (role?: UserRole | null) => {
  if (role === "family_member") return "/family-home";
  if (role === "doctor") return "/doctor-home";
  return "/dashboard";
};

export const roleLabel = (role?: UserRole | null) => {
  if (role === "family_member") return "Family member";
  if (role === "doctor") return "Healthcare provider";
  if (role === "admin") return "Admin";
  return "Primary caregiver";
};

export const roleDescription = (role?: UserRole | null) => {
  if (role === "family_member") return "A simpler view for helpers who stay informed and pitch in.";
  if (role === "doctor") return "A focused clinical view for reviewing care and making notes.";
  if (role === "admin") return "Administrative access for managing the demo.";
  return "Full access to the caregiver experience.";
};

export const roleAllowedPaths = (role?: UserRole | null) => {
  const caregiverPaths = [
    "/dashboard",
    "/family-home",
    "/doctor-home",
    "/medications",
    "/journal",
    "/documents",
    "/appointments",
    "/vitals",
    "/family",
    "/tasks",
    "/emergency",
    "/settings",
    "/care-chat",
  ];

  const familyPaths = [
    "/family-home",
    "/medications",
    "/tasks",
    "/family",
    "/emergency",
    "/settings",
    "/care-chat",
  ];

  const doctorPaths = [
    "/doctor-home",
    "/journal",
    "/appointments",
    "/vitals",
    "/emergency",
    "/settings",
    "/care-chat",
  ];

  if (role === "family_member") return familyPaths;
  if (role === "doctor") return doctorPaths;
  return caregiverPaths;
};
