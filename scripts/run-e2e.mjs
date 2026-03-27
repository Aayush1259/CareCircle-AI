import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let shuttingDown = false;
let API_PORT = 4400;
let WEB_PORT = 4173;
let WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
let API_URL = `http://127.0.0.1:${API_PORT}`;

const run = (command, args, label, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code ?? "unknown"}`));
    });
  });

const start = (command, args, label, extraEnv = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      console.error(`${label} exited early with code ${code}`);
    }
  });
  children.push(child);
  return child;
};

const waitForPort = (port, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const startTime = Date.now();

    const attempt = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      socket
        .once("connect", () => {
          socket.end();
          resolve();
        })
        .once("error", () => {
          socket.destroy();
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Timed out waiting for port ${port}`));
            return;
          }
          setTimeout(attempt, 500);
        });
    };

    attempt();
  });

const findFreePort = (preferredPort) =>
  new Promise((resolve, reject) => {
    const attempt = (port) => {
      const server = net.createServer();
      server.unref();
      server.on("error", (error) => {
        server.close();
        if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
          attempt(port + 1);
          return;
        }
        reject(error);
      });
      server.listen(port, () => {
        const address = server.address();
        server.close(() => {
          if (address && typeof address === "object") resolve(address.port);
          else reject(new Error(`Unable to reserve port ${port}`));
        });
      });
    };

    attempt(preferredPort);
  });

const stopAll = () => {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      try {
        if (process.platform === "win32" && child.pid) {
          spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          child.kill("SIGTERM");
        }
      } catch {
        child.kill("SIGTERM");
      }
    }
  }
};

process.on("exit", stopAll);
process.on("SIGINT", () => {
  stopAll();
  process.exit(1);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(1);
});

try {
  API_PORT = await findFreePort(API_PORT);
  WEB_PORT = await findFreePort(WEB_PORT);
  API_URL = `http://127.0.0.1:${API_PORT}`;
  WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

  await run(npmCmd, ["run", "build:api"], "API build");
  await run(npmCmd, ["run", "build:web"], "Web build", {
    VITE_API_URL: `${API_URL}/api`,
  });

  start("node", [path.join(root, "apps", "api", "dist", "index.js")], "API server", {
    PORT: String(API_PORT),
    BACKEND_URL: API_URL,
    FRONTEND_URL: WEB_URL,
  });
  start(npmCmd, ["--workspace", "@carecircle/web", "run", "preview", "--", "--host", "127.0.0.1", "--port", String(WEB_PORT), "--strictPort"], "Web preview");

  await Promise.all([waitForPort(API_PORT), waitForPort(WEB_PORT)]);

  const playwrightCmd = process.platform === "win32"
    ? path.join(root, "apps", "web", "node_modules", ".bin", "playwright.cmd")
    : path.join(root, "apps", "web", "node_modules", ".bin", "playwright");
  await run(playwrightCmd, ["test", "--config", "apps/web/playwright.config.ts"], "Playwright", {
    PLAYWRIGHT_BASE_URL: WEB_URL,
  });
  stopAll();
} catch (error) {
  stopAll();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
