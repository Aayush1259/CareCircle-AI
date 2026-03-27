import jwt from "jsonwebtoken";
import type { AuthSession, UserRecord } from "@carecircle/shared";
import { env, featureFlags } from "../env";
import { getPatient, getState, getViewerById, setActiveUser } from "../store";
import { supabasePublic } from "./supabase";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;

interface TokenPayload {
  viewerId: string;
  mode: "demo" | "supabase";
}

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

export const authService = {
  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (featureFlags.supabaseEnabled && supabasePublic) {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.user) {
        const viewer =
          getState().users.find((user) => user.authUserId === data.user.id || user.email.toLowerCase() === normalizedEmail) ??
          getState().users.find((user) => user.email.toLowerCase() === normalizedEmail);

        if (viewer) {
          viewer.authUserId = data.user.id;
          viewer.lastLogin = new Date().toISOString();
          return buildSession(viewer, "supabase");
        }
      }
    }

    const viewer =
      getState().users.find((user) => user.email.toLowerCase() === normalizedEmail) ??
      getState().users.find((user) => user.email.toLowerCase() === "demo@carecircle.ai");

    if (!viewer || password !== "Demo1234") {
      throw new Error("The email or password looks incorrect. Please try again.");
    }

    viewer.lastLogin = new Date().toISOString();
    return buildSession(viewer, "demo");
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
