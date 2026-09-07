import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, loadConfig } from "../../src/config.js";

describe("hidden: loadConfig tolerates partial files", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("uses defaults for an empty object", () => {
    dir = mkdtempSync(join(tmpdir(), "cfg-"));
    const file = join(dir, "config.json");
    writeFileSync(file, "{}");
    const cfg = loadConfig(file, {});
    expect(cfg.server).toEqual(DEFAULT_CONFIG.server);
    expect(cfg.listing).toEqual(DEFAULT_CONFIG.listing);
    expect(cfg.tax).toEqual(DEFAULT_CONFIG.tax);
    expect(cfg.storage).toEqual(DEFAULT_CONFIG.storage);
  });

  it("fills a missing port inside a present server block", () => {
    dir = mkdtempSync(join(tmpdir(), "cfg-"));
    const file = join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ server: { host: "0.0.0.0" } }));
    const cfg = loadConfig(file, {});
    expect(cfg.server.host).toBe("0.0.0.0");
    expect(cfg.server.port).toBe(DEFAULT_CONFIG.server.port);
  });

  it("still honours PORT", () => {
    dir = mkdtempSync(join(tmpdir(), "cfg-"));
    const file = join(dir, "config.json");
    writeFileSync(file, "{}");
    expect(loadConfig(file, { PORT: "9999" }).server.port).toBe(9999);
  });
});
