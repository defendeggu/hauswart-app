import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import {
  createEntry,
  fetchActivitiesForFamily,
  heuteIso,
  type Activity,
} from "../lib/entries";
import { friendlyErrorMessage } from "../lib/errors";
import { HoursStepper } from "../components/HoursStepper";
import { AmountInput } from "../components/AmountInput";

export function EntryFormPage() {
  const { profile } = useAuth();
  const familyId = profile!.family_id!;

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activityId, setActivityId] = useState<string | null>(null);
  const [datum, setDatum] = useState(heuteIso());
  const [dauerH, setDauerH] = useState<number | null>(null);
  const [betragChf, setBetragChf] = useState<number | null>(null);
  const [bemerkung, setBemerkung] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchActivitiesForFamily(familyId)
      .then((data) => {
        if (active) setActivities(data);
      })
      .catch((error) => {
        if (active) setLoadError(friendlyErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [familyId]);

  const activity = activities?.find((a) => a.id === activityId) ?? null;

  function resetForm() {
    setActivityId(null);
    setDatum(heuteIso());
    setDauerH(null);
    setBetragChf(null);
    setBemerkung("");
  }

  function selectActivity(next: Activity) {
    setActivityId(next.id);
    setDauerH(null);
    setBetragChf(null);
    setBemerkung("");
    setSubmitError(null);
    setConfirmed(false);
  }

  const bemerkungFehlt = Boolean(activity?.bemerkung_pflicht) && bemerkung.trim() === "";
  const wertFehlt = activity
    ? activity.einheit === "stunden"
      ? dauerH === null
      : betragChf === null
    : true;
  const canSubmit = Boolean(activity) && !wertFehlt && !bemerkungFehlt && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activity) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createEntry({
        family_id: familyId,
        erfasst_von: profile!.id,
        datum,
        activity_id: activity.id,
        dauer_h: activity.einheit === "stunden" ? dauerH : null,
        betrag_chf: activity.einheit === "franken" ? betragChf : null,
        bemerkung: bemerkung.trim() === "" ? null : bemerkung.trim(),
      });
      resetForm();
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 4000);
    } catch (error) {
      setSubmitError(friendlyErrorMessage(error as { message?: string }));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <p className="p-4 text-sm text-red-600">{loadError}</p>;
  }

  if (!activities) {
    return <p className="p-4 text-sm text-slate-400">Lädt…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-lg font-semibold text-slate-900">Erfassen</h1>

      {confirmed && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800"
        >
          Gespeichert.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
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

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">Tätigkeit</span>
          <div className="grid grid-cols-2 gap-2">
            {activities.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectActivity(a)}
                className={`min-h-16 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                  activityId === a.id
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {activity && activity.einheit === "stunden" && (
          <HoursStepper value={dauerH} onChange={setDauerH} />
        )}
        {activity && activity.einheit === "franken" && (
          <AmountInput value={betragChf} onChange={setBetragChf} />
        )}

        {activity && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Bemerkung{activity.bemerkung_pflicht ? " (Pflicht)" : " (optional)"}
            </span>
            <textarea
              value={bemerkung}
              onChange={(event) => setBemerkung(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
        )}

        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-teal-700 text-base font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Speichert…" : "Speichern"}
        </button>
      </form>
    </div>
  );
}
