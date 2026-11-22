import { useMemo, useState } from "react";
import {
  fetchAllActivities,
  fetchAuditLog,
  fetchFamilies,
  fetchLogins,
  fetchPeriods,
  type AuditRow,
} from "../../lib/admin";
import { useLoad } from "../../lib/useLoad";
import { ErrorText, Field, inputClass } from "../../components/ui";

const TABELLEN: Record<string, string> = {
  entries: "Einträge",
  periods: "Perioden",
  families: "Familien",
  activities: "Tätigkeiten",
  profiles: "Logins",
};

const AKTIONEN: Record<AuditRow["aktion"], string> = {
  insert: "neu",
  update: "geändert",
  delete: "gelöscht",
};

const IGNORED_FIELDS = new Set(["id", "created_at", "updated_at"]);

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

export function AdminAuditPage() {
  const lookups = useLoad(async () => {
    const [families, activities, periods, logins] = await Promise.all([
      fetchFamilies(),
      fetchAllActivities(),
      fetchPeriods(),
      fetchLogins(),
    ]);
    return { families, activities, periods, logins };
  }, []);

  const [tabelle, setTabelle] = useState("");
  const [wer, setWer] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");

  const rows = useLoad(
    () =>
      fetchAuditLog({
        tabelle: tabelle || undefined,
        wer: wer || undefined,
        von: von || undefined,
        bis: bis || undefined,
      }),
    [tabelle, wer, von, bis],
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    lookups.data?.families.forEach((f) => map.set(f.id, f.name));
    lookups.data?.activities.forEach((a) => map.set(a.id, a.name));
    lookups.data?.periods.forEach((p) => map.set(p.id, p.name));
    lookups.data?.logins.forEach((l) => map.set(l.id, l.username));
    return map;
  }, [lookups.data]);

  function show(value: unknown): string {
    if (value === null || value === undefined || value === "") return "–";
    if (typeof value === "string" && names.has(value)) return names.get(value)!;
    if (Array.isArray(value)) return value.map(show).join(", ");
    return String(value);
  }

  function describe(row: AuditRow): string {
    if (row.aktion === "update" && row.alt && row.neu) {
      const changes = Object.keys(row.neu)
        .filter((key) => !IGNORED_FIELDS.has(key))
        .filter((key) => JSON.stringify(row.alt![key]) !== JSON.stringify(row.neu![key]))
        .map((key) => `${key}: ${show(row.alt![key])} → ${show(row.neu![key])}`);
      return changes.join(" · ") || "keine inhaltliche Änderung";
    }
    const data = row.neu ?? row.alt ?? {};
    const main = ["name", "username", "datum"].find((key) => key in data);
    const parts = [main ? show(data[main]) : show(row.zeile_id)];
    if ("family_id" in data && row.tabelle === "entries") parts.push(show(data.family_id));
    if ("activity_id" in data) parts.push(show(data.activity_id));
    if (data.dauer_h != null) parts.push(`${data.dauer_h} h`);
    if (data.betrag_chf != null) parts.push(`CHF ${data.betrag_chf}`);
    return parts.join(" · ");
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">Audit-Log</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Bereich">
          <select value={tabelle} onChange={(e) => setTabelle(e.target.value)} className={inputClass}>
            <option value="">Alle</option>
            {Object.entries(TABELLEN).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Wer">
          <select value={wer} onChange={(e) => setWer(e.target.value)} className={inputClass}>
            <option value="">Alle</option>
            {lookups.data?.logins.map((l) => (
              <option key={l.id} value={l.id}>
                {l.username}
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

      <ErrorText message={lookups.error ?? rows.error} />
      <p className="text-xs text-slate-500">Die neusten 200 Einträge für den gewählten Filter.</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Wann</th>
              <th className="px-3 py-2 font-medium">Wer</th>
              <th className="px-3 py-2 font-medium">Was</th>
              <th className="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.data?.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatTimestamp(row.wann)}</td>
                <td className="px-3 py-2">{row.wer ? show(row.wer) : "System"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {TABELLEN[row.tabelle] ?? row.tabelle} {AKTIONEN[row.aktion]}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  <span className="break-words">{describe(row)}</span>
                  {row.grund && <span className="block text-amber-700">Begründung: {row.grund}</span>}
                </td>
              </tr>
            ))}
            {rows.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Keine Einträge für diesen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
