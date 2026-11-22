import type { jsPDF as JsPdf } from "jspdf";
import type { Abrechnung, Jahresbericht } from "./reports";
import { formatChf, formatDate, formatHours } from "./format";

// jsPDF und autoTable erst bei Bedarf laden (nur im Admin-Bereich gebraucht).
async function loadPdf() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}

type AutoTable = Awaited<ReturnType<typeof loadPdf>>["autoTable"];

const MARGIN = 18;
const TEAL: [number, number, number] = [15, 118, 110];

function heute(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function lastY(doc: JsPdf): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function ensureSpace(doc: JsPdf, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function header(
  doc: JsPdf,
  title: string,
  siedlung: string,
  provisorisch: boolean,
  provisorischHinweis = "Periode noch nicht abgeschlossen",
): number {
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEAL);
  doc.text(title, MARGIN, MARGIN + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  if (siedlung) doc.text(siedlung, MARGIN, MARGIN + 10);

  if (provisorisch) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28);
    doc.text("PROVISORISCH", width - MARGIN, MARGIN + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(provisorischHinweis, width - MARGIN, MARGIN + 9, { align: "right" });
  }
  doc.setTextColor(0);
  return MARGIN + 18;
}

function footers(doc: JsPdf, version: string) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Erstellt am ${heute()} · hauswart-app v${version}`, MARGIN, height - 10);
    doc.text(`Seite ${i} von ${pages}`, width - MARGIN, height - 10, { align: "right" });
  }
  doc.setTextColor(0);
}

/** Zahlenspalten rechtsbündig – auch in Kopf- und Fusszeile der Tabelle. */
function rightAlign(columns: number[]) {
  return {
    didParseCell(data: { column: { index: number }; cell: { styles: { halign: string } } }) {
      if (columns.includes(data.column.index)) data.cell.styles.halign = "right";
    },
  };
}

const tableStyles = {
  theme: "grid" as const,
  styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
  headStyles: { fillColor: TEAL, textColor: 255 },
  margin: { left: MARGIN, right: MARGIN },
};

function drawAbrechnung(doc: JsPdf, autoTable: AutoTable, a: Abrechnung, siedlung: string) {
  let y = header(doc, "Abrechnung Hauswartung", siedlung, a.provisorisch);

  doc.setFontSize(10);
  const info: [string, string][] = [
    ["Familie", a.familie],
    ["Periode", `${a.period.name} (${formatDate(a.period.von)} – ${formatDate(a.period.bis)})`],
    ["Stundensatz", formatChf(Math.round(a.period.stundensatz_chf * 100))],
  ];
  for (const [label, value] of info) {
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 30, y);
    y += 5.5;
  }

  autoTable(doc, {
    ...tableStyles,
    startY: y + 3,
    head: [["Datum", "Tätigkeit", "Stunden", "Betrag CHF", "Bemerkung"]],
    body: a.entries.map((e) => [
      formatDate(e.datum),
      e.activities?.name ?? "",
      e.dauer_h === null ? "" : formatHours(e.dauer_h),
      e.betrag_chf === null ? "" : formatChf(Math.round(e.betrag_chf * 100)).replace("CHF ", ""),
      [e.bemerkung, e.admin_kommentar ? `Admin: ${e.admin_kommentar}` : null].filter(Boolean).join("\n"),
    ]),
    columnStyles: { 4: { cellWidth: 60 } },
    ...rightAlign([2, 3]),
  });
  if (a.entries.length === 0) {
    doc.setFontSize(9);
    doc.text("Keine Einträge in dieser Periode.", MARGIN, lastY(doc) + 6);
  }

  if (a.stundenProTaetigkeit.length > 0) {
    autoTable(doc, {
      ...tableStyles,
      startY: lastY(doc) + 8,
      head: [["Stunden pro Tätigkeit", "Stunden"]],
      body: a.stundenProTaetigkeit.map((s) => [s.name, formatHours(s.value)]),
      columnStyles: { 1: { cellWidth: 30 } },
      ...rightAlign([1]),
      tableWidth: 110,
    });
  }

  const summary: (string | { content: string; styles: { fontStyle: "bold" } })[][] = [
    [`Stunden total ${formatHours(a.stunden)} × ${formatChf(Math.round(a.period.stundensatz_chf * 100))}`, formatChf(a.stundenRappen)],
    ...a.auslagen.map((x) => [`Auslagen ${x.name}`, formatChf(x.value)]),
    [
      { content: "Total", styles: { fontStyle: "bold" } },
      { content: formatChf(a.totalRappen), styles: { fontStyle: "bold" } },
    ],
  ];
  autoTable(doc, {
    ...tableStyles,
    theme: "plain",
    startY: lastY(doc) + 8,
    body: summary,
    columnStyles: { 1: { halign: "right", cellWidth: 35 } },
    tableWidth: 110,
    styles: { ...tableStyles.styles, fontSize: 10 },
  });

  const visumY = ensureSpace(doc, lastY(doc) + 20, 30);
  doc.setFontSize(9);
  doc.setTextColor(80);
  const colWidth = (doc.internal.pageSize.getWidth() - 2 * MARGIN - 10) / 2;
  for (const [i, label] of ["Visum Verwalter (Ort, Datum)", "Visum Familie (Ort, Datum)"].entries()) {
    const x = MARGIN + i * (colWidth + 10);
    doc.line(x, visumY, x + colWidth, visumY);
    doc.text(label, x, visumY + 5);
  }
  doc.setTextColor(0);
}

export async function downloadAbrechnungPdf(a: Abrechnung, siedlung: string, version: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawAbrechnung(doc, autoTable, a, siedlung);
  footers(doc, version);
  doc.save(`Abrechnung ${a.period.name} ${a.familie}.pdf`);
}

/** Eine Seite Zusammenfassung, danach je eine Abrechnung pro Familie. */
export async function downloadSammelPdf(abrechnungen: Abrechnung[], siedlung: string, version: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const period = abrechnungen[0].period;
  const provisorisch = abrechnungen.some((a) => a.provisorisch);

  let y = header(doc, `Abrechnung ${period.name} – Übersicht`, siedlung, provisorisch);
  doc.setFontSize(10);
  doc.text(
    `${formatDate(period.von)} – ${formatDate(period.bis)} · Stundensatz ${formatChf(Math.round(period.stundensatz_chf * 100))}`,
    MARGIN,
    y,
  );
  y += 4;

  const total = abrechnungen.reduce(
    (acc, a) => ({
      stunden: acc.stunden + a.stunden,
      stundenRappen: acc.stundenRappen + a.stundenRappen,
      auslagenRappen: acc.auslagenRappen + a.auslagenRappen,
      totalRappen: acc.totalRappen + a.totalRappen,
    }),
    { stunden: 0, stundenRappen: 0, auslagenRappen: 0, totalRappen: 0 },
  );

  autoTable(doc, {
    ...tableStyles,
    startY: y + 3,
    head: [["Familie", "Stunden", "Stunden CHF", "Auslagen", "Total"]],
    body: abrechnungen.map((a) => [
      a.familie,
      formatHours(a.stunden),
      formatChf(a.stundenRappen),
      formatChf(a.auslagenRappen),
      formatChf(a.totalRappen),
    ]),
    foot: [["Total", formatHours(total.stunden), formatChf(total.stundenRappen), formatChf(total.auslagenRappen), formatChf(total.totalRappen)]],
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
    ...rightAlign([1, 2, 3, 4]),
  });

  for (const a of abrechnungen) {
    doc.addPage();
    drawAbrechnung(doc, autoTable, a, siedlung);
  }
  footers(doc, version);
  doc.save(`Abrechnung ${period.name} alle Familien.pdf`);
}

export async function downloadJahresberichtPdf(bericht: Jahresbericht, siedlung: string, version: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = header(
    doc,
    `Jahresbericht Hauswartung ${bericht.jahr}`,
    siedlung,
    bericht.provisorisch,
    "Noch nicht alle Perioden abgeschlossen",
  );
  doc.setFontSize(10);
  doc.text(`Grundlage für die Generalversammlung · Kalenderjahr ${bericht.jahr}`, MARGIN, y);
  y += 4;

  autoTable(doc, {
    ...tableStyles,
    startY: y + 3,
    head: [["Familie", "Stunden", "Stunden CHF", "Auslagen", "Total"]],
    body: bericht.rows.map(({ familie, summary }) => [
      familie,
      formatHours(summary.stunden),
      formatChf(summary.stundenRappen),
      formatChf(summary.auslagenRappen),
      formatChf(summary.totalRappen),
    ]),
    foot: [[
      "Total",
      formatHours(bericht.total.stunden),
      formatChf(bericht.total.stundenRappen),
      formatChf(bericht.total.auslagenRappen),
      formatChf(bericht.total.totalRappen),
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
    ...rightAlign([1, 2, 3, 4]),
  });

  if (bericht.stundenProTaetigkeit.length > 0) {
    autoTable(doc, {
      ...tableStyles,
      startY: lastY(doc) + 8,
      head: [["Stunden pro Tätigkeit", "Stunden"]],
      body: bericht.stundenProTaetigkeit.map((s) => [s.name, formatHours(s.value)]),
      columnStyles: { 1: { cellWidth: 30 } },
      ...rightAlign([1]),
      tableWidth: 110,
    });
  }

  if (bericht.perioden.length > 0) {
    autoTable(doc, {
      ...tableStyles,
      startY: lastY(doc) + 8,
      head: [["Enthaltene Perioden", "Zeitraum", "Stundensatz", "Status"]],
      body: bericht.perioden.map((p) => [
        p.name,
        `${formatDate(p.von)} – ${formatDate(p.bis)}`,
        formatChf(Math.round(p.stundensatz_chf * 100)),
        p.status,
      ]),
      ...rightAlign([2]),
    });
  }

  footers(doc, version);
  doc.save(`Jahresbericht ${bericht.jahr}.pdf`);
}
