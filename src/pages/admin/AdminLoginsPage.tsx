import { useState, type FormEvent } from "react";
import {
  createLogin,
  fetchFamilies,
  fetchLogins,
  resetPassword,
  setLoginActive,
  type Family,
  type LoginRow,
} from "../../lib/admin";
import { useAuth, type Rolle } from "../../lib/auth";
import { friendlyErrorMessage } from "../../lib/errors";
import { useLoad } from "../../lib/useLoad";
import {
  ErrorText,
  Field,
  Modal,
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../components/ui";

interface Credentials {
  username: string;
  password: string;
  title: string;
}

export function AdminLoginsPage() {
  const { profile } = useAuth();
  const data = useLoad(async () => {
    const [logins, families] = await Promise.all([fetchLogins(), fetchFamilies()]);
    return { logins, families };
  }, []);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const familyName = (id: string | null) => data.data?.families.find((f) => f.id === id)?.name ?? "";

  async function handleReset(login: LoginRow) {
    if (!confirm(`Neues Passwort für „${login.username}“ erzeugen? Das alte Passwort gilt dann nicht mehr.`)) return;
    setBusyId(login.id);
    setActionError(null);
    try {
      const { password } = await resetPassword(login.id);
      setCredentials({ username: login.username, password, title: "Neues Passwort" });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(login: LoginRow) {
    const action = login.aktiv ? "sperren" : "entsperren";
    if (!confirm(`Login „${login.username}“ ${action}?`)) return;
    setBusyId(login.id);
    setActionError(null);
    try {
      await setLoginActive(login.id, !login.aktiv);
      data.reload();
    } catch (err) {
      const message = (err as { message?: string }).message ?? "";
      setActionError(
        /one_active_hauswart/i.test(message)
          ? "Diese Familie hat schon ein anderes aktives Login. Zuerst jenes sperren."
          : friendlyErrorMessage(err as { message?: string }),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Logins</h1>
        <button type="button" onClick={() => setCreating(true)} disabled={!data.data} className={primaryButtonClass}>
          Login anlegen
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Pro Familie gibt es ein Hauswart-Login. Wechselt die zuständige Person, zuerst das alte Login
        sperren und dann ein neues anlegen.
      </p>

      <ErrorText message={data.error ?? actionError} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Benutzername</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Rolle / Familie</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.data?.logins.map((login) => (
              <tr key={login.id} className={login.aktiv ? "" : "text-slate-400"}>
                <td className="px-3 py-2 font-medium">{login.username}</td>
                <td className="px-3 py-2">{login.name}</td>
                <td className="px-3 py-2">
                  {login.rolle === "admin" ? "Admin" : `Hauswart · ${familyName(login.family_id)}`}
                </td>
                <td className="px-3 py-2">{login.aktiv ? "aktiv" : "gesperrt"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <span className="flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={busyId === login.id}
                      onClick={() => handleReset(login)}
                      className={linkButtonClass}
                    >
                      Passwort zurücksetzen
                    </button>
                    {login.id !== profile?.id && (
                      <button
                        type="button"
                        disabled={busyId === login.id}
                        onClick={() => handleToggle(login)}
                        className={`text-sm font-medium ${login.aktiv ? "text-red-600" : "text-teal-700"}`}
                      >
                        {login.aktiv ? "Sperren" : "Entsperren"}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && data.data && (
        <CreateLoginDialog
          families={data.data.families}
          logins={data.data.logins}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setCredentials({ ...created, title: "Login angelegt" });
            data.reload();
          }}
        />
      )}

      {credentials && <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}

function CreateLoginDialog({
  families,
  logins,
  onClose,
  onCreated,
}: {
  families: Family[];
  logins: LoginRow[];
  onClose: () => void;
  onCreated: (created: { username: string; password: string }) => void;
}) {
  const [rolle, setRolle] = useState<Rolle>("hauswart");
  const [familyId, setFamilyId] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ownPassword, setOwnPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const familiesWithoutLogin = families.filter(
    (f) => f.aktiv && !logins.some((l) => l.family_id === f.id && l.rolle === "hauswart" && l.aktiv),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createLogin({
        rolle,
        username: username.trim().toLowerCase(),
        name: name.trim(),
        family_id: rolle === "hauswart" ? familyId : undefined,
        email: rolle === "admin" ? email.trim() : undefined,
        password: ownPassword ? password : undefined,
      });
      onCreated(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Login anlegen" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Rolle">
          <select value={rolle} onChange={(e) => setRolle(e.target.value as Rolle)} className={inputClass}>
            <option value="hauswart">Hauswart (Familien-Login)</option>
            <option value="admin">Admin (Verwalter)</option>
          </select>
        </Field>

        {rolle === "hauswart" ? (
          <Field label="Familie">
            <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} required className={inputClass}>
              <option value="">– wählen –</option>
              {familiesWithoutLogin.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {familiesWithoutLogin.length === 0 && (
              <span className="mt-1 block text-xs text-slate-500">
                Alle aktiven Familien haben schon ein Login.
              </span>
            )}
          </Field>
        ) : (
          <Field label="E-Mail (echte Adresse des Admins)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
          </Field>
        )}

        <Field label="Benutzername (für den Login)">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoCapitalize="none"
            placeholder="z.B. familie-muster"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            3–32 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich.
          </span>
        </Field>

        <Field label="Name der Person">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ownPassword} onChange={(e) => setOwnPassword(e.target.checked)} className="h-5 w-5" />
          Initial-Passwort selbst festlegen (sonst wird eines erzeugt)
        </label>
        {ownPassword && (
          <Field label="Initial-Passwort (mind. 12 Zeichen)">
            <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required className={inputClass} />
          </Field>
        )}

        <ErrorText message={error} />

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {submitting ? "Legt an…" : "Anlegen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsDialog({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Benutzername: ${credentials.username}\nPasswort: ${credentials.password}`;

  return (
    <Modal title={credentials.title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Das Passwort wird nur jetzt angezeigt. Bitte der Person persönlich weitergeben. Nach dem
          ersten Login kann sie es unter „Passwort“ ändern.
        </p>
        <dl className="rounded-lg bg-slate-50 p-4 font-mono text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Benutzername</dt>
            <dd className="font-semibold">{credentials.username}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <dt className="text-slate-500">Passwort</dt>
            <dd className="font-semibold">{credentials.password}</dd>
          </div>
        </dl>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className={secondaryButtonClass}
          >
            {copied ? "Kopiert" : "Kopieren"}
          </button>
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            Fertig
          </button>
        </div>
      </div>
    </Modal>
  );
}
