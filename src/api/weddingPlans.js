import { apiRequest, peek } from "./client.js";

// Wedding plans from the "Wedding planner" Google Sheet, copied into the database (admin only).

// GET /api/v1/wedding-plans
// -> { items: [{ id, plan_id, name, phone, phone_display, email, role, city, wedding_month, first_day,
//                wedding_date, total_guests, guests_staying, traditions, events: [...], food, alcohol,
//                budget_range, total_budget, plan_estimate, fits_budget, priorities: [...],
//                shared_with, last_step, versions, updated_at, ... }], total, page, page_size }
// sharedWith: a partner name, or "__none__" for not shared yet. fitsBudget: true | false | undefined
// sort: "updated" | "wedding_date" | "total_budget" | "total_guests" | "plan_estimate" | "name"
const listQuery = ({
  page = 1,
  pageSize = 10,
  search,
  sharedWith,
  fitsBudget,
  lastStep,
  sort = "updated",
  order = "desc",
} = {}) => ({
  page,
  page_size: pageSize,
  search,
  shared_with: sharedWith,
  fits_budget: fitsBudget,
  last_step: lastStep,
  sort,
  order,
});

export function listWeddingPlans(params) {
  return apiRequest("/wedding-plans", { query: listQuery(params) });
}
listWeddingPlans.peek = (params) => peek("/wedding-plans", listQuery(params));

// GET /api/v1/wedding-plans/stats
// -> { total, last_7_days, upcoming_weddings, not_shared, over_budget, total_budget,
//      shared_with: [{ value, count }], last_steps: [{ value, count }] }
export function getWeddingPlanStats() {
  return apiRequest("/wedding-plans/stats");
}
getWeddingPlanStats.peek = () => peek("/wedding-plans/stats");