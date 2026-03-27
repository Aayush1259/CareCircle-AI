import { createServer } from "./server";
import { env } from "./env";
import { initializeSupabaseDemoSeed } from "./services/demoSeed";

const bootstrap = async () => {
  try {
    await initializeSupabaseDemoSeed();
  } catch (error) {
    console.warn("Unable to initialize Supabase demo accounts:", error);
  }

  const app = createServer();
  app.listen(env.port, () => {
    console.info(`CareCircle API listening on http://localhost:${env.port}`);
  });
};

void bootstrap();
