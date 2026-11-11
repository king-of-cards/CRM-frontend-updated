import { apiRequest } from "./client.js";

// GET /api/v1/spin-leads   (admin only, read-only PostgreSQL table)
// Returns { columns: [{ name, type, json_field?, source?, key? }], items: [...], total, page, page_size }
// sort: any column name from `columns` (e.g. "created_at" or "additional_details.serviceBudget")
export function listSpinLeads({ page = 1, pageSize = 50, search, sort, order = "asc" } = {}) {
  return apiRequest("/spin-leads", {
    query: { page, page_size: pageSize, search, sort, order: sort ? order : undefined },
  });
}