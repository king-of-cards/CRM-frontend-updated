import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import LazyCharts from "../components/dashboard/LazyCharts.jsx";
import { ChartSkeleton } from "../components/shared/Skeleton.jsx";
import {
  AlarmClock, BadgeCheck, CalendarDays, Clock3, Hourglass, IndianRupee, Receipt, Send, Share2, ThumbsUp, Wallet,
} from "lucide-react";
import { getKocToDhruvaDashboard } from "../api/kocToDhruva.js";
import { Kpi, Panel } from "../components/dashboard/DashboardParts.jsx";
import FollowUpsCard from "../components/dashboard/FollowUpsCard.jsx";
import { dayText, dhruvaErrors, rupeesText } from "./dhruvaUtils.js";
import {
  branchRows, budgetBandRows, budgetQuantityText, dashboardKpiCards, daysSince, entryStatus, funnelRows,
  leadLink, monthlyPoints, num, pctText,
} from "./kocToDhruvaUtils.js";
import { kpiGridCols } from "../components/shared/kpiGrid.js";

// KOC → Dhruva dashboard (GET /analytics/koc-to-dhruva, docs section 18): the shared period
// (All time by default), the KPI cards (each opens the filtered list where an exact filter
// exists), follow-ups, then the panels: Monthly | Funnel, Upcoming events (full width), By branch |
// By budget band, Stale leads | Latest leads.

const KPI_ICONS = {
  shared: Share2, pending: Clock3, interested: ThumbsUp, quotes_sent: Send, quoted_amount: Receipt,
  converted: BadgeCheck, conversion_amount: IndianRupee, aov: Wallet, follow_ups_due: AlarmClock,
};
const kpiGradient = (key, i) =>
  key === "follow_ups_due" ? "from-amber-500 to-orange-600" : i % 2 ? "from-violet-500 to-violet-700" : "from-indigo-500 to-indigo-700";
const th = "py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";
const empty = (text) => <p className="text-sm text-gray-500">{text}</p>;

// A lead in a dashboard list: its name opens it on the list
function LeadName({ lead }) {
  return (
    <Link to={leadLink(lead)} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">
      {lead.name || "Unnamed lead"}
    </Link>
  );
}

