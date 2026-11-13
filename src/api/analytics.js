import { apiRequest, peek } from "./client.js";

// GET /api/v1/analytics/overview (admin only, cached 60 s on the server)
// -> { totals, this_week, last_week, trend: [{ date, spin, whatsapp, wedding, wedding_planner }],
//      upcoming_by_month: [{ month, ... }], upcoming_30_days, top_cities, top_countries, occasions,
//      partners, sharing, photography_budget, wedding_budget, guests, budget_fit, repeats, spin_available }
export function getAnalyticsOverview({ refresh = false } = {}) {
  return apiRequest("/analytics/overview", { query: { refresh: refresh || undefined } });
}
getAnalyticsOverview.peek = () => peek("/analytics/overview", { refresh: undefined });