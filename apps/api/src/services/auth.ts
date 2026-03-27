import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthSession, NotificationPreferences, UserRecord, UserRole } from "@carecircle/shared";
import { env, featureFlags } from "../env";
import { getPatient, getState, getViewer, getViewerById, nextId, setActiveUser } from "../store";
import { emailService } from "./email";
import { supabaseAdmin, supabasePublic } from "./supabase";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const defaultPassword = "Demo1234";
const passwordResetLifetimeMs = 1000 * 60 * 60;

interface TokenPayload {
  viewerId: string;
  mode: "demo" | "supabase";
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

const localPasswords = new Map<string, string>();
const passwordResetTokens = new Map<string, PasswordResetTokenRecord>();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeRole = (value?: string): UserRole => {
  if (value === "family_member" || value === "doctor" || value === "admin") return value;
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

const buildSession = (viewer: UserRecord, mode: "demo" | "supabase"): AuthSession => {
  setActiveUser(viewer.id);
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
  const token = jwt.sign({ viewerId: viewer.id, mode }, env.jwtSecret, {
    expiresIn: "7d",
  });
  return {
    token,
    viewer,
    patient: getPatient(),
    mode,
    expiresAt,
  };
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
        const viewer =
          getState().users.find((user) => user.authUserId === data.user.id || user.email.toLowerCase() === normalizedEmail) ??
          createViewer({
            authUserId: data.user.id,
            email: normalizedEmail,
            name: metadata.full_name || normalizedEmail.split("@")[0],
            role: normalizeRole(metadata.role),
            licenseNumber: metadata.license_number,
          });

        viewer.authUserId = data.user.id;
        viewer.lastLogin = new Date().toISOString();
        viewer.role = normalizeRole(metadata.role ?? viewer.role);
        if (metadata.full_name) viewer.name = metadata.full_name;
        if (metadata.license_number) viewer.licenseNumber = metadata.license_number;
        setLocalPassword(normalizedEmail, password);
        return buildSession(viewer, "supabase");
      }
    }

    const viewer = getState().users.find((user) => user.email.toLowerCase() === normalizedEmail);
    const expectedPassword = localPasswords.get(normalizedEmail) ?? (viewer ? defaultPassword : null);
    if (!viewer || expectedPassword !== password) {
      throw new Error("The email or password looks incorrect. Please try again.");
    }

    viewer.lastLogin = new Date().toISOString();
    return buildSession(viewer, "demo");
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

      if (!error && data.user) {
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

    return buildSession(viewer, mode);
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
      const viewer = getViewerById(decoded.viewerId);
      if (!viewer) return null;
      return buildSession(viewer, decoded.mode);
    } catch {
      return null;
    }
  },
};
