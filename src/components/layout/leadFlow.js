// The Lead flow: KOC → Vendors ("") | Vendors → KOC ("vendors") | Dhruva leads ("dhruva").
// Pure, no React. It comes from the page URL/query string.
// The top bar tabs follow the active flow. The Dhruva flow has two directions:
// Dhruva → KOC ("dhruva", /dhruva-leads) and KOC → Dhruva ("koc_to_dhruva", /koc-to-dhruva);
// on the Dashboard the direction is kept in the URL (?flow=dhruva&direction=koc_to_dhruva).

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
export const DHRUVA_TABS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dhruva-leads", label: "Dhruva → KOC" },
  { path: "/koc-to-dhruva", label: "KOC → Dhruva" },
];

// The Dhruva flow's directions, in the switch's order
export const DHRUVA_DIRECTION = "dhruva";
export const KOC_TO_DHRUVA = "koc_to_dhruva";
export const DHRUVA_DIRECTIONS = [
  { value: DHRUVA_DIRECTION, label: "Dhruva → KOC", path: "/dhruva-leads" },
  { value: KOC_TO_DHRUVA, label: "KOC → Dhruva", path: "/koc-to-dhruva" },
];

// Pages that no longer exist -> where they went. Wedding gifts is part of Spin again (docs
// section 17): old links and bookmarks open Spin leads.
export const RETIRED_PATHS = { "/leads/wedding-gifts": "/leads/spin" };

// Pages that show the Lead flow switch (all lead-flow pages combined, deduplicated)
export const FLOW_PAGES = [
  ...new Set(
    [...KOC_TABS, ...VENDOR_TABS, ...DHRUVA_TABS].map((t) => t.path),
  ),
];

export function flowOf(pathname, search = "") {
  if (pathname === "/dhruva-leads" || pathname === "/koc-to-dhruva") return "dhruva";
  if (pathname === "/vendor-to-koc") return "vendors";
  if (pathname === "/dashboard") {
    const flow = new URLSearchParams(search).get("flow");
    if (flow === "vendors") return "vendors";
    if (flow === "dhruva") return "dhruva";
    return "";
  }
  return "";
}

// The Dhruva direction of a page: the list it is, or the Dashboard's ?direction (default Dhruva → KOC)
export function dhruvaDirectionOf(pathname, search = "") {
  if (pathname === "/koc-to-dhruva") return KOC_TO_DHRUVA;
  if (pathname === "/dhruva-leads") return DHRUVA_DIRECTION;
  return new URLSearchParams(search).get("direction") === KOC_TO_DHRUVA ? KOC_TO_DHRUVA : DHRUVA_DIRECTION;
}

// The Dhruva Dashboard for a direction
export const dhruvaDashboardPath = (direction = DHRUVA_DIRECTION) =>
  direction === KOC_TO_DHRUVA ? `/dashboard?flow=dhruva&direction=${KOC_TO_DHRUVA}` : "/dashboard?flow=dhruva";

// Where the direction switch goes: on the Dashboard the same page with the other direction,
// on a list the other list
export function dhruvaDirectionTarget(pathname, value) {
  if (pathname === "/dashboard") return dhruvaDashboardPath(value);
  return DHRUVA_DIRECTIONS.find((d) => d.value === value)?.path ?? "/dhruva-leads";
}

// Tabs for a flow: { path, to, label }. The Dashboard tab keeps the active flow (and the
// Dhruva direction).
export function tabsFor(flow, direction = DHRUVA_DIRECTION) {
  const tabs =
    flow === "vendors" ? VENDOR_TABS : flow === "dhruva" ? DHRUVA_TABS : KOC_TABS;
  return tabs.map((t) => ({
    ...t,
    to:
      t.path === "/dashboard" && flow
        ? flow === "dhruva"
          ? dhruvaDashboardPath(direction)
          : `/dashboard?flow=${flow}`
        : t.path,
  }));
}
