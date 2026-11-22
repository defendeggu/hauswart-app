import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { ErrorText, Field, inputClass, linkButtonClass, primaryButtonClass } from "../components/ui";

/** Zweiter Schritt beim Login, wenn 2FA eingerichtet ist. */
export function MfaChallengePage() {
  const { refreshAal, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (!factor) {
      setSubmitting(false);
      setError("Keine 2FA gefunden. Bitte beim Verwalter melden.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    });
    setSubmitting(false);
    if (verifyError) {
      setError("Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.");
      setCode("");
      return;
    }
    await refreshAal();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bestätigungscode</h1>
          <p className="mt-1 text-sm text-slate-500">
            Den 6-stelligen Code aus der Authenticator-App eingeben.
          </p>
        </div>
        <Field label="Code">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} h-12 font-mono text-lg tracking-widest`}
          />
        </Field>
        <ErrorText message={error} />
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className={`${primaryButtonClass} h-12 w-full`}
        >
          {submitting ? "Prüft…" : "Bestätigen"}
        </button>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Handy verloren? Beim Verwalter melden.</span>
          <button type="button" onClick={() => signOut()} className={linkButtonClass}>
            Abmelden
          </button>
        </div>
      </form>
    </div>
  );
}
