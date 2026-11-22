// Logins verwalten (nur für Admins): neues Login mit Initial-Passwort
// anlegen und Passwort zurücksetzen. Braucht den service_role-Key (Auth-User
// anlegen/ändern geht nur damit), darum hier und nie im Frontend. Sperren
// und Entsperren macht das Frontend direkt über profiles.aktiv (RLS).
//
// Hauswart-Logins bekommen eine interne Pseudo-E-Mail <id>@hauswart.internal
// (Login per Benutzername, siehe docs/PLAN.md Abschnitt 5), Admin-Logins
// ihre echte E-Mail-Adresse.
//
// TODO M4: zusätzlich aal2 (2FA) für den Aufrufer verlangen.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";

const INTERNAL_EMAIL_DOMAIN = "hauswart.internal";
const MIN_PASSWORD_LENGTH = 12;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9.-]{2,31}$/;
// Ohne leicht verwechselbare Zeichen (0/O, 1/l/I), weil das Passwort
// mündlich oder auf Papier weitergegeben wird.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

async function requireAdmin(req: Request, admin: SupabaseClient): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return false;
  const { data: profile } = await admin
    .from("profiles")
    .select("rolle, aktiv")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile?.rolle === "admin" && profile.aktiv === true;
}

interface CreateInput {
  action: "create";
  rolle: "hauswart" | "admin";
  username: string;
  name: string;
  family_id?: string;
  email?: string;
  password?: string;
}

interface ResetInput {
  action: "reset_password";
  user_id: string;
  password?: string;
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!(await requireAdmin(req, admin))) {
    return respond({ error: "Nur Admins dürfen Logins verwalten." }, 403);
  }

  let input: CreateInput | ResetInput;
  try {
    input = await req.json();
  } catch {
    return respond({ error: "Ungültiger Request-Body" }, 400);
  }

  if (input.action === "reset_password") {
    const password = input.password?.trim() || generatePassword();
    if (password.length < MIN_PASSWORD_LENGTH) {
      return respond({ error: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(input.user_id, { password });
    if (error) {
      return respond({ error: "Das Passwort konnte nicht gesetzt werden." }, 400);
    }
    return respond({ password }, 200);
  }

  if (input.action !== "create") {
    return respond({ error: "Unbekannte Aktion" }, 400);
  }

  const username = (input.username ?? "").trim().toLowerCase();
  const name = (input.name ?? "").trim();
  const password = input.password?.trim() || generatePassword();

  if (!USERNAME_PATTERN.test(username)) {
    return respond(
      { error: "Benutzername: 3-32 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt und Bindestrich." },
      400,
    );
  }
  if (!name) {
    return respond({ error: "Bitte einen Namen angeben." }, 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return respond({ error: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` }, 400);
  }
  if (input.rolle === "hauswart" && !input.family_id) {
    return respond({ error: "Bitte eine Familie wählen." }, 400);
  }
  if (input.rolle === "admin" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email ?? "")) {
    return respond({ error: "Admins brauchen eine gültige E-Mail-Adresse." }, 400);
  }
  if (input.rolle !== "hauswart" && input.rolle !== "admin") {
    return respond({ error: "Unbekannte Rolle" }, 400);
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (existing) {
    return respond({ error: "Dieser Benutzername ist schon vergeben." }, 409);
  }

  if (input.rolle === "hauswart") {
    const { data: activeLogin } = await admin
      .from("profiles")
      .select("id")
      .eq("family_id", input.family_id!)
      .eq("rolle", "hauswart")
      .eq("aktiv", true)
      .maybeSingle();
    if (activeLogin) {
      return respond(
        { error: "Diese Familie hat schon ein aktives Login. Zuerst das bestehende Login sperren." },
        409,
      );
    }
  }

  const userId = crypto.randomUUID();
  const email =
    input.rolle === "hauswart" ? `${userId}@${INTERNAL_EMAIL_DOMAIN}` : input.email!.trim().toLowerCase();

  const { error: createError } = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    const message = /already/i.test(createError.message)
      ? "Diese E-Mail-Adresse ist schon registriert."
      : "Das Login konnte nicht angelegt werden.";
    return respond({ error: message }, 400);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    family_id: input.rolle === "hauswart" ? input.family_id : null,
    username,
    name,
    rolle: input.rolle,
    aktiv: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return respond({ error: "Das Profil konnte nicht angelegt werden." }, 400);
  }

  return respond({ user_id: userId, username, password }, 200);
});
