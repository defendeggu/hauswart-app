import { describe, expect, it } from "vitest";
import { buildAbrechnung, buildJahresbericht, type ReportPeriod } from "./reports";
import type { Entry } from "./entries";

const q4: ReportPeriod = { name: "2026-Q4", von: "2026-10-01", bis: "2026-12-31", stundensatz_chf: 30, status: "offen" };
const q3: ReportPeriod = { name: "2026-Q3", von: "2026-07-01", bis: "2026-09-30", stundensatz_chf: 25, status: "abgeschlossen" };

let n = 0;
function entry(
  family_id: string,
  datum: string,
  activity: string,
  dauer_h: number | null,
  betrag_chf: number | null,
  period = q4,
): Entry {
  n += 1;
  return {
    id: `e${n}`,
    family_id,
    period_id: period.name,
    erfasst_von: "u",
    datum,
    activity_id: activity,
    dauer_h,
    betrag_chf,
    bemerkung: null,
    admin_kommentar: null,
    created_at: "",
    activities: { name: activity, einheit: dauer_h === null ? "franken" : "stunden" },
    periods: period,
  };
}

describe("buildAbrechnung", () => {
  it("rechnet Stunden × Satz + Auslagen und gruppiert nach Tätigkeit", () => {
    const a = buildAbrechnung("Familie A", q4, [
      entry("a", "2026-11-03", "Rasen mähen", 2, null),
      entry("a", "2026-10-05", "Laub rechen", 1.5, null),
      entry("a", "2026-11-04", "Rasen mähen", 0.5, null),
      entry("a", "2026-11-04", "Verpflegung", null, 12.5),
    ]);
    expect(a.entries.map((e) => e.datum)).toEqual(["2026-10-05", "2026-11-03", "2026-11-04", "2026-11-04"]);
    expect(a.stunden).toBe(4);
    expect(a.stundenRappen).toBe(12000);
    expect(a.stundenProTaetigkeit).toEqual([
      { name: "Laub rechen", value: 1.5 },
      { name: "Rasen mähen", value: 2.5 },
    ]);
    expect(a.auslagen).toEqual([{ name: "Verpflegung", value: 1250 }]);
    expect(a.totalRappen).toBe(13250);
    expect(a.provisorisch).toBe(true);
  });
});

describe("buildJahresbericht", () => {
  it("summiert über Perioden mit unterschiedlichem Satz, nur das gewählte Jahr", () => {
    const families = [
      { id: "a", name: "Familie A", aktiv: true },
      { id: "b", name: "Familie B", aktiv: true },
      { id: "c", name: "Familie C", aktiv: true },
    ];
    const bericht = buildJahresbericht(2026, [
      entry("a", "2026-08-01", "Rasen mähen", 2, null, q3),
      entry("a", "2026-11-01", "Rasen mähen", 2, null, q4),
      entry("b", "2026-11-02", "Verpflegung", null, 20),
      entry("b", "2025-12-30", "Rasen mähen", 5, null),
    ], families);

    expect(bericht.rows.map((r) => r.familie)).toEqual(["Familie A", "Familie B"]);
    expect(bericht.rows[0].summary.stundenRappen).toBe(5000 + 6000);
    expect(bericht.total.totalRappen).toBe(11000 + 2000);
    expect(bericht.total.stunden).toBe(4);
    expect(bericht.perioden.map((p) => p.name)).toEqual(["2026-Q3", "2026-Q4"]);
    expect(bericht.provisorisch).toBe(true);
  });
});
