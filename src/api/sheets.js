import { apiRequest, peek } from "./client.js";

// Google Sheets, through the backend (admin only). `source` is the short name from
// GOOGLE_SHEETS in the backend .env, e.g. "whatsapp".

// GET /api/v1/sheets/sources -> { sources: [{ source, syncable, latest_sync, last_success }] }
export function listSheetSources() {
  return apiRequest("/sheets/sources");
}
listSheetSources.peek = () => peek("/sheets/sources");

// GET /api/v1/sheets/{source}/worksheets -> { worksheets: [{ id, title, rows, cols }] }
export function listWorksheets(source) {
  return apiRequest(`/sheets/${encodeURIComponent(source)}/worksheets`);
}

// GET /api/v1/sheets/{source}/data: live rows straight from Google (slower; for previews)
export function getSheetData(source, { worksheet, page = 1, pageSize = 50, search, refresh = false } = {}) {
  return apiRequest(`/sheets/${encodeURIComponent(source)}/data`, {
    query: { worksheet, page, page_size: pageSize, search, refresh: refresh || undefined },
  });
}

// POST /api/v1/sheets/{source}/sync: copy the sheet into the database now
// -> { status, inserted, updated, unchanged, removed, finished_at, ... }  (409 if a sync is running)
export function syncSheet(source) {
  return apiRequest(`/sheets/${encodeURIComponent(source)}/sync`, { method: "POST" });
}