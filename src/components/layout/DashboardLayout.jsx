import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Target,
  Users,
} from "lucide-react";

// Shared frame for every page after login: collapsible sidebar, top bar, page content.
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/leads", label: "Leads", icon: Target },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/settings", label: "Settings", icon: Settings },
];

// Links in the floating top bar
const topLinks = [
  { to: "/reports", label: "Reports" },
  { to: "/activity", label: "Activity" },
  { to: "/calendar", label: "Calendar" },
  { to: "/help", label: "Help" },
];

const STORAGE_KEY = "crm-sidebar-collapsed";

export default function DashboardLayout({ title, children }) {
  const navigate = useNavigate();

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

  function handleLogout() {
    // TODO: clear the login token here once real authentication is added.
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
          {navItems.map(({ to, label, icon: Icon }) => (
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

        {/* Log out */}
        <div className="p-3">
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
        {/* Floating pill top bar */}
        <header className="sticky top-0 z-30 flex justify-center px-4 pt-4">
          <div className="flex w-full max-w-3xl items-center gap-1 rounded-full border border-gray-200 bg-white/80 py-1.5 pl-5 pr-1.5 shadow-sm backdrop-blur-md">
            {/* Page title */}
            <div className="flex items-center gap-2 pr-3">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-brand-600"
              />
              <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
            </div>

            {/* Links */}
            <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
              {topLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "text-gray-900"
                        : "text-gray-500 hover:text-gray-900"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="Search"
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full px-3 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 md:hidden"
              >
                Log out
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
              >
                <Plus size={16} />
                New lead
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
