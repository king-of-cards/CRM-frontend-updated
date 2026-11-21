import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Camera,
  ClipboardList,
  Gift,
  Globe,
  Handshake,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Star,
  Target,
  UserCog,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";
import { navFor } from "../../auth/permissions.js";
import { ViewOnlyBadge, ViewOnlyToast } from "../shared/ViewOnly.jsx";
import LeadFlowToggle from "../dashboard/LeadFlowToggle.jsx";
import DhruvaDirectionSwitch from "../dashboard/DhruvaDirectionSwitch.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { dhruvaDirectionOf, dhruvaDirectionTarget, flowOf, FLOW_PAGES, tabsFor } from "./leadFlow.js";
import LeadBackButton from "./LeadBackButton.jsx";
import { isLeadRoute } from "./leadBack.js";
import { notificationBellPlacement } from "./notificationUtils.js";

// Shared frame for every page after login: collapsible sidebar, top bar, page content.
// navKey items show only when navFor(user) allows them (Team: admins; Settings: admins and vendors)
// Only pages that exist. Add Customers / Orders here once their pages are built.
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Team", icon: UserCog, navKey: "team" },
  { to: "/settings", label: "Settings", icon: Settings, navKey: "settings" },
];

// Dhruva logins only see Dashboard (their flow's tabs handle Dhruva leads)
const dhruvaNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// Icons of the top bar tabs (which tabs show depends on the Lead flow: see leadFlow.js)
const TAB_ICONS = {
  "/dashboard": LayoutDashboard,
  "/leads/spin": Target,
  "/leads/wedding-gifts": Gift,
  "/leads/international": Globe,
  "/leads/wedding": Camera,
  "/leads/wedding-planner": ClipboardList,
  "/vendor-to-koc": Handshake,
  "/dhruva-leads": Star,
  "/koc-to-dhruva": Send,
};

const STORAGE_KEY = "crm-sidebar-collapsed";

