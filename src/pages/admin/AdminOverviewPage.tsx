import { useEffect, useMemo, useState } from "react";
import { fetchAllActivities, fetchEntries, fetchFamilies, fetchPeriods } from "../../lib/admin";
import { hoursByActivity, summarizeByFamily } from "../../lib/billing";
import { formatChf, formatDate, formatHours } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import { ErrorText, Field, inputClass } from "../../components/ui";

export function AdminOverviewPage() {
  const stammdaten = useLoad(
    async () => {
      const [periods, families, activities] = await Promise.all([
        fetchPeriods(),
        fetchFamilies(),
        fetchAllActivities(),
      ]);
      return { periods, families, activities };
    },
    [],
  );

  const [periodId, setPeriodId] = useState<string>("");

  useEffect(() => {
    if (!periodId && stammdaten.data?.periods.length) {
      setPeriodId(stammdaten.data.periods[0].id);
    }
  }, [periodId, stammdaten.data]);

  const entries = useLoad(
    () => (periodId ? fetchEntries({ periodId }) : Promise.resolve([])),
    [periodId],
  );

  const period = stammdaten.data?.periods.find((p) => p.id === periodId);
  const families = stammdaten.data?.families ?? [];
  const activities = stammdaten.data?.activities ?? [];

  const byFamily = useMemo(() => summarizeByFamily(entries.data ?? []), [entries.data]);
  const byActivity = useMemo(() => hoursByActivity(entries.data ?? []), [entries.data]);

  const rows = families
    .filter((f) => f.aktiv || byFamily.has(f.id))
    .map((f) => ({
      family: f,
      summary: byFamily.get(f.id) ?? { stunden: 0, stundenRappen: 0, auslagenRappen: 0, totalRappen: 0 },
    }));

  const total = rows.reduce(
    (acc, { summary }) => ({
      stunden: acc.stunden + summary.stunden,
      stundenRappen: acc.stundenRappen + summary.stundenRappen,
      auslagenRappen: acc.auslagenRappen + summary.auslagenRappen,
      totalRappen: acc.totalRappen + summary.totalRappen,
    }),
    { stunden: 0, stundenRappen: 0, auslagenRappen: 0, totalRappen: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-900">Übersicht</h1>
        <div className="w-56">
          <Field label="Periode">
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className={inputClass}>
              {stammdaten.data?.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <ErrorText message={stammdaten.error ?? entries.error} />

      {period && (
        <p className="text-sm text-slate-500">
          {formatDate(period.von)} – {formatDate(period.bis)} · Stundensatz{" "}
          {formatChf(Math.round(period.stundensatz_chf * 100))} · {period.status}
        </p>
      )}

      {families.length === 0 && stammdaten.data && (
        <p className="text-sm text-slate-500">
          Noch keine Familien erfasst. Unter „Familien" anlegen.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Familie</th>
                <th className="px-4 py-2 text-right font-medium">Stunden</th>
                <th className="px-4 py-2 text-right font-medium">Stunden CHF</th>
                <th className="px-4 py-2 text-right font-medium">Auslagen</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ family, summary }) => (
                <tr key={family.id}>
                  <td className="px-4 py-2 text-slate-900">
                    {family.name}
                    {!family.aktiv && <span className="ml-2 text-xs text-slate-400">(inaktiv)</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatHours(summary.stunden)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatChf(summary.stundenRappen)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatChf(summary.auslagenRappen)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {formatChf(summary.totalRappen)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatHours(total.stunden)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatChf(total.stundenRappen)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatChf(total.auslagenRappen)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatChf(total.totalRappen)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Stunden pro Tätigkeit</h2>
        {byActivity.size === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Keine Stunden in dieser Periode.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {activities
              .filter((a) => byActivity.has(a.id))
              .map((a) => (
                <li key={a.id} className="flex justify-between px-4 py-2">
                  <span>{a.name}</span>
                  <span className="tabular-nums">{formatHours(byActivity.get(a.id)!)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
