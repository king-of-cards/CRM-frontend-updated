import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Clock3, Flame, IndianRupee, Inbox, Send, ThumbsDown, ThumbsUp, Wallet, Receipt } from "lucide-react";
import { getKocToDhruvaDashboard } from "../api/kocToDhruva.js";
import { Kpi, Panel } from "../components/dashboard/DashboardParts.jsx";
import FollowUpsCard from "../components/dashboard/FollowUpsCard.jsx";
import TopCities from "../components/dashboard/TopCities.jsx";
import { dateTimeText, dayText, dhruvaErrors, phoneText, statusLabel } from "./dhruvaUtils.js";
import { budgetBandRows, dashboardKpiCards, kocToDhruvaListLink, num, occasionRows, reasonLabel, reasonRows, statusRows } from "./kocToDhruvaUtils.js";
import { periodLabel } from "./dashboardPeriod.js";

// KOC → Dhruva dashboard (GET /analytics/koc-to-dhruva, docs section 18): the shared period
// (All time by default), the KPI cards (each opens the filtered list), follow-ups, charts and
// the latest leads.

const COLORS = ["#4f46e5", "#8b5cf6", "#f59e0b", "#e11d48", "#0284c7", "#16a34a", "#d97706", "#64748b"];
const chartDate = (v) => (v?.length === 7 ? new Date(`${v}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : dayText(v));
const KPI_ICONS = { total: Inbox, interested: ThumbsUp, not_interested: ThumbsDown, quotes_sent: Send, quoted_amount: Receipt, converted: BadgeCheck, conversion_amount: IndianRupee, aov: Wallet, hot: Flame, pending: Clock3 };
const kpiGradient = (key, i) => (key === "hot" ? "from-amber-500 to-orange-600" : i % 2 ? "from-violet-500 to-violet-700" : "from-indigo-500 to-indigo-700");

// Bars with counts; rows with filters open the list (with the period)
function BarRows({ rows, period, color, empty = "No data for this period." }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.some((r) => r.count)) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-gray-700">{r.label}</span>
            {r.filters && r.count ? (
              <Link className="font-semibold tabular-nums hover:underline" to={kocToDhruvaListLink(r.filters, period)}>{num(r.count)}</Link>
            ) : (
              <span className="font-semibold tabular-nums">{num(r.count)}</span>
            )}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: color }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function KocToDhruvaDashboard({ period, refreshKey }) {
  const query = period.all ? { period: "all" } : { dateFrom: period.from, dateTo: period.to };
  const [data, setData] = useState(() => getKocToDhruvaDashboard.peek(query) ?? null);
  const [loading, setLoading] = useState(() => !getKocToDhruvaDashboard.peek(query));
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const cached = getKocToDhruvaDashboard.peek(query);
    if (cached) setData(cached);
    setLoading(!cached);
    getKocToDhruvaDashboard({ ...query, refresh: refreshKey > 0 })
      .then((res) => { if (!cancelled) { setData(res); setError(""); } })
      .catch((err) => !cancelled && setError(dhruvaErrors(err).message || err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.all, period.from, period.to, refreshKey]);

  const inflow = useMemo(() => (data?.inflow ?? []).map((x) => ({ ...x, label: x.end ? periodLabel(x.date, x.end) : chartDate(x.date) })), [data]);
  const statusBars = statusRows(data?.by_status);
  const cards = dashboardKpiCards(data?.kpis, period);
  const kpiLoading = loading && !data;
  const latest = data?.latest ?? [];

  return (
    <>
      {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="KOC → Dhruva key numbers">
        {cards.map((c, i) => <Kpi key={c.key} icon={KPI_ICONS[c.key]} label={c.label} value={c.value} to={c.to} gradient={kpiGradient(c.key, i)} loading={kpiLoading} />)}
      </section>
      <div className="mt-6"><FollowUpsCard flow="koc_to_dhruva" /></div>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Lead inflow" subtitle="Received during the selected period, by reason">
          <div className="h-72">
            {inflow.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inflow} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="kocDhruvaInflow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} /><stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#4f46e5" fill="url(#kocDhruvaInflow)" strokeWidth={2} />
                  <Area type="monotone" dataKey="budget" name="Budget ≥ ₹70" stroke="#16a34a" fill="none" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="quantity" name="Quantity ≥ 1000" stroke="#f59e0b" fill="none" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="pt-10 text-center text-sm text-gray-500">No leads received in this period.</p>}
          </div>
        </Panel>
        <Panel title="Update breakdown" subtitle="Current update of leads received in this period">
          <div className="h-72">
            {statusBars.some((x) => x.count) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBars} layout="vertical" margin={{ top: 8, right: 16, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 5, 5, 0]}>{statusBars.map((x, i) => <Cell key={x.key} fill={COLORS[i % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="pt-10 text-center text-sm text-gray-500">No updates yet.</p>}
          </div>
        </Panel>
        <Panel title="Leads by reason"><BarRows rows={reasonRows(data?.by_reason)} period={period} color="#4f46e5" /></Panel>
        <Panel title="Leads by budget band" subtitle="Estimated budget per card"><BarRows rows={budgetBandRows(data?.by_budget_band)} period={period} color="#16a34a" /></Panel>
        <Panel title="Leads by occasion" subtitle="Top 10 occasions"><BarRows rows={occasionRows(data?.by_occasion)} period={period} color="#8b5cf6" /></Panel>
        <TopCities rows={data?.top_cities} sources={data?.top_cities_sources} defaultSource="koc_to_dhruva" flow="koc_to_dhruva" />
        <Panel title="Latest leads" subtitle="Six newest leads received in this period">
          {latest.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b text-xs text-gray-500"><th className="py-2">Name</th><th>Occasion</th><th>Reason</th><th>Update</th><th aria-label="Hot lead" /></tr></thead>
                <tbody>
                  {latest.map((l) => (
                    <tr key={l.lead_key} className="border-b border-gray-50">
                      <td className="py-3">
                        <Link to={kocToDhruvaListLink({ search: l.name || l.phone || "", notification_lead_key: l.lead_key })} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">{l.name || phoneText(l.phone)}</Link>
                        <span className="block text-xs text-gray-500">{dateTimeText(l.received)}</span>
                      </td>
                      <td>{l.occasion || "—"}</td>
                      <td>{reasonLabel(l.reason) || "—"}</td>
                      <td>{statusLabel(l.update_status)}</td>
                      <td>{l.is_hot ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"><Flame size={11} aria-hidden="true" />Hot</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-gray-500">No leads for this period.</p>}
        </Panel>
      </section>
    </>
  );
}
