import { ApiError, apiRequest, getAccessToken, refreshAccessToken } from "./client.js";
import { exportQuery, filenameFromDisposition, parseCsvHeader } from "../components/crmLeads/crmLeadUtils.js";
import { toQueryString } from "../components/leads/leadFilters.js";

// Leads added or imported in the CRM, for all four sources. Admin only, except export
// (vendor logins export their own leads).
// source: "spin" | "whatsapp" | "wedding" | "wedding_planner". See docs/API_REFERENCE.md.
//
// JSON calls go through apiRequest. File uploads (multipart) and file downloads (blobs) use
// fetch here with the same token and the same one-time refresh on 401.

const API_BASE = import.meta.env?.VITE_API_URL ?? "/api/v1";
const base = (source) => `/crm-leads/${encodeURIComponent(source)}`;

// Arrays repeat the key (interest=a&interest=b), as the list filters expect
function url(path, query) {
  const qs = toQueryString(query);
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function rawFetch(path, { method = "GET", query, body } = {}) {
  if (!getAccessToken()) await refreshAccessToken();
  const send = () => {
    const token = getAccessToken();
    return fetch(url(path, query), {
      method,
      body,
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
  let res;
  try {
    res = await send();
    if (res.status === 401 && (await refreshAccessToken())) res = await send();
  } catch {
    throw new ApiError(0, null);
  }
  if (!res.ok) {
    let detail = null;
    try {
      const type = res.headers.get("content-type") || "";
      detail = type.includes("application/json") ? (await res.json()).detail : await res.text();
    } catch {
      // no readable body
    }
    throw new ApiError(res.status, detail);
  }
  return res;
}

// Save a file response with the name from Content-Disposition
async function saveFile(res, fallback) {
  const name = filenameFromDisposition(res.headers.get("content-disposition"), fallback);
  const href = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return name;
}

// GET fields -> { source, label, fields: [{ key, label, type, required, max_length, help }], branches? }
export function getCrmLeadFields(source) {
  return apiRequest(`${base(source)}/fields`);
}

// GET template (xlsx | csv): downloads the file, returns its name
export async function downloadCrmLeadTemplate(source, format = "xlsx") {
  const res = await rawFetch(`${base(source)}/template`, { query: { format } });
  return saveFile(res, `${source}-leads-template.${format}`);
}

// The CSV template's header row = the list screen's columns (used for the upload preview)
export async function getCrmLeadTemplateHeaders(source) {
  const res = await rawFetch(`${base(source)}/template`, { query: { format: "csv" } });
  return parseCsvHeader(await res.text());
}

// POST import/preview (multipart). Nothing is saved.
// sheetName: Excel only; omitted for CSV.
export async function previewCrmLeadImport(source, file, sheetName) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (sheetName) form.append("sheet_name", sheetName);
  const res = await rawFetch(`${base(source)}/import/preview`, { method: "POST", body: form });
  return res.json();
}

// POST import: rows [{ row, values }] -> { rows, counts (with imported, skipped) }
export function importCrmLeads(source, rows) {
  return apiRequest(`${base(source)}/import`, { method: "POST", body: { rows } });
}

// GET export with the list page's current params; downloads the file, returns its name
export async function exportCrmLeads(source, format, params) {
  const res = await rawFetch(`${base(source)}/export`, { query: exportQuery(source, params, format) });
  return saveFile(res, `${source}-leads.${format}`);
}

// POST add. 409 when the phone exists (ApiError.detail = { message, duplicate, warnings })
export function addCrmLead(source, values, allowDuplicate = false) {
  return apiRequest(base(source), { method: "POST", body: { values, allow_duplicate: allowDuplicate } });
}

export function getCrmLead(source, leadKey) {
  return apiRequest(`${base(source)}/${encodeURIComponent(leadKey)}`);
}

// PATCH: only the fields to change (null clears one)
export function editCrmLead(source, leadKey, values) {
  return apiRequest(`${base(source)}/${encodeURIComponent(leadKey)}`, { method: "PATCH", body: { values } });
}

export function archiveCrmLead(source, leadKey) {
  return apiRequest(`${base(source)}/${encodeURIComponent(leadKey)}/archive`, { method: "POST" });
}

export function unarchiveCrmLead(source, leadKey) {
  return apiRequest(`${base(source)}/${encodeURIComponent(leadKey)}/unarchive`, { method: "POST" });
}
