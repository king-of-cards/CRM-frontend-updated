// Builds a one-lead PDF with a big diagonal "KING OF CARDS" watermark, then downloads it.
// jsPDF is loaded only when someone clicks Download, so it doesn't slow the app down.
//
// sections: [{ title, rows: [[label, value], ...] }]

const BRAND = [29, 85, 78]; // brand-700
const INK = [17, 24, 39];
const MUTED = [107, 114, 128];

// The built-in PDF fonts can't draw ₹ or some dashes: replace them
const clean = (v) =>
  String(v ?? "")
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

function watermark(doc) {
  // Big diagonal text centred on the page, drawn first so everything else sits on top
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const text = "KING OF CARDS";
  const angle = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(78);
  doc.setTextColor(228, 236, 234);
  const tw = doc.getTextWidth(text);
  const rad = (angle * Math.PI) / 180;
  const x = w / 2 - (Math.cos(rad) * tw) / 2;
  const y = h / 2 + (Math.sin(rad) * tw) / 2 + 20;
  doc.text(text, x, y, { angle });
}

function header(doc, { title, subtitle, source }) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("KING OF CARDS  ·  LEAD DETAILS", 40, 30);
  doc.setFontSize(20);
  doc.text(clean(title).slice(0, 60), 40, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clean([source, subtitle].filter(Boolean).join("  ·  ")).slice(0, 110), 40, 76);
  doc.text(`Downloaded ${new Date().toLocaleString("en-IN")}`, w - 40, 30, { align: "right" });
}

export async function downloadLeadPdf({ title, subtitle, source, sections, fileName }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const labelW = 170;
  const valueW = w - 80 - labelW;

  watermark(doc);
  header(doc, { title, subtitle, source });
  let y = 122;

  const newPage = () => {
    doc.addPage();
    watermark(doc);
    y = 50;
  };

  for (const section of sections) {
    const rows = section.rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
    if (!rows.length) continue;
    if (y > h - 90) newPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND);
    doc.text(clean(section.title).toUpperCase(), 40, y);
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.8);
    doc.line(40, y + 5, w - 40, y + 5);
    y += 22;

    for (const [label, value] of rows) {
      const lines = doc.splitTextToSize(clean(value), valueW);
      const height = Math.max(lines.length, 1) * 13 + 7;
      if (y + height > h - 40) newPage();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(clean(label), 40, y);
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(lines, 40 + labelW, y);
      y += height;
    }
    y += 12;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("King of Cards CRM  ·  Confidential: for internal use only", 40, h - 20);
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 20, { align: "right" });
  }

  doc.save(fileName || "lead.pdf");
}