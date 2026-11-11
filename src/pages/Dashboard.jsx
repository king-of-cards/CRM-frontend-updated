import { useCallback, useState } from "react";
import { useLocation } from "react-router";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import WelcomeIntro from "../components/layout/WelcomeIntro.jsx";
import RecentLeads from "../components/dashboard/RecentLeads.jsx";

// Sample numbers so the page has something to show.
// Replace these with data from the Spring Boot API later.
const stats = [
  { label: "Total customers", value: "1,248" },
  { label: "Open leads", value: "86" },
  { label: "Orders this month", value: "312" },
  { label: "Revenue this month", value: "₹4,82,500" },
];

export default function Dashboard() {
  // The intro plays only when coming from the login page, not when clicking
  // "Dashboard" in the sidebar.
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(
    Boolean(location.state?.fromLogin),
  );
  const hideIntro = useCallback(() => setShowIntro(false), []);

  return (
    <>
      {showIntro && <WelcomeIntro onDone={hideIntro} />}
      <DashboardLayout title="Dashboard">
        <p className="text-sm text-gray-600">Here's what's happening today.</p>

        {/* Stat cards */}
        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-6 shadow-md shadow-gray-200/70 ring-1 ring-gray-100 transition-shadow hover:shadow-lg hover:shadow-gray-300/60"
            >
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-3 text-3xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </section>

        {/* Recent leads */}
        <RecentLeads />
      </DashboardLayout>
    </>
  );
}
