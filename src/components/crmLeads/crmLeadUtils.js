// Pure helpers for leads added or imported in the CRM (no React, no network), so they can be
// unit-tested with `bun test`. API reference: docs/API_REFERENCE.md.

export const SOURCE_NAMES = {
  spin: "Spin leads",
  wedding_gifts: "Wedding gifts",
  whatsapp: "International",
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
};

export const CRM_ORIGINS = ["added", "imported"];

// Sources read from the workflow spin_lead table: bulk upload only (no single add), Spin's filters
export const SPIN_FAMILY = ["spin", "wedding_gifts"];

// Only these leads can be edited or archived here (sheet and spin-game leads can't)
export const isCrmLead = (row) => CRM_ORIGINS.includes(row?.origin);

// "attachment; filename="wedding-leads-2026-11-14.xlsx"" -> "wedding-leads-2026-11-14.xlsx"
export function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

// ── Export: the list's filter query -> the export's query ──────────────────
// Pages pass the same API query they send to their list (docs section 10: search, dates,
// interest=…&interest=…, quote, origin, the source's own filters…) plus sort / order.
// Paging is dropped; arrays stay arrays (repeated parameters).
export function exportQuery(source, params = {}, format = "xlsx") {
  const query = { format };
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === "page" || k === "page_size" || k === "format") continue;
    if (Array.isArray(v) ? v.length === 0 : v === undefined || v === null || v === "") continue;
    query[k] = v;
  }
  // The spin lists (Spin and Wedding gifts) only send an order together with a sort
  if (SPIN_FAMILY.includes(source) && !query.sort) delete query.order;
  return query;
}

