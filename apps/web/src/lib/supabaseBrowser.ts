import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasBrowserSupabaseAuth = Boolean(supabaseUrl && supabaseAnonKey);

export const browserSupabase = hasBrowserSupabaseAuth
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
      },
    })
  : null;

export const googleAuthContextStorageKey = "carecircle_google_auth_context";

export interface GoogleAuthContext {
  mode: "login" | "signup";
  role?: "caregiver" | "family_member" | "doctor";
  licenseNumber?: string;
  name?: string;
  inviteToken?: string;
}
