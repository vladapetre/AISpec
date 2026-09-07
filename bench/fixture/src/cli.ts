import { loadConfig } from "./config.js";
import { computeTotals } from "./domain/invoice.js";
import { formatCents } from "./domain/money.js";
import { JsonInvoiceRepository } from "./storage/jsonRepository.js";

const [, , command = "list", ...rest] = process.argv;
const config = loadConfig();
const repo = new JsonInvoiceRepository(config.storage.file);

switch (command) {
  case "list": {
    for (const inv of repo.all()) {
      const totals = computeTotals(inv, config.tax.ratePercent);
      console.log(`${inv.id}\t${inv.customer}\t${formatCents(totals.totalCents, inv.currency)}`);
    }
    break;
  }
  case "show": {
    const inv = repo.byId(rest[0] ?? "");
    if (!inv) {
      console.error(`invoice ${rest[0]} not found`);
      process.exit(2);
    }
    console.log(JSON.stringify({ ...inv, totals: computeTotals(inv, config.tax.ratePercent) }, null, 2));
    break;
  }
  default:
    console.error(`unknown command ${command}; use list | show <id>`);
    process.exit(2);
}
