// Role permissions (docs/API_REFERENCE.md sections 12, 13 and 16). Pure, no React: the one place
// that decides who sees and who changes what. AuthProvider exposes these as flags.
//
//   admin   sees everything, changes everything, manages Team / Settings / Branches
//   viewer  "View only": sees what an admin sees, changes nothing, no Team / Settings / Branches
//   vendor  their vendor's leads (CRM details, hot, Vendors → KOC add)
//   dhruva  the Dhruva section only (both directions: Dhruva → KOC and KOC → Dhruva)

export const ROLES = ["admin", "vendor", "dhruva", "viewer"];
export const ROLE_LABELS = { admin: "Admin", vendor: "Vendor", dhruva: "Dhruva", viewer: "View only" };
export const roleLabel = (role) => ROLE_LABELS[role] ?? (role ? String(role) : "");

// The API's answer to any write by a view-only login
export const VIEW_ONLY_MESSAGE = "View-only logins cannot change data.";
export const VIEW_ONLY_EVENT = "crm:view-only";

const roleOf = (user) => user?.role ?? null;

export const isViewer = (user) => roleOf(user) === "viewer";

// May this login change data at all? (Which fields still depends on the role.)
export const canEdit = (user) => Boolean(user) && !isViewer(user);

// Sees admin data: admin columns, filters, fields and dashboard cards (admins and viewers)
export const seesAdminData = (user) => ["admin", "viewer"].includes(roleOf(user));

// Team, Settings and Branches: admins only
export const canManage = (user) => roleOf(user) === "admin";

// Pages a view-only login can't open: sent to the dashboard
export const VIEWER_BLOCKED_PATHS = ["/users", "/settings", "/branches"];

// The KOC → Vendors sources and their list pages, in /auth/me's order
export const KOC_SOURCES = ["spin", "whatsapp", "wedding", "wedding_planner"];
export const SOURCE_PAGE = {
  spin: "/leads/spin",
  whatsapp: "/leads/international",
  wedding: "/leads/wedding",
  wedding_planner: "/leads/wedding-planner",
};

// The KOC → Vendors sources this login sees (docs section 12, /auth/me "sources"): vendor logins
// only theirs; admins and view-only logins all four (also when an older API sends no list)
export function visibleSources(user) {
  if (roleOf(user) !== "vendor" || !Array.isArray(user?.sources)) return KOC_SOURCES;
  return KOC_SOURCES.filter((s) => user.sources.includes(s));
}

// The Dhruva flow's lists (Dhruva → KOC, KOC → Dhruva): never for vendor logins
export const DHRUVA_PATHS = ["/dhruva-leads", "/koc-to-dhruva"];

// May this login use the Dhruva flow at all? (Vendors never: no switch option, tabs or pages.)
export const canSeeDhruva = (user) => Boolean(user) && roleOf(user) !== "vendor";

// Where to send this login instead of `pathname`, or null when it may open it
export function redirectFor(user, pathname) {
  if (!user) return "/login";
  if (roleOf(user) === "dhruva" && !["/dashboard", ...DHRUVA_PATHS].includes(pathname)) return "/dashboard?flow=dhruva";
  if (roleOf(user) === "vendor" && DHRUVA_PATHS.includes(pathname)) return "/dashboard";
  // Vendor logins: another source's list goes to their dashboard
  if (roleOf(user) === "vendor") {
    const source = Object.keys(SOURCE_PAGE).find((s) => SOURCE_PAGE[s] === pathname);
    if (source && !visibleSources(user).includes(source)) return "/dashboard";
  }
  if (isViewer(user) && VIEWER_BLOCKED_PATHS.includes(pathname)) return "/dashboard";
  return null;
}

// What the frame shows for this login
export function navFor(user) {
  const role = roleOf(user);
  const linkedVendor = role === "vendor" && Boolean(user?.vendor);
  return {
    team: role === "admin",
    settings: role === "admin" || role === "vendor",
    // Notifications: admins and linked vendors (viewers' inbox is always empty; Dhruva: 403)
    bell: role === "admin" || linkedVendor,
    // The Lead flow toggle (all three flows): admins, viewers and linked vendors
    flowToggle: role === "admin" || role === "viewer" || linkedVendor,
    // The Dhruva flow ("Dhruva leads" in the switch): everyone but vendors
    dhruvaFlow: canSeeDhruva(user),
    viewOnlyBadge: role === "viewer",
  };
}

// Did a write fail only because this is a view-only login?
export function isViewOnlyError(error) {
  if (error?.status !== 403) return false;
  const detail = typeof error.detail === "string" ? error.detail : error.message;
  return typeof detail === "string" && detail.includes(VIEW_ONLY_MESSAGE);
}
