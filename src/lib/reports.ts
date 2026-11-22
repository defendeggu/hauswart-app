import type { Entry, Period } from "./entries";
import type { Family } from "./admin";
import { chfToRappen, stundenRappen, summarizeByFamily, type FamilySummary } from "./billing";

export type ReportPeriod = Pick<Period, "name" | "von" | "bis" | "stundensatz_chf" | "status">;

export interface NamedAmount {
  name: string;
  value: number;
}

export interface Abrechnung {
  familie: string;
  period: ReportPeriod;
  provisorisch: boolean;
  entries: Entry[];
  stundenProTaetigkeit: NamedAmount[];
  stunden: number;
  stundenRappen: number;
  auslagen: NamedAmount[]; // value in Rappen
  auslagenRappen: number;
  totalRappen: number;
}

function sumBy(entries: Entry[], key: (e: Entry) => string, value: (e: Entry) => number | null): NamedAmount[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const v = value(entry);
    if (v === null) continue;
    map.set(key(entry), (map.get(key(entry)) ?? 0) + v);
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: v })).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

/** Abrechnung einer Familie für eine Periode (docs/PLAN.md Abschnitt 5). */
export function buildAbrechnung(familie: string, period: ReportPeriod, entries: Entry[]): Abrechnung {
  const sorted = [...entries].sort((a, b) => a.datum.localeCompare(b.datum));
  const activityName = (e: Entry) => e.activities?.name ?? "?";
  const stundenEntries = sorted.filter((e) => e.dauer_h !== null);

  const stunden = stundenEntries.reduce((sum, e) => sum + e.dauer_h!, 0);
  const stundenRappenTotal = stundenEntries.reduce(
    (sum, e) => sum + stundenRappen(e.dauer_h!, period.stundensatz_chf),
    0,
  );
  const auslagen = sumBy(sorted, activityName, (e) => (e.betrag_chf === null ? null : chfToRappen(e.betrag_chf)));
  const auslagenRappen = auslagen.reduce((sum, a) => sum + a.value, 0);

  return {
    familie,
    period,
    provisorisch: period.status !== "abgeschlossen",
    entries: sorted,
    stundenProTaetigkeit: sumBy(sorted, activityName, (e) => e.dauer_h),
    stunden,
    stundenRappen: stundenRappenTotal,
    auslagen,
    auslagenRappen,
    totalRappen: stundenRappenTotal + auslagenRappen,
  };
}

export interface FamilyRow {
  familie: string;
  summary: FamilySummary;
}

export interface Jahresbericht {
  jahr: number;
  provisorisch: boolean;
  rows: FamilyRow[];
  total: Omit<FamilySummary, "familyId">;
  stundenProTaetigkeit: NamedAmount[];
  perioden: ReportPeriod[];
}

/**
 * Jahresbericht für die GV: alle Einträge eines Kalenderjahres, gruppiert
 * über das Datum (nicht über die Periode), damit er bei jedem Periodentyp
 * stimmt. Der Stundensatz kommt pro Eintrag aus dessen Periode.
 */
export function buildJahresbericht(jahr: number, entries: Entry[], families: Family[]): Jahresbericht {
  const imJahr = entries.filter((e) => e.datum.startsWith(`${jahr}-`));
  const byFamily = summarizeByFamily(imJahr);
  const rows = families
    .filter((f) => byFamily.has(f.id))
    .map((f) => ({ familie: f.name, summary: byFamily.get(f.id)! }))
    .sort((a, b) => a.familie.localeCompare(b.familie, "de-CH"));

  const total = rows.reduce(
    (acc, { summary }) => ({
      stunden: acc.stunden + summary.stunden,
      stundenRappen: acc.stundenRappen + summary.stundenRappen,
      auslagenRappen: acc.auslagenRappen + summary.auslagenRappen,
      totalRappen: acc.totalRappen + summary.totalRappen,
    }),
    { stunden: 0, stundenRappen: 0, auslagenRappen: 0, totalRappen: 0 },
  );

  const perioden = new Map<string, ReportPeriod>();
  for (const entry of imJahr) {
    if (entry.periods) perioden.set(entry.period_id, entry.periods);
  }
  const periodList = [...perioden.values()].sort((a, b) => a.von.localeCompare(b.von));

  return {
    jahr,
    provisorisch: periodList.some((p) => p.status !== "abgeschlossen"),
    rows,
    total,
    stundenProTaetigkeit: sumBy(imJahr, (e) => e.activities?.name ?? "?", (e) => e.dauer_h),
    perioden: periodList,
  };
}
