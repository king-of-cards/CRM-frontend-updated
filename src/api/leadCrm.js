import { apiRequest } from "./client.js";

// CRM details on a lead (stored in our own database next to the lead: the "sidecar").
// source: "spin" | "whatsapp" | "wedding" | "wedding_planner"; leadKey: the row's crm.lead_key

// Shown in the Interest dropdown (in this order)
export const INTEREST_OPTIONS = [
  { value: "interested", label: "Interested", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "not_interested", label: "Not interested", style: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "other", label: "Others", style: "bg-sky-50 text-sky-700 ring-sky-200" },
];

// Older value that may still be saved on some leads; shown but not offered
export const LEGACY_INTEREST = {
  follow_up: { value: "follow_up", label: "Follow up", style: "bg-amber-50 text-amber-700 ring-amber-200" },
};

export const interestInfo = (value) => INTEREST_OPTIONS.find((o) => o.value === value) ?? LEGACY_INTEREST[value] ?? null;

// PUT /api/v1/leads/{source}/{leadKey}/crm
// changes: any of { vendor_id (null = automatic), interest, converted, quoted_date, quoted_amount, notes }
// context: { location, pincode, sheet_vendor } so the answer includes the automatic vendor
export function saveLeadCrm(source, leadKey, changes, context = {}) {
  return apiRequest(`/leads/${encodeURIComponent(source)}/${encodeURIComponent(leadKey)}/crm`, {
    method: "PUT",
    body: { ...changes, ...context },
  });
}