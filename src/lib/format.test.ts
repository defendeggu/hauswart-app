import { describe, expect, it } from "vitest";
import { formatChf, formatDate, parseDecimal } from "./format";

describe("formatChf", () => {
  it("formatiert Rappen als CHF mit Hochkomma-Tausendertrenner", () => {
    expect(formatChf(123450)).toBe("CHF 1'234.50");
    expect(formatChf(500)).toBe("CHF 5.00");
    expect(formatChf(5)).toBe("CHF 0.05");
  });

  it("behandelt negative Beträge", () => {
    expect(formatChf(-100)).toBe("-CHF 1.00");
  });
});

describe("formatDate", () => {
  it("formatiert ISO-Datum als TT.MM.JJJJ", () => {
    expect(formatDate("2026-11-22")).toBe("22.11.2026");
  });
});

describe("parseDecimal", () => {
  it("akzeptiert Punkt und Komma", () => {
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal("1,5")).toBe(1.5);
  });

  it("gibt null für ungültige Eingaben zurück", () => {
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });
});
