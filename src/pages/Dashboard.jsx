import { useCallback, useState } from "react";
import { useLocation } from "react-router";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import WelcomeIntro from "../components/layout/WelcomeIntro.jsx";

// Sample numbers and rows so the page has something to show.
// Replace these with data from the Spring Boot API later.
const stats = [
  { label: "Total customers", value: "1,248" },
  { label: "Open leads", value: "86" },
  { label: "Orders this month", value: "312" },
  { label: "Revenue this month", value: "₹4,82,500" },
];

const recentLeads = [
  {
    name: "Aarav Mehta",
    company: "Mehta Traders",
    status: "New",
    date: "11 Nov 2026",
  },
  {
    name: "Priya Shah",
    company: "Shah Prints",
    status: "Contacted",
    date: "10 Nov 2026",
  },
  {
    name: "Rohan Kapoor",
    company: "Kapoor & Sons",
    status: "Qualified",
    date: "9 Nov 2026",
  },
  {
    name: "Neha Joshi",
    company: "Joshi Events",
    status: "New",
    date: "8 Nov 2026",
  },
];

const statusStyles = {
  New: "bg-brand-100 text-brand-800",
  Contacted: "bg-amber-100 text-amber-800",
  Qualified: "bg-emerald-100 text-emerald-800",
};

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
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-5 ring-1 ring-gray-200"
            >
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </section>

        {/* Recent leads */}
        <section className="mt-8 rounded-2xl bg-white ring-1 ring-gray-200">
          <h2 className="px-5 pt-5 text-base font-semibold text-gray-900">
            Recent leads
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => (
                  <tr
                    key={lead.name}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {lead.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{lead.company}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[lead.status]}`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{lead.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </DashboardLayout>
    </>
  );
}
