// KOC → Dhruva helpers (docs/API_REFERENCE.md section 18). Pure, no React.
// Spin leads KOC shares with Dhruva by rule: budget per card ≥ ₹70 or quantity ≥ 1000.
import { AOV_FILTERS, aovOf } from "./aov.js";
import { PENDING, shortRupees, STATUSES } from "./dhruvaUtils.js";
import { REASON_LABELS } from "../components/leads/leadFilters.js";

export const KOC_TO_DHRUVA_PATH = "/koc-to-dhruva";
export { REASON_LABELS };

export const num = (n) => (n == null || n === 0 ? "—" : Number(n).toLocaleString("en-IN"));

// A link to the KOC → Dhruva list with these filters and, unless All time, the period (received)
export function kocToDhruvaListLink(filters = {}, period) {
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
  return qs ? `${KOC_TO_DHRUVA_PATH}?${qs}` : KOC_TO_DHRUVA_PATH;
}

// The Reason badge: the API's reason_label, else ours ("Budget ≥ ₹70" / "Quantity ≥ 1000")
export const reasonLabel = (reason, label) => label || REASON_LABELS[reason] || (reason ? String(reason) : "");

// Estimated budget per card as sent by the workflow ("70-100", "70_100", "500_PLUS", "400")
export function budgetText(value) {
  if (value == null || value === "") return "—";
  const v = String(value).trim();
  if (/^\d+\s*[_-]?\s*plus$/i.test(v) || /^\d+\+$/.test(v)) return `₹${v.match(/\d+/)[0]}+`;
  if (/^under[_\s-]*\d+$/i.test(v)) return `Under ₹${v.match(/\d+/)[0]}`;
  if (/^\d/.test(v)) return `₹${v.replace(/\s*[-_]\s*/g, "–")}`;
  return v;
}

export const quantityText = (q) =>
  q == null || q === "" ? "—" : Number.isFinite(Number(q)) ? Number(q).toLocaleString("en-IN") : String(q);

// Budget bands of the dashboard (by_budget_band), in the API's order
export const BUDGET_BAND_LABELS = {
  "70-100": "₹70–100",
  "100-200": "₹100–200",
  "200-500": "₹200–500",
  "500+": "₹500+",
  under_70: "Under ₹70 (quantity only)",
  not_given: "Not given",
};
const BAND_ORDER = Object.keys(BUDGET_BAND_LABELS);

// by_budget_band may be an object { band: count } or a list [{ band|value, label?, count }]
export function budgetBandRows(byBand) {
  const list = Array.isArray(byBand)
    ? byBand.map((b) => ({ key: b.band ?? b.value ?? b.key, label: b.label, count: b.count ?? 0 }))
    : Object.entries(byBand ?? {}).map(([key, count]) => ({ key, count }));
  return list
    .map((b) => ({ ...b, label: b.label ?? BUDGET_BAND_LABELS[b.key] ?? String(b.key), count: Number(b.count) || 0 }))
    .sort((a, b) => (BAND_ORDER.indexOf(a.key) + 1 || 99) - (BAND_ORDER.indexOf(b.key) + 1 || 99));
}

// by_reason [{ reason, label, count }] -> rows that open the list with that reason
export const reasonRows = (byReason) =>
  (byReason ?? []).map((r) => ({
    key: r.reason,
    label: reasonLabel(r.reason, r.label),
    count: Number(r.count) || 0,
    filters: { reason: r.reason },
  }));

// by_occasion [{ value|occasion, count }] -> rows that open the list with that occasion
export const occasionRows = (byOccasion) =>
  (byOccasion ?? []).map((o) => {
    const value = o.value ?? o.occasion ?? o.label;
    return { key: value, label: value, count: Number(o.count) || 0, filters: { occasion: value } };
  });

// Update breakdown: Pending first, then the 7 statuses
export function statusRows(byStatus) {
  const b = byStatus ?? {};
  return [
    { key: PENDING, label: "Pending", count: b.pending ?? 0, filters: { update_status: [PENDING] } },
    ...STATUSES.map((s) => ({ key: s.value, label: s.label, count: b[s.value] ?? 0, filters: { update_status: [s.value] } })),
  ];
}

