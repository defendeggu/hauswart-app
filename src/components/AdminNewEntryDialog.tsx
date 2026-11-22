import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { createEntry, heuteIso, type Activity } from "../lib/entries";
import type { Family } from "../lib/admin";
import { friendlyErrorMessage } from "../lib/errors";
import { HoursStepper } from "./HoursStepper";
import { AmountInput } from "./AmountInput";
import {
  ErrorText,
  Field,
  Modal,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "./ui";

interface Props {
  families: Family[];
  activities: Activity[];
  onClose: () => void;
  onSaved: () => void;
}

export function AdminNewEntryDialog({ families, activities, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [familyId, setFamilyId] = useState("");
  const [datum, setDatum] = useState(heuteIso());
  const [activityId, setActivityId] = useState("");
  const [dauerH, setDauerH] = useState<number | null>(null);
  const [betragChf, setBetragChf] = useState<number | null>(null);
  const [bemerkung, setBemerkung] = useState("");
  const [kommentar, setKommentar] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedActivities = activities.filter(
    (a) => a.aktiv && (!a.nur_familien || (familyId !== "" && a.nur_familien.includes(familyId))),
  );
  const activity = allowedActivities.find((a) => a.id === activityId) ?? null;

  const wertFehlt = activity ? (activity.einheit === "stunden" ? dauerH === null : betragChf === null) : true;
  const canSubmit =
    familyId !== "" &&
    activity !== null &&
    !wertFehlt &&
    !(activity.bemerkung_pflicht && bemerkung.trim() === "") &&
    kommentar.trim() !== "" &&
    !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activity) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEntry({
        family_id: familyId,
        erfasst_von: profile!.id,
        datum,
        activity_id: activity.id,
        dauer_h: activity.einheit === "stunden" ? dauerH : null,
        betrag_chf: activity.einheit === "franken" ? betragChf : null,
        bemerkung: bemerkung.trim() || null,
        admin_kommentar: kommentar.trim(),
      });
      onSaved();
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Eintrag nachtragen" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Familie">
          <select
            value={familyId}
            onChange={(e) => {
              setFamilyId(e.target.value);
              setActivityId("");
            }}
            className={inputClass}
          >
            <option value="">– wählen –</option>
            {families
              .filter((f) => f.aktiv)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Datum">
          <input
            type="date"
            max={heuteIso()}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Tätigkeit">
          <select
            value={activityId}
            onChange={(e) => {
              setActivityId(e.target.value);
              setDauerH(null);
              setBetragChf(null);
            }}
            disabled={familyId === ""}
            className={inputClass}
          >
            <option value="">– wählen –</option>
            {allowedActivities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.einheit === "franken" ? "(CHF)" : ""}
              </option>
            ))}
          </select>
        </Field>

        {activity?.einheit === "stunden" && <HoursStepper value={dauerH} onChange={setDauerH} />}
        {activity?.einheit === "franken" && <AmountInput value={betragChf} onChange={setBetragChf} />}

        <Field label={`Bemerkung${activity?.bemerkung_pflicht ? " (Pflicht)" : " (optional)"}`}>
          <textarea value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} rows={2} className={textareaClass} />
        </Field>

        <Field label="Kommentar Admin (Pflicht)">
          <textarea value={kommentar} onChange={(e) => setKommentar(e.target.value)} rows={2} className={textareaClass} />
        </Field>

        <ErrorText message={error} />

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
            {submitting ? "Speichert…" : "Nachtragen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
