import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import RequireAuth from "./auth/RequireAuth.jsx";
import Login from "./pages/Login.jsx";

// Pages load as separate small files, so the first screen (login or dashboard) opens
// without downloading the code for every other page. Login preloads the dashboard.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const LeadSourcePage = lazy(() => import("./pages/LeadSourcePage.jsx"));
const Leads = lazy(() => import("./pages/Leads.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const RecentLeads = lazy(
  () => import("./components/dashboard/RecentLeads.jsx"),
);
const WeddingLeads = lazy(
  () => import("./components/dashboard/WeddingLeads.jsx"),
);
const WeddingPlans = lazy(
  () => import("./components/dashboard/WeddingPlans.jsx"),
);
const WhatsAppLeads = lazy(
  () => import("./components/dashboard/WhatsAppLeads.jsx"),
);

// Shown for a split second while a page's code downloads
function PageLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-white"
      role="status"
    >
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

// One tab per lead source (also listed in the top bar, in DashboardLayout.jsx)
const sourcePages = [
  {
    path: "/leads/spin",
    title: "Spin leads",
    description:
      "Leads from the spin game, read live from the workflow database.",
    element: <RecentLeads />,
  },
  {
    path: "/leads/international",
    title: "International leads",
    description: "WhatsApp numbers from the International Google Sheet.",
    element: <WhatsAppLeads />,
  },
  {
    path: "/leads/wedding",
    title: "Wedding leads",
    description:
      "Wedding & event photography enquiries from the Wedding Google Sheet.",
    element: <WeddingLeads />,
  },
  {
    path: "/leads/wedding-planner",
    title: "Wedding planner leads",
    description: "Full wedding plans from the Wedding planner Google Sheet.",
    element: <WeddingPlans />,
  },
];

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        {sourcePages.map((p) => (
          <Route
            key={p.path}
            path={p.path}
            element={
              <RequireAuth role="admin">
                <LeadSourcePage title={p.title} description={p.description}>
                  {p.element}
                </LeadSourcePage>
              </RequireAuth>
            }
          />
        ))}

        <Route
          path="/leads"
          element={
            <RequireAuth role="admin">
              <Leads />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth role="admin">
              <Users />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        {/* Anything else: dashboard (RequireAuth sends logged-out users to /login) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