// ── Dates ───────────────────────────────────────────────────────────────
const IST_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// ISO date-time -> "DD-MM-YYYY" (India time)
export function ddmmyyyy(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return IST_DAY.format(d).replace(/\//g, "-");
}

// ISO date-time (UTC) -> "YYYY-MM-DDTHH:MM" in India time, for <input type="datetime-local">
export function toIstInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

// ── Duplicates and warnings ────────────────────────────────────────────
export function duplicateLabel(duplicate) {
  if (!duplicate) return null;
  if (duplicate.reason === "in_file")
    return duplicate.duplicate_of_row != null
      ? `Repeated in this file (same as row ${duplicate.duplicate_of_row})`
      : "Repeated in this file";
  return "Already exists";
}

export function duplicateWhere(duplicate) {
  if (!duplicate) return "";
  switch (duplicate.reason) {
    case "existing_sheet":
      return "In the sheet";
    case "existing_workflow":
      return "In the spin game";
    case "existing_added": {
      const day = ddmmyyyy(duplicate.created_at);
      const when = day ? `Added on ${day}` : "Added in the CRM";
      return duplicate.archived ? `${when} (archived)` : when;
    }
    case "in_file":
      return duplicate.duplicate_of_row != null ? `Same as row ${duplicate.duplicate_of_row}` : "Earlier in this file";
    default:
      return "";
  }
}

export function otherSources(warnings) {
  const w = (warnings ?? []).find((x) => x.type === "other_source");
  return w?.sources ?? [];
}

export const sourceList = (sources) => sources.map((s) => SOURCE_NAMES[s] ?? s).join(", ");

// ── Upload rows ────────────────────────────────────────────────────────
// Counts for the rows still in the table (rows can be removed, so recount here)
export function summarize(rows) {
  const c = { total: rows.length, ok: 0, errors: 0, inFile: 0, existing: 0, otherSource: 0 };
  for (const r of rows) {
    if (r.status === "ok") c.ok += 1;
    else if (r.status === "error") c.errors += 1;
    else if (r.status === "duplicate") {
      if (r.duplicate?.reason === "in_file") c.inFile += 1;
      else c.existing += 1;
    }
    if (otherSources(r.warnings).length) c.otherSource += 1;
  }
  return c;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "Skipping 2 that need fixing, 1 repeated in this file and 3 that already exist."
export function skippedText(counts) {
  const parts = [];
  if (counts.errors) parts.push(`${counts.errors} that need${counts.errors === 1 ? "s" : ""} fixing`);
  if (counts.inFile) parts.push(`${counts.inFile} repeated in this file`);
  if (counts.existing)
    parts.push(`${counts.existing} that already exist${counts.existing === 1 ? "s" : ""}`);
  if (!parts.length) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Skipping ${list}.`;
}

export const submitLabel = (n) => `Submit ${plural(n, "new lead", "new leads")}`;

// Errors of one field, as text
export function fieldErrors(row, key) {
  return (row.errors ?? []).filter((e) => e.field === key).map((e) => e.message);
}

// ── Re-check: rows -> CSV for POST import/preview ───────────────────────
// Field keys are accepted as headers. In a CSV the spin branch must be its name, not its id.
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(fields, rows, branches = []) {
  const names = new Map(branches.map((b) => [String(b.id), b.name]));
  const keys = fields.map((f) => f.key);
  const lines = [keys.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      keys
        .map((k) => {
          let v = r.values?.[k];
          const field = fields.find((f) => f.key === k);
          if (field?.type === "branch" && v !== null && v !== undefined && v !== "" && names.has(String(v)))
            v = names.get(String(v));
          return csvCell(v);
        })
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

// The re-check's rows are numbered 2, 3, … (row 1 is the header). Put the original file's
// row numbers back, including in "same as row N".
export function mapRecheck(sentRows, checkedRows) {
  const original = new Map(sentRows.map((r, i) => [i + 2, r.row]));
  return checkedRows.map((r) => {
    const row = original.get(r.row) ?? r.row;
    const duplicate =
      r.duplicate?.reason === "in_file"
        ? { ...r.duplicate, duplicate_of_row: original.get(r.duplicate.duplicate_of_row) ?? r.duplicate.duplicate_of_row }
        : r.duplicate;
    return { ...r, row, duplicate };
  });
}

// ── Single add / edit form values ──────────────────────────────────────
// Form state is text; turn it into the JSON the API takes.
export function formToValues(fields, form, { onlyChanged = null } = {}) {
  const values = {};
  for (const f of fields) {
    const raw = form[f.key];
    let v = typeof raw === "string" ? raw.trim() : raw;
    if (v === "" || v === undefined) v = null;
    if (v !== null && f.type === "bool") v = v === true || v === "yes";
    if (v !== null && f.type === "branch" && /^\d+$/.test(String(v))) v = Number(v);
    if (onlyChanged) {
      const before = onlyChanged[f.key] ?? null;
      if (String(before ?? "") === String(raw ?? "")) continue;
      values[f.key] = v;
    } else if (v !== null) {
      values[f.key] = v;
    }
  }
  return values;
}

// Lead object values -> form state (text) for the edit form
export function valuesToForm(fields, values = {}) {
  const form = {};
  for (const f of fields) {
    const v = values[f.key];
    if (v === null || v === undefined) form[f.key] = "";
    else if (f.type === "bool") form[f.key] = v ? "yes" : "no";
    else if (f.type === "datetime") form[f.key] = toIstInput(v);
    else if (f.type === "date") form[f.key] = String(v).slice(0, 10);
    else form[f.key] = String(v);
  }
  return form;
}

// Error text from an ApiError (our 409/422 bodies have detail.message)
export function errorText(err) {
  if (err?.detail && typeof err.detail === "object" && !Array.isArray(err.detail) && err.detail.message)
    return err.detail.message;
  return err?.message ?? "Something went wrong.";
}

// 422 field errors -> { key: "message" }
export function errorsByField(err) {
  const list = err?.status === 422 && Array.isArray(err?.detail?.errors) ? err.detail.errors : [];
  const out = {};
  for (const e of list) out[e.field] = out[e.field] ? `${out[e.field]} ${e.message}` : e.message;
  return out;
}

// ── Preview columns: the list screen's columns, from the template's header row ───────────
// The CSV template has the export's (= the list screen's) columns. Header -> field matching
// ignores case, spaces and punctuation, like the backend.
const normHeader = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// First line of a CSV file -> its cells (quotes handled; a BOM is dropped)
export function parseCsvHeader(text) {
  const line = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells.filter((c) => c !== "");
}

// Field keys whose label is a template column, in the template's order (read-only columns have
// no field, so they drop out)
export function screenFieldKeys(fields, headers) {
  const out = [];
  for (const h of headers) {
    const f = fields.find((x) => normHeader(x.label) === normHeader(h));
    if (f && !out.includes(f.key)) out.push(f.key);
  }
  return out;
}

// Columns for the upload preview: the screen's columns in the template's order, then any other
// field that is in the file or has an error (in the fields' order). Without the template: the
// file's columns, in the fields' order.
export function previewColumns(fields, { screenKeys = null, fileKeys = [], errorKeys = [] } = {}) {
  const screen = [...(screenKeys ?? [])];
  const first = screen.map((k) => fields.find((f) => f.key === k)).filter(Boolean);
  const extra = new Set(["phone", ...fileKeys, ...errorKeys]);
  return [...first, ...fields.filter((f) => !screen.includes(f.key) && extra.has(f.key))];
}

// ── "Assigned to" choices: Unassigned, each active vendor, Automatic ──────────────
// Uploads: "Automatic" / "Auto" (or "<vendor> · auto") means automatic, empty or "Unassigned"
// means unassigned. Single add: empty means automatic.
export const AUTOMATIC = "Automatic";
const AUTO_RE = /^(.*?)\s*[·•\-–(]?\s*auto\)?$/i;

export function isAutoAssigned(value) {
  const m = AUTO_RE.exec(String(value ?? "").trim());
  return Boolean(m && m[1].trim());
}

// A preview cell's value -> the dropdown's value ("Unassigned", a vendor name, or "Automatic")
export function assignedChoice(value) {
  const text = String(value ?? "").trim();
  if (!text || normHeader(text) === "unassigned" || normHeader(text) === "none") return "Unassigned";
  if (normHeader(text) === "automatic" || normHeader(text) === "auto" || isAutoAssigned(text)) return AUTOMATIC;
  return text;
}

// The dropdown's value -> what an upload row sends ("Automatic", "Unassigned" or a vendor name)
export function assignedForUpload(choice) {
  return choice;
}

// ── Upload-only CRM columns (docs section 2, "Uploads only") ─────────────
// Update, Quoted amount and Conversion amount are read from bulk uploads (saved with each new
// lead) but aren't in GET fields, since the add / edit forms don't have them. The preview and the
// re-check use these definitions next to GET fields.
export const UPLOAD_CRM_FIELDS = [
  { key: "update_status", label: "Update", type: "update" },
  { key: "quoted_amount", label: "Quoted amount", type: "amount" },
  { key: "conversion_amount", label: "Conversion amount", type: "amount" },
];
export const uploadFields = (fields) => [...(fields ?? []), ...UPLOAD_CRM_FIELDS];
