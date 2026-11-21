import { apiRequest, peek } from "./client.js";

// Vendors (partners leads are assigned to), admin only.

// GET /api/v1/vendors -> [{ id, name, coverage, areas, pincodes, pincode_prefixes, is_fallback, priority, contact_name, phone, email, notes, is_active, lead_count }]
// Admins get every vendor, active and inactive (docs section 10): only active ones may be chosen
// for a manual assignment (crmAccess.js assignableVendors); an inactive vendor_id answers 422.
export function listVendors({ includeInactive = false } = {}) {
  return apiRequest("/vendors", { query: { include_inactive: includeInactive || undefined } });
}
listVendors.peek = ({ includeInactive = false } = {}) => peek("/vendors", { include_inactive: includeInactive || undefined });
