import { createServer } from "./server";
import { env } from "./env";

const app = createServer();

app.listen(env.port, () => {
  console.info(`CareCircle API listening on http://localhost:${env.port}`);
});
