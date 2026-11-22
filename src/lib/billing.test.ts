import { describe, expect, it } from "vitest";
import { hoursByActivity, stundenRappen, summarizeByFamily } from "./billing";

const entry = (
  family_id: string,
  activity_id: string,
  dauer_h: number | null,
  betrag_chf: number | null,
  stundensatz_chf = 30,
) => ({ family_id, activity_id, dauer_h, betrag_chf, periods: { stundensatz_chf } });

describe("stundenRappen", () => {
  it("rechnet Stunden × Satz exakt in Rappen", () => {
    expect(stundenRappen(1.5, 30)).toBe(4500);
    expect(stundenRappen(0.25, 30)).toBe(750);
    expect(stundenRappen(0.1 + 0.2 + 0.2, 30)).toBe(1500); // Fliesskomma-Rauschen bei 0.5
  });
});

describe("summarizeByFamily", () => {
  it("summiert Stunden, Auslagen und Total pro Familie", () => {
    const result = summarizeByFamily([
      entry("a", "rasen", 2, null),
      entry("a", "verpflegung", null, 12.5),
      entry("b", "rasen", 1.25, null),
    ]);
    expect(result.get("a")).toEqual({
      familyId: "a",
      stunden: 2,
      stundenRappen: 6000,
      auslagenRappen: 1250,
      totalRappen: 7250,
    });
    expect(result.get("b")?.totalRappen).toBe(3750);
  });

  it("nimmt den Stundensatz pro Eintrag aus dessen Periode", () => {
    const result = summarizeByFamily([entry("a", "rasen", 1, null, 30), entry("a", "rasen", 1, null, 35)]);
    expect(result.get("a")?.stundenRappen).toBe(6500);
  });
});

describe("hoursByActivity", () => {
  it("summiert nur Stunden, keine Franken-Einträge", () => {
    const result = hoursByActivity([
      entry("a", "rasen", 2, null),
      entry("b", "rasen", 1, null),
      entry("a", "verpflegung", null, 10),
    ]);
    expect(result.get("rasen")).toBe(3);
    expect(result.has("verpflegung")).toBe(false);
  });
});
