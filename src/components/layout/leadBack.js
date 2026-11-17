export const isLeadRoute = (pathname) =>
  pathname === "/vendor-to-koc" || pathname === "/dhruva-leads" || pathname.startsWith("/leads/");

export function leadDashboardFallback(pathname) {
  if (pathname === "/dhruva-leads") return "/dashboard?flow=dhruva";
  if (pathname === "/vendor-to-koc") return "/dashboard?flow=vendors";
  return "/dashboard";
}

export const backTarget = (historyIndex, fallback) => historyIndex > 0 ? -1 : fallback;
