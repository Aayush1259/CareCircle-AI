import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const frontendOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: frontendOrigins[0] ?? "http://localhost:5173",
  frontendOrigins,
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:4000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "carecircle-documents",
  jwtSecret: process.env.JWT_SECRET ?? "carecircle-demo-secret",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM ?? "CareCircle AI <noreply@carecircle.ai>",
};

export const featureFlags = {
  openAiEnabled: Boolean(env.openAiApiKey),
  supabaseEnabled: Boolean(env.supabaseUrl && env.supabaseServiceKey),
  smtpEnabled: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
};
