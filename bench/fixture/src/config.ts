import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Config {
  server: { port: number; host: string };
  listing: { defaultPageSize: number; maxPageSize: number };
  tax: { ratePercent: number };
  storage: { file: string };
}

export const DEFAULT_CONFIG: Config = {
  server: { port: 8080, host: "127.0.0.1" },
  listing: { defaultPageSize: 20, maxPageSize: 100 },
  tax: { ratePercent: 7 },
  storage: { file: "data/invoices.json" },
};

export function loadConfig(path = "data/config.json", env: NodeJS.ProcessEnv = process.env): Config {
  const raw = JSON.parse(readFileSync(resolve(path), "utf8")) as Partial<Config>;
  const cfg: Config = {
    server: { port: raw.server!.port, host: raw.server!.host },
    listing: {
      defaultPageSize: raw.listing?.defaultPageSize ?? DEFAULT_CONFIG.listing.defaultPageSize,
      maxPageSize: raw.listing?.maxPageSize ?? DEFAULT_CONFIG.listing.maxPageSize,
    },
    tax: { ratePercent: raw.tax?.ratePercent ?? DEFAULT_CONFIG.tax.ratePercent },
    storage: { file: raw.storage?.file ?? DEFAULT_CONFIG.storage.file },
  };
  if (env.PORT) cfg.server.port = Number(env.PORT);
  if (env.LEDGER_FILE) cfg.storage.file = env.LEDGER_FILE;
  return cfg;
}
