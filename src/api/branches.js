import { apiRequest, peek } from "./client.js";

// Branches (stores) of spin leads, admin only. A branch's id is the id the spin wheel
// stores on each lead.

// GET /api/v1/branches -> { branches: [{ id, name, code, city, vendor: { id, name } | null,
//   is_active, source, spin_leads, ... }], unknown_branch_ids: ["13", ...] }
export function listBranches() {
  return apiRequest("/branches");
}
listBranches.peek = () => peek("/branches");

// POST /api/v1/branches  { id? (spin branch id), name, code, city, vendor_id, ... }  (409 if the id exists)
export function createBranch(branch) {
  return apiRequest("/branches", { method: "POST", body: branch });
}

// PATCH /api/v1/branches/{id}: only the fields you send change
export function updateBranch(id, changes) {
  return apiRequest(`/branches/${id}`, { method: "PATCH", body: changes });
}

// POST /api/v1/branches/import: add new stores from the workflow database -> { added }
export function importBranches() {
  return apiRequest("/branches/import", { method: "POST" });
}