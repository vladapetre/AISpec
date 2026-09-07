import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Router, Request } from "./router.js";

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function serve(router: Router, port: number, host: string) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "body is not valid JSON" } }));
      return;
    }
    const request: Request = {
      method: req.method ?? "GET",
      url: req.url ?? "/",
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v])),
      body,
    };
    const response = await router.handle(request);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  });

  server.on("error", () => {
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`ledgerlite listening on http://${host}:${port}`);
  });
  return server;
}
