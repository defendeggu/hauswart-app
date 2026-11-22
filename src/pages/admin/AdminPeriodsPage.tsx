import { useState, type FormEvent } from "react";
import {
  closePeriod,
  ensurePeriods,
  fetchEntries,
  fetchFamilies,
  fetchPeriods,
  reopenPeriod,
  setPeriodTyp,
  setStundensatz,
  type Family,
} from "../../lib/admin";
import { summarizeByFamily } from "../../lib/billing";
import { heuteIso, nachtragsfristEnde, type Period } from "../../lib/entries";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatChf, formatDate, formatHours, parseDecimal } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import {
  ErrorText,
  Field,
  Modal,
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "../../components/ui";

const TYP_LABEL: Record<Period["typ"], string> = { monat: "Monat", quartal: "Quartal", jahr: "Jahr" };

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Dialog =
  | { kind: "close"; period: Period }
  | { kind: "reopen"; period: Period }
  | { kind: "satz"; period: Period };

export function AdminPeriodsPage() {
  const data = useLoad(async () => {
    // Laufende und nächste Periode automatisch anlegen (docs/PLAN.md).
    await ensurePeriods();
    const [periods, families] = await Promise.all([fetchPeriods(), fetchFamilies()]);
    return { periods, families };
  }, []);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const heute = heuteIso();
  const periods = data.data?.periods ?? [];
  const latestId = periods[0]?.id;

  async function changeTyp(period: Period, typ: Period["typ"]) {
    setActionError(null);
    try {
      await setPeriodTyp(period.id, typ);
      data.reload();
    } catch (err) {
      setActionError(friendlyErrorMessage(err as { message?: string }));
    }
  }

  function done() {
    setDialog(null);
    data.reload();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">Perioden</h1>
      <p className="text-sm text-slate-500">
        Nach Periodenende haben die Familien 30 Tage Zeit für Nachträge. Danach erscheint „bereit zum
        Abschliessen“. Abgeschlossen wird immer von Hand; danach ist die Periode schreibgeschützt.
      </p>

      <ErrorText message={data.error ?? actionError} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Periode</th>
              <th className="px-3 py-2 font-medium">Zeitraum</th>
              <th className="px-3 py-2 text-right font-medium">Stundensatz</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.map((period) => {
              const offen = period.status === "offen";
              const vorbei = period.bis < heute;
              const frist = isoDate(nachtragsfristEnde(period.bis));
              const bereit = offen && frist < heute;
              const typAenderbar = period.id === latestId && period.von > heute;

              return (
                <tr key={period.id} className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{period.name}</span>
                    <span className="block text-xs text-slate-500">
                      {typAenderbar ? (
                        <select
                          value={period.typ}
                          onChange={(e) => changeTyp(period, e.target.value as Period["typ"])}
                          className="mt-1 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                          aria-label="Periodentyp"
                        >
                          {Object.entries(TYP_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        TYP_LABEL[period.typ]
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(period.von)} – {formatDate(period.bis)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {formatChf(Math.round(period.stundensatz_chf * 100))}
                  </td>
                  <td className="px-3 py-2">
                    {!offen && <span className="text-slate-500">abgeschlossen</span>}
                    {offen && !vorbei && <span className="text-teal-700">offen</span>}
                    {offen && vorbei && !bereit && (
                      <span className="text-amber-700">Nachträge bis {formatDate(frist)}</span>
                    )}
                    {bereit && <span className="font-medium text-amber-700">bereit zum Abschliessen</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <span className="flex justify-end gap-3">
                      {offen && (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "satz", period })}
                          className={linkButtonClass}
                        >
                          Satz ändern
                        </button>
                      )}
                      {offen && vorbei && (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "close", period })}
                          className={linkButtonClass}
                        >
                          Abschliessen
                        </button>
                      )}
                      {!offen && (
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "reopen", period })}
                          className={linkButtonClass}
                        >
                          Wieder öffnen
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "close" && data.data && (
        <CloseDialog
          period={dialog.period}
          families={data.data.families}
          fristEnde={isoDate(nachtragsfristEnde(dialog.period.bis))}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === "reopen" && (
        <ReopenDialog period={dialog.period} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === "satz" && (
        <SatzDialog period={dialog.period} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

function CloseDialog({
  period,
  families,
  fristEnde,
  onClose,
  onDone,
}: {
  period: Period;
  families: Family[];
  fristEnde: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const entries = useLoad(() => fetchEntries({ periodId: period.id }), [period.id]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const summary = summarizeByFamily(entries.data ?? []);
  const rows = families
    .map((f) => ({ family: f, s: summary.get(f.id) }))
    .filter((row) => row.s);
  const total = rows.reduce((sum, row) => sum + (row.s?.totalRappen ?? 0), 0);
  const vorFristende = heuteIso() <= fristEnde;

  async function confirmClose() {
    setSubmitting(true);
    setError(null);
    try {
      await closePeriod(period.id);
      onDone();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`${period.name} abschliessen`} onClose={onClose}>
      <div className="space-y-4">
        {vorFristende && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Die Nachtragsfrist läuft noch bis {formatDate(fristEnde)}. Nach dem Abschluss können die
            Familien nichts mehr nachtragen.
          </p>
        )}
        <ErrorText message={entries.error} />
        {entries.data && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-medium">Familie</th>
                <th className="py-1 text-right font-medium">Stunden</th>
                <th className="py-1 text-right font-medium">Auslagen</th>
                <th className="py-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ family, s }) => (
                <tr key={family.id}>
                  <td className="py-1">{family.name}</td>
                  <td className="py-1 text-right tabular-nums">{formatHours(s!.stunden)}</td>
                  <td className="py-1 text-right tabular-nums">{formatChf(s!.auslagenRappen)}</td>
                  <td className="py-1 text-right font-medium tabular-nums">{formatChf(s!.totalRappen)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-500">
                    Keine Einträge in dieser Periode.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-200 font-semibold">
              <tr>
                <td className="py-1" colSpan={3}>
                  Total
                </td>
                <td className="py-1 text-right tabular-nums">{formatChf(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="text-sm text-slate-600">
          Nach dem Abschluss ist die Periode für alle schreibgeschützt. Wieder öffnen geht nur mit
          Begründung.
        </p>
        <ErrorText message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button
            type="button"
            onClick={confirmClose}
            disabled={submitting || !entries.data}
            className={primaryButtonClass}
          >
            Abschliessen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReopenDialog({ period, onClose, onDone }: { period: Period; onClose: () => void; onDone: () => void }) {
  const [grund, setGrund] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await reopenPeriod(period.id, grund.trim());
      onDone();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`${period.name} wieder öffnen`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Begründung (wird im Audit-Log gespeichert)">
          <textarea value={grund} onChange={(e) => setGrund(e.target.value)} rows={3} className={textareaClass} />
        </Field>
        <ErrorText message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={submitting || grund.trim() === ""} className={primaryButtonClass}>
            Wieder öffnen
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SatzDialog({ period, onClose, onDone }: { period: Period; onClose: () => void; onDone: () => void }) {
  const [raw, setRaw] = useState(period.stundensatz_chf.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const value = parseDecimal(raw);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (value === null || value <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await setStundensatz(period.id, Math.round(value * 100) / 100);
      onDone();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Stundensatz ${period.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Stundensatz in CHF">
          <input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} className={inputClass} />
        </Field>
        <p className="text-sm text-slate-500">
          Gilt für alle Stunden dieser Periode. Neu angelegte Perioden übernehmen den Satz der
          letzten Periode – eine bereits angelegte spätere Periode behält ihren Satz und muss bei
          Bedarf separat angepasst werden.
        </p>
        <ErrorText message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={submitting || value === null || value <= 0} className={primaryButtonClass}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
