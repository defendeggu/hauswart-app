// Löst einen Login-Benutzernamen (profiles.username) zur E-Mail-Adresse des
// Auth-Users auf: bei Hauswarten die interne Pseudo-Adresse
// <id>@hauswart.internal, bei Admins ihre echte Adresse (siehe docs/PLAN.md
// Abschnitt 5/8: Login per Benutzername). Öffentlich erreichbar (vor dem
// Login gibt es noch keine Session), darum:
// - kein Hinweis, ob ein Benutzername existiert (immer dieselbe Antwort)
// - einfaches Rate-Limiting über die Tabelle public.login_attempts
//
// Nutzt den service_role-Key, um profiles und login_attempts unabhängig von
// RLS zu lesen/schreiben - deshalb läuft dieser Code nur hier (Edge
// Function), nie im Frontend.

import { createClient } from "npm:@supabase/supabase-js@2";

const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

const GENERIC_RESPONSE = { error: "Benutzername oder Passwort ist falsch." };

// Der Browser ruft diese Function von einer anderen Origin auf (GitHub
// Pages), darum braucht es CORS inkl. Antwort auf den OPTIONS-Preflight.
// Bei einem Domain-Wechsel hier ergänzen (docs/PLAN.md Abschnitt 10).
const ALLOWED_ORIGINS = [
  "https://defendeggu.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    vary: "origin",
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

// ilike() baut ein SQL-ILIKE-Pattern; ohne Escaping könnte ein Benutzername
// mit "%" oder "_" ungewollt mehrere Zeilen treffen.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const respond = (payload: unknown, status: number) => jsonResponse(payload, status, cors);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  let username: unknown;
  try {
    const body = await req.json();
    username = body?.username;
  } catch {
    return respond({ error: "Ungültiger Request-Body" }, 400);
  }

  if (typeof username !== "string" || username.trim() === "" || username.length > 64) {
    return respond(GENERIC_RESPONSE, 400);
  }
  const normalizedUsername = username.trim().toLowerCase();
  const likePattern = escapeLikePattern(normalizedUsername);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count } = await supabaseAdmin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .ilike("username", likePattern)
    .gte("versucht_am", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return respond(
      { error: "Zu viele Versuche. Bitte in ein paar Minuten erneut versuchen." },
      429,
    );
  }

  await supabaseAdmin.from("login_attempts").insert({ username: normalizedUsername });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", likePattern)
    .eq("aktiv", true)
    .maybeSingle();

  if (!profile) {
    return respond(GENERIC_RESPONSE, 404);
  }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const email = authUser?.user?.email;
  if (!email) {
    return respond(GENERIC_RESPONSE, 404);
  }

  return respond({ email }, 200);
});
