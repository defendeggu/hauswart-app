import { describe, expect, it } from "vitest";
import { toCsv, type ExportRow } from "./export";

const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  familie: "Familie A",
  datum: "2026-11-22",
  taetigkeit: "Rasen mähen",
  stunden: 1.5,
  betragChf: null,
  bemerkung: "",
  kommentar: "",
  ...overrides,
});

describe("toCsv", () => {
  it("beginnt mit BOM, trennt mit Semikolon und formatiert Datum und Zahlen", () => {
    const csv = toCsv([row(), row({ taetigkeit: "Verpflegung", stunden: null, betragChf: 12.5 })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Familie;Datum;Tätigkeit;Stunden;Betrag CHF;Bemerkung;Kommentar");
    expect(lines[1]).toBe("Familie A;22.11.2026;Rasen mähen;1.50;;;");
    expect(lines[2]).toBe("Familie A;22.11.2026;Verpflegung;;12.50;;");
  });

  it("setzt Felder mit Semikolon, Anführungszeichen oder Zeilenumbruch in Anführungszeichen", () => {
    const csv = toCsv([row({ bemerkung: 'Hecke; "gross"\nund Laub' })]);
    expect(csv).toContain('"Hecke; ""gross""\nund Laub"');
  });
});
