import { supabase } from "./supabaseClient";

export type Einheit = "stunden" | "franken";
export type PeriodStatus = "offen" | "abgeschlossen";

export interface Activity {
  id: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
  einheit: Einheit;
  bemerkung_pflicht: boolean;
  nur_familien: string[] | null;
}

export interface Period {
  id: string;
  name: string;
  typ: "monat" | "quartal" | "jahr";
  von: string;
  bis: string;
  stundensatz_chf: number;
  status: PeriodStatus;
}

export interface Entry {
  id: string;
  family_id: string;
  period_id: string;
  erfasst_von: string;
  datum: string;
  activity_id: string;
  dauer_h: number | null;
  betrag_chf: number | null;
  bemerkung: string | null;
  admin_kommentar: string | null;
  created_at: string;
  activities: Pick<Activity, "name" | "einheit"> | null;
  periods: Pick<Period, "name" | "status" | "von" | "bis" | "stundensatz_chf"> | null;
}

export interface NewEntryInput {
  family_id: string;
  erfasst_von: string;
  datum: string;
  activity_id: string;
  dauer_h: number | null;
  betrag_chf: number | null;
  bemerkung: string | null;
}

/** Aktive Tätigkeiten, gefiltert auf die, die für `familyId` erlaubt sind. */
export async function fetchActivitiesForFamily(familyId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, name, aktiv, sortierung, einheit, bemerkung_pflicht, nur_familien")
    .eq("aktiv", true)
    .order("sortierung", { ascending: true });

  if (error) throw error;

  return (data as Activity[]).filter(
    (activity) => !activity.nur_familien || activity.nur_familien.includes(familyId),
  );
}

export async function fetchMyEntries(familyId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, family_id, period_id, erfasst_von, datum, activity_id, dauer_h, betrag_chf, bemerkung, admin_kommentar, created_at, activities(name, einheit), periods(name, status, von, bis, stundensatz_chf)",
    )
    .eq("family_id", familyId)
    .order("datum", { ascending: false });

  if (error) throw error;
  return data as unknown as Entry[];
}

export async function createEntry(input: NewEntryInput): Promise<void> {
  const { error } = await supabase.from("entries").insert(input);
  if (error) throw error;
}

export async function updateEntry(
  id: string,
  input: Pick<NewEntryInput, "datum" | "activity_id" | "dauer_h" | "betrag_chf" | "bemerkung">,
): Promise<void> {
  const { error } = await supabase.from("entries").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

/** Nachtragsfrist: 30 Tage nach Periodenende (siehe docs/PLAN.md). */
export function nachtragsfristEnde(periodeBis: string): Date {
  const ende = new Date(`${periodeBis}T00:00:00`);
  ende.setDate(ende.getDate() + 30);
  return ende;
}

export function heuteIso(): string {
  // "Heute" aus Sicht des Geräts; massgeblich für die Regel ist ohnehin der
  // entries_before_write-Trigger in Europe/Zurich auf dem Server.
  const now = new Date();
  const jahr = now.getFullYear();
  const monat = String(now.getMonth() + 1).padStart(2, "0");
  const tag = String(now.getDate()).padStart(2, "0");
  return `${jahr}-${monat}-${tag}`;
}
