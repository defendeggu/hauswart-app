// Der Browser ruft die Functions von einer anderen Origin auf (GitHub
// Pages), darum braucht es CORS inkl. Antwort auf den OPTIONS-Preflight.
// Bei einem Domain-Wechsel hier ergänzen (docs/PLAN.md Abschnitt 10).
const ALLOWED_ORIGINS = [
  "https://defendeggu.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    vary: "origin",
  };
}

export function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
