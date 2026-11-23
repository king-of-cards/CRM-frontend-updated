// Vendors → KOC helpers (docs/API_REFERENCE.md section 11). Pure, no React.
import { toQueryString } from "../leads/leadFilters.js";
import { formatDateTime, formatDay } from "../shared/dates.js";
import { DUPLICATE_TEXT } from "../shared/duplicates.js";

export const KOC_PATH = "/vendor-to-koc";

// Update statuses, with the labels the export uses. null (no status yet) = "Pending".
export const STATUSES = [
  { value: "converted", label: "Converted" },
  { value: "not_converted", label: "Not converted" },
  { value: "purchased_elsewhere", label: "Already purchased somewhere else" },
  { value: "purchased_with_us", label: "Already purchased with us" },
  { value: "will_call_back", label: "Will call back" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
];
export const PENDING = "pending";
export const statusLabel = (v) =>
  v == null || v === PENDING ? "Pending" : (STATUSES.find((s) => s.value === v)?.label ?? v);
// Filter values behind the dashboard's funnel steps
export const UPDATED = STATUSES.map((s) => s.value);
export const ENGAGED = ["interested", "will_call_back", "converted"];

export const SOURCES = [
  { value: "bulk_upload", label: "Bulk upload" },
  { value: "manual", label: "Manual" },
];
export const sourceLabel = (v) => SOURCES.find((s) => s.value === v)?.label ?? v;

// "2026-12-13" -> "13 Dec 2026" (as the list screens and exports); anything else as given
export function dayText(value) {
  return formatDay(value, "—");
}

// ISO date-time -> "14 Nov 2026, 10:30 am" (India time)
export function dateTimeText(iso) {
  return formatDateTime(iso, "—");
}

// Stored as 10 digits; shown as +91XXXXXXXXXX
export const phoneText = (p) => (p && /^\d{10}$/.test(String(p)) ? `+91${p}` : p || "—");

// A preview's valid date (YYYY-MM-DD) as a file accepts it (DD-MM-YYYY); other text unchanged
export function fileDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (value ?? "");
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Rows -> a CSV for POST /upload/preview (the re-check). Nothing is saved.
export function rowsToKocCsv(rows) {
  const lines = ["Name,Date,Phone,City"];
  for (const r of rows) lines.push([r.name, fileDate(r.date), r.phone, r.city].map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

// The re-check's rows are numbered 2, 3, … (row 1 is the header): put the file's rows back
export function mapKocRecheck(sent, checked) {
  const original = new Map(sent.map((r, i) => [i + 2, r.row]));
  return checked.map((r) => ({ ...r, row: original.get(r.row) ?? r.row }));
}

// A row's errors for one field, exactly as the API sent them
export const fieldErrors = (row, field) =>
  (row.errors ?? []).filter((e) => e.field === field).map((e) => e.message);

// The kind of preview row: "duplicate", "invalid" (errors) or "valid". A duplicate wins over field
// errors (docs section 4: existing > in_file > errors); its errors are still listed, for information.
export const rowKind = (r) => (r.duplicate ? "duplicate" : (r.errors ?? []).length ? "invalid" : "valid");

// Error text from an ApiError for these endpoints, without matching on the text:
// detail can be a string, or a list of { field, message } (lead rules) or { loc, msg } (FastAPI)
export function kocErrors(err) {
  const d = err?.detail;
  const fields = {};
  let message = "";
  if (Array.isArray(d)) {
    for (const e of d) {
      const field = e.field ?? (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null);
      const text = e.message ?? e.msg ?? "";
      if (field) fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
      else message = message ? `${message} ${text}` : text;
    }
    if (!message && !Object.keys(fields).length) message = err.message;
  } else if (d && typeof d === "object" && typeof d.message === "string" && d.message) {
    message = d.message;
  } else if (err?.status === 409 && !(typeof d === "string" && d)) {
    message = DUPLICATE_TEXT;
  } else {
    message = typeof d === "string" && d ? d : (err?.message ?? "Something went wrong.");
  }
  return { fields, message };
}

// A link to the list with these filters and a period ({ all } = no dates)
export function kocListLink(filters, period) {
  const q = { ...filters };
  if (period && !period.all) {
    q.date_from = period.from;
    q.date_to = period.to;
  }
  const qs = toQueryString(q);
  return qs ? `${KOC_PATH}?${qs}` : KOC_PATH;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const leadsText = (n) => plural(n, "lead", "leads");
