// The Lead flow: KOC → Vendors ("") | Vendors → KOC ("vendors") | Dhruva leads ("dhruva").
// Pure, no React. It comes from the page URL/query string.
// The top bar tabs follow the active flow.

export const KOC_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/leads/spin", label: "Spin leads" },
  { path: "/leads/wedding-gifts", label: "Wedding gifts" },
  { path: "/leads/international", label: "International" },
  { path: "/leads/wedding", label: "Wedding" },
  { path: "/leads/wedding-planner", label: "Wedding planner" },
];
export const VENDOR_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/vendor-to-koc", label: "Vendors → KOC" },
];
export const DHRUVA_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dhruva-leads", label: "Dhruva leads" },
];

// Pages that show the Lead flow switch (all lead-flow pages combined, deduplicated)
export const FLOW_PAGES = [
  ...new Set(
    [...KOC_TABS, ...VENDOR_TABS, ...DHRUVA_TABS].map((t) => t.path),
  ),
];

export function flowOf(pathname, search = "") {
  if (pathname === "/dhruva-leads") return "dhruva";
  if (pathname === "/vendor-to-koc") return "vendors";
  if (pathname === "/dashboard") {
    const flow = new URLSearchParams(search).get("flow");
    if (flow === "vendors") return "vendors";
    if (flow === "dhruva") return "dhruva";
    return "";
  }
  return "";
}

// Tabs for a flow: { path, to, label }. The Dashboard tab keeps the active flow.
export function tabsFor(flow) {
  const tabs =
    flow === "vendors" ? VENDOR_TABS : flow === "dhruva" ? DHRUVA_TABS : KOC_TABS;
  return tabs.map((t) => ({
    ...t,
    to:
      t.path === "/dashboard" && flow
        ? `/dashboard?flow=${flow}`
        : t.path,
  }));
}
