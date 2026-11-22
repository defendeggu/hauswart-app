import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  deleteEntry,
  fetchMyEntries,
  heuteIso,
  nachtragsfristEnde,
  type Entry,
} from "../lib/entries";
import { friendlyErrorMessage } from "../lib/errors";
import { formatChf, formatDate, formatHours } from "../lib/format";
import { EditEntryDialog } from "../components/EditEntryDialog";

interface PeriodGroup {
  periodId: string;
  name: string;
  status: "offen" | "abgeschlossen";
  von: string;
  bis: string;
  stundensatzChf: number;
  entries: Entry[];
  stundenTotal: number;
  auslagenRappen: number;
}

interface MonthGroup {
  key: string;
  label: string;
  entries: Entry[];
}

function monthLabel(datum: string): string {
  const date = new Date(`${datum}T00:00:00`);
  return date.toLocaleDateString("de-CH", { month: "long", year: "numeric" });
}

function groupByPeriod(entries: Entry[]): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();

  for (const entry of entries) {
    const info = entry.periods;
    if (!info) continue;

    let group = groups.get(entry.period_id);
    if (!group) {
      group = {
        periodId: entry.period_id,
        name: info.name,
        status: info.status,
        von: info.von,
        bis: info.bis,
        stundensatzChf: info.stundensatz_chf,
        entries: [],
        stundenTotal: 0,
        auslagenRappen: 0,
      };
      groups.set(entry.period_id, group);
    }

    group.entries.push(entry);
    if (entry.dauer_h) group.stundenTotal += entry.dauer_h;
    if (entry.betrag_chf) group.auslagenRappen += Math.round(entry.betrag_chf * 100);
  }

  return [...groups.values()].sort((a, b) => b.von.localeCompare(a.von));
}

function groupByMonth(entries: Entry[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const entry of entries) {
    const key = entry.datum.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: monthLabel(entry.datum), entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function MyEntriesPage() {
  const { profile } = useAuth();
  const familyId = profile!.family_id!;

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  async function reload() {
    try {
      setEntries(await fetchMyEntries(familyId));
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const periodGroups = useMemo(() => (entries ? groupByPeriod(entries) : []), [entries]);

  async function handleDelete(entry: Entry) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    try {
      await deleteEntry(entry.id);
      await reload();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    }
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }

  if (!entries) {
    return <p className="p-4 text-sm text-slate-400">Lädt…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-24">
      <h1 className="text-lg font-semibold text-slate-900">Meine Einträge</h1>

      {periodGroups.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">Noch keine Einträge erfasst.</p>
      )}

      <div className="mt-4 space-y-6">
        {periodGroups.map((group) => {
          const guthabenRappen =
            Math.round(group.stundenTotal * group.stundensatzChf * 100) + group.auslagenRappen;
          const istAbgelaufenOffen = group.status === "offen" && group.bis < heuteIso();

          return (
            <section key={group.periodId}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{group.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    group.status === "offen"
                      ? "bg-teal-50 text-teal-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {group.status === "offen" ? "offen" : "abgeschlossen"}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {formatHours(group.stundenTotal)} · Auslagen {formatChf(group.auslagenRappen)} ·
                Guthaben {formatChf(guthabenRappen)}
              </p>

              {istAbgelaufenOffen && (
                <p className="mt-1 text-xs text-amber-700">
                  Nachträge möglich bis {formatDate(nachtragsfristEnde(group.bis).toISOString().slice(0, 10))}.
                </p>
              )}

              <div className="mt-3 space-y-4">
                {groupByMonth(group.entries).map((month) => (
                  <div key={month.key}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {month.label}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {month.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900">
                              {entry.activities?.name}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {entry.dauer_h
                                ? formatHours(entry.dauer_h)
                                : formatChf(Math.round((entry.betrag_chf ?? 0) * 100))}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{formatDate(entry.datum)}</p>
                          {entry.bemerkung && (
                            <p className="mt-1 text-sm text-slate-600">{entry.bemerkung}</p>
                          )}
                          {entry.admin_kommentar && (
                            <p className="mt-1 text-sm text-amber-700">
                              Kommentar Admin: {entry.admin_kommentar}
                            </p>
                          )}

                          {group.status === "offen" && (
                            <div className="mt-2 flex gap-3">
                              <button
                                type="button"
                                onClick={() => setEditing(entry)}
                                className="text-sm font-medium text-teal-700"
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry)}
                                className="text-sm font-medium text-red-600"
                              >
                                Löschen
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <EditEntryDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
