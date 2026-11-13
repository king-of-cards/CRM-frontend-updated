import { apiRequest, peek } from "./client.js";

// Vendors (partners leads are assigned to), admin only.

// GET /api/v1/vendors -> [{ id, name, coverage, areas, pincodes, pincode_prefixes, is_fallback, priority, contact_name, phone, email, notes, is_active }]
export function listVendors({ includeInactive = false } = {}) {
  return apiRequest("/vendors", { query: { include_inactive: includeInactive || undefined } });
}
listVendors.peek = ({ includeInactive = false } = {}) => peek("/vendors", { include_inactive: includeInactive || undefined });

// POST /api/v1/vendors (409 if the name exists)
export function createVendor(vendor) {
  return apiRequest("/vendors", { method: "POST", body: vendor });
}

// PATCH /api/v1/vendors/{id}: only the fields you send change
export function updateVendor(id, changes) {
  return apiRequest(`/vendors/${id}`, { method: "PATCH", body: changes });
}

// GET /api/v1/vendors/stats -> { vendors: [{ vendor, leads, interested, follow_up, not_interested,
//   quoted, quoted_value, converted, converted_value, conversion_rate, by_source }], unassigned }
export function getVendorStats() {
  return apiRequest("/vendors/stats");
}
getVendorStats.peek = () => peek("/vendors/stats");