import { useState, type FormEvent } from "react";
import {
  fetchActivityIdsInUse,
  fetchAllActivities,
  fetchFamilies,
  saveActivity,
  type ActivityInput,
  type Family,
} from "../../lib/admin";
import type { Activity } from "../../lib/entries";
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

export function AdminActivitiesPage() {
  const data = useLoad(async () => {
    const [activities, families, inUse] = await Promise.all([
      fetchAllActivities(),
      fetchFamilies(),
      fetchActivityIdsInUse(),
    ]);
    return { activities, families, inUse };
  }, []);
  const [editing, setEditing] = useState<ActivityInput | null>(null);

  const familyNames = (ids: string[] | null) =>
    ids?.map((id) => data.data?.families.find((f) => f.id === id)?.name ?? "?").join(", ");

  function newActivity(): ActivityInput {
    const maxSort = Math.max(0, ...(data.data?.activities.map((a) => a.sortierung) ?? []));
    return {
      name: "",
      aktiv: true,
      sortierung: maxSort + 10,
      einheit: "stunden",
      bemerkung_pflicht: false,
      nur_familien: null,
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Tätigkeiten</h1>
        <button type="button" onClick={() => setEditing(newActivity())} className={primaryButtonClass}>
          Tätigkeit hinzufügen
        </button>
      </div>

      <ErrorText message={data.error} />

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data.data?.activities.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className={`text-sm font-medium ${a.aktiv ? "text-slate-900" : "text-slate-400"}`}>
                {a.name}
                {!a.aktiv && " (inaktiv)"}
              </p>
              <p className="text-xs text-slate-500">
                {a.einheit === "stunden" ? "Stunden" : "Franken"}
                {a.bemerkung_pflicht && " · Bemerkung Pflicht"}
                {a.nur_familien && ` · nur für: ${familyNames(a.nur_familien)}`}
              </p>
            </div>
            <button type="button" onClick={() => setEditing(a)} className={linkButtonClass}>
              Bearbeiten
            </button>
          </li>
        ))}
      </ul>

      {editing && data.data && (
        <ActivityDialog
          activity={editing}
          families={data.data.families}
          einheitLocked={Boolean(editing.id && data.data.inUse.has(editing.id))}
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

function ActivityDialog({
  activity,
  families,
  einheitLocked,
  onClose,
  onSaved,
}: {
  activity: ActivityInput | Activity;
  families: Family[];
  einheitLocked: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ActivityInput>({ ...activity });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const restricted = values.nur_familien !== null;

  function toggleFamily(id: string) {
    const current = values.nur_familien ?? [];
    const next = current.includes(id) ? current.filter((f) => f !== id) : [...current, id];
    setValues({ ...values, nur_familien: next });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (restricted && values.nur_familien!.length === 0) {
      setError("Bitte mindestens eine Familie wählen oder die Einschränkung aufheben.");
      return;
    }
    setSubmitting(true);
    try {
      await saveActivity({ ...values, name: values.name.trim() });
      onSaved();
    } catch (err) {
      const message = (err as { message?: string }).message ?? "";
      setError(
        /activities_name_key|duplicate/i.test(message)
          ? "Eine Tätigkeit mit diesem Namen gibt es schon."
          : friendlyErrorMessage(err as { message?: string }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={activity.id ? "Tätigkeit bearbeiten" : "Tätigkeit hinzufügen"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            required
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Einheit">
            <select
              value={values.einheit}
              disabled={einheitLocked}
              onChange={(e) => setValues({ ...values, einheit: e.target.value as ActivityInput["einheit"] })}
              className={inputClass}
            >
              <option value="stunden">Stunden</option>
              <option value="franken">Franken</option>
            </select>
          </Field>
          <Field label="Sortierung">
            <input
              type="number"
              value={values.sortierung}
              onChange={(e) => setValues({ ...values, sortierung: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        {einheitLocked && (
          <p className="text-xs text-slate-500">
            Die Einheit ist gesperrt, weil schon Einträge zu dieser Tätigkeit existieren.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.bemerkung_pflicht}
            onChange={(e) => setValues({ ...values, bemerkung_pflicht: e.target.checked })}
            className="h-5 w-5"
          />
          Bemerkung ist Pflicht
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={restricted}
            onChange={(e) => setValues({ ...values, nur_familien: e.target.checked ? [] : null })}
            className="h-5 w-5"
          />
          Nur für bestimmte Familien
        </label>

        {restricted && (
          <div className="space-y-1 rounded-lg border border-slate-200 p-3">
            {families
              .filter((f) => f.aktiv || values.nur_familien!.includes(f.id))
              .map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={values.nur_familien!.includes(f.id)}
                    onChange={() => toggleFamily(f.id)}
                    className="h-5 w-5"
                  />
                  {f.name}
                </label>
              ))}
            {families.length === 0 && <p className="text-sm text-slate-500">Noch keine Familien erfasst.</p>}
          </div>
        )}

        {activity.id && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.aktiv}
              onChange={(e) => setValues({ ...values, aktiv: e.target.checked })}
              className="h-5 w-5"
            />
            Aktiv (inaktive Tätigkeiten können nicht mehr erfasst werden)
          </label>
        )}

        <ErrorText message={error} />

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={submitting || values.name.trim() === ""} className={primaryButtonClass}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
