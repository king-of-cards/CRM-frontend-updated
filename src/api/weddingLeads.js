import { apiRequest, peek } from "./client.js";

// Wedding & event photography leads, copied from the "Wedding" Google Sheet into the database (admin only).

// GET /api/v1/wedding-leads
// -> { items: [{ id, name, email, phone, phone_display, city, occasion, event_date, event_date_text,
//                budget_amount, budget_text, shared_with, is_repeat, submitted_at }], total, page, page_size }
// sharedWith: a partner name, or "__none__" for leads not shared yet
// sort: "submitted_at" | "event_date" | "budget_amount" | "name" | "city"
const listQuery = ({
  page = 1,
  pageSize = 10,
  search,
  occasion,
  sharedWith,
  hideRepeats = false,
  sort = "submitted_at",
  order = "desc",
} = {}) => ({
  page,
  page_size: pageSize,
  search,
  occasion,
  shared_with: sharedWith,
  hide_repeats: hideRepeats || undefined,
  sort,
  order,
});

export function listWeddingLeads(params) {
  return apiRequest("/wedding-leads", { query: listQuery(params) });
}
listWeddingLeads.peek = (params) => peek("/wedding-leads", listQuery(params));

// GET /api/v1/wedding-leads/stats
// -> { total, last_7_days, upcoming_events, not_shared, repeats,
//      occasions: [{ value, count }], shared_with: [{ value, count }] }
export function getWeddingLeadStats() {
  return apiRequest("/wedding-leads/stats");
}
getWeddingLeadStats.peek = () => peek("/wedding-leads/stats");