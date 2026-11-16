import { apiRequest, peek } from "./client.js";

// Vendors (partners leads are assigned to), admin only.

// GET /api/v1/vendors -> [{ id, name, coverage, areas, pincodes, pincode_prefixes, is_fallback, priority, contact_name, phone, email, notes, is_active }]
export function listVendors({ includeInactive = false } = {}) {
  return apiRequest("/vendors", { query: { include_inactive: includeInactive || undefined } });
}
listVendors.peek = ({ includeInactive = false } = {}) => peek("/vendors", { include_inactive: includeInactive || undefined });
