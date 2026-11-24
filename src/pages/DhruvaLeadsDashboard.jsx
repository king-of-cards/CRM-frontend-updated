import { useEffect, useMemo, useState } from "react";
import ContactActions from "../components/shared/ContactActions.jsx";
import { Link } from "react-router";
import LazyCharts from "../components/dashboard/LazyCharts.jsx";
import { BarListSkeleton, ChartSkeleton, ListSkeleton } from "../components/shared/Skeleton.jsx";
import { BadgeCheck, CalendarDays, Clock3, Flame, IndianRupee, Inbox, Send, ThumbsUp, Wallet } from "lucide-react";
import { getDhruvaDashboard } from "../api/dhruva.js";
import { Kpi, Panel } from "../components/dashboard/DashboardParts.jsx";
import FollowUpsCard from "../components/dashboard/FollowUpsCard.jsx";
import { dateTimeText, dayText, dhruvaErrors, dhruvaListLink, eventDatesOf, eventDatesText, phonesOf, phoneText, statusLabel } from "./dhruvaUtils.js";
import { dashboardKpiCards, num, statusRows } from "./dhruvaDashboard.js";
import { periodLabel } from "./dashboardPeriod.js";
import { MONTHS } from "../components/shared/dates.js";

const COLORS = ["#0f766e", "#8b5cf6", "#f59e0b", "#e11d48", "#0284c7", "#16a34a", "#d97706", "#64748b"];
const chartDate = (v) => v?.length === 7 ? `${MONTHS[Number(v.slice(5, 7)) - 1] ?? ""} ${v.slice(0, 4)}`.trim() : dayText(v);
function LinkedBarList({ rows, period, color = "#0f766e", loading = false }) {
  if (loading) return <BarListSkeleton />;
  const max = Math.max(1, ...rows.map((x) => x.count));
  return <div className="space-y-3">{rows.length ? rows.map((r) => <div key={r.key ?? r.value}>
    <div className="flex justify-between gap-3 text-sm"><span className="truncate text-gray-700">{r.label ?? r.value}</span><Link className="font-semibold tabular-nums hover:underline" to={dhruvaListLink(r.filters ?? { event_type: [r.value] }, period)}>{num(r.count)}</Link></div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: color }} /></div>
  </div>) : <p className="text-sm text-gray-500">No data for this period.</p>}</div>;
}

