// Dhruva leads helpers (docs/API_REFERENCE.md section 13). Pure, no React.
import { formatDateTime, formatDay } from "../components/shared/dates.js";

export const DHRUVA_PATH = "/dhruva-leads";

// Update statuses (same set as Vendor → KOC). null = Pending.
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
// Lead fields (name … venue): admins and Dhruva logins. KOC fields (WhatsApp status … follow-up
// date): admins only; read-only for Dhruva and view-only logins (docs section 13, "Who").
export const dhruvaFieldAccess = (role) => ({
  editBasic: role === "admin" || role === "dhruva",
  editAdmin: role === "admin",
  archive: role === "admin",
});
export const statusLabel = (v) =>
  v == null || v === PENDING ? "Pending" : (STATUSES.find((s) => s.value === v)?.label ?? v);

// "2026-12-13" -> "13 Dec 2026"; anything else returned as-is
export function dayText(value) {
  return formatDay(value, "—");
}

// ISO date-time -> "14 Nov 2026, 10:30 am" (India time)
export function dateTimeText(iso) {
  return formatDateTime(iso, "—");
}

// Format a phone as +91XXXXXXXXXX if 10 digits, else as-is, else "—"
export function phoneText(p) {
  if (!p) return "—";
  const s = String(p).trim();
  if (/^\d{10}$/.test(s)) return `+91${s}`;
  return s;
}

// INR formatter
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export function shortRupees(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}
export const rupeesText = (amount) => (amount != null ? inr.format(amount) : "—");

// Parse errors from ApiError for Dhruva endpoints.
// detail may be: string | [{field, message}] | [{loc, msg}] | {message, duplicate}
export function dhruvaErrors(err) {
  const d = err?.detail;
  const fields = {};
  let message = "";
  let duplicate = null;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    // 409 shape: { message, duplicate }
    message = d.message ?? err.message ?? "Something went wrong.";
    duplicate = d.duplicate ?? null;
  } else if (Array.isArray(d)) {
    for (const e of d) {
      const field = e.field ?? (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null);
      const text = e.message ?? e.msg ?? "";
      if (field) fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
      else message = message ? `${message} ${text}` : text;
    }
    if (!message && !Object.keys(fields).length) message = err.message;
  } else {
    message = typeof d === "string" && d ? d : (err?.message ?? "Something went wrong.");
  }
  return { fields, message, duplicate };
}

