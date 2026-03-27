import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type {
  AppSettingsRecord,
  AuthSession,
  NotificationPreferences,
  PatientAccessRecord,
  PatientAccessRole,
  UserRecord,
  UserRole,
} from "@carecircle/shared";
import { buildPatientAccessRecord } from "@carecircle/shared";
import { env, featureFlags } from "../env";
import { getPatient, getState, getViewer, getViewerById, nextId, setActiveUser } from "../store";
import { emailService } from "./email";
import { persistenceService } from "./persistence";
import { supabaseAdmin, supabasePublic } from "./supabase";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const defaultPassword = "Demo1234";
const passwordResetLifetimeMs = 1000 * 60 * 60;

interface TokenPayload {
  viewerId: string;
  mode: "demo" | "supabase";
  viewer: UserRecord;
  patient: AuthSession["patient"];
  access: AuthSession["access"];
  capabilities: AuthSession["capabilities"];
  expiresAt: string;
}

interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  licenseNumber?: string;
}

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetTokenRecord {
  email: string;
  expiresAt: number;
}

interface OAuthExchangeInput {
  accessToken: string;
  role?: UserRole;
  licenseNumber?: string;
  name?: string;
}

const localPasswords = new Map<string, string>();
const passwordResetTokens = new Map<string, PasswordResetTokenRecord>();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeRole = (value?: string): UserRole => {
  if (
    value === "primary_caregiver" ||
    value === "secondary_caregiver" ||
    value === "family_member" ||
    value === "doctor" ||
    value === "admin" ||
    value === "caregiver"
  ) {
    return value;
  }
  return "caregiver";
};

const cloneNotificationPreferences = (): NotificationPreferences => ({ ...getViewer().notificationPreferences });

const hasAccount = (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(
    getState().users.find((user) => user.email.toLowerCase() === normalizedEmail) ||
      localPasswords.has(normalizedEmail),
  );
};

const setLocalPassword = (email: string, password: string) => {
  localPasswords.set(normalizeEmail(email), password);
};

const resolveAccessRole = (role: UserRole): PatientAccessRole => {
  if (role === "doctor") return "doctor";
  if (role === "secondary_caregiver") return "secondary_caregiver";
  if (role === "admin" || role === "caregiver" || role === "primary_caregiver") return "primary_caregiver";
  return "family_member";
};

const resolveAccessLevel = (role: UserRole): PatientAccessRecord["accessLevel"] => {
  if (role === "doctor") return "clinical_access";
  if (role === "secondary_caregiver") return "can_log";
  if (role === "admin" || role === "caregiver" || role === "primary_caregiver") return "full_access";
  return "can_coordinate";
};

const tokenExpiryFromJwt = (token: string) => {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === "object" && typeof decoded.exp === "number") {
    return new Date(decoded.exp * 1000).toISOString();
  }
  return new Date(Date.now() + sessionDurationMs).toISOString();
};

const buildSupabaseAccessSession = async (
  token: string,
  requestedPatientId?: string | null,
): Promise<AuthSession | null> => {
  if (!featureFlags.supabaseEnabled) return null;

  const authClient = supabaseAdmin ?? supabasePublic;
  if (!authClient) return null;

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user?.id) {
      return null;
    }

    const normalizedEmail = normalizeEmail(data.user.email ?? "");
    if (!normalizedEmail) {
      return null;
    }

    const viewer = await persistenceService.loadUserByAuthIdentity(data.user.id, normalizedEmail);
    if (!viewer) {
      return null;
    }

    const snapshot = await persistenceService.loadRequestSnapshot(viewer.id, requestedPatientId);
    const patient = snapshot.patients[0];
    const access =
      snapshot.patientAccess.find(
        (record) => record.userId === viewer.id && record.patientId === snapshot.activePatientId,
      ) ?? null;

    if (!patient) {
      return null;
    }

    return {
      token,
      viewer,
      patient,
      access,
      capabilities: access?.capabilities ?? [],
      mode: "supabase",
      expiresAt: tokenExpiryFromJwt(token),
    };
  } catch {
    return null;
  }
};

