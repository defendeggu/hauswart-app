import { useState, type FormEvent } from "react";
import { heuteIso, updateEntry, type Entry } from "../lib/entries";
import { friendlyErrorMessage } from "../lib/errors";
import { HoursStepper } from "./HoursStepper";
import { AmountInput } from "./AmountInput";

interface EditEntryDialogProps {
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
  /** Admin bearbeitet einen fremden Eintrag: Kommentar ist Pflicht. */
  adminMode?: boolean;
}

export function EditEntryDialog({ entry, onClose, onSaved, adminMode = false }: EditEntryDialogProps) {
  const [adminKommentar, setAdminKommentar] = useState(entry.admin_kommentar ?? "");
  const einheit = entry.activities?.einheit ?? "stunden";
  const [datum, setDatum] = useState(entry.datum);
  const [dauerH, setDauerH] = useState<number | null>(entry.dauer_h);
  const [betragChf, setBetragChf] = useState<number | null>(entry.betrag_chf);
  const [bemerkung, setBemerkung] = useState(entry.bemerkung ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateEntry(entry.id, {
        datum,
        activity_id: entry.activity_id,
        dauer_h: einheit === "stunden" ? dauerH : null,
        betrag_chf: einheit === "franken" ? betragChf : null,
        bemerkung: bemerkung.trim() === "" ? null : bemerkung.trim(),
        ...(adminMode ? { admin_kommentar: adminKommentar.trim() } : {}),
      });
      onSaved();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {entry.activities?.name} bearbeiten
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="h-10 w-10 text-slate-400"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Datum</span>
            <input
              type="date"
              required
              max={heuteIso()}
              value={datum}
              onChange={(event) => setDatum(event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </label>

          {einheit === "stunden" ? (
            <HoursStepper value={dauerH} onChange={setDauerH} />
          ) : (
            <AmountInput value={betragChf} onChange={setBetragChf} />
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Bemerkung</span>
            <textarea
              value={bemerkung}
              onChange={(event) => setBemerkung(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </label>

          {adminMode && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Kommentar Admin (Pflicht)
              </span>
              <textarea
                value={adminKommentar}
                onChange={(event) => setAdminKommentar(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-lg border border-slate-300 text-base font-medium text-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting || (adminMode && adminKommentar.trim() === "")}
              className="h-12 flex-1 rounded-lg bg-teal-700 text-base font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
