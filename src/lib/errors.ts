/**
 * Die Datenbank-Trigger werfen bereits deutsche Fehlermeldungen (siehe
 * supabase/migrations/..._entries.sql), die kommen hier unverändert durch.
 * Für alles andere (RLS-Verstösse, Constraint-Namen, Netzwerkfehler) zeigen
 * wir eine generische Meldung, statt technischen Postgres-Text.
 */
export function friendlyErrorMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? "";

  if (!message) {
    return "Etwas ist schiefgelaufen. Bitte nochmals versuchen.";
  }

  const looksTechnical =
    /violates|constraint|policy|syntax error|column|relation|duplicate key/i.test(message);

  if (looksTechnical) {
    return "Das hat nicht geklappt. Bitte die Angaben prüfen und nochmals versuchen.";
  }

  return message;
}
