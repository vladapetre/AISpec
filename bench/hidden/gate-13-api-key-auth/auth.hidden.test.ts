import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

// Black-box: the task says "wire it in front of the router so handlers stay unaware", so the only
// contract the grader may hold the candidate to is the HTTP surface with API_KEY set. Earlier
// versions of this test discovered the guard by function signature and failed two legitimate designs
// ((handler, key) vs (handler, { apiKey }) vs a guard closing over loaded config). The app boots via
// the project's own start script; the key arrives the way the task names: the API_KEY variable.
const KEY = "hidden-test-secret";
let child: ChildProcess | null = null;
let base = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url: string, ms: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) });
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not answer on ${url} within ${ms} ms`);
}

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn("npm", ["start"], { cwd: process.cwd(), shell: true, env: { ...process.env, PORT: String(port), API_KEY: KEY }, stdio: "ignore", windowsHide: true });
  await waitFor(`${base}/health`, 30_000);
}, 40_000);

afterAll(() => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else process.kill(-child.pid!, "SIGKILL");
});

describe("hidden: API key guard over HTTP", () => {
  it("lets /health through without a key", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
  });

  it("rejects a missing key with 401 and the agreed body", async () => {
    const res = await fetch(`${base}/invoices`);
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe("unauthorized");
  });

  it("rejects a wrong key", async () => {
    const res = await fetch(`${base}/invoices`, { headers: { "x-api-key": "nope" } });
    expect(res.status).toBe(401);
  });

  it("accepts the right key", async () => {
    const res = await fetch(`${base}/invoices`, { headers: { "x-api-key": KEY } });
    expect(res.status).toBe(200);
  });
});
