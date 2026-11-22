import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { friendlyErrorMessage } from "../lib/errors";
import { TotpEnroll } from "../components/TotpEnroll";
import {
  ErrorText,
  Field,
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../components/ui";

const MIN_LENGTH = 12;

export function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-10 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Konto</h1>
        <Link to="/" className={linkButtonClass}>
          Zurück
        </Link>
      </div>
      <PasswordSection />
      <TwoFactorSection />
    </div>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
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
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Passwort ändern</h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
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
        {done && (
          <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
            Das Passwort wurde geändert.
          </p>
        )}
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          Passwort speichern
        </button>
      </form>
    </section>
  );
}

function TwoFactorSection() {
  const { profile, refreshAal } = useAuth();
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp[0]?.id ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove() {
    if (!factorId) return;
    if (!confirm("2FA wirklich ausschalten? Danach reicht wieder das Passwort zum Anmelden.")) return;
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setError("Die 2FA konnte nicht ausgeschaltet werden.");
      return;
    }
    await refreshAal();
    load();
  }

  const isAdmin = profile?.rolle === "admin";

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Zwei-Faktor-Anmeldung (2FA)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Mit 2FA fragt die App beim Login zusätzlich nach einem Code aus einer Authenticator-App.
        {isAdmin ? " Für Admins ist das Pflicht." : " Für Familien ist das freiwillig."}
      </p>

      <div className="mt-3">
        {factorId === undefined && <p className="text-sm text-slate-400">Lädt…</p>}

        {factorId && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-medium text-teal-700">2FA ist eingeschaltet</span>
            {!isAdmin && (
              <button type="button" onClick={remove} className="text-sm font-medium text-red-600">
                Ausschalten
              </button>
            )}
          </div>
        )}

        {factorId === null && !enrolling && (
          <button type="button" onClick={() => setEnrolling(true)} className={secondaryButtonClass}>
            2FA einrichten
          </button>
        )}

        {factorId === null && enrolling && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <TotpEnroll
              onDone={() => {
                setEnrolling(false);
                load();
              }}
            />
          </div>
        )}

        <ErrorText message={error} />
      </div>
    </section>
  );
}
