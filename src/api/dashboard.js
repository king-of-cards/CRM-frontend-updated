import { apiRequest, peek } from "./client.js";

// The Dashboard's period-aware requests (docs/API_REFERENCE.md, "9. Dashboard: date filter").
// Admins and vendor logins (vendors only get their own leads). The list pages keep their own
// wrappers in src/api/*Leads.js, which don't send a period.

// GET /api/v1/analytics/overview?date_from&date_to (or period=all)[&refresh=true]
// -> { period, totals, new_in_period, previous_period, change_pct, source_mix, trend,
//      needs_attention, not_filtered, upcoming_30_days, upcoming_by_month, … }
const overviewQuery = ({ period, dateFrom, dateTo, refresh = false } = {}) => ({
  period,
  date_from: dateFrom,
  date_to: dateTo,
  refresh: refresh || undefined,
});
export function getDashboardOverview(params) {
  return apiRequest("/analytics/overview", { query: overviewQuery(params) });
}
getDashboardOverview.peek = (params) => peek("/analytics/overview", overviewQuery({ ...params, refresh: false }));

// "Latest leads": the newest 6 of a list, arrived in the period
const LATEST = {
  whatsapp: { path: "/whatsapp-leads", sort: "submitted_at" },
  wedding: { path: "/wedding-leads", sort: "submitted_at" },
  wedding_planner: { path: "/wedding-plans", sort: "updated" },
};
const latestQuery = (source, { dateFrom, dateTo } = {}) => ({
  page: 1,
  page_size: 6,
  sort: LATEST[source].sort,
  order: "desc",
  date_from: dateFrom,
  date_to: dateTo,
});
export function listLatest(source, params) {
  return apiRequest(LATEST[source].path, { query: latestQuery(source, params) });
}
listLatest.peek = (source, params) => peek(LATEST[source].path, latestQuery(source, params));
