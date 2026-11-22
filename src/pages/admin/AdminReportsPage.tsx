import { useEffect, useMemo, useState } from "react";
import {
  fetchEntries,
  fetchFamilies,
  fetchPeriods,
  fetchSiedlung,
  saveSiedlung,
} from "../../lib/admin";
import { buildAbrechnung, buildJahresbericht, type Abrechnung } from "../../lib/reports";
import { downloadAbrechnungPdf, downloadJahresberichtPdf, downloadSammelPdf } from "../../lib/pdf";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatChf, formatHours } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import {
  ErrorText,
  Field,
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../components/ui";

const VERSION = __APP_VERSION__;

export function AdminReportsPage() {
  const stammdaten = useLoad(async () => {
    const [periods, families, siedlung] = await Promise.all([fetchPeriods(), fetchFamilies(), fetchSiedlung()]);
    return { periods, families, siedlung };
  }, []);

  const [siedlung, setSiedlung] = useState("");
  const [siedlungSaved, setSiedlungSaved] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [jahr, setJahr] = useState<number>(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!stammdaten.data) return;
    setSiedlung(stammdaten.data.siedlung);
    if (!periodId && stammdaten.data.periods.length) {
      // Vorschlag: die jüngste Periode, die schon vorbei ist.
      const heute = new Date().toISOString().slice(0, 10);
      const vorbei = stammdaten.data.periods.find((p) => p.bis < heute);
      setPeriodId((vorbei ?? stammdaten.data.periods[0]).id);
    }
  }, [stammdaten.data, periodId]);

  const period = stammdaten.data?.periods.find((p) => p.id === periodId);
  const periodEntries = useLoad(
    () => (periodId ? fetchEntries({ periodId }) : Promise.resolve([])),
    [periodId],
  );
  const yearEntries = useLoad(() => fetchEntries({ von: `${jahr}-01-01`, bis: `${jahr}-12-31` }), [jahr]);

  const abrechnungen: Abrechnung[] = useMemo(() => {
    if (!period || !periodEntries.data || !stammdaten.data) return [];
    return stammdaten.data.families
      .map((f) =>
        buildAbrechnung(
          f.name,
          period,
          periodEntries.data!.filter((e) => e.family_id === f.id),
        ),
      )
      .filter((a) => a.entries.length > 0);
  }, [period, periodEntries.data, stammdaten.data]);

  const bericht = useMemo(
    () => (yearEntries.data && stammdaten.data ? buildJahresbericht(jahr, yearEntries.data, stammdaten.data.families) : null),
    [jahr, yearEntries.data, stammdaten.data],
  );

  const jahre = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    stammdaten.data?.periods.forEach((p) => {
      set.add(Number(p.von.slice(0, 4)));
      set.add(Number(p.bis.slice(0, 4)));
    });
    return [...set].sort((a, b) => b - a);
  }, [stammdaten.data]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  const siedlungName = stammdaten.data?.siedlung ?? "";

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Abrechnung</h1>

      <ErrorText message={stammdaten.error ?? periodEntries.error ?? yearEntries.error ?? error} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Name der Siedlung</h2>
        <p className="text-sm text-slate-500">Erscheint im Kopf der PDFs. Wird nur in der Datenbank gespeichert.</p>
        <div className="flex max-w-lg gap-3">
          <input
            value={siedlung}
            onChange={(e) => {
              setSiedlung(e.target.value);
              setSiedlungSaved(false);
            }}
            placeholder="z.B. Quartier …"
            className={inputClass}
          />
          <button
            type="button"
            disabled={busy || siedlung.trim() === siedlungName}
            onClick={() =>
              run(async () => {
                await saveSiedlung(siedlung.trim());
                await stammdaten.reload();
                setSiedlungSaved(true);
              })
            }
            className={secondaryButtonClass}
          >
            Speichern
          </button>
        </div>
        {siedlungSaved && <p className="text-sm text-teal-700">Gespeichert.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-900">Abrechnung pro Periode</h2>
          <div className="flex items-end gap-3">
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
            <button
              type="button"
              disabled={busy || abrechnungen.length === 0}
              onClick={() => run(() => downloadSammelPdf(abrechnungen, siedlungName, VERSION))}
              className={primaryButtonClass}
            >
              Sammel-PDF
            </button>
          </div>
        </div>
        {period && period.status !== "abgeschlossen" && (
          <p className="text-sm text-amber-700">
            Die Periode ist noch offen – die PDFs sind als „Provisorisch“ markiert.
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Familie</th>
                <th className="px-3 py-2 text-right font-medium">Stunden</th>
                <th className="px-3 py-2 text-right font-medium">Auslagen</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abrechnungen.map((a) => (
                <tr key={a.familie}>
                  <td className="px-3 py-2">{a.familie}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatHours(a.stunden)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatChf(a.auslagenRappen)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatChf(a.totalRappen)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => downloadAbrechnungPdf(a, siedlungName, VERSION))}
                      className={linkButtonClass}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {periodEntries.data && abrechnungen.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Keine Einträge in dieser Periode.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Jahresbericht für die GV</h2>
            <p className="text-sm text-slate-500">
              Alle Einträge eines Kalenderjahres, unabhängig davon, ob monatlich, vierteljährlich oder
              jährlich abgerechnet wurde.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-32">
              <Field label="Jahr">
                <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))} className={inputClass}>
                  {jahre.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              type="button"
              disabled={busy || !bericht || bericht.rows.length === 0}
              onClick={() => bericht && run(() => downloadJahresberichtPdf(bericht, siedlungName, VERSION))}
              className={primaryButtonClass}
            >
              PDF Jahresbericht
            </button>
          </div>
        </div>
        {bericht?.provisorisch && (
          <p className="text-sm text-amber-700">
            Noch nicht alle Perioden dieses Jahres sind abgeschlossen – der Bericht ist provisorisch.
          </p>
        )}
        {bericht && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Familie</th>
                  <th className="px-3 py-2 text-right font-medium">Stunden</th>
                  <th className="px-3 py-2 text-right font-medium">Stunden CHF</th>
                  <th className="px-3 py-2 text-right font-medium">Auslagen</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bericht.rows.map(({ familie, summary }) => (
                  <tr key={familie}>
                    <td className="px-3 py-2">{familie}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHours(summary.stunden)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatChf(summary.stundenRappen)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatChf(summary.auslagenRappen)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatChf(summary.totalRappen)}</td>
                  </tr>
                ))}
                {bericht.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Keine Einträge im Jahr {jahr}.
                    </td>
                  </tr>
                )}
              </tbody>
              {bericht.rows.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHours(bericht.total.stunden)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatChf(bericht.total.stundenRappen)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatChf(bericht.total.auslagenRappen)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatChf(bericht.total.totalRappen)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
