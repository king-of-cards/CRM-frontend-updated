import { ApiError, apiRequest, refreshAccessToken } from "./client.js";

// Saving what the team does with a lead: status, details, quotations (with files), notes.
// Every change returns the lead's full saved activity.

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";
const lead = (id) => `/leads/${encodeURIComponent(id)}`;

// Fired after any quotation change, so the "Quotations sent" KPI can refresh itself.
export const QUOTATIONS_CHANGED = "crm:quotations-changed";

// File uploads and downloads can't go through apiRequest (it only sends and reads JSON).
// They get a fresh access token from the refresh cookie, the same way apiRequest does after a 401.
async function fileRequest(path, init = {}) {
  const token = await refreshAccessToken();
  if (!token) throw new ApiError(401, "Your session has expired. Sign in again.");

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, null);
  }
  if (!res.ok) {
    let detail = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }
  return res;
}

// ── Reading ──
export const getLeadSummary = () => apiRequest("/leads/summary");
export const getQuotationStats = () => apiRequest("/leads/quotations/stats");
export const getLeadActivity = (id) => apiRequest(`${lead(id)}/activity`);

// ── Status and details ──  e.g. updateLead(id, { status: "contacted" })
export const updateLead = (id, changes) => apiRequest(lead(id), { method: "PATCH", body: changes });

// ── Quotations ──
export const addQuotation = (id, amount) =>
  apiRequest(`${lead(id)}/quotations`, { method: "POST", body: { amount } });
export const editQuotation = (id, quotationId, amount) =>
  apiRequest(`${lead(id)}/quotations/${quotationId}`, { method: "PATCH", body: { amount } });
export const deleteQuotation = (id, quotationId) =>
  apiRequest(`${lead(id)}/quotations/${quotationId}`, { method: "DELETE" });

// ── Quotation files ──
export async function uploadQuotationDocument(id, quotationId, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fileRequest(`${lead(id)}/quotations/${quotationId}/document`, { method: "PUT", body: form });
  return res.json();
}

export const deleteQuotationDocument = (id, quotationId) =>
  apiRequest(`${lead(id)}/quotations/${quotationId}/document`, { method: "DELETE" });

// Returns the file as a Blob, for the preview window
export async function fetchQuotationDocument(id, quotationId) {
  const res = await fileRequest(`${lead(id)}/quotations/${quotationId}/document`);
  return res.blob();
}

// ── Notes ──
export const addNote = (id, text) => apiRequest(`${lead(id)}/notes`, { method: "POST", body: { text } });
export const editNote = (id, noteId, text) =>
  apiRequest(`${lead(id)}/notes/${noteId}`, { method: "PATCH", body: { text } });
export const deleteNote = (id, noteId) => apiRequest(`${lead(id)}/notes/${noteId}`, { method: "DELETE" });