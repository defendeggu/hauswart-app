import type { Entry } from "./entries";
import { formatDate } from "./format";

export interface ExportRow {
  familie: string;
  datum: string; // ISO yyyy-mm-dd
  taetigkeit: string;
  stunden: number | null;
  betragChf: number | null;
  bemerkung: string;
  kommentar: string;
}

const HEADERS = ["Familie", "Datum", "Tätigkeit", "Stunden", "Betrag CHF", "Bemerkung", "Kommentar"];

export function entriesToExportRows(entries: Entry[], familyName: (id: string) => string): ExportRow[] {
  return entries.map((entry) => ({
    familie: familyName(entry.family_id),
    datum: entry.datum,
    taetigkeit: entry.activities?.name ?? "",
    stunden: entry.dauer_h,
    betragChf: entry.betrag_chf,
    bemerkung: entry.bemerkung ?? "",
    kommentar: entry.admin_kommentar ?? "",
  }));
}

function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CSV für Excel in der Schweiz: UTF-8 mit BOM (sonst zeigt Excel Umlaute
 * falsch an), Semikolon als Trennzeichen, Punkt als Dezimaltrennzeichen.
 */
export function toCsv(rows: ExportRow[]): string {
  const lines = [
    HEADERS.join(";"),
    ...rows.map((row) =>
      [
        row.familie,
        formatDate(row.datum),
        row.taetigkeit,
        row.stunden === null ? "" : row.stunden.toFixed(2),
        row.betragChf === null ? "" : row.betragChf.toFixed(2),
        row.bemerkung,
        row.kommentar,
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(rows: ExportRow[], fileName: string) {
  downloadBlob(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), fileName);
}

export async function downloadXlsx(rows: ExportRow[], fileName: string) {
  // Erst bei Bedarf laden, damit die App für die Familien klein bleibt.
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const header = HEADERS.map((value) => ({ value, fontWeight: "bold" as const }));
  const data = rows.map((row) => [
    row.familie,
    { value: new Date(`${row.datum}T00:00:00`), format: "dd.mm.yyyy" },
    row.taetigkeit,
    row.stunden === null ? null : { value: row.stunden, format: "0.00" },
    row.betragChf === null ? null : { value: row.betragChf, format: "0.00" },
    row.bemerkung || null,
    row.kommentar || null,
  ]);
  const columns = [{ width: 18 }, { width: 12 }, { width: 32 }, { width: 10 }, { width: 12 }, { width: 40 }, { width: 40 }];
  await writeExcelFile([header, ...data], { columns }).toFile(fileName);
}
