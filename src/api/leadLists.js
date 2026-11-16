import { apiRequest, peek } from "./client.js";
import { toQueryString } from "../components/leads/leadFilters.js";

// The four lead lists with the filters of docs/API_REFERENCE.md section 10 (repeatable
// parameters such as update_status=…&update_status=…). The query string is built here, in the order
// page, page_size, filters…, sort, order, so with no filters the URL is the same as the
// prefetched first page's (src/api/prefetch.js) and that answer is reused.

const PATHS = {
  spin: "/spin-leads",
  whatsapp: "/whatsapp-leads",
  wedding: "/wedding-leads",
  wedding_planner: "/wedding-plans",
};

const withQuery = (path, query) => {
  const qs = toQueryString(query);
  return qs ? `${path}?${qs}` : path;
};

// The list query in a stable key order. filters: the API query from leadFilters.toApiQuery.
export function listQuery({ page, pageSize, filters = {}, sort, order }) {
  return { page, page_size: pageSize, ...filters, sort, order };
}

export function listLeads(source, query) {
  return apiRequest(withQuery(PATHS[source], query));
}
listLeads.peek = (source, query) => peek(withQuery(PATHS[source], query));

// Stats over the filtered leads (Spin has none: use the list's total)
export function getLeadStats(source, filters) {
  return apiRequest(withQuery(`${PATHS[source]}/stats`, filters));
}
getLeadStats.peek = (source, filters) => peek(withQuery(`${PATHS[source]}/stats`, filters));

// Dropdown values: [{ value, count }] lists, spin branches [{ id, name, count }], vendors [{ id, name }]
export function getFilterOptions(source) {
  return apiRequest(`${PATHS[source]}/filter-options`);
}
getFilterOptions.peek = (source) => peek(`${PATHS[source]}/filter-options`);
