import { apiRequest, peek } from "./client.js";
import { rawFetch, saveFile } from "./crmLeads.js";
import { parseCsvHeader } from "../components/crmLeads/crmLeadUtils.js";
import { toQueryString } from "../components/leads/leadFilters.js";

// KOC → Dhruva (docs/API_REFERENCE.md section 18): the spin leads KOC shares with Dhruva by rule
// (budget per card ≥ ₹70 or quantity ≥ 1000). Admins, view-only and Dhruva logins; vendors: 403.
// Rows come from the rule and from admin uploads (history before the cut-off); no add or vendor.
// Base path: /api/v1/koc-to-dhruva

const BASE = "/koc-to-dhruva";
const withQuery = (path, query) => {
  const qs = toQueryString(query);
  return qs ? `${path}?${qs}` : path;
};
const leadPath = (leadKey) => `${BASE}/leads/${encodeURIComponent(leadKey)}`;

// ── Dashboard: GET /analytics/koc-to-dhruva (shared period rules, all time by default) ──
const dashboardQuery = ({ period, dateFrom, dateTo, refresh = false } = {}) => ({
  period,
  date_from: dateFrom,
  date_to: dateTo,
  refresh: refresh || undefined,
});
export function getKocToDhruvaDashboard(params) {
  return apiRequest(withQuery("/analytics/koc-to-dhruva", dashboardQuery(params)));
}
getKocToDhruvaDashboard.peek = (params) =>
  peek(withQuery("/analytics/koc-to-dhruva", dashboardQuery({ ...params, refresh: false })));

// ── List, stats, filter options, export (the same filters everywhere) ──
export function listKocToDhruvaLeads(query) {
  return apiRequest(withQuery(`${BASE}/leads`, query));
}
listKocToDhruvaLeads.peek = (query) => peek(withQuery(`${BASE}/leads`, query));

// -> { total, kpis }
export function getKocToDhruvaStats(filters) {
  return apiRequest(withQuery(`${BASE}/leads/stats`, filters));
}
getKocToDhruvaStats.peek = (filters) => peek(withQuery(`${BASE}/leads/stats`, filters));

// -> budgets, pincodes, branches, origins, updates, occasions, quantity_range
export function getKocToDhruvaFilterOptions() {
  return apiRequest(`${BASE}/leads/filter-options`);
}
getKocToDhruvaFilterOptions.peek = () => peek(`${BASE}/leads/filter-options`);

export async function exportKocToDhruvaLeads(format, filters) {
  const res = await rawFetch(`${BASE}/leads/export`, { query: { format, ...filters } });
  return saveFile(res, `koc_to_dhruva_leads.${format}`);
}

// ── One lead (404 when it no longer matches the rule) ──
export function getKocToDhruvaLead(leadKey) {
  return apiRequest(leadPath(leadKey));
}

// ── CRM details: PUT …/crm, only what changes (null clears). Fields: update_status, notes,
// quoted_amount, quoted_date, conversion_amount, follow_up_date. Anything else: 422.
export function getKocToDhruvaCrm(leadKey) {
  return apiRequest(`${leadPath(leadKey)}/crm`);
}
export function saveKocToDhruvaCrm(leadKey, changes) {
  return apiRequest(`${leadPath(leadKey)}/crm`, { method: "PUT", body: changes });
}

// ── Upload (admins only; docs section 18 "Upload"): template → preview → import ──
// The same answers as the /crm-leads/{source} upload, plus each row's spin {action: matched |
// not_in_spin, leads} and also_in, and counts spin_matched / spin_not_in_spin. Never creates or
// changes a Spin lead.
export async function downloadKocToDhruvaTemplate(format = "xlsx") {
  const res = await rawFetch(`${BASE}/leads/template`, { query: { format } });
  return saveFile(res, `koc_to_dhruva_template.${format}`);
}

// The CSV template's header row (the preview's column order)
export async function getKocToDhruvaTemplateHeaders() {
  const res = await rawFetch(`${BASE}/leads/template`, { query: { format: "csv" } });
  return parseCsvHeader(await res.text());
}

// POST import/preview (multipart: file, sheet_name for Excel). Saves nothing.
export async function previewKocToDhruvaImport(file, sheetName) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (sheetName) form.append("sheet_name", sheetName);
  const res = await rawFetch(`${BASE}/leads/import/preview`, { method: "POST", body: form });
  return res.json();
}

// POST import: rows [{ row, values }] (≤ 5,000) -> { rows, counts (imported, skipped, spin_…) }
export function importKocToDhruvaLeads(rows) {
  return apiRequest(`${BASE}/leads/import`, { method: "POST", body: { rows } });
}
