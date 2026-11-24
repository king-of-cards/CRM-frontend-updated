// KOC → Dhruva helpers (docs/API_REFERENCE.md section 18). Pure, no React.
// Spin leads KOC shares with Dhruva by rule (budget per card ≥ ₹70 or quantity ≥ 1000).
import { AOV_FILTERS, aovOf } from "./aov.js";
import { PENDING, shortRupees, statusLabel } from "./dhruvaUtils.js";

export const KOC_TO_DHRUVA_PATH = "/koc-to-dhruva";

export const num = (n) => (n == null || n === 0 ? "—" : Number(n).toLocaleString("en-IN"));
export const pctText = (p) => (p == null ? "" : `${p}%`);

// Open leads (docs: Update pending, interested or will call back); the rest are closed
export const OPEN_UPDATES = [PENDING, "interested", "will_call_back"];

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

// A dashboard list entry's numbers (docs section 18, "Contact details"): phones (every number, in
// order), else the one phone; [] when none
export function entryPhones(entry) {
  const list = Array.isArray(entry?.phones) && entry.phones.length ? entry.phones : [entry?.phone];
  return [...new Set(list.map((p) => String(p ?? "").trim()).filter(Boolean))];
}

// One lead from a dashboard list: the list searched by its name, opening that lead
export const leadLink = (lead) =>
  kocToDhruvaListLink({ search: lead?.name || "", notification_lead_key: lead?.lead_key });

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

// "₹70–100 × 1,200" for a dashboard list entry (budget, quantity)
export const budgetQuantityText = (lead) => `${budgetText(lead?.budget)} × ${quantityText(lead?.quantity)}`;

// A list entry's Update: the API's status_label, else ours (null = Pending)
export const entryStatus = (lead) => lead?.status_label || statusLabel(lead?.update_status);

// Whole days from an ISO date / date-time to now (for "untouched for N days"); null without a date
export function daysSince(value, now = Date.now()) {
  if (!value) return null;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

// Budget bands (by_budget_band: [{ band, leads, converted, converted_pct }]), in the API's order
export const BUDGET_BAND_LABELS = {
  "70-100": "₹70–100",
  "100-200": "₹100–200",
  "200-500": "₹200–500",
  "500+": "₹500+",
  under_70: "Under ₹70 (quantity only)",
  not_given: "Not given",
};
const BAND_ORDER = Object.keys(BUDGET_BAND_LABELS);
export function budgetBandRows(byBand) {
  return (Array.isArray(byBand) ? byBand : [])
    .map((b) => ({
      key: b.band,
      label: BUDGET_BAND_LABELS[b.band] ?? String(b.band ?? ""),
      leads: Number(b.leads) || 0,
      converted: Number(b.converted) || 0,
      pct: b.converted_pct ?? null,
    }))
    .sort((a, b) => (BAND_ORDER.indexOf(a.key) + 1 || 99) - (BAND_ORDER.indexOf(b.key) + 1 || 99));
}

// Funnel ([{ stage, count }]): each stage with its % of Shared. Only Shared and Converted have an
// exact list filter, so only they link.
const FUNNEL_LABELS = { shared: "Shared", contacted: "Contacted", interested: "Interested", quoted: "Quoted", converted: "Converted" };
export function funnelRows(funnel, period) {
  const list = Array.isArray(funnel) ? funnel : [];
  const shared = Number(list.find((s) => s.stage === "shared")?.count) || 0;
  return list.map((s) => {
    const count = Number(s.count) || 0;
    const filters = s.stage === "shared" ? {} : s.stage === "converted" ? { update_status: ["converted"] } : null;
    return {
      key: s.stage,
      label: FUNNEL_LABELS[s.stage] ?? String(s.stage),
      count,
      pct: shared ? Math.round((count / shared) * 100) : null,
      to: filters ? kocToDhruvaListLink(filters, period) : null,
    };
  });
}

// Monthly ([{ month: "YYYY-MM", shared, converted }]) -> chart points with "Nov 2026" labels
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (month) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(month ?? ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(month ?? "");
};
export const monthlyPoints = (monthly) =>
  (Array.isArray(monthly) ? monthly : []).map((m) => ({
    month: m.month,
    label: monthLabel(m.month),
    shared: Number(m.shared) || 0,
    converted: Number(m.converted) || 0,
  }));

// By branch ([{ branch_id, name, code, leads, converted, conversion_amount }], code = "CHA-001 ·
// Bangalore"): leads open the list for that branch; the "No branch" row has no link
export const branchRows = (byBranch, period) =>
  (Array.isArray(byBranch) ? byBranch : []).map((b) => ({
    key: b.branch_id ?? "none",
    name: b.name || "No branch",
    code: b.code || null,
    leads: Number(b.leads) || 0,
    converted: Number(b.converted) || 0,
    conversionAmount: b.conversion_amount ?? null,
    to: b.branch_id != null && b.leads ? kocToDhruvaListLink({ branch: String(b.branch_id) }, period) : null,
  }));

// The dashboard's KPI cards; each opens the list where an exact filter exists (with the period).
// Follow-ups due covers every open lead (not only the period).
export function dashboardKpiCards(kpis, period) {
  const k = kpis ?? {};
  const link = (filters) => kocToDhruvaListLink(filters, period);
  const { value: aov } = aovOf(k);
  const shared = k.shared ?? k.total;
  return [
    { key: "shared", label: "Leads shared", value: num(shared), to: link({}) },
    { key: "pending", label: "Not contacted yet", value: num(k.pending), to: link({ update_status: [PENDING] }) },
    { key: "interested", label: "Interested", value: num(k.interested), to: link({ update_status: ["interested"] }) },
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
    { key: "follow_ups_due", label: "Follow-ups due", value: num(k.follow_ups_due), to: kocToDhruvaListLink({ follow_up: "due" }) },
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