export default function DhruvaLeadsDashboard({ period, refreshKey }) {
  const query = period.all ? { period: "all" } : { dateFrom: period.from, dateTo: period.to };
  const [data, setData] = useState(() => getDhruvaDashboard.peek(query) ?? null);
  const [loading, setLoading] = useState(() => !getDhruvaDashboard.peek(query));
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const cached = getDhruvaDashboard.peek(query);
    if (cached) setData(cached);
    setLoading(!cached);
    getDhruvaDashboard({ ...query, refresh: refreshKey > 0 }).then((res) => {
      if (!cancelled) { setData(res); setError(""); }
    }).catch((err) => !cancelled && setError(dhruvaErrors(err).message || err.message)).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [period.all, period.from, period.to, refreshKey]);

  const inflow = useMemo(() => (data?.inflow ?? []).map((x) => ({ ...x, label: x.end ? periodLabel(x.date, x.end) : chartDate(x.date) })), [data]);
  const byStatus = statusRows(data?.by_status);
  const statusBars = byStatus.map((x) => ({ ...x, label: x.label }));
  const byTypes = (data?.by_event_type ?? []).map((x) => ({ ...x, label: x.value, filters: { event_type: [x.value] } }));
  const venues = (data?.top_venues ?? []).map((x) => ({ ...x, label: x.value, filters: { venue: x.value } }));
  const months = (data?.events_by_month ?? []).map((x) => ({ ...x, label: chartDate(x.month) }));
  const cards = dashboardKpiCards(data?.kpis, period);
  const kpiIcons = [Inbox, Clock3, ThumbsUp, ThumbsUp, IndianRupee, Send, BadgeCheck, IndianRupee, CalendarDays, Flame, Wallet];
  // Hot leads keeps the other dashboards' amber style
  const kpiGradient = (c, i) => c.label === "Hot leads" ? "from-amber-500 to-orange-600" : i % 2 ? "from-violet-500 to-violet-700" : "from-brand-600 to-brand-800";
  const kpiLoading = loading && !data;
  const latest = data?.latest ?? [];
  return <>
    {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Dhruva key numbers">
      {cards.map((c, i) => <Kpi key={c.label} icon={kpiIcons[i]} label={c.label} value={c.value} to={c.to} gradient={kpiGradient(c, i)} loading={kpiLoading} />)}
    </section>
    <div className="mt-6"><FollowUpsCard flow="dhruva" /></div>
    <section className="mt-6 grid gap-4 xl:grid-cols-2">
      <Panel title="Lead inflow" subtitle="Received during the selected period">
        <div className="h-72">{kpiLoading ? <ChartSkeleton /> : inflow.length ? <LazyCharts>{({ Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis }) => (<ResponsiveContainer width="100%" height="100%"><AreaChart data={inflow} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="dhruvaInflow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} /><stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label} /><Area type="monotone" dataKey="total" stroke="#0f766e" fill="url(#dhruvaInflow)" strokeWidth={2} /></AreaChart></ResponsiveContainer>)}</LazyCharts> : <p className="pt-10 text-center text-sm text-gray-500">No leads received in this period.</p>}</div>
      </Panel>
      <Panel title="Update breakdown" subtitle="Current update status of leads received in this period">
        <div className="h-72">{kpiLoading ? <ChartSkeleton /> : statusBars.some((x) => x.count) ? <LazyCharts>{({ Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis }) => (<ResponsiveContainer width="100%" height="100%"><BarChart data={statusBars} layout="vertical" margin={{ top: 8, right: 16, left: 18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" radius={[0, 5, 5, 0]}>{statusBars.map((x, i) => <Cell key={x.key} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>)}</LazyCharts> : <p className="pt-10 text-center text-sm text-gray-500">No updates yet.</p>}</div>
      </Panel>
      <Panel title="Leads by event type"><LinkedBarList rows={byTypes} period={period} color="#8b5cf6" loading={kpiLoading} /></Panel>
      <Panel title="Top venues"><LinkedBarList rows={venues} period={period} color="#0284c7" loading={kpiLoading} /></Panel>
      <Panel title="Events by month" subtitle={`${num(data?.no_event_date ?? data?.events_by_month?.no_event_date)} leads have no event date`}>
        <div className="h-64">{kpiLoading ? <ChartSkeleton /> : months.length ? <LazyCharts>{({ Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis }) => (<ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#f59e0b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>)}</LazyCharts> : <p className="pt-10 text-center text-sm text-gray-500">No events with a known date.</p>}</div>
      </Panel>
      <Panel title="Latest leads" subtitle="Six newest leads received in this period">
        {kpiLoading ? <ListSkeleton rows={6} avatar={false} className="-mx-5" label="Loading latest leads" /> : latest.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-gray-500"><th className="py-2">Name</th><th>Venue</th><th>Event date</th><th>Update</th></tr></thead><tbody>{latest.map((l) => <tr key={l.id} className="border-b border-gray-50"><td className="py-3"><Link to={dhruvaListLink({ search: l.name || phonesOf(l)[0] || "" }, period)} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">{l.name || phoneText(phonesOf(l)[0])}</Link><ContactActions phones={phonesOf(l)} name={l.name} className="mt-1 text-xs" /><span className="block text-xs text-gray-500">{dateTimeText(l.created_at)}</span></td><td>{l.venue || "—"}</td><td>{eventDatesText(eventDatesOf(l))}</td><td>{statusLabel(l.update_status)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-gray-500">No leads for this period.</p>}
      </Panel>
    </section>
  </>;
}
