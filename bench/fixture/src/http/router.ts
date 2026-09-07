export interface Request {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  req: Request;
}

export type Handler = (ctx: RouteContext) => Response | Promise<Response>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export function json(status: number, payload: unknown): Response {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

export function text(status: number, body: string, contentType = "text/plain; charset=utf-8"): Response {
  return { status, headers: { "content-type": contentType }, body };
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method: method.toUpperCase(), segments: pattern.split("/").filter(Boolean), handler });
    return this;
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url, "http://local");
    const path = url.pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== req.method.toUpperCase()) continue;
      const params = match(route.segments, path);
      if (!params) continue;
      try {
        return await route.handler({ params, query: url.searchParams, req });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json(500, { error: { message } });
      }
    }
    return json(404, { error: { message: `no route for ${req.method} ${url.pathname}` } });
  }
}

function match(pattern: string[], path: string[]): Record<string, string> | null {
  if (pattern.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(path[i]);
    else if (p !== path[i]) return null;
  }
  return params;
}