export const pctText = (p) => (p == null ? "" : `${p}%`);

// The dashboard's KPI cards, in the other dashboards' order; each opens the matching list
// (with the period). Converted shows its rate.
export function dashboardKpiCards(kpis, period) {
  const k = kpis ?? {};
  const link = (filters) => kocToDhruvaListLink(filters, period);
  const { value: aov } = aovOf(k);
  return [
    { key: "total", label: "Total leads", value: num(k.total), to: link({}) },
    { key: "interested", label: "Interested", value: num(k.interested), to: link({ update_status: ["interested"] }) },
    { key: "not_interested", label: "Not interested", value: num(k.not_interested), to: link({ update_status: ["not_interested"] }) },
    { key: "quotes_sent", label: "Quotes sent", value: num(k.quotes_count), to: link({ quote: "has" }) },
    { key: "quoted_amount", label: "Quoted amount", value: k.quoted_count ? shortRupees(k.quoted_total ?? 0) : "—", to: link({ quote: "has" }) },
    {
      key: "converted",
      label: "Converted",
      value: k.converted ? `${num(k.converted)}${k.converted_pct != null ? ` · ${pctText(k.converted_pct)}` : ""}` : "—",
      to: link({ update_status: ["converted"] }),
    },
    { key: "conversion_amount", label: "Conversion amount", value: k.conversion_count ? shortRupees(k.conversion_total ?? 0) : "—", to: link({ conversion: "has" }) },
    { key: "aov", label: "AOV", value: aov == null ? "—" : shortRupees(Math.round(aov)), to: link(AOV_FILTERS) },
    { key: "hot", label: "Hot leads", value: num(k.hot_count), to: link({ hot: "yes" }) },
    { key: "pending", label: "Pending", value: num(k.pending), to: link({ update_status: [PENDING] }) },
  ];
}

// Spin's raw fields: matching ignores case, "_" and the "additional_details." prefix
const FIELDS = {
  name: ["name", "fullname", "bridegroomname", "customername", "leadname", "clientname", "contactname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "bridegroomphone", "contactnumber", "whatsapp", "whatsappnumber"],
  email: ["email", "emailaddress", "customeremail"],
  branch: ["branchid", "spinbranchid", "branch", "storeid", "store"],
  city: ["city", "location", "eventcity"],
};
const norm = (s) => String(s).toLowerCase().replace(/^additional_details\./, "").replace(/[^a-z0-9]/g, "");

// A Spin field of a list item (name, phone, email, branch, city), or null
export function spinField(lead, field) {
  if (!lead) return null;
  const keys = Object.keys(lead);
  for (const candidate of FIELDS[field] ?? []) {
    const key = keys.find((k) => norm(k) === candidate);
    const v = key ? lead[key] : null;
    if (v != null && v !== "" && typeof v !== "object") return v;
    if (field === "branch" && v && typeof v === "object") return v;
  }
  return null;
}

// The CRM details this section edits (PUT …/crm); anything else answers 422
export const CRM_KEYS = ["update_status", "notes", "quoted_amount", "quoted_date", "conversion_amount", "follow_up_date"];
export const crmFormOf = (crm) => ({
  update_status: crm?.update_status ?? PENDING,
  notes: crm?.notes ?? "",
  quoted_amount: crm?.quoted_amount == null ? "" : String(crm.quoted_amount),
  quoted_date: crm?.quoted_date ?? "",
  conversion_amount: crm?.conversion_amount == null ? "" : String(crm.conversion_amount),
  follow_up_date: crm?.follow_up_date ?? "",
});
const amount = (v) => {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
};
// The form as the API's values (null clears)
const valuesOf = (form) => ({
  update_status: form.update_status === PENDING ? null : form.update_status,
  notes: form.notes.trim() || null,
  quoted_amount: amount(form.quoted_amount),
  quoted_date: form.quoted_date || null,
  conversion_amount: amount(form.conversion_amount),
  follow_up_date: form.follow_up_date || null,
});

// Only the fields that differ from the saved CRM details
export function crmChanges(form, crm) {
  const next = valuesOf(form);
  const changes = {};
  for (const key of CRM_KEYS) if ((crm?.[key] ?? null) !== next[key]) changes[key] = next[key];
  return changes;
}
