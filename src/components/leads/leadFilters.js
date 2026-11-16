// Lead list filters (docs/API_REFERENCE.md, "10. Lead list filters"). Pure helpers, no React.
// The URL uses the API's own parameter names, so URL -> list / stats / export query is direct.
// "sort" holds the page's sort option (e.g. "submitted_at:desc"); the page maps it.

export const COMMON_KEYS = [
  "search",
  "date_from",
  "date_to",
  "event_from",
  "event_to",
  "upcoming_days",
  "vendor_id",
  "unassigned",
  "update_status",
  "quote",
  "conversion",
  "origin",
];
export const SOURCE_KEYS = {
  spin: ["branch", "pincode", "budget"],
  whatsapp: ["country"],
  wedding: ["occasion", "city", "budget_min", "budget_max", "shared_with", "hide_repeats"],
  wedding_planner: [
    "city",
    "guests_min",
    "guests_max",
    "budget_min",
    "budget_max",
    "fits_budget",
    "last_step",
    "shared_with",
  ],
};
// Vendors → KOC list (docs section 11): its own filters, not the lead sources' ones
export const KOC = "vendor_to_koc";
export const DHRUVA = "dhruva";
export const DHRUVA_KEYS = [
  "search", "date_from", "date_to", "event_from", "event_to", "upcoming_days",
  "venue", "event_type", "update_status", "quote", "conversion",
  "follow_up_from", "follow_up_to", "follow_up_due", "has_phone", "also_in",
];
export const KOC_KEYS = [
  "search",
  "date_from",
  "date_to",
  "lead_date_from",
  "lead_date_to",
  "vendor_id",
  "update_status",
  "follow_up_from",
  "follow_up_to",
  "follow_up_due",
  "city",
  "source",
];
// Admin-only Vendors → KOC filter: vendor logins only see their own vendor (the API ignores it
// for them; it's dropped). Update and Follow-up filters are for everyone.
export const KOC_ADMIN_KEYS = ["vendor_id"];
export const withoutKocAdminKeys = (query) =>
  Object.fromEntries(Object.entries(query).filter(([k]) => !KOC_ADMIN_KEYS.includes(k)));

export const MULTI_KEYS = ["vendor_id", "origin", "update_status", "source", "event_type"];
export const NOT_SHARED = "__none__";
export const UPCOMING_DAYS = "30";

// Rows per page: the API accepts only these (default 10). Kept in the URL as ?page_size=25.
export const PAGE_SIZES = [10, 25, 50, 100];
export function pageSizeOf(params) {
  const n = Number(params.get("page_size"));
  return PAGE_SIZES.includes(n) ? n : PAGE_SIZES[0];
}

export const keysFor = (source) =>
  source === KOC ? KOC_KEYS : source === DHRUVA ? DHRUVA_KEYS : [...COMMON_KEYS, ...(SOURCE_KEYS[source] ?? [])];

// URLSearchParams -> { key: "" | "value" | ["v", …], sort }
export function readFilters(params, source) {
  const out = {};
  for (const k of keysFor(source)) out[k] = MULTI_KEYS.includes(k) ? params.getAll(k) : (params.get(k) ?? "");
  out.sort = params.get("sort") ?? "";
  return out;
}

// Filters -> the API query (empty values left out; sort and paging are added by the page)
export function toApiQuery(filters, source) {
  const q = {};
  for (const k of keysFor(source)) {
    const v = filters[k];
    if (Array.isArray(v) ? v.length : v !== "" && v != null) q[k] = v;
  }
  return q;
}

// A query object -> "a=1&b=2&b=3" (arrays repeat the key), in the object's key order
export function toQueryString(query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item !== undefined && item !== null && item !== "") params.append(k, String(item));
    }
  }
  return params.toString();
}

// The number shown on the "Filters" badge: one per filter in use (search and sort aren't counted)
export function activeCount(filters, source) {
  const has = (k) => (Array.isArray(filters[k]) ? filters[k].length > 0 : Boolean(filters[k]));
  if (source === KOC) {
    return [
      ["date_from", "date_to"],
      ["lead_date_from", "lead_date_to"],
      ["vendor_id"],
      ["update_status"],
      ["follow_up_from", "follow_up_to", "follow_up_due"],
      ["city"],
      ["source"],
    ].filter((g) => g.some(has)).length;
  }
  if (source === DHRUVA) {
    return [
      ["date_from", "date_to"], ["event_from", "event_to", "upcoming_days"], ["venue"],
      ["event_type"], ["update_status"], ["quote"], ["conversion"],
      ["follow_up_from", "follow_up_to", "follow_up_due"], ["has_phone"], ["also_in"],
    ].filter((group) => group.some(has)).length;
  }
  const groups = [
    ["date_from", "date_to"],
    ["event_from", "event_to", "upcoming_days"],
    ["vendor_id", "unassigned"],
    ["update_status"],
    ["quote"],
    ["conversion"],
    ["origin"],
  ];
  const own = SOURCE_KEYS[source] ?? [];
  const ranges = [
    ["budget_min", "budget_max"],
    ["guests_min", "guests_max"],
  ].filter(([a]) => own.includes(a));
  const inRanges = ranges.flat();
  for (const k of own) if (!inRanges.includes(k)) groups.push([k]);
  groups.push(...ranges);
  return groups.filter((g) => g.some(has)).length;
}

// New URL params with these keys changed ("" / null / [] removes a key)
export function withFilters(params, updates) {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(updates)) {
    next.delete(k);
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item !== undefined && item !== null && item !== "" && item !== false) next.append(k, String(item));
    }
  }
  return next;
}

// "Clear filters": everything goes (the date back to All time) except the sort and rows per page
export function clearedParams(params) {
  const next = new URLSearchParams();
  for (const k of ["sort", "page_size"]) {
    const v = params.get(k);
    if (v) next.set(k, v);
  }
  return next;
}

// quote: "has" | "none" | "gt:<amount>" | "lt:<amount>"
export function parseQuote(value) {
  const v = String(value ?? "");
  if (v === "has" || v === "none") return { op: v, amount: "" };
  const m = /^(gt|lt):(\d+)$/.exec(v);
  return m ? { op: m[1], amount: m[2] } : { op: "", amount: "" };
}
export function buildQuote(op, amount) {
  if (op === "has" || op === "none") return op;
  const digits = String(amount ?? "").replace(/\D/g, "");
  return (op === "gt" || op === "lt") && digits ? `${op}:${digits}` : "";
}

// Arrival date <-> the period control ({ all: true } = All time, the default for lists)
export function periodOfFilters(filters) {
  const from = filters.date_from || filters.date_to;
  const to = filters.date_to || filters.date_from;
  return from ? { from, to } : { all: true };
}
export const filtersOfPeriod = (period) =>
  period.all ? { date_from: "", date_to: "" } : { date_from: period.from, date_to: period.to };

// Labels (names, never ids)
export const ORIGIN_LABELS = {
  workflow: "Spin game",
  sheet: "Google Sheet",
  added: "Added",
  imported: "Imported",
};
// Update (update_status): "pending" (no update yet) and the 7 values, as Vendors → KOC
export const UPDATE_LABELS = {
  pending: "Pending",
  converted: "Converted",
  not_converted: "Not converted",
  purchased_elsewhere: "Already purchased somewhere else",
  purchased_with_us: "Already purchased with us",
  will_call_back: "Will call back",
  interested: "Interested",
  not_interested: "Not interested",
};
export const branchName = (b) => b.name || `Branch #${b.id}`;
export const withCount = (label, count) => (count != null ? `${label} (${count})` : label);
