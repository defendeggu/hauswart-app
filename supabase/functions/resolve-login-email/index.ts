// Löst einen Login-Benutzernamen (profiles.username) zur internen
// Pseudo-E-Mail-Adresse auf, die Supabase Auth intern für diesen Hauswart-
// User verwendet (siehe docs/PLAN.md Abschnitt 5/8: Login per Benutzername,
// kein echter E-Mail-Login für Familien). Öffentlich erreichbar (vor dem
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
const INTERNAL_EMAIL_DOMAIN = "hauswart.internal";

const GENERIC_RESPONSE = { error: "Benutzername oder Passwort ist falsch." };

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ilike() baut ein SQL-ILIKE-Pattern; ohne Escaping könnte ein Benutzername
// mit "%" oder "_" ungewollt mehrere Zeilen treffen.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let username: unknown;
  try {
    const body = await req.json();
    username = body?.username;
  } catch {
    return jsonResponse({ error: "Ungültiger Request-Body" }, 400);
  }

  if (typeof username !== "string" || username.trim() === "" || username.length > 64) {
    return jsonResponse(GENERIC_RESPONSE, 400);
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
    return jsonResponse(
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
    return jsonResponse(GENERIC_RESPONSE, 404);
  }

  return jsonResponse({ email: `${profile.id}@${INTERNAL_EMAIL_DOMAIN}` }, 200);
});
