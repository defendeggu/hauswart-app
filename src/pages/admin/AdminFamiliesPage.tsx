import { useState, type FormEvent } from "react";
import { fetchFamilies, fetchLogins, saveFamily, type Family } from "../../lib/admin";
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

export function AdminFamiliesPage() {
  const data = useLoad(async () => {
    const [families, logins] = await Promise.all([fetchFamilies(), fetchLogins()]);
    return { families, logins };
  }, []);
  const [editing, setEditing] = useState<Partial<Family> | null>(null);

  const loginFor = (familyId: string) =>
    data.data?.logins.find((l) => l.family_id === familyId && l.rolle === "hauswart" && l.aktiv);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Familien</h1>
        <button type="button" onClick={() => setEditing({ name: "", aktiv: true })} className={primaryButtonClass}>
          Familie hinzufügen
        </button>
      </div>

      <ErrorText message={data.error} />

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data.data?.families.map((family) => {
          const login = loginFor(family.id);
          return (
            <li key={family.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className={`text-sm font-medium ${family.aktiv ? "text-slate-900" : "text-slate-400"}`}>
                  {family.name}
                  {!family.aktiv && " (inaktiv)"}
                </p>
                <p className="text-xs text-slate-500">
                  {login ? `Login: ${login.username}` : "Noch kein aktives Login – unter „Logins“ anlegen"}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(family)} className={linkButtonClass}>
                Bearbeiten
              </button>
            </li>
          );
        })}
        {data.data?.families.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">Noch keine Familien erfasst.</li>
        )}
      </ul>

      {editing && (
        <FamilyDialog
          family={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            data.reload();
          }}
        />
      )}
    </div>
  );
}

function FamilyDialog({
  family,
  onClose,
  onSaved,
}: {
  family: Partial<Family>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(family.name ?? "");
  const [aktiv, setAktiv] = useState(family.aktiv ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await saveFamily({ id: family.id, name: name.trim(), aktiv });
      onSaved();
    } catch (err) {
      const message = (err as { message?: string }).message ?? "";
      setError(
        /families_name_key|duplicate/i.test(message)
          ? "Eine Familie mit diesem Namen gibt es schon."
          : friendlyErrorMessage(err as { message?: string }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={family.id ? "Familie bearbeiten" : "Familie hinzufügen"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </Field>
        {family.id && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} className="h-5 w-5" />
            Aktiv (inaktive Familien erscheinen nicht mehr in Auswahllisten)
          </label>
        )}
        <ErrorText message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={submitting || name.trim() === ""} className={primaryButtonClass}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
