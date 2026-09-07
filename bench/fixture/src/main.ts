import { loadConfig } from "./config.js";
import { buildRouter } from "./http/handlers.js";
import { serve } from "./http/server.js";
import { JsonInvoiceRepository } from "./storage/jsonRepository.js";

const config = loadConfig();
const repo = new JsonInvoiceRepository(config.storage.file);
serve(buildRouter({ repo, config }), config.server.port, config.server.host);