// A compact list of leads: name, a detail line, and a value on the right
function LeadList({ leads, detail, right, none }) {
  if (!leads.length) return empty(none);
  return (
    <ul className="divide-y divide-gray-100">
      {leads.map((l) => (
        <li key={l.lead_key} className="flex items-start justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <LeadName lead={l} />
            <span className="block truncate text-xs text-gray-500">{detail(l)}</span>
          </span>
          <span className="shrink-0 text-right text-sm tabular-nums text-gray-900">{right(l)}</span>
        </li>
      ))}
    </ul>
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

  const monthly = useMemo(() => monthlyPoints(data?.monthly), [data]);
  const funnel = funnelRows(data?.funnel, period);
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count));
  const upcoming = data?.upcoming_events ?? {};
  const branches = branchRows(data?.by_branch, period);
  const bands = budgetBandRows(data?.by_budget_band);
  const stale = data?.stale ?? {};
  const cards = dashboardKpiCards(data?.kpis, period);
  const kpiLoading = loading && !data;

  return (
    <>
      {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <section className={`mt-6 grid gap-4 ${kpiGridCols(cards.length)}`} aria-label="KOC → Dhruva key numbers">
        {cards.map((c, i) => <Kpi key={c.key} icon={KPI_ICONS[c.key]} label={c.label} value={c.value} to={c.to} gradient={kpiGradient(c.key, i)} loading={kpiLoading} />)}
      </section>
      <div className="mt-6"><FollowUpsCard flow="koc_to_dhruva" /></div>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Monthly" subtitle="Leads shared and converted, by the month they were received">
          <div className="h-64">
            {kpiLoading ? <ChartSkeleton /> : monthly.some((m) => m.shared || m.converted) ? (
              <LazyCharts>{({ Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis }) => (<ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="shared" name="Shared" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>)}</LazyCharts>
            ) : <p className="pt-10 text-center text-sm text-gray-500">No leads received in this period.</p>}
          </div>
        </Panel>
        <Panel title="Funnel" subtitle="How far the period's leads got (% of shared)">
          {funnel.some((s) => s.count) ? (
            <div className="space-y-3">
              {funnel.map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-700">{s.label}</span>
                    <span className="tabular-nums">
                      {s.to ? <Link to={s.to} className="font-semibold hover:underline">{num(s.count)}</Link> : <span className="font-semibold">{num(s.count)}</span>}
                      {s.pct != null && <span className="ml-1.5 text-xs text-gray-500">{s.pct}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500" style={{ width: `${(s.count / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : empty("No leads received in this period.")}
        </Panel>

        <div className="xl:col-span-2">
          <Panel title="Upcoming events" subtitle="Open leads with an event from today" icon={CalendarDays}>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {[["Next 30 days", upcoming.next_30_days], ["Next 60 days", upcoming.next_60_days], ["Next 90 days", upcoming.next_90_days]].map(([label, n]) => (
                <span key={label} className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 ring-1 ring-indigo-100">{label}: {num(n)}</span>
              ))}
            </div>
            <LeadList
              leads={upcoming.next ?? []}
              detail={(l) => `${budgetQuantityText(l)} · ${entryStatus(l)}`}
              right={(l) => dayText(l.event_date)}
              none="No upcoming events."
            />
          </Panel>
        </div>

        <Panel title="By branch" subtitle="Leads received in the period">
          {branches.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100"><th className={th}>Branch</th><th className={`${th} text-right`}>Leads</th><th className={`${th} text-right`}>Converted</th><th className={`${th} text-right`}>Conversion amount</th></tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.key} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3"><span className="font-medium text-gray-900">{b.name}</span>{b.code && <span className="block text-[11px] text-gray-500">{b.code}</span>}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{b.to ? <Link to={b.to} className="font-semibold hover:underline">{num(b.leads)}</Link> : num(b.leads)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{num(b.converted)}</td>
                      <td className="py-2.5 text-right tabular-nums">{b.conversionAmount ? rupeesText(b.conversionAmount) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : empty("No leads received in this period.")}
        </Panel>
        <Panel title="By budget band" subtitle="Estimated budget per card">
          {bands.some((b) => b.leads) ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100"><th className={th}>Budget</th><th className={`${th} text-right`}>Leads</th><th className={`${th} text-right`}>Converted</th><th className={`${th} text-right`}>Rate</th></tr></thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.key} className="border-b border-gray-50">
                      <td className="py-2.5 pr-3 text-gray-800">{b.label}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{num(b.leads)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{num(b.converted)}</td>
                      <td className="py-2.5 text-right tabular-nums text-gray-600">{pctText(b.pct) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : empty("No leads received in this period.")}
        </Panel>

        <Panel title="Stale leads" subtitle={`${num(stale.count)} open leads untouched for 7+ days`} icon={Hourglass}>
          <LeadList
            leads={stale.oldest ?? []}
            detail={(l) => `${entryStatus(l)} · last change ${l.last_update ? dayText(l.last_update) : "never"}`}
            right={(l) => {
              const days = daysSince(l.last_update ?? l.received);
              return days == null ? "—" : `${days} days`;
            }}
            none="Nothing stale: every open lead was touched in the last 7 days."
          />
        </Panel>
        <Panel title="Latest leads" subtitle="Six newest leads received in this period">
          <LeadList
            leads={data?.latest ?? []}
            detail={(l) => [l.occasion, l.event_date && dayText(l.event_date), budgetQuantityText(l)].filter(Boolean).join(" · ")}
            right={(l) => <span className="text-xs text-gray-600">{entryStatus(l)}</span>}
            none="No leads for this period."
          />
        </Panel>
      </section>
    </>
  );
}
