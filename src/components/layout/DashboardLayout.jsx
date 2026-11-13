import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  Camera,
  ClipboardList,
  Globe,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Target,
  UserCog,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";

// Shared frame for every page after login: collapsible sidebar, top bar, page content.
// adminOnly items are hidden for vendor accounts (the backend allows those endpoints to admins only)
// Only pages that exist. Add Customers / Orders here once their pages are built.
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads explorer", icon: Target, adminOnly: true },
  { to: "/users", label: "Team", icon: UserCog, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

// Tabs in the floating top bar: the overview and one tab per lead source
const topTabs = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads/spin", label: "Spin leads", icon: Target, adminOnly: true },
  {
    to: "/leads/international",
    label: "International",
    icon: Globe,
    adminOnly: true,
  },
  { to: "/leads/wedding", label: "Wedding", icon: Camera, adminOnly: true },
  {
    to: "/leads/wedding-planner",
    label: "Wedding planner",
    icon: ClipboardList,
    adminOnly: true,
  },
];

const STORAGE_KEY = "crm-sidebar-collapsed";

export default function DashboardLayout({
  title,
  description,
  actions,
  children,
}) {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);
  const visibleTabs = topTabs.filter((tab) => !tab.adminOnly || isAdmin);

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
        <header className="sticky top-0 z-30 flex justify-center px-4 pt-4">
          <div className="relative flex w-full max-w-4xl items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 p-1.5 shadow-xl shadow-brand-800/25 ring-1 ring-white/10">
            {/* Soft light sweep across the bar */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0"
            />
            <nav
              aria-label="Sections"
              className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/dashboard"}
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
        </header>

        <main className="flex-1 px-6 pb-10 pt-8">
          {/* Page heading */}
          {(title || actions) && (
            <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                )}
              </div>
              {actions}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
