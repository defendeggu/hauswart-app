import type { Entry } from "./entries";

type BillableEntry = Pick<Entry, "family_id" | "dauer_h" | "betrag_chf" | "activity_id"> & {
  periods: Pick<NonNullable<Entry["periods"]>, "stundensatz_chf"> | null;
};

export interface FamilySummary {
  familyId: string;
  stunden: number;
  stundenRappen: number;
  auslagenRappen: number;
  totalRappen: number;
}

/** Rappen für eine Dauer zum Stundensatz der Periode (pro Eintrag gerundet). */
export function stundenRappen(dauerH: number, stundensatzChf: number): number {
  return Math.round(Math.round(dauerH * 4) * Math.round(stundensatzChf * 100) / 4);
}

export function chfToRappen(chf: number): number {
  return Math.round(chf * 100);
}

/**
 * Abrechnung pro Familie: Summe Stunden × Stundensatz der jeweiligen Periode
 * + Summe der Franken-Einträge (docs/PLAN.md Abschnitt 5). Der Satz kommt
 * pro Eintrag aus dessen Periode, darum funktioniert das auch über mehrere
 * Perioden hinweg (z.B. für den Jahresbericht).
 */
export function summarizeByFamily(entries: BillableEntry[]): Map<string, FamilySummary> {
  const result = new Map<string, FamilySummary>();
  for (const entry of entries) {
    let summary = result.get(entry.family_id);
    if (!summary) {
      summary = { familyId: entry.family_id, stunden: 0, stundenRappen: 0, auslagenRappen: 0, totalRappen: 0 };
      result.set(entry.family_id, summary);
    }
    if (entry.dauer_h !== null) {
      const rappen = stundenRappen(entry.dauer_h, entry.periods?.stundensatz_chf ?? 0);
      summary.stunden += entry.dauer_h;
      summary.stundenRappen += rappen;
      summary.totalRappen += rappen;
    }
    if (entry.betrag_chf !== null) {
      const rappen = chfToRappen(entry.betrag_chf);
      summary.auslagenRappen += rappen;
      summary.totalRappen += rappen;
    }
  }
  return result;
}

export function hoursByActivity(entries: BillableEntry[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of entries) {
    if (entry.dauer_h === null) continue;
    result.set(entry.activity_id, (result.get(entry.activity_id) ?? 0) + entry.dauer_h);
  }
  return result;
}
