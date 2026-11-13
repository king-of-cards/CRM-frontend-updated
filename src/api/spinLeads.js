import { apiRequest, peek } from "./client.js";

// GET /api/v1/spin-leads   (admin only, read-only PostgreSQL table)
// Returns { columns: [{ name, type, json_field?, source?, key? }], items: [...], total, page, page_size }
// sort: any column name from `columns` (e.g. "created_at" or "additional_details.serviceBudget")
// Filters (all optional):
//   branch       branch id                      pincode    pincode starts with
//   budget       exact budget value ("10-20")   vendorId   assigned to this vendor
//   interest     interested | not_interested | other | none
//   converted    "yes" | "no"
//   quotedOp     eq | ne | gt | gte | lt | lte | set | unset,  quotedValue: number
const spinQuery = ({
  page = 1,
  pageSize = 50,
  search,
  sort,
  order = "asc",
  branch,
  pincode,
  budget,
  vendorId,
  interest,
  converted,
  quotedOp,
  quotedValue,
} = {}) => ({
  page,
  page_size: pageSize,
  search,
  sort,
  order: sort ? order : undefined,
  branch,
  pincode,
  budget,
  vendor_id: vendorId,
  interest,
  converted,
  quoted_op: quotedOp,
  quoted_value: quotedOp && quotedOp !== "set" && quotedOp !== "unset" ? quotedValue : undefined,
});

export function listSpinLeads(params) {
  return apiRequest("/spin-leads", { query: spinQuery(params) });
}
// Last answer for the same params (instant display), or undefined
listSpinLeads.peek = (params) => peek("/spin-leads", spinQuery(params));

// GET /api/v1/spin-leads/filter-options -> { budgets: [{ value, count }], has_branch, has_pincode, has_budget }
export function getSpinFilterOptions() {
  return apiRequest("/spin-leads/filter-options");
}
getSpinFilterOptions.peek = () => peek("/spin-leads/filter-options");