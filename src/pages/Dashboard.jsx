import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { CircleCheck, IndianRupee, Percent, Users } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import WelcomeIntro from "../components/layout/WelcomeIntro.jsx";
import DirectionSwitch from "../components/dashboard/DirectionSwitch.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import RecentLeads from "../components/dashboard/RecentLeads.jsx";
import { useAuth } from "../auth/useAuth.js";
import { DIRECTIONS, LEADS, VENDORS } from "../data/leads.js";
import { formatINR } from "../utils/format.js";

// Each vendor's agreed commission, as a % of the deal value.
const rateByVendor = Object.fromEntries(VENDORS.map((v) => [v.id, v.commissionRate ?? 0]));

// How many leads go each way, shown on the direction switch.
const directionCounts = Object.fromEntries(
  DIRECTIONS.map((d) => [d.id, LEADS.filter((l) => l.direction === d.id).length]),
);

function percentOf(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

export default function Dashboard() {
  // The intro plays only when coming from the login page, not when clicking
  // "Dashboard" in the sidebar.
  const location = useLocation();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];
  
  const [showIntro, setShowIntro] = useState(Boolean(location.state?.fromLogin));
  const hideIntro = useCallback(() => setShowIntro(false), []);

  const [direction, setDirection] = useState(DIRECTIONS[0].id);

  const leads = useMemo(() => LEADS.filter((l) => l.direction === direction), [direction]);

  // KPIs follow the selected direction (KOC -> Vendors or Vendors -> KOC).
  const stats = useMemo(() => {
    const current = DIRECTIONS.find((d) => d.id === direction);
    const converted = leads.filter((l) => l.status === "converted");
    const revenue = converted.reduce((sum, l) => sum + (l.quotation ?? 0), 0);
    // Commission = quotation amount x that vendor's rate, on converted leads only.
    const commission = converted.reduce(
      (sum, l) => sum + Math.round(((l.quotation ?? 0) * (rateByVendor[l.vendorId] ?? 0)) / 100),
      0,
    );
    return [
      {
        label: "Total leads",
        value: leads.length.toLocaleString("en-IN"),
        icon: Users,
        tint: "bg-sky-50 text-sky-600",
      },
      {
        label: "Converted",
        value: converted.length.toLocaleString("en-IN"),
        note: `${percentOf(converted.length, leads.length)}% of leads`,
        icon: CircleCheck,
        tint: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Revenue generated",
        value: formatINR(revenue),
        note: "From converted leads",
        icon: IndianRupee,
        tint: "bg-brand-50 text-brand-700",
      },
      {
        label: current.commissionLabel,
        value: formatINR(commission),
        note: current.commissionHint,
        icon: Percent,
        tint: "bg-amber-50 text-amber-600",
      },
    ];
  }, [leads, direction]);

  return (
    <>
      {showIntro && <WelcomeIntro onDone={hideIntro} />}
      <DashboardLayout title="Dashboard">
        <p className="text-sm text-gray-600">
          {firstName ? `Welcome back, ${firstName}. ` : ""}Here's what's
          happening today.
        </p>
        {/* KOC -> Vendors / Vendors -> KOC, where the old top bar was */}
        <DirectionSwitch value={direction} onChange={setDirection} counts={directionCounts} />

        {/* KPI cards */}
        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </section>

        {/* Service, vendor and status filters + the leads table */}
        <RecentLeads leads={leads} />
      </DashboardLayout>
    </>
  );
}
