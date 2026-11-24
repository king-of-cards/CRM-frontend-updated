import { apiRequest, peek } from "./client.js";
import { rawFetch, saveFile } from "./crmLeads.js";
import { toQueryString } from "../components/leads/leadFilters.js";

// Dhruva leads (docs/API_REFERENCE.md section 13). Admins and Dhruva logins; vendor logins: 403.
// Base path: /api/v1/dhruva

const BASE = "/dhruva";
const withQuery = (path, query) => {
  const qs = toQueryString(query);
  return qs ? `${path}?${qs}` : path;
};

// ── Dashboard: GET /analytics/dhruva (same period rules as the other dashboards) ──
// Default: all time (no dates → API returns all-time data)
const dashboardQuery = ({ period, dateFrom, dateTo, refresh = false } = {}) => ({
  period,
  date_from: dateFrom,
  date_to: dateTo,
  refresh: refresh || undefined,
});
export function getDhruvaDashboard(params) {
  return apiRequest(withQuery("/analytics/dhruva", dashboardQuery(params)));
}
getDhruvaDashboard.peek = (params) =>
  peek(withQuery("/analytics/dhruva", dashboardQuery({ ...params, refresh: false })));

// ── List, stats, export, filter options (one filter definition) ──
export function listDhruvaLeads(query) {
  return apiRequest(withQuery(`${BASE}/leads`, query));
}
listDhruvaLeads.peek = (query) => peek(withQuery(`${BASE}/leads`, query));

export function getDhruvaStats(filters) {
  return apiRequest(withQuery(`${BASE}/leads/stats`, filters));
}
getDhruvaStats.peek = (filters) => peek(withQuery(`${BASE}/leads/stats`, filters));

export function getDhruvaFilterOptions() {
  return apiRequest(`${BASE}/leads/filter-options`);
}
getDhruvaFilterOptions.peek = () => peek(`${BASE}/leads/filter-options`);

export async function exportDhruvaLeads(format, filters) {
  const res = await rawFetch(`${BASE}/leads/export`, { query: { format, ...filters } });
  return saveFile(res, `dhruva_leads.${format}`);
}

export async function downloadDhruvaTemplate(format = "xlsx") {
  const res = await rawFetch(`${BASE}/leads/template`, { query: { format } });
  return saveFile(res, `dhruva_template.${format}`);
}

// ── Upload preview: POST /dhruva/upload/preview (multipart, admins) ──
// Returns { sheet, sheets, heading_row, columns, ignored_columns, rows, counts }
export async function previewDhruvaUpload(file, { sheetName } = {}) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (sheetName) form.append("sheet_name", sheetName);
  const res = await rawFetch(`${BASE}/upload/preview`, { method: "POST", body: form });
  return res.json();
}

// ── Bulk save: POST /dhruva/leads/bulk (admins) ──
// { leads: [{name, phones, event_dates, event_type, venue, whatsapp_status, …}] } (the
// preview rows' values, edited)
// Returns { added, duplicates_skipped, failed, errors: [{index, field, message}], ids }
export function bulkAddDhruvaLeads(leads) {
  return apiRequest(`${BASE}/leads/bulk`, { method: "POST", body: { leads } });
}

// ── Single lead: POST /dhruva/leads ──
// Returns 201 with the lead; 409 { message, duplicate }; 422 [{ field, message }]
export function addDhruvaLead(lead) {
  return apiRequest(`${BASE}/leads`, { method: "POST", body: lead });
}

// ── Get lead: GET /dhruva/leads/{id} (archived ones too) ──
export function getDhruvaLead(id) {
  return apiRequest(`${BASE}/leads/${encodeURIComponent(id)}`);
}

// ── Edit lead: PATCH /dhruva/leads/{id} ──
// Lead fields (admins and Dhruva logins) or KOC fields (admins only). Only fields sent change;
// phones and event_dates are the full new lists ([] clears); sent_at is never sent (422). Returns the lead with activity.
export function updateDhruvaLead(id, changes) {
  return apiRequest(`${BASE}/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
}

// ── Archive / Unarchive: POST /dhruva/leads/{id}/archive and /unarchive (admin only) ──
export function archiveDhruvaLead(id) {
  return apiRequest(`${BASE}/leads/${encodeURIComponent(id)}/archive`, { method: "POST" });
}
export function unarchiveDhruvaLead(id) {
  return apiRequest(`${BASE}/leads/${encodeURIComponent(id)}/unarchive`, { method: "POST" });
}
