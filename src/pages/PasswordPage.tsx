import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { friendlyErrorMessage } from "../lib/errors";
import { ErrorText, Field, inputClass, linkButtonClass, primaryButtonClass } from "../components/ui";

const MIN_LENGTH = 12;

export function PasswordPage() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_LENGTH} Zeichen haben.`);
      return;
    }
    if (password !== repeat) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(
        /same|different/i.test(updateError.message)
          ? "Das neue Passwort muss sich vom bisherigen unterscheiden."
          : /weak|pwned|leaked/i.test(updateError.message)
            ? "Dieses Passwort ist zu schwach oder bekannt geworden. Bitte ein anderes wählen."
            : friendlyErrorMessage(updateError),
      );
      return;
    }
    setPassword("");
    setRepeat("");
    setDone(true);
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-8">
      <h1 className="text-lg font-semibold text-slate-900">Passwort ändern</h1>

      {done ? (
        <div className="mt-4 space-y-4">
          <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
            Das Passwort wurde geändert.
          </p>
          <Link to="/" className={linkButtonClass}>
            Zurück
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label={`Neues Passwort (mind. ${MIN_LENGTH} Zeichen)`}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Neues Passwort wiederholen">
            <input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={inputClass}
            />
          </Field>
          <ErrorText message={error} />
          <div className="flex items-center justify-between">
            <Link to="/" className={linkButtonClass}>
              Abbrechen
            </Link>
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              Speichern
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
