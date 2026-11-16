// The Lead flow: KOC → Vendors ("") or Vendors → KOC ("vendors"). Pure, no React.
// It comes from the page: /dashboard?flow=vendors and /vendor-to-koc are Vendors → KOC;
// /dashboard (no flow) and the four source pages are KOC → Vendors. The top bar tabs follow it.

export const KOC_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/leads/spin", label: "Spin leads" },
  { path: "/leads/international", label: "International" },
  { path: "/leads/wedding", label: "Wedding" },
  { path: "/leads/wedding-planner", label: "Wedding planner" },
];
export const VENDOR_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/vendor-to-koc", label: "Vendors → KOC" },
];

// Pages that show the Lead flow switch
export const FLOW_PAGES = [...new Set([...KOC_TABS, ...VENDOR_TABS].map((t) => t.path))];

export function flowOf(pathname, search = "") {
  if (pathname === "/vendor-to-koc") return "vendors";
  if (pathname === "/dashboard") return new URLSearchParams(search).get("flow") === "vendors" ? "vendors" : "";
  return "";
}

// Tabs for a flow: { path, to, label }. The Dashboard tab keeps the flow.
export function tabsFor(flow) {
  return (flow === "vendors" ? VENDOR_TABS : KOC_TABS).map((t) => ({
    ...t,
    to: flow === "vendors" && t.path === "/dashboard" ? "/dashboard?flow=vendors" : t.path,
  }));
}
