# LedgerLite

A small invoicing service. It stores invoices in a JSON file and exposes them over HTTP.

- `src/domain/` holds money arithmetic, pricing rules and the invoice model. No I/O.
- `src/storage/` reads and writes `data/invoices.json`.
- `src/http/` is the HTTP layer: a tiny router, the handlers, and the server bootstrap.
- `src/config.ts` loads `data/config.json` and environment overrides.
- `src/cli.ts` lists and adds invoices from the command line.

Run `npm test` for the suite, `npm run lint` for type checks, `npm start` to serve on the configured port.

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/invoices?page=1&size=20` | paginated list, newest first |
| GET | `/invoices/:id` | one invoice with computed totals |
| POST | `/invoices` | create; body is `{ customer, currency, lines: [{ description, quantity, unitPriceCents }] }` |