const buildDefaultSettings = (viewer: UserRecord): AppSettingsRecord => ({
  userId: viewer.id,
  display: {
    fontSize: "normal",
    colorTheme: "teal",
    dashboardLayout: "detailed",
    highContrast: false,
  },
  updatedAt: new Date().toISOString(),
  helpLinks: [
    { title: "How to use the dashboard", url: "https://www.loom.com/share/carecircle-dashboard" },
    { title: "Uploading a document", url: "https://www.loom.com/share/carecircle-documents" },
    { title: "Inviting family members", url: "https://www.loom.com/share/carecircle-family" },
  ],
});

const syncViewerWorkspace = (viewer: UserRecord) => {
  const state = getState();
  const patient = getPatient();
  const defaultAccessRole = resolveAccessRole(viewer.role);
  const defaultAccessLevel = resolveAccessLevel(viewer.role);

  let access = state.patientAccess.find(
    (record) => record.patientId === patient.id && record.userId === viewer.id,
  );

  if (access) {
    const nextAccess = buildPatientAccessRecord({
      id: access.id,
      patientId: access.patientId,
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      accessRole: access.accessRole,
      accessLevel: access.accessLevel,
      permissions: access.permissions,
      invitedBy: access.invitedBy,
      joinStatus: access.joinStatus,
      inviteToken: access.inviteToken,
      createdAt: access.createdAt,
      updatedAt: new Date().toISOString(),
      acceptedAt: access.acceptedAt,
      lastActive: new Date().toISOString(),
    });
    Object.assign(access, nextAccess);
  } else {
    access = buildPatientAccessRecord({
      id: nextId("access"),
      patientId: patient.id,
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      accessRole: defaultAccessRole,
      accessLevel: defaultAccessLevel,
      invitedBy: patient.userId,
      joinStatus: "active",
      inviteToken: nextId("invite"),
      createdAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });
    state.patientAccess.unshift(access);
  }

  if (!state.settings.some((item) => item.userId === viewer.id)) {
    state.settings.unshift(buildDefaultSettings(viewer));
  }

  return access;
};

const buildSession = async (viewer: UserRecord, mode: "demo" | "supabase"): Promise<AuthSession> => {
  let access = syncViewerWorkspace(viewer);
  let patient = getPatient();

  if (mode === "supabase") {
    const snapshot = await persistenceService.loadRequestSnapshot(viewer.id);
    const nextAccess =
      snapshot.patientAccess.find((record) => record.userId === viewer.id && record.patientId === snapshot.activePatientId) ??
      null;
    access = nextAccess ?? access;
    patient = snapshot.patients[0] ?? patient;
  } else {
    setActiveUser(viewer.id);
  }

  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
  const session: Omit<AuthSession, "token"> = {
    viewer,
    patient,
    access,
    capabilities: access.capabilities,
    mode,
    expiresAt,
  };
  const token = jwt.sign({ viewerId: viewer.id, ...session }, env.jwtSecret, {
    expiresIn: "7d",
  });
  return { token, ...session };
};

const createViewer = (input: {
  authUserId: string;
  email: string;
  name: string;
  role: UserRole;
  licenseNumber?: string;
}) => {
  const existing = getState().users.find((user) => user.email.toLowerCase() === normalizeEmail(input.email));
  if (existing) {
    existing.authUserId = input.authUserId;
    existing.name = input.name || existing.name;
    existing.role = input.role;
    if (input.licenseNumber) {
      existing.licenseNumber = input.licenseNumber;
    }
    existing.lastLogin = new Date().toISOString();
    return existing;
  }

  const viewer: UserRecord = {
    id: nextId("user"),
    authUserId: input.authUserId,
    email: input.email,
    name: input.name,
    role: input.role,
    licenseNumber: input.licenseNumber,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    notificationPreferences: cloneNotificationPreferences(),
  };
  getState().users.unshift(viewer);
  return viewer;
};

const ensureViewerInState = (viewer: UserRecord) => {
  const existing = getState().users.find((user) => user.id === viewer.id);
  if (existing) {
    Object.assign(existing, viewer);
    return existing;
  }

  getState().users.unshift(viewer);
  return viewer;
};

