// What each lead tab shows first, shared by the tabs and the dashboard's prefetch,
// so a prefetched answer is exactly the one the tab looks for.
import { listSheetSources } from "./sheets.js";
import { getWeddingLeadStats, listWeddingLeads } from "./weddingLeads.js";
import { getWeddingPlanStats, listWeddingPlans } from "./weddingPlans.js";
import { getWhatsAppLeadStats, listWhatsAppLeads } from "./whatsappLeads.js";

export const TAB_DEFAULTS = {
  whatsapp: { page: 1, pageSize: 8, sort: "submitted_at", order: "desc" },
  wedding: { page: 1, pageSize: 8, sort: "submitted_at", order: "desc" },
  planner: { page: 1, pageSize: 8, sort: "updated", order: "desc" },
};

let done = false;

// Load the first page of every lead tab in the background (once per page load),
// so switching tabs shows data instantly.
export function prefetchTabs() {
  if (done) return;
  done = true;
  const run = () =>
    Promise.allSettled([
      listWhatsAppLeads(TAB_DEFAULTS.whatsapp),
      getWhatsAppLeadStats(),
      listWeddingLeads(TAB_DEFAULTS.wedding),
      getWeddingLeadStats(),
      listWeddingPlans(TAB_DEFAULTS.planner),
      getWeddingPlanStats(),
      listSheetSources(),
    ]);
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 300);
}