/**
 * Geldbeträge werden als ganzzahlige Rappen gerechnet (keine Fliesskommazahlen,
 * siehe docs/PLAN.md), aber als "CHF 1'234.50" (Hochkomma als Tausendertrenner)
 * angezeigt.
 */
export function formatChf(rappenTotal: number): string {
  const negative = rappenTotal < 0;
  const abs = Math.abs(Math.round(rappenTotal));
  const franken = Math.floor(abs / 100);
  const rappen = abs % 100;
  const frankenStr = franken.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const rappenStr = rappen.toString().padStart(2, "0");
  return `${negative ? "-" : ""}CHF ${frankenStr}.${rappenStr}`;
}

/** "2026-11-22" -> "22.11.2026" */
export function formatDate(isoDate: string): string {
  const [jahr, monat, tag] = isoDate.split("-");
  return `${tag}.${monat}.${jahr}`;
}

/** Akzeptiert Komma oder Punkt als Dezimaltrennzeichen, z.B. "1,5" oder "1.5". */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "" || Number.isNaN(Number(normalized))) {
    return null;
  }
  return Number(normalized);
}
