// Dhruva leads helpers (docs/API_REFERENCE.md section 13). Pure, no React.

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
export const dhruvaFieldAccess = (role) => ({
  editBasic: role === "admin" || role === "dhruva",
  editAdmin: role === "admin",
  archive: role === "admin",
});
export const statusLabel = (v) =>
  v == null || v === PENDING ? "Pending" : (STATUSES.find((s) => s.value === v)?.label ?? v);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-12-13" -> "13 Dec 2026"; anything else returned as-is
export function dayText(value) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(value);
}

// ISO date-time -> "14 Nov 2026, 10:30 am" (India time)
export function dateTimeText(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toLowerCase();
  return `${day}, ${time}`;
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

// CSV for the re-check: columns match the preview's field names
function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function rowsToDhruvaRecheck(rows) {
  const lines = ["Name,Venue,Date,Phone,Alt phone,Event type"];
  for (const r of rows) {
    const vals = r.values ?? r;
    lines.push(
      [vals.name, vals.venue, vals.date, vals.phone, vals.alt_phone, vals.event_type]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

// Map the re-check rows back to the original row numbers
export function mapDhruvaRecheck(sent, checked) {
  const original = new Map(sent.map((r, i) => [i + 2, r.row]));
  return checked.map((r) => ({ ...r, row: original.get(r.row) ?? r.row }));
}
