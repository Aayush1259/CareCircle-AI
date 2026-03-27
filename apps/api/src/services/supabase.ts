import { createClient } from "@supabase/supabase-js";
import { env, featureFlags } from "../env";

export const supabaseAdmin = featureFlags.supabaseEnabled
  ? createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const supabasePublic = featureFlags.supabaseEnabled && env.supabaseAnonKey
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
