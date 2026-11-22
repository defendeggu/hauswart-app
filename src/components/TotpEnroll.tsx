import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { ErrorText, Field, inputClass, primaryButtonClass } from "./ui";

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * 2FA (TOTP) einrichten: QR-Code mit einer Authenticator-App scannen
 * (z.B. Google Authenticator, Microsoft Authenticator, 1Password) und den
 * angezeigten 6-stelligen Code bestätigen.
 */
export function TotpEnroll({ onDone }: { onDone: () => void }) {
  const { refreshAal } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function start() {
      // Abgebrochene, nie bestätigte Einrichtungen zuerst entfernen, sonst
      // lehnt Supabase eine neue Einrichtung mit gleichem Namen ab.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Hauswart-App",
      });
      if (!active) return;
      if (enrollError || !data) {
        setError("Die 2FA-Einrichtung konnte nicht gestartet werden. Bitte später nochmals versuchen.");
        return;
      }
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    }

    start();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    });
    setSubmitting(false);
    if (verifyError) {
      setError("Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.");
      return;
    }
    await refreshAal();
    onDone();
  }

  if (!enrollment) {
    return error ? <ErrorText message={error} /> : <p className="text-sm text-slate-400">Lädt…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Authenticator-App öffnen (z.B. Google Authenticator, Microsoft Authenticator, 1Password).</li>
        <li>QR-Code scannen oder den Schlüssel von Hand eingeben.</li>
        <li>Den 6-stelligen Code aus der App unten eingeben.</li>
      </ol>
      <img
        src={enrollment.qrCode}
        alt="QR-Code für die Authenticator-App"
        className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2"
      />
      <p className="break-all text-xs text-slate-500">
        Schlüssel: <span className="font-mono text-slate-700">{enrollment.secret}</span>
      </p>
      <Field label="Code aus der App">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${inputClass} font-mono tracking-widest`}
        />
      </Field>
      <ErrorText message={error} />
      <button type="submit" disabled={submitting || code.length !== 6} className={primaryButtonClass}>
        Bestätigen
      </button>
    </form>
  );
}
