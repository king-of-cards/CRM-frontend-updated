import { apiRequest, peek } from "./client.js";
import { rawFetch, saveFile } from "./crmLeads.js";
import { toQueryString } from "../components/leads/leadFilters.js";

// Vendors → KOC (docs/API_REFERENCE.md section 11). Admins and vendor logins; a vendor login
// only ever gets its own vendor's leads, and the admin fields are left out for it.
// Repeatable filters (vendor_id, update_status, source) repeat the key.

const BASE = "/vendor-to-koc";
const withQuery = (path, query) => {
  const qs = toQueryString(query);
  return qs ? `${path}?${qs}` : path;
};

// ── Dashboard: GET /analytics/vendor-to-koc (same period rules as the overview) ──
const dashboardQuery = ({ period, dateFrom, dateTo, refresh = false } = {}) => ({
  period,
  date_from: dateFrom,
  date_to: dateTo,
  refresh: refresh || undefined,
});
export function getKocDashboard(params) {
  return apiRequest(withQuery("/analytics/vendor-to-koc", dashboardQuery(params)));
}
getKocDashboard.peek = (params) =>
  peek(withQuery("/analytics/vendor-to-koc", dashboardQuery({ ...params, refresh: false })));

// ── List, stats, export (one filter definition) ──
// query: page, page_size, filters…, sort, order
export function listKocLeads(query) {
  return apiRequest(withQuery(`${BASE}/leads`, query));
}
listKocLeads.peek = (query) => peek(withQuery(`${BASE}/leads`, query));

export function getKocStats(filters) {
  return apiRequest(withQuery(`${BASE}/leads/stats`, filters));
}
getKocStats.peek = (filters) => peek(withQuery(`${BASE}/leads/stats`, filters));

export async function exportKocLeads(format, filters) {
  const res = await rawFetch(`${BASE}/leads/export`, { query: { format, ...filters } });
  return saveFile(res, `vendor_to_koc_leads.${format}`);
}

export async function downloadKocTemplate(format = "xlsx") {
  const res = await rawFetch(`${BASE}/leads/template`, { query: { format } });
  return saveFile(res, `vendor_to_koc_template.${format}`);
}

// ── Vendors (admin): [{ id, name, is_active, lead_count }] ──
export function listKocVendors() {
  return apiRequest(`${BASE}/vendors`);
}
listKocVendors.peek = () => peek(`${BASE}/vendors`);

// ── Adding leads ──
// POST /upload/preview (multipart): saves nothing. vendorId: admins only.
export async function previewKocUpload(file, { sheetName, vendorId } = {}) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (sheetName) form.append("sheet_name", sheetName);
  if (vendorId) form.append("vendor_id", String(vendorId));
  const res = await rawFetch(`${BASE}/upload/preview`, { method: "POST", body: form });
  return res.json();
}

// POST /leads/bulk: { added, duplicates_skipped, failed, errors: [{ index, field, message }] }
export function bulkAddKocLeads(leads, vendorId) {
  return apiRequest(`${BASE}/leads/bulk`, {
    method: "POST",
    body: { leads, ...(vendorId ? { vendor_id: Number(vendorId) } : {}) },
  });
}

// POST /leads: one lead { name, date (YYYY-MM-DD), phone, city, vendor_id (admins) }
export function addKocLead(lead) {
  return apiRequest(`${BASE}/leads`, { method: "POST", body: lead });
}

// PATCH /leads/{id} (admin): any of update_status, additional_comments, follow_up_date
export function updateKocLead(id, changes) {
  return apiRequest(`${BASE}/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
}
