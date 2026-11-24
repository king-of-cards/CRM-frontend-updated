import { apiRequest } from "./client.js";

// CRM details on a lead (stored in our own database next to the lead: the "sidecar").
// source: "spin" | "whatsapp" | "wedding" | "wedding_planner"; leadKey: the row's crm.lead_key

// Update (crm.update_status): the same 7 values and labels as Vendors → KOC; null = Pending.
// Shown in the Update dropdowns in this order. (docs/API_REFERENCE.md, "Access: who sees and edits what")
export const UPDATE_OPTIONS = [
  { value: "converted", label: "Converted", style: "bg-emerald-500 text-white ring-emerald-500" },
  { value: "not_converted", label: "Not converted", style: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "purchased_elsewhere", label: "Already purchased somewhere else", style: "bg-orange-50 text-orange-700 ring-orange-200" },
  { value: "purchased_with_us", label: "Already purchased with us", style: "bg-brand-50 text-brand-800 ring-brand-200" },
  { value: "will_call_back", label: "Will call back", style: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "interested", label: "Interested", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "not_interested", label: "Not interested", style: "bg-gray-100 text-gray-700 ring-gray-200" },
];
export const PENDING_UPDATE = { value: "", label: "Pending", style: "bg-white text-gray-500 ring-gray-200" };

// The option for a stored value (null / "" / "pending" = Pending)
export const updateInfo = (value) =>
  !value || value === "pending" ? PENDING_UPDATE : (UPDATE_OPTIONS.find((o) => o.value === value) ?? PENDING_UPDATE);

// PUT /api/v1/leads/{source}/{leadKey}/crm   (send only what changes)
// changes: any of { vendor_id (admins; null = automatic), update_status (null = Pending),
//   quoted_date, quoted_amount, conversion_amount (rupees, 0–10,00,00,000), notes }
// context: { location, pincode, sheet_vendor } so the answer includes the automatic vendor
// vendor (admins, docs section 19): whose copy of a lead with several vendors to change, as
// ?vendor=<id> (0 = the lead's own row). Without it a lead with several vendors answers 422 for
// Update, amounts, quoted date, follow-up and notes. Vendor logins never send it (their own copy).
export function saveLeadCrm(source, leadKey, changes, context = {}, { vendor } = {}) {
  return apiRequest(`/leads/${encodeURIComponent(source)}/${encodeURIComponent(leadKey)}/crm`, {
    method: "PUT",
    query: vendor != null ? { vendor } : undefined,
    body: { ...changes, ...context },
  });
}
