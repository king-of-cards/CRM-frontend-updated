// The code behind each page, loaded on demand (App.jsx wraps these in React.lazy).
// preloadRoute(path) starts the download early, e.g. when a menu link is hovered or focused,
// so the page opens without waiting for its code. Each file downloads once (the browser and
// the bundler share the same import).

export const pageLoaders = {
  dashboard: () => import("./pages/Dashboard.jsx"),
  leadSource: () => import("./pages/LeadSourcePage.jsx"),
  leads: () => import("./pages/Leads.jsx"),
  settings: () => import("./pages/Settings.jsx"),
  users: () => import("./pages/Users.jsx"),
  branches: () => import("./pages/Branches.jsx"),
  recentLeads: () => import("./components/dashboard/RecentLeads.jsx"),
  weddingLeads: () => import("./components/dashboard/WeddingLeads.jsx"),
  weddingPlans: () => import("./components/dashboard/WeddingPlans.jsx"),
  whatsAppLeads: () => import("./components/dashboard/WhatsAppLeads.jsx"),
  vendorToKocLeads: () => import("./components/vendorToKoc/VendorToKocLeads.jsx"),
  dhruvaLeads: () => import("./pages/DhruvaLeads.jsx"),
  kocToDhruvaLeads: () => import("./pages/KocToDhruvaLeads.jsx"),
};

// Path → the pages it needs (a lead source tab is the source frame plus its list)
const ROUTES = {
  "/dashboard": ["dashboard"],
  "/leads": ["leads"],
  "/settings": ["settings"],
  "/users": ["users"],
  "/vendors": ["users"],
  "/branches": ["branches"],
  "/leads/spin": ["leadSource", "recentLeads"],
  "/leads/international": ["leadSource", "whatsAppLeads"],
  "/leads/wedding": ["leadSource", "weddingLeads"],
  "/leads/wedding-planner": ["leadSource", "weddingPlans"],
  "/vendor-to-koc": ["leadSource", "vendorToKocLeads"],
  "/dhruva-leads": ["dhruvaLeads"],
  "/koc-to-dhruva": ["kocToDhruvaLeads"],
};

// The pages a link needs ("/users?x=1" → ["users"]); [] for unknown paths
export function pagesFor(to) {
  const path = String(to ?? "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return ROUTES[path] ?? [];
}

export function preloadRoute(to) {
  for (const key of pagesFor(to)) pageLoaders[key]().catch(() => {}); // a failed preload retries on open
}
