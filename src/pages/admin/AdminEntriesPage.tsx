import { useMemo, useState } from "react";
import { fetchAllActivities, fetchEntries, fetchFamilies, type AdminEntry } from "../../lib/admin";
import { deleteEntry } from "../../lib/entries";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatChf, formatDate, formatHours } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import { EditEntryDialog } from "../../components/EditEntryDialog";
import { AdminNewEntryDialog } from "../../components/AdminNewEntryDialog";
import { ErrorText, Field, inputClass, linkButtonClass, primaryButtonClass } from "../../components/ui";

type SortKey = "datum" | "familie" | "taetigkeit" | "wert";

export function AdminEntriesPage() {
  const stammdaten = useLoad(async () => {
    const [families, activities] = await Promise.all([fetchFamilies(), fetchAllActivities()]);
    return { families, activities };
  }, []);

  const [familyId, setFamilyId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("datum");
  const [sortAsc, setSortAsc] = useState(false);
  const [editing, setEditing] = useState<AdminEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const entries = useLoad(
    () =>
      fetchEntries({
        familyId: familyId || undefined,
        activityId: activityId || undefined,
        von: von || undefined,
        bis: bis || undefined,
      }),
    [familyId, activityId, von, bis],
  );

  const familyName = useMemo(() => {
    const map = new Map(stammdaten.data?.families.map((f) => [f.id, f.name]));
    return (id: string) => map.get(id) ?? "?";
  }, [stammdaten.data]);

  const sorted = useMemo(() => {
    const list = [...(entries.data ?? [])];
    const value = (e: AdminEntry): string | number => {
      switch (sortKey) {
        case "datum":
          return e.datum;
        case "familie":
          return familyName(e.family_id);
        case "taetigkeit":
          return e.activities?.name ?? "";
        case "wert":
          return e.dauer_h ?? e.betrag_chf ?? 0;
      }
    };
    list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "de-CH");
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [entries.data, sortKey, sortAsc, familyName]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key !== "datum");
    }
  }

  async function handleDelete(entry: AdminEntry) {
    if (!confirm(`Eintrag vom ${formatDate(entry.datum)} (${familyName(entry.family_id)}) wirklich löschen?`)) return;
    try {
      await deleteEntry(entry.id);
      setActionError(null);
      entries.reload();
    } catch (err) {
      setActionError(friendlyErrorMessage(err as { message?: string }));
    }
  }

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>
      <button type="button" onClick={() => toggleSort(key)} className="hover:text-slate-700">
        {label}
        {sortKey === key ? (sortAsc ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Einträge</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!stammdaten.data}
          className={primaryButtonClass}
        >
          Nachtragen
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Familie">
          <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={inputClass}>
            <option value="">Alle</option>
            {stammdaten.data?.families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tätigkeit">
          <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className={inputClass}>
            <option value="">Alle</option>
            {stammdaten.data?.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Von">
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Bis">
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <ErrorText message={stammdaten.error ?? entries.error ?? actionError} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {header("datum", "Datum")}
              {header("familie", "Familie")}
              {header("taetigkeit", "Tätigkeit")}
              {header("wert", "Stunden / CHF", true)}
              <th className="px-3 py-2 font-medium">Bemerkung / Kommentar</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((entry) => {
              const offen = entry.periods?.status === "offen";
              return (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(entry.datum)}</td>
                  <td className="px-3 py-2">{familyName(entry.family_id)}</td>
                  <td className="px-3 py-2">{entry.activities?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {entry.dauer_h !== null
                      ? formatHours(entry.dauer_h)
                      : formatChf(Math.round((entry.betrag_chf ?? 0) * 100))}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {entry.bemerkung}
                    {entry.admin_kommentar && (
                      <span className="block text-amber-700">Admin: {entry.admin_kommentar}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {offen ? (
                      <span className="flex justify-end gap-3">
                        <button type="button" onClick={() => setEditing(entry)} className={linkButtonClass}>
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          className="text-sm font-medium text-red-600"
                        >
                          Löschen
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">abgeschlossen</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.data && sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Keine Einträge für diesen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditEntryDialog
          entry={editing}
          adminMode
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            entries.reload();
          }}
        />
      )}

      {creating && stammdaten.data && (
        <AdminNewEntryDialog
          families={stammdaten.data.families}
          activities={stammdaten.data.activities}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            entries.reload();
          }}
        />
      )}
    </div>
  );
}
