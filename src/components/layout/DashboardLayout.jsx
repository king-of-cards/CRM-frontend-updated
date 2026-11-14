import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";

// Shared frame for every page after login: collapsible sidebar, top bar, page content.
// adminOnly items are hidden for vendor accounts (the backend allows those endpoints to admins only)
// Shared frame for every page after login: collapsible sidebar and page content.
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/leads", label: "Leads", icon: Target, adminOnly: true },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/users", label: "Team", icon: UserCog, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

const STORAGE_KEY = "crm-sidebar-collapsed";

export default function DashboardLayout({ title, children }) {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

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
        {/* Phones only: the sidebar is hidden there, so keep the logo and a way to log out */}
        <header className="flex items-center justify-between bg-linear-to-r from-brand-600 to-brand-800 px-4 py-3 text-white md:hidden">
          <p className="font-script text-2xl font-bold">CRM</p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/85 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            Log out
          </button>
        </header>

        <main className="flex-1 p-6">
          {/* Page title for screen readers; the page itself shows its own heading area */}
          <h1 className="sr-only">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
