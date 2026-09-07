// Port hygiene for bench runs. Every run gets its own PORT so two runs (or a run and a leftover
// server from an earlier one) never fight over 8080, and whatever is still listening on that port
// when the run ends is killed, so no orphan survives into the next run's measurements.
import { execSync } from "node:child_process";

const FIRST = 8100;
const SPAN = 800;
let seq = 0;

/** A port unique to this run within the process, derived from a counter so records stay readable. */
export function nextPort() {
  return FIRST + (seq++ % SPAN);
}

export function listenerPids(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8", windowsHide: true });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
        if (m && Number(m[1]) === port && Number(m[2]) > 0) pids.add(Number(m[2]));
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

/** Kill every process still listening on the port; returns the pids it went after. */
export function killListeners(port) {
  const pids = listenerPids(port);
  for (const pid of pids) {
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore", windowsHide: true });
      else process.kill(pid, "SIGKILL");
    } catch {}
  }
  return pids;
}