// A link to the Dhruva list with these filters and optionally a period
export function dhruvaListLink(filters, period) {
  const q = { ...filters };
  if (period && !period.all) {
    q.date_from = period.from;
    q.date_to = period.to;
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${DHRUVA_PATH}?${qs}` : DHRUVA_PATH;
}

// Row kind for preview rows
export const rowKind = (r) => {
  if (r.status === "duplicate" || r.duplicate) return "duplicate";
  if ((r.errors ?? []).length) return "invalid";
  if (r.flags?.includes("no_phone")) return "no_phone";
  return "valid";
};

// Field errors for a preview row
export const fieldErrors = (row, field) =>
  (row.errors ?? []).filter((e) => e.field === field).map((e) => e.message);

// ── Fields (docs section 13, "Fields") ──
// type: text | textarea | phone | dates | yesno | update | amount | date
export const LEAD_FIELDS = [
  { key: "name", label: "Name", type: "text", max: 200, required: true },
  { key: "phones", label: "Phone numbers", type: "phones" },
  { key: "event_dates", label: "Event dates", type: "dates" },
  { key: "event_type", label: "Event type", type: "text", max: 200 },
  { key: "venue", label: "Venue", type: "text", max: 300 },
];
export const KOC_FIELDS = [
  { key: "whatsapp_status", label: "WhatsApp status", type: "text", max: 100 },
  { key: "response", label: "Response", type: "textarea", max: 5000 },
  { key: "message_sent", label: "Message sent", type: "text", max: 500 },
  { key: "follow_up_notes", label: "Follow-up notes", type: "textarea", max: 5000 },
  { key: "comments", label: "Comments", type: "textarea", max: 5000 },
  { key: "needs_intervention", label: "Needs Dhruva intervention", type: "yesno" },
  { key: "update_status", label: "Update", type: "update" },
  { key: "quoted_amount", label: "Quoted amount", type: "amount" },
  { key: "conversion_amount", label: "Conversion amount", type: "amount" },
  { key: "follow_up_date", label: "Follow-up date", type: "date" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Event dates: sorted, repeats and blanks dropped (a list, or the "2026-12-04, 2026-12-05" text)
export function cleanDates(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(list.map((d) => String(d ?? "").trim()).filter(Boolean))].sort();
}
// A lead's event dates (event_dates; an older answer's event_date as one date)
export const eventDatesOf = (lead) =>
  cleanDates(Array.isArray(lead?.event_dates) ? lead.event_dates : lead?.event_dates ?? (lead?.event_date ? [lead.event_date] : []));
// "4 Dec 2026, 5 Dec 2026", or "—"
export function eventDatesText(dates) {
  const list = cleanDates(dates);
  return list.length ? list.map((d) => formatDay(d, d)).join(", ") : "—";
}
export const badDates = (dates) => cleanDates(dates).filter((d) => !DAY.test(d));

// Phone input: digits only, 10 at most (+91 / 91 / 0 in front of a pasted number dropped)
export function phoneDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length > 10 && /^(91|0)/.test(digits)) return digits.slice(-10);
  return digits.slice(0, 10);
}
export const phoneError = (value) => (value && !/^\d{10}$/.test(value) ? "Phone must have 10 digits" : "");

// Phone numbers (docs section 13: phones, 10 digits each): order kept, blanks and repeats dropped
export function cleanPhones(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[,;/\n]/);
  return [...new Set(list.map((p) => String(p ?? "").trim()).filter(Boolean))];
}
// A lead's numbers: phones (an older answer's phone / alt_phone as a fallback)
export const phonesOf = (lead) =>
  cleanPhones(Array.isArray(lead?.phones) ? lead.phones : lead?.phones ?? [lead?.phone, lead?.alt_phone].filter(Boolean));
// "+919845012345, +919845012346", or "—"
export function phonesText(phones) {
  const list = cleanPhones(phones);
  return list.length ? list.map(phoneText).join(", ") : "—";
}
export const PHONES_ERROR = "Each phone number must have 10 digits";
export const badPhones = (phones) => cleanPhones(phones).filter((p) => !/^\d{10}$/.test(p));

export const yesNo = (v) => (v === true || /^(yes|true|y)$/i.test(String(v ?? "").trim()) ? "Yes" : "No");

// The edit form's values for a lead (strings; event_dates a list; needs_intervention a boolean)
export function dhruvaFormOf(lead) {
  const form = {};
  for (const f of [...LEAD_FIELDS, ...KOC_FIELDS]) {
    const v = lead?.[f.key];
    if (f.type === "dates") form[f.key] = eventDatesOf(lead);
    else if (f.type === "phones") form[f.key] = phonesOf(lead);
    else if (f.type === "yesno") form[f.key] = v === true;
    else if (f.type === "update") form[f.key] = v ?? PENDING;
    else form[f.key] = v == null ? "" : String(v);
  }
  return form;
}

// Rupees: plain digits (commas, ₹ and spaces dropped) as a number; other text ("1.5 lakh") as typed
function amountValue(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const plain = t.replace(/[₹,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : t;
}

// One field's value for the API
function apiValue(f, value) {
  if (f.type === "dates") return cleanDates(value);
  if (f.type === "phones") return cleanPhones(value);
  if (f.type === "yesno") return Boolean(value);
  if (f.type === "update") return value === PENDING || !value ? null : value;
  if (f.type === "amount") return amountValue(value);
  const t = String(value ?? "").trim();
  return t || null;
}
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * PATCH body: only the fields that changed. Lead fields always; KOC fields only with koc (admins).
 * phones and event_dates: the full new list ([] clears). sent_at is never sent.
 */
export function dhruvaChanges(lead, form, { koc = false } = {}) {
  const before = dhruvaFormOf(lead);
  const out = {};
  for (const f of [...LEAD_FIELDS, ...(koc ? KOC_FIELDS : [])]) {
    const next = apiValue(f, form[f.key]);
    if (!same(next, apiValue(f, before[f.key]))) out[f.key] = next;
  }
  return out;
}

// POST body for a new lead: the filled lead fields, and with koc the filled KOC fields
export function dhruvaNewLead(form, { koc = false } = {}) {
  const out = {};
  for (const f of [...LEAD_FIELDS, ...(koc ? KOC_FIELDS : [])]) {
    const v = apiValue(f, form[f.key]);
    if (f.type === "yesno" ? v : Array.isArray(v) ? v.length : v != null) out[f.key] = v;
  }
  return out;
}

// Field errors the form can tell before saving: name, 10 digits per phone number, real dates
export function dhruvaFormErrors(form, { koc = false } = {}) {
  const errors = {};
  if (!String(form.name ?? "").trim()) errors.name = "Name is required";
  if (badPhones(form.phones).length) errors.phones = PHONES_ERROR;
  if (badDates(form.event_dates).length) errors.event_dates = "Use real dates (YYYY-MM-DD)";
  if (koc && form.follow_up_date && !DAY.test(form.follow_up_date)) errors.follow_up_date = "Use a real date";
  return errors;
}

// The list's stats cards: the six KPIs plus No event date and Needs intervention (GET /leads/stats)
export function dhruvaStatCards(stats, kpiCards) {
  const s = stats ?? {};
  const n = (v) => (v ? Number(v).toLocaleString("en-IN") : "—");
  return [
    ...kpiCards(s.kpis),
    { label: "No event date", value: n(s.no_event_date) },
    { label: "Needs intervention", value: n(s.needs_intervention), tone: s.needs_intervention ? "amber" : undefined },
  ];
}

// ── Upload: the template's 15 headings (GET /leads/template) and the preview's value keys ──
export const UPLOAD_COLUMNS = [
  ["name", "Name"], ["phones", "Phone numbers"], ["event_dates", "Event date"],
  ["event_type", "Event type"], ["venue", "Venue"], ["whatsapp_status", "WhatsApp status"], ["response", "Response"],
  ["message_sent", "Message sent"], ["follow_up_notes", "Follow-up notes"], ["comments", "Comments"],
  ["needs_intervention", "Needs Dhruva intervention"], ["update_status", "Update"], ["quoted_amount", "Quoted amount"],
  ["conversion_amount", "Conversion amount"], ["follow_up_date", "Follow-up date"],
];

// CSV for the re-check: the template's headings, the rows' values (phone numbers and event dates as "a, b",
// Needs intervention as Yes / No)
function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function rowsToDhruvaRecheck(rows) {
  const lines = [UPLOAD_COLUMNS.map(([, heading]) => heading).join(",")];
  for (const r of rows) {
    const vals = r.values ?? r;
    lines.push(
      UPLOAD_COLUMNS.map(([key]) => {
        const v = vals[key];
        if (key === "event_dates") return csvCell(Array.isArray(v) ? cleanDates(v).join(", ") : v);
        if (key === "phones") return csvCell(Array.isArray(v) ? cleanPhones(v).join(", ") : v);
        if (key === "needs_intervention") return csvCell(v == null || v === "" ? "" : yesNo(v));
        return csvCell(v);
      }).join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

// Map the re-check rows back to the original row numbers
export function mapDhruvaRecheck(sent, checked) {
  const original = new Map(sent.map((r, i) => [i + 2, r.row]));
  return checked.map((r) => ({ ...r, row: original.get(r.row) ?? r.row }));
}
