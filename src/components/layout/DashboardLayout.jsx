import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Camera,
  ClipboardList,
  Globe,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Star,
  Target,
  UserCog,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";
import { navFor, visibleSources } from "../../auth/permissions.js";
import { ViewOnlyBadge, ViewOnlyToast } from "../shared/ViewOnly.jsx";
import LeadFlowToggle from "../dashboard/LeadFlowToggle.jsx";
import DhruvaDirectionSwitch from "../dashboard/DhruvaDirectionSwitch.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { dhruvaDirectionOf, dhruvaDirectionTarget, flowLabels, flowOf, FLOW_PAGES, tabsFor } from "./leadFlow.js";
import LeadBackButton from "./LeadBackButton.jsx";
import PageErrorBoundary from "../shared/PageErrorBoundary.jsx";
import { isLeadRoute } from "./leadBack.js";
import { notificationBellPlacement } from "./notificationUtils.js";
import { preloadRoute } from "../../routeLoaders.js";

// Shared frame for every page after login: collapsible sidebar (a slide-in drawer on phones),
// top bar, page content.
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
  // Vendor logins: only their sources' tabs, and the flows named after their vendor
  const labels = flowLabels(isVendor ? user?.vendor : null);
  const visibleTabs = tabsFor(flow, direction, { sources: visibleSources(user), labels }).map((t) => ({ ...t, icon: TAB_ICONS[t.path] }));
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
        <LeadFlowToggle value={flow} onChange={chooseFlow} showDhruva={nav.dhruvaFlow} labels={labels} />
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

  // The nav pill scrolls sideways when tight (phones): bring the open tab into view, so it is never
  // hidden past the edge (the Dashboard tab is first, so it starts at the left)
  const navRef = useRef(null);
  useEffect(() => {
    const bar = navRef.current;
    if (!bar) return;
    const active = bar.querySelector('[aria-current="page"]');
    bar.scrollLeft = active ? Math.max(0, active.offsetLeft - 8) : 0;
  }, [flow, location.pathname]);

  // Phones and tablets: the top bar slides away while scrolling down (more room for the leads) and
  // comes back as soon as the person scrolls up. Always shown from lg.
  // Hidden only on the page where it was hidden, so a new page always starts with the bar visible
  const [hiddenOn, setHiddenOn] = useState(null);
  const barHidden = hiddenOn === location.pathname;
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (window.innerWidth >= 1024 || y < 120) {
        setHiddenOn(null);
        last = y;
        return;
      }
      if (Math.abs(y - last) < 10) return;
      setHiddenOn(y > last ? window.location.pathname : null);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Phones (below md): the sidebar is a drawer, closed by default; closes on a page change,
  // Escape, the backdrop or growing to md
  // Open only on the page it was opened on, so going to another page closes it
  const [drawerPath, setDrawerPath] = useState(null);
  const drawerOpen = drawerPath === location.pathname;
  const setDrawerOpen = (open) => setDrawerPath(open ? location.pathname : null);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setDrawerPath(null);
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 768px)") : null;
    const onWide = (e) => e.matches && setDrawerPath(null);
    document.addEventListener("keydown", onKey);
    media?.addEventListener?.("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      media?.removeEventListener?.("change", onWide);
    };
  }, [drawerOpen]);
  // The drawer always shows the full sidebar; "collapsed" is for md and up
  const mini = collapsed && !drawerOpen;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex min-h-screen bg-white text-gray-800">
      {/* Phones: backdrop behind the open drawer */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-[2px] md:hidden"
        />
      )}
      {/* Sidebar: a slide-in drawer on phones, a sticky column from md */}
      <aside
        id="app-sidebar"
        aria-label="Menu"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col overflow-y-auto bg-linear-to-b from-brand-600 via-brand-800 to-emerald-950 text-white shadow-lg shadow-brand-800/20 transition-[transform,width] duration-300 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:max-w-none md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[72px]" : "md:w-60"}`}
      >
        {/* Logo + collapse button */}
        <div
          className={`flex items-center py-5 ${
            mini ? "flex-col gap-3 px-2" : "justify-between px-5"
          }`}
        >
          <p className="font-script text-3xl font-bold text-white">
            {mini ? "C" : "CRM"}
          </p>
          {/* Phones: close the drawer */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white md:block"
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
              onMouseEnter={() => preloadRoute(to)}
              onFocus={() => preloadRoute(to)}
              title={mini ? label : undefined}
              aria-label={mini ? label : undefined}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  mini ? "justify-center px-0" : "px-4"
                } ${
                  isActive
                    ? "bg-white text-brand-800 shadow-sm"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {!mini && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Signed-in user + log out */}
        <div className="p-3">
          {user && !mini && (
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
            title={mini ? "Log out" : undefined}
            aria-label={mini ? "Log out" : undefined}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white ${
              mini ? "justify-center px-0" : "px-4"
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {!mini && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Floating pill top bar: tabs for the overview and each lead source */}
        <header
          className={`sticky top-0 z-30 flex min-w-0 justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-300 ease-out sm:px-4 sm:pt-4 lg:translate-y-0 ${
            topBarExtra ? "flex-col items-center gap-2 sm:gap-3 lg:flex-row lg:items-center" : ""
          } ${barHidden && !drawerOpen ? "-translate-y-[calc(100%+2.5rem)]" : "translate-y-0"}`}
        >
          <div className={`relative flex w-full min-w-0 max-w-4xl items-center gap-1 rounded-full sm:gap-2 ${topBarExtra ? "lg:min-w-0 lg:flex-1" : ""} bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 p-1 shadow-xl shadow-brand-800/25 ring-1 ring-white/10 sm:p-1.5`}>
            {/* Soft light sweep across the bar */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0" />
            </span>
            {/* Phones: open the sidebar drawer */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={drawerOpen}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:h-11 sm:w-11 md:hidden"
            >
              <Menu size={18} />
            </button>
            <nav
              ref={navRef}
              aria-label="Sections"
              className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_92%,transparent)] lg:pr-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map(({ path, to, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={to}
                  onMouseEnter={() => preloadRoute(path)}
                  onFocus={() => preloadRoute(path)}
                  end={path === "/dashboard"}
                  className={({ isActive }) =>
                    // Phones: a slimmer tab (13 px text); from sm the full size
                    `relative flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:min-h-11 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm md:min-h-0 ${
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
                {user.vendor && (
                  <span
                    title="Your vendor: you see only its leads"
                    className="relative hidden max-w-[10rem] truncate rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 sm:inline-block"
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
                  className="relative hidden h-9 w-9 items-center justify-center rounded-full sm:flex bg-white/15 text-xs font-semibold text-white ring-1 ring-white/30"
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
          {topBarExtra && <div className="w-full min-w-0 max-w-4xl shrink-0 lg:w-auto">{topBarExtra}</div>}
        </header>

        <main className="min-w-0 flex-1 px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8">
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
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
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
          {/* A crash in the page shows a message with Retry, not a white page (new key per page) */}
          <PageErrorBoundary key={location.pathname}>{children}</PageErrorBoundary>
        </main>
        {/* A friendly message when the API refuses a write from a view-only login */}
        <ViewOnlyToast />
      </div>
    </div>
  );
}