export default function DashboardLayout({
  title,
  description,
  actions,
  children,
}) {
  const navigate = useNavigate();
  const { user, isAdmin, isVendor, isDhruva, canSeeLeads, logout } = useAuth();

  // What this login's frame shows (permissions.js): Team for admins, Settings for admins and
  // vendors, View only badge for viewers. Dhruva logins have a minimal sidebar.
  const nav = navFor(user);
  const visibleNav = isDhruva
    ? dhruvaNavItems
    : navItems.filter((item) => !item.navKey || nav[item.navKey]);

  // Lead flow: from the page (Dashboard ?flow=vendors and /vendor-to-koc = Vendors → KOC,
  // Dashboard ?flow=dhruva and /dhruva-leads = Dhruva). The top tabs follow it;
  // the Lead flow switch shows on the Dashboard and the lead lists (but not for Dhruva logins).
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  // Vendors never get the Dhruva flow (their Dashboard ignores ?flow=dhruva)
  const rawFlow = flowOf(location.pathname, location.search);
  const flow = rawFlow === "dhruva" && !nav.dhruvaFlow ? "" : rawFlow;
  // The Dhruva flow's direction: the open list, or the Dashboard's ?direction
  const direction = dhruvaDirectionOf(location.pathname, location.search);
  const visibleTabs = tabsFor(flow, direction).map((t) => ({ ...t, icon: TAB_ICONS[t.path] }));
  const showDirection = flow === "dhruva" && FLOW_PAGES.includes(location.pathname);
  // Dashboard: switch ?direction in place (keeping the period); a list: open the other list
  function chooseDirection(value) {
    if (location.pathname === "/dashboard") {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (value === "koc_to_dhruva") params.set("direction", value);
        else params.delete("direction");
        return params;
      });
    } else navigate(dhruvaDirectionTarget(location.pathname, value));
  }

  // The toggle is hidden for Dhruva logins (they only have the Dhruva flow)
  const showToggle = !isDhruva && (canSeeLeads || isAdmin || nav.flowToggle) && FLOW_PAGES.includes(location.pathname);
  const bellPlacement = notificationBellPlacement({
    isAdmin,
    isVendor: isVendor && Boolean(user?.vendor),
    isDhruva,
    showToggle,
  });
  const topBarExtra = showToggle ? (
    <div className="flex w-full items-center gap-2 lg:w-auto">
      <div className="min-w-0 flex-1 lg:flex-none">
        <LeadFlowToggle value={flow} onChange={chooseFlow} showDhruva={nav.dhruvaFlow} />
      </div>
      {bellPlacement.besideToggle && (
        <div className="hidden shrink-0 lg:block">
          <NotificationBell variant="gold" />
        </div>
      )}
    </div>
  ) : null;

  // The other flow: on the Dashboard switch in place (keeping the period); elsewhere go to
  // that flow's Dashboard
  function chooseFlow(value) {
    if (value === flow) return;
    if (location.pathname === "/dashboard") {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (value) params.set("flow", value);
        else params.delete("flow");
        if (value !== "dhruva") params.delete("direction");
        return params;
      });
    } else {
      if (value === "vendors") navigate("/dashboard?flow=vendors");
      else if (value === "dhruva") navigate("/dashboard?flow=dhruva");
      else navigate("/dashboard");
    }
  }

  // The nav pill scrolls sideways when tight: start at the left so the first tab is never cut off
  const navRef = useRef(null);
  useEffect(() => {
    if (navRef.current) navRef.current.scrollLeft = 0;
  }, [flow]);

  // Remember whether the sidebar was collapsed, so it stays that way between pages and visits.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Storage unavailable: the sidebar still works, it just won't be remembered.
    }
  }, [collapsed]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex min-h-screen bg-white text-gray-800">
      {/* Sidebar (hidden on phones) */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-linear-to-b from-brand-600 via-brand-800 to-emerald-950 text-white shadow-lg shadow-brand-800/20 transition-[width] duration-300 ease-in-out md:flex ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
      >
        {/* Logo + collapse button */}
        <div
          className={`flex items-center py-5 ${
            collapsed ? "flex-col gap-3 px-2" : "justify-between px-5"
          }`}
        >
          <p className="font-script text-3xl font-bold text-white">
            {collapsed ? "C" : "CRM"}
          </p>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <ToggleIcon size={20} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-1 px-3">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-0" : "px-4"
                } ${
                  isActive
                    ? "bg-white text-brand-800 shadow-sm"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Signed-in user + log out */}
        <div className="p-3">
          {user && !collapsed && (
            <div className="mb-2 rounded-xl bg-white/10 px-4 py-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/70">{user.email}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
                {user.role}
                {user.vendor ? ` · ${user.vendor.name}` : ""}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Log out" : undefined}
            aria-label={collapsed ? "Log out" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white ${
              collapsed ? "justify-center px-0" : "px-4"
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Floating pill top bar: tabs for the overview and each lead source */}
        <header
          className={`sticky top-0 z-30 flex justify-center px-4 pt-4 ${
            topBarExtra ? "flex-col items-center gap-3 lg:flex-row lg:items-center" : ""
          }`}
        >
          <div className={`relative flex w-full max-w-4xl items-center gap-2 rounded-full ${topBarExtra ? "lg:min-w-0 lg:flex-1" : ""} bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 p-1.5 shadow-xl shadow-brand-800/25 ring-1 ring-white/10`}>
            {/* Soft light sweep across the bar */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0" />
            </span>
            <nav
              ref={navRef}
              aria-label="Sections"
              className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map(({ path, to, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={to}
                  end={path === "/dashboard"}
                  className={({ isActive }) =>
                    `relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white text-brand-800 shadow-md shadow-black/10"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Signed-in user */}
            {user && (
              <div className="relative flex shrink-0 items-center gap-1 pl-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="relative rounded-full px-3 py-1.5 text-sm text-white/80 transition-colors hover:text-white md:hidden"
                >
                  Log out
                </button>
                {user.vendor && (
                  <span
                    title="Your vendor: you see only its leads"
                    className="relative rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30"
                  >
                    {user.vendor.name}
                  </span>
                )}
                {nav.viewOnlyBadge && <ViewOnlyBadge inverted className="relative" />}
                {bellPlacement.besideAvatar && <NotificationBell variant="gold" />}
                {bellPlacement.mobileBesideAvatar && (
                  <div className="lg:hidden">
                    <NotificationBell variant="gold" />
                  </div>
                )}
                <span
                  title={`${user.name} · ${user.email}`}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white ring-1 ring-white/30"
                >
                  {user.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {topBarExtra && <div className="w-full max-w-4xl shrink-0 lg:w-auto">{topBarExtra}</div>}
        </header>

        <main className="flex-1 px-6 pb-10 pt-8">
          {showDirection && (
            <div className="mb-4">
              <DhruvaDirectionSwitch value={direction} onChange={chooseDirection} />
            </div>
          )}
          {/* Page heading */}
          {(title || actions) && (
            <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {isLeadRoute(location.pathname) && <LeadBackButton />}
                <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                )}
                </div>
              </div>
              {actions}
            </div>
          )}
          {children}
        </main>
        {/* A friendly message when the API refuses a write from a view-only login */}
        <ViewOnlyToast />
      </div>
    </div>
  );
}