const getPasswordResetLink = (token: string) =>
  `${env.frontendUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

const seedDemoPasswords = () => {
  [
    "demo@carecircle.ai",
    "james@carecircle.ai",
    "maria@carecircle.ai",
    "doctor@carecircle.ai",
  ].forEach((email) => setLocalPassword(email, defaultPassword));
};

seedDemoPasswords();

export const authService = {
  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    if (featureFlags.supabaseEnabled && supabasePublic) {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.user) {
        const metadata = (data.user.user_metadata ?? {}) as {
          full_name?: string;
          role?: string;
          license_number?: string;
        };
        const persistedViewer = await persistenceService.loadUserByAuthIdentity(data.user.id, normalizedEmail);
        const viewer =
          getState().users.find((user) => user.authUserId === data.user.id || user.email.toLowerCase() === normalizedEmail) ??
          (persistedViewer ? ensureViewerInState(persistedViewer) :
          createViewer({
            authUserId: data.user.id,
            email: normalizedEmail,
            name: metadata.full_name || normalizedEmail.split("@")[0],
            role: normalizeRole(metadata.role),
            licenseNumber: metadata.license_number,
          }));

        viewer.authUserId = data.user.id;
        viewer.lastLogin = new Date().toISOString();
        viewer.role = normalizeRole(metadata.role ?? viewer.role);
        if (metadata.full_name) viewer.name = metadata.full_name;
        if (metadata.license_number) viewer.licenseNumber = metadata.license_number;
        setLocalPassword(normalizedEmail, password);
        await persistenceService.persistUser(viewer);
        return await buildSession(viewer, "supabase");
      }
    }

    const viewer = getState().users.find((user) => user.email.toLowerCase() === normalizedEmail);
    const expectedPassword = localPasswords.get(normalizedEmail) ?? (viewer ? defaultPassword : null);
    if (!viewer || expectedPassword !== password) {
      throw new Error("The email or password looks incorrect. Please try again.");
    }

    viewer.lastLogin = new Date().toISOString();
    await persistenceService.persistUser(viewer);
    return await buildSession(viewer, "demo");
  },

  async signup(input: SignupInput) {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const password = input.password.trim();
    const role = normalizeRole(input.role);
    const licenseNumber = input.licenseNumber?.trim() || undefined;

    if (!name || !email || !password) {
      throw new Error("Please enter your name, email, and password.");
    }

    if (hasAccount(email)) {
      throw new Error("An account with this email already exists.");
    }

    let authUserId = `auth_local_${crypto.randomUUID()}`;
    let mode: "demo" | "supabase" = "demo";

    if (featureFlags.supabaseEnabled && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          role,
          license_number: licenseNumber,
        },
      });

      if (error) {
        if (/already/i.test(error.message)) {
          throw new Error("An account with this email already exists.");
        }
        throw new Error(error.message);
      }

      if (data.user) {
        authUserId = data.user.id;
        mode = "supabase";
      }
    }

    const viewer = createViewer({
      authUserId,
      email,
      name,
      role,
      licenseNumber,
    });
    viewer.lastLogin = new Date().toISOString();
    setLocalPassword(email, password);
    await persistenceService.persistUser(viewer);

    return await buildSession(viewer, mode);
  },

  async exchangeOAuthAccessToken(input: OAuthExchangeInput) {
    if (!featureFlags.supabaseEnabled || !supabaseAdmin) {
      throw new Error("Google sign-in is not available until Supabase is configured.");
    }

    const accessToken = input.accessToken.trim();
    if (!accessToken) {
      throw new Error("Google sign-in did not return an access token.");
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new Error("CareCircle could not verify that Google sign-in. Please try again.");
    }

    const normalizedEmail = normalizeEmail(data.user.email ?? "");
    if (!normalizedEmail) {
      throw new Error("Google did not return a usable email address.");
    }

    const metadata = (data.user.user_metadata ?? {}) as {
      full_name?: string;
      name?: string;
      role?: string;
      license_number?: string;
    };

    const persistedViewer = await persistenceService.loadUserByAuthIdentity(data.user.id, normalizedEmail);
    const inMemoryViewer = getState().users.find(
      (user) => user.authUserId === data.user.id || user.email.toLowerCase() === normalizedEmail,
    );

    if (!inMemoryViewer && !persistedViewer && !input.role) {
      throw new Error("This Google account is new to CareCircle. Start from Create account so we can choose the right role.");
    }

    const viewer =
      inMemoryViewer ??
      (persistedViewer ? ensureViewerInState(persistedViewer) :
      createViewer({
        authUserId: data.user.id,
        email: normalizedEmail,
        name: input.name?.trim() || metadata.full_name || metadata.name || normalizedEmail.split("@")[0],
        role: normalizeRole(input.role ?? metadata.role),
        licenseNumber: input.licenseNumber?.trim() || metadata.license_number,
      }));

    viewer.authUserId = data.user.id;
    viewer.lastLogin = new Date().toISOString();
    viewer.name = input.name?.trim() || metadata.full_name || metadata.name || viewer.name;
    viewer.role = persistedViewer?.role ?? viewer.role ?? normalizeRole(input.role ?? metadata.role);
    if (!persistedViewer?.role && input.role) {
      viewer.role = normalizeRole(input.role);
    }
    viewer.licenseNumber = input.licenseNumber?.trim() || viewer.licenseNumber || metadata.license_number;

    await persistenceService.persistUser(viewer);
    return await buildSession(viewer, "supabase");
  },

  async requestPasswordReset({ email }: PasswordResetRequest) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error("Please enter the email address for your account.");
    }

    if (!hasAccount(normalizedEmail)) {
      throw new Error("We could not find an account with that email address.");
    }

    const token = nextId("reset");
    passwordResetTokens.set(token, {
      email: normalizedEmail,
      expiresAt: Date.now() + passwordResetLifetimeMs,
    });

    const resetLink = getPasswordResetLink(token);
    await emailService.send(
      normalizedEmail,
      "Reset your CareCircle password",
      `
        <p style="font-family: Arial, sans-serif; line-height: 1.6;">
          We received a request to reset your CareCircle password.
        </p>
        <p style="font-family: Arial, sans-serif; line-height: 1.6;">
          <a href="${resetLink}">Reset your password</a>
        </p>
        <p style="font-family: Arial, sans-serif; line-height: 1.6; color: #64748b;">
          If you did not ask for this, you can safely ignore this email.
        </p>
      `,
    );

    return { message: "Reset link sent. Check your inbox." };
  },

  async confirmPasswordReset(token: string, password: string) {
    const record = passwordResetTokens.get(token);
    if (!record) {
      throw new Error("That reset link is no longer valid.");
    }

    if (record.expiresAt < Date.now()) {
      passwordResetTokens.delete(token);
      throw new Error("That reset link has expired. Please request a new one.");
    }

    if (!password.trim()) {
      throw new Error("Please enter a new password.");
    }

    const normalizedEmail = normalizeEmail(record.email);
    setLocalPassword(normalizedEmail, password.trim());

    const viewer = getState().users.find((user) => user.email.toLowerCase() === normalizedEmail);
    if (viewer && featureFlags.supabaseEnabled && supabaseAdmin && viewer.authUserId) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(viewer.authUserId, {
          password: password.trim(),
        });
      } catch (error) {
        console.warn("Unable to update Supabase password during reset:", error);
      }
    }

    passwordResetTokens.delete(token);
    return { message: "Password updated. You can sign in again now." };
  },

  getSessionFromToken(token?: string | null) {
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
      return {
        token,
        viewer: decoded.viewer,
        patient: decoded.patient,
        access: decoded.access,
        capabilities: decoded.capabilities,
        mode: decoded.mode,
        expiresAt: decoded.expiresAt,
      };
    } catch {
      return null;
    }
  },

  async resolveSessionFromToken(token?: string | null, requestedPatientId?: string | null) {
    const localSession = this.getSessionFromToken(token);
    if (localSession) {
      return localSession;
    }

    if (!token) {
      return null;
    }

    return buildSupabaseAccessSession(token, requestedPatientId);
  },
};
