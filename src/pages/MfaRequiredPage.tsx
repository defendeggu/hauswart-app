import { useAuth } from "../lib/auth";
import { TotpEnroll } from "../components/TotpEnroll";
import { linkButtonClass } from "../components/ui";

/** Admins ohne 2FA landen hier, bevor sie den Admin-Bereich nutzen können. */
export function MfaRequiredPage() {
  const { signOut } = useAuth();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900">2FA einrichten</h1>
      <p className="mt-2 text-sm text-slate-600">
        Für den Admin-Bereich ist die Zwei-Faktor-Anmeldung Pflicht. Du brauchst dafür eine
        Authenticator-App auf dem Handy. Danach fragt die App bei jedem Login nach einem Code.
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <TotpEnroll onDone={() => undefined} />
      </div>
      <button type="button" onClick={() => signOut()} className={`${linkButtonClass} mt-6`}>
        Abmelden
      </button>
    </div>
  );
}
